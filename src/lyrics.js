// LyricBarNext —— 网易云音乐 3.x 软件内词栏插件
// Copyright (C) 2026 Plana
//
// 本程序为自由软件：你可以在 GPL-3.0（或更高版本，由你选择）许可下
// 重新分发和/或修改它。完整许可文本见仓库根目录 LICENSE。
// 部分代码改编自 MIT 许可的第三方项目（详见 README「来源与鸣谢」），
// 其版权归原作者所有，此处随本程序以 GPL-3.0 重新分发。
import { getConfig, onConfigChange, setConfig } from './config.js';
import { appendRegisterCall, removeRegisterCall, rebindChannelEvents, getIsPlayingFromPlayStateEvent, isPlayerPlaying, isRefinedNowPlayingActive, getPlayingSongId, getPlayingState } from './ncm-compat.js';

const useState = React.useState;
const useEffect = React.useEffect;
const useLayoutEffect = React.useLayoutEffect;
const useRef = React.useRef;
const useCallback = React.useCallback;

// 偏移量安全解析：任何来源的非有限值（NaN/Infinity/undefined）一律归零，
// 防止 NaN 进入时间轴比较（time <= NaN 恒为 false → 行推进永久冻结）
const safeInt = (v) => {
	const n = Math.round(Number(v));
	return Number.isFinite(n) ? n : 0;
};

