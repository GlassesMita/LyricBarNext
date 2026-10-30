// PluginMarket 补丁 v3：
// 1) 设置面板（含"插件源"选择）默认展开，显示在插件列表上方——与旧版 UI 习惯一致
// 2) 设置齿轮按钮由 16px/50% 透明/绝对定位改为可见的常规按钮（可随时开关面板）
import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const OLD_STATE = 'function K(t){var e=v(React.useState(!1),2)';
const NEW_STATE = 'function K(t){var e=v(React.useState(!0),2)';
const OLD_CSS = '.plugin-market-filters .plugin-market-filter-category button.settings{fill:var(--contrast);width:16px;height:16px;opacity:.5;transform:translate(2px, 1px);position:absolute;right:-12px;top:32px}';
const NEW_CSS = '.plugin-market-filters .plugin-market-filter-category button.settings{fill:var(--contrast);width:20px;height:20px;opacity:.9;position:static;margin-left:10px;cursor:pointer}';

const patchText = (src, label) => {
  for (const [oldS, newS, name] of [[OLD_STATE, NEW_STATE, '默认展开状态'], [OLD_CSS, NEW_CSS, '齿轮样式']]) {
    if (!src.includes(oldS)) { console.error(`FAIL [${label}]: ${name} 锚点未找到`); process.exit(1); }
    src = src.replace(oldS, newS);
    console.log(`ok [${label}]: ${name} 已替换`);
  }
  return src;
};

const patchZip = (zipPath) => {
  const work = mkdtempSync(join(tmpdir(), 'pm-patch3-'));
  execSync(`unzip -o ${JSON.stringify(zipPath)} -d ${JSON.stringify(work)}`);
  const mainPath = join(work, 'main.js');
  const patched = patchText(readFileSync(mainPath, 'utf8'), zipPath);
  writeFileSync(mainPath, patched);
  execSync(`node --check ${JSON.stringify(mainPath)}`);
  const tmpZip = join(work, 'repacked.zip');
  const w = work.replace(/\\/g, '/');
  execSync(`powershell -NoProfile -Command "Compress-Archive -Path ${JSON.stringify(w + '/manifest.json')},${JSON.stringify(w + '/main.js')} -DestinationPath ${JSON.stringify(tmpZip.replace(/\\/g, '/'))} -Force"`);
  const size = readFileSync(tmpZip).length;
  if (size < 10000) { console.error('FAIL: 重打包体积异常'); process.exit(1); }
  copyFileSync(tmpZip, zipPath);
  rmSync(work, { recursive: true, force: true });
  console.log(`ok [${zipPath}]: 重打包完成 (${size} bytes)`);
};

const patchFile = (mainPath) => {
  const patched = patchText(readFileSync(mainPath, 'utf8'), mainPath);
  writeFileSync(mainPath, patched);
  execSync(`node --check ${JSON.stringify(mainPath)}`);
  console.log(`ok [${mainPath}]: node --check 通过`);
};

patchZip('C:/Betterncm/plugins/PluginMarket.plugin');
patchFile('C:/Betterncm/plugins_runtime/PluginMarket/main.js');
console.log('ALL PATCHED v3');
