/* test-logic.cjs — 核心計算邏輯的回歸測試。用法：node test-logic.cjs
 *
 * 為什麼需要這支：verify.cjs 驗的是「檔案在不在、語法過不過」，驗不到「算得對不對」。
 * 而這個專案最容易默默算錯的就是那些週期計算 —— 輪換公式、錨點、換輪邊界。算錯了
 * 畫面照樣顯示，不會報錯，只是數字是假的。其中彩染店的錨點還是靠兩次實際觀測定出來的，
 * 更需要釘住。
 *
 * 作法：用最小 DOM shim 載入「真正的 app.js」，呼叫產品程式碼本身，不另寫一份邏輯來測。
 * （曾經在測試裡複製過一份任務過濾邏輯，結果產品程式碼改了、測試卻照舊通過 —— 測到的
 * 是副本不是本體。）
 *
 * 任一項失敗 → exit 1。
 */
const fs = require('fs');
const path = require('path');

const P = __dirname;
const LF = String.fromCharCode(10);
const read = f => fs.readFileSync(path.join(P, f), 'utf8');

/* ---------- 最小 DOM shim ---------- */
const boxes = {};
const mkBox = () => ({ innerHTML: '', dataset: {}, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } });
for (const id of ['#ts-list', '#ov-workshop .card-body', '#ov-dye .card-body', '#ov-events .card-body']) boxes[id] = mkBox();
const stub = Object.assign(mkBox(), { classList: { add() {}, remove() {}, contains() { return false; } }, style: {}, hidden: false });
global.document = {
  querySelector: s => boxes[s] || stub,
  querySelectorAll: () => [], getElementById: () => stub,
  addEventListener() {}, createElement: () => stub, documentElement: stub, body: stub,
};
global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
global.navigator = { onLine: true };
global.window = { addEventListener() {}, location: { search: '' }, matchMedia: () => ({ matches: false, addEventListener() {} }) };

eval(read('skydata.js').replace('window.SKYDATA', 'globalThis.__SD'));
eval(read('zh.js').replace('window.SKYZH', 'globalThis.__SZ'));
eval(read('workshop.js').replace('window.WORKSHOP_ROTATION', 'globalThis.__WR').replace('window.WORKSHOP_ANCHOR', 'globalThis.__WA'));
global.window.SKYDATA = globalThis.__SD;
global.window.SKYZH = globalThis.__SZ;
global.window.WORKSHOP_ROTATION = globalThis.__WR;
global.window.WORKSHOP_ANCHOR = globalThis.__WA;

// util/shards/app 必須串成同一次 eval：分開 eval 時 const 宣告的作用域會被關在各自的 eval 內
eval([
  read('util.js'), read('shards.js'), read('app.js'),
  'globalThis.__api = { workshopWeek, nextWorkshopFlip, dyeWeek, renderWorkshop, renderDye,'
  + ' renderTsCalendar, tsArrival, tsCurrentK, dedupeQuests, qZh, isGuideRow, isBrokenRow };',
].join(LF + ';' + LF));
const api = globalThis.__api;

/* ---------- 斷言 ---------- */
let fails = 0, passes = 0;
const ok = m => { passes++; console.log('  ✓ ' + m); };
const bad = m => { fails++; console.log('  ✗ ' + m); };
const eq = (got, want, m) => (String(got) === String(want) ? ok(m) : bad(m + '（得到 ' + got + '，應為 ' + want + '）'));
const at = iso => new Date(iso + 'T19:00:00Z'); // 太平洋中午，避開換日邊界

