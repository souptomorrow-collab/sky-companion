/* skyenc.js — 資料驅動的百科：先祖圖鑑 + 百科（季節/國度/活動/貨幣/碎石/每日）
 * 資料來自 window.SKYDATA（skydata.js，由 Silverfeelin/SkyGame-Data 處理而來）。
 * 共用 app.js / util.js 的全域：$、$$、Store、escapeHtml。
 */

const SD = (typeof window !== 'undefined' && window.SKYDATA) || { spirits: [], seasons: [], realms: [], events: [], travelingSpirits: [], currencies: [], shards: {}, daily: {}, wingedLights: [], realmShapes: [] };
// 名稱顯示：優先用 app.js 的 nm()（英文+中文括號），無則退回 escapeHtml
function NM(x) { return (typeof nm === 'function') ? nm(x) : escapeHtml(x == null ? '' : x); }
function zhOf(name) { return (typeof window !== 'undefined' && window.SKYZH && window.SKYZH[name]) || ''; }

const COST_LABEL = {
  c: ['🕯️', '蠟燭'], h: ['❤️', '愛心'], ac: ['✨', '升華'],
  sc: ['🌙', '季節蠟燭'], sh: ['💗', '季節愛心'], ec: ['🎟️', '活動幣'],
};
function fmtCost(cost) {
  const parts = Object.keys(cost || {}).map(k => `${(COST_LABEL[k] || ['', k])[0]}${cost[k]}`);
  return parts.length ? parts.join(' ') : '<span class="muted">免費</span>';
}
function fmtTotals(t) {
  const parts = Object.keys(t || {}).map(k => `${(COST_LABEL[k] || ['', k])[0]}${t[k]}`);
  return parts.length ? parts.join('　') : '';
}

