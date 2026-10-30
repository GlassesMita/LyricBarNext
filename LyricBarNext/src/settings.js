// LyricBarNext —— 网易云音乐 3.x 软件内词栏插件
// Copyright (C) 2026 Plana
//
// 本程序为自由软件：你可以在 GPL-3.0（或更高版本，由你选择）许可下
// 重新分发和/或修改它。完整许可文本见仓库根目录 LICENSE。
// 部分代码改编自 MIT 许可的第三方项目（详见 README「来源与鸣谢」），
// 其版权归原作者所有，此处随本程序以 GPL-3.0 重新分发。
// LyricBarNext 统一设置面板：合并 LyricBar 0.3.6 与 LyricBarBlur 1.0.3 的全部配置项
import * as React from 'react';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import RadioGroup from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { getConfig, setConfig, resetConfig } from './config.js';

const useState = React.useState;
const useEffect = React.useEffect;

// 读取网易云本体 UI 的计算字体，使配置界面与本体观感一致
const appFontFamily = () => {
	try {
		for (const el of [document.body, document.getElementById('root')]) {
			const ff = el && getComputedStyle(el).fontFamily;
			if (ff && ff.trim() && ff !== 'Roboto') return ff;
		}
	} catch (e) { /* ignore */ }
	return undefined;
};

function Section({ title, children }) {
	return (
		<div>
			<Typography variant='subtitle1' style={{ fontWeight: 'bold', marginTop: 8 }}>{title}</Typography>
			<Divider style={{ marginBottom: 10 }} />
			{children}
		</div>
	);
}

function SwitchItem({ label, value, onChange }) {
	return (
		<FormControlLabel control={
			<Switch checked={!!value} onChange={(e) => onChange(e.target.checked)} />
		} label={label} />
	);
}

function RadioItem({ label, value, options, onChange }) {
	return (
		<FormControl style={{ width: 'fit-content', minWidth: 160 }}>
			<FormLabel>{label}</FormLabel>
			<RadioGroup row value={value} onChange={(e) => onChange(e.target.value)}>
				{options.map(([v, text]) => (
					<FormControlLabel key={v} value={v} control={<Radio />} label={text} />
				))}
			</RadioGroup>
		</FormControl>
	);
}

function SliderItem({ label, value, min, max, step = 1, marks, onChange }) {
	return (
		<div style={{ paddingRight: 20 }}>
			<Typography gutterBottom>{label}</Typography>
			<Slider value={Number(value) || 0} min={min} max={max} step={step} marks={marks}
				valueLabelDisplay='auto'
				onChange={(e, v) => onChange(v)} />
		</div>
	);
}

function RgbFields({ c, prefix, onChange }) {
	return (
		<Stack direction='row' spacing={1} style={{ marginTop: 4 }}>
			{['Red', 'Green', 'Blue'].map((k, i) => (
				<TextField key={k} label={['R', 'G', 'B'][i]} size='small' type='number' style={{ width: 90 }}
					inputProps={{ min: 0, max: 255 }}
					value={c[`${prefix}${k}`]}
					onChange={(e) => {
						const v = Math.min(255, Math.max(0, parseInt(e.target.value) || 0));
						onChange({ [`${prefix}${k}`]: v });
					}} />
			))}
		</Stack>
	);
}

