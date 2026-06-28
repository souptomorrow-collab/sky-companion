/* auth.js — Firebase 帳號登入 + 雲端同步（每個本機帳號各自一份雲端文件）+ 唯讀分享連結
 * 沒設定 firebase-config.js 時自動停用，不影響其他功能。
 *
 * 資料模型（Firestore）：
 *   users/{uid}            = { index: [{cloudId, name}], updated }   你的私人索引（只有你可讀寫）
 *   profiles/{cloudId}     = { owner: uid, name, data:{appkey:值}, updated }
 *                            擁有者可寫；知道 cloudId（分享連結）的人可唯讀；禁止列舉。
 * 同步：文件層級「較新者勝」。每個帳號各自比對 updated 與本機 sky___sync_<cloudId>。
 * 分享：把某帳號的 cloudId 包成 #share=<cloudId> 連結；對方開連結 → 唯讀載入成本機帳號（不回推）。
 */
(function () {
  const cfg = (typeof window !== 'undefined' && window.FIREBASE_CONFIG) || null;
  const ready = cfg && cfg.apiKey && !/PASTE|YOUR_/.test(cfg.apiKey);
  window.SkySync = {
    ready: !!ready,
    user: () => null,
    shareCurrentProfile: () => Promise.reject(new Error('帳號同步未啟用')),
  };

  const box = () => document.getElementById('account-box');
  const setUI = html => { const b = box(); if (b) b.innerHTML = html; };
  const status = t => { const e = document.getElementById('acc-status'); if (e) e.textContent = t; };
  const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const time = () => new Date().toLocaleTimeString('zh-TW');
  const debounce = (fn, ms) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };

  if (!ready) {
    document.addEventListener('DOMContentLoaded', () => setUI(
      '<p class="muted">帳號同步未啟用。</p><p class="note">在 <b>firebase-config.js</b> 填入 Firebase 設定即可啟用 Google 登入＋每帳號雲端同步＋分享。</p>'));
    return;
  }

  const V = '10.12.5';
  const SDK = [
    `https://www.gstatic.com/firebasejs/${V}/firebase-app-compat.js`,
    `https://www.gstatic.com/firebasejs/${V}/firebase-auth-compat.js`,
    `https://www.gstatic.com/firebasejs/${V}/firebase-firestore-compat.js`,
  ];
  document.addEventListener('DOMContentLoaded', () => {
    setUI('<p class="muted">帳號模組載入中…</p>');
    loadSeq(SDK, init, () => setUI('<p class="muted">Firebase 載入失敗（離線？）。其他功能不受影響。</p>'));
  });
  function loadSeq(list, done, fail) {
    let i = 0;
    (function next() {
      if (i >= list.length) return done();
      const s = document.createElement('script');
      s.src = list[i++]; s.onload = next; s.onerror = fail;
      document.head.appendChild(s);
    })();
  }

  // ---- 同步時戳（每帳號一個；存在全域 meta，不分帳號、不被遷移）----
  const tsKey = cloudId => 'sky___sync_' + cloudId;
  const getSyncTs = cloudId => +(localStorage.getItem(tsKey(cloudId)) || 0);
  const setSyncTs = (cloudId, ms) => { try { localStorage.setItem(tsKey(cloudId), String(ms || Date.now())); } catch (e) {} };

  let DB = null, AUTH = null;

  function init() {
    try { firebase.initializeApp(cfg); } catch (e) { setUI('<p class="muted">設定有誤：' + esc(e.message) + '</p>'); return; }
    AUTH = firebase.auth(); DB = firebase.firestore();
    window.SkySync.user = () => AUTH.currentUser;
    window.SkySync.shareCurrentProfile = shareCurrent;
    // 先處理分享連結（不需登入即可唯讀載入）
    handleShareLink();
    AUTH.onAuthStateChanged(u => {
      const uid = u ? u.uid : '';
      // 換 Google 帳號（或登入/登出）→ 切換顯示分區，重新載入讓 Profiles 以新 uid 過濾
      if ((localStorage.getItem('sky__uid') || '') !== uid) {
        localStorage.setItem('sky__uid', uid);
        location.reload();
        return;
      }
      u ? signedIn(u) : signedOut();
    });
  }

  function signedOut() {
    setUI('<button class="btn" id="acc-login">以 Google 登入</button>'
      + '<p class="note">登入後，你的每個帳號各自雲端備份、跨裝置雙向同步；也能用「🔗 分享」把某帳號唯讀分享給朋友。</p>');
    const b = document.getElementById('acc-login');
    if (b) b.onclick = () => AUTH.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => alert('登入失敗：' + e.message));
    window.__onStoreChange = null; // 登出後不再自動上推
  }

  function signedIn(user) {
    setUI(`<div class="kv"><span class="k">已登入</span><span class="v">${esc(user.displayName || user.email || '')}</span></div>
      <div class="row"><button class="btn" id="acc-sync">立即同步</button><button class="btn danger" id="acc-out">登出</button></div>
      <p class="note" id="acc-status">同步中…</p>`);
    document.getElementById('acc-out').onclick = () => AUTH.signOut();
    document.getElementById('acc-sync').onclick = () => { status('同步中…'); fullSync(user); };
    window.__onStoreChange = debounce(() => pushCurrent(user), 1500);
    fullSync(user);
  }

  // 推「目前帳號」到自己的雲端文件（唯讀分享來的帳號不上推）
  function pushCurrent(user) {
    const pid = Profiles.currentId();
    if (!pid || Profiles.isRO(pid)) return Promise.resolve();
    return pushProfile(user, pid).then(() => upsertIndex(user)).then(() => status('已同步 · ' + time())).catch(e => status('同步失敗：' + e.message));
  }

  function pushProfile(user, pid) {
    const cloudId = Profiles.ensureCloud(pid);
    const p = Profiles.get(pid);
    const ref = DB.collection('profiles').doc(cloudId);
    return ref.set({ owner: user.uid, name: p.name, data: Profiles.dataOf(pid), updated: firebase.firestore.FieldValue.serverTimestamp() })
      .then(() => ref.get())
      .then(doc => { const u = doc.data() && doc.data().updated; setSyncTs(cloudId, u && u.toMillis ? u.toMillis() : Date.now()); });
  }

  // 把本機（非唯讀）帳號清單寫進索引
  function upsertIndex(user) {
    const index = Profiles.list().filter(p => !p.ro && p.cloudId).map(p => ({ cloudId: p.cloudId, name: p.name }));
    return DB.collection('users').doc(user.uid).set({ index, updated: firebase.firestore.FieldValue.serverTimestamp() });
  }

  // 登入時完整同步：拉我的索引→（依雲端 owner 修正誤認/汙染）建/拉屬於我的帳號；推我獨有；重寫索引（自我修復）
  function fullSync(user) {
    let curChanged = false;
    const curId = Profiles.currentId();
    DB.collection('users').doc(user.uid).get().then(doc => {
      const index = (doc.exists && doc.data().index) || [];
      const tasks = index.map(e => {
        return DB.collection('profiles').doc(e.cloudId).get().then(pd => {
          if (!pd.exists) return;
          const d = pd.data();
          const localP = Profiles.findByCloud(e.cloudId);
          // 雲端文件不是我的（索引被汙染）→ 把本機這份的擁有者修正為真正 owner，使其不再顯示在我底下
          if (d.owner && d.owner !== user.uid) { if (localP) Profiles.setOwner(localP.id, d.owner); return; }
          // 是我的：確保本機有、歸我、拉較新
          const lid = localP ? localP.id : Profiles.addRemote(e.name, e.cloudId, false);
          Profiles.setOwner(lid, user.uid);
          const rMs = d.updated && d.updated.toMillis ? d.updated.toMillis() : 0;
          if (rMs > getSyncTs(e.cloudId) && d.data) {
            Profiles.writeDataTo(lid, d.data);
            if (d.name) Profiles.setMeta(lid, { name: d.name });
            setSyncTs(e.cloudId, rMs);
            if (lid === curId) curChanged = true;
          }
        }).catch(() => {});
      });
      return Promise.all(tasks);
    }).then(() => {
      Profiles.ensureCurrent(); // 確保我這邊至少有一個帳號 + 有效的目前帳號
      if (Profiles.currentId() !== curId) curChanged = true; // 目前帳號被修正掉 → 需重整
      // 推「我的、雲端還沒有或沒同步過」的帳號
      const pushes = Profiles.list().filter(p => !p.ro && (!p.cloudId || getSyncTs(p.cloudId) === 0)).map(p => pushProfile(user, p.id));
      return Promise.all(pushes);
    }).then(() => upsertIndex(user))   // index 由「我可見的帳號」重寫 → 自動移除被汙染的別人帳號
      .then(() => refreshShared())
      .then(() => {
        if (curChanged) { status('已從雲端更新，重整中…'); setTimeout(() => location.reload(), 700); }
        else status('已同步 · ' + time());
      })
      .catch(e => status('同步失敗：' + e.message));
  }

  // 刷新所有「唯讀分享」帳號（讀對方雲端文件，更新本機快照；不影響目前頁面除非是當前帳號）
  function refreshShared() {
    const curId = Profiles.currentId();
    const ros = Profiles.list().filter(p => p.ro && p.cloudId);
    return Promise.all(ros.map(p => DB.collection('profiles').doc(p.cloudId).get().then(doc => {
      if (!doc.exists) return;
      const d = doc.data();
      if (d.data) { Profiles.writeDataTo(p.id, d.data); if (d.name) Profiles.setMeta(p.id, { name: d.name + '（分享）' }); }
    }).catch(() => {})));
  }

  // 分享目前帳號：確保有 cloudId 並上推，回傳分享連結
  function shareCurrent() {
    const user = AUTH && AUTH.currentUser;
    if (!user) return Promise.reject(new Error('請先以 Google 登入才能分享'));
    const pid = Profiles.currentId();
    if (Profiles.isRO(pid)) return Promise.reject(new Error('這是別人分享的帳號，無法再分享'));
    return pushProfile(user, pid).then(() => upsertIndex(user)).then(() => {
      const cloudId = Profiles.cloudIdOf(pid);
      return location.origin + location.pathname + '#share=' + cloudId;
    });
  }

  // 開啟分享連結 #share=<cloudId> → 唯讀載入成本機帳號
  function handleShareLink() {
    const m = /[#&]share=([a-z0-9]+)/i.exec(location.hash || '');
    if (!m) return;
    const cloudId = m[1];
    DB.collection('profiles').doc(cloudId).get().then(doc => {
      if (!doc.exists) { alert('找不到這個分享（可能已被刪除）。'); clearHash(); return; }
      const d = doc.data();
      const existing = Profiles.findByCloud(cloudId);
      const id = existing ? existing.id : Profiles.addRemote((d.name || '帳號') + '（分享）', cloudId, true);
      if (existing && !existing.ro) Profiles.setMeta(id, { ro: true });
      if (d.data) Profiles.writeDataTo(id, d.data);
      Profiles.switch(id);
      clearHash();
      alert('已載入分享的帳號「' + (d.name || '') + '」（唯讀）。可在「設定 → 帳號」切換回自己的帳號。');
      location.reload();
    }).catch(e => { alert('載入分享失敗：' + e.message); clearHash(); });
  }
  function clearHash() { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; } }
})();
