// LyricBarNext —— 网易云音乐 3.x 软件内词栏插件
// Copyright (C) 2026 Plana
//
// 本程序为自由软件：你可以在 GPL-3.0（或更高版本，由你选择）许可下
// 重新分发和/或修改它。完整许可文本见仓库根目录 LICENSE。
// 部分代码改编自 MIT 许可的第三方项目（详见 README「来源与鸣谢」），
// 其版权归原作者所有，此处随本程序以 GPL-3.0 重新分发。
// 统一配置系统：合并 LyricBar 0.3.6 与 LyricBarBlur 1.0.3 的全部配置项
// 存储于 localStorage 'LyricBarNextSettings'，首次运行自动迁移两个旧插件的配置。

export const defaultConfig = {
	// ---- 主题 ----
	themeMode: 'auto',            // auto: 跟随 RNPNext/系统 | light | dark

	// ---- 位置与尺寸（LyricBar）----
	posX: 'right',                // left | right
	posY: 'bottom',               // top | bottom
	centerOfBottom: false,        // 底部居中（LyricBarBlur）
	weltLeftRight: false,         // 左右贴边（LyricBarBlur）
	adaptiveWidth: true,          // 自适应宽度
	widthCustom: 400,             // 固定宽度（adaptiveWidth 关闭时）
	sizeAnimDuration: 500,        // 尺寸（宽/高）变化时长 ms；0 为瞬时；2.x 版本默认 500ms
	multiline3: false,            // 多行高度 x3（LyricBarBlur）
	mouseThrough: false,
	opacity: 100,                 // 5-100
	hideWithoutLyrics: true,      // 无歌词/纯音乐时隐藏（= !doNotHideWithoutLyrics）
	noFadeLyrics: false,          // 禁用左右渐隐（LyricBarBlur）

	// ---- 背景与外观（LyricBarBlur）----
	blur: 12,                     // 背景模糊 px
	bgTrans: 0.75,                // 背景不透明度 0-1
	bgMode: 'theme',              // theme: 跟随主题/封面主色 | custom
	bgRed: 0, bgGreen: 120, bgBlue: 215,
	padding: 0,
	bdWidth: 1,
	bdRadius: 12,
	bdTrans: 0.1,
	bdMode: 'custom',             // theme | text | custom
	bdRed: 127, bdGreen: 127, bdBlue: 127,
	shadowEnable: true,
	shadowX: 0, shadowY: 1, shadowBlur: 8, shadowSpread: -4,
	shadowTrans: 0.3, shadowRed: 0, shadowGreen: 0, shadowBlue: 0,

	// ---- 文字 ----
	fontSize: 20,
	textTrans: 1,                 // 0-1
	textMode: 'theme',            // theme | custom
	textRed: 127, textGreen: 127, textBlue: 127,
	textOl: false,                // 文字描边/阴影（LyricBarBlur）
	textOlWay: 'shadow',          // shadow | stroke
	textOlWidth: 0.5,
	textOlTrans: 1,
	textOlRed: 0, textOlGreen: 0, textOlBlue: 0,

	// ---- 歌词（LyricBar）----
	globalOffset: 0,              // 歌词全局偏移 ms（与 RNPNext 的 lyric-offset 联动）
	lyricSource: 'auto',          // auto: RNPNext 优先/官方兜底 | rnp: 仅 RNPNext | official: 官方解析（不依赖 RNPNext）
	showTranslation: true,
	showRomaji: false,
	useKaraokeLyrics: true,       // 逐字歌词（行为与 RNPNext 一致）
	firstLineBold: false,
	textAlign: 'left',            // left | center | right

	// ---- 字体（LyricBarBlur）----
	fontMode: 'default',          // default | rnp: 跟随 RNPNext 字体 | custom
	customFonts: '"SDK_SC_Web 85W"',
};

const KEY = 'LyricBarNextSettings';
let cached = null;

const num = (v, fallback) => {
	const n = Number(v);
	return Number.isFinite(n) ? n : fallback;
};

