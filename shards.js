/* shards.js — 碎石預測
 * 演算法來源：PlutoyDev/sky-shards（社群推算，非官方保證）
 * 已用官方站交叉驗證：2026-05-31（週日）→ 紅石 · 草原 · Cave，與本邏輯一致。
 *
 * 規則摘要：
 *  - 12 天循環（每月 1 號起，索引 = (日-1)%12）決定當天「首次出現時間」：
 *      [7:40, 2:10, 2:20, 1:50, 3:30, 2:10, 7:40, 1:50, 2:20, 2:10, 3:30, 1:50]
 *  - 黑石 = 1:50 / 2:10（每 8 小時一次，一天 3 次）
 *  - 紅石 = 7:40 / 2:20 / 3:30（每 6 小時一次，一天 3 次）
 *  - 區域輪替索引 = (日-1)%5 → [草原, 森林, 峽谷, 雨林, 禁閣]
 *  - 地圖由 (區域, 首次時間) 查表決定
 *  - 各首次時間有「週幾不掉落」的無碎石日規則
 *  - 出現時間為「閘門出現時間」，落地時間為其後 8 分 40 秒，持續約 4 小時
 */

const SHARD = (function () {
  const realms = ['prairie', 'forest', 'valley', 'wasteland', 'vault'];
  const realmZh = {
    prairie: '雲野 Daylight Prairie',
    forest: '雨林 Hidden Forest',
    valley: '霞谷 Valley of Triumph',
    wasteland: '暮土 Golden Wasteland',
    vault: '禁閣 Vault of Knowledge',
  };

  // 12 天循環的首次出現時間
  const cycle = ['7:40', '2:10', '2:20', '1:50', '3:30', '2:10', '7:40', '1:50', '2:20', '2:10', '3:30', '1:50'];

  // 每個時間：類型與間隔（小時）
  const offsetInfo = {
    '1:50': { type: 'black', interval: 8 },
    '2:10': { type: 'black', interval: 8 },
    '7:40': { type: 'red', interval: 6 },
    '2:20': { type: 'red', interval: 6 },
    '3:30': { type: 'red', interval: 6 },
  };

  // 無碎石日（該星期不掉落）；0=日 … 6=六
  const noShardWeekdays = {
    '1:50': [6, 0], // 六、日
    '2:10': [0, 1], // 日、一
    '7:40': [1, 2], // 一、二
    '2:20': [2, 3], // 二、三
    '3:30': [3, 4], // 三、四
  };

  // 地圖：location[realm][time] = [英文, 中文]
  const location = {
    prairie: {
      '1:50': ['Butterfly Field', '蝴蝶平原'], '2:10': ['Village Islands', '島嶼'],
      '7:40': ['Cave', '洞穴'], '2:20': ['Bird Nest', '鳥巢'], '3:30': ['Sanctuary Island', '聖島'],
    },
    forest: {
      '1:50': ['Forest Brook', '林間溪流'], '2:10': ['Boneyard', '枯骨之地'],
      '7:40': ['Forest Garden', '森林花園'], '2:20': ['Treehouse', '樹屋'], '3:30': ['Elevated Clearing', '高處空地'],
    },
    valley: {
      '1:50': ['Ice Rink', '溜冰場'], '2:10': ['Ice Rink', '溜冰場'],
      '7:40': ['Village of Dreams', '夢之村'], '2:20': ['Village of Dreams', '夢之村'], '3:30': ['Hermit Valley', '隱士谷'],
    },
    wasteland: {
      '1:50': ['Broken Temple', '破碎神廟'], '2:10': ['Battlefield', '古戰場'],
      '7:40': ['Graveyard', '墓地'], '2:20': ['Crabfield', '蟹田'], '3:30': ['Forgotten Ark', '被遺忘的方舟'],
    },
    vault: {
      '1:50': ['Starlight Desert', '星光沙漠'], '2:10': ['Starlight Desert', '星光沙漠'],
      '7:40': ['Jellyfish Cove', '水母灣'], '2:20': ['Jellyfish Cove', '水母灣'], '3:30': ['Jellyfish Cove', '水母灣'],
    },
  };

  /* 計算某個 Sky 日曆日期的碎石資訊 */
  function forDate(y, mo, d) {
    const time = cycle[(d - 1) % 12];
    const realm = realms[(d - 1) % 5];
    const info = offsetInfo[time];
    const weekday = skyWeekday(y, mo, d);
    const hasShard = !noShardWeekdays[time].includes(weekday);

    // 只把「每日重置 00:00」錨到太平洋牆鐘一次，之後全部以「真實毫秒」相加。
    // 遊戲計時器自 00:00 PT 重置後累加真實秒數，無法跳過/重複 DST 那一小時，
    // 故 DST 轉換日（一年 2 天）也與 sky-shards / 遊戲一致；非 DST 日結果不變。
    const [h, mi] = time.split(':').map(Number);
    const reset = skyWallToDate(y, mo, d, 0, 0, 0);
    const first = new Date(reset.getTime() + (h * 60 + mi) * 60000); // 第一場 = 重置 + offset
    const eruptions = [];
    for (let i = 0; i < 3; i++) {
      const start = new Date(first.getTime() + i * info.interval * 3600 * 1000); // 第 i 場 = 第一場 + i*間隔
      const land = new Date(start.getTime() + (8 * 60 + 40) * 1000);
      const end = new Date(land.getTime() + 4 * 3600 * 1000);
      eruptions.push({ start, land, end });
    }

    return {
      y, mo, d, weekday,
      time, type: info.type, hasShard,
      realm, realmZh: realmZh[realm],
      location: location[realm][time], // [en, zh]
      eruptions,
    };
  }

  return { forDate };
})();
