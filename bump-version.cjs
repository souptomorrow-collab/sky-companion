/* bump-version.cjs — 自動更新 index.html 的 ?v= 版本號。用法：node bump-version.cjs
 * 規則：MMDD + 流水字母（同日多次部署 a→b→c…）。改 JS/CSS 後忘了 bump 會讓
 * 使用者卡舊版快取，所以交給腳本，不靠記性。verify.cjs 會檢查全檔版本號一致。
 */
const fs = require('fs');
const p = 'index.html';
let html = fs.readFileSync(p, 'utf8');
const cur = (html.match(/\?v=(\w+)/) || [])[1] || '';
const d = new Date();
const mmdd = String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
let next;
if (cur.startsWith(mmdd) && /^[a-y]$/.test(cur.slice(4))) {
  next = mmdd + String.fromCharCode(cur.charCodeAt(4) + 1); // 同日 → 下一個字母
} else {
  next = mmdd + 'a';
}
html = html.replace(/\?v=\w+/g, '?v=' + next);
fs.writeFileSync(p, html);
console.log(`版本號：${cur || '(無)'} → ${next}`);
