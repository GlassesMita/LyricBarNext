// LyricBarNext —— 网易云音乐 3.x 软件内词栏插件
// Copyright (C) 2026 Plana
//
// 本程序为自由软件：你可以在 GPL-3.0（或更高版本，由你选择）许可下
// 重新分发和/或修改它。完整许可文本见仓库根目录 LICENSE。
// 部分代码改编自 MIT 许可的第三方项目（详见 README「来源与鸣谢」），
// 其版权归原作者所有，此处随本程序以 GPL-3.0 重新分发。
// 移植自 RefinedNowPlayingNext (https://github.com/SUlTlUS/refined-now-playing-netease-next) 的 src/ncm-compat.js
// 提供网易云音乐 3.x 下的播放状态 / 播放按钮 / audioplayer 事件兼容层。
// 3.x 中 legacyNativeCmder 与 .m-player .btnp 已不可用，改为：
//   - 通过 React root 容器取得 Redux store 读取播放信息
//   - 通过 footer 按钮特征识别播放/暂停状态
//   - 通过 channel.registerCall 注册 audioplayer 事件

const ROOT_STORE_CANDIDATES = [
	() => document.getElementById('root')?._reactRootContainer?._internalRoot?.current?.child?.child?.memoizedProps?.store,
	() => document.getElementById('root')?._reactRootContainer?._internalRoot?.current?.child?.memoizedProps?.store,
	() => document.getElementById('root')?._reactRootContainer?._internalRoot?.current?.memoizedProps?.store,
	() => document.getElementById('root')?._reactRootContainer?._internalRoot?.current?.memoizedState?.element?.props?.store,
];

const AMLL_PLAYER_BUTTON_SELECTOR = '#btn_pc_minibar_play';
const V3_PLAY_BUTTON_SELECTOR = 'footer > * > * > .middle > *:nth-child(1) > button:nth-child(3)';
const PAUSE_TEXT_PATTERN = /pause|暂停/;
const TRANSPORT_LABEL_PATTERNS = {
	previous: /previous|prev|rewind|back|last|上一首|上一曲|上首|上曲/,
	next: /next|forward|下一首|下一曲|下首|下曲/,
	play: /play|pause|播放|暂停/,
};
const PLAY_MODE_LABEL_PATTERN = /play.?mode|playback.?mode|shuffle|random|order|repeat|loop|singleloop|single|cycle|播放模式|心动模式|随机|顺序|循环|单曲|列表循环/;
const PLAY_MODE_EXCLUDE_PATTERN = /playlist|queue|播放列表|播放队列|歌曲列表|歌单/;

const normalizeString = (value) => String(value ?? '').trim();
const normalizeClassName = (value) => {
	if (typeof value === 'string') {
		return value;
	}
	if (typeof value?.baseVal === 'string') {
		return value.baseVal;
	}
	return normalizeString(value);
};
const registeredEvents = new Set();
const registeredCallbacks = new Map();
 
// RNPNext registers the same native audioplayer callbacks. In NCM 3.x,
// registerCall can replace the preceding handler instead of adding a listener.
// When RNPNext is active, do not compete for those single-slot callbacks.
export const isRefinedNowPlayingActive = () => {
	try {
		const plugins = typeof loadedPlugins !== 'undefined' ? loadedPlugins : window.loadedPlugins;
		return !!plugins?.RefinedNowPlayingNext && plugins.RefinedNowPlayingNext.enabled !== false;
	} catch (error) {
		return false;
	}
};
const RNP_SHARED_EVENTS = new Set(['audioplayer.onPlayProgress', 'audioplayer.onPlayState', 'audioplayer.onLoad']);


export const getNCMStore = () => {
	for (const getStore of ROOT_STORE_CANDIDATES) {
		try {
			const store = getStore();
			if (store?.getState && store?.subscribe) {
				return store;
			}
		} catch (error) {
			console.debug('Failed to resolve NCM store candidate', error);
		}
	}
	return null;
};

export const getPlayingState = () => {
	const state = getNCMStore()?.getState?.();
	return state?.playing ?? null;
};

export const getPlayingSong = () => {
	return getPlayingState();
};

export const getPlayingSongId = () => {
	const playingSong = getPlayingSong();
	const candidates = [
		playingSong?.resourceTrackId,
		playingSong?.originFromTrack?.lrcid,
		playingSong?.originFromTrack?.track?.tid,
		playingSong?.curTrack?.id,
		playingSong?.id,
		playingSong?.data?.id,
	];

	for (const candidate of candidates) {
		const normalized = normalizeString(candidate);
		if (normalized) {
			return normalized;
		}
	}

	return '';
};

const getDirectPlayerButton = () => (
	document.querySelector(AMLL_PLAYER_BUTTON_SELECTOR)
	|| document.querySelector(V3_PLAY_BUTTON_SELECTOR)
);

export const getPlayerButton = () => (
	findPlayButtonInButtons(sortButtonsByPosition(getFooterButtons()))
	|| getDirectPlayerButton()
);

export const getIsPlayingFromPlayStateEvent = (stateId) => {
	const state = normalizeString(stateId).toLowerCase().split('|').pop();
	if (state === 'pause') {
		return false;
	}
	if (state === 'resume') {
		return true;
	}
	return null;
};

