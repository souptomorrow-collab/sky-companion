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

/* 圖片縮圖（點開燈箱）。wikia 圖用 no-referrer 避開防盜連；載入失敗自動隱藏。 */
function imgThumb(url, cap, cls) {
  if (!url) return '';
  return `<img class="wl-thumb ${cls || ''}" src="${escapeHtml(url)}" data-full="${escapeHtml(url)}" data-cap="${escapeHtml(cap || '')}" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="${escapeHtml(cap || '照片')}" onerror="this.style.display='none'" />`;
}
function shardImg(loc) { return (typeof window !== 'undefined' && window.SKYDATA && window.SKYDATA.shardImages && window.SKYDATA.shardImages[loc]) || ''; }
// 物品圖路徑 → 完整 wikia 網址（build 已去掉共同前綴）
function iconUrl(p) { return p ? (p.indexOf('http') === 0 ? p : 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/' + p) : ''; }
// 兌換物品一列（小圖 + 名稱 + 類型 + 花費），先祖圖鑑與復刻先祖共用
function itemRowHTML(it) {
  const ic = iconUrl(it.icon), pv = iconUrl(it.prev) || ic;
  const fc = (typeof fmtCost === 'function') ? fmtCost : () => '';
  const img = ic ? `<img class="item-ic" src="${escapeHtml(ic)}"${pv ? ` data-full="${escapeHtml(pv)}" data-cap="${escapeHtml(it.name)}"` : ''} loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="" onerror="this.style.display='none'" />` : '';
  return `<div class="dex-item"><span class="di-name">${img}${escapeHtml(it.name)} <span class="muted">${escapeHtml(it.type || '')}</span></span><span class="cost">${fc(it.cost)}</span></div>`;
}
// 世界地圖小圖 + 脈動紅點（pos=[lat,lng]）。整塊可點擊 → 開全螢幕可縮放地圖（含該地點實景照片）。
function posMiniMap(pos, cap, img) {
  if (!pos || pos.length < 2) return '';
  const x = pos[1], y = -pos[0]; // Leaflet CRS.Simple：x=lng, y=-lat
  return `<div class="shard-map mini-map" data-mappos="${pos[0]},${pos[1]}" data-mapcap="${escapeHtml(cap || '')}"${img ? ` data-mapimg="${escapeHtml(img)}"` : ''} role="button" tabindex="0" title="點擊放大查看">
    <img class="wl-map-bg" src="img/map.webp" alt="世界地圖" draggable="false" loading="lazy" />
    <svg class="wl-map-svg" viewBox="0 0 540 540" preserveAspectRatio="none" aria-label="位置">
      <circle cx="${x}" cy="${y}" r="8" fill="none" stroke="#ff5a5a" stroke-width="2"><animate attributeName="r" values="6;14;6" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.2;1" dur="1.5s" repeatCount="indefinite"/></circle>
      <circle cx="${x}" cy="${y}" r="4.5" fill="#ff5a5a" stroke="#fff" stroke-width="1.2"/>
    </svg>
    <span class="mini-map-hint">🔍 放大</span>
  </div>`;
}
function shardMiniMap(loc, cap) {
  const pos = (typeof window !== 'undefined' && window.SKYDATA && window.SKYDATA.shardPos && window.SKYDATA.shardPos[loc]);
  if (!pos) return '';
  return posMiniMap(pos, cap || loc);
}
// 全螢幕可縮放地圖（重用 skyenc.js 的 setupMapZoom）。每次重建內容→不殘留舊監聽。含該地點實景照片。
function openMapZoom(pos, cap, img) {
  const lb = document.getElementById('map-lightbox');
  const host = document.getElementById('map-lightbox-host');
  if (!lb || !host || !pos) return;
  const x = pos[1], y = -pos[0];
  host.innerHTML = `${img ? `<img class="ml-photo" src="${escapeHtml(img)}" referrerpolicy="no-referrer" alt="${escapeHtml(cap || '地點照片')}" onerror="this.style.display='none'" />` : ''}
    <div class="wl-map-wrap">
    <div class="wl-zoom-ctrl"><button type="button" data-z="in" aria-label="放大">＋</button><button type="button" data-z="out" aria-label="縮小">－</button><button type="button" data-z="reset" aria-label="重設">⟲</button></div>
    <div class="wl-map">
      <img class="wl-map-bg" src="img/map.webp" alt="世界地圖" draggable="false" />
      <svg class="wl-map-svg" viewBox="0 0 540 540" preserveAspectRatio="none">
        <circle cx="${x}" cy="${y}" r="9" fill="none" stroke="#ff5a5a" stroke-width="2"><animate attributeName="r" values="7;17;7" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.2;1" dur="1.5s" repeatCount="indefinite"/></circle>
        <circle cx="${x}" cy="${y}" r="5" fill="#ff5a5a" stroke="#fff" stroke-width="1.3"/>
      </svg>
    </div></div>`;
  const cap2 = document.getElementById('map-lightbox-cap');
  if (cap2) cap2.textContent = cap || '';
  lb.classList.add('open');
  if (typeof setupMapZoom === 'function') setupMapZoom(host.querySelector('.wl-map-wrap'));
}
// 全螢幕可縮放看任意圖片（給大蠟路線圖等大圖用，可滾輪/雙指放大、拖曳平移）
function openImageZoom(url, cap) {
  const lb = document.getElementById('map-lightbox');
  const host = document.getElementById('map-lightbox-host');
  if (!lb || !host || !url) return;
  host.innerHTML = `<div class="wl-map-wrap wide">
    <div class="wl-zoom-ctrl"><button type="button" data-z="in" aria-label="放大">＋</button><button type="button" data-z="out" aria-label="縮小">－</button><button type="button" data-z="reset" aria-label="重設">⟲</button></div>
    <div class="wl-map"><img class="wl-map-bg" src="${escapeHtml(url)}" alt="${escapeHtml(cap || '')}" draggable="false" /></div>
  </div>`;
  const cap2 = document.getElementById('map-lightbox-cap');
  if (cap2) cap2.textContent = cap || '';
  lb.classList.add('open');
  if (typeof setupMapZoom === 'function') setupMapZoom(host.querySelector('.wl-map-wrap'));
}
// 依先祖名查所在地點 {realm,area,pos}（資料來自 skydata 的 spirits[].loc）
function spLoc(name) {
  const list = (typeof window !== 'undefined' && window.SKYDATA && window.SKYDATA.spirits) || [];
  const s = list.find(x => x.name === name);
  return (s && s.loc) || null;
}
// 依先祖名查完整資料（含兌換物品 items / 總花費 totals）
function spiritByName(name) {
  const list = (typeof window !== 'undefined' && window.SKYDATA && window.SKYDATA.spirits) || [];
  return list.find(x => x.name === name) || null;
}
// 復刻先祖花費警語：資料庫存的是「季節原價」，復刻時遊戲多改以普通蠟燭/愛心重新計價
const TS_COST_NOTE = '<p class="note" style="color:var(--ink-pink)">⚠️ 下列花費為該先祖「季節原價」（季節蠟燭🌙）。<b>復刻先祖實際多改以普通蠟燭🕯️＋愛心❤️重新計價</b>，項目與總額可能不同，請以遊戲內為準。</p>';
// 復刻先祖兌換內容（物品清單 + 總花費）。fmtCost/fmtTotals 由 skyenc.js 提供
const TS_REAL_NOTE = '<p class="note" style="color:var(--green)">✅ 以下為「實際復刻價」（普通蠟燭🕯️＋愛心❤️），已由遊戲內樹狀圖校正，可信。</p>';
const TS_EST_NOTE = '<p class="note" style="color:var(--ink)">🔶 以下為「Wiki 估算復刻價」：飾品價取自 Wiki，表情/祝福/愛心/翅膀節點以常見標準推估，<b>總額可能略有出入</b>。看到遊戲內樹狀圖歡迎丟給我校正成精準版，請以遊戲內為準。</p>';
// 取復刻花費資料：有 ts-cost.json 覆寫就用它(real)，est=Wiki估算待校正；否則退回資料庫季節原價
function tsCostData(name) {
  const tc = (typeof window !== 'undefined' && window.SKYDATA && window.SKYDATA.tsCosts && window.SKYDATA.tsCosts[name]);
  if (tc && tc.items && tc.items.length) return { items: tc.items, totals: tc.totals || {}, real: true, est: !!tc.est };
  const sp = name ? spiritByName(name) : null;
  return { items: (sp && sp.items) || [], totals: (sp && sp.totals) || {}, real: false, est: false };
}
// 依資料狀態挑：警語、總花費標題
function tsCostMeta(d) {
  if (!d.real) return { note: TS_COST_NOTE, label: '季節原價總花費' };
  if (d.est) return { note: TS_EST_NOTE, label: '復刻估算總花費（待校正）' };
  return { note: TS_REAL_NOTE, label: '復刻實際總花費' };
}
function tsTreeHTML(name) {
  const d = name ? tsCostData(name) : null;
  if (!d || !d.items.length) return '';
  const ft = (typeof fmtTotals === 'function') ? fmtTotals : () => '';
  const legend = (typeof costLegendHTML === 'function') ? costLegendHTML() : '';
  const meta = tsCostMeta(d);
  return `<div class="kv"><span class="k">${meta.label}</span><span class="v">${ft(d.totals)}</span></div>
    <details class="wiki-card" style="margin-top:6px"><summary><b>🎁 兌換內容（${d.items.length} 項）· 點開</b></summary><div class="sp-body">${meta.note}${legend}${d.items.map(itemRowHTML).join('')}</div></details>`;
}
// 復刻先祖兌換內容（直接列出，給行事曆展開用，不再多一層收合）
function tsItemsInline(name) {
  const d = name ? tsCostData(name) : null;
  if (!d || !d.items.length) return '<p class="note">（此先祖無兌換資料）</p>';
  const ft = (typeof fmtTotals === 'function') ? fmtTotals : () => '';
  const legend = (typeof costLegendHTML === 'function') ? costLegendHTML() : '';
  const meta = tsCostMeta(d);
  return `<div class="kv"><span class="k">${meta.label}</span><span class="v">${ft(d.totals)}</span></div>${meta.note}${legend}<div class="dex-items">${d.items.map(itemRowHTML).join('')}</div>`;
}
// 地點文字（中文優先）："暮土 · 藏寶礁"
function locText(loc) {
  if (!loc) return '';
  const zh = n => (typeof window !== 'undefined' && window.SKYZH && window.SKYZH[n]) || n;
  return [loc.realm && zh(loc.realm), loc.area && zh(loc.area)].filter(Boolean).join(' · ');
}

/* ---------- 定時蠟燭點：饅頭（雨林團圓飯）/ 海膽（聖島污染噴泉）----------
 * 兩者皆每 2 小時、於「太平洋偶數整點」的固定分鐘出現，持續約 10 分鐘。
 * 海膽：偶數整點 :05 噴發；饅頭：偶數整點 :35 出現。每天各 12 次。
 */
const WAX_EVENTS = [
  { key: 'urchin', name: '海膽', char: '膽', emoji: '🦔', color: '#a371ff', realmZh: '雲野 · 聖島', pos: [-352.25, 206.25], img: 'img/area/prairie-sanctuary.webp', minute: 5, dur: 10, note: '聖島受污染的間歇泉，燒掉噴出的污染物可得大量燭光' },
  { key: 'bun', name: '饅頭', char: '饅', emoji: '🥟', color: '#ff9d42', realmZh: '雨林 · 團圓桌', pos: [-366.19, 117.44], img: 'img/area/forest-clearing.webp', minute: 35, dur: 10, note: '雨林「奶奶聚餐」長桌，點燃饅頭（餐點）可得大量燭光' },
];
// 下一次出現（太平洋偶數整點的第 minute 分），逐一以 skyWallToDate 計算，DST 正確
function nextWaxTime(minute, now) {
  const p = skyParts(now);
  for (let day = 0; day < 2; day++) {
    const d = addDays(p.year, p.month, p.day, day);
    for (let h = 0; h < 24; h += 2) {
      const t = skyWallToDate(d.y, d.mo, d.d, h, minute, 0);
      if (t.getTime() > now.getTime()) return t;
    }
  }
  return null;
}
function waxEventsInfo(now) {
  return WAX_EVENTS.map(w => {
    const next = nextWaxTime(w.minute, now);
    const prev = next ? new Date(next.getTime() - 2 * 3600 * 1000) : null;
    const activeUntil = (prev && now.getTime() < prev.getTime() + w.dur * 60000) ? prev.getTime() + w.dur * 60000 : null;
    return Object.assign({}, w, { next, activeUntil });
  });
}
// 總覽卡：饅頭/海膽 下次出現（台灣時間）+ 即時倒數
function waxSummaryHTML(now) {
  const list = waxEventsInfo(now);
  const rows = list.map(w => {
    const status = w.activeUntil
      ? `<span class="badge live">出現中</span> 結束 ${cd(w.activeUntil)}`
      : (w.next ? `<b>${fmtLocalTime(w.next)}</b> ${cd(w.next.getTime())}` : '—');
    return `<div class="kv"><span class="k">${w.emoji} ${w.name} <span class="muted">${w.realmZh}</span></span><span class="v">${status}</span></div>`;
  }).join('');
  return rows + `<p class="note">每 2 小時一次（台灣時間），持續約 10 分鐘，可得大量燭光。地圖分頁可看位置。</p>`;
}
// 今日跑圖建議（整合大蠟/任務/定時蠟燭/碎石/季節，順序為一般建議）
function dailyRouteHTML(now) {
  const p = skyParts(now);
  const wax = (typeof waxEventsInfo === 'function') ? waxEventsInfo(now) : [];
  const waxLine = wax.map(w => `${w.emoji}${w.name} ${w.activeUntil ? '出現中' : fmtLocalTime(w.next)}`).join('、');
  const s = SHARD.forDate(p.year, p.month, p.day);
  const shardLine = s.hasShard
    ? `${s.type === 'red' ? '🔴 紅石' : '⚫ 黑石'}　${s.realmZh.split(' ')[0]} · ${s.location[1]}　首次 ${fmtLocalTime(s.eruptions[0].start)}（台灣）`
    : '今日無碎石';
  const cur = currentSeason(now);
  const li = h => `<li style="margin:5px 0">${h}</li>`;
  return `<ol style="padding-left:20px;margin:6px 0;font-size:13.5px;line-height:1.6">
    ${li('<b>趁「每日之光」收大蠟</b>：剛上線右上 3 個箭頭最多、鍛造最便宜，先清大蠟。經典路線 雲野 → 雨林（聖島地熱噴泉、奶奶）→ 當日加成國度。<a class="wiki-link" data-tab-link="map">看大蠟地圖↗</a>')}
    ${li('<b>每日任務 ×4</b>：照上方「📋 每日任務」的地點順路做（每個 1 根蠟燭，季節期間給季節蠟燭）。')}
    ${li(`<b>卡定時蠟燭</b>：${waxLine || '—'}（順路去燒，一次量大）。`)}
    ${li(`<b>碎石</b>：${shardLine}（紅石給升華蠟燭、較值得特地去）。`)}
    ${cur ? li('<b>季節任務</b>：做當季 4 個季節任務＋領「當日領域」的季節蠟燭叢（季末作廢，每天記得清）。') : ''}
    ${li('<b>伊甸之眼</b>（每週日重置）：把光獻給沉淪雕像換升華蠟燭。')}
  </ol>
  <p class="note">順序為一般建議、非最佳化路徑；實際依你的進度與當天任務調整。</p>`;
}
function tsImgOn(dateStr) {
  const list = (typeof window !== 'undefined' && window.SKYDATA && window.SKYDATA.travelingSpirits) || [];
  for (const t of list) if (t.date === dateStr) return t.img || '';
  return '';
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

  // 定時蠟燭（饅頭/海膽）
  const ow = $('#ov-wax .card-body'); if (ow) ow.innerHTML = waxSummaryHTML(now);

  // 今日跑圖建議
  const orb = $('#ov-route-body'); if (orb) orb.innerHTML = dailyRouteHTML(now);

  // 每日任務參考卡
  renderQuests(now);
}

// 每日任務即時中譯（標題為 SkyHelper 英文、每天變動）。先套「完整句型模板」讓語序自然，未命中再退回逐詞詞庫。
// 詞庫：地點/物件/顏色（給 qLoc 翻譯句中片段用；長詞先放）
const QUEST_VOCAB = [
  [/Vault of Knowledge/gi, '禁閣'], [/Daylight Prairie/gi, '雲野'], [/Hidden Forest/gi, '雨林'],
  [/Valley of Triumph/gi, '霞谷'], [/Golden Wasteland/gi, '暮土'], [/Isle of Dawn/gi, '晨島'],
  [/Eye of Eden/gi, '伊甸之眼'], [/Aviary Village/gi, '鳥族村'],
  [/Ancestor['’]?s Table of Belonging/gi, '群擁季先祖長桌'], [/Table of Belonging/gi, '群擁季長桌'],
  [/Prairie Heights/gi, '雲頂'], [/Sanctuary Islands?/gi, '聖島'], [/Butterfly Fields?/gi, '蝴蝶原野'],
  [/Bird['’]?s? Nest/gi, '鳥巢'], [/Koi Pond/gi, '錦鯉池'], [/Vault Entrance/gi, '禁閣入口'],
  [/elevated clearing/gi, '高處空地'], [/Forest Clearing/gi, '雨林空地'], [/(?:big )?Tree[- ]?house/gi, '大樹屋'],
  [/Social Space/gi, '社交空間'], [/Spirit Mantas?/gi, '蝠鱝精靈'], [/\bMantas?\b/gi, '蝠鱝'],
  [/Flight Guide/gi, '飛行季嚮導'],
  [/Purple Light/gi, '紫光'], [/Green Light/gi, '綠光'], [/Blue Light/gi, '藍光'], [/Red Light/gi, '紅光'],
  [/Yellow Light/gi, '黃光'], [/Orange Light/gi, '橙光'], [/White Light/gi, '白光'],
  [/\bPrairie\b/gi, '雲野'], [/\bForest\b/gi, '雨林'], [/\bValley\b/gi, '霞谷'],
  [/\bWasteland\b/gi, '暮土'], [/\bVault\b/gi, '禁閣'], [/\bIsle\b/gi, '晨島'],
  [/\bcandles?\b/gi, '蠟燭'], [/\bdarkness\b/gi, '黑暗'], [/\bcave\b/gi, '洞穴'], [/\bshrine\b/gi, '神壇'],
  [/\bfriends?\b/gi, '朋友'], [/\bstrangers?\b/gi, '陌生人'], [/\bplayers?\b/gi, '玩家'], [/\bsomeone\b/gi, '某人'],
  [/\bTemple\b/gi, '神廟'], [/\bGuide\b/gi, '嚮導'], [/\bLight\b/gi, '光'],
  [/['’]s\b/g, ''], [/\b(?:the|a|an)\b/gi, ''],
];
// 翻譯句中地點/物件片段
function qLoc(s) {
  let out = (s || '').trim();
  for (const [re, zh] of QUEST_VOCAB) out = out.replace(re, zh);
  return out.replace(/\s+/g, '').trim() || (s || '').trim();
}
// 完整句型模板（語序自然）
const QUEST_TEMPLATES = [
  [/^Daily Quest Guide/i, () => '每日任務總覽圖'],
  [/^Catch (?:the )?(\d+) lights?(?: in (.+))?$/i, m => (m[2] ? '在' + qLoc(m[2]) : '') + '接 ' + m[1] + ' 個光'],
  [/^Catch the lights?(?: in (.+))?$/i, m => (m[1] ? '在' + qLoc(m[1]) : '') + '接光'],
  [/^Collect (\d+) (\w+) lights?(?: in (.+))?$/i, m => (m[3] ? '在' + qLoc(m[3]) : '') + '收集 ' + m[1] + ' 個' + qLoc(m[2] + ' Light')],
  [/^Melt (\d+) darkness/i, m => '融化 ' + m[1] + ' 處黑暗'],
  [/^Light (\d+) candles?/i, m => '點亮 ' + m[1] + ' 根蠟燭'],
  [/^Forge (\d+) candles?/i, m => '鍛造 ' + m[1] + ' 根蠟燭'],
  [/^Reli(?:ev|v)e (?:a )?spirit['’]?s memory(?: in (.+))?$/i, m => (m[1] ? '在' + qLoc(m[1]) : '') + '喚回一位先祖的記憶'],
  [/^Tidy up (.+?)(?: in (.+))?$/i, m => '整理' + qLoc(m[1]) + (m[2] ? '（' + qLoc(m[2]) + '）' : '')],
  [/^Propose a kite design(?: in (.+))?$/i, m => (m[1] ? '在' + qLoc(m[1]) : '') + '設計風箏'],
  [/^Meditat(?:e|ion)\b.*?(?:at|in|by|near) (.+)$/i, m => '在' + qLoc(m[1]) + '冥想'],
  [/^Meet up with (.+?)(?: in (.+))?$/i, m => (m[2] ? '在' + qLoc(m[2]) : '') + '與' + qLoc(m[1]) + '會合'],
  [/^Read a book together with (.+)$/i, m => '與' + qLoc(m[1]) + '一起讀書'],
  [/^Make (\d+) (?:new )?friends?/i, m => '結交 ' + m[1] + ' 位新朋友'],
  [/^Bow to (.+)$/i, m => '向' + qLoc(m[1]) + '鞠躬'],
  [/^Wave (?:to|at) (.+)$/i, m => '向' + qLoc(m[1]) + '揮手'],
  [/^Pay (?:your )?respects?(?: at| to)? (.+)$/i, m => '在' + qLoc(m[1]) + '致敬'],
  [/^Practice with (.+)$/i, m => '與' + qLoc(m[1]) + '練習'],
];
function qZh(s) {
  s = (s || '').replace(/\s*[-–]\s*video guide\s*$/i, '').replace(/\s*[-–]\s*$/i, '').trim();
  for (const [re, fn] of QUEST_TEMPLATES) { const m = s.match(re); if (m) return fn(m); }
  let out = s;
  for (const [re, zh] of QUEST_VOCAB) out = out.replace(re, zh);
  out = out.replace(/\bin\b/gi, '於').replace(/\bat\b/gi, '於');
  return out.replace(/\s*[-–]\s*/g, ' · ').replace(/\s{2,}/g, ' ').trim();
}

// 由任務英文標題偵測其所在「區域」(含世界座標+實景照)，用於顯示位置圖
let _AREA_IDX = null;
function areaIndex() {
  if (_AREA_IDX) return _AREA_IDX;
  _AREA_IDX = [];
  const S = (typeof window !== 'undefined' && window.SKYDATA) || {};
  (S.realms || []).forEach(r => (r.areaLocs || []).forEach(a => { if (a.pos) _AREA_IDX.push({ name: a.name, pos: a.pos, img: a.img, realm: r.name }); }));
  return _AREA_IDX;
}
const QUEST_AREA_ALIAS = [
  [/tree ?house/i, 'The Treehouse'], [/elevated clearing/i, 'Elevated Clearing'],
  [/prairie heights/i, 'Prairie Heights'], [/butterfly fields?/i, 'Butterfly Fields'],
  [/sanctuary islands?/i, 'Sanctuary Islands'], [/koi pond/i, 'Koi Pond'],
  [/table of belonging|ancestor.{0,3}s? table|belonging/i, 'Forest Clearing'],
  [/vault entrance/i, 'Vault Social Space'], [/wind paths?/i, 'The Wind Paths'],
  [/coliseum/i, 'The Coliseum'], [/citadel/i, 'The Citadel'], [/graveyard/i, 'The Graveyard'],
];
function detectQuestArea(en) {
  const idx = areaIndex();
  for (const [re, nm] of QUEST_AREA_ALIAS) { if (re.test(en)) { const a = idx.find(x => x.name === nm); if (a) return a; } }
  let best = null;
  idx.forEach(a => { const r = new RegExp('\\b' + a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'); if (r.test(en) && (!best || a.name.length > best.name.length)) best = a; });
  return best;
}
function questAreaLabel(a) {
  const zh = n => (typeof window !== 'undefined' && window.SKYZH && window.SKYZH[n]) || n;
  const zhStr = [zh(a.realm), zh(a.name)].filter(Boolean).join(' · ');
  const enStr = [a.realm, a.name].filter(Boolean).join(' · ');
  return zhStr + (enStr && enStr !== zhStr ? '（' + enStr + '）' : '');
}
// 國度索引（座標取自 realmShapes，實景照取自 realms）
let _REALM_IDX = null;
function realmIndex() {
  if (_REALM_IDX) return _REALM_IDX;
  _REALM_IDX = {};
  const S = (typeof window !== 'undefined' && window.SKYDATA) || {};
  const sp = {}; (S.realmShapes || []).forEach(s => { if (s.pos) sp[s.name] = s.pos; });
  (S.realms || []).forEach(r => { _REALM_IDX[r.name] = { name: r.name, pos: sp[r.name] || null, img: r.img || '' }; });
  return _REALM_IDX;
}
const QUEST_REALM_SHORT = { Prairie: 'Daylight Prairie', Forest: 'Hidden Forest', Valley: 'Valley of Triumph', Wasteland: 'Golden Wasteland', Vault: 'Vault of Knowledge', Isle: 'Isle of Dawn', Eden: 'Eye of Eden', Aviary: 'Aviary Village' };
// 偵測任務所屬國度（明確國度名 → 簡稱 → 隱含地點），回 {name,pos,img} 或 null
function detectQuestRealm(en) {
  const ri = realmIndex();
  for (const k in ri) { if (new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(en)) return ri[k]; }
  for (const w in QUEST_REALM_SHORT) { if (new RegExp('\\b' + w + '\\b', 'i').test(en)) return ri[QUEST_REALM_SHORT[w]]; }
  return null;
}
// 不限地點（社交/通用動作，所有區域皆可）的任務
const QUEST_ANYWHERE = /melt \d* ?darkness|light \d+ candles?|forge \d+ candles?|make \d+ (?:new )?friends?|bow (?:to|at)|wave (?:to|at)|give a hug|hug a|high[- ]?five|send (?:a )?gift|hold hands?/i;

// 今日任務即時資料（來源：SkyHelper API，CORS 開放、每日重置後更新）
let questState = { day: null, loaded: false, loading: false, error: false, data: null };
let questsRetry = null; // 來源尚未發布當日任務時，定時自動重抓直到拿到當日資料
// 判斷抓回的資料是否為「當日」（last_updated 的太平洋日期 >= 今天）
function questsFresh(data, dk) {
  if (!data || !data.last_updated) return true; // 無時間戳就不重試，避免空轉
  try { const p = skyParts(new Date(data.last_updated)); return `${p.year}-${pad(p.month)}-${pad(p.day)}` >= dk; }
  catch (e) { return true; }
}
function scheduleQuestsRetry() {
  if (questsRetry) return;
  questsRetry = setTimeout(() => { questsRetry = null; questState.loaded = false; questState.data = null; renderQuests(new Date()); }, 5 * 60 * 1000);
}
function clearQuestsRetry() { if (questsRetry) { clearTimeout(questsRetry); questsRetry = null; } }
function fetchQuests(dk) {
  if (questState.loading) return;
  questState.loading = true; questState.error = false;
  // 加時間戳 + no-store，避免瀏覽器回傳快取舊資料（否則來源更新了也抓不到，看似「沒自動更新」）
  fetch('https://api.skyhelper.xyz/update/quests?_=' + Date.now(), { cache: 'no-store' })
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(d => { questState = { day: dk, loaded: true, loading: false, error: false, data: d }; renderQuests(new Date()); })
    .catch(() => { questState.loading = false; questState.error = true; renderQuests(new Date()); });
}
// 今日蠟燭位置（尋寶蠟燭/大蠟 + 季節蠟燭），資料同來自 SkyHelper（每日輪換）。一進該國度入口即可見。
const REALM_ZH_MAP = [
  ['Golden Wasteland', '暮土'], ['Valley of Triumph', '霞谷'], ['Daylight Prairie', '雲野'],
  ['Hidden Forest', '雨林'], ['Vault of Knowledge', '禁閣'], ['Isle of Dawn', '晨島'],
  ['Aviary Village', '鳥族村'], ['Eye of Eden', '伊甸之眼'],
  ['Aviary', '鳥族村'], ['Prairie', '雲野'], ['Forest', '雨林'], ['Valley', '霞谷'],
  ['Wasteland', '暮土'], ['Vault', '禁閣'], ['Isle', '晨島']
];
function realmZhIn(str) { if (!str) return ''; for (const [en, zh] of REALM_ZH_MAP) { if (str.indexOf(en) >= 0) return zh + '（' + en + '）'; } return ''; }
function candleCard(label, emoji, obj) {
  if (!obj || !obj.title) return '';
  const realm = realmZhIn(obj.title);
  const en = (REALM_ZH_MAP.find(([e]) => obj.title.indexOf(e) >= 0) || [])[0] || '';
  const ri = en ? realmIndex()[en] : null;
  const rot = (obj.title.match(/Rotation\s*\d+/i) || [''])[0];
  const rotZh = rot ? '・第' + rot.replace(/Rotation\s*/i, '') + '輪' : '';
  const img = obj.images && obj.images[0] && obj.images[0].url;
  const pin = (ri && ri.pos) ? `<div class="shard-map-wrap"><p class="note" style="margin:0 0 4px">📍 在哪個國度：</p>${posMiniMap(ri.pos, realm, ri.img)}</div>` : '';
  const detail = img ? `<div class="shard-photo-wrap"><p class="note" style="margin:0 0 4px">🗺️ 國度內位置圖：</p>${imgThumb(img, label + ' ' + (realm || ''), 'shard-photo')}</div>` : '';
  const media = (pin || detail) ? `<div class="shard-media q-media" style="margin-top:6px">${pin}${detail}</div>` : '<p class="note">（來源暫無圖，請以遊戲內為準）</p>';
  return `<details class="q-loc"><summary>${emoji} ${escapeHtml(label)}：<b>${escapeHtml(realm || obj.title)}</b>${rotZh}　<span class="muted">· 看位置</span></summary>${media}</details>`;
}
function dailyCandlesHTML() {
  const d = questState.data; if (!d) return '';
  const t = candleCard('每日尋寶蠟燭（大蠟·輪換）', '🕯️', d.rotating_candles);
  const s = candleCard('季節蠟燭', '🌙', d.seasonal_candles);
  if (!t && !s) return '';
  return `<div class="candle-today">${t}${s}<p class="note" style="margin:6px 0 0">這是<b>每日輪換</b>的尋寶蠟燭（共 4 根：該國度入口 1 根＋散落 3 根），每天換國度與位置。<br>另有 <b>35 根「永久」尋寶蠟燭</b>固定不變、每天都能撿，路線在「地圖」分頁的<b>永久尋寶蠟燭</b>。</p></div>`;
}
// 主畫面「今日蠟燭」卡內容（含載入/錯誤狀態）
function ovCandleHTML() {
  if (!questState.loaded || !questState.data) return questState.error ? '<p class="note">暫時無法取得（離線或來源失敗）</p>' : '<p class="muted">載入中…</p>';
  return dailyCandlesHTML() || '<p class="note">來源暫無今日蠟燭資料，請以遊戲內為準。</p>';
}
// 永久尋寶蠟燭（35 根固定路線，資料 window.PERM_CANDLES 來自 Wiki，靜態只渲染一次）
function renderPermCandles() {
  const box = $('#perm-candles-body'); if (!box || box.dataset.done) return;
  const data = (typeof window !== 'undefined' && window.PERM_CANDLES) || [];
  if (!data.length) { box.innerHTML = '<p class="note">永久蠟燭資料載入失敗，請重新整理。</p>'; return; }
  const ri = realmIndex();
  const got = (typeof collGot === 'function') ? collGot('perm_got') : {};
  let totG = 0, totN = 0;
  const realmsHtml = data.map(r => {
    const rl = ri[r.realm];
    const pin = (rl && rl.pos) ? `<div class="shard-map-wrap"><p class="note" style="margin:0 0 4px">📍 ${escapeHtml(r.realmZh)}在世界地圖：</p>${posMiniMap(rl.pos, r.realmZh, rl.img)}</div>` : '';
    let rg = 0;
    const items = r.candles.map((c, i) => {
      const id = r.realm + '#' + i, on = !!got[id];
      if (on) { rg++; totG++; } totN++;
      return `<div class="perm-c coll-row${on ? ' got' : ''}">
        <div class="perm-c-h"><input type="checkbox" class="coll-check" data-coll="perm_got" data-id="${escapeHtml(id)}" ${on ? 'checked' : ''} aria-label="標記已撿" /> <span class="perm-c-n">${escapeHtml(c.n)}</span> <b>${escapeHtml(c.areaZh)}</b> <span class="muted">${escapeHtml(c.area)}</span></div>
        <p class="note" style="margin:2px 0 4px">${escapeHtml(c.desc)}</p>
        ${imgThumb(c.img, r.realmZh + ' · ' + c.areaZh, 'shard-photo')}
      </div>`;
    }).join('');
    return `<details class="wiki-card" style="margin-bottom:8px"><summary><b>${escapeHtml(r.realmZh)}</b> <span class="muted">${escapeHtml(r.realm)}</span> <span class="badge none coll-prog">${rg}/${r.candles.length}</span></summary>
      <div class="sp-body">${pin}<div class="perm-list">${items}</div></div></details>`;
  }).join('');
  box.innerHTML = `<p class="note">這 35 根<b>固定不變</b>、每天都能撿，是穩定刷燭光的路線（晨島最多 15 根；暮土沒有永久蠟燭）。打勾記錄已撿，已撿 <b data-colltotal="perm_got">${totG}/${totN}</b>。圖與位置取自 Sky Wiki。</p>${realmsHtml}`;
  box.dataset.done = '1';
  if (typeof bindCollChecks === 'function') bindCollChecks($('#perm-candles'));
}
// 雙倍燭光活動（不定期，官方公告制）。手動維護已知場次；日期為太平洋日，每場約持續一週。
const DOUBLE_EVENTS = [
  { start: '2025-12-31', end: '2026-01-15', note: '雙倍尋寶燭光🕯️ ＋ 雙倍愛心❤️' },
  { start: '2026-02-27', end: '2026-03-12', note: '雙倍季節蠟燭🌙 ＋ 雙倍尋寶蠟燭🕯️' }
];
function doubleEventHTML(now) {
  const p = skyParts(now), dk = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  const active = DOUBLE_EVENTS.find(e => dk >= e.start && dk <= e.end);
  if (active) return `<div class="dbl-banner on">✨ <b>雙倍燭光活動進行中！</b> ${active.note} <span class="muted">· 至 ${active.end}（太平洋）</span></div>`;
  const next = DOUBLE_EVENTS.filter(e => e.start > dk).sort((a, b) => a.start < b.start ? -1 : 1)[0];
  const nextLine = next ? `下一場 <b>${next.start}</b>：${next.note}` : '目前查無已公告的下一場（不定期，無固定排程）。';
  return `<details class="dbl-banner"><summary>✨ 雙倍燭光活動：目前無進行中　<span class="muted">· 點看說明</span></summary>
    <div class="sp-body"><p class="note">「雙倍日」是官方<b>不定期公告</b>的活動（每場約一週），會雙倍<b>季節蠟燭🌙／尋寶蠟燭🕯️／愛心❤️</b>其中幾項，常搭季節或特殊活動。${nextLine}<br>以官方公告為準：<a class="wiki-link" href="https://sky-children-of-the-light.fandom.com/wiki/Double_Currency_Events" target="_blank" rel="noopener">雙倍活動列表 ↗</a></p></div></details>`;
}
function renderQuests(now) {
  const box = $('#ov-quests .card-body');
  if (!box) return;
  const dq = (typeof window !== 'undefined' && window.SKYDATA && window.SKYDATA.dailyQuests) || null;
  const p = skyParts(now);
  const dk = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  const daily = nextDailyReset(now);
  const localT = daily.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
  const resetLine = `<div class="kv"><span class="k">重置</span><span class="v">${cd(daily.getTime())} <span class="muted">· 太平洋 00:00（你的 ${localT}）</span></span></div>`;

  if (questState.loaded && questState.day !== dk) { questState.loaded = false; questState.data = null; } // 跨日重抓
  let questsHtml;
  if (questState.loaded && questState.data && Array.isArray(questState.data.quests)) {
    const qs = questState.data.quests.filter(q => q && ((q.images && q.images.length) || q.title));
    const upd = (questState.data.last_updated || '').slice(0, 10);
    const questRow = (q, i, withCheck, done) => {
      const en = (q.title || '').replace(/\s*[-–]\s*video guide\s*$/i, '').replace(/\s*[-–]\s*$/, '').trim();
      const zh = escapeHtml(qZh(en) || ('任務 ' + (i + 1)));
      const media = q.images && q.images[0] && q.images[0].url;
      const isVid = media && /\.(mov|mp4|webm)(\?|$)/i.test(media); // 有些任務附的是影片，不能當 <img>
      // 由文字偵測地點 → 每項任務都標地點：明確區域 → 隱含國度 → 不限地點
      // 預設只顯示一行「📍 地點」，點開才看實景照＋地圖（避免卡片太長）
      const mediaBlock = (label, img, pos) => `<details class="q-loc"><summary>📍 ${escapeHtml(label)}　<span class="muted">· 看地點圖</span></summary>
          <div class="shard-media q-media">
            ${img ? `<div class="shard-photo-wrap">${imgThumb(img, label, 'shard-photo')}</div>` : ''}
            <div class="shard-map-wrap">${posMiniMap(pos, label, img)}</div>
          </div></details>`;
      const zhName = n => (typeof window !== 'undefined' && window.SKYZH && window.SKYZH[n]) || n;
      let locMedia = '';
      const area = detectQuestArea(en);
      if (area && area.pos) {
        locMedia = mediaBlock(questAreaLabel(area), area.img, area.pos);
      } else {
        const realm = detectQuestRealm(en);
        if (realm && realm.pos) {
          const rl = zhName(realm.name) + '（' + realm.name + '）';
          locMedia = mediaBlock(rl, realm.img, realm.pos);
        } else if (QUEST_ANYWHERE.test(en)) {
          locMedia = `<p class="note" style="margin:2px 0 4px 28px">📍 不限地點（任何地方都可完成）</p>`;
        } else {
          locMedia = `<p class="note" style="margin:2px 0 4px 28px">📍 所有區域皆可（此任務不限定地點；如有攻略圖/影片可參考最省路線）</p>`;
        }
      }
      return `<div class="q-item">
        <div class="wl-row">
          ${withCheck ? `<input type="checkbox" class="q-check" data-q="${i}" ${done[i] ? 'checked' : ''} />` : ''}
          <span class="wl-info" title="${escapeHtml(en)}">${zh}${isVid ? ` <a class="wiki-link" href="${escapeHtml(media)}" target="_blank" rel="noopener">🎬 影片攻略↗</a>` : ''}</span>
          ${media && !isVid ? `<img class="wl-thumb" src="${escapeHtml(media)}" data-full="${escapeHtml(media)}" data-cap="${zh}" loading="lazy" referrerpolicy="no-referrer" alt="任務攻略圖" onerror="this.style.display='none'" />` : ''}
        </div>
        ${locMedia}
      </div>`;
    };
    // 其他來源對照連結（SkyHelper 慢/不全時可一鍵去別家看）
    const altLinks = '<p class="note" style="margin-top:8px">其他來源對照：<a class="wiki-link" href="https://thatskyapplication.com/daily-guides" target="_blank" rel="noopener">That Sky App ↗</a>　<a class="wiki-link" href="https://sky.dominicwild.com/" target="_blank" rel="noopener">dominicwild ↗</a>　<a class="wiki-link" href="https://sky-children-of-the-light.fandom.com/wiki/Quests" target="_blank" rel="noopener">Wiki ↗</a></p>';
    if (questsFresh(questState.data, dk)) {
      // 「Daily Quest Guide」是 SkyHelper 附的「玩法圖解」(教某類任務怎麼做)，不一定是 4 任務總覽，
      // 也不保證完整 → 老實標成「任務圖解」，不宣稱完整。實際任務以文字列 + 遊戲內為準。
      const isGuide = q => /daily quest guide/i.test(q.title || '');
      const guideImg = (qs.find(q => isGuide(q) && q.images && q.images[0] && q.images[0].url) || {}).images;
      const tasks = qs.filter(q => !isGuide(q));
      if (tasks.length >= 4) clearQuestsRetry(); else scheduleQuestsRetry(); // 不足 4 個＝來源還在補，續抓
      const done = Store.get('quests_' + dk, {});
      const cnt = tasks.filter((q, i) => done[i]).length;
      const rows = tasks.map((q, i) => questRow(q, i, true, done)).join('');
      const gUrl = guideImg && guideImg[0] && guideImg[0].url;
      const guideHtml = gUrl ? `<p class="note" style="margin:8px 0 4px">📋 任務玩法圖解（SkyHelper 提供，點看大圖）</p><img class="wl-thumb shard-photo" src="${escapeHtml(gUrl)}" data-full="${escapeHtml(gUrl)}" data-cap="任務玩法圖解" loading="lazy" referrerpolicy="no-referrer" alt="任務玩法圖解" onerror="this.style.display='none'" />` : '';
      const partial = tasks.length < 4 ? `<p class="note">ℹ️ SkyHelper 今日只收錄到 ${tasks.length} 個任務（完整有 4 個），第 ${tasks.length + 1}~4 個它還沒補。<b>完整當日任務請以遊戲內（家的返回神像／地圖神像黃色圖示）為準</b>，或點下方其他來源對照。頁面會自動補抓。</p>` : '';
      questsHtml = `<div class="q-prog">📝 今日任務 ${cnt}/${tasks.length}${tasks.length < 4 ? '（來源僅收錄此數）' : ''}　<span class="muted">更新 ${escapeHtml(upd)}</span></div>${rows}${partial}${guideHtml}${altLinks}`;
    } else {
      scheduleQuestsRetry(); // 來源還沒發布今日任務，定時自動重抓，發布後自動換上
      const prev = qs.map((q, i) => questRow(q, i, false)).join('');
      questsHtml = `<p class="note">⏳ 今日（${dk}）任務尚未由來源（SkyHelper）發布（剛過重置）。每 5 分鐘自動重抓，發布後會自動顯示，<b>不用手動刷新</b>。可先到其他來源看：</p>${altLinks}
        <details><summary class="muted" style="cursor:pointer">上一日任務（更新 ${escapeHtml(upd)}，僅供參考）</summary><div style="margin-top:6px">${prev}</div></details>`;
    }
  } else if (questState.error) {
    questsHtml = `<p class="note">⚠️ 暫時無法取得今日任務（離線或來源連線失敗）。可改用 <a class="wiki-link" href="https://sky.dominicwild.com/" target="_blank" rel="noopener">社群追蹤器 ↗</a>。</p>`;
  } else {
    questsHtml = `<p class="muted">載入今日任務中…</p>`;
    fetchQuests(dk);
  }

  const claimHtml = dq ? dq.claim.map(c =>
    `<div class="q-claim"><img class="wl-thumb" src="${escapeHtml(c.img)}" data-full="${escapeHtml(c.img)}" data-cap="${escapeHtml(c.place + '：' + c.desc)}" loading="lazy" alt="${escapeHtml(c.place)}" onerror="this.style.display='none'" /><div><b>${escapeHtml(c.place)}</b><br><span class="muted">${escapeHtml(c.desc)}</span></div></div>`).join('') : '';

  box.innerHTML = resetLine + questsHtml +
    `<p class="note">領取地點（固定）：</p><div class="q-claims">${claimHtml}</div>` +
    `<p class="note">今日任務來源：SkyHelper（每日重置後更新）；點任務圖看大圖。</p>`;

  // 主畫面：雙倍活動橫幅 + 今日蠟燭卡（資料同一份 questState，故在此一併更新）
  const dbl = $('#ov-double'); if (dbl) dbl.innerHTML = doubleEventHTML(now);
  const cb = $('#ov-candle .card-body'); if (cb) cb.innerHTML = ovCandleHTML();

  $$('#ov-quests input[data-q]').forEach(inp => inp.addEventListener('change', () => {
    const d = Store.get('quests_' + dk, {}); d[inp.dataset.q] = inp.checked; Store.set('quests_' + dk, d);
    const prog = $('#ov-quests .q-prog'); const all = $$('#ov-quests input[data-q]');
    if (prog) prog.innerHTML = prog.innerHTML.replace(/\d+\/\d+/, all.filter(x => x.checked).length + '/' + all.length);
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
      const lname = sd.realmZh.split(' ')[0] + ' · ' + sd.location[1];
      rows += `<details class="shard-day-x"><summary class="shard-day">
        <span class="d-date">${pad(c.mo)}/${pad(c.d)} 週${wd}</span>
        <span class="d-loc">${badge} ${lname}</span>
        <span class="muted" title="Sky ${fmtSkyTime(sd.eruptions[0].start)}（太平洋）">${fmtLocalTime(sd.eruptions[0].start)}</span></summary>
        <div class="shard-media" style="padding:8px 4px 2px">
          <div class="shard-photo-wrap">${imgThumb(shardImg(sd.location[0]), lname, 'shard-photo')}</div>
          <div class="shard-map-wrap"><p class="note" style="margin:0 0 4px">📍 確切位置：</p>${shardMiniMap(sd.location[0], lname)}</div>
        </div></details>`;
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
      <span class="when">第 ${i + 1} 場　<b>${fmtLocal(e.start)}</b>（台灣）　<span class="muted">· Sky ${fmtSkyTime(e.start)}</span></span>
      <span>${status}</span></div>`;
  });
  return `${badge}
    <div class="shard-media">
      <div class="shard-photo-wrap">${imgThumb(shardImg(s.location[0]), s.realmZh.split(' ')[0] + ' · ' + s.location[1], 'shard-photo')}</div>
      <div class="shard-map-wrap"><p class="note" style="margin:0 0 4px">📍 確切位置：</p>${shardMiniMap(s.location[0], s.realmZh.split(' ')[0] + ' · ' + s.location[1])}</div>
    </div>
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
    const loc = who ? spLoc(who) : null;
    statusHTML = `<span class="badge live">先祖在場中</span> ${who ? '· ' + nm(who) : ''}
      ${who ? `<div class="ts-portrait-wrap">${imgThumb(tsImgOn(dateKey(cur.cal)), who, 'shard-photo')}</div>` : ''}
      <div class="kv"><span class="k">本次到達</span><span class="v">${dateKey(cur.cal)}（週${WD_ZH[skyWeekday(cur.cal.y, cur.cal.mo, cur.cal.d)]}）</span></div>
      <div class="kv"><span class="k">離開倒數</span><span class="v big">${cd(cur.departInst.getTime())}</span></div>
      ${loc && loc.pos ? `<div class="kv"><span class="k">原所在</span><span class="v">${escapeHtml(locText(loc))}</span></div>
        <p class="note" style="margin:6px 0 4px">📍 此先祖原本所在地點（復刻先祖本身每場都在固定的「復刻先祖」傳送點現身；點照片看大圖、點地圖可放大）：</p>
        <div class="shard-media">
          ${loc.img ? `<div class="shard-photo-wrap">${imgThumb(loc.img, locText(loc), 'shard-photo')}</div>` : ''}
          <div class="shard-map-wrap">${posMiniMap(loc.pos, locText(loc), loc.img)}</div>
        </div>` : ''}
      ${tsTreeHTML(who)}`;
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
    const badge = live ? '<span class="badge live">在場</span>' : past ? '<span class="badge none">已過</span>' : '<span class="badge black">即將</span>';
    if (who) {
      // 已知先祖 → 可展開看兌換物品
      list += `<details class="shard-day-x ts-cal">
        <summary class="shard-day">
          <span class="d-date">${dateKey(t.cal)} ~ ${pad(dep.mo)}/${pad(dep.d)}</span>
          <span class="d-loc">${badge} ${nm(who)}</span>
          ${imgThumb(tsImgOn(dateKey(t.cal)), who, 'ts-portrait')}</summary>
        <div style="padding:6px 4px 2px">${tsItemsInline(who)}</div>
      </details>`;
    } else {
      list += `<div class="shard-day">
        <span class="d-date">${dateKey(t.cal)} ~ ${pad(dep.mo)}/${pad(dep.d)}</span>
        <span class="d-loc">${badge} <span class="muted">（待官方公布）</span></span></div>`;
    }
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
  Store.set('last_tab', name); // 記住上次分頁
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
  if (name === 'map') { renderMap(); renderPermCandles(); }
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
  // 饅頭/海膽 出現或結束時也翻頁刷新總覽卡
  if (typeof waxEventsInfo === 'function') {
    waxEventsInfo(now).forEach(w => {
      if (w.next && w.next.getTime() > now.getTime()) next = Math.min(next, w.next.getTime());
      if (w.activeUntil && w.activeUntil > now.getTime()) next = Math.min(next, w.activeUntil);
    });
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
  const mlb = $('#map-lightbox');
  const closeMapLb = () => { if (mlb) mlb.classList.remove('open'); };
  document.addEventListener('click', e => {
    // 內部分頁連結（如「看大蠟地圖」）
    const tl = e.target.closest && e.target.closest('[data-tab-link]');
    if (tl && tl.dataset.tabLink) { e.preventDefault(); showTab(tl.dataset.tabLink); window.scrollTo(0, 0); return; }
    // 小地圖紅點 → 開全螢幕可縮放地圖
    const mapEl = e.target.closest && e.target.closest('[data-mappos]');
    if (mapEl && mapEl.dataset.mappos) {
      const pos = mapEl.dataset.mappos.split(',').map(Number);
      openMapZoom(pos, mapEl.dataset.mapcap || '', mapEl.dataset.mapimg || '');
      return;
    }
    // 放大地圖開啟時：點地圖與縮放鈕（皆在 .wl-map-wrap 內）不關，點外圍背景或 ✕ 才關
    if (mlb && mlb.classList.contains('open')) {
      if (!(e.target.closest && e.target.closest('.wl-map-wrap')) || (e.target.closest && e.target.closest('.ml-close'))) {
        closeMapLb(); return;
      }
    }
    // 大蠟路線圖等大圖 → 開可縮放檢視
    const iz = e.target.closest && e.target.closest('[data-imgzoom]');
    if (iz && iz.dataset.imgzoom) { openImageZoom(iz.dataset.imgzoom, iz.dataset.cap || ''); return; }
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
    if (e.key !== 'Escape') return;
    if (mlb && mlb.classList.contains('open')) { closeMapLb(); return; }
    if (lb.classList.contains('open')) { lb.classList.remove('open'); lbImg.removeAttribute('src'); }
  });
  bindSettings();
  reRenderDay(new Date());
  // 還原上次分頁
  const VALID_TABS = ['overview', 'shards', 'spirits', 'candles', 'dex', 'map', 'wiki', 'settings'];
  const lastTab = Store.get('last_tab', 'overview');
  if (lastTab && lastTab !== 'overview' && VALID_TABS.indexOf(lastTab) >= 0) showTab(lastTab);
  setInterval(tick, 1000);
}

document.addEventListener('DOMContentLoaded', init);