/* ---------- 1. 築巢工坊 13 週輪換 ---------- */
console.log('[1] 築巢工坊家具輪換');
// 錨點驗證：2026-10-23 的輪次曾與 Wiki 自己標的 (current) 比對一致
eq(api.workshopWeek(at('2026-10-23')).week, 3, '2026-10-23 → 第 3 輪（對照過 Wiki 的 current 標記）');
// 換輪在週五
eq(api.workshopWeek(at('2026-10-22')).week, 2, '10-22（週四）仍是第 2 輪');
eq(api.workshopWeek(at('2026-10-23')).week, 3, '10-23（週五）換成第 3 輪');
eq(api.workshopWeek(at('2026-10-29')).week, 3, '10-29（週四）仍是第 3 輪');
eq(api.workshopWeek(at('2026-10-30')).week, 4, '10-30（週五）換成第 4 輪');
// 13 週循環
eq(api.workshopWeek(at('2027-01-22')).week, api.workshopWeek(at('2026-10-23')).week, '相隔 91 天（13 週）同輪');
// 錨點之前不能算爆
const wOld = api.workshopWeek(at('2023-06-15'));
(wOld && wOld.week >= 1 && wOld.week <= 13) ? ok('錨點之前的日期仍落在 1~13 輪') : bad('錨點之前算出 ' + JSON.stringify(wOld));
// 每輪件數不是固定 4（Wiki 內文說 4，實際 2~6）
const counts = (global.window.WORKSHOP_ROTATION || []).map(w => w.length);
eq(counts.length, 13, '資料共 13 輪');
(counts.some(c => c !== 4)) ? ok('每輪件數不固定（' + counts.join(',') + '），渲染實際件數而非寫死 4') : bad('每輪都是 4 件，與觀察不符');
// 下次換輪必為未來的太平洋週五
['2026-10-23', '2026-10-26', '2026-11-01'].forEach(d => {
  const f = api.nextWorkshopFlip(at(d));
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', weekday: 'short', hour: '2-digit', hour12: false }).format(f);
  (s.indexOf('Fri') >= 0 && f.getTime() > at(d).getTime()) ? ok(d + ' 的下次換輪是未來的週五（' + s + '）') : bad(d + ' 下次換輪 = ' + s);
});

/* ---------- 2. 彩染店 3 週輪換 ---------- */
console.log('[2] 彩染店輪換');
// 錨點來自兩次實際觀測（見 app.js 的 DYE_ANCHOR 註解），這兩項是整個功能的地基
const d1 = api.dyeWeek(at('2026-10-23'));
eq(d1.week, 2, '2026-10-23 → 第 2 輪（觀測：黃←4綠、紫←4紅、黑←3黃）');
eq(d1.common.join(','), 'green,red', '  常見色 綠/紅');
eq(d1.rare.join(','), 'yellow,purple', '  稀有色 黃/紫');
const d2 = api.dyeWeek(at('2026-10-16'));
eq(d2.week, 1, '2026-10-16 → 第 1 輪（觀測：紫←4紅、青←4藍、黑←3紫）');
eq(d2.common.join(','), 'red,blue', '  常見色 紅/藍');
eq(d2.rare.join(','), 'purple,cyan', '  稀有色 紫/青');
// 換輪在週日
eq(api.dyeWeek(at('2026-10-17')).week, 1, '10-17（週六）仍是第 1 輪');
eq(api.dyeWeek(at('2026-10-18')).week, 2, '10-18（週日）換成第 2 輪');
eq(api.dyeWeek(at('2026-10-25')).week, 3, '10-25（週日）換成第 3 輪');
eq(api.dyeWeek(at('2026-11-13')).week, api.dyeWeek(at('2026-10-23')).week, '相隔 21 天（3 週）同輪');
const dOld = api.dyeWeek(at('2025-01-05'));
(dOld.week >= 1 && dOld.week <= 3) ? ok('錨點之前的日期仍落在 1~3 輪') : bad('錨點之前算出 ' + JSON.stringify(dOld));

/* ---------- 3. 復刻先祖行事曆 ---------- */
console.log('[3] 復刻先祖行事曆');
const ALL = (global.window.SKYDATA.travelingSpirits || []);
const tsBox = boxes['#ts-list'];
tsBox.dataset = {}; tsBox.innerHTML = '';
const now3 = at('2026-10-23');
api.renderTsCalendar(now3, api.tsArrival(api.tsCurrentK(now3)));
const html3 = tsBox.innerHTML;
const dates = [...html3.matchAll(/<span class="d-date">([0-9-]+)/g)].map(m => m[1]);
(dates.length >= ALL.length) ? ok('全部 ' + ALL.length + ' 場歷史都在（列數 ' + dates.length + '）') : bad('列數 ' + dates.length + ' 少於場次 ' + ALL.length);
eq(new Set(dates).size, dates.length, '無重複日期');
const pending = (html3.match(/待官方公布/g) || []).length;
(pending <= 2) ? ok('待公布列 ' + pending + ' 列（上限 2：這一場與下一場）') : bad('待公布 ' + pending + ' 列，過多');
eq(dates[dates.length - 1], '2020-01-31', '最舊一列是 2020-01-31');
(html3.indexOf('更早的場次') >= 0) ? ok('有「更早的場次」收合區') : bad('缺收合區');
// 兌換內容必須延後載入：176 列 × 約 10 項會一次做出上千個節點
eq((html3.match(/dex-items/g) || []).length, 0, '沒有預先產生兌換項目節點');
eq((html3.match(/ts-cal-body/g) || []).length, (html3.match(/載入中…/g) || []).length, '每個展開區都還是待載入狀態');
// 每秒 tick 不得重建（否則使用者展開的那列會被關掉）
tsBox.innerHTML = '__SENTINEL__';
for (let i = 1; i <= 3; i++) { const t = new Date(now3.getTime() + i * 1000); api.renderTsCalendar(t, api.tsArrival(api.tsCurrentK(t))); }
eq(tsBox.innerHTML, '__SENTINEL__', '同一天連續 tick 不重建（展開狀態不會被關掉）');
const nextDay = at('2026-10-24');
api.renderTsCalendar(nextDay, api.tsArrival(api.tsCurrentK(nextDay)));
(tsBox.innerHTML !== '__SENTINEL__') ? ok('跨日會重建（徽章能更新）') : bad('跨日未重建');

