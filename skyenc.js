/* skyenc.js — 資料驅動的百科：先祖圖鑑 + 百科（季節/國度/活動/貨幣/碎石/每日）
 * 資料來自 window.SKYDATA（skydata.js，由 Silverfeelin/SkyGame-Data 處理而來）。
 * 共用 app.js / util.js 的全域：$、$$、Store、escapeHtml。
 */

const SD = (typeof window !== 'undefined' && window.SKYDATA) || { spirits: [], seasons: [], realms: [], events: [], travelingSpirits: [], currencies: [], shards: {}, daily: {}, wingedLights: [], realmShapes: [] };
// 名稱顯示：優先用 app.js 的 nm()（英文+中文括號），無則退回 escapeHtml
function NM(x) { return (typeof nm === 'function') ? nm(x) : escapeHtml(x == null ? '' : x); }
function zhOf(name) { return (typeof window !== 'undefined' && window.SKYZH && window.SKYZH[name]) || ''; }
function IMGT(url, cap, cls) { return (typeof imgThumb === 'function') ? imgThumb(url, cap, cls) : ''; }
// 光之翼收集追蹤（存 localStorage 'sky_wl'；帳號登入後會一起雲端同步）
let wlOnlyTodo = (typeof Store !== 'undefined') ? Store.get('map_todo', false) : false;
// 地圖圖層開關（記住上次選擇，存 localStorage）
const _ls = (k, d) => (typeof Store !== 'undefined') ? Store.get(k, d) : d;
let showWL = _ls('map_wl', true);             // 光之翼
let showShrines = _ls('map_shrine', false);   // 祭壇（67 個，預設關，要看再開）
let showWax = _ls('map_wax', true);           // 饅頭/海膽 定時蠟燭點
let showBoundary = _ls('map_boundary', true); // 國度框線 + 標籤 + 旅程連線
let showSpirits = _ls('map_spirits', false);  // 先祖位置（205 個，預設關，避免太亂）
let showShards = _ls('map_shards', true);     // 今日碎石位置
function wlGot() { return Store.get('wl', {}); }
function wlToggle(order) { const g = wlGot(); if (g[order]) delete g[order]; else g[order] = 1; Store.set('wl', g); }

// 通用收集追蹤（祭壇/永久蠟燭/先祖等可收集圖層）：依國度分組 + 打勾進度，存 Store
const REALM_ORDER_ZH = ['晨島', '雲野', '雨林', '霞谷', '暮土', '禁閣', '鳥族村', '伊甸之眼', '星海', '其他'];
function collGot(key) { return Store.get(key, {}); }
function collToggle(key, id) { const g = Store.get(key, {}); if (g[id]) delete g[id]; else g[id] = 1; Store.set(key, g); }
// 依國度分組產生 <details> 清單。opts: realmOf(it), idOf(it), rowHTML(it), storeKey
function realmGroupHTML(items, opts) {
  const got = collGot(opts.storeKey);
  const byR = {};
  items.forEach(it => { const r = opts.realmOf(it) || '其他'; (byR[r] = byR[r] || []).push(it); });
  const keys = Object.keys(byR).sort((a, b) => ((REALM_ORDER_ZH.indexOf(a) + 1) || 99) - ((REALM_ORDER_ZH.indexOf(b) + 1) || 99));
  return keys.map(rk => {
    const arr = byR[rk];
    const g = arr.filter(it => got[opts.idOf(it)]).length;
    const rows = arr.map(it => {
      const id = String(opts.idOf(it));
      const thumb = opts.thumbHTML ? opts.thumbHTML(it) : '';
      return `<div class="coll-row wl-row${got[id] ? ' got' : ''}"><input type="checkbox" class="coll-check wl-check" data-coll="${escapeHtml(opts.storeKey)}" data-id="${escapeHtml(id)}" ${got[id] ? 'checked' : ''} aria-label="標記已完成" /><div class="coll-info wl-info">${opts.rowHTML(it)}</div>${thumb}</div>`;
    }).join('');
    return `<details class="wiki-card"><summary><b>${escapeHtml(rk)}</b> <span class="badge none coll-prog">${g}/${arr.length}</span></summary><div class="sp-body coll-list">${rows}</div></details>`;
  }).join('');
}
// 綁定收集勾選：更新該列、該國度進度、該圖層總進度
function bindCollChecks(root) {
  if (!root) return;
  $$('.coll-check', root).forEach(cb => cb.addEventListener('change', () => {
    collToggle(cb.dataset.coll, cb.dataset.id);
    const row = cb.closest('.coll-row'); if (row) row.classList.toggle('got', cb.checked);
    const det = cb.closest('details');
    if (det) { const cs = $$('.coll-check', det); const b = det.querySelector('.coll-prog'); if (b) b.textContent = cs.filter(c => c.checked).length + '/' + cs.length; }
    const tot = root.querySelector(`[data-colltotal="${cb.dataset.coll}"]`);
    if (tot) { const all = $$(`.coll-check[data-coll="${cb.dataset.coll}"]`, root); tot.textContent = all.filter(c => c.checked).length + '/' + all.length; }
  }));
}

const COST_LABEL = {
  c: ['🕯️', '蠟燭'], h: ['❤️', '愛心'], ac: ['✨', '升華蠟燭'],
  sc: ['🌙', '季節蠟燭'], sh: ['💗', '季節愛心'], ec: ['🎟️', '活動幣'],
};
function fmtCost(cost) {
  const parts = Object.keys(cost || {}).map(k => `${(COST_LABEL[k] || ['', k])[0]}${cost[k]}`);
  return parts.length ? parts.join(' ') : '<span class="muted" title="無花費資料：多為樹起點/光翼免費，少數為資料缺漏">—</span>';
}
// 花費圖示說明（由 COST_LABEL 自動產生，永遠同步）
function costLegendHTML() {
  const items = Object.keys(COST_LABEL).map(k => `${COST_LABEL[k][0]} ${COST_LABEL[k][1]}`).join('　');
  return `<p class="cost-legend">花費圖示：${items}　·　<b>—</b>＝無花費資料（多為樹起點／光翼免費，少數為資料缺漏）</p>`;
}
function fmtTotals(t) {
  const parts = Object.keys(t || {}).map(k => `${(COST_LABEL[k] || ['', k])[0]}${t[k]}`);
  return parts.length ? parts.join('　') : '';
}

