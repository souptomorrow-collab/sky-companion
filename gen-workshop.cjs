/* gen-workshop.cjs — 由 Sky Wiki 的 Nesting Workshop 頁重新產生 workshop.js
 *
 * 用法：node gen-workshop.cjs              自己抓 Wiki
 *       node gen-workshop.cjs 本機.txt     用既有的 wikitext 檔（測試用）
 *
 * 何時要重跑：Wiki 改了輪次表時。check-health.cjs 第 5 項每週會拿 Wiki 標的 (current)
 * 跟我們算的輪次比對，對不上就寄信，那就是該重跑的訊號。
 *
 * 資料來源：Sky: Children of the Light Wiki「Nesting Workshop」(CC BY-SA)
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT = path.join(__dirname, 'workshop.js');
const LF = String.fromCharCode(10);
const API = 'https://sky-children-of-the-light.fandom.com/api.php'
  + '?action=parse&page=Nesting_Workshop&prop=wikitext&format=json&formatversion=2';

// 自行翻譯（該頁無中文版，只有 fr/pt-br/ja/de）。英文原名一併保留，便於對照遊戲內。
const ZH = {
  'Stone Wood-Fired Oven': '石柴燒烤爐', 'Stone Tall Cube': '石高方塊',
  'Arles Bedroom Chair': '亞爾臥室椅', 'Arles Bedroom Table': '亞爾臥室桌',
  'Stone Chair': '石椅', 'Stone Small Table': '石小桌',
  'Decor Pillow One Color': '單色抱枕', 'Stone Tall Shelf': '石高層架',
  'Stone Bench': '石長凳', 'Stone Desk': '石書桌',
  'Decor Pillow Two Colors': '雙色抱枕', 'Stone Console Table': '石邊桌',
  'Decor Folded Cloth': '摺疊布飾', 'Small Stripes Rug': '小條紋地毯',
  'Stone Loveseat': '石雙人沙發', 'Stone Round Dining Table': '石圓餐桌',
  'Stone Plant Stand': '石花架', 'Small Classic Rug': '小經典地毯',
  'Stone Sofa Corner': '石轉角沙發', 'Stone Square Dining Table': '石方餐桌',
  'Stone Wall Sconce': '石壁燈', 'Stone Sofa Side': '石單邊沙發',
  'Stone Long Dining Table': '石長餐桌', 'Stone Small Bathtub': '石小浴缸',
  'Medium Solid Rug': '中素色地毯', 'Stone Kitchen Drawers': '石廚房抽屜櫃',
  'Stone Coffee Table': '石茶几', 'Stone Candle Light': '石燭燈',
  'Medium Stripes Rug': '中條紋地毯', 'Stone Wall Pot Rack': '石壁掛鍋架',
  'Stone Closed Box': '石封閉箱', 'Stone Washstand': '石洗手台',
  'Medium Diamonds Rug': '中菱形地毯', 'Stone Armchair': '石扶手椅',
  'Stone Empty Box': '石空箱', 'Stone Wall Mirror': '石壁鏡',
  'Medium Argyle Rug': '中蘇格蘭格地毯', 'Stone Wall Mug Rack': '石壁掛杯架',
  'Stone Wall Towel Rack': '石壁掛毛巾架', 'Medium Circle Rug': '中圓形地毯',
  'Stone Kitchen Cabinet': '石廚櫃', 'Stone Small Cube': '石小方塊',
  'Stone Candle Holder': '石燭台', 'Large Solid Rug': '大素色地毯',
  'Stone Kitchen Stove': '石爐灶', 'Stone Large Bathtub': '石大浴缸',
  'Large Circle Rug': '大圓形地毯',
};

function fetchWikitext() {
  return new Promise((resolve, reject) => {
    const req = https.get(API, { headers: { 'User-Agent': 'sky-companion-gen/1.0' }, timeout: 20000 }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let b = ''; res.setEncoding('utf8');
      res.on('data', c => { b += c; });
      res.on('end', () => { try { resolve(JSON.parse(b).parse.wikitext); } catch (e) { reject(e); } });
    });
    req.on('timeout', () => { req.destroy(new Error('逾時')); });
    req.on('error', reject);
  });
}

function parse(raw) {
  // 關鍵：先剝 HTML 註解。表格裡有十幾個物品被 <!-- --> 藏起來（已下架或暫停輪換），
  // 不剝會把它們當成現役商品。
  const w = raw.replace(/<!--[\s\S]*?-->/g, '');
  const lines = w.split(LF);
  const start = lines.findIndex(l => l.trim() === '! Week');
  if (start < 0) throw new Error('找不到「! Week」表頭，Wiki 版面可能改了');

  const weeks = [];
  let cur = null;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^\|\}/.test(l)) break;
    const m = l.match(/^\|\s*([0-9]{1,2})\s*\{\{#ifeq/);
    if (m) { cur = { week: Number(m[1]), items: [] }; weeks.push(cur); continue; }
    if (!cur || !/Spirit Item|\{\{Icon\|/.test(l)) continue;
    // link 可能是 "#Name" 也可能是 "Page Name#Name"，不能只抓 "link=#"
    const name = ((l.match(/link=[^#}|]*#([^}|]+)/) || [])[1]
      || (l.match(/label=([^}|]+)/) || [])[1] || '').trim();
    const cost = ((l.match(/\{\{Cost\|\s*([^}]+)\}\}/) || [])[1] || '').trim();
    const copies = Number((l.match(/\(×([0-9]+)\)/) || [])[1] || 1);
    const cm = cost.match(/^([0-9]+)\s*([A-Z]+)$/);
    if (!name || !cm) throw new Error('解析不了這列：' + l.slice(0, 120));
    weeks[weeks.length - 1].items.push({ n: name, zh: ZH[name] || '', c: Number(cm[1]), u: cm[2], x: copies });
  }

  const missing = [];
  weeks.forEach(wk => wk.items.forEach(i => { if (!i.zh) missing.push(i.n); }));
  if (missing.length) throw new Error('缺中文名（請補進本檔的 ZH 表）：' + missing.join('、'));
  if (weeks.length !== 13) throw new Error('輪次數應為 13，實得 ' + weeks.length + ' → Wiki 可能改了輪次表');
  return weeks;
}

function render(weeks) {
  const body = weeks.map(wk =>
    '  [' + wk.items.map(i =>
      '{ n: ' + JSON.stringify(i.n) + ', zh: ' + JSON.stringify(i.zh)
      + ', c: ' + i.c + ', u: ' + JSON.stringify(i.u) + ', x: ' + i.x + ' }'
    ).join(',' + LF + '   ') + '],'
  ).join(LF);

  return `/* workshop.js — 築巢工坊（Nesting Workshop）家具每週輪換
 *
 * 13 週固定循環，每週五 00:00 太平洋時間換一輪，每輪 2~6 件（不是固定 4 件）。
 * 輪次公式與 Wiki 的計算器一致：floor(距 2024-04-12 PST 的天數 / 7) mod 13 + 1
 * 錨點是週五；Wiki 註解說明 2025 年 12 月起每週重置改為週五，故錨點用 04-12 而非開季的 04-15。
 *
 * 資料來源：Sky: Children of the Light Wiki「Nesting Workshop」(CC BY-SA)
 *   https://sky-children-of-the-light.fandom.com/wiki/Nesting_Workshop
 * 本檔由 gen-workshop.cjs 產生，勿手改；要更新請重跑 node gen-workshop.cjs。
 *
 * 中文名為本專案自行翻譯（該頁無中文版），英文原名一併保留以便對照遊戲內。
 * 幣別：C=蠟燭🕯️ H=愛心❤️ AC=升華蠟燭🕊️；x 為可購入份數。
 */
window.WORKSHOP_ROTATION = [
${body}
];
window.WORKSHOP_ANCHOR = '2024-04-12'; // 太平洋日，第 1 輪起算
`;
}

(async () => {
  try {
    const raw = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : await fetchWikitext();
    const weeks = parse(raw);
    fs.writeFileSync(OUT, render(weeks), 'utf8');
    const total = weeks.reduce((a, w) => a + w.items.length, 0);
    const uniq = new Set(weeks.flatMap(w => w.items.map(i => i.n))).size;
    console.log('✓ 已產生 ' + OUT);
    console.log('  ' + weeks.length + ' 輪，共 ' + total + ' 個品項，' + uniq + ' 件不重複家具');
    console.log('  每輪件數：' + weeks.map(w => w.items.length).join(', '));
  } catch (e) {
    console.error('✗ 產生失敗：' + e.message);
    process.exit(1);
  }
})();