export const isPlayerButtonPlaying = (button = getPlayerButton()) => {
	if (!button) {
		return false;
	}

	const stateText = [
		button.getAttribute('aria-label'),
		button.getAttribute('title'),
		button.textContent,
	].join(' ').toLowerCase();
	return (
		button.classList?.contains('btnp-pause') ||
		button.classList?.contains('play-pause-btn') ||
		PAUSE_TEXT_PATTERN.test(stateText)
	);
};

export const isPlayerPlaying = () => isPlayerButtonPlaying(getPlayerButton());

const getElementDescriptor = (element) => {
	if (!element) {
		return '';
	}

	const parts = [
		element.getAttribute?.('aria-label'),
		element.getAttribute?.('title'),
		element.getAttribute?.('aria-pressed'),
		element.getAttribute?.('data-state'),
		element.getAttribute?.('data-active'),
		element.getAttribute?.('data-checked'),
		element.getAttribute?.('data-testid'),
		element.getAttribute?.('data-action'),
		normalizeClassName(element.className),
		element.textContent,
	];

	const childDescriptors = Array.from(
		element.querySelectorAll?.('[aria-label], [title], [aria-pressed], [data-state], [data-active], [data-checked], [data-testid], [data-action], [class]') ?? []
	).flatMap((child) => [
		child.getAttribute?.('aria-label'),
		child.getAttribute?.('title'),
		child.getAttribute?.('aria-pressed'),
		child.getAttribute?.('data-state'),
		child.getAttribute?.('data-active'),
		child.getAttribute?.('data-checked'),
		child.getAttribute?.('data-testid'),
		child.getAttribute?.('data-action'),
		normalizeClassName(child.className),
	]);

	return [...parts, ...childDescriptors].join(' ').toLowerCase();
};

const isPlayModeButton = (button) => {
	const descriptor = getElementDescriptor(button);
	return PLAY_MODE_LABEL_PATTERN.test(descriptor) && !PLAY_MODE_EXCLUDE_PATTERN.test(descriptor);
};

const hasTransportLabel = (button, action) => (
	TRANSPORT_LABEL_PATTERNS[action]?.test(getElementDescriptor(button))
);

const isLikelyPlayButton = (button) => (
	button?.matches?.(AMLL_PLAYER_BUTTON_SELECTOR)
	|| button?.matches?.(V3_PLAY_BUTTON_SELECTOR)
	|| isPlayerButtonPlaying(button)
);

const findPlayButtonInButtons = (buttons) => (
	buttons.find(isLikelyPlayButton)
	|| buttons.find((button) => (
		hasTransportLabel(button, 'play')
		&& !isPlayModeButton(button)
		&& !PLAY_MODE_EXCLUDE_PATTERN.test(getElementDescriptor(button))
	))
	|| null
);

const getFooterButtons = () => Array.from(document.querySelectorAll('footer .middle button'))
	.filter((button) => !button.disabled);

const sortButtonsByPosition = (buttons) => [...buttons].sort((first, second) => {
	const firstRect = first.getBoundingClientRect?.() ?? { left: 0, top: 0 };
	const secondRect = second.getBoundingClientRect?.() ?? { left: 0, top: 0 };
	if (Math.abs(firstRect.top - secondRect.top) > 4) {
		return firstRect.top - secondRect.top;
	}
	if (firstRect.left !== secondRect.left) {
		return firstRect.left - secondRect.left;
	}
	return 0;
});

const dispatchRegisteredEvent = (eventName, args) => {
	for (const callback of registeredCallbacks.get(eventName) ?? []) {
		try {
			callback(...args);
		} catch (error) {
			console.warn(`Failed to handle ${eventName}`, error);
		}
	}
};

export const appendRegisterCall = (name, namespace, callback) => {
	if (typeof channel === 'undefined' || typeof channel.registerCall !== 'function') {
		return callback;
	}

	const eventName = `${namespace}.on${name}`;
	if (isRefinedNowPlayingActive() && RNP_SHARED_EVENTS.has(eventName)) {
		return callback;
	}
	if (!registeredEvents.has(eventName)) {
		registeredEvents.add(eventName);
		channel.registerCall(eventName, (...args) => {
			dispatchRegisteredEvent(eventName, args);
		});
	}

	if (!registeredCallbacks.has(eventName)) {
		registeredCallbacks.set(eventName, new Set());
	}
	registeredCallbacks.get(eventName).add(callback);
	return callback;
};

export const removeRegisterCall = (name, namespace, callback) => {
	if (typeof channel === 'undefined' || typeof channel.registerCall !== 'function') {
		return;
	}

	const eventName = `${namespace}.on${name}`;
	if (!registeredCallbacks.has(eventName)) {
		return;
	}

	registeredCallbacks.get(eventName).delete(callback);
	if (registeredCallbacks.get(eventName).size === 0) {
		registeredCallbacks.delete(eventName);
	}
};

// 鲁棒性：原生侧可能在页面重注入等时机丢弃 registerCall 绑定。
// 对已注册的事件名向原生重新绑定同一分发器（幂等），用于进度事件失联后的自愈。
export const rebindChannelEvents = () => {
	if (typeof channel === 'undefined' || typeof channel.registerCall !== 'function') {
		return false;
	}
	let ok = 0;
	for (const eventName of registeredEvents) {
		if (isRefinedNowPlayingActive() && RNP_SHARED_EVENTS.has(eventName)) continue;
		try {
			channel.registerCall(eventName, (...args) => dispatchRegisteredEvent(eventName, args));
			ok += 1;
		} catch (error) {
			console.warn(`LBN: rebind ${eventName} failed`, error);
		}
	}
	return ok > 0;
};