export function Lyrics(props) {
	const containerRef = useRef(null);
	const lineEls = useRef(new Map());      // index -> DOM
	const tops = useRef(new Map());         // index -> 当前位移（记账）
	const visState = useRef(new Map());     // index -> 上次写入的 visibility

	let [lyrics, setLyrics] = useState(null);
	const _lyrics = useRef(null);
	const _setLyrics = setLyrics;
	setLyrics = (x) => {
		_lyrics.current = x;
		_setLyrics(x);
	}
	const [hasTranslation, setHasTranslation] = useState(false);
	const [hasRomaji, setHasRomaji] = useState(false);
	const [hasKaraoke, setHasKaraoke] = useState(false);
	const [isUnsynced, setIsUnsynced] = useState(false);

	const [playState, setPlayState] = useState(null);
	const _playState = useRef(null);
	const [songId, setSongId] = useState("0");
	const currentTime = useRef(0); // 当前播放时间
	const lastProgressAt = useRef(Date.now()); // 最近一次进度/状态事件时间（失联检测用）
	const [seekCounter, setSeekCounter] = useState(0); // 拖动进度条时修改触发重渲染
	const [recalcCounter, setRecalcCounter] = useState(0); // 手动重计算时触发渲染

	let [currentLine, setCurrentLine] = useState(0);
	const _currentLine = useRef(0);
	const _setCurrentLine = setCurrentLine;
	setCurrentLine = (x) => {
		_currentLine.current = x;
		_setCurrentLine(x);
	}
	const [currentLineForScrolling, setCurrentLineForScrolling] = useState(0);	// 为提前 0.2s 滚动，使滚动 delay 与逐字歌词对应 而设置的 提前的，仅用于滚动的 currentLine

	const [globalOffset, setGlobalOffset] = useState(safeInt(getConfig().globalOffset));
	const globalOffsetRef = useRef(globalOffset);
	useEffect(() => { globalOffsetRef.current = globalOffset; }, [globalOffset]);

	const heightOfItems = useRef([]);

	// 当前播放时间经此读取（行组件用 React.memo 跳过窗口外重渲染，不能依赖逐 tick 的 prop）
	const getCurrentTime = useCallback(() => currentTime.current + globalOffsetRef.current, []);

	const [containerHeight, setContainerHeight] = useState(0);
	const [containerWidth, setContainerWidth] = useState(0);
	const retryRef = useRef(false);

	const cfg = getConfig();
	const [fontSize, setFontSize] = useState(parseInt(cfg.fontSize));
	const [showTranslation, setShowTranslation] = useState(!!cfg.showTranslation);
	const [showRomaji, setShowRomaji] = useState(!!cfg.showRomaji);
	const [useKaraokeLyrics, setUseKaraokeLyrics] = useState(!!cfg.useKaraokeLyrics);
	const [firstLineBold, setFirstLineBold] = useState(!!cfg.firstLineBold);
	const [adaptiveWidth, setAdaptiveWidth] = useState(!!cfg.adaptiveWidth);

	const shouldTransit = useRef(true);

	// 3.x：不读取 #main-player 的 data-log，仅按歌词内容判断纯音乐（与 RefinedNowPlayingNext 一致）
	const isPureMusic = !lyrics || (
		lyrics.length <= 1 ||
		lyrics.length <= 10 && lyrics.some((x) => (x.originalLyric ?? '').includes('纯音乐')) ||
		isUnsynced
	);

	useEffect(() => {
		if (isPureMusic) {
			containerRef.current.parentElement.parentElement.classList.add('no-lyrics');
		} else {
			containerRef.current.parentElement.parentElement.classList.remove('no-lyrics');
		}
	}, [lyrics, songId]);

	const onLyricsUpdate = (e) => {
		if (!e.detail) {
			return;
		}
		shouldTransit.current = false;
		if (!e.detail.amend){
			setCurrentLine(0);
			setCurrentLineForScrolling(0);
		}
		setLyrics(e.detail.lyrics);
		setHasTranslation(e.detail.lyrics.some((x) => x.translatedLyric));
		setHasRomaji(e.detail.lyrics.some((x) => x.romanLyric));
		setHasKaraoke(e.detail.lyrics.some((x) => x.dynamicLyric));
		setIsUnsynced(!!e.detail.unsynced);
		if (e.detail.amend) {
			shouldTransit.current = true;
			setRecalcCounter(+ new Date());
		}
	}

	useEffect(() => {
		shouldTransit.current = false;
		document.addEventListener('lbn-lyrics-updated', onLyricsUpdate);
		return () => {
			document.removeEventListener('lbn-lyrics-updated', onLyricsUpdate);
		}
	}, []);

	useEffect(() => {
		document.body.style.setProperty('--lyric-bar-font-size', fontSize + 'px');
		document.body.style.setProperty('--lyric-bar-lines', ((hasTranslation && showTranslation) + (hasRomaji && showRomaji) + 1));
	}, [hasTranslation, hasRomaji, showTranslation, showRomaji, fontSize]);

	// 统一配置变化 → 更新歌词相关项
	useEffect(() => onConfigChange((c) => {
		setFontSize(safeInt(c.fontSize) || 20);
		setShowTranslation(!!c.showTranslation);
		setShowRomaji(!!c.showRomaji);
		setUseKaraokeLyrics(!!c.useKaraokeLyrics);
		setFirstLineBold(!!c.firstLineBold);
		setAdaptiveWidth(!!c.adaptiveWidth);
		const off = safeInt(c.globalOffset);
		if (off !== globalOffset) {
			setGlobalOffset(off);
			setSeekCounter(+new Date());
		}
	}), [globalOffset]);

	// RNPNext 修改全局偏移时同步进配置
	useEffect(() => {
		const h = (e) => setConfig({ globalOffset: safeInt(e.detail) });
		document.addEventListener('rnp-global-offset', h);
		return () => document.removeEventListener('rnp-global-offset', h);
	}, []);

	useLayoutEffect(() => { // 测量每行高度
		if (!lyrics) return;
		const container = containerRef.current;
		const heights = [];
		for (const item of container.children) {
			heights.push(item.clientHeight);
		}
		heightOfItems.current = heights;
	}, [lyrics, containerWidth, fontSize, showTranslation, hasTranslation, showRomaji, hasRomaji, useKaraokeLyrics, recalcCounter]);

	// ---- 行位移：行切换时一次性写入目标 transform，由合成器按非线性缓动插值 ----
	// 注意：visibility 是可继承属性，盲目重写会让整棵子树（数千个逐字 span）样式重算，
	// 因此仅在值实际变化时写入；transform 仅写入活动窗口（±4 行），窗口外只记账。
	const setLineEl = useCallback((index, el) => {
		if (el) lineEls.current.set(index, el);
		else lineEls.current.delete(index);
	}, []);
	const applyLineTops = (focus, animate) => {
		const items = heightOfItems.current;
		if (!items.length || !containerRef.current) return;
		const space = 5;
		const n = items.length;
		const current = Math.min(Math.max(focus ?? 0, 0), n - 1);
		let written = 0;

		const targets = new Array(n).fill(0);
		const curH = items[current] ?? 0;
		targets[current] = containerRef.current.clientHeight * 0.5 - curH / 2;
		// 间奏行临时增高参与布局计算（与 RNPNext 行为一致）
		items[current] = curH + (_lyrics.current?.[current]?.isInterlude ? 50 : 0);
		for (let i = current - 1; i >= 0; i--) {
			targets[i] = targets[i + 1] - items[i] - space;
		}
		for (let i = current + 1; i < n; i++) {
			targets[i] = targets[i - 1] + items[i - 1] + space;
		}
		items[current] = curH;

		// 预检测：待定位窗口内是否存在从未定位过的元素（重挂载/首次出现）
		let hasFresh = false;
		for (let i = Math.max(0, current - 4); i <= Math.min(n - 1, current + 4); i++) {
			const el = lineEls.current.get(i);
			if (el && !el.style.transform) {
				hasFresh = true;
				break;
			}
		}

		const barEl = containerRef.current.parentElement?.parentElement;
		// 瞬时判定：非动画模式（换歌/seek 复位/resize），
		// 或窗口内存在未定位的新元素——否则新元素会从 translateY(0) 飞入，
		// 造成歌词加载首帧的重叠观感
		const instant = !animate || hasFresh;
		barEl?.classList.toggle('lbn-instant', instant);

		for (let i = 0; i < n; i++) {
			const el = lineEls.current.get(i);
			if (!el) continue;
			const offset = i - focus;
			const near = Math.abs(offset) <= 3;

			const vis = near ? 'visible' : 'hidden';
			if (visState.current.get(i) !== vis) {
				visState.current.set(i, vis);
				el.style.visibility = vis;
			}
			el.classList.toggle('lbn-near', near);

			if (Math.abs(offset) <= 4) {
				const fresh = !el.style.transform;
				const prev = tops.current.get(i);
				tops.current.set(i, targets[i]);
				if (fresh || prev === undefined || Math.abs(prev - targets[i]) > 0.01) {
					el.style.transform = `translateY(${targets[i]}px)`;
				}
				written += 1;
			} else {
				tops.current.set(i, targets[i]);
			}
		}

		// 瞬时覆写完成后恢复过渡（下一行切换继续动画）
		if (instant && animate) {
			requestAnimationFrame(() => barEl?.classList.remove('lbn-instant'));
		}

		// 挂载竞态兜底：若本次没有任何行被定位（行元素注册晚于本布局效果的极端情况），
		// 稍后强制重算一次，避免全部行停留在未定位的堆叠状态
		if (written === 0 && n > 0 && !retryRef.current) {
			retryRef.current = true;
			setTimeout(() => {
				retryRef.current = false;
				setRecalcCounter(+new Date());
			}, 80);
		}
	};

	useLayoutEffect(() => { // 行位置重算（歌行切换/尺寸变化/配置变化/歌曲切换重挂载）
		if (!lyrics?.length) return;
		applyLineTops(currentLineForScrolling, shouldTransit.current);
	}, [
		currentLineForScrolling,
		containerHeight, containerWidth,
		fontSize,
		showTranslation, showRomaji, useKaraokeLyrics,
		recalcCounter,
		lyrics,
		songId // songId 参与 Line 的 key，歌曲切换会整批重挂载行元素，必须重新定位
	]);

	const onResize = () => {
		shouldTransit.current = false;
		const container = containerRef.current;
		setContainerHeight(container.clientHeight);
		if (!adaptiveWidth) setContainerWidth(container.clientWidth - 30);
	};

	useEffect(() => {
		const resizeObserver = new ResizeObserver(() => {
			onResize();
		});
		resizeObserver.observe(containerRef.current);
		onResize();
		return () => {
			resizeObserver.disconnect();
		}
	}, []);

	useEffect(() => {
		const onRecalc = () => {
			setRecalcCounter(+ new Date());
		}
		window.addEventListener('recalc-lyrics', onRecalc);
		return () => {
			window.removeEventListener('recalc-lyrics', onRecalc);
		}
	});

	const onPlayStateChange = (id, state) => {
		lastProgressAt.current = Date.now();
		// 3.x：播放状态从事件参数（resume/pause）判断，取不到时回退到 footer 播放按钮检测
		_playState.current = getIsPlayingFromPlayStateEvent(state) ?? isPlayerPlaying();
		setPlayState(_playState.current);
		setSongId(id);
	};
	const onPlayProgress = (id, progress) => {
		lastProgressAt.current = Date.now();
		const lastTime = currentTime.current + globalOffset;
		currentTime.current = ((progress * 1000) || 0);
		const currentTimeWithOffset = currentTime.current + globalOffset;
		if (!Number.isFinite(currentTimeWithOffset)) {
			// 偏移被毒化时自愈，避免行推进冻结
			currentTime.current = 0;
			if (!Number.isFinite(globalOffset)) setGlobalOffset(0);
			return;
		}
		if (!_lyrics.current) return;
		let startIndex = 0;
		if (currentTimeWithOffset - lastTime > 0 && currentTimeWithOffset - lastTime < 50) {
			startIndex = Math.max(0, currentLine - 1);
		}
		if (currentTimeWithOffset < lastTime - 10) {
			setSeekCounter(+new Date());
		}

		let cur = 0;
		for (let i = startIndex; i < _lyrics.current.length; i++) {
			if (_lyrics.current[i].time <= currentTimeWithOffset) {
				cur = i;
			} else {
				break;
			}
		}
		if (
			cur == _lyrics.current.length - 1 &&
			_lyrics.current[cur].duration &&
			currentTimeWithOffset > _lyrics.current[cur].time + _lyrics.current[cur].duration + 500
		) {
			cur = _lyrics.current.length;
		}

		let curForScrolling = Math.max(0, cur - 1);
		const scrollingDelay = 0;
		for (let i = startIndex; i < _lyrics.current.length; i++) {
			if (_lyrics.current[i].time <= currentTimeWithOffset + scrollingDelay) {
				curForScrolling = i;
			} else {
				break;
			}
		}

		shouldTransit.current = true;
		setCurrentLine(cur);
		setCurrentLineForScrolling(curForScrolling);
	};
	useEffect(() => {
		onPlayProgress(songId, currentTime.current / 1000);
	}, [lyrics, globalOffset]);

	// RNPNext and LyricBarNext both register single-slot native audioplayer events.
	// Use a passive clock when RNPNext is present; avoid replacing its callbacks.
	useEffect(() => {
		if (!isRefinedNowPlayingActive()) return;
		let lastId = '';
		let lastPlaying = null;
		let anchorSeconds = null;
		let anchorAt = 0;
		let source = 'none';
		const sample = () => {
			const id = getPlayingSongId();
			if (!id) return;
			const playing = isPlayerPlaying();
						const changedSong = id !== lastId;
			if (changedSong) {
				lastId = id;
				anchorSeconds = null;
				anchorAt = 0;
				source = 'none';
			}
			if (changedSong || playing !== lastPlaying) {
				lastPlaying = playing;
				onPlayStateChange(id, playing ? 'resume' : 'pause');
			}
			const now = performance.now();
			const plugins = typeof loadedPlugins !== 'undefined' ? loadedPlugins : window.loadedPlugins;
			const player = plugins?.LibFrontendPlay?.currentAudioPlayer;
			let value = player && Number.isFinite(player.currentTime) ? player.currentTime : null;
			if (value != null) source = 'LibFrontendPlay';
			if (value == null) {
				const media = [...document.querySelectorAll('audio, video')].find(el =>
					Number.isFinite(el.duration) && el.duration > 0 &&
					Number.isFinite(el.currentTime) && (playing ? !el.paused : true));
				if (media) { value = media.currentTime; source = 'media'; }
			}
			if (value == null) {
				const duration = Number(getPlayingState()?.resourceDuration);
				if (Number.isFinite(duration) && duration > 0) {
					for (const el of document.querySelectorAll('input[type="range"], [role="slider"]')) {
						const max = Number(el.max ?? el.getAttribute('aria-valuemax'));
						const pos = Number(el.value ?? el.getAttribute('aria-valuenow'));
						if (Number.isFinite(max) && Math.abs(max - duration) < Math.max(2, duration * 0.015) && Number.isFinite(pos) && pos >= 0 && pos <= max) {
							value = pos; source = 'slider'; break;
						}
					}
				}
			}
			if (value == null) {
				// The native 3.x footer shows elapsed time even without an HTMLAudioElement.
				// Use it as a low-resolution fallback and interpolate between changes.
				const text = document.querySelector('footer')?.innerText ?? '';
				const matches = [...text.matchAll(/(?:^|\\s)(\\d{1,3}):(\\d{2})(?=\\s|\\/|$)/g)];
				const duration = Number(getPlayingState()?.resourceDuration);
				for (const match of matches) {
					const seconds = Number(match[1]) * 60 + Number(match[2]);
					if (Number.isFinite(duration) && duration > 0 && seconds > duration + 2) continue;
					if (anchorSeconds == null || Math.abs(seconds - anchorSeconds) >= 0.9) {
						value = seconds;
						anchorSeconds = seconds;
						anchorAt = now;
						break;
					}
				}
			}
			if (value == null && anchorSeconds != null) {
				value = anchorSeconds + (playing ? Math.max(0, now - anchorAt) / 1000 : 0);
				source = 'extrapolated';
			}
			if (!Number.isFinite(value) || value < 0) return;
			anchorSeconds = value;
			anchorAt = now;
			lastProgressAt.current = Date.now();
			onPlayProgress(id, value);
			window.__lbnPassiveProgress = { songId: id, seconds: value, source, playing };
		};
		const timer = setInterval(() => { try { sample(); } catch (e) { console.debug('LBN passive clock', e); } }, 125);
		sample();
		return () => { clearInterval(timer); };
	}, []);

	useEffect(() => {
		if (isRefinedNowPlayingActive()) return;
		appendRegisterCall("PlayState", "audioplayer", onPlayStateChange);
		appendRegisterCall("PlayProgress", "audioplayer", onPlayProgress);
		const _channalCall = channel.call;
		channel.call = (name, ...args) => {
			if (name == "audioplayer.seek") {
				try {
					currentTime.current = parseInt(args?.[1]?.[2] * 1000) || 0;
					lastProgressAt.current = Date.now();
					setSeekCounter(+new Date());
				} catch (e) { /* seek 参数形态异常时不中断调用链 */ }
			}
			return _channalCall(name, ...args);
		};
		return () => {
			removeRegisterCall("PlayState", "audioplayer", onPlayStateChange);
			removeRegisterCall("PlayProgress", "audioplayer", onPlayProgress);
			channel.call = _channalCall;
		}
	});

	// 失联看门狗：播放器在播放但超过 5s 没有任何进度/状态事件时，
	// 向原生重新绑定 audioplayer 事件（幂等），实现自愈
	useEffect(() => {
		if (isRefinedNowPlayingActive()) return;
		const timer = setInterval(() => {
			try {
				if (isRefinedNowPlayingActive()) return;
				if (!isPlayerPlaying()) {
					lastProgressAt.current = Date.now(); // 暂停期间不累计失联
					return;
				}
				if (Date.now() - lastProgressAt.current < 5000) return;
				console.warn('LBN: 播放进行中但进度事件失联，重新绑定 audioplayer 事件');
				lastProgressAt.current = Date.now();
				rebindChannelEvents();
			} catch (e) { /* 看门狗自身不容失败 */ }
		}, 2000);
		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		if (adaptiveWidth) {
			containerRef.current.parentElement.parentElement.classList.add("adaptive-width");
		} else {
			containerRef.current.parentElement.parentElement.classList.remove("adaptive-width");
		}
		onResize();
	}, [adaptiveWidth]);

	const setCurrentLineWidth = useCallback((width) => {
		containerRef.current?.parentElement?.parentElement?.style.setProperty("--current-line-width", `${width}px`);
	}, []);

	return (
		<>
			<div
				className={`rnp-lyrics ${isPureMusic ? 'pure-music' : ''} ${firstLineBold ? 'first-line-bold' : ''}`}
				ref={containerRef}
				style={{
					fontSize: `${fontSize}px`,
				}}>
				{lyrics && lyrics.map((line, index) => {
					return <Line
						key={`${songId} ${index}`}
						id={index}
						line={line}
						currentLine={currentLine}
						seekCounter={seekCounter}
						playState={playState}
						showTranslation={showTranslation}
						showRomaji={showRomaji}
						useKaraokeLyrics={useKaraokeLyrics}
						registerEl={setLineEl}
						getCurrentTime={getCurrentTime}
						fontSize={fontSize}
						containerWidth={containerWidth}
						adaptiveWidth={adaptiveWidth}
						setCurrentLineWidth={setCurrentLineWidth}
					/>
				})}
			</div>
		</>
	);
}
// React.memo + 活动窗口比较：行切换时仅重渲染当前行 ±3 行（约 5 行），
// 其余上百行直接跳过（此前每次行切换会对全部行的上千个逐字 span 做一次协调）。
// 位移/可见性由 rAF 补间在 DOM 层维护，窗口外行无需参与渲染。
const Line = React.memo(function Line(props) {
	if (props.line.originalLyric == '') {
		props.line.isInterlude = true;
	}
	const offset = props.id - props.currentLine;

	const lineRef = useRef(null);

	// 用 useLayoutEffect：子级注册必须先于父级 Lyrics 的 useLayoutEffect(applyLineTops)
	useLayoutEffect(() => {
		props.registerEl(props.id, lineRef.current);
		return () => props.registerEl(props.id, null);
	});

	useEffect(() => {
		if (!props.adaptiveWidth) {
			return;
		}
		if (offset == 0) {
			let maxWidth = 0;
			for (let i = 0; i < lineRef.current.children.length; i++) {
				const child = lineRef.current.children[i];
				maxWidth = Math.max(maxWidth, child.offsetWidth);
			}
			props.setCurrentLineWidth(maxWidth);
		}
	}, [props.currentLine, props.adaptiveWidth, props.useKaraokeLyrics, props.showRomaji, props.showTranslation, props.fontSize]);

	return (
		<div
			ref={lineRef}
			className={`rnp-lyrics-line ${props.line.isInterlude ? 'rnp-interlude' : ''}`}
			offset={offset}
			style={{
				// 可见性安全网：React 侧按 currentLine 兜底（重挂载/竞态时保证正确）；
				// 位移由 applyLineTops 单次写入、合成器插值
				visibility: offset > 3 || offset < -3 ? 'hidden' : 'visible',
			}}>
			{ props.line.dynamicLyric && props.useKaraokeLyrics &&
				<SingleLineScroller {...props} active='karaoke'/>
			}
			{ !(props.line.dynamicLyric && props.useKaraokeLyrics) && props.line.originalLyric &&
				<SingleLineScroller {...props} active='original'/>
			}
			{ props.line.romanLyric && props.showRomaji &&
				<SingleLineScroller {...props} active='romaji'/>
			}
			{ props.line.translatedLyric && props.showTranslation &&
				<SingleLineScroller {...props} active='translated'/>
			}
			{ props.line.isInterlude && <Interlude
				id={props.id}
				line={props.line}
				currentLine={props.currentLine}
				getCurrentTime={props.getCurrentTime}
				seekCounter={props.seekCounter}
				playState={props.playState}
			/> }
		</div>
	)
}, (p, q) => {
	if (p.line !== q.line || p.id !== q.id) return false;
	for (const k of ['seekCounter', 'playState', 'showTranslation', 'showRomaji', 'useKaraokeLyrics', 'fontSize', 'containerWidth', 'adaptiveWidth', 'registerEl', 'setCurrentLineWidth', 'getCurrentTime']) {
		if (p[k] !== q[k]) return false;
	}
	// 当前行 ±3 行以内始终重渲染；窗口外的行跳过
	const wasNear = Math.abs(p.id - p.currentLine) <= 3;
	const isNear = Math.abs(q.id - q.currentLine) <= 3;
	return !(wasNear || isNear);
});
function easeInOutSine(x) {
	return -(Math.cos(Math.PI * x) - 1) / 2;
}
function SingleLineScroller(props) {
	const wrapper = useRef(null);

	const containerWidth = props.containerWidth;
	const innerWidth = useRef(0);
	const scrollWidth = useRef(0);
	const scrollDuration = useRef(0);
	const scrollDelay = useRef(0);

	const animationFrame = useRef(null);
	const playedTime = useRef(0);

	const getCurrentOffset = () => {
		if (playedTime.current < scrollDelay.current) {
			return 0;
		}
		if (playedTime.current > scrollDelay.current + scrollDuration.current) {
			return scrollWidth.current;
		}
		const percentage = easeInOutSine((playedTime.current - scrollDelay.current) / scrollDuration.current);
		return scrollWidth.current * percentage;
	}
	const setCurrentOffset = () => {
		if (!wrapper.current) return false;
		if (props.currentLine == props.id) {
			wrapper.current.style.transform = `translateX(-${getCurrentOffset()}px)`;
		}
		return true;
	}
	const lastTimestamp = useRef(null);
	const animationHandler = (timeStamp) => {
		if (lastTimestamp.current == null) lastTimestamp.current = timeStamp;
		playedTime.current += timeStamp - lastTimestamp.current;
		lastTimestamp.current = timeStamp;
		if (setCurrentOffset() && animationFrame.current){
			animationFrame.current = requestAnimationFrame(animationHandler);
		}
	}

	useEffect(() => {
		if (props.adaptiveWidth) {
			return;
		}
		if (Math.abs(props.currentLine - props.id) >= 2) {
			if (animationFrame.current) {
				cancelAnimationFrame(animationFrame.current);
				animationFrame.current = null;
			}
			return;
		}
		if (props.playState == false) {
			if (animationFrame.current) {
				cancelAnimationFrame(animationFrame.current);
				animationFrame.current = null;
			}
			playedTime.current = props.getCurrentTime() - props.line.time;
			setCurrentOffset();
			return;
		}
		playedTime.current = Math.max(props.getCurrentTime() - props.line.time, 0);

		innerWidth.current = wrapper.current?.offsetWidth || innerWidth.current;
		scrollWidth.current = innerWidth.current - containerWidth;
		scrollDuration.current = props.line.duration * (scrollWidth.current / innerWidth.current) ?? 0;
		scrollDelay.current = props.line.duration * (innerWidth.current - scrollWidth.current) / 2 / innerWidth.current ?? 0;

		setCurrentOffset();
		animationFrame.current = requestAnimationFrame(animationHandler);
	}, [props.currentLine, props.playState, props.seekCounter, props.line]);

	useEffect(() => {
		if (props.adaptiveWidth) {
			if (animationFrame.current) {
				cancelAnimationFrame(animationFrame.current);
				animationFrame.current = null;
			}
		}
	}, [props.adaptiveWidth, props.lyrics]);

	return (
		<div className={`rnp-lyrics-single-line-wrapper`} ref={wrapper}>
			<SingleLine {...props}/>
		</div>
	)
}

