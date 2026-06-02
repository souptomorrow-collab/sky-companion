/* build-skydata.cjs
 * 把 Silverfeelin/SkyGame-Data 的 everything.json（MIT 授權）處理成精簡的 skydata.js，
 * 供前端以 <script> 載入（window.SKYDATA），file:// 與 GitHub Pages 皆可用。
 * 用法：node build-skydata.cjs   （需先放置 everything.json 於同目錄）
 */
const fs = require('fs');
const path = require('path');

const all = JSON.parse(fs.readFileSync(path.join(__dirname, 'everything.json'), 'utf8'));
const get = k => (all[k] && all[k].items) || [];
// 光之翼描述的繁中翻譯（由 sky-wl-translate workflow 產生，可選）
let WL_DESC_ZH = {};
try { WL_DESC_ZH = JSON.parse(fs.readFileSync(path.join(__dirname, 'wl-desc-zh.json'), 'utf8')); } catch (e) {}
// 光之翼位置照片對應（order → {url,c}），由 sky-wl-photos workflow 產生，可選
let WL_IMG = {};
try { WL_IMG = JSON.parse(fs.readFileSync(path.join(__dirname, 'wl-img.json'), 'utf8')); } catch (e) {}
// 碎石地點區域照片（英文地點名 → 本地路徑），可選
let SHARD_IMG = {};
try { SHARD_IMG = JSON.parse(fs.readFileSync(path.join(__dirname, 'shard-img.json'), 'utf8')); } catch (e) {}
// 碎石地點在世界地圖的座標（英文地點名 → [lat,lng]），可選
let SHARD_POS = {};
try { SHARD_POS = JSON.parse(fs.readFileSync(path.join(__dirname, 'shard-pos.json'), 'utf8')); } catch (e) {}
// 國度實景圖（國度名 → 本地路徑），可選
let REALM_IMG = {};
try { REALM_IMG = JSON.parse(fs.readFileSync(path.join(__dirname, 'realm-img.json'), 'utf8')); } catch (e) {}

const itemsMap = new Map(get('items').map(x => [x.guid, x]));
const nodesMap = new Map(get('nodes').map(x => [x.guid, x]));
const treesMap = new Map(get('spiritTrees').map(x => [x.guid, x]));
const areasMap = new Map(get('areas').map(x => [x.guid, x]));
const eventInst = new Map(get('eventInstances').map(x => [x.guid, x]));
const spiritName = new Map(get('spirits').map(x => [x.guid, x.name]));
const spiritImgG = new Map(get('spirits').map(x => [x.guid, x.imageUrl || '']));

// 先祖 → 季節 shortName
const spiritSeason = new Map();
get('seasons').forEach(s => (s.spirits || []).forEach(g => spiritSeason.set(g, s.shortName || s.name)));

// 常駐先祖 → 國度（由 constellations 的圖檔名判斷）
const REALM_FOLDER_ZH = { isle: '晨島', prairie: '雲野', forest: '雨林', valley: '霞谷', wasteland: '暮土', vault: '禁閣', eden: '伊甸之眼', aviary: '鳥族村' };
const folderOf = url => { const m = /\/(\w+)\.webp/.exec(url || ''); return m ? m[1].toLowerCase() : null; };
const spiritRealm = new Map();
get('constellations').forEach(c => {
  const rk = folderOf(c.imageUrl);
  (c.icons || []).forEach(ic => { if (ic.spirit) spiritRealm.set(ic.spirit, REALM_FOLDER_ZH[rk] || rk); });
});

// 先祖 → 復刻(旅行)日期
const spiritTraveled = new Map();
get('travelingSpirits').forEach(t => {
  if (!t.spirit) return;
  if (!spiritTraveled.has(t.spirit)) spiritTraveled.set(t.spirit, []);
  spiritTraveled.get(t.spirit).push(t.date);
});

