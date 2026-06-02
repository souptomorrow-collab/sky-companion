/* firebase-config.js — Firebase 帳號同步設定
 *
 * 啟用步驟（約 5 分鐘，全部免費）：
 * 1. 到 https://console.firebase.google.com/ 建立一個專案。
 * 2. 專案內「Build → Authentication → Sign-in method」啟用「Google」。
 * 3. 「Build → Firestore Database → Create database」（地區隨意，正式模式即可）。
 *    規則貼上（只允許使用者讀寫自己的資料）：
 *      rules_version = '2';
 *      service cloud.firestore {
 *        match /databases/{db}/documents {
 *          match /users/{uid} {
 *            allow read, write: if request.auth != null && request.auth.uid == uid;
 *          }
 *        }
 *      }
 * 4. 「Project settings → 你的應用程式 → Web app（</>）」註冊一個網頁應用，
 *    把它給的 firebaseConfig 內容（apiKey 等）貼到下面 window.FIREBASE_CONFIG。
 * 5. 「Authentication → Settings → Authorized domains」加入：
 *      souptomorrow-collab.github.io
 *    （這樣 Google 登入彈窗才允許在你的網站運作。）
 *
 * 註：這些金鑰是「公開」的（用戶端 SDK 本來就如此），安全性靠上面的 Firestore 規則。
 * 還沒填（保留 PASTE_...）時，帳號功能會自動停用，不影響其他功能。
 */
window.FIREBASE_CONFIG = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_PROJECT.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  appId: "PASTE_APP_ID",
};
