// LyricBarNext —— 网易云音乐 3.x 软件内词栏插件
// Copyright (C) 2026 Plana
//
// 本程序为自由软件：你可以在 GPL-3.0（或更高版本，由你选择）许可下
// 重新分发和/或修改它。完整许可文本见仓库根目录 LICENSE。
// 部分代码改编自 MIT 许可的第三方项目（详见 README「来源与鸣谢」），
// 其版权归原作者所有，此处随本程序以 GPL-3.0 重新分发。
import { Lyrics } from './lyrics.js'
import { getConfig, setConfig } from './config.js';

const useState = React.useState;
const useEffect = React.useEffect;
const useRef = React.useRef;

export function LyricBar(props) {
	const innerRef = useRef();

	// 位置/对齐/透明度/穿透/宽度类均由 appearance.js 统一管理，
	// 此组件仅负责歌词渲染与拖拽调宽
	return (
		<>
			<Resizer />
			<div className={`lyric-bar-inner`} ref={innerRef}>
				<Lyrics />
			</div>
		</>
	)
}

function Resizer(props) {
	const ref = useRef();

	const maskFor = (width) => `linear-gradient(90deg,
		rgba(0,0,0,0) 0%,
		rgba(0,0,0,0) ${5 / width * 100}%,
		rgba(0,0,0,1) ${15 / width * 100}%,
		rgba(0,0,0,1) ${100 - 15 / width * 100}%,
		rgba(0,0,0,0) ${100 - 5 / width * 100}%,
		rgba(0,0,0,0) 100%
	)`;

	useEffect(() => {
		const onMouseMove = (e) => {
			let width;
			if (getConfig().posX == 'right') {
				const containerRight = ref.current.parentElement.getBoundingClientRect().right;
				width = Math.max(containerRight - e.clientX, 200);
			} else {
				const containerLeft = ref.current.parentElement.getBoundingClientRect().left;
				width = Math.max(e.clientX - containerLeft, 200);
			}

			ref.current.parentElement.style.setProperty('--lyric-bar-width', `${width}px`);
			ref.current.parentElement.style.setProperty('--mask-image', maskFor(width));
		};
		const onMouseUp = () => {
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onMouseUp);
			document.querySelectorAll('.g-mn').forEach((el) => {
				el.style.pointerEvents = '';
			});
			const w = parseInt(ref.current.parentElement.style.getPropertyValue('--lyric-bar-width')) || 400;
			setConfig({ widthCustom: w });
		};
		const onMouseDown = (e) => {
			e.stopPropagation();
			window.addEventListener('mousemove', onMouseMove);
			window.addEventListener('mouseup', onMouseUp);
			document.querySelectorAll('.g-mn').forEach((el) => {
				el.style.pointerEvents = 'none';
			});
		};
		ref.current.addEventListener('mousedown', onMouseDown);
		return () => {
			ref.current.removeEventListener('mousedown', onMouseDown);
		};
	}, []);

	useEffect(() => {
		const width = getConfig().widthCustom || 400;
		ref.current.parentElement.style.setProperty('--mask-image', maskFor(width));
	}, []);

	return (
		<div
			className='lyric-bar-resizer'
			ref={ref}
			style={{
				[getConfig().posX == 'right' ? 'left' : 'right']: 0,
			}}
		/>
	);
}
