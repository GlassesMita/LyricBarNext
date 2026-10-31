// LyricBarNext —— 网易云音乐 3.x 软件内词栏插件
// Copyright (C) 2026 Plana
//
// 本程序为自由软件：你可以在 GPL-3.0（或更高版本，由你选择）许可下
// 重新分发和/或修改它。完整许可文本见仓库根目录 LICENSE。
// 部分代码改编自 MIT 许可的第三方项目（详见 README「来源与鸣谢」），
// 其版权归原作者所有，此处随本程序以 GPL-3.0 重新分发。
// 歌词来源管理：
//   rnp      —— 桥接 RefinedNowPlayingNext（window.currentLyrics / lyrics-updated 事件）
//   official —— 官方解析：网易云歌词 API + 内置 liblyric 解析器（不依赖 RNPNext）
//   auto     —— 默认。有 RNPNext 时优先其歌词；RNPNext 未交付时回退官方解析
// 统一派发 document 事件 'lbn-lyrics-updated'（detail: { lyrics, unsynced }）。

import { getConfig, onConfigChange } from './config.js';
import { parseLyric } from './liblyric.js';
import { appendRegisterCall, getNCMStore, getPlayingSongId } from './ncm-compat.js';

const LYRIC_API = (songId) =>
	`${window?.APP_CONF?.domain ?? 'https://music.163.com'}/api/song/lyric/v1?tv=0&lv=0&rv=0&kv=0&yv=0&ytv=0&yrv=0&cp=false&id=${songId}`;

const emit = (detail) => {
	document.dispatchEvent(new CustomEvent('lbn-lyrics-updated', { detail }));
};

// ---- 官方解析流水线（预处理逻辑与 RNPNext lyric-provider 一致）----
const preProcessLyrics = (raw) => {
	if (!raw) return null;
	if (!raw.lrc) raw.lrc = {};

	const original = (raw?.lrc?.lyric ?? '').replace(/\u3000/g, ' ');
	const translation = raw?.ytlrc?.lyric ?? raw?.ttlrc?.lyric ?? raw?.tlyric?.lyric ?? '';
	const roma = raw?.yromalrc?.lyric ?? raw?.romalrc?.lyric ?? '';
	const dynamic = raw?.yrc?.lyric ?? '';
	const approxLines = original.match(/\[(.*?)\]/g)?.length ?? 0;

	const parsed = parseLyric(original, translation, roma, dynamic);

	// 逐字解析可疑（行数损失过大）时回退逐行解析
	if (approxLines - parsed.length > approxLines * 0.7) {
		return parseLyric(original, translation, roma);
	}
	return parsed;
};

const processLyrics = (lyrics) => {
	for (const line of lyrics ?? []) {
		if (line.originalLyric === '') {
			line.isInterlude = true;
		}
	}
	return lyrics ?? [];
};

let currentRawFingerprint = null;
let officialResults = new Map(); // songId -> {lyrics, unsynced}
let fetchAbort = null;
let fallbackTimer = 0;
let rnpDeliveredForEpoch = false;
let epoch = 0;
let lastEmittedKey = null;

const isRnpPluginLoaded = () => {
	try {
		return typeof loadedPlugins !== 'undefined' && !!loadedPlugins['RefinedNowPlayingNext'];
	} catch (e) {
		return false;
	}
};

const dispatchOfficial = (songId) => {
	const cached = officialResults.get(String(songId));
	if (!cached) return false;
	const key = `official-${songId}-${cached.lyrics.length}`;
	if (key === lastEmittedKey) return true;
	lastEmittedKey = key;
	emit(cached);
	return true;
};

const fetchOfficial = async (songId, { signal } = {}) => {
	const id = String(songId ?? '').trim();
	if (!id || id === '0') return;
	try {
		const resp = await fetch(LYRIC_API(id), { signal });
		if (!resp.ok) throw new Error(`lyric api ${resp.status}`);
		const raw = await resp.json();
		if (signal?.aborted) return;

		const parsed = preProcessLyrics(raw);
		const processed = processLyrics(parsed ?? []);
		const detail = { lyrics: processed, unsynced: !!processed[0]?.unsynced };
		officialResults.set(id, detail);
		if (officialResults.size > 8) {
			officialResults.delete(officialResults.keys().next().value);
		}

		const source = getConfig().lyricSource ?? 'auto';
		if (source === 'official') {
			lastEmittedKey = null;
			dispatchOfficial(id);
		} else if (source === 'auto') {
			// RNPNext 已交付本首歌的歌词则不覆盖；否则作为回退立即交付
			if (!rnpDeliveredForEpoch || !isRnpPluginLoaded()) {
				rnpDeliveredForEpoch = true; // 阻止 fallback 重复派发
				lastEmittedKey = null;
				dispatchOfficial(id);
			}
		}
	} catch (e) {
		if (!signal?.aborted) {
			console.debug('LyricBarNext: 官方歌词获取失败', id, e);
		}
	}
};

