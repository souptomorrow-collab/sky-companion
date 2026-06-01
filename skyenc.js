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
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  const upd = (x, y) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; };
  shapes.forEach(s => s.boundary.forEach(p => upd(p[0], p[1])));
  wls.forEach(w => upd(w.pos[0], w.pos[1]));
  const pad = 25; minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const polys = shapes.map(s => {
    const pts = s.boundary.map(p => `${p[0]},${p[1]}`).join(' ');
    const lp = s.pos || s.boundary[0];
    const label = zhOf(s.name) || zhOf(s.short) || s.short || s.name;
    return `<polygon points="${pts}" fill="${s.color}22" stroke="${s.color}" stroke-width="1.5"/>
      <text x="${lp[0]}" y="${lp[1]}" fill="${s.color}" font-size="9" text-anchor="middle" paint-order="stroke" stroke="#0b1026" stroke-width="2.4">${escapeHtml(label)}</text>`;
  }).join('');
  const dots = wls.map(w =>
    `<circle cx="${w.pos[0]}" cy="${w.pos[1]}" r="2.6" fill="#ffe9b0" stroke="#1a1326" stroke-width="0.5"><title>${escapeHtml('#' + w.order + ' ' + (w.descZh || w.desc))}</title></circle>`
  ).join('');
  const svg = `<svg viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" class="wl-map" role="img" aria-label="光之翼位置示意圖" preserveAspectRatio="xMidYMid meet">${polys}${dots}</svg>`;
  const byRealm = {};
  (SD.wingedLights || []).forEach(w => { (byRealm[w.realm] = byRealm[w.realm] || []).push(w); });
  const list = Object.keys(byRealm).map(rk => `<details class="wiki-card">
    <summary><b>${escapeHtml(rk)}</b> <span class="badge none">${byRealm[rk].length}</span></summary>
    <div class="sp-body">${byRealm[rk].map(w => `<div class="wl-row">
      <div class="wl-info"><b>#${w.order}</b> ${escapeHtml(w.descZh || w.desc)}
        ${w.wiki ? `<a class="wiki-link" href="${w.wiki}" target="_blank" rel="noopener">位置圖↗</a>` : ''}${w.img && w.imgC === 'low' ? ' <span class="muted" style="font-size:11px">（照片自動比對，可能不準）</span>' : ''}</div>
      ${w.img ? `<a href="${w.wiki || w.img}" target="_blank" rel="noopener" class="wl-thumb-link"><img class="wl-thumb" src="${escapeHtml(w.img)}" loading="lazy" referrerpolicy="no-referrer" alt="位置照片 #${w.order}" onerror="this.closest('.wl-thumb-link').style.display='none'" /></a>` : ''}
    </div>`).join('')}</div>
  </details>`).join('');
  return `<p class="note">共 ${wls.length} 個光之翼。地圖為示意位置（滑過亮點看說明）；下方清單每個都有中文位置描述，點「位置圖↗」可看 wiki 上該地點的實際照片。</p>
    <div class="wl-map-wrap">${svg}</div>${list}`;
}
// 地圖分頁（光之翼），獨立於最上層導覽
function renderMap() {
  const root = $('#map-root');
  if (root) root.innerHTML = wikiWinged();
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
