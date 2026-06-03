/* 壓縮 webp 圖片（保留可讀性）。只在輸出更小時覆蓋。用法：node opt-images.cjs */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
sharp.cache(false);

// 各資料夾：最大寬度 + webp 品質
const CFG = [
  { dir: 'img/candle', maxW: 1800, q: 80 }, // 大蠟地圖：要看細節，保守一點
  { dir: 'img/area', maxW: 720, q: 72 },
  { dir: 'img/shrine', maxW: 720, q: 72 },
  { dir: 'img/wl', maxW: 820, q: 74 },
  { dir: 'img/realm', maxW: 1000, q: 74 },
];

(async () => {
  let totBefore = 0, totAfter = 0, changed = 0, files = 0;
  for (const c of CFG) {
    if (!fs.existsSync(c.dir)) continue;
    const list = fs.readdirSync(c.dir).filter(f => /\.webp$/i.test(f));
    let fb = 0, fa = 0;
    for (const f of list) {
      const p = path.join(c.dir, f);
      const before = fs.statSync(p).size; fb += before; files++;
      try {
        const meta = await sharp(p).metadata();
        let pipe = sharp(p);
        if (meta.width > c.maxW) pipe = pipe.resize({ width: c.maxW, withoutEnlargement: true });
        const buf = await pipe.webp({ quality: c.q, effort: 5 }).toBuffer();
        if (buf.length < before) { fs.writeFileSync(p, buf); fa += buf.length; changed++; }
        else fa += before;
      } catch (e) { fa += before; console.error('  skip', f, e.message); }
    }
    totBefore += fb; totAfter += fa;
    console.log(`${c.dir}: ${(fb / 1048576).toFixed(1)}MB → ${(fa / 1048576).toFixed(1)}MB (${list.length} 檔)`);
  }
  console.log(`\n總計：${(totBefore / 1048576).toFixed(1)}MB → ${(totAfter / 1048576).toFixed(1)}MB，改了 ${changed}/${files} 張，省 ${((1 - totAfter / totBefore) * 100).toFixed(0)}%`);
})();