const refreshOfficial = (songId) => {
	const id = String(songId ?? '').trim();
	if (!id || id === '0') return;
	epoch += 1;
	rnpDeliveredForEpoch = false;
	clearTimeout(fallbackTimer);

	fetchAbort?.abort();
	if (officialResults.has(id)) {
		// 已有缓存：先立即交付，仍后台刷新一次保证新鲜
		if (getConfig().lyricSource !== 'rnp' && !(getConfig().lyricSource === 'auto' && isRnpPluginLoaded())) {
			dispatchOfficial(id);
		}
	}
	const abort = new AbortController();
	fetchAbort = abort;
	fetchOfficial(id, { signal: abort.signal });

	// auto 模式：给 RNPNext 2.5s 交付窗口，超时用官方结果兜底
	if (getConfig().lyricSource === 'auto' && isRnpPluginLoaded()) {
		const currentEpoch = epoch;
		fallbackTimer = setTimeout(() => {
			if (currentEpoch === epoch && !rnpDeliveredForEpoch) {
				dispatchOfficial(id);
			}
		}, 2500);
	}
};

// ---- RNPNext 桥接 ----
const onRnpLyricsUpdated = (e) => {
	if (!e.detail?.lyrics) return;
	const source = getConfig().lyricSource ?? 'auto';
	if (source === 'official') return; // 明确选择官方时不接受 RNP 推送
	rnpDeliveredForEpoch = true;
	clearTimeout(fallbackTimer);
	const key = `rnp-${e.detail.hash ?? e.detail.lyrics.length}`;
	if (key === lastEmittedKey) return;
	lastEmittedKey = key;
	emit({ lyrics: e.detail.lyrics, unsynced: !!e.detail.unsynced });
};

// ---- 来源切换 ----
let storeUnsubscribe = null;
let lastWatchedSongId = '';

const startOfficialPipeline = () => {
	// 歌曲切换：注册 audioplayer Load 事件 + 监听 redux store 歌曲变化
	appendRegisterCall('Load', 'audioplayer', () => {
		refreshOfficial(getPlayingSongId());
	});

	const store = getNCMStore();
	if (store?.subscribe) {
		storeUnsubscribe = store.subscribe(() => {
			try {
				const id = getPlayingSongId();
				if (id && id !== lastWatchedSongId) {
					lastWatchedSongId = id;
					refreshOfficial(id);
				}
			} catch (e) { /* store 回调中容错 */ }
		});
	}
};

const applySource = () => {
	const source = getConfig().lyricSource ?? 'auto';
	clearTimeout(fallbackTimer);
	if (source === 'official') {
		// 立即用官方结果刷新当前歌
		refreshOfficial(getPlayingSongId());
	} else if (source === 'rnp') {
		// 交给 RNPNext：若其已有当前歌词则立即桥接一次
		if (window.currentLyrics?.lyrics) {
			lastEmittedKey = null;
			emit({ lyrics: window.currentLyrics.lyrics, unsynced: !!window.currentLyrics.unsynced });
		}
	} else {
		// auto：先看 RNPNext 是否已有，否则官方兜底
		if (window.currentLyrics?.lyrics && isRnpPluginLoaded()) {
			rnpDeliveredForEpoch = true;
			lastEmittedKey = null;
			emit({ lyrics: window.currentLyrics.lyrics, unsynced: !!window.currentLyrics.unsynced });
		} else {
			refreshOfficial(getPlayingSongId());
		}
	}
};

let initialized = false;
export function initLyricSource() {
	if (initialized) return;
	initialized = true;

	document.addEventListener('lyrics-updated', onRnpLyricsUpdated);
	startOfficialPipeline();
	onConfigChange(() => applySource());

	// 初始交付（RNPNext 已有 → 直接用；否则官方拉取）
	setTimeout(applySource, 0);
}