// 物品類型中文
const TYPE_ZH = {
  Outfit: '服裝', Shoes: '鞋', Mask: '面具', FaceAccessory: '臉飾', Necklace: '項鍊', Hair: '髮型',
  HairAccessory: '髮飾', Cape: '斗篷', Held: '手持物', Prop: '道具', Emote: '表情', Stance: '站姿',
  Call: '叫聲', Spell: '法術', Music: '樂譜', Quest: '任務', WingBuff: '光翼', Special: '特殊',
  Instrument: '樂器', Necktie: '頸飾', HighFive: '互動',
};
const COST_KEYS = ['c', 'h', 'ac', 'sc', 'sh', 'ec'];

function costOf(node) {
  const o = {};
  for (const k of COST_KEYS) if (node[k]) o[k] = node[k];
  return o;
}

// 走訪先祖樹（root node → n/ne/nw），收集物品與花費（保序、去重）
function walkTree(rootGuid) {
  const out = [];
  const seen = new Set();
  (function visit(g) {
    if (!g || seen.has(g)) return;
    seen.add(g);
    const node = nodesMap.get(g);
    if (!node) return;
    const it = itemsMap.get(node.item);
    if (it && it.name && it.name !== 'Placeholder') {
      out.push({ name: it.name, type: TYPE_ZH[it.type] || it.type || '', cost: costOf(node) });
    }
    visit(node.nw); visit(node.n); visit(node.ne);
  })(rootGuid);
  return out;
}

// ---------- 先祖圖鑑 ----------
const spirits = get('spirits')
  .filter(s => s.name && s.name !== 'Placeholder')
  .map(s => {
    const tree = s.tree ? treesMap.get(s.tree) : null;
    const items = tree && tree.node ? walkTree(tree.node) : [];
    const totals = {};
    items.forEach(t => { for (const k in t.cost) totals[k] = (totals[k] || 0) + t.cost[k]; });
    return {
      name: s.name,
      type: s.type,
      season: spiritSeason.get(s.guid) || null,
      realm: spiritRealm.get(s.guid) || null,
      img: s.imageUrl || null,
      items,
      totals,
      traveled: spiritTraveled.get(s.guid) || [],
      wiki: s._wiki ? s._wiki.href : null,
    };
  });

// ---------- 季節 ----------
const seasons = get('seasons').map(s => ({
  name: s.name, short: s.shortName, year: s.year, start: s.date, end: s.endDate, icon: s.iconUrl || '',
  spirits: (s.spirits || []).map(g => spiritName.get(g)).filter(Boolean),
  wiki: s._wiki ? s._wiki.href : null,
})).sort((a, b) => (a.start || '').localeCompare(b.start || ''));

// ---------- 國度（含光之翼數）----------
const wlByFolder = {};
get('wingedLights').forEach(w => {
  const v = w.mapData && w.mapData.videoUrl;
  const f = v ? v.split('/')[0].toLowerCase() : null;
  if (f) wlByFolder[f] = (wlByFolder[f] || 0) + 1;
});
const realms = get('realms').map(r => {
  const f = folderOf(r.imageUrl) || (r.shortName || '').toLowerCase();
  return {
    name: r.name, short: r.shortName,
    img: REALM_IMG[r.name] || '',
    areas: (r.areas || []).map(g => areasMap.get(g) && areasMap.get(g).name).filter(Boolean),
    wingedLight: wlByFolder[f] || 0,
    wiki: r._wiki ? r._wiki.href : null,
  };
});

// ---------- 光之翼 + 國度輪廓（地圖用）----------
const FOLDER_ZH = { aviary: '鳥族村', prairie: '雲野', forest: '雨林', valley: '霞谷', wasteland: '暮土', vault: '禁閣', isle: '晨島', dawn: '晨島', eden: '伊甸之眼', void: '星海', home: '家' };
const wingedLights = get('wingedLights').map(w => {
  const v = w.mapData && w.mapData.videoUrl;
  const folder = v ? v.split('/')[0].toLowerCase() : null;
  return {
    realm: folder ? (FOLDER_ZH[folder] || folder) : '其他',
    order: w.order, desc: w.description || '',
    descZh: WL_DESC_ZH[w.description] || '',
    wiki: w._wiki ? w._wiki.href : null, // 連到 wiki 該地點（有實際位置照片）
    img: WL_IMG[w.order] ? ('img/wl/' + w.order + '.webp') : '', // 自 host 的位置照片（避免 wikia 防盜連、可離線）
    imgC: (WL_IMG[w.order] && WL_IMG[w.order].c) || '', // 配對信心 high/medium/low
    pos: (w.mapData && w.mapData.position) || null,
  };
}).sort((a, b) => (a.order || 0) - (b.order || 0));
const realmShapes = get('realms').filter(r => r.mapData && r.mapData.boundary).map(r => ({
  name: r.name, short: r.shortName, color: r.mapData.boundaryColor || '#7aa8ff',
  boundary: r.mapData.boundary, pos: r.mapData.position || null,
}));

