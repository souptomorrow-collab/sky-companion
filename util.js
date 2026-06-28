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

/* 多帳號（本機檔案），且「依 Google 帳號分隔」：
 * - 每個帳號記 owner=擁有它的 Google uid（登出時建立的為 ''＝訪客）。目前登入的 uid 存在 sky__uid（auth.js 設定）。
 * - 看得到/能管理的帳號 = owner 等於目前 uid 的（加上「唯讀分享」帳號永遠可見）。換 Google 只是換過濾條件，資料完全不搬。
 * - 帳號「資料」命名空間 sky_@<pid>_<key>（pid 全域唯一）。清單存在 sky__profiles（全部帳號一起，靠 owner 區分）。
 * - 登入時 adoptGuests() 把「無歸屬」帳號樂觀認養到目前 uid；auth.js 的 fullSync 再依雲端文件的 owner 自我修正。
 * - 首次載入把舊版扁平 sky_<key> 遷移成「帳號 1」。
 */
let _curPrefix = 'sky_'; // 後備（_init 後會換成 sky_@<id>_）
const Profiles = {
  KEY: 'sky__profiles', CUR: 'sky__current',
  _genId() { return 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); },
  UID() { return localStorage.getItem('sky__uid') || ''; },
  _all() { try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } catch (e) { return []; } },
  _saveAll(all) { try { localStorage.setItem(this.KEY, JSON.stringify(all)); } catch (e) {} },
  _visible(p) { return !!p.ro || (p.owner || '') === this.UID(); }, // 目前 uid 看得到的：自己擁有的 + 唯讀分享
  list() { return this._all().filter(p => this._visible(p)); },
  _save(visible) { const others = this._all().filter(p => !this._visible(p)); this._saveAll(others.concat(visible)); },
  currentId() { return localStorage.getItem(this.CUR); },
  current() { const id = this.currentId(); return this.list().find(p => p.id === id) || this.list()[0] || null; },
  prefix() { return _curPrefix; },
  _setPrefix() { _curPrefix = 'sky_@' + (this.currentId() || 'p0') + '_'; },
  add(name) {
    const list = this.list();
    const id = this._genId();
    list.push({ id, name: (name || '').trim() || ('帳號 ' + (list.length + 1)), owner: this.UID() });
    this._save(list);
    return id;
  },
  rename(id, name) { const all = this._all(); const p = all.find(x => x.id === id); if (p && (name || '').trim()) { p.name = name.trim(); this._saveAll(all); } },
  remove(id) {
    const list = this.list();
    if (list.length <= 1) return false; // 至少保留一個帳號
    const pre = 'sky_@' + id + '_';
    Object.keys(localStorage).filter(k => k.indexOf(pre) === 0).forEach(k => localStorage.removeItem(k));
    this._saveAll(this._all().filter(x => x.id !== id));
    if (this.currentId() === id) { const v = this.list(); if (v[0]) { localStorage.setItem(this.CUR, v[0].id); this._setPrefix(); } }
    return true;
  },
  switch(id) { if (this.list().some(p => p.id === id)) { localStorage.setItem(this.CUR, id); this._setPrefix(); } },
  clearCurrent() { const pre = _curPrefix; Object.keys(localStorage).filter(k => k.indexOf(pre) === 0).forEach(k => localStorage.removeItem(k)); },
  // 登入時把「無歸屬（owner 空）且非唯讀」的帳號樂觀認養到目前 uid（fullSync 會依雲端 owner 修正誤認）
  adoptGuests() {
    if (this.UID() === '') return 0;
    const all = this._all(); let n = 0;
    all.forEach(p => { if (!p.ro && (p.owner || '') === '') { p.owner = this.UID(); n++; } });
    if (n) this._saveAll(all);
    return n;
  },
  // 把某帳號的擁有者改成指定 uid（fullSync 依雲端文件 owner 修正用）
  setOwner(id, uid) { const all = this._all(); const p = all.find(x => x.id === id); if (p && (p.owner || '') !== (uid || '')) { p.owner = uid || ''; this._saveAll(all); } },
  // ---- 雲端同步 / 分享用（get/findByCloud 用「全部」，因同步時會碰到非目前 uid 的帳號）----
  get(id) { return this._all().find(p => p.id === id) || null; },
  findByCloud(cloudId) { return cloudId ? this._all().find(p => p.cloudId === cloudId) || null : null; },
  cloudIdOf(id) { const p = this.get(id); return p && p.cloudId || null; },
  isRO(id) { const p = this.get(id); return !!(p && p.ro); },
  _genCloudId() {
    try { const a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a, b => ('0' + b.toString(36)).slice(-2)).join(''); }
    catch (e) { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 14); }
  },
  ensureCloud(id) { const all = this._all(); const p = all.find(x => x.id === id); if (!p) return null; if (!p.cloudId) { p.cloudId = this._genCloudId(); this._saveAll(all); } return p.cloudId; },
  setMeta(id, patch) { const all = this._all(); const p = all.find(x => x.id === id); if (p) { Object.assign(p, patch); this._saveAll(all); } },
  // 新增一個「連到雲端文件」的本機帳號（restore 或 收到分享時用）；同 cloudId 已存在就回傳既有 id
  addRemote(name, cloudId, ro) {
    const all = this._all();
    if (cloudId) { const ex = all.find(p => p.cloudId === cloudId); if (ex) { if (ro && !ex.ro) { ex.ro = true; this._saveAll(all); } return ex.id; } }
    const id = this._genId();
    all.push({ id, name: (name || '').trim() || '帳號', cloudId: cloudId || undefined, ro: !!ro, owner: this.UID() });
    this._saveAll(all);
    return id;
  },
  // 取某帳號的全部 app 資料（去前綴）→ { appkey: 原始字串值 }
  dataOf(id) { const pre = 'sky_@' + id + '_'; const o = {}; Object.keys(localStorage).forEach(k => { if (k.indexOf(pre) === 0) o[k.slice(pre.length)] = localStorage.getItem(k); }); return o; },
  // 以雲端資料覆寫某帳號（先清該帳號既有鍵，再寫入）
  writeDataTo(id, data) { const pre = 'sky_@' + id + '_'; Object.keys(localStorage).filter(k => k.indexOf(pre) === 0).forEach(k => localStorage.removeItem(k)); Object.keys(data || {}).forEach(k => { try { localStorage.setItem(pre + k, String(data[k])); } catch (e) {} }); },
  // 確保「目前 uid」至少有一個可用帳號 + 有效的目前帳號（fullSync 修正完後呼叫）
  ensureCurrent() {
    let list = this.list();
    if (!list.length) { const id = this._genId(); const all = this._all(); all.push({ id, name: '帳號 1', owner: this.UID() }); this._saveAll(all); localStorage.setItem(this.CUR, id); list = this.list(); }
    if (!this.currentId() || !list.some(p => p.id === this.currentId())) localStorage.setItem(this.CUR, list[0].id);
    this._setPrefix();
  },
  _init() {
    this.adoptGuests(); // 已登入則先把無歸屬帳號歸到目前 uid（避免先建空佔位再認養造成重複）
    const list = this.list();
    if (!list.length) {
      const id = this._genId();
      const all = this._all();
      all.push({ id, name: '帳號 1', owner: this.UID() });
      this._saveAll(all);
      localStorage.setItem(this.CUR, id);
      if (this.UID() === '' && all.length === 1) { // 首次（訪客、全空）→ 遷移舊版扁平資料
        Object.keys(localStorage).forEach(k => {
          if (k.indexOf('sky_') !== 0) return;
          const rest = k.slice(4);
          if (rest[0] === '_' || rest[0] === '@') return; // meta 或已命名空間
          try { localStorage.setItem('sky_@' + id + '_' + rest, localStorage.getItem(k)); localStorage.removeItem(k); } catch (e) {}
        });
      }
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
