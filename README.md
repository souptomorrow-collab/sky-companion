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
| **先祖圖鑑** | 全部 255 位先祖，可搜尋／篩選；展開看每位的兌換物與花費（蠟燭/愛心/升華/季節蠟燭）；點 ☆ 標記已解鎖，含解鎖進度 |
| **百科** | 季節（29 季時間軸與先祖）、國度（區域＋光之翼）、活動行事曆、貨幣說明、碎石獎勵、每日攻略 |
| **設定** | 先祖錨點修正、資料匯出／匯入備份、清除 |

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

## 檔案結構

```
index.html    介面與分頁
styles.css    樣式（星空主題、行動裝置友善）
util.js       太平洋時區／DST 換算、localStorage 封裝
shards.js     碎石預測演算法與資料表
app.js        主程式：分頁、時鐘、倒數、各功能渲染
```

## 免責

《光遇 / Sky: Children of the Light》為 thatgamecompany 之作品。本工具為非官方的玩家輔助，與其無任何官方關聯，碎石等預測不保證 100% 準確。
