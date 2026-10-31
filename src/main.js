// LyricBarNext —— 网易云音乐 3.x 软件内词栏插件
// Copyright (C) 2026 Plana
//
// 本程序为自由软件：你可以在 GPL-3.0（或更高版本，由你选择）许可下
// 重新分发和/或修改它。完整许可文本见仓库根目录 LICENSE。
// 部分代码改编自 MIT 许可的第三方项目（详见 README「来源与鸣谢」），
// 其版权归原作者所有，此处随本程序以 GPL-3.0 重新分发。
import './styles.scss';
import './other-themes-compatibility.scss';
import { LyricBar } from './lyric-bar.js';
import { Settings } from './settings.js';
import { initAppearance } from './appearance.js';
import { initLyricSource } from './lyric-source.js';
import { createRoot } from 'react-dom/client';


plugin.onLoad(async (p) => {
	document.body.classList.add('refined-now-playing');

	// 网易云 3.x：等待 React root 上的 Redux store 就绪（与 RefinedNowPlayingNext 相同的时机），
	// 超时后仍挂载，播放状态检测会自行降级
	try {
		await Promise.race([
			betterncm.utils.waitForFunction(() => {
				return document.getElementById('root')?._reactRootContainer?._internalRoot?.current?.child?.child?.memoizedProps?.store;
			}),
			new Promise((resolve) => setTimeout(resolve, 10000)),
		]);
	} catch (e) {
		console.warn('LyricBarNext: NCM store 未就绪，继续挂载歌词栏');
	}

	const div = document.createElement('div');
	div.classList.add('lyric-bar');
	ReactDOM.render(<LyricBar/>, div);
	document.body.appendChild(div);

	// 主题跟随 + 外观（配置 → CSS 变量）+ 歌词来源管理
	initAppearance();
	initLyricSource();
});

plugin.onConfig((tools) => {
	const container = document.createElement('div');
	const divRoot = createRoot(container);
	divRoot.render(<Settings />);
	return container;
});