// ---------- 活動 ----------
const events = get('events').map(e => ({
  name: e.name, short: e.shortName, recurring: !!e.recurring, img: e.imageUrl || '',
  instances: (e.instances || []).map(g => { const i = eventInst.get(g); return i ? { date: i.date, end: i.endDate } : null; }).filter(Boolean),
  wiki: e._wiki ? e._wiki.href : null,
}));

// ---------- 復刻先祖歷史 ----------
const travelingSpirits = get('travelingSpirits')
  .map(t => ({ date: t.date, spirit: spiritName.get(t.spirit) || null, img: spiritImgG.get(t.spirit) || '' }))
  .filter(t => t.spirit)
  .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

// ---------- 人工整理：貨幣 / 碎石獎勵 / 每日攻略（資料集無，採社群/官方整理）----------
const currencies = [
  { name: '蠟燭', en: 'Candle', earn: '收集各國度的「光之碎片(wax)」於先祖星座旁火堆鍛造；完成每日任務、跑酷競速、Harmony Hall 音樂挑戰、黑石碎石等亦可得。每日 00:00 PT 重置。', cap: '約 20 根/天（Daily Light 系統，3 個 chevron 越早收越便宜）', use: '通用貨幣：加好友、向先祖兌換動作/外觀/法術、購買祝福；可 3 蠟燭換 1 愛心。' },
  { name: '愛心', en: 'Heart', earn: '好友透過星座互贈（每位好友每天 1 顆，先累積愛心碎片）；或以 3 蠟燭向先祖購買。', cap: '每位好友每天 1 顆（向先祖購買無上限，受蠟燭量限制）', use: '向先祖兌換較高階外觀與裝飾。' },
  { name: '升華蠟燭', en: 'Ascended Candle', earn: '最稀有常駐貨幣。於伊甸之眼把光之翼獻給沉淪雕像（每尊約 0.25 根，共約 63 尊）；完成紅石碎石亦可得。雕像每週日 00:00 PT 重置。', cap: '週上限約 15.75～16 根（每週日重置）', use: '兌換進階好友動作/外觀、各國度星座「終極禮物」、部分法術。' },
  { name: '季節蠟燭', en: 'Season Candle', earn: '限季節期間。完成每日季節任務(4 根)＋當日領域 4 叢季節蠟燭(額外 1 根)；季卡每日再 +1。', cap: '免費 5 根/天、季卡 6 根/天', use: '向當季季節先祖兌換季節限定外觀/動作。季末未用通常轉為普通愛心。' },
  { name: '季節愛心', en: 'Season Heart', earn: '需當季季卡。每位當季先祖可用 3 季節蠟燭兌換 1 顆。', cap: '受當季先祖數與季節蠟燭量限制', use: '季節先祖的季卡限定升級。' },
  { name: '活動代幣', en: 'Event Currency', earn: '活動期間透過活動任務/活動區域取得。', cap: '依各活動設計', use: '向活動商店兌換活動限定外觀。' },
  { name: '光之翼 / 光翼', en: 'Winged Light', earn: '散布於各國度（約 125 處）。每收集一定數量提升斗篷飛行能量上限。', cap: '依國度分布', use: '提升飛行能量；在伊甸之眼可獻給雕像換升華蠟燭。' },
];

