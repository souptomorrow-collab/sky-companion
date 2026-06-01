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

/* 名稱顯示：英文名 +（若翻譯表 window.SKYZH 有對應）中文括號。缺則只顯示英文。回傳 HTML。 */
function nm(name) {
  if (name == null) return '';
  const zh = (typeof window !== 'undefined' && window.SKYZH && window.SKYZH[name]) || null;
  return escapeHtml(name) + (zh ? ` <span class="zh">(${escapeHtml(zh)})</span>` : '');
}

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

  // 每日任務參考卡
  renderQuests(now);
}

function renderQuests(now) {
  const box = $('#ov-quests .card-body');
  if (!box) return;
  const dq = (typeof window !== 'undefined' && window.SKYDATA && window.SKYDATA.dailyQuests);
  if (!dq) { box.innerHTML = '<p class="muted">—</p>'; return; }
  const p = skyParts(now);
  const dk = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  const done = Store.get('quests_' + dk, [false, false, false, false]);
  const daily = nextDailyReset(now);
  const localT = daily.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
  const cnt = done.filter(Boolean).length;
  const typesHtml = dq.types.map((t, i) =>
    `<label class="q-item"><input type="checkbox" data-q="${i}" ${done[i] ? 'checked' : ''}/> <b>${escapeHtml(t.name)}</b> <span class="muted">${escapeHtml(t.desc)}</span></label>`).join('');
  const claimHtml = dq.claim.map(c =>
    `<div class="q-claim"><img class="wl-thumb" src="${escapeHtml(c.img)}" data-full="${escapeHtml(c.img)}" data-cap="${escapeHtml(c.place + '：' + c.desc)}" loading="lazy" alt="${escapeHtml(c.place)}" onerror="this.style.display='none'" /><div><b>${escapeHtml(c.place)}</b><br><span class="muted">${escapeHtml(c.desc)}</span></div></div>`).join('');
  box.innerHTML = `
    <div class="kv"><span class="k">重置</span><span class="v">${cd(daily.getTime())} <span class="muted">· 太平洋 00:00（你的 ${localT}）</span></span></div>
    <div class="q-prog">今日進度 ${cnt}/4 <span class="muted">· ${escapeHtml(dq.reward)}</span></div>
    <div class="q-types">${typesHtml}</div>
    <p class="note">領取地點（固定）：</p>
    <div class="q-claims">${claimHtml}</div>
    <p class="note">${escapeHtml(dq.note)}</p>`;
  $$('#ov-quests input[data-q]').forEach(inp => inp.addEventListener('change', () => {
    const arr = Store.get('quests_' + dk, [false, false, false, false]);
    arr[+inp.dataset.q] = inp.checked; Store.set('quests_' + dk, arr);
    renderQuests(new Date());
  }));
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

/* 由 skydata 自動偵測「今天正在進行」的季節（依日期）。使用者手動設定的優先。 */
function currentSeason(now) {
  const list = (typeof window !== 'undefined' && window.SKYDATA && window.SKYDATA.seasons) || [];
  const p = skyParts(now);
  const today = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  return list.find(s => s.start && s.end && s.start <= today && today <= s.end) || null;
}
function seasonSummaryHTML(now) {
  const cur = currentSeason(now);
  const userEnd = Store.get('season_end', '');
  const name = Store.get('season_name', '') || (cur ? cur.short : '');
  const end = userEnd || (cur ? cur.end : '');
  const auto = !userEnd && cur;
  if (!end) return `<p class="muted">目前無進行中的季節。</p><p class="note">新季節開始後會自動顯示；也可到「蠟燭預算」分頁手動設定。</p>`;
  const [y, mo, d] = end.split('-').map(Number);
  const endInst = skyWallToDate(y, mo, d, 23, 59, 59);
  const p = skyParts(now);
  const diff = Math.round((Date.UTC(y, mo - 1, d) - Date.UTC(p.year, p.month - 1, p.day)) / 86400000);
  const daysLeft = Math.max(0, diff + 1); // 結束日當天 23:59:59 前仍可賺，故含結束日
  return `<div class="kv"><span class="k">${name ? escapeHtml(name) : '本季'}${auto ? ' <span class="muted">(自動)</span>' : ''}</span><span class="v">${end} 結束</span></div>
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
// 由 skydata 的真實復刻歷史，查某到達日實際來的先祖（未公布則回 null）
function tsSpiritOn(dateStr) {
  const list = (typeof window !== 'undefined' && window.SKYDATA && window.SKYDATA.travelingSpirits) || [];
  for (const t of list) if (t.date === dateStr) return t.spirit;
  return null;
}
function renderSpirits(now) {
  // 狀態
  const cur = tsArrival(tsCurrentK(now));
  let statusHTML;
  if (now.getTime() < cur.departInst.getTime()) {
    const who = tsSpiritOn(dateKey(cur.cal));
    statusHTML = `<span class="badge live">先祖在場中</span> ${who ? '· ' + nm(who) : ''}
      <div class="kv"><span class="k">本次到達</span><span class="v">${dateKey(cur.cal)}（週${WD_ZH[skyWeekday(cur.cal.y, cur.cal.mo, cur.cal.d)]}）</span></div>
      <div class="kv"><span class="k">離開倒數</span><span class="v big">${cd(cur.departInst.getTime())}</span></div>`;
  } else {
    const next = tsArrival(cur.k + 1);
    const who = tsSpiritOn(dateKey(next.cal));
    statusHTML = `<div class="kv"><span class="k">下次到達</span><span class="v">${dateKey(next.cal)}（週${WD_ZH[skyWeekday(next.cal.y, next.cal.mo, next.cal.d)]}）</span></div>
      ${who ? `<div class="kv"><span class="k">先祖</span><span class="v">${nm(who)}</span></div>` : ''}
      <div class="kv"><span class="k">到達倒數</span><span class="v big">${cd(next.arrivalInst.getTime())}</span></div>`;
  }
  $('#ts-status .card-body').innerHTML = statusHTML;

  // 行事曆（自動帶入實際先祖；未公布的標「待官方公布」）
  let list = '';
  for (let i = -1; i <= 6; i++) {
    const t = tsArrival(cur.k + i);
    const past = now.getTime() >= t.departInst.getTime();
    const live = now.getTime() >= t.arrivalInst.getTime() && now.getTime() < t.departInst.getTime();
    const dep = addDays(t.cal.y, t.cal.mo, t.cal.d, 3); // 週日
    const who = tsSpiritOn(dateKey(t.cal));
    list += `<div class="shard-day">
      <span class="d-date">${dateKey(t.cal)} ~ ${pad(dep.mo)}/${pad(dep.d)}</span>
      <span class="d-loc">${live ? '<span class="badge live">在場</span>' : past ? '<span class="badge none">已過</span>' : '<span class="badge black">即將</span>'} ${who ? nm(who) : '<span class="muted">（待官方公布）</span>'}</span>
      </div>`;
  }
  $('#ts-list').innerHTML = list;
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
  // 未手動設定時，自動帶入偵測到的當前季節（不寫入儲存，季節換了會自動更新）
  const cur = currentSeason(new Date());
  if (cur) {
    if (!$('#c-season-name').value) $('#c-season-name').value = cur.short;
    if (!$('#c-season-end').value) $('#c-season-end').value = cur.end;
  }
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

/* 先祖圖鑑（先祖/物品/花費）已改為資料驅動，見 skyenc.js 的 renderDex()。 */
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
  if (name === 'spirits') renderSpirits(now);
  if (name === 'candles') bindCandles();
  if (name === 'dex') renderDex();
  if (name === 'map') renderMap();
  if (name === 'wiki') renderWiki();
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
  // 光之翼地圖點 / 縮圖 → 點擊跳出燈箱大圖 + 說明（點任意處或 Esc 關閉）
  const lb = $('#lightbox'), lbImg = $('#lightbox-img'), lbCap = $('#lightbox-cap');
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('[data-full]');
    if (el && el.dataset.full) {
      lbImg.src = el.dataset.full;
      if (lbCap) lbCap.textContent = el.dataset.cap || '';
      lb.classList.add('open');
    } else if (lb.classList.contains('open')) {
      lb.classList.remove('open'); lbImg.removeAttribute('src');
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && lb.classList.contains('open')) { lb.classList.remove('open'); lbImg.removeAttribute('src'); }
  });
  bindSettings();
  reRenderDay(new Date());
  setInterval(tick, 1000);
}

document.addEventListener('DOMContentLoaded', init);
