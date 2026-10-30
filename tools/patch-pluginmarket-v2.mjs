// PluginMarket 补丁 v2：在 v1（默认源 → Github (UserContent)）基础上，
// 将解析结果中的 raw.githubusercontent.com 替换为 fastly.jsdelivr.net 镜像
// （同一仓库的完整镜像，国内网络稳定；实测 plugins.json 与 .plugin 文件均可 200 下载）。
// 用户在市场设置里手动选择的源仍然优先生效，GitHub 直链选择会被自动镜像化。
import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const OLD_VO = 'const o=()=>{const t=(0,a.PL)("source","Github (UserContent)"),e=(0,i.AZ)();return console.log("Source:",t,e),(e.find((e=>e.name===t))??e.find((e=>"Github (UserContent)"===e.name)))?.baseURL??e[0].baseURL};';
const NEW_VO = 'const o=()=>{const t=(0,a.PL)("source","Github (UserContent)"),e=(0,i.AZ)();console.log("Source:",t,e);const r=((e.find((e=>e.name===t))??e.find((e=>"Github (UserContent)"===e.name)))??e[0]).baseURL;return"https://raw.githubusercontent.com/BetterNCM/BetterNCM-Packed-Plugins/master/"===r?"https://fastly.jsdelivr.net/gh/BetterNCM/BetterNCM-Packed-Plugins@master/":r};';

const patchText = (src, label) => {
  if (!src.includes(OLD_VO)) {
    console.error(`FAIL [${label}]: v1 vo() 锚点未找到`);
    process.exit(1);
  }
  const out = src.replace(OLD_VO, NEW_VO);
  console.log(`ok [${label}]: vo() 已升级为 jsdelivr 镜像版`);
  return out;
};

const patchZip = (zipPath) => {
  const work = mkdtempSync(join(tmpdir(), 'pm-patch2-'));
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
console.log('ALL PATCHED v2');
