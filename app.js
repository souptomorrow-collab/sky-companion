/* app.js — 主程式：分頁、時鐘、倒數、各功能渲染與本機儲存 */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const pad = n => String(n).padStart(2, '0');
const TS_ANCHOR_DEFAULT = '2026-06-04'; // 已知某次復刻先祖到達日（週四）

/* 日曆加減天數（回傳 {y,mo,d}） */
function addDays(y, mo, d, n) {
  const dt = new Date(Date.UTC(y, mo - 1, d) + n * 86400000);
  return { y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
const dateKey = c => `${c.y}-${pad(c.mo)}-${pad(c.d)}`;

/* ---------- 重置時間 ---------- */
function nextDailyReset(now) {
  const p = skyParts(now);
  const t = addDays(p.year, p.month, p.day, 1);
  return skyWallToDate(t.y, t.mo, t.d, 0, 0, 0);
}
function nextWeeklyReset(now) { // 週日 00:00 太平洋
  const p = skyParts(now);
  const wd = skyWeekday(p.year, p.month, p.day);
  const add = wd === 0 ? 7 : (7 - wd);
  const t = addDays(p.year, p.month, p.day, add);
  return skyWallToDate(t.y, t.mo, t.d, 0, 0, 0);
}

/* ---------- 復刻先祖 ---------- */
function tsAnchor() {
  const raw = Store.get('ts_anchor', TS_ANCHOR_DEFAULT);
  const str = (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) ? raw : TS_ANCHOR_DEFAULT;
  const [y, mo, d] = str.split('-').map(Number);
  return { y, mo, d };
}
function tsArrival(k) {
  const a = tsAnchor();
  const cal = addDays(a.y, a.mo, a.d, 14 * k);
  const arrivalInst = skyWallToDate(cal.y, cal.mo, cal.d, 0, 0, 0);
  const dep = addDays(cal.y, cal.mo, cal.d, 4);
  const departInst = skyWallToDate(dep.y, dep.mo, dep.d, 0, 0, 0);
  return { k, cal, arrivalInst, departInst };
}
function tsCurrentK(now) {
  const a = tsAnchor();
  const anchorInst = skyWallToDate(a.y, a.mo, a.d, 0, 0, 0).getTime();
  let k = Math.floor((now.getTime() - anchorInst) / (14 * 86400000));
  for (let i = 0; i < 4; i++) { if (tsArrival(k + 1).arrivalInst.getTime() <= now.getTime()) k++; else break; }
  for (let i = 0; i < 4; i++) { if (tsArrival(k).arrivalInst.getTime() > now.getTime()) k--; else break; }
  return k;
}

/* ---------- 倒數 span ---------- */
function cd(targetMs, opts) {
  opts = opts || {};
  return `<span class="cd" data-target="${targetMs}"${opts.done ? ` data-done="${opts.done}"` : ''}>--:--:--</span>`;
}
function updateCountdowns(now) {
  $$('.cd[data-target]').forEach(el => {
    const diff = +el.dataset.target - now.getTime();
    if (diff <= 0) { el.textContent = el.dataset.done || '進行中'; el.classList.add('done'); }
    else { el.classList.remove('done'); el.textContent = fmtDuration(diff); }
  });
}

/* ---------- 時鐘 ---------- */
function updateClocks(now) {
  $('#clock-sky').textContent = now.toLocaleTimeString('en-GB', { timeZone: SKY_TZ, hour12: false });
  $('#clock-local').textContent = now.toLocaleTimeString('zh-TW', { hour12: false });
  const p = skyParts(now);
  $('#footer-date').textContent = `Sky 時間 ${p.year}/${pad(p.month)}/${pad(p.day)}（週${WD_ZH[skyWeekday(p.year, p.month, p.day)]}）`;
}

/* ---------- 渲染：總覽 ---------- */
function renderOverview(now) {
  // 重置
  const daily = nextDailyReset(now), weekly = nextWeeklyReset(now);
  $('#ov-resets .card-body').innerHTML =
    `<div class="kv"><span class="k">每日重置</span><span class="v big">${cd(daily.getTime())}</span></div>
     <div class="kv"><span class="k">週重置（週日）</span><span class="v">${cd(weekly.getTime())}</span></div>
     <p class="note">重置為每日 00:00 太平洋時間。</p>`;

  // 碎石
  const p = skyParts(now);
  const s = SHARD.forDate(p.year, p.month, p.day);
  $('#ov-shard .card-body').innerHTML = shardSummaryHTML(s, now);

  // 復刻先祖
  $('#ov-ts .card-body').innerHTML = tsSummaryHTML(now);

  // 季節
  $('#ov-season .card-body').innerHTML = seasonSummaryHTML(now);
}

function shardSummaryHTML(s, now) {
  if (!s.hasShard) return `<span class="badge none">今日無碎石</span><p class="note">${s.time} 場次逢週${WD_ZH[s.weekday]}不掉落。</p>`;
  const typeBadge = s.type === 'red' ? `<span class="badge red">紅石</span>` : `<span class="badge black">黑石</span>`;
  const next = s.eruptions.find(e => now.getTime() < e.end.getTime());
  let cdHtml;
  if (!next) cdHtml = `<span class="muted">今日場次已全部結束</span>`;
  else if (now.getTime() < next.start.getTime()) cdHtml = `下次出現 ${cd(next.start.getTime())}`;
  else cdHtml = `進行中，結束於 ${cd(next.end.getTime())}`;
  return `${typeBadge} ${s.realmZh.split(' ')[0]} · ${s.location[1]}
    <div class="kv"><span class="k">地圖</span><span class="v">${s.location[1]} (${s.location[0]})</span></div>
    <div class="kv"><span class="k">狀態</span><span class="v">${cdHtml}</span></div>`;
}

function tsSummaryHTML(now) {
  const cur = tsArrival(tsCurrentK(now));
  const logged = Store.get('ts_log', {})[dateKey(cur.cal)];
  if (now.getTime() < cur.departInst.getTime()) {
    return `<span class="badge live">先祖在場中</span> ${logged ? '· ' + escapeHtml(logged) : ''}
      <div class="kv"><span class="k">離開倒數</span><span class="v big">${cd(cur.departInst.getTime())}</span></div>`;
  }
  const next = tsArrival(cur.k + 1);
  return `<div class="kv"><span class="k">下次到達</span><span class="v">${dateKey(next.cal)}（週${WD_ZH[skyWeekday(next.cal.y, next.cal.mo, next.cal.d)]}）</span></div>
    <div class="kv"><span class="k">倒數</span><span class="v big">${cd(next.arrivalInst.getTime())}</span></div>`;
}

function seasonSummaryHTML(now) {
  const name = Store.get('season_name', '');
  const end = Store.get('season_end', '');
  if (!end) return `<p class="muted">尚未設定季節。</p><p class="note">到「蠟燭預算」分頁填入季節結束日，這裡就會顯示倒數。</p>`;
  const [y, mo, d] = end.split('-').map(Number);
  const endInst = skyWallToDate(y, mo, d, 23, 59, 59);
  const p = skyParts(now);
  const diff = Math.round((Date.UTC(y, mo - 1, d) - Date.UTC(p.year, p.month - 1, p.day)) / 86400000);
  const daysLeft = Math.max(0, diff + 1); // 結束日當天 23:59:59 前仍可賺，故含結束日
  return `<div class="kv"><span class="k">${name ? escapeHtml(name) : '本季'}</span><span class="v">${end} 結束</span></div>
    <div class="kv"><span class="k">剩餘天數</span><span class="v big">${daysLeft} 天</span></div>
    <p class="note">結束倒數：${cd(endInst.getTime(), { done: '已結束' })}</p>`;
}

/* ---------- 渲染：碎石 ---------- */
function renderShards(now) {
  const p = skyParts(now);
  const s = SHARD.forDate(p.year, p.month, p.day);
  $('#shard-today .card-body').innerHTML = shardDetailHTML(s, now);

  let rows = '';
  for (let i = 1; i <= 7; i++) {
    const c = addDays(p.year, p.month, p.day, i);
    const sd = SHARD.forDate(c.y, c.mo, c.d);
    const wd = WD_ZH[sd.weekday];
    if (!sd.hasShard) {
      rows += `<div class="shard-day"><span class="d-date">${pad(c.mo)}/${pad(c.d)} 週${wd}</span><span class="d-loc"><span class="badge none">無碎石</span></span></div>`;
    } else {
      const badge = sd.type === 'red' ? `<span class="badge red">紅</span>` : `<span class="badge black">黑</span>`;
      rows += `<div class="shard-day"><span class="d-date">${pad(c.mo)}/${pad(c.d)} 週${wd}</span>
        <span class="d-loc">${badge} ${sd.realmZh.split(' ')[0]} · ${sd.location[1]}</span>
        <span class="muted">${fmtSkyTime(sd.eruptions[0].start)}</span></div>`;
    }
  }
  $('#shard-upcoming').innerHTML = rows;
}

function shardDetailHTML(s, now) {
  const wd = WD_ZH[s.weekday];
  if (!s.hasShard) {
    return `<span class="badge none">今日無碎石</span>
      <p class="note">${s.time} 場次每逢「${s.time === '1:50' ? '六、日' : s.time === '2:10' ? '日、一' : s.time === '7:40' ? '一、二' : s.time === '2:20' ? '二、三' : '三、四'}」不掉落，今天是週${wd}。</p>`;
  }
  const badge = s.type === 'red' ? `<span class="badge red">紅石 Red</span>` : `<span class="badge black">黑石 Black</span>`;
  let eruptHTML = '';
  s.eruptions.forEach((e, i) => {
    const isNext = now.getTime() < e.end.getTime() && (i === 0 || now.getTime() >= s.eruptions[i - 1].end.getTime());
    let status;
    if (now.getTime() < e.start.getTime()) status = `出現 ${cd(e.start.getTime())}`;
    else if (now.getTime() < e.end.getTime()) status = `進行中 · 結束 ${cd(e.end.getTime())}`;
    else status = `<span class="muted">已結束</span>`;
    eruptHTML += `<div class="eruption${isNext ? ' next' : ''}">
      <span class="when">第 ${i + 1} 場　Sky ${fmtSkyTime(e.start)}　你的 ${fmtLocal(e.start)}</span>
      <span>${status}</span></div>`;
  });
  return `${badge}
    <div class="kv"><span class="k">區域</span><span class="v">${s.realmZh}</span></div>
    <div class="kv"><span class="k">地圖</span><span class="v">${s.location[1]}（${s.location[0]}）</span></div>
    <div class="kv"><span class="k">首次出現</span><span class="v">${s.time}（每 ${s.type === 'red' ? 6 : 8} 小時，共 3 場）</span></div>
    <p class="note">「出現」是閘門出現時間，落地約在其後 8 分 40 秒，持續約 4 小時。</p>
    ${eruptHTML}`;
}

/* ---------- 渲染：復刻先祖 ---------- */
function renderSpirits(now) {
  // 狀態
  const cur = tsArrival(tsCurrentK(now));
  const log = Store.get('ts_log', {});
  let statusHTML;
  if (now.getTime() < cur.departInst.getTime()) {
    statusHTML = `<span class="badge live">先祖在場中</span> ${log[dateKey(cur.cal)] ? '· ' + escapeHtml(log[dateKey(cur.cal)]) : ''}
      <div class="kv"><span class="k">本次到達</span><span class="v">${dateKey(cur.cal)}（週${WD_ZH[skyWeekday(cur.cal.y, cur.cal.mo, cur.cal.d)]}）</span></div>
      <div class="kv"><span class="k">離開倒數</span><span class="v big">${cd(cur.departInst.getTime())}</span></div>`;
  } else {
    const next = tsArrival(cur.k + 1);
    statusHTML = `<div class="kv"><span class="k">下次到達</span><span class="v">${dateKey(next.cal)}（週${WD_ZH[skyWeekday(next.cal.y, next.cal.mo, next.cal.d)]}）</span></div>
      <div class="kv"><span class="k">到達倒數</span><span class="v big">${cd(next.arrivalInst.getTime())}</span></div>`;
  }
  $('#ts-status .card-body').innerHTML = statusHTML;

  // 行事曆
  let list = '';
  for (let i = -1; i <= 6; i++) {
    const t = tsArrival(cur.k + i);
    const past = now.getTime() >= t.departInst.getTime();
    const live = now.getTime() >= t.arrivalInst.getTime() && now.getTime() < t.departInst.getTime();
    const dep = addDays(t.cal.y, t.cal.mo, t.cal.d, 3); // 週日
    list += `<div class="shard-day">
      <span class="d-date">${dateKey(t.cal)} ~ ${pad(dep.mo)}/${pad(dep.d)}</span>
      <span class="d-loc">${live ? '<span class="badge live">在場</span>' : past ? '<span class="badge none">已過</span>' : '<span class="badge black">即將</span>'} ${log[dateKey(t.cal)] ? escapeHtml(log[dateKey(t.cal)]) : '<span class="muted">（未紀錄）</span>'}</span>
      </div>`;
  }
  $('#ts-list').innerHTML = list;
}

/* 復刻先祖紀錄輸入框：與 reRenderDay 解耦，僅在週期翻頁/開分頁時重建，並保留焦點與未存輸入 */
let lastTsK = null;
function renderTsLog(now) {
  const log = Store.get('ts_log', {});
  const cur = tsArrival(tsCurrentK(now));
  const ae = document.activeElement; // 保存目前焦點/游標/未存值
  const focusKey = (ae && ae.dataset && ae.dataset.tslog) ? ae.dataset.tslog : null;
  const selStart = focusKey ? ae.selectionStart : null;
  const selEnd = focusKey ? ae.selectionEnd : null;
  const liveVal = focusKey ? ae.value : null;
  let logHTML = '';
  for (let i = -3; i <= 4; i++) {
    const t = tsArrival(cur.k + i);
    const key = dateKey(t.cal);
    const val = key === focusKey ? liveVal : (log[key] || '');
    logHTML += `<div class="row"><span class="d-date" style="min-width:120px">${key}</span>
      <input type="text" data-tslog="${key}" value="${escapeHtml(val)}" aria-label="${key} 復刻先祖紀錄" placeholder="這次來的先祖…" /></div>`;
  }
  $('#ts-log').innerHTML = logHTML;
  $$('#ts-log input[data-tslog]').forEach(inp => {
    const save = () => {
      const l = Store.get('ts_log', {});
      const v = inp.value.trim();
      if (v) l[inp.dataset.tslog] = v; else delete l[inp.dataset.tslog];
      Store.set('ts_log', l);
    };
    inp.addEventListener('input', save); // 即時存，避免未失焦就被重建而遺失
    inp.addEventListener('change', save);
  });
  if (focusKey) { // 還原焦點與游標
    const again = $(`#ts-log input[data-tslog="${focusKey}"]`);
    if (again) { again.focus(); try { again.setSelectionRange(selStart, selEnd); } catch (_) {} }
  }
  lastTsK = cur.k;
}

/* ---------- 渲染：蠟燭預算 ---------- */
let candlesBound = false;
function bindCandles() {
  const ids = ['c-season-name', 'c-season-end', 'c-have', 'c-target', 'c-perday'];
  const keys = ['season_name', 'season_end', 'c_have', 'c_target', 'c_perday'];
  ids.forEach((id, i) => {
    const el = $('#' + id);
    const saved = Store.get(keys[i], null);
    if (saved != null) el.value = saved;
    if (!candlesBound) el.addEventListener('input', () => { Store.set(keys[i], el.value); computeCandles(); });
  });
  candlesBound = true;
  computeCandles();
}
function computeCandles() {
  const have = +$('#c-have').value || 0;
  const target = +$('#c-target').value || 0;
  const perDay = +$('#c-perday').value || 0;
  const end = $('#c-season-end').value;
  const box = $('#candle-result');
  if (!end || target <= 0) { box.innerHTML = `<p class="muted">填入「季節結束日」與「目標所需」後即可試算。</p>`; return; }
  const [y, mo, d] = end.split('-').map(Number);
  const p = skyParts(new Date());
  const diff = Math.round((Date.UTC(y, mo - 1, d) - Date.UTC(p.year, p.month - 1, p.day)) / 86400000);
  const daysLeft = Math.max(0, diff + 1); // 結束日當天仍可賺，故含結束日
  const obtainable = have + perDay * daysLeft;
  const need = Math.max(0, target - have);
  const ok = obtainable >= target;
  const perDayNeeded = daysLeft > 0 ? (need / daysLeft) : Infinity;
  const perdayText = need <= 0 ? '已達成 ✓'
    : (daysLeft > 0 ? `${perDayNeeded.toFixed(1)} 根` : '季節已結束，無法達成');
  box.innerHTML = `
    <div class="kv"><span class="k">距離結束（含當天）</span><span class="v">${daysLeft} 天</span></div>
    <div class="kv"><span class="k">還需要</span><span class="v">${need} 根</span></div>
    <div class="kv"><span class="k">預計可獲得（含現有）</span><span class="v">${obtainable} 根</span></div>
    <div class="kv"><span class="k">每天至少需</span><span class="v">${perdayText}</span></div>
    <p class="result ${ok ? 'ok' : 'bad'}" style="font-size:16px;margin-top:10px">
      ${ok ? `✓ 來得及！預計多出 ${obtainable - target} 根。` : `✗ 進度不足，照目前每日 ${perDay} 根會差 ${target - obtainable} 根。`}
    </p>`;
}

/* ---------- 渲染：圖鑑 ---------- */
function defaultCollection() {
  return [
    { name: '範例：永久先祖', items: [{ id: 1, label: '（點 ＋ 項目 新增你要收集的先祖）', done: false }] },
  ];
}
function getCollection() { return Store.get('collection', defaultCollection()); }
function saveCollection(c) { Store.set('collection', c); }

function renderCollection() {
  const data = getCollection();
  const root = $('#collection-root');
  let total = 0, done = 0;
  let html = '';
  data.forEach((cat, ci) => {
    const dc = cat.items.filter(i => i.done).length;
    total += cat.items.length; done += dc;
    const pct = cat.items.length ? Math.round(dc / cat.items.length * 100) : 0;
    html += `<div class="cat">
      <div class="cat-head">
        <span class="cat-name">${escapeHtml(cat.name)}</span>
        <span class="muted">${dc}/${cat.items.length}</span>
        <button class="btn small" data-additem="${ci}">＋ 項目</button>
        <button class="btn small danger" data-delcat="${ci}">刪分類</button>
      </div>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <div class="cat-items">
        ${cat.items.map((it, ii) => `<div class="item ${it.done ? 'done' : ''}">
          <input type="checkbox" data-check="${ci}.${ii}" ${it.done ? 'checked' : ''} />
          <span class="lbl" data-edit="${ci}.${ii}">${escapeHtml(it.label)}</span>
          <span class="x" data-delitem="${ci}.${ii}">✕</span>
        </div>`).join('')}
      </div>
    </div>`;
  });
  root.innerHTML = `<p class="note">總進度 ${done}/${total}（${total ? Math.round(done / total * 100) : 0}%）。點文字可改名。</p>` + html;

  $$('[data-check]', root).forEach(el => el.addEventListener('change', () => {
    const [ci, ii] = el.dataset.check.split('.').map(Number);
    const c = getCollection(); c[ci].items[ii].done = el.checked; saveCollection(c); renderCollection();
  }));
  $$('[data-delitem]', root).forEach(el => el.addEventListener('click', () => {
    const [ci, ii] = el.dataset.delitem.split('.').map(Number);
    const c = getCollection(); c[ci].items.splice(ii, 1); saveCollection(c); renderCollection();
  }));
  $$('[data-delcat]', root).forEach(el => el.addEventListener('click', () => {
    const ci = +el.dataset.delcat;
    if (!confirm('刪除整個分類？')) return;
    const c = getCollection(); c.splice(ci, 1); saveCollection(c); renderCollection();
  }));
  $$('[data-additem]', root).forEach(el => el.addEventListener('click', () => {
    const ci = +el.dataset.additem;
    const name = prompt('項目名稱（先祖 / 物品）：'); if (!name) return;
    const c = getCollection(); c[ci].items.push({ id: Date.now(), label: name, done: false }); saveCollection(c); renderCollection();
  }));
  $$('[data-edit]', root).forEach(el => el.addEventListener('click', () => {
    const [ci, ii] = el.dataset.edit.split('.').map(Number);
    const c = getCollection(); const cur = c[ci].items[ii].label;
    const name = prompt('改名：', cur); if (name == null) return;
    c[ci].items[ii].label = name; saveCollection(c); renderCollection();
  }));
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }

/* ---------- 設定 ---------- */
function bindSettings() {
  const anchor = $('#ts-anchor');
  anchor.value = Store.get('ts_anchor', TS_ANCHOR_DEFAULT);
  anchor.addEventListener('change', () => {
    if (anchor.value) { Store.set('ts_anchor', anchor.value); reRenderDay(new Date()); }
  });
  $('#export-data').addEventListener('click', exportData);
  $('#import-data').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', importData);
  $('#reset-data').addEventListener('click', () => {
    if (!confirm('確定清除這台裝置上的全部紀錄？此動作無法復原。')) return;
    Store.allKeys().forEach(k => localStorage.removeItem(k));
    location.reload();
  });
}
function exportData() {
  const data = {};
  Store.allKeys().forEach(k => data[k] = localStorage.getItem(k));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sky-companion-backup.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
function importData(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result); // 先驗證/解析成功再清除，避免解析失敗就清空
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('備份格式不符');
      Store.allKeys().forEach(k => localStorage.removeItem(k)); // 清掉現有 sky_ 鍵，成為真正「還原」
      Object.keys(data).forEach(k => {
        if (k.startsWith('sky_') && typeof data[k] === 'string') localStorage.setItem(k, data[k]);
      });
      alert('匯入完成！'); location.reload();
    } catch (err) { alert('檔案格式錯誤：' + err.message); }
  };
  reader.readAsText(file);
}