function SingleLine(props) {
	// 逐字歌词动画：与 RefinedNowPlayingNext 完全一致的时序数学
	// （当前行按 word.time/word.duration 线性过渡 + 上浮；非当前行 200ms 归位）
	const getKaraokeAnimation = (word) => {
		const currentTime = props.getCurrentTime();
		if (props.currentLine != props.id){
			return {
				transitionDuration: `200ms`,
				transitionDelay: `0ms`,
			};
		}
		if (props.playState == false && word.time + word.duration - currentTime > 0) {
			return {
				transitionDuration: `0s`,
				transitionDelay: `0ms`,
				opacity: Math.max(0.4 + 0.6 * (currentTime - word.time) / word.duration, 0.4),
				transform: `translateY(-${Math.max((currentTime - word.time) / word.duration * 2, 0)}px)`
			};
		}
		return {
			transitionDuration: `${word.duration}ms, ${word.duration + 150}ms`,
			transitionDelay: `${word.time - currentTime}ms`
		};
	};

	const karaokeLineRef = useRef(null);
	useEffect(() => {
		if (props.currentLine != props.id) return;
		if (!karaokeLineRef.current) return;
		karaokeLineRef.current.classList.add('force-refresh');
		setTimeout(() => {
			if (!karaokeLineRef.current) return;
			karaokeLineRef.current.classList.remove('force-refresh');
		}, 6);
	}, [props.useKaraokeLyrics, props.seekCounter]);

	const CJKRegex = /([\p{Unified_Ideograph}|\u3040-\u309F|\u30A0-\u30FF])/gu;

	return (
		<>
			{ props.active == 'karaoke' && <div className="rnp-lyrics-line-karaoke" ref={karaokeLineRef}>
				{props.line.dynamicLyric.map((word, index) => {
					return <span
						key={`${index}`}
						className={`rnp-karaoke-word lyricbar-karaoke-word ${CJKRegex.test(word.word) ? 'is-cjk' : ''} ${word.word.endsWith(' ') ? 'end-with-space' : ''}`}
						style={getKaraokeAnimation(word)}>
							<span>{word.word}</span>
					</span>
				})}
			</div> }
			{ props.active == 'original' && <div className="rnp-lyrics-line-original">
				{ props.line.originalLyric }
			</div> }
			{ props.active == 'romaji' && <div className="rnp-lyrics-line-romaji">
				{ props.line.romanLyric }
			</div> }
			{ props.active == 'translated' && <div className="rnp-lyrics-line-translated">
				{ props.line.translatedLyric }
			</div> }
		</>
	)
}

