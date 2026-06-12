/* check-health.cjs — 外部依賴健檢（會打網路）。用法：node check-health.cjs
 * 檢查站外資源是否還活著：
 *   1. 所有內嵌 YouTube 影片（oEmbed 200 = 可嵌入；作者刪片/設私人會變非 200）
 *   2. SkyHelper 每日任務 API
 *   3. 抽樣幾張 wikia 熱鏈圖片
 * 任一失敗 → exit 1。建議每週跑一次（GitHub Actions 已排程）。
 */
const fs = require('fs');
const https = require('https');

function get(url) {
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': 'sky-companion-health/1.0' }, timeout: 15000 }, res => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('timeout', () => { req.destroy(); resolve(0); });
    req.on('error', () => resolve(0));
  });
}

(async () => {
  let fails = 0;
  const ok = m => console.log('  ✓ ' + m);
  const bad = m => { console.log('  ✗ ' + m); fails++; };

  // 1) 影片：從 skyenc.js 收集所有影片 id
  console.log('[1] YouTube 影片可嵌入性');
  eval(fs.readFileSync('skydata.js', 'utf8').replace('window.SKYDATA', 'globalThis.SKYDATA'));
  global.window = { SKYDATA: globalThis.SKYDATA };
  eval(fs.readFileSync('skyenc.js', 'utf8') + ';globalThis.__h = { WL_REALM_VIDEO, WL_SEG_VIDEO, LAYER_VIDEO };');
  const { WL_REALM_VIDEO, WL_SEG_VIDEO, LAYER_VIDEO } = globalThis.__h;
  const vids = new Map(); // id → 說明
  Object.entries(WL_REALM_VIDEO).forEach(([k, id]) => { if (!WL_SEG_VIDEO[k]) vids.set(id, '光之翼整支:' + k); });
  Object.entries(WL_SEG_VIDEO).forEach(([k, v]) => {
    vids.set(v.id, '光之翼分區:' + k);
    v.segs.forEach(s => { if (s[2]) vids.set(s[2], '光之翼分區(換片):' + k + ':' + s[0]); });
  });
  Object.entries(LAYER_VIDEO).forEach(([k, v]) => vids.set(v.id, '圖層教學:' + k));
  for (const [id, label] of vids) {
    const code = await get('https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D' + id + '&format=json');
    code === 200 ? ok(`${id} ${label}`) : bad(`${id} ${label} → HTTP ${code}（可能已被刪除/設私人/禁嵌入）`);
  }

  // 2) SkyHelper API
  console.log('[2] SkyHelper 每日任務 API');
  const api = await get('https://api.skyhelper.xyz/update/quests?_=' + Date.now());
  api === 200 ? ok('api.skyhelper.xyz 正常') : bad('api.skyhelper.xyz → HTTP ' + api);

  // 3) wikia 熱鏈抽樣（取 skydata 裡前 3 張 http 圖）
  console.log('[3] wikia 熱鏈圖片抽樣');
  const sample = [];
  for (const s of (globalThis.SKYDATA.spirits || [])) {
    if (s.img && /^https?:/.test(s.img)) sample.push(s.img);
    if (sample.length >= 3) break;
  }
  for (const u of sample) {
    const code = await get(u);
    code === 200 ? ok(u.slice(0, 70) + '…') : bad(u.slice(0, 70) + '… → HTTP ' + code);
  }

  console.log(`\n結果：${fails ? '✗ ' + fails + ' 項失敗' : '✓ 外部依賴全部正常'}`);
  process.exit(fails ? 1 : 0);
})();