/* ---------- 先祖圖鑑 ---------- */
let dexState = { q: '', filter: 'all' };
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
    ? sp.items.map(it => `<div class="dex-item"><span>${escapeHtml(it.name)} <span class="muted">${escapeHtml(it.type || '')}</span></span><span class="cost">${fmtCost(it.cost)}</span></div>`).join('')
    : '<p class="note">（無兌換資料）</p>';
  const traveled = sp.traveled && sp.traveled.length
    ? `<p class="note">復刻 ${sp.traveled.length} 次：${sp.traveled.slice(-3).join('、')}${sp.traveled.length > 3 ? ' …' : ''}</p>` : '';
  const wiki = sp.wiki ? `<a class="wiki-link" href="${sp.wiki}" target="_blank" rel="noopener">Wiki ↗</a>` : '';
  return itemsHtml + traveled + wiki;
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
      <p class="note">已解鎖 ${got}/${total}　·　顯示 ${list.length} 位</p>
    </div>
    <div class="dex-list">${list.map(spiritCard).join('')}</div>`;

  const q = $('#dex-q');
  q.addEventListener('input', () => { dexState.q = q.value; const pos = q.selectionStart; renderDex(); const nq = $('#dex-q'); nq.focus(); try { nq.setSelectionRange(pos, pos); } catch (_) {} });
  $$('.chip', root).forEach(b => b.addEventListener('click', () => { dexState.filter = b.dataset.filter; renderDex(); }));
  const listEl = $('.dex-list', root);
  listEl.addEventListener('click', e => {
    const star = e.target.closest('.star');
    if (star) { e.preventDefault(); dexToggle(star.dataset.star); renderDex(); }
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
    <summary><b>${NM(s.name)}</b> <span class="muted">${s.start || ''} ~ ${s.end || ''}</span> <span class="badge none">${s.spirits.length} 位</span></summary>
    <div class="sp-body">${s.spirits.map(n => `<span class="pill">${NM(n)}</span>`).join(' ') || '<span class="muted">—</span>'}
      ${s.wiki ? `<div><a class="wiki-link" href="${s.wiki}" target="_blank" rel="noopener">Wiki ↗</a></div>` : ''}</div>
  </details>`).join('');
}
function wikiRealms() {
  return SD.realms.map(r => `<div class="wiki-card open">
    <div class="wc-head"><b>${NM(r.name)}</b> ${r.wingedLight ? `<span class="badge none">✦ 光之翼 ${r.wingedLight}</span>` : ''}</div>
    <div class="sp-body">${r.areas.map(a => `<span class="pill">${NM(a)}</span>`).join(' ')}
      ${r.wiki ? `<div><a class="wiki-link" href="${r.wiki}" target="_blank" rel="noopener">Wiki ↗</a></div>` : ''}</div>
  </div>`).join('');
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
      <div class="sp-body">${lines || '<span class="muted">—</span>'}
        ${e.wiki ? `<div><a class="wiki-link" href="${e.wiki}" target="_blank" rel="noopener">Wiki ↗</a></div>` : ''}</div>
    </details>`;
  }).join('');
  return rows;
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
  const dots = wls.map(w => {
    const cap = escapeHtml(`${w.realm} ${idxMap[w.order]}　${w.descZh || w.desc}`);
    return `<g class="wl-mark"${w.img ? ` data-full="${escapeHtml(w.img)}" data-cap="${cap}"` : ''}>
      <circle cx="${X(w.pos)}" cy="${Y(w.pos)}" r="4.5"><title>${cap}</title></circle>
      <text x="${X(w.pos)}" y="${Y(w.pos) + 1.5}" text-anchor="middle">${idxMap[w.order]}</text></g>`;
  }).join('');
  // 真實遊戲世界地圖底圖 + SVG 疊層（viewBox 對齊底圖 540×540 座標）
  const svg = `<div class="wl-map">
    <img class="wl-map-bg" src="img/map.webp" alt="光遇世界地圖" draggable="false" />
    <svg class="wl-map-svg" viewBox="0 0 540 540" preserveAspectRatio="none" role="img" aria-label="光之翼位置地圖">${defs}${polys}${pathLine}${dots}</svg>
  </div>`;
  const byRealm = {};
  (SD.wingedLights || []).forEach(w => { (byRealm[w.realm] = byRealm[w.realm] || []).push(w); });
  const list = Object.keys(byRealm).map(rk => `<details class="wiki-card">
    <summary><b>${escapeHtml(rk)}</b> <span class="badge none">${byRealm[rk].length}</span></summary>
    <div class="sp-body">${byRealm[rk].map(w => `<div class="wl-row">
      <div class="wl-info"><b class="wl-n">${idxMap[w.order]}</b> ${escapeHtml(w.descZh || w.desc)}
        ${w.wiki ? `<a class="wiki-link" href="${w.wiki}" target="_blank" rel="noopener">位置圖↗</a>` : ''}${w.img && w.imgC === 'low' ? ' <span class="muted" style="font-size:11px">（照片自動比對，可能不準）</span>' : ''}</div>
      ${w.img ? `<img class="wl-thumb" src="${escapeHtml(w.img)}" data-full="${escapeHtml(w.img)}" data-cap="${escapeHtml(w.realm + ' ' + idxMap[w.order] + '　' + (w.descZh || w.desc))}" loading="lazy" alt="位置照片" onerror="this.style.display='none'" />` : ''}
    </div>`).join('')}</div>
  </details>`).join('');
  return `<p class="note">共 ${wls.length} 個光之翼。同色區塊為同一國度，虛線箭頭 ①→⑦ 是旅程順序（晨島→伊甸之眼）。<b>點任一個編號點看該地點實際照片</b>；滾輪／雙指或右上 ＋－ 可縮放，拖曳平移。</p>
    <div class="wl-map-wrap">
      <div class="wl-zoom-ctrl"><button type="button" data-z="in" aria-label="放大">＋</button><button type="button" data-z="out" aria-label="縮小">－</button><button type="button" data-z="reset" aria-label="重設">⟲</button></div>
      ${svg}
    </div>${list}`;
}
// 地圖分頁（光之翼），獨立於最上層導覽
function renderMap() {
  const root = $('#map-root');
  if (root) { root.innerHTML = wikiWinged(); setupMapZoom(); }
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
function setupMapZoom() {
  const wrap = $('.wl-map-wrap');
  const svg = wrap && wrap.querySelector('.wl-map');
  if (!svg) return;
  let scale = 1, tx = 0, ty = 0;
  const pointers = new Map();
  let lastDist = 0, moved = 0, panStart = null, downTarget = null;
  const apply = () => { svg.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`; };
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

  svg.addEventListener('pointerdown', e => {
    svg.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0; downTarget = e.target;
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
      lastDist = dist; moved += 20;
    } else if (panStart && (e.buttons || e.pointerType === 'touch')) {
      const dx = e.clientX - panStart.x, dy = e.clientY - panStart.y;
      moved += Math.abs(dx) + Math.abs(dy);
      tx = panStart.tx + dx; ty = panStart.ty + dy; apply();
    }
  });
  const up = e => { pointers.delete(e.pointerId); if (pointers.size < 2) lastDist = 0; if (pointers.size === 0) panStart = null; };
  svg.addEventListener('pointerup', e => {
    // 輕點某個編號點 → 直接開燈箱（setPointerCapture 會打斷一般 click 委派，故在此處理）
    if (moved <= 8 && downTarget && downTarget.closest) {
      const mark = downTarget.closest('[data-full]');
      if (mark && mark.dataset.full) openLightboxFromEl(mark);
    }
    up(e);
  });
  svg.addEventListener('pointercancel', up);
  // 地圖內的 click 一律不傳到 document：地圖點由上面的 pointerup 開照片，
  // 否則 click 會走到 document 委派的 else 分支，把剛開的燈箱立刻關掉（看似沒反應）。
  svg.addEventListener('click', e => { e.stopPropagation(); if (moved > 8) e.preventDefault(); }, true);

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