function Interlude(props) {
	const dotContainerRef = useRef(null);
	const currentTime = props.getCurrentTime();

	const dotCount = 3;
	const perDotTime = parseInt(props.line.duration / dotCount);
	const dots = [];
	for (let i = 0; i < dotCount; i++) {
		dots.push({
			time: props.line.time + perDotTime * i,
			duration: perDotTime,
		});
	}
	const dotAnimation = (dot) => {
		if (dotContainerRef.current) dotContainerRef.current.classList.add('pause-breath');
		if (props.currentLine != props.id){
			return {
				transitionDuration: `200ms`,
				transitionDelay: `0ms`,
			};
		}
		if (props.playState == false && dot.time + dot.duration - currentTime > 0) {
			return {
				transitionDuration: `0s`,
				transitionDelay: `0ms`,
				opacity: Math.max(0.2 + 0.7 * (currentTime - dot.time) / dot.duration, 0.2),
				transform: `scale(${Math.max(0.9 + 0.1 * (currentTime - dot.time) / dot.duration * 2, 0.8)})`
			};
		}
		if (dotContainerRef.current) dotContainerRef.current.classList.remove('pause-breath');
		return {
			transitionDuration: `${dot.duration}ms, ${dot.duration + 150}ms`,
			transitionDelay: `${dot.time - currentTime}ms`
		};
	};

	useEffect(() => {
		if (props.currentLine != props.id) return;
		if (!dotContainerRef.current) return;
		dotContainerRef.current.classList.add('force-refresh');
		setTimeout(() => {
			dotContainerRef.current?.classList?.remove('force-refresh');
		}, 6);
	}, [props.seekCounter]);

	return (
		<div className="rnp-interlude-inner" ref={dotContainerRef}>
			{dots.map((dot, index) => {
				return <div
					key={index}
					className="rnp-interlude-dot"
					style={dotAnimation(dot)}
				/>
			})}
		</div>
	)
}
