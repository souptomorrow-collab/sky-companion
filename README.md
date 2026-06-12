# 光遇助手 · Sky Companion

《光遇 / Sky: Children of the Light》的**外部參考小工具**。純前端（HTML + CSS + 原生 JS），**零安裝、免後端**，所有資訊依你裝置的時鐘**即時計算**，打開即最新。

> ⚠️ 這是外部參考工具：**不與遊戲程式互動、不修改遊戲、不自動操作**，僅做時間換算與資訊整理，不違反遊戲服務條款。

## 功能

| 分頁 | 內容 |
|------|------|
| **總覽** | 每日／週重置倒數、今日碎石摘要、復刻先祖狀態、季節剩餘天數 |
| **碎石** | 今日紅／黑石的區域、地圖、三場出現時間（Sky 時間＋你的當地時間）＋未來 7 天 |
| **復刻先祖** | 每 14 天的到達／離開行事曆、倒數、可自行紀錄每次來的先祖 |
| **蠟燭預算** | 依季節結束日、目標與每日產量，試算能不能集滿 |
| **先祖圖鑑** | 全部 255 位先祖（名稱含繁中翻譯），可搜尋／篩選（中英皆可）；展開看每位的兌換物與花費（蠟燭/愛心/升華/季節蠟燭）；點 ☆ 標記已解鎖，含解鎖進度 |
| **百科** | 季節時間軸、國度、**光之翼示意地圖（125 個位置，滑過看說明、點擊開教學影片）**、活動行事曆、貨幣、碎石獎勵、每日攻略 |
| **設定** | 先祖錨點修正、資料匯出／匯入備份、清除 |

> 總覽的「每日任務」會即時抓取 SkyHelper API（`api.skyhelper.xyz/update/quests`）顯示**今天實際的 4 個任務與攻略圖**（每日重置後更新；離線時退回社群追蹤器連結）。

資料只存在你這台裝置的瀏覽器（localStorage），互不外傳。換裝置前請到「設定」匯出備份。

## 使用方式

### 自己用（最簡單）
直接用瀏覽器打開 `index.html`（雙擊即可），手機也能開。完全離線、不需要架站。

### 給朋友用
- 把整個資料夾傳給對方，他也雙擊 `index.html` 即可；或
- 用 GitHub Pages 產生網址（見下），把網址給對方。

### 放上 GitHub Pages（可選）
1. 推到 GitHub repo（可設為 private，原始碼不公開）。
2. repo → Settings → Pages → Source 選 `main` 分支 `/ (root)` → Save。
3. 取得網址 `https://<帳號>.github.io/<repo>/`。

> 注意：免費方案下，即使 repo 是 private，**產生出來的網站本身是公開的**（知道網址的人都能開，但看不到原始碼）。要連網站存取都鎖住需付費方案。

## 資料來源與準確性

- **碎石演算法**：[PlutoyDev/sky-shards](https://github.com/PlutoyDev/sky-shards)（社群推算，非官方保證）。已用官方站交叉驗證（2026-05-31 → 紅石·草原·Cave 吻合），並修正日光節約轉換日的時間。
- **先祖／季節／國度／物品／花費資料**：[Silverfeelin/SkyGame-Data](https://github.com/Silverfeelin/SkyGame-Data)（MIT 授權，sky-planner.com 後端資料）。
- **重置時間**：thatgamecompany 官方公告 —— 每日 00:00 美國太平洋時間（含日光節約）。
- **復刻先祖**：每 14 天，週四 00:00 PT 到達、週日離開。錨點 `2026-06-04`，可於設定修改。

### 更新圖鑑資料（可選）
先祖／季節等資料已處理成 `skydata.js` 一檔內建，平時不需更新。若遊戲有新季節要更新：

```bash
# 1. 下載最新資料集（鎖版本以利重現）
curl -L https://unpkg.com/skygame-data@latest/assets/everything.json -o everything.json
# 2. 重新產生 skydata.js
node build-skydata.cjs
```

`everything.json` 等原始檔不入庫（見 `.gitignore`），只提交處理後的 `skydata.js`。

## 檔案結構與載入順序

無打包、classic script 共享全域。**index.html 的 `<script>` 順序就是依賴順序**，調整前先看依賴方向（A → B 表示 A 用到 B 的全域）：

```
index.html       介面與分頁
styles.css       樣式（大耳狗淺色主題＋深色模式；字級固定 4 級 CSS 變數，勿再新增字級）
util.js          太平洋時區／DST 換算、Store（localStorage 封裝，key 一律 sky_ 前綴）
shards.js        碎石預測演算法與資料表            → util
skydata.js       遊戲資料（build-skydata.cjs 產生，勿手改）
permcandles.js   永久尋寶蠟燭資料
zh.js            英文名 → 中文對照（SKYZH）
app.js           主程式：分頁、時鐘、倒數、任務、toast → util, shards, skydata, zh
skyenc.js        圖鑑＋百科＋互動地圖＋光之翼影片跳段   → app, util, skydata, zh
firebase-config.js / auth.js  Google 登入＋雲端同步（自動同步所有 sky_ 前綴 key）
sw.js            Service Worker（HTML 網路優先、靜態 cache-first、舊版號自動清）
```

## 維護腳本與 CI

```bash
node verify.cjs        # 部署前驗證：JS 語法、資源/圖片存在、?v= 一致、影片段落對應
node check-health.cjs  # 外部依賴健檢：YouTube 影片可嵌入、SkyHelper API、wikia 圖床
node bump-version.cjs  # 自動 bump index.html 的 ?v= 版本號（改 JS/CSS 後執行，別靠記性）
node build-skydata.cjs # 由 everything.json 重新產生 skydata.js
node opt-images.cjs    # 壓縮 img/ 下的 WebP
```

GitHub Actions：每次 push 自動跑 `verify.cjs`（壞了擋下＋寄信）；每週一自動跑 `check-health.cjs`（影片被刪、API 掛掉會寄信，不用等使用者回報）。

## 免責

《光遇 / Sky: Children of the Light》為 thatgamecompany 之作品。本工具為非官方的玩家輔助，與其無任何官方關聯，碎石等預測不保證 100% 準確。