function migrateLegacy(cfg) {
	// LyricBarBlur (LyricBarBlurSettings) → 合并
	try {
		const b = JSON.parse(localStorage.getItem('LyricBarBlurSettings'));
		if (b && typeof b === 'object') {
			cfg.blur = num(b.blur, cfg.blur);
			cfg.bgTrans = num(b.bgTrans, cfg.bgTrans);
			if (b.bgColor === 'custom') { cfg.bgMode = 'custom'; }
			cfg.bgRed = num(b.bgRed, cfg.bgRed);
			cfg.bgGreen = num(b.bgGreen, cfg.bgGreen);
			cfg.bgBlue = num(b.bgBlue, cfg.bgBlue);
			cfg.padding = num(b.padding, cfg.padding);
			cfg.bdWidth = num(b.bdWidth, cfg.bdWidth);
			cfg.bdRadius = num(b.bdRadius, cfg.bdRadius);
			cfg.bdTrans = num(b.bdTrans, cfg.bdTrans);
			if (b.bdColor === 'default') cfg.bdMode = 'theme';
			if (b.bdColor === 'text') cfg.bdMode = 'text';
			cfg.bdRed = num(b.bdRed, cfg.bdRed);
			cfg.bdGreen = num(b.bdGreen, cfg.bdGreen);
			cfg.bdBlue = num(b.bdBlue, cfg.bdBlue);
			cfg.shadowX = num(b.shadowX, cfg.shadowX);
			cfg.shadowY = num(b.shadowY, cfg.shadowY);
			cfg.shadowBlur = num(b.shadowBlur, cfg.shadowBlur);
			cfg.shadowSpread = num(b.shadowSpread, cfg.shadowSpread);
			cfg.shadowTrans = num(b.shadowTrans, cfg.shadowTrans);
			cfg.shadowRed = num(b.shadowRed, cfg.shadowRed);
			cfg.shadowGreen = num(b.shadowGreen, cfg.shadowGreen);
			cfg.shadowBlue = num(b.shadowBlue, cfg.shadowBlue);
			cfg.textTrans = num(b.textTrans, cfg.textTrans);
			if (b.textColor === 'custom') cfg.textMode = 'custom';
			cfg.textRed = num(b.textRed, cfg.textRed);
			cfg.textGreen = num(b.textGreen, cfg.textGreen);
			cfg.textBlue = num(b.textBlue, cfg.textBlue);
			cfg.textOl = !!b.textOl;
			cfg.textOlWay = b.textOlWay === 'stroke' ? 'stroke' : 'shadow';
			cfg.textOlWidth = num(b.textOlWidth, cfg.textOlWidth);
			cfg.textOlTrans = num(b.textOlTrans, cfg.textOlTrans);
			cfg.textOlRed = num(b.textOlRed, cfg.textOlRed);
			cfg.textOlGreen = num(b.textOlGreen, cfg.textOlGreen);
			cfg.textOlBlue = num(b.textOlBlue, cfg.textOlBlue);
			cfg.centerOfBottom = !!b.centerOfBottom;
			cfg.weltLeftRight = !!b.weltLeftRight;
			cfg.multiline3 = !!b.multiline3;
			cfg.noFadeLyrics = !!b.noFadeLyrics;
			if (b.doNotHideWithoutLyrics !== undefined) cfg.hideWithoutLyrics = !b.doNotHideWithoutLyrics;
			if (b.isWidthEnable) { cfg.adaptiveWidth = false; cfg.widthCustom = num(b.widthCustom, cfg.widthCustom); }
			if (b.fonts === 'rnp') cfg.fontMode = 'rnp';
			if (b.fonts === 'custom') { cfg.fontMode = 'custom'; cfg.customFonts = b.customFonts ?? cfg.customFonts; }
			cfg.migrated = true;
		}
	} catch (e) { /* 无旧配置 */ }

	// LyricBar (lyric-bar-* localStorage 键) → 合并
	const lb = (k, d) => {
		let v = localStorage.getItem('lyric-bar-' + k);
		if (v === null || v === '') return d;
		if (v === 'true') return true;
		if (v === 'false') return false;
		const n = Number(v);
		return Number.isFinite(n) && v.trim() !== '' ? n : v;
	};
	cfg.posX = lb('posX', cfg.posX) === 'left' ? 'left' : 'right';
	cfg.posY = lb('posY', cfg.posY) === 'top' ? 'top' : 'bottom';
	cfg.textAlign = ['left', 'center', 'right'].includes(lb('text-align', '')) ? lb('text-align', cfg.textAlign) : cfg.textAlign;
	cfg.opacity = num(lb('opacity', cfg.opacity), cfg.opacity);
	cfg.mouseThrough = !!lb('mouse-through', cfg.mouseThrough);
	cfg.showTranslation = !!lb('show-translation', cfg.showTranslation);
	cfg.showRomaji = !!lb('show-romaji', cfg.showRomaji);
	cfg.useKaraokeLyrics = !!lb('use-karaoke-lyrics', cfg.useKaraokeLyrics);
	cfg.fontSize = num(lb('lyric-font-size', cfg.fontSize), cfg.fontSize);
	cfg.firstLineBold = !!lb('first-line-bold', cfg.firstLineBold);
	if (lb('adaptive-width', true) === false) { cfg.adaptiveWidth = false; }
	const w = lb('lyric-bar-width', '');
	if (w && !cfg.adaptiveWidth) cfg.widthCustom = num(parseInt(w), cfg.widthCustom);
	return cfg;
}

export function getConfig() {
	if (cached) return { ...cached };
	const cfg = { ...defaultConfig };
	migrateLegacy(cfg);
	try {
		const saved = JSON.parse(localStorage.getItem(KEY));
		if (saved && typeof saved === 'object') Object.assign(cfg, saved);
	} catch (e) { /* ignore */ }
	cached = cfg;
	return { ...cached };
}

export function setConfig(patch) {
	cached = { ...getConfig(), ...patch };
	localStorage.setItem(KEY, JSON.stringify(cached));
	document.dispatchEvent(new CustomEvent('lbn-config-updated', { detail: { ...cached } }));
	return { ...cached };
}

export function resetConfig() {
	cached = { ...defaultConfig };
	localStorage.setItem(KEY, JSON.stringify(cached));
	document.dispatchEvent(new CustomEvent('lbn-config-updated', { detail: { ...cached } }));
	return { ...cached };
}

export function onConfigChange(cb) {
	const handler = (e) => cb(e.detail);
	document.addEventListener('lbn-config-updated', handler);
	return () => document.removeEventListener('lbn-config-updated', handler);
}
