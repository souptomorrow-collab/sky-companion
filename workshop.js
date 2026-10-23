/* workshop.js — 築巢工坊（Nesting Workshop）家具每週輪換
 *
 * 13 週固定循環，每週五 00:00 太平洋時間換一輪，每輪 2~6 件（不是固定 4 件）。
 * 輪次公式與 Wiki 的計算器一致：floor(距 2024-04-12 PST 的天數 / 7) mod 13 + 1
 * 錨點是週五；Wiki 註解說明 2025 年 12 月起每週重置改為週五，故錨點用 04-12 而非開季的 04-15。
 *
 * 資料來源：Sky: Children of the Light Wiki「Nesting Workshop」(CC BY-SA)
 *   https://sky-children-of-the-light.fandom.com/wiki/Nesting_Workshop
 * 本檔由 gen-workshop.cjs 產生，勿手改；要更新請重跑 node gen-workshop.cjs。
 *
 * 中文名為本專案自行翻譯（該頁無中文版），英文原名一併保留以便對照遊戲內。
 * 幣別：C=蠟燭🕯️ H=愛心❤️ AC=升華蠟燭🕊️；x 為可購入份數。
 */
window.WORKSHOP_ROTATION = [
  [{ n: "Stone Wood-Fired Oven", zh: "石柴燒烤爐", c: 35, u: "AC", x: 1 },
   { n: "Stone Tall Cube", zh: "石高方塊", c: 11, u: "C", x: 8 }],
  [{ n: "Arles Bedroom Chair", zh: "亞爾臥室椅", c: 13, u: "C", x: 8 },
   { n: "Arles Bedroom Table", zh: "亞爾臥室桌", c: 14, u: "C", x: 4 },
   { n: "Stone Chair", zh: "石椅", c: 16, u: "C", x: 4 },
   { n: "Stone Small Table", zh: "石小桌", c: 20, u: "C", x: 2 },
   { n: "Decor Pillow One Color", zh: "單色抱枕", c: 8, u: "C", x: 4 },
   { n: "Stone Tall Shelf", zh: "石高層架", c: 15, u: "AC", x: 2 }],
  [{ n: "Stone Bench", zh: "石長凳", c: 60, u: "C", x: 1 },
   { n: "Stone Desk", zh: "石書桌", c: 50, u: "C", x: 1 },
   { n: "Decor Pillow Two Colors", zh: "雙色抱枕", c: 12, u: "C", x: 4 }],
  [{ n: "Stone Console Table", zh: "石邊桌", c: 45, u: "C", x: 1 },
   { n: "Decor Folded Cloth", zh: "摺疊布飾", c: 10, u: "C", x: 4 },
   { n: "Small Stripes Rug", zh: "小條紋地毯", c: 18, u: "C", x: 2 }],
  [{ n: "Stone Loveseat", zh: "石雙人沙發", c: 33, u: "H", x: 1 },
   { n: "Stone Round Dining Table", zh: "石圓餐桌", c: 18, u: "H", x: 1 },
   { n: "Stone Plant Stand", zh: "石花架", c: 12, u: "H", x: 2 },
   { n: "Small Classic Rug", zh: "小經典地毯", c: 8, u: "H", x: 2 }],
  [{ n: "Stone Sofa Corner", zh: "石轉角沙發", c: 25, u: "C", x: 1 },
   { n: "Stone Square Dining Table", zh: "石方餐桌", c: 23, u: "H", x: 1 },
   { n: "Stone Wall Sconce", zh: "石壁燈", c: 8, u: "AC", x: 4 }],
  [{ n: "Stone Sofa Side", zh: "石單邊沙發", c: 20, u: "C", x: 4 },
   { n: "Stone Long Dining Table", zh: "石長餐桌", c: 33, u: "H", x: 1 },
   { n: "Stone Small Bathtub", zh: "石小浴缸", c: 25, u: "H", x: 1 },
   { n: "Medium Solid Rug", zh: "中素色地毯", c: 40, u: "C", x: 1 }],
  [{ n: "Stone Kitchen Drawers", zh: "石廚房抽屜櫃", c: 25, u: "C", x: 2 },
   { n: "Stone Coffee Table", zh: "石茶几", c: 28, u: "AC", x: 1 },
   { n: "Stone Candle Light", zh: "石燭燈", c: 16, u: "AC", x: 2 },
   { n: "Medium Stripes Rug", zh: "中條紋地毯", c: 50, u: "C", x: 1 }],
  [{ n: "Stone Wall Pot Rack", zh: "石壁掛鍋架", c: 25, u: "C", x: 2 },
   { n: "Stone Closed Box", zh: "石封閉箱", c: 10, u: "C", x: 3 },
   { n: "Stone Washstand", zh: "石洗手台", c: 40, u: "C", x: 1 },
   { n: "Medium Diamonds Rug", zh: "中菱形地毯", c: 18, u: "H", x: 1 }],
  [{ n: "Stone Armchair", zh: "石扶手椅", c: 10, u: "H", x: 2 },
   { n: "Stone Empty Box", zh: "石空箱", c: 10, u: "C", x: 3 },
   { n: "Stone Wall Mirror", zh: "石壁鏡", c: 30, u: "C", x: 2 },
   { n: "Medium Argyle Rug", zh: "中蘇格蘭格地毯", c: 20, u: "H", x: 1 }],
  [{ n: "Stone Wall Mug Rack", zh: "石壁掛杯架", c: 20, u: "C", x: 2 },
   { n: "Stone Wall Towel Rack", zh: "石壁掛毛巾架", c: 15, u: "C", x: 2 },
   { n: "Medium Circle Rug", zh: "中圓形地毯", c: 70, u: "C", x: 1 }],
  [{ n: "Stone Kitchen Cabinet", zh: "石廚櫃", c: 40, u: "C", x: 2 },
   { n: "Stone Small Cube", zh: "石小方塊", c: 9, u: "C", x: 1 },
   { n: "Stone Candle Holder", zh: "石燭台", c: 6, u: "AC", x: 1 },
   { n: "Large Solid Rug", zh: "大素色地毯", c: 80, u: "C", x: 1 }],
  [{ n: "Stone Kitchen Stove", zh: "石爐灶", c: 25, u: "AC", x: 1 },
   { n: "Stone Large Bathtub", zh: "石大浴缸", c: 45, u: "H", x: 1 },
   { n: "Large Circle Rug", zh: "大圓形地毯", c: 90, u: "C", x: 1 }],
];
window.WORKSHOP_ANCHOR = '2024-04-12'; // 太平洋日，第 1 輪起算
