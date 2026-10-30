// 修补 PluginMarket 0.8.4：将商店默认源从宕机的 bncm-plugin.microblock.cc 改为
// Github (UserContent)（raw.githubusercontent.com，数据最新且 trustable）。
// 同时修改 vo()（实际抓取解析）与设置面板单选框两处的默认值，保持 UI 与行为一致。
// 用户此后在商店设置里手动选源仍会持久化到 localStorage 并优先生效。
import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const OLD_VO = 'const o=()=>{const t=(0,a.PL)("source","Default"),e=(0,i.AZ)();return console.log("Source:",t,e),e.find((e=>e.name===t)).baseURL??e[0].baseURL};';
const NEW_VO = 'const o=()=>{const t=(0,a.PL)("source","Github (UserContent)"),e=(0,i.AZ)();return console.log("Source:",t,e),(e.find((e=>e.name===t))??e.find((e=>"Github (UserContent)"===e.name)))?.baseURL??e[0].baseURL};';
const OLD_UI = '(0,s.PL)("source","Default")';
const NEW_UI = '(0,s.PL)("source","Github (UserContent)")';

const patchText = (src, label) => {
  if (!src.includes(OLD_VO)) {
    console.error(`FAIL [${label}]: vo() 锚点未找到`);
    process.exit(1);
  }
  let out = src.replace(OLD_VO, NEW_VO);
  const uiCount = out.split(OLD_UI).length - 1;
  if (uiCount < 1) {
    console.error(`FAIL [${label}]: UI 默认源锚点未找到`);
    process.exit(1);
  }
  out = out.split(OLD_UI).join(NEW_UI);
  console.log(`ok [${label}]: vo() 已替换, UI 默认源替换 ${uiCount} 处`);
  return out;
};

const patchZip = (zipPath) => {
  const work = mkdtempSync(join(tmpdir(), 'pm-patch-'));
  execSync(`unzip -o ${JSON.stringify(zipPath)} -d ${JSON.stringify(work)}`);
  const mainPath = join(work, 'main.js');
  const patched = patchText(readFileSync(mainPath, 'utf8'), zipPath);
  writeFileSync(mainPath, patched);
  execSync(`node --check ${JSON.stringify(mainPath)}`);
  console.log(`ok [${zipPath}]: node --check 通过`);
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
console.log('ALL PATCHED');
