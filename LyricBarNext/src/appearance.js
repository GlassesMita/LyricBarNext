// LyricBarNext —— 网易云音乐 3.x 软件内词栏插件
// Copyright (C) 2026 Plana
//
// 本程序为自由软件：你可以在 GPL-3.0（或更高版本，由你选择）许可下
// 重新分发和/或修改它。完整许可文本见仓库根目录 LICENSE。
// 部分代码改编自 MIT 许可的第三方项目（详见 README「来源与鸣谢」），
// 其版权归原作者所有，此处随本程序以 GPL-3.0 重新分发。
// 外观引擎：将统一配置应用到 .lyric-bar 元素（CSS 变量 + 状态类），
// 替代旧 LyricBarBlur 的整段字符串 CSS 注入。主题模式下颜色引用 RNPNext
// 维护的 --rnp-accent-color-* 变量，封面主色/亮暗切换自动跟随。

import { getConfig, onConfigChange } from './config.js';
import { initTheme } from './theme.js';

const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));

export function applyAppearance() {
	const el = document.querySelector('.lyric-bar');
	if (!el) return;
	const c = getConfig();
	const s = el.style;
	const cl = el.classList;

	// ---- 位置与尺寸 ----
	cl.toggle('posx-left', c.posX === 'left');
	cl.toggle('posx-right', c.posX !== 'left');
	cl.toggle('posy-top', c.posY === 'top');
	cl.toggle('posy-bottom', c.posY !== 'top');
	cl.toggle('text-align-left', c.textAlign === 'left');
	cl.toggle('text-align-center', c.textAlign === 'center');
	cl.toggle('text-align-right', c.textAlign === 'right');
	cl.toggle('mouse-through', !!c.mouseThrough);
	cl.toggle('adaptive-width', !!c.adaptiveWidth);
	cl.toggle('multiline3', !!c.multiline3);
	cl.toggle('no-fade', !!c.noFadeLyrics);
	cl.toggle('center-bottom', !!c.centerOfBottom);
	cl.toggle('welt-lr', !!c.weltLeftRight);
	cl.toggle('hide-without-lyrics', !!c.hideWithoutLyrics);
	cl.toggle('custom-font', c.fontMode !== 'default');
	s.opacity = clamp01(c.opacity / 100);
	if (!c.adaptiveWidth) {
		s.setProperty('--lyric-bar-width', `${Math.max(200, c.widthCustom)}px`);
	}
	// 尺寸变化时长（宽/高过渡；2.x 默认 500ms，0 为瞬时）
	const dur = Math.max(0, Math.min(2000, c.sizeAnimDuration | 0));
	s.setProperty('--lbn-size-dur', `${dur / 1000}s`);

	// ---- 背景 ----
	const bg = c.bgMode === 'custom'
		? `rgba(${c.bgRed | 0}, ${c.bgGreen | 0}, ${c.bgBlue | 0}, ${clamp01(c.bgTrans)})`
		: `rgba(var(--rnp-accent-color-bg-rgb, var(--lbn-fallback-bg-rgb)), ${clamp01(c.bgTrans)})`;
	s.setProperty('--lbn-bg', bg);
	s.setProperty('--lbn-backdrop', c.blur > 0 ? `blur(${c.blur}px)` : 'none');

	// ---- 边框 ----
	let border = 'none';
	if (c.bdWidth > 0) {
		const col = c.bdMode === 'custom'
			? `rgba(${c.bdRed | 0}, ${c.bdGreen | 0}, ${c.bdBlue | 0}, ${clamp01(c.bdTrans)})`
			: c.bdMode === 'text'
				? 'var(--lbn-text-color)'
				: 'var(--rnp-accent-color, var(--lbn-fallback-fg))';
		border = `${c.bdWidth}px solid ${col}`;
	}
	s.setProperty('--lbn-border', border);
	s.setProperty('--lbn-radius', `${c.bdRadius | 0}px`);
	s.setProperty('--lbn-padding', `${c.padding | 0}px`);
	cl.toggle('no-bd-bg-blend', c.bdWidth > 0); // 背景裁切到边框内（沿用 blur 行为）

	// ---- 阴影 ----
	s.setProperty('--lbn-shadow', c.shadowEnable === false
		? 'none'
		: `${c.shadowX}px ${c.shadowY}px ${c.shadowBlur}px ${c.shadowSpread}px rgba(${c.shadowRed | 0}, ${c.shadowGreen | 0}, ${c.shadowBlue | 0}, ${clamp01(c.shadowTrans)})`);

	// ---- 文字 ----
	const textColor = c.textMode === 'custom'
		? `rgb(${c.textRed | 0}, ${c.textGreen | 0}, ${c.textBlue | 0})`
		: 'var(--rnp-accent-color-shade-2, var(--lbn-fallback-fg))';
	s.setProperty('--lbn-text-color', textColor);
	s.setProperty('--lbn-text-opacity', clamp01(c.textTrans));
	cl.toggle('text-ol', !!c.textOl);
	cl.toggle('text-ol-stroke', !!c.textOl && c.textOlWay === 'stroke');
	cl.toggle('text-ol-shadow', !!c.textOl && c.textOlWay !== 'stroke');
	s.setProperty('--lbn-ol-width', `${Number(c.textOlWidth) || 0}px`);
	s.setProperty('--lbn-ol-color', `rgba(${c.textOlRed | 0}, ${c.textOlGreen | 0}, ${c.textOlBlue | 0}, ${clamp01(c.textOlTrans)})`);

	// ---- 字体 ----
	let font = '';
	if (c.fontMode === 'custom') {
		font = c.customFonts || '';
	} else if (c.fontMode === 'rnp') {
		const raw = localStorage.getItem('refined-now-playing-font-family') || '';
		font = raw.replace(/^\[/, '').replace(/\]$/, '').trim();
	}
	document.body.style.setProperty('--lbn-font-family', font);
}

let initialized = false;
export function initAppearance() {
	if (initialized) return;
	initialized = true;
	initTheme();
	onConfigChange(() => applyAppearance());
	document.addEventListener('lbn-theme-changed', () => applyAppearance());
	applyAppearance();
}
