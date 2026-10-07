/* 炸弹克星 · 66 关任务表
 * 字段：
 *   blue  [最小,最大]  使用的蓝线数值范围（每个数值 4 根）
 *   y     [n, of]     黄线：从 of 根候选里放入 n 根（n<of 时不知道哪几根是真的）
 *   r     [n, of]     红线：同上
 *   eq    装备卡数量，-1 = 等于玩家人数
 *   dd    是否发放角色卡（双重探测器）
 *   info  开局信息标记：choose(自选) / random(随机) / none(无) / parity(只显示奇偶)
 *   det   引爆器容错修正（正数更宽松）
 *   rules 特殊规则：timer 每回合秒数 / countdown 每 N 回合引爆器自动前进 /
 *         seq 顺序引信数量 / fog 失败只显示“≠” / silent 失败不给信息 /
 *         noChat 禁止聊天 / missing 隐藏缺失一个数值 /
 *         hide 不公开黄/红候选 / turns 回合上限（= 最少回合 + turns）/ infoN 开局每人信息数
 */
(function () {
  var STD = { blue: [1, 12], y: [2, 3], r: [1, 2], eq: -1, dd: true, info: 'choose', det: 0 };
  function m(id, name, brief, o) {
    var x = { id: id, name: name, brief: brief };
    var base = id >= 8 ? STD : {};
    for (var k in base) x[k] = base[k];
    for (var k2 in o) x[k2] = o[k2];
    if (!x.blue) x.blue = [1, 12];
    if (!x.y) x.y = [0, 0];
    if (!x.r) x.r = [0, 0];
    if (x.eq === undefined) x.eq = 0;
    if (x.dd === undefined) x.dd = false;
    if (!x.info) x.info = 'choose';
    if (x.det === undefined) x.det = 0;
    x.rules = x.rules || {};
    x.tier = id <= 8 ? '新兵训练' : id <= 20 ? '外勤任务' : id <= 35 ? '老手任务' : id <= 50 ? '专家任务' : id <= 65 ? '精英任务' : '终极任务';
    return x;
  }

  var M = [
    // ---------- 新兵训练 1-8：逐步加入规则 ----------
    m(1, '新兵报到', '只有蓝线 1~6。学会“双人剪”：指着队友的一根线，说出你手里也有的数值。', { blue: [1, 6], det: 2 }),
    m(2, '加大剂量', '蓝线 1~8。注意利用排序：每个人的线都从左到右由小到大排列。', { blue: [1, 8], det: 1 }),
    m(3, '黄色警报', '加入 2 根黄线。黄线只能宣告“黄色”，所有黄线视为同一种值。', { blue: [1, 10], y: [2, 2], det: 1 }),
    m(4, '红色危险', '全部蓝线 + 1 根红线。剪到红线炸弹立刻爆炸！', { y: [2, 2], r: [1, 1], det: 1 }),
    m(5, '双重探测器', '每人获得一次性的角色能力：同时指向一名队友的两根线，猜中任意一根即成功。', { y: [2, 2], r: [1, 1], dd: true }),
    m(6, '装备库', '加入装备卡：某个数值剪掉 2 根后，对应编号的装备解锁。', { y: [2, 2], r: [1, 1], dd: true, eq: -1 }),
    m(7, '不确定因素', '黄线 3 选 2、红线 2 选 1：你知道候选位置，却不知道哪根是真的。', { y: [2, 3], r: [1, 2], dd: true, eq: -1, det: 1 }),
    m(8, '毕业考核', '完整的标准规则。通过它，你就是正式的拆弹专家。', {}),

    // ---------- 外勤任务 9-20：每关一个新变化 ----------
    m(9, '午夜行动', '红线 3 选 2，危险加倍。', { r: [2, 3] }),
    m(10, '黄蜂巢', '4 根黄线全部在场。', { y: [4, 4] }),
    m(11, '静默协议', '本关禁止聊天，只能靠桌面上的信息推理。', { rules: { noChat: true } }),
    m(12, '读秒', '每回合限时 60 秒，超时引爆器前进一格。', { rules: { timer: 60 } }),
    m(13, '顺序引信', '公开 3 个顺序数值：必须先剪完前一个数值的全部 4 根，才能剪下一个。', { rules: { seq: 3 } }),
    m(14, '浓雾', '剪错时，信息标记只显示“≠ 你宣告的数值”，不显示真实数值。', { rules: { fog: true } }),
    m(15, '盲区', '开局没有信息标记。', { info: 'none', det: 1 }),
    m(16, '奇偶线索', '开局信息标记只显示奇数或偶数。', { info: 'parity' }),
    m(17, '失踪的线', '某个蓝线数值的 4 根被整组移除，没人知道是哪个。', { rules: { missing: true } }),
    m(18, '装备短缺', '只有 1 张装备卡。', { eq: 1 }),
    m(19, '老化引信', '每进行 10 个回合，引爆器自动前进一格。', { rules: { countdown: 10 }, det: 1 }),
    m(20, '无名之线', '黄线与红线的候选位置不再公开。', { rules: { hide: true } }),

    // ---------- 老手任务 21-35：两两组合 ----------
    m(21, '双红', '2 根红线全部在场，每回合 60 秒。', { r: [2, 2], rules: { timer: 60 } }),
    m(22, '快速反应', '每回合 45 秒。', { rules: { timer: 45 } }),
    m(23, '雾中静默', '浓雾 + 禁止聊天。', { rules: { fog: true, noChat: true }, det: 1 }),
    m(24, '定时顺序', '顺序引信 3 个 + 每 12 回合引爆器前进。', { rules: { seq: 3, countdown: 12 }, det: 1 }),
    m(25, '黄红交织', '黄线 4 选 3，红线 3 选 2。', { y: [3, 4], r: [2, 3] }),
    m(26, '没有探测器', '没有角色卡，只能依靠装备。', { dd: false, eq: 5 }),
    m(27, '限时撤离', '回合数有上限：最少回合数 + 8。', { rules: { turns: 8 } }),
    m(28, '盲区失踪', '缺失数值 + 开局无信息。', { info: 'none', rules: { missing: true }, det: 1 }),
    m(29, '静默读秒', '禁止聊天 + 每回合 60 秒。', { rules: { noChat: true, timer: 60 } }),
    m(30, '精英测试', '红线 3 选 2、黄线 3 选 2、顺序引信 2 个。', { r: [2, 3], rules: { seq: 2 } }),
    m(31, '无声之雾', '失败时不给任何信息标记。', { rules: { silent: true }, det: 1 }),
    m(32, '双倍线索', '开局每人放 2 个信息标记，但红线 3 根全在。', { r: [3, 3], rules: { infoN: 2 } }),
    m(33, '奇偶迷雾', '奇偶线索 + 浓雾。', { info: 'parity', rules: { fog: true }, det: 1 }),
    m(34, '轻装上阵', '没有装备卡。', { eq: 0 }),
    m(35, '老手结业', '红线 3 选 2、每回合 60 秒、缺失数值。', { r: [2, 3], rules: { timer: 60, missing: true }, det: 1 }),

    // ---------- 专家任务 36-50 ----------
    m(36, '长顺序', '顺序引信 4 个。', { rules: { seq: 4 } }),
    m(37, '黄金时间', '黄线 4 选 4，回合上限 +6。', { y: [4, 4], rules: { turns: 6 } }),
    m(38, '隐形红线', '红线 2 选 2，且候选不公开。', { r: [2, 2], rules: { hide: true } }),
    m(39, '紧迫感', '每回合 40 秒，每 10 回合引爆器前进。', { rules: { timer: 40, countdown: 10 }, det: 1 }),
    m(40, '冷静头脑', '容错 -1。', { det: -1 }),
    m(41, '沉默的雾', '浓雾 + 禁止聊天 + 缺失数值。', { rules: { fog: true, noChat: true, missing: true }, det: 1 }),
    m(42, '无人之境', '开局无信息、没有角色卡。', { info: 'none', dd: false, det: 1 }),
    m(43, '红色海洋', '红线 4 选 3。', { r: [3, 4] }),
    m(44, '哑火', '失败无信息 + 顺序引信 3 个。', { rules: { silent: true, seq: 3 }, det: 1 }),
    m(45, '寂静无声', '失败无信息 + 禁止聊天。', { rules: { silent: true, noChat: true }, det: 1 }),
    m(46, '奇偶之间', '奇偶线索 + 红线 3 选 2 + 每回合 50 秒。', { info: 'parity', r: [2, 3], rules: { timer: 50 } }),
    m(47, '双重缺失', '缺失数值 + 候选不公开。', { rules: { missing: true, hide: true } }),
    m(48, '最后期限', '回合上限 +5，每 8 回合引爆器前进。', { rules: { turns: 5, countdown: 8 }, det: 1 }),
    m(49, '只靠装备', '没有角色卡，装备 6 张，红线 3 选 2。', { dd: false, eq: 6, r: [2, 3] }),
    m(50, '专家结业', '红线 3 选 2、黄线 4 选 3、浓雾、顺序引信 2 个。', { r: [2, 3], y: [3, 4], rules: { fog: true, seq: 2 }, det: 1 }),

    // ---------- 精英任务 51-65 ----------
    m(51, '冰点', '容错 -1，每回合 45 秒。', { det: -1, rules: { timer: 45 } }),
    m(52, '迷宫', '顺序引信 5 个。', { rules: { seq: 5 }, det: 1 }),
    m(53, '暗流', '失败无信息 + 缺失数值。', { rules: { silent: true, missing: true }, det: 1 }),
    m(54, '赤潮', '红线 4 选 4。', { r: [4, 4], det: 1 }),
    m(55, '默契', '禁止聊天、开局无信息、红线 3 选 2。', { info: 'none', r: [2, 3], rules: { noChat: true }, det: 1 }),
    m(56, '钟摆', '每 6 回合引爆器前进，容错 +2。', { rules: { countdown: 6 }, det: 2 }),
    m(57, '闪电战', '每回合 30 秒。', { rules: { timer: 30 }, det: 1 }),
    m(58, '黑箱', '候选不公开、浓雾、黄线 4 选 3。', { y: [3, 4], rules: { hide: true, fog: true }, det: 1 }),
    m(59, '独木桥', '没有装备、没有角色卡。', { eq: 0, dd: false, det: 1 }),
    m(60, '双保险', '红线 3 选 3、每 10 回合引爆器前进。', { r: [3, 3], rules: { countdown: 10 }, det: 1 }),
    m(61, '幽灵线路', '缺失数值、奇偶线索、候选不公开。', { info: 'parity', rules: { missing: true, hide: true }, det: 1 }),
    m(62, '末日时钟', '回合上限 +4、每回合 45 秒。', { rules: { turns: 4, timer: 45 }, det: 1 }),
    m(63, '沉默迷雾', '禁止聊天、浓雾、顺序引信 3 个。', { rules: { noChat: true, fog: true, seq: 3 }, det: 1 }),
    m(64, '红与黑', '红线 4 选 3、失败无信息。', { r: [3, 4], rules: { silent: true }, det: 2 }),
    m(65, '精英结业', '红线 3 选 2、缺失数值、每 8 回合前进、每回合 45 秒。', { r: [2, 3], rules: { missing: true, countdown: 8, timer: 45 }, det: 1 }),

    // ---------- 终极任务 ----------
    m(66, '终极炸弹', '红线 3 选 3、黄线 4 选 4、浓雾、顺序引信 3 个、禁止聊天、每回合 45 秒。祝你好运。', { r: [3, 3], y: [4, 4], rules: { fog: true, seq: 3, noChat: true, timer: 45 }, det: 1 })
  ];

  // 实体任务通过来源、规则与验收门槛后开放；上面的66关保留旧版改编规则。
  var PHYSICAL = [
    m(1, '新兵报到', '蓝线 1–6；每位玩家从开局拥有双重探测器。', { blue: [1, 6], y: [0, 0], r: [0, 0], eq: 0, dd: true }),
    m(2, '黄色警报', '32 根蓝线（1–8）、2 根已知黄线；无共享装备。', { blue: [1, 8], y: [2, 2], r: [0, 0], eq: 0, dd: true }),
    m(3, '红线与装备', '40 根蓝线（1–10）、1 根已知红线；装备不含 11、12。', { blue: [1, 10], y: [0, 0], r: [1, 1], eq: -1, dd: true }),
    m(4, '红线与黄线', '48 根蓝线、1 根已知红线、2 根已知黄线。', { y: [2, 2], r: [1, 1], eq: -1, dd: true, two: { y: [4, 4] } }),
    m(5, '未知黄线', '48 根蓝线、1 根已知红线、3 选 2 黄线。', { y: [2, 3], r: [1, 1], eq: -1, dd: true, two: { r: [2, 2] } }),
    m(6, '四根黄线', '48 根蓝线、1 根已知红线、4 根已知黄线；单人可拆全部四根或最后两根。', { y: [4, 4], r: [1, 1], eq: -1, dd: true, two: { r: [2, 2] } }),
    m(7, '未知红线', '48 根蓝线、2 选 1 红线；没有黄线。双人改为 3 选 1 红线。', { y: [0, 0], r: [1, 2], eq: -1, dd: true, two: { r: [1, 3] } }),
    m(8, '训练考核', '48 根蓝线、2 选 1 红线、3 选 2 黄线。', { y: [2, 3], r: [1, 2], eq: -1, dd: true, two: { y: [4, 4], r: [1, 3] } }),
    m(13, '红色警报', '三根红线先按队长顺序发给玩家；随机抽取蓝色信息标记，缺少该值时旁置。不能公开红线，必须冒险一次选中三根红线；选错立即爆炸，不能组合装备。双人队长两架各一红，不放初始标记。', { y: [0, 0], r: [3, 3], eq: -1, dd: true, officialModule: 'risky-red-cut' }),
    m(15, '盲开工具箱', '共享装备背面朝上；完成当前数字的四根蓝线后可盲翻一张，直接可用，再翻下一数字。已完成数字直接跳过。', { y: [0, 0], r: [1, 3], eq: -1, dd: true, two: { r: [2, 3] }, excludeEquipment: [13], officialModule: 'blind-equipment' }),
    m(17, '说谎者', '重发含队长卡的角色，持队长卡者为公开的说谎者；没有个人装备，初始两枚蓝色标记都须与导线不同。别人猜错他的线时标猜测值，表示不是这个数；本人不能主动使用装备，但可回应对讲机与雷达。', { y: [0, 0], r: [2, 3], eq: -1, dd: true, two: { r: [3, 3] }, officialModule: 'liar' }),
    m(18, '雷达指挥', '无初始标记；每回合翻数字卡并逐架回应雷达，由轮值玩家指定一人拆该数字，再从轮值玩家左邻继续。', { y: [0, 0], r: [2, 2], eq: 0, dd: true, info: 'none', two: { r: [3, 3] }, officialModule: 'radar-command' }),
    m(21, '奇偶线索', '初始、拆错和便利贴只显示奇偶；不用数值信息标记。', { y: [0, 0], r: [1, 2], eq: -1, dd: true, info: 'parity', two: { r: [2, 2] }, officialModule: 'parity' }),
    m(23, '精准四线拆除', '初始标记之后公开随机数字；此值必须四根一起特殊拆除，选错立即爆炸。七张背面装备在成功前每整轮弃一张，成功后剩余全部公开并直接解锁。', { y: [0, 0], r: [1, 3], two: { r: [2, 3] }, eq: 7, dd: true, officialModule: 'precision-four' }),
    m(24, '频率线索', '初始、拆错和便利贴改用 ×1／×2／×3；同架计数包含已剪线。', { y: [0, 0], r: [2, 2], eq: -1, dd: true, two: { r: [3, 3] }, officialModule: 'frequency' }),
    m(25, '不能说出数值', '用手势、拼写或描述宣告，不能直接说出导线数值；违规时引爆器前进一格。', { y: [0, 0], r: [2, 2], eq: -1, dd: true, two: { r: [3, 3] }, officialModule: 'nonverbal-values' }),
    m(26, '数字轮换', '选择正面数字卡宣告拆线后翻面；整轮翻完重置，四根完成的数字退出。', { y: [0, 0], r: [2, 2], eq: -1, dd: true, excludeEquipment: [10], officialModule: 'number-cycle' }),
    m(29, '秘密数字传递', '右邻在行动前秘密选一张数字牌；行动后公开，若实际剪到此值，引爆器另前进一格。数字牌交给行动者，完成值退场。双人队长不放初始标记。', { y: [0, 0], r: [3, 3], eq: -1, dd: true, officialModule: 'secret-number-pass' }),
    m(31, '个人限制', '按队长顺序选择 A–E，再放初始标记；回合开始无法遵守时永久翻面。', { y: [0, 0], r: [2, 3], eq: -1, dd: true, personalCharacters: true, officialModule: 'personal-constraints' }),
    m(33, '奇偶线索 II', '全部信息标记只显示奇偶；非队长可选择第三盒的四种新角色。', { y: [0, 0], r: [2, 3], eq: -1, dd: true, info: 'parity', two: { r: [3, 3] }, personalCharacters: true, officialModule: 'parity' }),
    m(38, '队长的朝外导线', '队长一根线朝外，只有其他玩家能看见，放原线架最右侧且不排序。只能由队长主动双人或单人拆除，不能用任何装备，猜错立即爆炸；队友只能与此线配对时须跳过并前进一格。', { y: [0, 0], r: [2, 2], eq: -1, dd: true, two: { r: [3, 3] }, personalCharacters: true, officialModule: 'captain-outward-wire' }),
    m(39, '精准拆线与数字奖励', '随机初始蓝色标记；九张隐藏数字牌先公开一张，当前值只能四根同时精准拆除，错误立即爆炸。成功前每整轮弃一张数字牌，成功后从队长开始分发剩余数字并放额外线索；没有对应手牌或备用标记时忽略。', { y: [4, 4], r: [2, 3], two: { r: [3, 3] }, eq: 0, dd: true, personalCharacters: true, officialModule: 'precision-number-rewards' }),
    m(41, '逐根处理绊线', '初始每人一根已知黄线，五人队长不分黄线；随机初始信息，固定橙色起点。黄线只能由队友逐根处理，成功退一格，选红立即爆炸；只剩绊线及红线者免费跳过。', { y: [4, 4], r: [1, 3], two: { r: [2, 3] }, eq: -1, dd: true, personalCharacters: true, excludeEquipment: [13], officialModule: 'tripwire' }),
    m(43, '纳米机器人', '机器人从1沿数字轨道往返，每回合后移动；行动者拆中当前位置的蓝值，取得一根隐藏备用线，两架时本人选择放置架。必须处理所有玩家与机器人导线才能获胜；咖啡杯也推动机器人。双人队长随机初始蓝标记。', { y: [0, 0], r: [3, 3], eq: -1, dd: true, personalCharacters: true, officialModule: 'nano-robot' })
  ];
  PHYSICAL.forEach(function (x) { x.ruleset = 'physical'; x.printedDial = true; x.tier = x.id <= 8 ? '实体规则 · 已核实训练' : '实体规则 · 已核实任务'; });
  M.OFFICIAL_VERSION = 17;
  M.OFFICIAL_STAGES = [
    { from: 1, to: 8, name: '训练', parts: ['基础剪线', '装备'] },
    { from: 9, to: 19, name: '惊喜盒 1', parts: ['数字卡', '顺序卡'] },
    { from: 20, to: 30, name: '惊喜盒 2', parts: ['频率', '奇偶', 'X 标记'] },
    { from: 31, to: 42, name: '惊喜盒 3', parts: ['限制卡', '新角色'] },
    { from: 43, to: 54, name: '惊喜盒 4', parts: ['氧气', '机器人'] },
    { from: 55, to: 66, name: '惊喜盒 5', parts: ['挑战卡', '新装备', '掩体'] }
  ];
  // Card evidence for all 66 is recorded in docs/mission-audit.json.
  // `verified` remains an implementation gate, not merely evidence of a scan.
  M.OFFICIAL = Array.from({ length: 66 }, function (_, i) {
    var id = i + 1;
    var mission = PHYSICAL.filter(function (x) { return x.id === id; })[0];
    var stage = M.OFFICIAL_STAGES.filter(function (x) { return id >= x.from && id <= x.to; })[0];
    return { id: id, stage: stage.name, verified: !!mission, cardReviewed: true,
      implementationStatus: mission ? id <= 8 ? 'implemented-training' : 'implemented-mission' : 'adaptation-only',
      supportedPlayers: [34, 65].indexOf(id) >= 0 ? [3, 4, 5] : [2, 3, 4, 5],
      audioNeedsReview: [19, 30, 42, 54, 66].indexOf(id) >= 0,
      contentVersion: mission ? M.OFFICIAL_VERSION : null,
      source: mission && id <= 8 && [2, 3, 6, 7].indexOf(id) < 0 ? 'https://pegasus.de/en/NetiMedia/download?mediaId=019813124cca7d3285e79316299b9c0c' : 'https://steamcommunity.com/sharedfiles/filedetails/?id=3361000399' };
  });
  PHYSICAL.forEach(function (x) { x.contentVersion = M.OFFICIAL_VERSION; x.verified = true; x.source = M.OFFICIAL[x.id - 1].source; });
  M.PHYSICAL = PHYSICAL;
  // Incomplete official modules are only reachable through this development
  // catalog. They cannot silently replace a playable adaptation or certify it.
  M.DEVELOPMENT = [
    m(35,'黄线先于X线','先发每人一根随机蓝线作为整手唯一X，放第一架最右端；剩余正常发牌。四根黄线完成后才可普通单拆／双拆X，所有装备仍忽略X。共享及个人对讲机不能使用。',{y:[4,4],r:[2,3],two:{r:[3,3]},eq:-1,dd:true,personalCharacters:true,excludeEquipment:[2],excludeCharacters:['walkie-talkies'],officialModule:'yellow-before-x'}),
    m(34,'秘密弱环节','官方仅3–5人。角色含队长卡随机秘密分配，每人秘密随机一张A–E限制；队长卡持有者是弱环节，只有其遵守限制。个人装备锁住；其他玩家回合开始可猜身份及限制，错罚一格、正确公开角色并解锁。弱环节无法行动罚两格后全队角色及限制弃置。',{y:[0,0],r:[1,1],eq:-1,dd:true,officialModule:'secret-weak-link'}),
    m(10,'限时自由轮序','全局15分钟，双人12分钟。喊“我来拆线”取得下一回合；上一位行动者不能连续行动，但只有两人或更少仍持线时允许。结算期间不可抢回合，不使用咖啡杯。',{y:[4,4],r:[1,1],eq:-1,dd:true,excludeEquipment:[11],officialModule:'timed-free-turn'}),
    m(65,'数字牌接力','官方任务仅3–5人：随机分完十二张正面数字牌，五人队长及左邻多一张。拆线须持对应正面数字；不匹配时罚一格跳过，结束选一牌交任一队友。完成四根牌翻面仍可传；清空导线传牌后仍留正面牌则失败。咖啡杯跳过整回合不传牌。',{y:[0,0],r:[3,3],eq:-1,dd:true,personalCharacters:true,excludeEquipment:[10],excludeCharacters:['xy-ray'],officialModule:'number-card-relay'}),
    m(64,'双端朝外绊线','每人整手随机两根朝外线，本人不可见；较小的一根放第一架最左端，另一根放最后一架最右端。主人自己盲拆失败引爆，队友剪中额外推进一格，不能用任何装备影响朝外线。分解器按发行商更正换掉。',{y:[0,0],r:[1,1],two:{r:[2,2]},eq:-1,dd:true,personalCharacters:true,excludeEquipment:[17],officialModule:'double-outward-wires'}),
    m(63,'氧气接力','队长初始氧气2／3／4／5人各14／18／24／30枚。按宣告蓝值耗氧，回合结束把余量交给下一位；轮到队长补回库存，空手队长由下一位获得补氧。缺氧且无免费红线行动才能罚一格跳过。水下禁语，排除共享及个人X/Y。',{y:[0,0],r:[2,2],two:{r:[3,3]},eq:-1,dd:true,personalCharacters:true,excludeEquipment:[10],excludeCharacters:['xy-ray'],rules:{noChat:true},officialModule:'passing-oxygen'}),
    m(62,'末日数字奖励','随机公开人数张数字牌；引爆器从骷髅前的橙色空格开始。每完成其中一个值的四根蓝线，引爆器后退一格；其余导线照常拆，红线仍须主动公开。',{y:[0,0],r:[2,2],two:{r:[3,3]},eq:-1,dd:true,personalCharacters:true,officialModule:'number-completion-rewards'}),
    m(61,'轮转个人限制','每人随机一张A–E，双人在队长左右各多放一张，三人在队长左边多放一张。非结算期间可付一格换F–L；队长回合开始可经全队同意轮转全部限制一位。开发按德文全队无行动立即引爆，法文整轮跳过判定另行记录。',{y:[0,0],r:[1,1],two:{r:[2,2]},eq:-1,dd:true,personalCharacters:true,officialModule:'rotating-personal-constraints'}),
    m(59,'纳米机器人的方向','十二数字随机排成一行，机器人从7面向较长一侧。先向前移动或停在自己持有的蓝值，拆该值后选择朝向；无可达值才能在回合开始反向并罚一格。咖啡杯跳过整个回合，排除共享与个人X/Y。',{y:[0,0],r:[2,3],two:{r:[3,3]},eq:-1,dd:true,personalCharacters:true,excludeEquipment:[10],excludeCharacters:['xy-ray'],officialModule:'robot-number-route'}),
    m(57,'数字绑定限制','十二数字各绑定一张公开随机限制；最初无限制，完成四根蓝值立即启用对应共享限制。无法遵守者免费跳过，全队无合法行动立即失败；公开红线免限制，替换分解器。',{y:[0,0],r:[1,1],two:{r:[2,2]},eq:-1,dd:true,personalCharacters:true,excludeEquipment:[17],officialModule:'number-bound-constraints'}),
    m(56,'朝外绊线','每人随机一根朝外本人不可见线；主人主动盲拆失败引爆，队友剪中朝外线额外推进一格。禁止装备影响朝外线，不使用数字卡。两架暂保留抽中导线原架，摆放例外待核实。',{y:[0,0],r:[2,3],two:{r:[3,3]},eq:-1,dd:true,personalCharacters:true,officialModule:'all-outward-wires'}),
    m(54,'潜艇氧气危机','初始仅48蓝，11红隐藏备用等待录音。个人氧气9／6／3／2，按蓝值分段消耗1／2／3；完成蓝值补氧，有氧必须拆线。音频时间轴尚未启用。',{y:[0,0],r:[0,0],eq:-1,dd:true,personalCharacters:true,excludeEquipment:[10],excludeCharacters:['xy-ray'],officialModule:'submarine-audio'}),
    m(53,'纳米机器人归来','不使用引爆器；机器人从1之前开始。普通成功前进1，剪中机器人数字后退1，失败前进2。开发按德文原卡到12引爆；法文／荷兰较宽松变体超过12另行记录。排除倒带器和稳定器。',{y:[0,0],r:[2,2],two:{r:[3,3]},eq:-1,dd:true,personalCharacters:true,excludeEquipment:[6,9],officialModule:'robot-pressure'}),
    m(52,'全员假线索','每人两枚错误初始标记，可选蓝／红不选黄；所有标记表示不是该值，双拆失败标刚宣告值。便利贴须选错误蓝值；共享等号／不等号替换，双人四黄三红。',{y:[0,0],r:[3,3],two:{y:[4,4],r:[3,3]},eq:-1,dd:true,personalCharacters:true,excludeEquipment:[1,12],officialModule:'all-false-info'}),
    m(51,'长官的命令','引爆器起点提前一格；轮值长官翻数字并独立指定一人（可自己）。被指定者回应后拆该值，缺值则标记并罚一格；指定红线独留者按FAQ立即爆炸。下一长官从原长官左邻继续。',{y:[0,0],r:[1,1],two:{r:[2,2]},eq:-1,dd:true,personalCharacters:true,excludeEquipment:[10],excludeCharacters:['xy-ray'],officialModule:'number-order'}),
    m(50,'黑海记忆','先记住已知红黄数值，再移除候选和完成标记；初始及失败线索只指一次位置，然后旁置。不能追问或复述旧线索，装备正常使用。',{y:[2,2],r:[2,2],two:{r:[3,3],y:[4,4]},eq:-1,dd:true,personalCharacters:true,officialModule:'memory-sea'}),
    m(49,'氧气漂流瓶','个人氧气2／3／4／5人各7／6／5／4枚；每次拆蓝线按宣告值转交一名队友。开发按德文主动跳过、稳定器保护、红线免费、空手弃氧；禁共享及个人X/Y。',{y:[0,0],r:[2,2],two:{r:[3,3]},eq:-1,dd:true,personalCharacters:true,excludeEquipment:[10],excludeCharacters:['xy-ray'],rules:{noChat:true},officialModule:'personal-oxygen'}),
    m(48,'三黄定点拆除','先从队长顺时针预发三根已知黄线；双人队长两黄分两架。黄线只能一次特殊选三根同时拆。四五人行动者无需自持黄；失败线索暂按德文只标错线，罚一格。',{y:[3,3],r:[2,2],two:{r:[3,3]},eq:-1,dd:true,personalCharacters:true,officialModule:'yellow-three'}),
    m(47, '算式拆线', '十二张数字牌公开；用两张牌的和或差组成要拆的蓝值，弃掉两张牌。全部耗尽后重新展开；跳过也弃两牌并推进引爆器一格。排除共享及个人X/Y，双人三根红线。', { y:[0,0],r:[2,3],two:{r:[3,3]},eq:-1,dd:true,personalCharacters:true,excludeEquipment:[10],excludeCharacters:['xy-ray'],officialModule:'number-arithmetic' }),
    m(46, '特工007', '固定黄线5.1／6.1／7.1／8.1，无红线；蓝7不能正常拆。玩家回合开始只剩蓝7时，必须选择全部四根7同时特殊拆除，错误立即爆炸。双人队长不放初始线索，排除备用电池。', { y: [4, 4], r: [0, 0], eq: -1, dd: true, personalCharacters: true, excludeEquipment: [7], officialModule: 'agent-seven' }),
    m(45, '抢认拆线', '队长每回合翻数字牌，先认领的玩家拆该值；无人认领时由队长指定。错误认领或暗示罚一格；被指定而缺值者放线索并罚一格。仅剩红线可认领公开。', { y: [0, 0], r: [2, 2], two: { r: [3, 3] }, eq: -1, dd: true, personalCharacters: true, excludeEquipment: [10, 11], excludeCharacters: ['xy-ray'], officialModule: 'number-claim' }),
    m(44, '水下高压', '共享氧气为人数×2；拆蓝线1–4／5–8／9–12消耗1／2／3枚。队长回合开始补满，主动跳过推进引爆器一格；按发行商FAQ可用稳定器保护。水下禁语，只可请求更多氧气。', { y: [0, 0], r: [1, 3], eq: -1, dd: true, personalCharacters: true, excludeEquipment: [10], excludeCharacters: ['xy-ray'], rules: { noChat: true }, officialModule: 'shared-oxygen' }),
    m(43, '纳米机器人', '机器人从1沿数字轨道往返，每回合后移动；行动者拆中当前位置的蓝值，取得一根隐藏备用线，两架时本人选择放置架。必须处理所有玩家与机器人导线才能获胜；咖啡杯也推动机器人。双人队长随机初始蓝标记。', { y: [0, 0], r: [3, 3], eq: -1, dd: true, personalCharacters: true, officialModule: 'nano-robot' }),
    m(41, '逐根处理绊线', '初始每人一根已知黄线，五人队长不分黄线；随机初始信息，固定橙色起点。黄线只能由队友逐根处理，成功退一格，选红立即爆炸；只剩绊线及红线者免费跳过。', { y: [4, 4], r: [1, 3], two: { r: [2, 3] }, eq: -1, dd: true, personalCharacters: true, excludeEquipment: [13], officialModule: 'tripwire' }),
    m(39, '精准拆线与数字奖励', '随机初始蓝色标记；九张隐藏数字牌先公开一张，当前值只能四根同时精准拆除，错误立即爆炸。成功前每整轮弃一张数字牌，成功后从队长开始分发剩余数字并放额外线索；没有对应手牌或备用标记时忽略。', { y: [4, 4], r: [2, 3], two: { r: [3, 3] }, eq: 0, dd: true, personalCharacters: true, officialModule: 'precision-number-rewards' }),
    m(23, '精准四线拆除', '初始标记之后公开随机数字；此值必须四根一起特殊拆除，选错立即爆炸。七张背面装备在成功前每整轮弃一张，成功后剩余全部公开并直接解锁。', { y: [0, 0], r: [1, 3], two: { r: [2, 3] }, eq: 7, dd: true, officialModule: 'precision-four' }),
    m(36, '两端数字序列', '公开五张随机数字牌，队长先选一端；当前端数字每次剪至少两根后移牌，由行动者选择下一端。其他数值可自由拆；只剩锁住导线的回合立即失败。', { y: [2, 2], r: [1, 3], two: { y: [4, 4], r: [2, 3] }, eq: -1, dd: true, personalCharacters: true, officialModule: 'number-ends' }),
    m(40, '交替信息标记', '队长及顺时针第3、5位使用频率，其余使用奇偶标记，整局固定。初始、拆错和便利贴均使用自己的类型；便利贴可标已剪蓝线。双人队长无初始标记，交换线上的标记丢弃。', { y: [0, 0], r: [3, 3], eq: -1, dd: true, personalCharacters: true, officialModule: 'mixed-clues' }),
    m(38, '队长的朝外导线', '队长一根线朝外，只有其他玩家能看见，放原线架最右侧且不排序。只能由队长主动双人或单人拆除，不能用任何装备，猜错立即爆炸；队友只能与此线配对时须跳过并前进一格。', { y: [0, 0], r: [2, 2], eq: -1, dd: true, two: { r: [3, 3] }, personalCharacters: true, officialModule: 'captain-outward-wire' }),
    m(29, '秘密数字传递', '右邻在行动前秘密选一张数字牌；行动后公开，若实际剪到此值，引爆器另前进一格。数字牌交给行动者，完成值退场。双人队长不放初始标记。', { y: [0, 0], r: [3, 3], eq: -1, dd: true, officialModule: 'secret-number-pass' }),
    m(28, '忘带装备的队长', '队长移除个人角色卡，不能主动使用共享装备；发起的双人拆线失败立即爆炸。仍可回应队友的对讲机与雷达。', { y: [4, 4], r: [2, 2], eq: -1, dd: true, two: { r: [3, 3] }, officialModule: 'unequipped-captain' }),
    m(20, '最右侧X导线', '每人最后收到的一根线放在最右侧X位置，不按数值排序。X不能放初始标记，所有共享和个人装备忽略X；不用对讲机。正常双人、单人拆线及红线公开仍包含X。', { y: [2, 2], r: [2, 2], eq: -1, dd: true, two: { y: [4, 4], r: [2, 3] }, excludeEquipment: [2], officialModule: 'unsorted-x' }),
    m(17, '说谎者', '重发含队长卡的角色，持队长卡者为公开的说谎者；没有个人装备，初始两枚蓝色标记都须与导线不同。别人猜错他的线时标猜测值，表示不是这个数；本人不能主动使用装备，但可回应对讲机与雷达。', { y: [0, 0], r: [2, 3], eq: -1, dd: true, two: { r: [3, 3] }, officialModule: 'liar' }),
    m(14, '新人拆弹', '随机重发含队长卡的角色，持队长卡者是新人。新人双人拆线失败立即爆炸，不能使用稳定器。48蓝、2根已知红、3选2黄；双人改为3红、4根已知黄。', { y: [2, 3], r: [2, 2], eq: -1, dd: true, two: { y: [4, 4], r: [3, 3] }, officialModule: 'rookie' }),
    m(13, '红色警报', '三根红线先按队长顺序发给玩家；随机抽取蓝色信息标记，缺少该值时旁置。不能公开红线，必须冒险一次选中三根红线；选错立即爆炸，不能组合装备。双人队长两架各一红，不放初始标记。', { y: [0, 0], r: [3, 3], eq: -1, dd: true, officialModule: 'risky-red-cut' }),
    m(11, '蓝线变红', '随机公开一个数字；其四根蓝线视为红线，不能剪，留到只剩红线时公开。同编号装备换掉。双人队长不放初始标记。', { y: [2, 2], r: [0, 0], eq: -1, dd: true, two: { y: [4, 4] }, officialModule: 'blue-as-red' }),
    m(12, '遗失的装备', '每张装备另配一张数字卡；印刷条件和附加数字都剪两根才可用，同值只需一对。新增装备也配数字卡。', { y: [4, 4], r: [1, 1], eq: -1, dd: true, two: { r: [2, 2] }, officialModule: 'double-equipment-unlock' }),
    m(15, '盲开工具箱', '共享装备背面朝上；完成当前数字的四根蓝线后可盲翻一张，直接可用，再翻下一数字。已完成数字直接跳过。', { y: [0, 0], r: [1, 3], eq: -1, dd: true, two: { r: [2, 3] }, excludeEquipment: [13], officialModule: 'blind-equipment' }),
    m(18, '雷达指挥', '无初始标记；每回合翻数字卡并逐架回应雷达，由轮值玩家指定一人拆该数字，再从轮值玩家左邻继续。', { y: [0, 0], r: [2, 2], eq: 0, dd: true, info: 'none', two: { r: [3, 3] }, officialModule: 'radar-command' }),
    m(22, '缺失值线索', '开局同时旁置自己没有的两个值（可选黄）；前两根黄线剪断后，按队长顺序取新标记交左邻。', { y: [4, 4], r: [1, 1], eq: -1, dd: true, officialModule: 'missing-value-pass' }),
    m(27, '黄线奖励线索', '无个人角色；前两根黄线剪断后随机公开人数份标记，队长起逐人选择并摆放。双人队长不放初始标记。', { y: [4, 4], r: [1, 1], eq: -1, dd: false, excludeEquipment: [7], officialModule: 'yellow-info-draft' }),
    m(25, '不能说出数值', '用手势、拼写或描述宣告，不能直接说出导线数值；违规时引爆器前进一格。', { y: [0, 0], r: [2, 2], eq: -1, dd: true, two: { r: [3, 3] }, officialModule: 'nonverbal-values' }),
    m(31, '个人限制', '依队长顺序选择 A–E；回合开始无法遵守时永久翻面。', { y: [0, 0], r: [2, 3], eq: -1, dd: true, personalCharacters: true, officialModule: 'personal-constraints' }),
    m(32, '队长换限制', '全队遵守共享限制；队长回合开始可换下一张；无法行动免费跳过。', { y: [0, 0], r: [2, 2], eq: -1, dd: true, two: { r: [3, 3] }, personalCharacters: true, officialModule: 'shared-captain-constraints' }),
    m(37, '完成后换限制', '每完成一个蓝值的四根线，换下一张限制；全队无法行动时前进一格并换牌。', { y: [0, 0], r: [2, 2], eq: -1, dd: true, two: { r: [3, 3] }, personalCharacters: true, officialModule: 'shared-completion-constraints' }),
    m(9, '顺序 A', '三张数字卡：剪两根后解锁下一张；无法行动时爆炸。', { y: [2, 2], r: [1, 1], eq: -1, dd: true, two: { y: [4, 4], r: [2, 2] }, officialModule: 'sequence-a' }),
    m(16, '顺序 B', '三张数字卡：四根全部剪完后解锁下一张；无法行动时爆炸。', { y: [2, 3], r: [1, 1], eq: -1, dd: true, two: { y: [4, 4], r: [2, 2] }, officialModule: 'sequence-b' }),
    m(21, '奇偶线索', '初始、拆错和便利贴只显示奇偶；不用数值信息标记。', { y: [0, 0], r: [1, 2], eq: -1, dd: true, info: 'parity', two: { r: [2, 2] }, officialModule: 'parity' }),
    m(24, '频率线索', '初始、拆错和便利贴改用 ×1／×2／×3；同架计数包含已剪线。', { y: [0, 0], r: [2, 2], eq: -1, dd: true, two: { r: [3, 3] }, officialModule: 'frequency' }),
    m(26, '数字轮换', '每回合选择一张正面数字卡并翻面，只拆该值；整组翻完重置，四根完成的数字退出。', { y: [0, 0], r: [2, 2], eq: -1, dd: true, excludeEquipment: [10], officialModule: 'number-cycle' }),
    m(33, '奇偶线索 II', '全局奇偶线索；支持盒子 3 角色。', { y: [0, 0], r: [2, 3], eq: -1, dd: true, info: 'parity', two: { r: [3, 3] }, personalCharacters: true, officialModule: 'parity' }),
    m(58, '可重复探测器', '无信息标记；双重探测器每回合可用。', { y: [0, 0], r: [2, 2], eq: -1, dd: true, info: 'none', two: { r: [3, 3] }, rules: { silent: true }, excludeEquipment: [4, 7], officialModule: 'reusable-double-detector' })
  ];
  M.DEVELOPMENT.forEach(function (x) { x.ruleset = 'physical'; if (x.printedDial === undefined) x.printedDial = true; x.verified = false; x.contentVersion = 9; });
  // Unified 66-card campaign shown by the current UI. Verified base-game
  // missions use physical rules; unverified entries remain playable as clearly
  // labelled adaptations of the legacy custom catalog.
  M.CAMPAIGN_VERSION = 17;
  M.CAMPAIGN = M.map(function (legacy) {
    var official = PHYSICAL.filter(function (x) { return x.id === legacy.id; })[0];
    var entry = JSON.parse(JSON.stringify(official || legacy));
    entry.catalog = 'campaign';
    entry.ruleset = official ? 'physical' : 'custom';
    entry.contentVersion = M.CAMPAIGN_VERSION;
    entry.verified = !!official;
    entry.tier = legacy.tier;
    entry.status = official ? '已核实' : '改编规则';
    if (official) entry.source = official.source;
    return entry;
  });
  M.get = function (ruleset, id) {
    if (ruleset === 'official-development') return M.DEVELOPMENT.filter(function (x) { return x.id === Number(id); })[0] || null;
    if (ruleset === 'campaign') return M.CAMPAIGN.filter(function (x) { return x.id === Number(id); })[0] || null;
    var list = ruleset === 'custom' ? M : PHYSICAL;
    return list.filter(function (x) { return x.id === Number(id); })[0] || null;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else window.BB_MISSIONS = M;
})();