/* ---------- 4. 每日任務過濾與翻譯 ---------- */
console.log('[4] 每日任務過濾與翻譯');
// 「Daily Quest Guide」後面接了內容就是真任務，不能當圖解濾掉（2026-10-23 曾整列消失）
eq(api.isGuideRow({ title: 'Daily Quest Guide' }), true, '純「Daily Quest Guide」判為圖解');
eq(api.isGuideRow({ title: 'Daily Quest Guide - Wave to a Friend' }), false, '帶後綴的不是圖解，是真任務');
eq(api.isBrokenRow({ title: '[Quest Title Error]: Unknown' }), true, '來源錯誤字串判為壞列');
eq(api.isBrokenRow({ title: '' }), true, '空標題判為壞列');
eq(api.isBrokenRow({ title: 'Pick up a Crab' }), false, '正常任務不被誤判');
// 去重：SkyHelper 把每則 Discord 訊息當一筆，同一任務常出現兩次
const dup = api.dedupeQuests([
  { title: 'Fly with many butterflies in Butterfly Fields', images: [] },
  { title: 'Fly with many butterflies in the Butterfly Fields', images: [{ url: 'a.jpg' }] },
  { title: 'Ride a Manta in Daylight Prairie', images: [] },
  { title: 'Ride A Manta Quest in Daylight Prairie', images: [{ url: 'b.jpg' }] },
]);
eq(dup.length, 2, '4 筆重複合併為 2 筆');
eq(dup[0].images.length, 1, '合併後保留帶圖那筆的附件');
(dup[0].title.length <= 'Fly with many butterflies in the Butterfly Fields'.length) ? ok('標題取較短（純文字版才是任務原名）') : bad('標題沒取短的');
// 翻譯：這些句型都是從實際來源資料踩出來的
[
  ['Daily Quest Guide - Wave to a Friend', '向朋友揮手'],
  ['Days of Rainbow 2022 - Admire the Rainbow in the Treasure Reef', '在藏寶礁欣賞彩虹'],
  ['Catch the wandering lights under the sea in Treasure Reef', '在藏寶礁海底捕捉四散的光'],
  ['Pick up a Crab', '抱起一隻暗蟹'],
  ['Meditation Quest Guide Valley of Triumph - Ice Rink (Meditate overlooking the Frozen Lake)', '在俯瞰冰封湖的位置冥想'],
  ['Catch the wandering lights along the Lower Valley Track', '沿著霞谷下層賽道捕捉四散的光'],
  ['Relive Spirit Quest Valley of Triumph - Bowing Medalist', '重溫鞠躬季軍在霞谷的記憶'],
].forEach(([en, want]) => eq(api.qZh(en), want, '「' + en.slice(0, 46) + (en.length > 46 ? '…' : '') + '」'));
// 翻完不該殘留英文（半英半中最常見的回歸）
['Pick up a Crab', 'Catch the wandering lights under the sea in Treasure Reef'].forEach(en => {
  /[A-Za-z]/.test(api.qZh(en)) ? bad('翻譯殘留英文：' + api.qZh(en)) : ok('「' + en.slice(0, 40) + '」翻譯無殘留英文');
});

console.log('');
console.log('結果：' + (fails ? '✗ ' + fails + ' 項失敗（通過 ' + passes + '）' : '✓ 全部通過（' + passes + ' 項）'));
process.exit(fails ? 1 : 0);
