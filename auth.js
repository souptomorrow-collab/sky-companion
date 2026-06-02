/* auth.js — Firebase 帳號登入 + 雲端同步（同步所有 sky_ 開頭的本機資料）
 * 沒設定 firebase-config.js 時自動停用，不影響其他功能。
 * 同步策略：文件層級「較新者勝」。登入時比對雲端 updated 與本機上次同步時間，
 * 雲端較新→拉下覆蓋本機並重整；否則把本機推上雲端。之後資料變更會自動推送。
 */
(function () {
  const box = () => document.getElementById('account-box');
  const setUI = html => { const b = box(); if (b) b.innerHTML = html; };
  const cfg = (typeof window !== 'undefined' && window.FIREBASE_CONFIG) || null;
  const ready = cfg && cfg.apiKey && !/PASTE|YOUR_/.test(cfg.apiKey);

  if (!ready) {
    document.addEventListener('DOMContentLoaded', () => setUI(
      '<p class="muted">帳號同步未啟用。</p><p class="note">在 <b>firebase-config.js</b> 填入你的 Firebase 設定即可啟用 Google 登入＋跨裝置雲端同步（步驟見該檔註解）。</p>'));
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

  function init() {
    try { firebase.initializeApp(cfg); } catch (e) { setUI('<p class="muted">設定有誤：' + e.message + '</p>'); return; }
    const auth = firebase.auth(), db = firebase.firestore();
    auth.onAuthStateChanged(user => user ? signedIn(user, auth, db) : signedOut(auth));
  }

  function signedOut(auth) {
    setUI('<button class="btn" id="acc-login">以 Google 登入</button>'
      + '<p class="note">登入後，你的進度（光之翼收集、圖鑑、任務勾選、設定）會雲端同步、跨裝置共用。</p>');
    const b = document.getElementById('acc-login');
    if (b) b.onclick = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
      .catch(e => alert('登入失敗：' + e.message));
  }

  function signedIn(user, auth, db) {
    setUI(`<div class="kv"><span class="k">已登入</span><span class="v">${esc(user.displayName || user.email || '')}</span></div>
      <div class="row"><button class="btn" id="acc-sync">立即上傳</button><button class="btn danger" id="acc-out">登出</button></div>
      <p class="note" id="acc-status">同步中…</p>`);
    const ref = db.collection('users').doc(user.uid);
    document.getElementById('acc-out').onclick = () => auth.signOut();
    document.getElementById('acc-sync').onclick = () => push(ref);
    syncOnLogin(ref);
    window.__onStoreChange = debounce(() => push(ref), 1500);
  }

  function blob() { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('sky_') === 0) o[k] = localStorage.getItem(k); } return o; }
  function writeBlob(o) { Object.keys(o || {}).forEach(k => { if (k.indexOf('sky_') === 0) localStorage.setItem(k, o[k]); }); }
  function status(t) { const e = document.getElementById('acc-status'); if (e) e.textContent = t; }

  function push(ref) {
    ref.set({ data: blob(), updated: firebase.firestore.FieldValue.serverTimestamp() })
      .then(() => { localStorage.setItem('sky___synced', String(Date.now())); status('已同步 · ' + new Date().toLocaleTimeString('zh-TW')); })
      .catch(e => status('同步失敗：' + e.message));
  }
  function syncOnLogin(ref) {
    ref.get().then(doc => {
      if (doc.exists) {
        const d = doc.data() || {};
        const remoteMs = d.updated && d.updated.toMillis ? d.updated.toMillis() : 0;
        const localMs = +(localStorage.getItem('sky___synced') || 0);
        if (remoteMs > localMs && d.data) {
          writeBlob(d.data); localStorage.setItem('sky___synced', String(remoteMs));
          status('已從雲端載入，重新整理中…'); setTimeout(() => location.reload(), 700);
        } else { push(ref); }
      } else { push(ref); }
    }).catch(e => status('讀取失敗：' + e.message));
  }

  function debounce(fn, ms) { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function esc(s) { return String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }
})();
