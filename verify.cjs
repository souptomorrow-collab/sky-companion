/* verify.cjs — 部署前的資料完整性驗證（離線、不打網路）。用法：node verify.cjs
 * 檢查：JS 語法、CSS 括號、index.html 本機資源存在、?v= 版本號一致、
 *       程式引用的本機圖片存在、光之翼影片段落對應率、中文對照覆蓋率（警告）。
 * 任一硬性檢查失敗 → exit 1（CI 會擋）。
 */
const fs = require('fs');
const { execSync } = require('child_process');
let fails = 0, warns = 0;
const ok = m => console.log('  ✓ ' + m);
const bad = m => { console.log('  ✗ ' + m); fails++; };
const warn = m => { console.log('  ⚠ ' + m); warns++; };

// 1) JS 語法
console.log('[1] JS 語法檢查');
for (const f of ['app.js', 'skyenc.js', 'shards.js', 'util.js', 'auth.js', 'permcandles.js', 'sw.js', 'zh.js', 'skydata.js']) {
  try { execSync('node --check ' + f, { stdio: 'pipe' }); ok(f); }
  catch (e) { bad(f + ' 語法錯誤'); }
}

// 2) CSS 括號平衡
console.log('[2] CSS');
const css = fs.readFileSync('styles.css', 'utf8');
const open = (css.match(/{/g) || []).length, close = (css.match(/}/g) || []).length;
open === close ? ok(`括號平衡 ${open}/${close}`) : bad(`括號不平衡 ${open}/${close}`);

// 3) index.html：本機資源存在 + 版本號一致
console.log('[3] index.html 資源與版本號');
const html = fs.readFileSync('index.html', 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"#]+?)(?:\?v=(\w+))?"/g)]
  .filter(m => !/^https?:|^data:/.test(m[1]));
let missing = 0;
const vers = new Set();
for (const m of refs) {
  if (!fs.existsSync(m[1])) { bad('缺檔案：' + m[1]); missing++; }
  if (m[2]) vers.add(m[2]);
}
if (!missing) ok(`本機資源 ${refs.length} 項皆存在`);
vers.size <= 1 ? ok('?v= 版本號一致：' + [...vers].join('')) : bad('?v= 版本號不一致：' + [...vers].join(', '));

// 4) 程式裡引用的本機圖片存在
console.log('[4] 程式引用的本機圖片');
let imgMiss = 0, imgTotal = 0;
for (const f of ['app.js', 'skyenc.js', 'permcandles.js', 'skydata.js', 'index.html']) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/['"(]((?:img|\.\/img)\/[\w\/.-]+\.(?:webp|png|jpe?g))['")]/g)) {
    imgTotal++;
    const p = m[1].replace(/^\.\//, '');
    if (!fs.existsSync(p)) { bad(f + ' 引用缺圖：' + p); imgMiss++; }
  }
}
if (!imgMiss) ok(`本機圖片引用 ${imgTotal} 處皆存在`);

// 5) 光之翼影片段落對應（載入 skydata + skyenc）
console.log('[5] 光之翼影片段落對應');
try {
  eval(fs.readFileSync('skydata.js', 'utf8').replace('window.SKYDATA', 'globalThis.SKYDATA'));
  global.window = { SKYDATA: globalThis.SKYDATA };
  eval(fs.readFileSync('skyenc.js', 'utf8') + ';globalThis.__v = { WL_SEG_VIDEO };');
  const SEG = globalThis.__v.WL_SEG_VIDEO;
  const wl = globalThis.SKYDATA.wingedLights || [];
  let unmatched = [];
  for (const w of wl) {
    if (!SEG[w.realm]) continue;
    if (!wlSegOf(w.realm, w.descZh || w.desc)) unmatched.push(w.realm + ':' + (w.descZh || w.desc).slice(0, 16));
  }
  // 已知影片未涵蓋：藍鳥劇場、嚕嚕米山谷（允許 ≤2）
  unmatched.length <= 2
    ? ok(`段落對應正常（未對應 ${unmatched.length} 顆，已知例外）`)
    : bad(`未對應 ${unmatched.length} 顆：` + unmatched.join('、'));
} catch (e) { bad('段落對應驗證失敗：' + e.message); }

// 6) 中文對照覆蓋率（警告，不擋）
console.log('[6] 中文對照覆蓋率');
try {
  eval(fs.readFileSync('zh.js', 'utf8').replace('window.SKYZH', 'globalThis.SKYZH'));
  const zh = globalThis.SKYZH || {};
  const sp = (globalThis.SKYDATA.spirits || []);
  const noZh = sp.filter(s => !zh[s.name]).length;
  noZh === 0 ? ok('先祖名稱中文對照 100%') : warn(`${noZh}/${sp.length} 位先祖無中文對照（顯示英文）`);
} catch (e) { warn('中文對照檢查失敗：' + e.message); }

console.log(`\n結果：${fails ? '✗ ' + fails + ' 項失敗' : '✓ 全部通過'}${warns ? '（' + warns + ' 項警告）' : ''}`);
process.exit(fails ? 1 : 0);
