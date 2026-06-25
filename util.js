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
/* 只顯示當地時:分 */
function fmtLocalTime(date) {
  return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/* 顯示 Sky 時間（太平洋）。用 en-GB：所有環境午夜皆為 00:00（en-US 在舊 ICU 會回 24:00） */
function fmtSkyTime(date) {
  return date.toLocaleString('en-GB', {
    timeZone: SKY_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

const WD_ZH = ['日', '一', '二', '三', '四', '五', '六'];

/* 多帳號（本機檔案）：每個帳號的資料各自命名空間 sky_@<id>_<key>。
 * 全域 meta（不分帳號）：sky__profiles（清單）、sky__current（目前帳號）、sky___synced（雲端同步時戳）。
 * 首次載入會把舊版的 sky_<key>（無帳號）整批遷移成「帳號 1」，既有進度無痛接軌。
 * 登入 Google 時 auth.js 會把所有 sky_ 鍵（含全部帳號）一起雲端備份。
 */
let _curPrefix = 'sky_'; // 後備（_init 後會換成 sky_@<id>_）
const Profiles = {
  KEY: 'sky__profiles', CUR: 'sky__current',
  _genId() { return 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); },
  list() { try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } catch (e) { return []; } },
  _save(list) { try { localStorage.setItem(this.KEY, JSON.stringify(list)); } catch (e) {} },
  currentId() { return localStorage.getItem(this.CUR); },
  current() { const id = this.currentId(); return this.list().find(p => p.id === id) || this.list()[0] || null; },
  prefix() { return _curPrefix; },
  _setPrefix() { _curPrefix = 'sky_@' + (this.currentId() || 'p0') + '_'; },
  add(name) {
    const list = this.list();
    const id = this._genId();
    list.push({ id, name: (name || '').trim() || ('帳號 ' + (list.length + 1)) });
    this._save(list);
    return id;
  },
  rename(id, name) { const list = this.list(); const p = list.find(x => x.id === id); if (p && (name || '').trim()) { p.name = name.trim(); this._save(list); } },
  remove(id) {
    let list = this.list();
    if (list.length <= 1) return false; // 至少保留一個帳號
    const pre = 'sky_@' + id + '_';
    Object.keys(localStorage).filter(k => k.indexOf(pre) === 0).forEach(k => localStorage.removeItem(k));
    list = list.filter(x => x.id !== id);
    this._save(list);
    if (this.currentId() === id) { localStorage.setItem(this.CUR, list[0].id); this._setPrefix(); }
    return true;
  },
  switch(id) { if (this.list().some(p => p.id === id)) { localStorage.setItem(this.CUR, id); this._setPrefix(); } },
  clearCurrent() { const pre = _curPrefix; Object.keys(localStorage).filter(k => k.indexOf(pre) === 0).forEach(k => localStorage.removeItem(k)); },
  _init() {
    let list = this.list();
    if (!list.length) {
      const id = this._genId();
      list = [{ id, name: '帳號 1' }];
      this._save(list);
      localStorage.setItem(this.CUR, id);
      // 遷移舊版（無帳號）資料：sky_<key>（rest 非 _ / @ 開頭）→ sky_@<id>_<key>
      Object.keys(localStorage).forEach(k => {
        if (k.indexOf('sky_') !== 0) return;
        const rest = k.slice(4);
        if (rest[0] === '_' || rest[0] === '@') return; // meta 或已命名空間
        try { localStorage.setItem('sky_@' + id + '_' + rest, localStorage.getItem(k)); localStorage.removeItem(k); } catch (e) {}
      });
    } else if (!this.currentId() || !list.some(p => p.id === this.currentId())) {
      localStorage.setItem(this.CUR, list[0].id);
    }
    this._setPrefix();
  },
};
try { Profiles._init(); } catch (e) {}

/* localStorage 封裝（資料依目前帳號命名空間；切換帳號會重新載入頁面）*/
const Store = {
  get(key, def) {
    try { const v = localStorage.getItem(_curPrefix + key); return v == null ? def : JSON.parse(v); }
    catch (e) { return def; }
  },
  set(key, val) { try { localStorage.setItem(_curPrefix + key, JSON.stringify(val)); if (typeof window !== 'undefined' && window.__onStoreChange) window.__onStoreChange(); } catch (e) {} },
  remove(key) { try { localStorage.removeItem(_curPrefix + key); } catch (e) {} },
  allKeys() { return Object.keys(localStorage).filter(k => k.startsWith('sky_')); }, // 全部帳號(供匯出/匯入整機備份)
};
