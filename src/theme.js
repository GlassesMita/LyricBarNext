// LyricBarNext —— 网易云音乐 3.x 软件内词栏插件
// Copyright (C) 2026 Plana
//
// 本程序为自由软件：你可以在 GPL-3.0（或更高版本，由你选择）许可下
// 重新分发和/或修改它。完整许可文本见仓库根目录 LICENSE。
// 部分代码改编自 MIT 许可的第三方项目（详见 README「来源与鸣谢」），
// 其版权归原作者所有，此处随本程序以 GPL-3.0 重新分发。
// 主题跟随：检测 RNPNext / 系统 / 旧版主题类的亮暗状态，
// 在 body 上维护 lbn-light / lbn-dark 类；颜色本身通过 CSS 变量链
// （--rnp-accent-color-* ← RNFNext 从封面计算并随主题切换）自动跟随，无需 JS 重算。

import { getConfig, onConfigChange } from './config.js';

const darkMq = window.matchMedia('(prefers-color-scheme: dark)');
let currentLight = null;

function computeIsLight() {
	const cfg = getConfig();
	if (cfg.themeMode === 'light') return true;
	if (cfg.themeMode === 'dark') return false;

	// auto：跟随 RNPNext 的主题状态
	const cl = document.body.classList;
	if (cl.contains('rnp-light')) return true;
	if (cl.contains('rnp-dark')) return false;
	if (cl.contains('ncm-light-theme')) return true; // 旧版主题插件兼容
	if (cl.contains('rnp-auto')) {
		if (cl.contains('rnp-system-light')) return true;
		if (cl.contains('rnp-system-dark')) return false;
		if (window.mdThemeType === 'light') return true;
		if (window.mdThemeType === 'dark') return false;
	}
	return !darkMq.matches; // 兜底：系统主题
}

function apply() {
	const light = computeIsLight();
	if (light === currentLight) return;
	currentLight = light;
	document.body.classList.toggle('lbn-light', light);
	document.body.classList.toggle('lbn-dark', !light);
	document.dispatchEvent(new CustomEvent('lbn-theme-changed', { detail: { light } }));
}

export function initTheme() {
	new MutationObserver(apply).observe(document.body, { attributes: true, attributeFilter: ['class'] });
	darkMq.addEventListener?.('change', apply);
	onConfigChange(() => apply());
	apply();
}

export const isLightTheme = () => currentLight;