const shards = {
  intro: '碎石風暴(Shard Eruption)每天在預定國度與時間落下，分黑石與紅石。',
  black: { name: '黑石 Black Shard', reward: '一塊蠟燭蛋糕（大量 wax），可鍛造出數根普通蠟燭。', danger: '較安全，碎石不會主動傷害你。' },
  red: { name: '紅石 Red Shard', reward: '升華蠟燭的蠟（較珍貴）。', danger: '較危險：場地天空轉紅、有墜落碎石會把你擊飛並造成「驚嚇」，被擊中會掉落正在收集的光。' },
  tips: ['用「碎石」分頁查今天紅/黑石的國度、地圖與三場時間。', '紅石建議結伴或快速進出，注意閃避墜石。', '時間以遊戲 Sky 時間（太平洋）為準，本工具已換算成你的當地時間。'],
};

const daily = {
  candles: '每日普通蠟燭：用「每日之光」系統，右上角 3 個 chevron 越多鍛造越便宜，務必趁 3 chevron 先清地熱噴泉、奶奶等大型光源。合理一輪約 13 根、全力約 20 根/天。經典路線：雲野 → 雨林聖島地熱噴泉 → 每日任務區 → 雨林 → 奶奶 → 當日加成蠟燭國度 → 霞谷飛行賽。',
  quests: '每日任務：每天 4 個（社交/季節/生態/先祖），在「家」的返回神像或鳥族村拱門咖啡櫃台領取。完成每個給 1 根蠟燭（季節期間改給季節蠟燭），4 個共 4 根。',
  seasonCandles: '季節蠟燭最大化：每天上線把 4 個季節任務 +「當日領域」4 叢季節蠟燭清完（額外 1 根），季卡再 +1。錯過當天份額無法補回，季末季節蠟燭作廢。',
  eden: '伊甸之眼每週日 00:00 PT 重置（按每座雕像計）。一週內可多次進入補滿尚未獻光的雕像，最大化升華蠟燭。',
};

// 每日任務（今天的具體任務無法預測；以下為類型、領取地點與獎勵的通用整理）
const dailyQuests = {
  types: [
    { name: '社交 Social', desc: '和朋友一起做有趣的事' },
    { name: '季節 Seasonal', desc: '呼應當前季節主題的任務' },
    { name: '生態 Ecology', desc: '與世界與生物互動' },
    { name: '先祖 Spirit', desc: '尋找或重訪某位先祖、體驗其回憶' },
  ],
  reward: '每個任務 1 根蠟燭（季節期間改給季節蠟燭），4 個共 4 根。',
  claim: [
    { place: '家 · 返回神像', desc: '在「家」的返回神像（Return Shrine）領取', img: 'img/quest-home.webp' },
    { place: '鳥族村 · 拱門咖啡櫃台', desc: '到鳥族村 Archway Cafe 櫃台找等待的先祖領取', img: 'img/quest-cafe.webp' },
  ],
  note: '今天的 4 個具體任務無法預測（官方每天決定，只有重置後才知道）；任務地點每天輪換，上線後用各國度的「地圖神像」就會以黃色圖示標出當天任務位置。',
};

// ---------- 輸出 ----------
const SKYDATA = {
  meta: {
    source: 'Silverfeelin/SkyGame-Data (MIT License)',
    url: 'https://github.com/Silverfeelin/SkyGame-Data',
    note: '先祖/季節/物品/花費/國度/活動為資料集擷取；貨幣/碎石/每日攻略為社群整理。數值可能隨遊戲更新而變動。',
    counts: { spirits: spirits.length, seasons: seasons.length, realms: realms.length, events: events.length, travelingSpirits: travelingSpirits.length, wingedLights: wingedLights.length },
  },
  seasons, spirits, realms, events, travelingSpirits, currencies, shards, daily, dailyQuests,
  wingedLights, realmShapes, shardImages: SHARD_IMG, shardPos: SHARD_POS,
};

const outPath = path.join(__dirname, 'skydata.js');
fs.writeFileSync(outPath, 'window.SKYDATA = ' + JSON.stringify(SKYDATA) + ';\n', 'utf8');
const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
console.log(`skydata.js 產生完成（${kb} KB）`);
console.log('counts:', JSON.stringify(SKYDATA.meta.counts));
// 抽樣檢查
const sample = spirits.find(s => s.season === 'Gratitude' && s.items.length);
console.log('範例先祖:', sample ? JSON.stringify({ name: sample.name, season: sample.season, items: sample.items.slice(0, 3), totals: sample.totals }) : '(none)');
