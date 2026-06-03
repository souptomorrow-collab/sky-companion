/* 從 Sky Fandom Wiki 抓每位先祖的「位置教學圖」(NN_RC_..Spirit_-_Name)，輸出 spirit-locimg.json {guid:url}
 * 用法：node fetch-spirit-locimg.cjs
 */
const fs = require('fs');
const all = JSON.parse(fs.readFileSync('everything.json', 'utf8'));
const spirits = (all.spirits.items || []).filter(s => s.name && s.name !== 'Placeholder' && s._wiki && s._wiki.href);
const API = 'https://sky-children-of-the-light.fandom.com/api.php';
// 位置教學圖檔名規律：開頭數字_國度碼_(可選字)_Spirit_-_...   例：01_DP_Spirit_-_Butterfly_Charmer.png
const LOC_RE = /^\d+_[A-Za-z]{2,4}_(?:[A-Za-z]+_)?Spirit_-_/i;

async function jget(params) {
  const url = API + '?' + new URLSearchParams(Object.assign({ format: 'json' }, params));
  const r = await fetch(url, { headers: { 'User-Agent': 'sky-companion personal tool' } });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}
function titleOf(href) { return decodeURIComponent(href.split('/wiki/')[1] || '').replace(/_/g, ' '); }

async function findLocImg(spirit) {
  const title = titleOf(spirit._wiki.href);
  let j;
  try { j = await jget({ action: 'parse', page: title, prop: 'images' }); }
  catch (e) { return null; }
  const imgs = (j.parse && j.parse.images) || [];
  let file = imgs.find(f => LOC_RE.test(f));                       // 首選：@Clement 分步位置圖
  if (!file) file = imgs.find(f => /-Guide-\d+-Ed\./i.test(f));    // 備援1：Ed.7 全方位攻略(含 Location 區)
  if (!file) file = imgs.find(f => /spirit[-_ ]?location|_map\.|location\.png/i.test(f)); // 備援2
  if (!file) return null;
  try {
    const ji = await jget({ action: 'query', titles: 'File:' + file, prop: 'imageinfo', iiprop: 'url' });
    const pages = ji.query.pages;
    for (const k in pages) { const ii = pages[k].imageinfo; if (ii && ii[0]) return ii[0].url; }
  } catch (e) {}
  return null;
}

(async () => {
  const out = {};
  let done = 0, found = 0;
  const CONC = 6;
  const queue = spirits.slice();
  async function worker() {
    while (queue.length) {
      const s = queue.shift();
      const url = await findLocImg(s);
      done++;
      if (url) { out[s.guid] = url; found++; }
      if (done % 20 === 0) console.error(`  進度 ${done}/${spirits.length}，已找到 ${found}`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  fs.writeFileSync('spirit-locimg.json', JSON.stringify(out));
  console.log(`完成：${spirits.length} 位先祖中，找到位置圖 ${found} 位`);
})();