/* ---------- 先祖圖鑑 ---------- */
let dexState = { q: '', filter: 'all' };
let dexQTimer = null;
const dexByName = new Map(SD.spirits.map(s => [s.name, s]));
function dexCollected() { return Store.get('dex', {}); }
function dexToggle(name) {
  const c = dexCollected();
  if (c[name]) delete c[name]; else c[name] = 1;
  Store.set('dex', c);
}
function spiritBucket(sp) {
  if (sp.type === 'Season') return 'season';
  if (sp.type === 'Regular') return 'regular';
  return 'event'; // Event / Special / 其他
}
function dexMatch(sp) {
  const f = dexState.filter;
  if (f === 'uncollected' && dexCollected()[sp.name]) return false;
  if ((f === 'season' || f === 'regular' || f === 'event') && spiritBucket(sp) !== f) return false;
  if (dexState.q) {
    const q = dexState.q.toLowerCase();
    const hay = (sp.name + ' ' + (sp.season || '') + ' ' + (sp.realm || '') + ' ' + zhOf(sp.name) + ' ' + zhOf(sp.season)).toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}
function spiritBadges(sp) {
  if (sp.type === 'Season' && sp.season) return `<span class="badge season-b">${NM(sp.season)}</span>`;
  if (sp.type === 'Regular') return `<span class="badge none">常駐${sp.realm ? ' · ' + escapeHtml(sp.realm) : ''}</span>`;
  return `<span class="badge event-b">${escapeHtml(sp.type)}</span>`;
}
function spiritBody(sp) {
  const itemsHtml = sp.items.length
    ? costLegendHTML() + '<div class="dex-items">' + sp.items.map(it => (typeof itemRowHTML === 'function') ? itemRowHTML(it) : `<div class="dex-item"><span>${escapeHtml(it.name)}</span><span class="cost">${fmtCost(it.cost)}</span></div>`).join('') + '</div>'
    : '<p class="note">（無兌換資料）</p>';
  const traveled = sp.traveled && sp.traveled.length
    ? `<p class="note">復刻 ${sp.traveled.length} 次：${sp.traveled.slice(-3).join('、')}${sp.traveled.length > 3 ? ' …' : ''}</p>` : '';
  const wiki = sp.wiki ? `<a class="wiki-link" href="${sp.wiki}" target="_blank" rel="noopener">Wiki ↗</a>` : '';
  const portrait = sp.img ? `<div class="sp-portrait-wrap">${IMGT(sp.img, sp.name, 'sp-portrait')}</div>` : '';
  // 確切地點：國度 · 區域 + 該地點實景照片 + 可放大世界地圖紅點
  let locHtml = '';
  if (sp.loc && sp.loc.pos) {
    const lt = (typeof locText === 'function') ? locText(sp.loc) : (sp.loc.area || '');
    const tip = sp.type === 'Season' ? '（季節先祖：此為其季節原本所在的地點）' : '';
    const map = (typeof posMiniMap === 'function') ? posMiniMap(sp.loc.pos, lt, sp.loc.img) : '';
    if (sp.locImg) {
      // 有位置教學圖：以教學圖為主（箭頭標好位置），世界地圖位置收進可展開，不再重複放空景
      locHtml = `<div class="sp-loc"><p class="note" style="margin:0 0 4px">📍 ${escapeHtml(lt)}${tip} · ⬇ 圖上箭頭為精確位置</p>
        <div class="sp-guide">${IMGT(sp.locImg, lt + ' 位置教學圖', 'loc-guide')}</div>
        <details class="sp-worldmap"><summary>🗺️ 在世界地圖的位置</summary><div class="shard-map-wrap" style="margin-top:6px">${map}</div></details></div>`;
    } else {
      // 無教學圖：用區域實景照 + 世界地圖紅點
      const photo = sp.loc.img ? `<div class="shard-photo-wrap">${IMGT(sp.loc.img, lt, 'shard-photo')}</div>` : '';
      locHtml = `<div class="sp-loc"><p class="note" style="margin:0 0 4px">📍 ${escapeHtml(lt)}${tip}</p><div class="shard-media">${photo}<div class="shard-map-wrap">${map}</div></div></div>`;
    }
  } else if (sp.type === 'Event') {
    locHtml = `<p class="note">📍 活動限定，無固定地點</p>`;
  }
  return portrait + locHtml + itemsHtml + traveled + wiki;
}
// 摘要先渲染，明細在展開時才填（懶載入，列表才不會一次塞數百張完整卡）
function spiritCard(sp) {
  const col = dexCollected()[sp.name];
  return `<details class="spirit" data-name="${escapeHtml(sp.name)}">
    <summary>
      <span class="star ${col ? 'on' : ''}" data-star="${escapeHtml(sp.name)}" role="button" aria-label="標記已解鎖">${col ? '★' : '☆'}</span>
      <span class="sp-name">${NM(sp.name)}</span>
      ${spiritBadges(sp)}
      <span class="sp-total">${fmtTotals(sp.totals)}</span>
    </summary>
    <div class="sp-body"></div>
  </details>`;
}
function renderDex() {
  const root = $('#dex-root');
  if (!root) return;
  const list = SD.spirits.filter(dexMatch);
  const col = dexCollected();
  const total = SD.spirits.length;
  const got = SD.spirits.filter(s => col[s.name]).length;
  const chips = [['all', '全部'], ['season', '季節'], ['regular', '常駐'], ['event', '活動/其他'], ['uncollected', '未解鎖']];
  root.innerHTML = `
    <div class="dex-head">
      <input type="text" id="dex-q" placeholder="搜尋先祖 / 季節 / 國度…" aria-label="搜尋先祖" value="${escapeHtml(dexState.q)}" />
      <div class="chips">${chips.map(c => `<button class="chip ${dexState.filter === c[0] ? 'on' : ''}" data-filter="${c[0]}">${c[1]}</button>`).join('')}</div>
      <p class="note">已解鎖 <b id="dex-got">${got}</b>/${total}　·　顯示 <b id="dex-shown">${list.length}</b> 位</p>
    </div>
    <div class="dex-list">${list.map(spiritCard).join('')}</div>`;

  const q = $('#dex-q');
  q.addEventListener('input', () => {
    dexState.q = q.value; const pos = q.selectionStart;
    clearTimeout(dexQTimer);
    dexQTimer = setTimeout(() => { renderDex(); const nq = $('#dex-q'); if (nq) { nq.focus(); try { nq.setSelectionRange(pos, pos); } catch (_) {} } }, 180);
  });
  $$('.chip', root).forEach(b => b.addEventListener('click', () => { dexState.filter = b.dataset.filter; renderDex(); }));
  const listEl = $('.dex-list', root);
  listEl.addEventListener('click', e => {
    const star = e.target.closest('.star');
    if (!star) return;
    e.preventDefault();
    const name = star.dataset.star;
    dexToggle(name);
    const on = !!dexCollected()[name];
    // 只更新那顆星與進度，不整頁重畫（保留展開狀態與捲動位置）
    star.classList.toggle('on', on);
    star.textContent = on ? '★' : '☆';
    const gotEl = root.querySelector('#dex-got');
    if (gotEl) gotEl.textContent = SD.spirits.filter(s => dexCollected()[s.name]).length;
    // 「未解鎖」篩選下，剛標為已解鎖的卡要移出視圖，並更新「顯示 N 位」
    if (dexState.filter === 'uncollected' && on) {
      const card = star.closest('.spirit'); if (card) card.remove();
      const shownEl = root.querySelector('#dex-shown');
      if (shownEl) shownEl.textContent = $$('.dex-list .spirit', root).length;
    }
  });
  listEl.addEventListener('toggle', e => { // 展開時才填入明細（toggle 不冒泡，用捕獲）
    const d = e.target;
    if (d.tagName === 'DETAILS' && d.open) {
      const body = d.querySelector('.sp-body');
      if (body && !body.dataset.filled) {
        const sp = dexByName.get(d.dataset.name);
        if (sp) { body.innerHTML = spiritBody(sp); body.dataset.filled = '1'; }
      }
    }
  }, true);
}

/* ---------- 百科 ---------- */
let wikiTab = 'seasons';
function todayISO() {
  const p = (typeof skyParts === 'function') ? skyParts(new Date()) : null;
  if (!p) return '9999-99-99';
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
function wikiSeasons() {
  return SD.seasons.map(s => `<details class="wiki-card">
    <summary>${s.icon ? IMGT(s.icon, s.name, 'season-icon') : ''}<b>${NM(s.name)}</b> <span class="muted">${s.start || ''} ~ ${s.end || ''}</span> <span class="badge none">${s.spirits.length} 位</span></summary>
    <div class="sp-body">${s.spirits.map(n => `<span class="pill">${NM(n)}</span>`).join(' ') || '<span class="muted">—</span>'}
      ${s.wiki ? `<div><a class="wiki-link" href="${s.wiki}" target="_blank" rel="noopener">Wiki ↗</a></div>` : ''}</div>
  </details>`).join('');
}
function wikiRealms() {
  return SD.realms.map(r => {
    const locOf = {}; (r.areaLocs || []).forEach(a => { locOf[a.name] = a; });
    const rz = zhOf(r.name) || r.name;
    const hasLoc = Object.keys(locOf).length > 0;
    const pills = r.areas.map(a => {
      const L = locOf[a];
      if (L && L.pos) return `<span class="pill pill-loc" data-mappos="${L.pos[0]},${L.pos[1]}" data-mapcap="${escapeHtml(rz + ' · ' + (zhOf(a) || a))}"${L.img ? ` data-mapimg="${escapeHtml(L.img)}"` : ''} role="button" tabindex="0" title="點看世界地圖位置與照片">${NM(a)} 📍</span>`;
      return `<span class="pill">${NM(a)}</span>`;
    }).join(' ');
    return `<div class="wiki-card open">
      <div class="wc-head"><b>${NM(r.name)}</b> ${r.wingedLight ? `<span class="badge none">✦ 光之翼 ${r.wingedLight}</span>` : ''}</div>
      <div class="sp-body">${r.img ? `<div class="realm-photo-wrap">${IMGT(r.img, rz, 'realm-photo')}</div>` : ''}
        ${hasLoc ? '<p class="note" style="margin:4px 0">點有 📍 的區域名，看它的實景照片＋在世界地圖上的確切位置（可放大）：</p>' : ''}${pills}
        ${r.wiki ? `<div><a class="wiki-link" href="${r.wiki}" target="_blank" rel="noopener">Wiki ↗</a></div>` : ''}</div>
    </div>`;
  }).join('');
}
function wikiEvents() {
  const today = todayISO();
  const rows = SD.events.map(e => {
    const insts = e.instances.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const next = e.instances.find(i => i.end >= today);
    const lines = insts.slice(0, 6).map(i => {
      const up = i.end >= today;
      return `<div class="kv"><span class="k">${i.date} ~ ${i.end}</span><span class="v">${up ? '<span class="badge live">即將/進行</span>' : '<span class="badge none">已過</span>'}</span></div>`;
    }).join('');
    return `<details class="wiki-card"${next ? ' open' : ''}>
      <summary><b>${NM(e.name)}</b> ${e.recurring ? '<span class="badge season-b">每年</span>' : ''}</summary>
      <div class="sp-body">${e.img ? `<div class="realm-photo-wrap">${IMGT(e.img, e.name, 'realm-photo')}</div>` : ''}${lines || '<span class="muted">—</span>'}
        ${e.wiki ? `<div><a class="wiki-link" href="${e.wiki}" target="_blank" rel="noopener">Wiki ↗</a></div>` : ''}</div>
    </details>`;
  }).join('');
  return rows;
}
// 每日大蠟路線圖（各國度大蠟燭位置；點圖可放大）
function wikiCandleMaps() {
  const list = SD.candleMaps || [];
  if (!list.length) return '<p class="muted">無大蠟地圖資料。</p>';
  return `<p class="note">各國度「每日大蠟燭」路線圖，標出所有大蠟位置與數量（c 值＝該處蠟量）。點圖可放大（滾輪／雙指縮放、拖曳平移）。來源：sky-planner / solsuga。</p>` +
    list.map(c => {
      const zh = zhOf(c.name) || c.name;
      return `<details class="wiki-card"><summary><b>${NM(c.name)}</b> <span class="badge none">大蠟地圖</span></summary>
        <div class="sp-body"><img class="wl-thumb shard-photo" style="max-width:100%;cursor:zoom-in" src="${escapeHtml(c.img)}" data-imgzoom="${escapeHtml(c.img)}" data-cap="${escapeHtml(zh + ' · 每日大蠟地圖')}" loading="lazy" alt="${escapeHtml(zh)} 大蠟地圖" onerror="this.style.display='none'" /></div>
      </details>`;
    }).join('');
}
function wikiCurrencies() {
  return SD.currencies.map(c => `<div class="wiki-card open">
    <div class="wc-head"><b>${escapeHtml(c.name)}</b> <span class="muted">${escapeHtml(c.en || '')}</span></div>
    <div class="sp-body">
      <div class="kv"><span class="k">取得</span><span class="v">${escapeHtml(c.earn)}</span></div>
      <div class="kv"><span class="k">上限</span><span class="v">${escapeHtml(c.cap)}</span></div>
      <div class="kv"><span class="k">用途</span><span class="v">${escapeHtml(c.use)}</span></div>
    </div></div>`).join('');
}
function wikiShards() {
  const s = SD.shards;
  return `<p class="note">${escapeHtml(s.intro || '')}</p>
    <div class="wiki-card open"><div class="wc-head"><span class="badge black">${escapeHtml(s.black.name)}</span></div>
      <div class="sp-body"><div class="kv"><span class="k">獎勵</span><span class="v">${escapeHtml(s.black.reward)}</span></div>
      <div class="kv"><span class="k">風險</span><span class="v">${escapeHtml(s.black.danger)}</span></div></div></div>
    <div class="wiki-card open"><div class="wc-head"><span class="badge red">${escapeHtml(s.red.name)}</span></div>
      <div class="sp-body"><div class="kv"><span class="k">獎勵</span><span class="v">${escapeHtml(s.red.reward)}</span></div>
      <div class="kv"><span class="k">風險</span><span class="v">${escapeHtml(s.red.danger)}</span></div></div></div>
    <ul class="tips">${(s.tips || []).map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;
}
function wikiDaily() {
  const d = SD.daily;
  const block = (title, text) => `<div class="wiki-card open"><div class="wc-head"><b>${title}</b></div><div class="sp-body"><p style="white-space:pre-line">${escapeHtml(text || '')}</p></div></div>`;
  return block('每日蠟燭', d.candles) + block('每日任務', d.quests) + block('季節蠟燭最大化', d.seasonCandles) + block('伊甸之眼（升華蠟燭）', d.eden);
}
// 光之翼示意地圖（國度輪廓 + 亮點，滑過看說明、點擊開影片）
function wikiWinged() {
  const shapes = SD.realmShapes || [];
  const wls = (SD.wingedLights || []).filter(w => w.pos);
  // sky-planner 用 Leaflet CRS.Simple：position=[lat,lng]，底圖 540×540 覆蓋 lng 0..540 / -lat 0..540
  const X = p => p[1], Y = p => -p[0];
  const ORDER = { 'Isle of Dawn': 1, 'Daylight Prairie': 2, 'Hidden Forest': 3, 'Valley of Triumph': 4, 'Golden Wasteland': 5, 'Vault of Knowledge': 6, 'Eye of Eden': 7 };
  const circled = '①②③④⑤⑥⑦';
  const polys = shapes.map(s => {
    const pts = s.boundary.map(p => `${X(p)},${Y(p)}`).join(' ');
    const lp = s.pos || s.boundary[0];
    const zhLabel = zhOf(s.name) || zhOf(s.short) || s.short || s.name;
    const label = (ORDER[s.name] ? circled[ORDER[s.name] - 1] + ' ' : '') + zhLabel;
    return `<polygon points="${pts}" fill="none" stroke="${s.color}" stroke-width="1" opacity="0.75"/>
      <text x="${X(lp)}" y="${Y(lp)}" fill="${s.color}" font-size="11" text-anchor="middle" paint-order="stroke" stroke="#0b1026" stroke-width="3.5">${escapeHtml(label)}</text>`;
  }).join('');
  // 旅程順序連線（晨島①→…→伊甸之眼⑦）給地圖方向性
  const orderNames = Object.keys(ORDER).sort((a, b) => ORDER[a] - ORDER[b]);
  const pathPts = orderNames.map(n => { const s = shapes.find(x => x.name === n); return s ? (s.pos || (s.boundary && s.boundary[0])) : null; }).filter(Boolean);
  const pathLine = pathPts.length > 1 ? `<polyline class="wl-path" points="${pathPts.map(p => X(p) + ',' + Y(p)).join(' ')}" marker-mid="url(#arr)" marker-end="url(#arr)" />` : '';
  const defs = `<defs><marker id="arr" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 Z" fill="rgba(243,210,122,.85)"/></marker></defs>`;
  // 各國度內的編號（與下方清單一致）
  const idxMap = {}; const _t = {};
  (SD.wingedLights || []).forEach(w => { _t[w.realm] = (_t[w.realm] || 0) + 1; idxMap[w.order] = _t[w.realm]; });
  const got = wlGot();
  const total = wls.length, gotN = wls.filter(w => got[w.order]).length;
  const dots = wls.filter(w => !(wlOnlyTodo && got[w.order])).map(w => {
    const cap = escapeHtml(`${w.realm} ${idxMap[w.order]}　${w.descZh || w.desc}`);
    return `<g class="wl-mark${got[w.order] ? ' wl-got' : ''}" data-order="${w.order}" data-x="${X(w.pos)}" data-y="${Y(w.pos)}"${w.img ? ` data-full="${escapeHtml(w.img)}" data-cap="${cap}"` : ''}>
      <circle cx="${X(w.pos)}" cy="${Y(w.pos)}" r="4.5"><title>${cap}</title></circle>
      <text x="${X(w.pos)}" y="${Y(w.pos) + 1.5}" text-anchor="middle">${idxMap[w.order]}</text></g>`;
  }).join('');
  // 祭壇（地圖神像）：點亮即開啟該區域地圖。青色菱形，與黃色光之翼點區別
  const shrines = (SD.mapShrines || []).filter(s => s.pos);
  const shrineDots = shrines.map(s => {
    const rz = zhOf(s.realm) || s.realm || '';
    const az = zhOf(s.area) || s.area || '';
    const cap = escapeHtml(`🔥 祭壇（地圖神像）· ${[rz, az].filter(Boolean).join(' · ')}${s.desc ? '（' + s.desc + '）' : ''}`);
    const x = X(s.pos), y = Y(s.pos);
    return `<g class="shrine-mark" data-x="${x}" data-y="${y}"${s.img ? ` data-full="${escapeHtml(s.img)}" data-cap="${cap}"` : ''}>
      <path d="M${x},${y - 4.4} L${x + 4.4},${y} L${x},${y + 4.4} L${x - 4.4},${y} Z"><title>${cap}</title></path></g>`;
  }).join('');
  // 定時蠟燭點：饅頭（雨林團圓飯）/ 海膽（聖島污染噴泉），彩色圓點 + 中文字
  const wax = (typeof waxEventsInfo === 'function') ? waxEventsInfo(new Date()) : [];
  const waxMarks = wax.filter(w => w.pos).map(w => {
    const x = X(w.pos), y = Y(w.pos);
    const cap = escapeHtml(`${w.emoji} ${w.name}（${w.realmZh}）· ${w.note}`);
    return `<g class="wax-mark" data-x="${x}" data-y="${y}"${w.img ? ` data-full="${escapeHtml(w.img)}" data-cap="${cap}"` : ''}>
      <circle cx="${x}" cy="${y}" r="6.2" fill="${w.color}" stroke="#fff" stroke-width="0.9"><title>${cap}</title></circle>
      <text x="${x}" y="${y + 2.2}" text-anchor="middle" font-size="6" fill="#fff" font-weight="700">${w.char}</text></g>`;
  }).join('');
  // 先祖位置：每位先祖一個綠點；同區多位以小環狀錯開，點開優先看「位置教學圖」(有箭頭標記)，無則區域實景
  const spiritByPos = {};
  (SD.spirits || []).forEach(s => {
    if (!s.loc || !s.loc.pos) return;
    const k = s.loc.pos.join(',');
    (spiritByPos[k] = spiritByPos[k] || []).push(s);
  });
  const spiritDots = Object.keys(spiritByPos).map(k => {
    const grp = spiritByPos[k], n = grp.length;
    const cx = X(grp[0].loc.pos), cy = Y(grp[0].loc.pos);
    return grp.map((s, i) => {
      let x = cx, y = cy;
      if (n > 1) { const r = Math.min(3 + n * 0.5, 9), a = (i / n) * 2 * Math.PI; x = cx + r * Math.cos(a); y = cy + r * Math.sin(a); }
      const nm = zhOf(s.name) || s.name;
      const loc = [zhOf(s.loc.realm) || s.loc.realm, zhOf(s.loc.area) || s.loc.area].filter(Boolean).join(' · ');
      const img = s.locImg || s.loc.img;
      const cap = escapeHtml(`${nm} · ${loc}${s.locImg ? '（位置教學圖）' : '（區域實景）'}`);
      return `<g class="spirit-mark${s.locImg ? ' has-guide' : ''}" data-x="${x.toFixed(1)}" data-y="${y.toFixed(1)}"${img ? ` data-full="${escapeHtml(img)}" data-cap="${cap}"` : ''}>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" fill="#54c98a" stroke="#fff" stroke-width="0.7"><title>${cap}</title></circle></g>`;
    }).join('');
  }).join('');
  // 今日碎石位置：紅石/黑石，於碎石所在區域標一個彩色圈
  let shardMark = '';
  try {
    if (typeof SHARD !== 'undefined' && typeof skyParts === 'function') {
      const p = skyParts(new Date());
      const sd = SHARD.forDate(p.year, p.month, p.day);
      const spos = sd && sd.hasShard && (SD.shardPos || {})[sd.location[0]];
      if (spos) {
        const x = X(spos), y = Y(spos), red = sd.type === 'red';
        const t0 = (sd.eruptions && sd.eruptions[0] && typeof fmtLocalTime === 'function') ? fmtLocalTime(sd.eruptions[0].start) : '';
        const cap = escapeHtml(`${red ? '🔴 紅石' : '⚫ 黑石'} · ${sd.realmZh} · ${sd.location[1]}${t0 ? ' · 首次 ' + t0 + '（台灣）' : ''}`);
        const img = (SD.shardImages || {})[sd.location[0]];
        shardMark = `<g class="shard-mark" data-x="${x}" data-y="${y}"${img ? ` data-full="${escapeHtml(img)}" data-cap="${cap}"` : ''}>
          <circle cx="${x}" cy="${y}" r="6.6" fill="${red ? '#ff5a5a' : '#9b7be0'}" stroke="#fff" stroke-width="1"><title>${cap}</title></circle>
          <text x="${x}" y="${y + 2.4}" text-anchor="middle" font-size="7" fill="#fff" font-weight="700">${red ? '紅' : '黑'}</text></g>`;
      }
    }
  } catch (e) {}
  // 真實遊戲世界地圖底圖 + SVG 疊層（viewBox 對齊底圖 540×540 座標）
  const svg = `<div class="wl-map">
    <img class="wl-map-bg" src="img/map.webp" alt="光遇世界地圖" draggable="false" />
    <svg class="wl-map-svg" viewBox="0 0 540 540" preserveAspectRatio="none" role="img" aria-label="光之翼位置地圖">${defs}${showBoundary ? polys + pathLine : ''}${showSpirits ? spiritDots : ''}${showShrines ? shrineDots : ''}${showWax ? waxMarks : ''}${showShards ? shardMark : ''}${showWL ? dots : ''}</svg>
  </div>`;
  // 定時蠟燭倒數面板（台灣時間 + 即時倒數；倒數用 .cd 由主迴圈每秒更新）
  const waxPanel = wax.length ? `<div class="wax-panel">${wax.map(w => {
    const cdFn = (typeof cd === 'function') ? cd : (() => '');
    const fL = (typeof fmtLocalTime === 'function') ? fmtLocalTime : (d => d);
    const status = w.activeUntil
      ? `<span class="badge live">出現中</span> 結束 ${cdFn(w.activeUntil)}`
      : (w.next ? `下次 <b>${fL(w.next)}</b>（台灣）　${cdFn(w.next.getTime())}` : '');
    return `<div class="wax-row"><span class="wax-dot" style="background:${w.color}">${w.char}</span><b>${w.emoji} ${w.name}</b> <span class="muted">${w.realmZh}</span>　${status}</div>`;
  }).join('')}<p class="note" style="margin:4px 0 0">饅頭/海膽每 2 小時出現一次（太平洋偶數整點，已換算台灣時間），持續約 10 分鐘，可燒得大量燭光。點地圖上的 🥟🦔 看實景。</p></div>` : '';
  const byRealm = {};
  (SD.wingedLights || []).forEach(w => { (byRealm[w.realm] = byRealm[w.realm] || []).push(w); });
  const list = Object.keys(byRealm).map(rk => {
    const arr = byRealm[rk];
    const rgot = arr.filter(w => got[w.order]).length;
    const rows = arr.filter(w => !(wlOnlyTodo && got[w.order])).map(w => `<div class="wl-row${got[w.order] ? ' got' : ''}">
      <input type="checkbox" class="wl-check" data-wl="${w.order}" ${got[w.order] ? 'checked' : ''} aria-label="標記已拿" />
      <div class="wl-info"><b class="wl-n">${idxMap[w.order]}</b> ${escapeHtml(w.descZh || w.desc)}
        ${w.wiki ? `<a class="wiki-link" href="${w.wiki}" target="_blank" rel="noopener">位置圖↗</a>` : ''}${w.img && w.imgC === 'low' ? ' <span class="muted" style="font-size:11px">（照片自動比對，可能不準）</span>' : ''}</div>
      ${w.img ? `<img class="wl-thumb" src="${escapeHtml(w.img)}" data-full="${escapeHtml(w.img)}" data-cap="${escapeHtml(w.realm + ' ' + idxMap[w.order] + '　' + (w.descZh || w.desc))}" loading="lazy" alt="位置照片" onerror="this.style.display='none'" />` : ''}
    </div>`).join('');
    return `<details class="wiki-card">
      <summary><b>${escapeHtml(rk)}</b> <span class="badge none">${rgot}/${arr.length}</span></summary>
      <div class="sp-body">${rows || '<p class="muted">此國度已全部拿完 ✓</p>'}</div>
    </details>`;
  }).join('');
  const layerBar = `<div class="layer-bar"><span class="lb-label">顯示圖層</span>
    <button class="chip ${showWL ? 'on' : ''}" data-layer="wl">✦ 光之翼</button>
    <button class="chip ${showSpirits ? 'on' : ''}" data-layer="spirits">🟢 先祖</button>
    <button class="chip ${showShrines ? 'on' : ''}" data-layer="shrine">🔷 祭壇</button>
    <button class="chip ${showWax ? 'on' : ''}" data-layer="wax">🍬 蠟燭點</button>
    <button class="chip ${showShards ? 'on' : ''}" data-layer="shards">🌑 今日碎石</button>
    <button class="chip ${showBoundary ? 'on' : ''}" data-layer="boundary">🗺️ 國度框線</button>
    <span class="lb-sep"></span>
    <button class="chip ${wlOnlyTodo ? 'on' : ''}" data-wlfilter>只看未拿翼</button>
  </div>`;
  // 祭壇收集追蹤（依國度分組 + 進度）
  const shrineItems = (SD.mapShrines || []).filter(s => s.pos);
  const _shg = collGot('shrine_got');
  const shrineGot = shrineItems.filter(s => _shg[s.pos.join(',')]).length;
  const shrineTracker = shrineItems.length ? `<details class="wiki-card coll-layer" style="margin-top:12px"><summary>🔷 <b>祭壇收集</b> <span class="badge none" data-colltotal="shrine_got">${shrineGot}/${shrineItems.length}</span> <span class="muted">· 點亮各國度地圖神像</span></summary><div class="sp-body">${realmGroupHTML(shrineItems, {
    storeKey: 'shrine_got', realmOf: s => zhOf(s.realm) || s.realm, idOf: s => s.pos.join(','),
    rowHTML: s => { const az = zhOf(s.area) || s.area || ''; return `<b>${escapeHtml(az)}</b>${s.desc ? `<br><span class="muted">${escapeHtml(s.desc)}</span>` : ''}`; },
    thumbHTML: s => s.img ? IMGT(s.img, (zhOf(s.realm) || s.realm) + ' · ' + (zhOf(s.area) || s.area || ''), '') : ''
  })}</div></details>` : '';
  // 先祖位置收集追蹤（與圖鑑分開記錄；依國度分組 + 進度）
  const spiritItems = (SD.spirits || []).filter(s => s.loc && s.loc.pos);
  const _spg = collGot('spirit_got');
  const spiritGot = spiritItems.filter(s => _spg[s.name]).length;
  const spiritTracker = spiritItems.length ? `<details class="wiki-card coll-layer" style="margin-top:10px"><summary>🟢 <b>先祖位置收集</b> <span class="badge none" data-colltotal="spirit_got">${spiritGot}/${spiritItems.length}</span> <span class="muted">· 依地圖位置，與圖鑑分開</span></summary><div class="sp-body">${realmGroupHTML(spiritItems, {
    storeKey: 'spirit_got', realmOf: s => zhOf(s.loc.realm) || s.loc.realm, idOf: s => s.name,
    rowHTML: s => { const nm2 = zhOf(s.name) || s.name; const az = zhOf(s.loc.area) || s.loc.area || ''; return `<b>${escapeHtml(nm2)}</b>${az ? `<br><span class="muted">${escapeHtml(az)}</span>` : ''}`; },
    thumbHTML: s => { const img = s.locImg || s.loc.img; return img ? IMGT(img, zhOf(s.name) || s.name, '') : ''; }
  })}</div></details>` : '';
  return `<p class="note" style="margin-top:0">共 ${total} 個光之翼，已拿 <b id="wl-count">${gotN}/${total}</b>。黃點＝光之翼、🟢＝先祖、🔷＝祭壇、🥟🦔＝蠟燭點、🔴⚫＝今日碎石，點標記看實景／名單；滾輪／雙指或右上 ＋－ 縮放、拖曳平移。用下方開關勾選要顯示的圖層。</p>
    ${layerBar}
    ${showWax ? waxPanel : ''}
    <div class="wl-map-wrap">
      <div class="wl-zoom-ctrl"><button type="button" data-z="in" aria-label="放大">＋</button><button type="button" data-z="out" aria-label="縮小">－</button><button type="button" data-z="reset" aria-label="重設">⟲</button></div>
      ${svg}
    </div><details class="wiki-card coll-layer" open style="margin-top:12px"><summary>✦ <b>光之翼收集</b> <span class="badge none wl-total">${gotN}/${total}</span> <span class="muted">· 點各國度展開／收合</span></summary><div class="sp-body">${list}</div></details>${shrineTracker}${spiritTracker}
    <details class="wiki-card" style="margin-top:14px"><summary><b>🕯️ 每日大蠟地圖</b> <span class="muted">各國度固定大蠟位置 · 點開查看</span></summary><div class="sp-body">${wikiCandleMaps()}</div></details>`;
}
// 地圖分頁（光之翼），獨立於最上層導覽
function renderMap() {
  const root = $('#map-root');
  if (root) { root.innerHTML = wikiWinged(); setupMapZoom(); bindWlCollection(); bindCollChecks(root); }
}
function bindWlCollection() {
  const root = $('#map-root');
  if (!root) return;
  const fb = root.querySelector('[data-wlfilter]');
  if (fb) fb.addEventListener('click', () => { wlOnlyTodo = !wlOnlyTodo; Store.set('map_todo', wlOnlyTodo); renderMap(); });
  $$('[data-layer]', root).forEach(b => b.addEventListener('click', () => {
    const L = b.dataset.layer;
    if (L === 'wl') { showWL = !showWL; Store.set('map_wl', showWL); }
    else if (L === 'spirits') { showSpirits = !showSpirits; Store.set('map_spirits', showSpirits); }
    else if (L === 'shrine') { showShrines = !showShrines; Store.set('map_shrine', showShrines); }
    else if (L === 'wax') { showWax = !showWax; Store.set('map_wax', showWax); }
    else if (L === 'shards') { showShards = !showShards; Store.set('map_shards', showShards); }
    else if (L === 'boundary') { showBoundary = !showBoundary; Store.set('map_boundary', showBoundary); }
    renderMap();
  }));
  $$('.wl-check', root).forEach(cb => cb.addEventListener('change', () => {
    const order = cb.dataset.wl;
    wlToggle(order);
    const on = !!wlGot()[order];
    const dot = root.querySelector(`.wl-mark[data-order="${order}"]`);
    if (dot) dot.classList.toggle('wl-got', on);
    const row = cb.closest('.wl-row'); if (row) row.classList.toggle('got', on);
    const g = wlGot(), all = (SD.wingedLights || []).filter(w => w.pos);
    const txt = all.filter(w => g[w.order]).length + '/' + all.length;
    const cnt = root.querySelector('#wl-count'); if (cnt) cnt.textContent = txt;
    const tot = root.querySelector('.wl-total'); if (tot) tot.textContent = txt;
    // 同步更新該列所屬國度的進度徽章（過濾「只看未拿」時略過，避免計數失真）
    const det = cb.closest('details');
    if (det && !wlOnlyTodo) { const cs = $$('.wl-check', det); const b = det.querySelector('summary .badge'); if (b) b.textContent = cs.filter(c => c.checked).length + '/' + cs.length; }
    if (wlOnlyTodo && on) { if (dot) dot.style.display = 'none'; if (row) row.style.display = 'none'; }
  }));
}

// 直接開啟燈箱（供地圖點 pointerup 使用，繞過被 pointer capture 打斷的 click）
function openLightboxFromEl(el) {
  const lb = document.getElementById('lightbox');
  if (!lb) return;
  const img = document.getElementById('lightbox-img'), cap = document.getElementById('lightbox-cap');
  if (img) img.src = el.dataset.full;
  if (cap) cap.textContent = el.dataset.cap || '';
  lb.classList.add('open');
}

// 地圖縮放/平移：滾輪、拖曳、雙指、＋－⟲ 按鈕
let mapView = null; // 主地圖縮放/平移狀態，切換圖層後保留
function setupMapZoom(wrap) {
  wrap = wrap || $('.wl-map-wrap');
  const svg = wrap && wrap.querySelector('.wl-map');
  if (!svg) return;
  const persist = !!(wrap.closest && wrap.closest('#map-root')); // 只有主地圖保留視圖（燈箱地圖每次從頭）
  let scale = 1, tx = 0, ty = 0;
  if (persist && mapView) { scale = mapView.scale; tx = mapView.tx; ty = mapView.ty; }
  const pointers = new Map();
  let lastDist = 0, panStart = null, dragged = false;
  const apply = () => { svg.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`; if (persist) mapView = { scale, tx, ty }; };
  if (persist && mapView && scale !== 1) apply(); // 還原上次視圖
  function zoomAt(px, py, factor) {
    const ns = Math.min(9, Math.max(1, scale * factor));
    const k = ns / scale;
    tx = px - (px - tx) * k; ty = py - (py - ty) * k; scale = ns;
    if (scale <= 1.001) { scale = 1; tx = 0; ty = 0; }
    apply();
  }
  const ctr = () => { const r = wrap.getBoundingClientRect(); return [r.width / 2, r.height / 2]; };

  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    const r = wrap.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.2 : 1 / 1.2);
  }, { passive: false });

  // 刻意「不用 setPointerCapture」：capture 會把後續 click 的 target 改寫成整張地圖，
  // 導致抓不到被點的那個點（Android 觸控尤其明顯）。改用 pointer 事件只做平移/縮放，
  // 開照片交給下方的 click 委派（click 的 target 才是真正被點到的點）。
  svg.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged = false;
    if (pointers.size === 1) panStart = { x: e.clientX, y: e.clientY, tx, ty };
    if (pointers.size === 2) { const p = [...pointers.values()]; lastDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); }
  });
  svg.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const p = [...pointers.values()];
      const dist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const r = wrap.getBoundingClientRect();
      if (lastDist) zoomAt((p[0].x + p[1].x) / 2 - r.left, (p[0].y + p[1].y) / 2 - r.top, dist / lastDist);
      lastDist = dist; dragged = true;
    } else if (panStart && (e.buttons || e.pointerType === 'touch')) {
      const dx = e.clientX - panStart.x, dy = e.clientY - panStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 8) dragged = true;
      tx = panStart.tx + dx; ty = panStart.ty + dy; apply();
    }
  });
  const up = e => { pointers.delete(e.pointerId); if (pointers.size < 2) lastDist = 0; if (pointers.size === 0) panStart = null; };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
  // 點地圖 → 開「離點擊位置最近」的那個點的照片（解決密集點互相擋住、點不到的問題）。
  // 把螢幕座標換算成 SVG viewBox 座標(含縮放/平移)，再找最近的可見點；拖曳/縮放過(dragged)則取消。
  const inner = svg.querySelector('.wl-map-svg');
  svg.addEventListener('click', e => {
    e.stopPropagation();
    if (dragged || !inner || !inner.getScreenCTM) return;
    const m = inner.getScreenCTM();
    if (!m) return;
    let loc;
    try { loc = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()); }
    catch (_) { const p = inner.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; loc = p.matrixTransform(m.inverse()); }
    let best = null, bestD = Infinity;
    inner.querySelectorAll('.wl-mark, .shrine-mark, .wax-mark, .spirit-mark, .shard-mark').forEach(g => {
      if (g.style.display === 'none') return;
      const dx = loc.x - (+g.dataset.x), dy = loc.y - (+g.dataset.y);
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = g; }
    });
    // 12 個 viewBox 單位內才算點到；最近的那顆勝出，所以密集區放大後點靠近想要的那顆即可
    if (best && bestD <= 12 * 12 && best.dataset.full) openLightboxFromEl(best);
  });

  $$('.wl-zoom-ctrl button', wrap).forEach(b => b.addEventListener('click', () => {
    const [cx, cy] = ctr();
    if (b.dataset.z === 'in') zoomAt(cx, cy, 1.4);
    else if (b.dataset.z === 'out') zoomAt(cx, cy, 1 / 1.4);
    else { scale = 1; tx = 0; ty = 0; apply(); }
  }));
}
function renderWiki() {
  const root = $('#wiki-root');
  if (!root) return;
  const subs = [['seasons', '季節'], ['realms', '國度'], ['events', '活動'], ['currencies', '貨幣'], ['shards', '碎石'], ['daily', '每日攻略']];
  const fn = {
    seasons: wikiSeasons, realms: wikiRealms, events: wikiEvents,
    currencies: wikiCurrencies, shards: wikiShards, daily: wikiDaily,
  }[wikiTab] || wikiSeasons;
  const body = fn();
  root.innerHTML = `
    <div class="chips wiki-nav">${subs.map(s => `<button class="chip ${wikiTab === s[0] ? 'on' : ''}" data-wiki="${s[0]}">${s[1]}</button>`).join('')}</div>
    <div class="wiki-body">${body}</div>`;
  $$('.wiki-nav .chip', root).forEach(b => b.addEventListener('click', () => { wikiTab = b.dataset.wiki; renderWiki(); }));
}