export function Settings(props) {
	const [themeMode, setThemeMode] = useState(document.body.classList.contains('lbn-light') || document.body.classList.contains('ncm-light-theme') ? 'light' : 'dark');
	const [c, setC] = useState(getConfig());
	const [appFont] = useState(appFontFamily);

	const theme = React.useMemo(() => createTheme({
		palette: { mode: themeMode },
		typography: appFont ? { fontFamily: appFont } : undefined,
	}), [themeMode, appFont]);

	useEffect(() => {
		const mo = new MutationObserver(() => {
			setThemeMode(document.body.classList.contains('lbn-light') ? 'light' : 'dark');
		});
		mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
		return () => mo.disconnect();
	}, []);

	const set = (patch) => setC(setConfig(patch));

	return (
		<ThemeProvider theme={theme}>
			<div className='lyric-bar-settings' style={{ padding: '15px', maxWidth: 560 }}>
				<Stack direction='column' spacing={2}>

					<Section title='主题'>
						<RadioItem label='亮暗模式' value={c.themeMode}
							options={[['auto', '自动跟随'], ['light', '浅色'], ['dark', '深色']]}
							onChange={(v) => set({ themeMode: v })} />
						<Typography variant='caption' color='textSecondary'>
							自动跟随：RNPNext 主题状态 → 系统主题；背景/文字的“跟随主题”颜色随封面主色自动变化。
						</Typography>
					</Section>

					<Section title='位置与尺寸'>
						<Stack direction='row' spacing={2}>
							<RadioItem label='水平位置' value={c.posX}
								options={[['left', '居左'], ['right', '居右']]}
								onChange={(v) => set({ posX: v })} />
							<RadioItem label='垂直位置' value={c.posY}
								options={[['top', '居上'], ['bottom', '居下']]}
								onChange={(v) => set({ posY: v })} />
						</Stack>
						<FormGroup>
							<SwitchItem label='底部居中' value={c.centerOfBottom} onChange={(v) => set({ centerOfBottom: v })} />
							<SwitchItem label='左右贴边（忽略自定义宽度）' value={c.weltLeftRight} onChange={(v) => set({ weltLeftRight: v })} />
							<SwitchItem label='自适应宽度' value={c.adaptiveWidth} onChange={(v) => set({ adaptiveWidth: v })} />
							<SwitchItem label='多行歌词（高度 x3）' value={c.multiline3} onChange={(v) => set({ multiline3: v })} />
							<SwitchItem label='鼠标穿透' value={c.mouseThrough} onChange={(v) => set({ mouseThrough: v })} />
							<SwitchItem label='无歌词/纯音乐时隐藏' value={c.hideWithoutLyrics} onChange={(v) => set({ hideWithoutLyrics: v })} />
							<SwitchItem label='禁用左右渐隐' value={c.noFadeLyrics} onChange={(v) => set({ noFadeLyrics: v })} />
						</FormGroup>
						{!c.adaptiveWidth && (
							<SliderItem label='固定宽度 (px)' value={c.widthCustom} min={200} max={1200} step={10}
								onChange={(v) => set({ widthCustom: v })} />
						)}
						<SliderItem label='尺寸变化时长 (ms，0 为瞬时)' value={c.sizeAnimDuration ?? 500} min={0} max={1000} step={50}
							marks={[{ value: 0 }, { value: 500 }]}
							onChange={(v) => set({ sizeAnimDuration: v })} />
						<SliderItem label='整体不透明度 (%)' value={c.opacity} min={5} max={100}
							onChange={(v) => set({ opacity: v })} />
					</Section>

					<Section title='背景'>
						<Stack direction='row' spacing={2}>
							<SliderItem label='背景模糊 (px)' value={c.blur} min={0} max={40}
								onChange={(v) => set({ blur: v })} />
							<SliderItem label='背景不透明度 (%)' value={Math.round(c.bgTrans * 100)} min={0} max={100}
								onChange={(v) => set({ bgTrans: v / 100 })} />
						</Stack>
						<RadioItem label='背景颜色' value={c.bgMode}
							options={[['theme', '跟随主题'], ['custom', '自定义']]}
							onChange={(v) => set({ bgMode: v })} />
						{c.bgMode === 'custom' && <RgbFields c={c} prefix='bg' onChange={set} />}
					</Section>

					<Section title='边框与阴影'>
						<Stack direction='row' spacing={2} flexWrap='wrap'>
							<SliderItem label='边框宽度 (px)' value={c.bdWidth} min={0} max={6}
								onChange={(v) => set({ bdWidth: v })} />
							<SliderItem label='圆角 (px)' value={c.bdRadius} min={0} max={36}
								onChange={(v) => set({ bdRadius: v })} />
							<SliderItem label='内边距 (px)' value={c.padding} min={0} max={40}
								onChange={(v) => set({ padding: v })} />
						</Stack>
						<RadioItem label='边框颜色' value={c.bdMode}
							options={[['theme', '主题色'], ['text', '同文字'], ['custom', '自定义']]}
							onChange={(v) => set({ bdMode: v })} />
						{c.bdMode === 'custom' && (
							<>
								<RgbFields c={c} prefix='bd' onChange={set} />
								<SliderItem label='边框不透明度 (%)' value={Math.round(c.bdTrans * 100)} min={0} max={100}
									onChange={(v) => set({ bdTrans: v / 100 })} />
							</>
						)}
						<SwitchItem label='外阴影' value={c.shadowEnable} onChange={(v) => set({ shadowEnable: v })} />
						{c.shadowEnable && (
							<Stack direction='row' spacing={2} flexWrap='wrap'>
								<SliderItem label='X 偏移' value={c.shadowX} min={-20} max={20} onChange={(v) => set({ shadowX: v })} />
								<SliderItem label='Y 偏移' value={c.shadowY} min={-20} max={20} onChange={(v) => set({ shadowY: v })} />
								<SliderItem label='模糊' value={c.shadowBlur} min={0} max={40} onChange={(v) => set({ shadowBlur: v })} />
								<SliderItem label='扩散' value={c.shadowSpread} min={-20} max={20} onChange={(v) => set({ shadowSpread: v })} />
								<SliderItem label='不透明度 (%)' value={Math.round(c.shadowTrans * 100)} min={0} max={100}
									onChange={(v) => set({ shadowTrans: v / 100 })} />
								<RgbFields c={c} prefix='shadow' onChange={set} />
							</Stack>
						)}
					</Section>

					<Section title='文字'>
						<Stack direction='row' spacing={2}>
							<SliderItem label='字体大小 (px)' value={c.fontSize} min={10} max={50} marks={[{ value: 20 }]}
								onChange={(v) => set({ fontSize: v })} />
							<SliderItem label='文字不透明度 (%)' value={Math.round(c.textTrans * 100)} min={10} max={100}
								onChange={(v) => set({ textTrans: v / 100 })} />
						</Stack>
						<RadioItem label='文字颜色' value={c.textMode}
							options={[['theme', '跟随主题'], ['custom', '自定义']]}
							onChange={(v) => set({ textMode: v })} />
						{c.textMode === 'custom' && <RgbFields c={c} prefix='text' onChange={set} />}
						<SwitchItem label='文字描边' value={c.textOl} onChange={(v) => set({ textOl: v })} />
						{c.textOl && (
							<>
								<RadioItem label='描边方式' value={c.textOlWay}
									options={[['shadow', '阴影'], ['stroke', '描边']]}
									onChange={(v) => set({ textOlWay: v })} />
								<Stack direction='row' spacing={2}>
									<SliderItem label='宽度 (px)' value={c.textOlWidth} min={0.1} max={3} step={0.1}
										onChange={(v) => set({ textOlWidth: v })} />
									<SliderItem label='不透明度 (%)' value={Math.round(c.textOlTrans * 100)} min={0} max={100}
										onChange={(v) => set({ textOlTrans: v / 100 })} />
								</Stack>
								<RgbFields c={c} prefix='textOl' onChange={set} />
							</>
						)}
						<RadioItem label='文本对齐' value={c.textAlign}
							options={[['left', '居左'], ['center', '居中'], ['right', '居右']]}
							onChange={(v) => set({ textAlign: v })} />
					</Section>

					<Section title='歌词'>
						<RadioItem label='歌词来源' value={c.lyricSource ?? 'auto'}
							options={[['auto', '自动'], ['rnp', 'RNPNext'], ['official', '官方解析']]}
							onChange={(v) => set({ lyricSource: v })} />
						<Typography variant='caption' color='textSecondary' style={{ display: 'block', marginTop: -8 }}>
							自动：有 RNPNext 时用其歌词，未交付时回退官方解析；官方解析使用网易云歌词 API + 内置 liblyric 解析器，无需 RNPNext。
						</Typography>
						<FormGroup>
							<SwitchItem label='显示翻译' value={c.showTranslation} onChange={(v) => set({ showTranslation: v })} />
							<SwitchItem label='显示罗马音' value={c.showRomaji} onChange={(v) => set({ showRomaji: v })} />
							<SwitchItem label='逐字歌词（与 RNPNext 相同的动画时序）' value={c.useKaraokeLyrics} onChange={(v) => set({ useKaraokeLyrics: v })} />
							<SwitchItem label='加粗原文' value={c.firstLineBold} onChange={(v) => set({ firstLineBold: v })} />
						</FormGroup>
						<SliderItem label='歌词全局偏移 (ms)' value={c.globalOffset ?? 0} min={-5000} max={5000} step={50}
							onChange={(v) => set({ globalOffset: v })} />
					</Section>

					<Section title='字体'>
						<RadioItem label='字体来源' value={c.fontMode}
							options={[['default', '默认'], ['rnp', '跟随 RNPNext'], ['custom', '自定义']]}
							onChange={(v) => set({ fontMode: v })} />
						{c.fontMode === 'custom' && (
							<TextField label='字体（CSS font-family）' size='small' fullWidth
								value={c.customFonts} onChange={(e) => set({ customFonts: e.target.value })} />
						)}
					</Section>

					<Section title='关于'>
						<Stack direction='row' spacing={2}>
							<Button variant='outlined' size='small'
								onClick={() => betterncm.ncm.openUrl('https://github.com/GlassesMita/LyricBarNext')}>
								源代码仓库
							</Button>
							<Button variant='outlined' size='small'
								onClick={() => betterncm.ncm.openUrl('https://github.com/GlassesMita/LyricBarNext/issues')}>
								问题反馈（GitHub Issues）
							</Button>
						</Stack>
						<Typography variant='caption' color='textSecondary' style={{ display: 'block', marginTop: 4 }}>
							LyricBar 与 LyricBarBlur 的合并重写版（GPL-3.0），鸣谢 solstice23、Lukoning、SUlTlUS。
						</Typography>
					</Section>

					<Stack direction='row' spacing={2} style={{ marginTop: 10 }}>
						<Button variant='outlined' onClick={() => setC(resetConfig())}>恢复默认</Button>
						<Typography variant='caption' color='textSecondary' style={{ alignSelf: 'center' }}>
							首次运行已自动迁移 LyricBar / LyricBarBlur 旧配置，改动即时生效。
						</Typography>
					</Stack>
				</Stack>
			</div>
		</ThemeProvider>
	);
}
