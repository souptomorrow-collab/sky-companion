/* util.js — 時區換算與共用工具
 * Sky 的遊戲時間 = 美國太平洋時區（America/Los_Angeles，含日光節約）。
 * 每日重置、碎石時間、復刻先祖時間都以這個時區為基準，再換算成使用者當地時間。
 */

const SKY_TZ = 'America/Los_Angeles';

/* 取得某時區在指定時刻（UTC Date）的時差（分鐘） */
function tzOffsetMinutes(timeZone, date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const m = {};
  for (const p of dtf.formatToParts(date)) m[p.type] = p.value;
  const hour = m.hour === '24' ? '00' : m.hour;
  const asUTC = Date.UTC(+m.year, +m.month - 1, +m.day, +hour, +m.minute, +m.second);
  return (asUTC - date.getTime()) / 60000;
}

/* 把某個 UTC 時刻換成 Sky 時區的日曆欄位 */
function skyParts(date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: SKY_TZ, hour12: false, weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const m = {};
  for (const p of dtf.formatToParts(date)) m[p.type] = p.value;
  return {
    year: +m.year, month: +m.month, day: +m.day,
    hour: m.hour === '24' ? 0 : +m.hour, minute: +m.minute, second: +m.second,
    weekday: m.weekday,
  };
}

/* 給定 Sky 時區的牆上時間（年月日時分秒），回傳對應的 UTC 時刻 Date */
function skyWallToDate(y, mo, d, h, mi, s) {
  s = s || 0;
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  let off = tzOffsetMinutes(SKY_TZ, new Date(guess));
  let inst = guess - off * 60000;
  const off2 = tzOffsetMinutes(SKY_TZ, new Date(inst));
  if (off2 !== off) inst = guess - off2 * 60000; // DST 邊界修正
  return new Date(inst);
}

/* 某個 Sky 日曆日期（年月日）的星期（0=日 … 6=六） */
function skyWeekday(y, mo, d) {
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

/* 把毫秒差格式化成倒數字串 */
function fmtDuration(ms) {
  if (ms < 0) ms = 0;
  let s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const mi = Math.floor(s / 60); s %= 60;
  const pad = n => String(n).padStart(2, '0');
  return (d > 0 ? d + ' 天 ' : '') + `${pad(h)}:${pad(mi)}:${pad(s)}`;
}

/* 顯示當地時間 */
function fmtLocal(date) {
  return date.toLocaleString('zh-TW', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/* 顯示 Sky 時間（太平洋） */
function fmtSkyTime(date) {
  return date.toLocaleString('en-US', {
    timeZone: SKY_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

const WD_ZH = ['日', '一', '二', '三', '四', '五', '六'];

/* localStorage 封裝 */
const Store = {
  get(key, def) {
    try { const v = localStorage.getItem('sky_' + key); return v == null ? def : JSON.parse(v); }
    catch (e) { return def; }
  },
  set(key, val) { try { localStorage.setItem('sky_' + key, JSON.stringify(val)); } catch (e) {} },
  remove(key) { try { localStorage.removeItem('sky_' + key); } catch (e) {} },
  allKeys() { return Object.keys(localStorage).filter(k => k.startsWith('sky_')); },
};