/* ---------- 分頁切換 ---------- */
function showTab(name) {
  $$('.tab').forEach(t => {
    const on = t.dataset.tab === name;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1; // roving tabindex
  });
  $$('.tab-panel').forEach(s => s.classList.toggle('active', s.id === 'tab-' + name));
  const now = new Date();
  if (name === 'overview') renderOverview(now);
  if (name === 'shards') renderShards(now);
  if (name === 'spirits') { renderSpirits(now); renderTsLog(now); }
  if (name === 'candles') bindCandles();
  if (name === 'collection') renderCollection();
  updateCountdowns(now);
}

/* ---------- 跨日 / 場次翻頁時重算 ---------- */
let lastDayKey = '';
let nextFlip = 0;
function computeNextFlip(now) {
  const p = skyParts(now);
  const s = SHARD.forDate(p.year, p.month, p.day);
  let next = nextDailyReset(now).getTime(); // 至少在跨日時翻
  if (s.hasShard) {
    for (const e of s.eruptions) {
      if (e.start.getTime() > now.getTime()) { next = Math.min(next, e.start.getTime()); break; }
      if (e.end.getTime() > now.getTime()) { next = Math.min(next, e.end.getTime()); break; }
    }
  }
  nextFlip = next;
}
function reRenderDay(now) {
  renderOverview(now);
  renderShards(now);
  renderSpirits(now);
  if (tsCurrentK(now) !== lastTsK) renderTsLog(now); // 僅先祖週期翻頁才重建輸入框，碎石場次邊界不牽連
  lastDayKey = dateKey(skyParts(now));
  computeNextFlip(now);
  updateCountdowns(now);
}

/* ---------- 主迴圈 ---------- */
function tick() {
  const now = new Date();
  updateClocks(now);
  const dk = dateKey(skyParts(now));
  if (dk !== lastDayKey || now.getTime() >= nextFlip) {
    reRenderDay(now);
  } else {
    updateCountdowns(now);
  }
}

function init() {
  $('#tabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab'); if (btn) showTab(btn.dataset.tab);
  });
  $('#add-cat').addEventListener('click', () => {
    const name = $('#new-cat').value.trim(); if (!name) return;
    const c = getCollection(); c.push({ name, items: [] }); saveCollection(c);
    $('#new-cat').value = ''; renderCollection();
  });
  bindSettings();
  reRenderDay(new Date());
  setInterval(tick, 1000);
}

document.addEventListener('DOMContentLoaded', init);
