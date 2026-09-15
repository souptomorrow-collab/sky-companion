/* fetch-ts-wiki.cjs — 提早抓「官方已公布、但資料集還沒收錄」的下一位復刻先祖，寫進 ts-extra.json。
 *
 * 為什麼需要：skygame-data 通常在先祖『到達當天』才收錄（例：9/10 那位，資料集 9/10 12:09 UTC
 * 才發布），但官方會提前幾天公告、社群 Wiki 隨即更新。只靠資料集，網頁要等先祖到了才知道是誰。
 * 寫進 ts-extra.json 後由 build-skydata.cjs 併入；資料集之後收錄同一天會自動以官方版（含實際
 * 復刻價）取代，手動這筆就不再生效。
 *
 * 來源：Sky Wiki「Traveling_Spirits」頁頂端的 {{TravelingSpirit}} 模板（MediaWiki API 取原始碼）。
 *
 * ⚠️ 陷阱：該模板用 HTML 註解切換「未公布／已公布」兩種狀態 ——
 *     未公布：{{TravelingSpirit<!----    註解沒關閉，title/season 被藏起來，只剩 date 有效
 *     已公布：{{TravelingSpirit<!---->   註解立刻關閉，title 生效
 *   未公布時 title 欄位殘留的是『上一位』先祖名（2026-09-15 實例：date 已改成 9/24，title 還是
 *   9/10 的 Wise Grandparent）。不先剝除註解就讀 title，會把上一位誤當成下一位寫上網頁。
 *   所以一律先移除所有 <!-- ... --> 再解析：沒有 title 就代表尚未公布。
 *
 * 用法：node fetch-ts-wiki.cjs [--wikitext 檔] [--dataset everything.json] [--extra ts-extra.json]
 *   三個參數都是給測試用的（餵本機檔、不打網路、不動正式檔）。
 * 結束碼：0 = 正常（有寫入或無需寫入）；1 = 取不到／解析失敗／名稱對不上，需要人看。
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const EXTRA = arg('--extra') || path.join(__dirname, 'ts-extra.json');
const DATASET = arg('--dataset') || path.join(__dirname, 'everything.json');
const API = 'https://sky-children-of-the-light.fandom.com/api.php?action=parse&page=Traveling_Spirits&prop=wikitext&format=json&formatversion=2';

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'sky-companion-ts/1.0 (GitHub Actions)' }, timeout: 20000 }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => { body += c; });
      res.on('end', () => resolve(body));
    });
    req.on('timeout', () => req.destroy(new Error('逾時')));
    req.on('error', reject);
  });
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
// 「September 24 to September 27, 2026」→ '2026-09-24'
// 跨年「December 31 to January 3, 2027」→ '2026-12-31'（年份只寫在結尾，開始月比結束月大就往前一年）
function parseStart(s) {
  const m = /^\s*([A-Za-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?\s+to\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s*$/.exec(s || '');
  if (!m) return null;
  const sm = MONTHS.indexOf(m[1].toLowerCase());
  const em = MONTHS.indexOf(m[4].toLowerCase());
  if (sm < 0 || em < 0) return null;
  let y = m[3] ? Number(m[3]) : Number(m[6]);
  if (!m[3] && sm > em) y -= 1;
  return `${y}-${String(sm + 1).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`;
}

function parseSpiritbox(wikitext) {
  const clean = String(wikitext || '').replace(/<!--[\s\S]*?-->/g, '');
  const box = /\{\{\s*TravelingSpirit\b([\s\S]*?)\}\}/.exec(clean);
  if (!box) return { error: '找不到 {{TravelingSpirit}} 模板（Wiki 版面可能改了）' };
  const field = k => {
    const m = new RegExp('\\|\\s*' + k + '\\s*=\\s*([^\\n|]*)').exec(box[1]);
    return m ? m[1].trim() : '';
  };
  const title = field('title');
  const rawDate = field('date');
  if (!rawDate) return { error: '模板沒有 date 欄位' };
  const start = parseStart(rawDate);
  if (!start) return { error: '看不懂 date 格式：' + rawDate };
  return { announced: !!title, title, start, rawDate };
}

(async () => {
  let wikitext;
  try {
    const wf = arg('--wikitext');
    wikitext = wf ? fs.readFileSync(wf, 'utf8') : JSON.parse(await get(API)).parse.wikitext;
  } catch (e) {
    console.error('✗ 取不到 Wiki 原始碼：' + e.message);
    process.exit(1);
  }

  const r = parseSpiritbox(wikitext);
  if (r.error) { console.error('✗ ' + r.error); process.exit(1); }

  // 復刻先祖一律週四到達。不是週四代表 Wiki 正在編輯中或格式變了，寧可不寫也不要寫錯。
  const weekday = new Date(r.start + 'T12:00:00Z').getUTCDay();
  if (weekday !== 4) {
    console.error(`✗ 解析出的到達日 ${r.start} 不是週四（原文：${r.rawDate}），不寫入`);
    process.exit(1);
  }
  if (!r.announced) {
    console.log(`… ${r.start} 的復刻先祖尚未公布（Wiki 為未公布狀態），不動作。`);
    return;
  }

  // 名稱必須與資料集完全一致，前端才帶得出頭像與兌換物；對不上就交給人工，不硬寫
  let ds;
  try { ds = JSON.parse(fs.readFileSync(DATASET, 'utf8')); } catch (e) {
    console.error('✗ 讀不到資料集 ' + DATASET + '：' + e.message);
    process.exit(1);
  }
  const list = k => { const v = ds[k]; return Array.isArray(v) ? v : (v && v.items) || []; };
  const spiritNames = new Set(list('spirits').map(s => s.name));
  if (!spiritNames.has(r.title)) {
    console.error(`✗ Wiki 公布的「${r.title}」在資料集找不到同名先祖（拼法不同？），不寫入，請人工確認`);
    process.exit(1);
  }
  if (list('travelingSpirits').some(t => t.date === r.start)) {
    console.log(`✓ ${r.start} ${r.title}：資料集已收錄，不需手動補。`);
    return;
  }

  let extra = {};
  try { extra = JSON.parse(fs.readFileSync(EXTRA, 'utf8')); } catch (e) { /* 沒有檔案就從空的開始 */ }
  if (extra[r.start] === r.title) {
    console.log(`✓ ${r.start} ${r.title}：ts-extra.json 已有，不需更新。`);
    return;
  }
  extra[r.start] = r.title;
  const sorted = Object.fromEntries(Object.keys(extra).sort().map(k => [k, extra[k]]));
  fs.writeFileSync(EXTRA, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  console.log(`＋ 已寫入 ts-extra.json：${r.start} → ${r.title}`);
})();
