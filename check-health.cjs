/* check-health.cjs — 外部依賴健檢（會打網路）。用法：node check-health.cjs
 * 檢查站外資源是否還活著：
 *   1. 所有內嵌 YouTube 影片（oEmbed 200 = 可嵌入；作者刪片/設私人會變非 200）
 *   2. SkyHelper 每日任務 API
 *   3. 抽樣幾張 wikia 熱鏈圖片
 *   4. 先祖中文對照覆蓋率（新季節先祖沒中文名 → 寄信提醒；verify 只當警告不會擋部署）
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

// 取回內容（上面的 get 只回狀態碼）
function getBody(url) {
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': 'sky-companion-health/1.0' }, timeout: 20000 }, res => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      let b = ''; res.setEncoding('utf8');
      res.on('data', c => { b += c; });
      res.on('end', () => resolve(b));
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
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
  // app.js 的每日任務精選影片。QUEST_VIDEO 是純資料字面值，用切片取出即可，
  // 不必 eval 整支 app.js（app.js 有 DOM 相依，在 node 裡跑不起來）。
  const appSrc = fs.readFileSync('app.js', 'utf8');
  const qvS = appSrc.indexOf('const QUEST_VIDEO = {');
  const qvE = qvS < 0 ? -1 : appSrc.indexOf('\n};', qvS);
  if (qvS < 0 || qvE < 0) {
    bad('app.js 找不到 QUEST_VIDEO 字面值（格式被改過？任務影片會漏掉不檢查）');
  } else {
    const QUEST_VIDEO = eval('(' + appSrc.slice(qvS + 'const QUEST_VIDEO = '.length, qvE + 2) + ')');
    Object.entries(QUEST_VIDEO).forEach(([kind, byRealm]) =>
      Object.entries(byRealm).forEach(([realm, v]) =>
        vids.set(v.id, '每日任務:' + realm + kind + '(' + v.segs.length + '段)')));
  }
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

  // 4) 先祖中文對照覆蓋率（不打網路，但放這裡是為了「會寄信」）
  // 排程每天重抓 skygame-data，新季節先祖若沒中文名只會顯示英文。verify.cjs 把它列為
  // 警告不擋部署（否則 refresh-data 會卡住無法自動上線），代價是沒人會發現它在累積。
  // 放進每週健檢當硬性失敗 → 觸發 Actions 寄信，新季節上線後就會收到提醒。
  console.log('[4] 先祖中文對照覆蓋率');
  eval(fs.readFileSync('zh.js', 'utf8').replace('window.SKYZH', 'globalThis.SKYZH'));
  const zh = globalThis.SKYZH || {};
  const spAll = globalThis.SKYDATA.spirits || [];
  const noZh = spAll.filter(s => !zh[s.name]);
  noZh.length === 0
    ? ok('先祖名稱中文對照 100%（' + spAll.length + ' 位）')
    : bad(noZh.length + '/' + spAll.length + ' 位先祖缺中文名 → 請補進 zh.js：' + noZh.map(s => s.name).join('、'));

  // 5) 築巢工坊輪換是否還跟 Wiki 同步
  // workshop.js 是 Wiki 表格的靜態快照。Wiki 歷史上改過輪次（例如 2025-03 把輪次 4 併入 8），
  // 真的再改一次，我們會默默算錯而沒人發現。這裡拿 Wiki 自己標的 (current) 跟我們算的比，
  // 不一致就寄信。
  console.log('[5] 築巢工坊家具輪換與 Wiki 同步');
  const wsSrc = fs.readFileSync('workshop.js', 'utf8');
  const rotM = wsSrc.indexOf('window.WORKSHOP_ROTATION = ');
  const rotE = wsSrc.indexOf('\n];', rotM);
  if (rotM < 0 || rotE < 0) {
    bad('workshop.js 找不到 WORKSHOP_ROTATION（格式被改過？輪換將無法檢查）');
  } else {
    const ROT = eval('(' + wsSrc.slice(rotM + 'window.WORKSHOP_ROTATION = '.length, rotE + 2) + ')');
    const anchor = (wsSrc.match(/WORKSHOP_ANCHOR\s*=\s*'([0-9-]+)'/) || [])[1] || '2024-04-12';
    const pacToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const dnum = s => { const p = s.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]) / 86400000; };
    const mine = ((Math.floor((dnum(pacToday) - dnum(anchor)) / 7) % ROT.length) + ROT.length) % ROT.length + 1;
    const page = await getBody('https://sky-children-of-the-light.fandom.com/api.php?action=parse&page=Nesting_Workshop&prop=text&format=json&formatversion=2');
    let theirs = null;
    if (page) {
      try {
        const html = JSON.parse(page).parse.text;
        const at = html.indexOf('(current)');
        if (at > 0) {
          const before = html.slice(Math.max(0, at - 400), at);
          const txt = before.split('<').map(x => x.slice(x.indexOf('>') + 1)).join(' ');
          const nums = txt.match(/[0-9]+/g);
          if (nums) theirs = Number(nums[nums.length - 1]);
        }
      } catch (e) { /* 解析失敗 → theirs 維持 null */ }
    }
    if (theirs === null) bad('讀不到 Wiki 的 (current) 標記，無法確認輪換是否同步（Wiki 掛了或版面改了）');
    else if (theirs === mine) ok(`第 ${mine}／${ROT.length} 輪，與 Wiki 一致`);
    else bad(`輪換對不上：我們算第 ${mine} 輪，Wiki 標第 ${theirs} 輪 → Wiki 可能改了輪次表，請重跑 gen_workshop.cjs`);
  }

  console.log(`\n結果：${fails ? '✗ ' + fails + ' 項失敗' : '✓ 外部依賴全部正常'}`);
  process.exit(fails ? 1 : 0);
})();
