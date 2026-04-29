// ====================== 四大核心算法模块 ======================

import { ZODIAC_ORDER, ZODIAC_ELEMENT, ELEMENT_GENERATE, getZodiacNumbers, getColor, getElement } from './analysis-calc-utils.js';
import { getSpecial } from './analysis-calc-full.js';
import { getCurrentLunarYear, getLunarYearByDate } from './analysis-calc-zodiac.js';
import { detectMultiWindowPattern, detectColdHotAlternatingMarket } from './analysis-calc-patterns.js';

/**
 * 【算法一】热号惯性算法
 * 核心目的：利用短期开奖惯性，近期开出的生肖有延续出号概率，做正向加权
 * 
 * 技术实现：
 * 1. 固定提取最近连续2期特码对应生肖
 * 2. 区分：上期热肖、上上期热肖，双热肖权重更高
 * 3. 两期为同一个生肖（连肖）：直接拉满 +15%
 * 4. 两期不同生肖：统一 +10%
 * 5. 新增特征：recent2_zodiac 最近两期热肖标签
 * 6. 新增特征：hot_inertia_coeff 热惯性系数（0.10~0.15）
 * 7. 连热超过3期后，自动衰减惯性权重，防止追热翻车
 * 
 * @param {Array} list - 历史数据列表
 * @param {string} zodiac - 生肖名称
 * @param {number} totalPeriods - 总期数
 * @returns {Object} 热惯性得分和系数
 */
export function calcHotInertia(list, zodiac, totalPeriods) {
  const result = {
    hotInertiaBonus: 0,
    hotInertiaCoeff: 0,
    recent2Zodiac: [],
    recent3Zodiac: [],
    isContinuousHot: false,
    continuousHotCount: 0,
    consecutiveStreak: 0,
    isConsecutiveSame: false,
    upperHotZodiac: null,
    upperUpperHotZodiac: null,
    hotLevel: 'none'
  };

  if (!list || list.length < 2) return result;

  // 提取最近连续2期生肖
  const recent2Zodiacs = [
    getSpecial(list[0]).zod,
    getSpecial(list[1]).zod
  ];

  result.recent2Zodiac = recent2Zodiacs;
  result.upperHotZodiac = recent2Zodiacs[0];
  result.upperUpperHotZodiac = recent2Zodiacs[1];

  // 提取最近3期生肖（用于连热检测）
  const recent3 = list.slice(0, Math.min(3, list.length));
  result.recent3Zodiac = recent3.map(item => getSpecial(item).zod);

  // 计算连续出现次数
  let consecutiveCount = 0;
  recent3.forEach(z => { if (z === zodiac) consecutiveCount++; });
  result.continuousHotCount = consecutiveCount;

  // 计算连续相同生肖的连肖次数
  if (recent2Zodiacs[0] === recent2Zodiacs[1]) {
    result.isConsecutiveSame = true;
    result.consecutiveStreak = 2;
    
    // 提取更长的连肖次数
    let streakCount = 1;
    let prevZodiac = getSpecial(recent3[0]).zod;
    for (let i = 1; i < recent3.length; i++) {
      const currentZodiac = getSpecial(recent3[i]).zod;
      if (currentZodiac === prevZodiac) {
        streakCount++;
      } else {
        break;
      }
      prevZodiac = currentZodiac;
    }
    result.consecutiveStreak = streakCount;
  }

  // 计算热号惯性权重加成
  let hotCount = 0;
  recent2Zodiacs.forEach(z => { if (z === zodiac) hotCount++; });

  if (hotCount > 0) {
    // 两期为同一个生肖（连肖）且该生肖是目标生肖：直接拉满 +15%
    if (result.isConsecutiveSame && zodiac === recent2Zodiacs[0]) {
      result.hotInertiaCoeff = 0.15;
      result.hotInertiaBonus = 15;
      result.hotLevel = 'double_hot';
    } 
    // 两期不同生肖，但至少有一期是目标生肖：统一 +10%
    else if (hotCount >= 1) {
      result.hotInertiaCoeff = 0.10;
      result.hotInertiaBonus = 10;
      result.hotLevel = 'single_hot';
    }

    // 连热超过3期后，自动衰减惯性权重，防止追热翻车
    if (result.consecutiveStreak > 3) {
      const decayFactor = Math.max(0.5, 1 - (result.consecutiveStreak - 3) * 0.1);
      result.hotInertiaBonus = Math.round(result.hotInertiaBonus * decayFactor);
      result.hotInertiaCoeff = Math.round(result.hotInertiaCoeff * decayFactor * 100) / 100;
      result.hotLevel = 'decayed_hot';
    }
  }

  return result;
}

/**
 * 【算法二】冷号遗漏回补算法
 * 核心目的：大数规律下，长期遗漏不出的生肖，存在概率回补修复需求
 * 
 * 技术实现：
 * 1. 自定义临界值：默认遗漏＞15期判定为深度冷肖
 * 2. 分级规则：
 *    - 轻度遗漏（5~14期）：小幅加分
 *    - 深度遗漏（≥15期）：大额回补加分
 * 3. 遗漏期数越大，回补得分线性递增
 * 4. 触达临界值后，自动激活「冷号回补窗口」
 * 5. 新增特征：miss_period 当前生肖遗漏期数
 * 6. 新增特征：miss_repair_coeff 遗漏回补系数
 * 7. 超极冷肖（遗漏超30期）不盲目拉满，限制最高加分上限，避免死冷不补
 * 
 * @param {number} missPeriod - 当前遗漏期数
 * @param {number} avgMiss - 平均遗漏期数
 * @param {number} totalPeriods - 总期数
 * @returns {Object} 遗漏回补得分和系数
 */
export function calcMissRepair(missPeriod, avgMiss, totalPeriods) {
  const result = {
    missRepairBonus: 0,
    missRepairCoeff: 0,
    missLevel: 'normal',
    missPeriod: missPeriod,
    missThreshold: 0,
    inReboundWindow: false,
    overflowPeriods: 0,
    repairProgress: 0
  };

  // 临界阈值设置
  const DEEP_COLD_THRESHOLD = 15;
  const EXTREME_COLD_THRESHOLD = 30;
  const LIGHT_MISS_MIN = 5;
  const LIGHT_MISS_MAX = 14;
  const MAX_BONUS = 25;

  if (missPeriod >= EXTREME_COLD_THRESHOLD) {
    // 超极冷肖（遗漏超30期）：限制最高加分上限，避免死冷不补
    result.missLevel = 'extreme_cold';
    result.missThreshold = EXTREME_COLD_THRESHOLD;
    result.overflowPeriods = missPeriod - EXTREME_COLD_THRESHOLD;
    
    // 溢出率计算（限制在0.5以内）
    const overflowRatio = Math.min(result.overflowPeriods / 20, 0.5);
    
    // 回补得分线性递减（溢出越多，加分越少）
    result.missRepairBonus = Math.round(MAX_BONUS * (1 - overflowRatio));
    result.missRepairCoeff = Math.round(result.missRepairBonus / 30 * 15) / 10;
    
    // 计算回补进度（0-100%）
    result.repairProgress = Math.round((1 - overflowRatio) * 100);
    
    // 激活冷号回补窗口
    result.inReboundWindow = true;
  } else if (missPeriod >= DEEP_COLD_THRESHOLD) {
    // 深度遗漏（≥15期）：大额回补加分
    result.missLevel = 'deep_cold';
    result.missThreshold = DEEP_COLD_THRESHOLD;
    result.overflowPeriods = missPeriod - DEEP_COLD_THRESHOLD;
    
    // 遗漏期数越大，回补得分线性递增
    result.missRepairBonus = Math.round(20 + result.overflowPeriods * 0.5);
    result.missRepairCoeff = 0.5 + Math.min(result.overflowPeriods * 0.05, 0.3);
    
    // 计算回补进度（15期为100%，每超1期递减）
    result.repairProgress = Math.round(Math.max(0, 100 - result.overflowPeriods * 5));
    
    // 激活冷号回补窗口
    result.inReboundWindow = true;
  } else if (missPeriod >= LIGHT_MISS_MIN && missPeriod <= LIGHT_MISS_MAX) {
    // 轻度遗漏（5~14期）：小幅加分
    result.missLevel = 'light_cold';
    result.missThreshold = LIGHT_MISS_MIN;
    
    // 线性插值计算加分
    const factor = (missPeriod - LIGHT_MISS_MIN) / (LIGHT_MISS_MAX - LIGHT_MISS_MIN);
    result.missRepairBonus = Math.round(5 + factor * 10);
    result.missRepairCoeff = 0.2 + factor * 0.3;
    
    // 计算回补进度
    result.repairProgress = Math.round(factor * 100);
  } else {
    // 正常遗漏：不享受回补加分，但有轻微加分
    result.missLevel = 'normal';
    result.missThreshold = 0;
    
    // 轻微加分机制（遗漏超过平均值时）
    result.missRepairBonus = missPeriod > avgMiss ? Math.round((missPeriod - avgMiss) * 0.5) : 0;
    result.missRepairCoeff = 0;
    
    // 计算回补进度
    result.repairProgress = missPeriod > 0 ? Math.round((1 - missPeriod / avgMiss) * 100) : 0;
  }

  return result;
}

/**
 * 【算法三】生肖轮换平衡算法
 * 核心目的：12生肖不会长期扎堆开出，遵循热转温、温转冷、冷转回补自然轮转
 * 
 * 技术实现：
 * 1. 给每个生肖打状态标签：大热肖、温态肖、偏冷肖、极冷肖
 * 2. 长期霸占开奖的大热肖：逐步扣分
 * 3. 长期轮空未出的冷肖：逐步累加轮转得分
 * 4. 新增特征：zodiac_cycle_state 生肖轮转状态
 * 5. 新增特征：cycle_balance_score 轮转平衡得分
 * 6. 12生肖循环轮动，保证不会固定只出两三个生肖，贴合真实开奖走势
 * 
 * @param {string} zodiac - 当前生肖
 * @param {Object} zodiacStateMap - 生肖状态映射
 * @param {number} currentHotCount - 当前生肖在分析期数内的出现次数
 * @param {number} totalPeriods - 总期数
 * @param {Array} list - 历史数据列表
 * @returns {Object} 轮转平衡得分
 */
export function calcCycleBalance(zodiac, zodiacStateMap, currentHotCount, totalPeriods, list) {
  const result = {
    cycleBalanceBonus: 0,
    cycleState: 'normal',
    balanceScore: 0,
    zodiacCycleState: 'normal',
    cyclePhase: 'balanced',
    rotationDirection: 'neutral',
    recentHotCount: 0,
    recentColdCount: 0
  };

  const avgCount = totalPeriods / 12;
  const hotThreshold = avgCount * 1.3;
  const coldThreshold = avgCount * 0.7;

  // 生肖冷热状态跟踪 - 打状态标签
  if (currentHotCount >= hotThreshold * 1.5) {
    result.zodiacCycleState = '大热肖';
    result.cycleState = 'hot';
    result.cyclePhase = 'hot_dominant';
    
    // 长期霸占开奖的大热肖：逐步扣分
    const overheatRatio = (currentHotCount - hotThreshold * 1.5) / hotThreshold;
    result.cycleBalanceBonus = Math.round(-5 - overheatRatio * 10);
    result.balanceScore = result.cycleBalanceBonus;
    result.rotationDirection = 'cooling_down';
  } else if (currentHotCount >= hotThreshold) {
    result.zodiacCycleState = '温态肖';
    result.cycleState = 'warm_hot';
    result.cyclePhase = 'warm';
    result.cycleBalanceBonus = -5;
    result.balanceScore = -5;
    result.rotationDirection = 'cooling_down';
  } else if (currentHotCount <= coldThreshold * 0.5) {
    result.zodiacCycleState = '极冷肖';
    result.cycleState = 'extreme_cold';
    result.cyclePhase = 'cold_emerging';
    
    // 长期轮空未出的极冷肖：逐步累加轮转得分
    const coldRatio = 1 - (currentHotCount / (coldThreshold * 0.5));
    result.cycleBalanceBonus = Math.round(15 + coldRatio * 15);
    result.balanceScore = result.cycleBalanceBonus;
    result.rotationDirection = 'warming_up';
  } else if (currentHotCount <= coldThreshold) {
    result.zodiacCycleState = '偏冷肖';
    result.cycleState = 'cold';
    result.cyclePhase = 'cold';
    
    // 偏冷肖：累加轮转得分
    const coldRatio = 1 - (currentHotCount / coldThreshold);
    result.cycleBalanceBonus = Math.round(10 + coldRatio * 15);
    result.balanceScore = result.cycleBalanceBonus;
    result.rotationDirection = 'warming_up';
  } else {
    result.zodiacCycleState = '温态肖';
    result.cycleState = 'warm';
    result.cyclePhase = 'balanced';
    result.cycleBalanceBonus = 3;
    result.balanceScore = 3;
    result.rotationDirection = 'balanced';
  }

  // 近期5期热肖统计
  const recent5 = list.slice(0, Math.min(5, list.length));
  const recent5Zodiacs = recent5.map(item => getSpecial(item).zod);
  const hotZodiacInRecent5 = recent5Zodiacs.filter(z => z === zodiac).length;
  result.recentHotCount = hotZodiacInRecent5;

  // 近期热肖出现过多，扣分
  if (hotZodiacInRecent5 >= 2) {
    result.cycleBalanceBonus -= 3;
    result.balanceScore -= 3;
  }

  // 近期10期冷肖统计
  const recent10 = list.slice(0, Math.min(10, list.length));
  const coldZodiacInRecent10 = recent10.filter(item => {
    const z = getSpecial(item).zod;
    return zodiacStateMap[z] === 'cold' || zodiacStateMap[z] === 'extreme_cold';
  }).length;
  result.recentColdCount = coldZodiacInRecent10;

  // 近期冷肖占主导，给其他生肖加分机会
  if (coldZodiacInRecent10 >= 7 && result.cycleState !== 'hot' && result.cycleState !== 'warm_hot') {
    result.cycleBalanceBonus += 5;
    result.balanceScore += 5;
  }

  // 12生肖轮换平衡检测
  const zodiacCounts = {};
  ZODIAC_ORDER.forEach(z => { zodiacCounts[z] = 0; });
  recent10.forEach(item => {
    const z = getSpecial(item).zod;
    if (zodiacCounts.hasOwnProperty(z)) {
      zodiacCounts[z]++;
    }
  });

  const activeZodiacs = Object.values(zodiacCounts).filter(count => count > 0).length;
  const maxCount = Math.max(...Object.values(zodiacCounts));
  const minCount = Math.min(...Object.values(zodiacCounts));

  // 如果只有少数生肖频繁出现，触发轮换调整
  if (activeZodiacs <= 5 && maxCount >= 3) {
    // 需要轮换，对冷门生肖加权
    if (currentHotCount <= avgCount * 0.5) {
      result.cycleBalanceBonus += 8;
      result.balanceScore += 8;
      result.rotationDirection = 'forced_warming_up';
    }
  }

  // 如果生肖分布非常均衡，给予额外加分
  if (activeZodiacs >= 10 && maxCount <= 2) {
    result.cycleBalanceBonus += 2;
    result.balanceScore += 2;
  }

  return result;
}

/**
 * 【算法四】频次统计排序算法
 * 核心目的：以历史整体开出频率作为模型基础得分盘口
 * 
 * 技术实现：
 * 1. 全周期频次统计：统计自建库以来，每个生肖总开出次数
 * 2. 统计每个号码总开出次数
 * 3. 长周期权重：全部历史总频次（默认60%权重）
 * 4. 短周期权重：近30期近期频次（默认40%权重）
 * 5. 远近结合动态加权，不唯老数据论
 * 6. 按综合得分从高到低排序
 * 7. 筛选Top1独胆、Top3精选特码
 * 8. 剔除极端异常开奖数据干扰
 * 9. 频次相近时，交由前面三大算法二次决选
 * 
 * @param {number} count - 生肖出现次数
 * @param {number} totalPeriods - 总期数
 * @param {Array} list - 历史数据列表
 * @returns {Object} 频次基础分
 */
export function calcFrequencyScore(count, totalPeriods, list) {
  const result = {
    baseScore: 0,
    longTermWeight: 0.6,
    shortTermWeight: 0.4,
    longTermScore: 0,
    shortTermScore: 0,
    totalFrequency: count,
    longTermFrequency: 0,
    shortTermFrequency: 0,
    frequencyRatio: 0,
    isOutlier: false,
    confidenceLevel: 'normal'
  };

  // 全周期频次统计
  const totalRatio = count / totalPeriods;
  result.longTermFrequency = count;
  result.frequencyRatio = totalRatio;
  result.longTermScore = Math.round(totalRatio * 40);

  // 近30期频次统计（短周期）
  const recent30 = list.slice(0, Math.min(30, list.length));
  const recent30Count = {};
  ZODIAC_ORDER.forEach(z => { recent30Count[z] = 0; });
  recent30.forEach(item => {
    const z = getSpecial(item).zod;
    if (recent30Count.hasOwnProperty(z)) {
      recent30Count[z]++;
    }
  });

  const recent30Total = recent30.length;
  // 计算该生肖在近30期的频次
  const currentZodiacCount = count; // 使用完整统计的次数
  const recent30Ratio = recent30Total > 0 ? currentZodiacCount / recent30Total : totalRatio;
  result.shortTermFrequency = Math.round(recent30Ratio * recent30Total);
  result.shortTermScore = Math.round(Math.min(recent30Ratio, 1) * 30);

  // 动态权重调整 - 不唯老数据论
  // 根据近期数据充足程度动态调整权重
  if (recent30Total >= 25) {
    // 近期数据充足，提高短期权重
    result.shortTermWeight = 0.45;
    result.longTermWeight = 0.55;
  } else if (recent30Total >= 15) {
    // 近期数据一般，维持默认权重
    result.shortTermWeight = 0.4;
    result.longTermWeight = 0.6;
  } else {
    // 近期数据不足，提高长期权重
    result.shortTermWeight = 0.3;
    result.longTermWeight = 0.7;
  }

  // 计算基础得分
  result.baseScore = Math.round(
    result.longTermWeight * result.longTermScore +
    result.shortTermWeight * result.shortTermScore
  );

  // 剔除极端异常开奖数据干扰
  const avgCount = totalPeriods / 12;
  const stdDev = Math.sqrt(avgCount);
  
  // 检测是否为异常值（超过2个标准差）
  if (count > avgCount + 2 * stdDev || count < avgCount - 2 * stdDev) {
    result.isOutlier = true;
    result.confidenceLevel = 'low';
    // 对异常值进行修正
    const outlierAdjustment = count > avgCount + 2 * stdDev 
      ? (count - (avgCount + 2 * stdDev)) * 0.5 
      : (count - (avgCount - 2 * stdDev)) * 0.5;
    result.baseScore = Math.round(result.baseScore - outlierAdjustment);
  } else if (count > avgCount + stdDev || count < avgCount - stdDev) {
    result.confidenceLevel = 'medium';
  } else {
    result.confidenceLevel = 'high';
  }

  // 频次相近时的二次决选标志
  // 当多个生肖频次差异小于10%时，触发二次决选
  const maxCount = Math.max(...Object.values(recent30Count));
  const minCount = Math.min(...Object.values(recent30Count));
  const rangeRatio = (maxCount - minCount) / maxCount;
  
  if (rangeRatio < 0.1) {
    result.needSecondarySelection = true;
  } else {
    result.needSecondarySelection = false;
  }

  return result;
}

/**
 * ========================================
 * 综合算法融合 - 总公式计算
 * 
 * 总公式：总得分 = (基础频次分 × 动态权重) + 热号惯性加分 + 遗漏回补加分 + 轮转平衡得分
 * 
 * 动态权重 = 1.0 + 热惯性系数 + 遗漏回补系数
 * 
 * 筛选规则：
 * - Top1 独胆：综合得分最高的生肖
 * - Top3 精选特码：综合得分前三的生肖
 * - 频次相近时，交由前面三大算法二次决选
 * 
 * ========================================
 */
export function calcFourAlgorithmFusion(list, targetZodiac) {
  const totalPeriods = list.length;

  if (totalPeriods === 0) {
    return {
      totalScore: 0,
      baseScore: 0,
      hotInertiaBonus: 0,
      missRepairBonus: 0,
      cycleBalanceBonus: 0,
      dynamicWeight: 1.0,
      algorithmDetails: {}
    };
  }

  // 计算每个生肖的遗漏期数
  const zodMiss = {};
  ZODIAC_ORDER.forEach(z => { zodMiss[z] = totalPeriods; });
  list.forEach((item, idx) => {
    const s = getSpecial(item);
    if (zodMiss[s.zod] === totalPeriods) {
      zodMiss[s.zod] = idx;
    }
  });

  const avgMiss = totalPeriods / 12;

  // 计算每个生肖的出现次数
  const zodCount = {};
  ZODIAC_ORDER.forEach(z => { zodCount[z] = 0; });
  list.forEach(item => {
    const s = getSpecial(item);
    zodCount[s.zod]++;
  });

  // 构建生肖状态映射
  const zodiacStateMap = {};
  const avgCount = totalPeriods / 12;
  ZODIAC_ORDER.forEach(z => {
    const count = zodCount[z];
    const miss = zodMiss[z];
    if (count >= avgCount * 1.5 && miss <= 3) {
      zodiacStateMap[z] = 'hot';
    } else if (count <= avgCount * 0.3 || miss >= avgMiss * 2) {
      zodiacStateMap[z] = 'cold';
    } else if (miss >= avgMiss * 1.5) {
      zodiacStateMap[z] = 'warm';
    } else {
      zodiacStateMap[z] = 'normal';
    }
  });

  // 调用四大算法计算各项得分
  const freqResult = calcFrequencyScore(zodCount[targetZodiac], totalPeriods, list);
  const hotInertiaResult = calcHotInertia(list, targetZodiac, totalPeriods);
  const missRepairResult = calcMissRepair(zodMiss[targetZodiac], avgMiss, totalPeriods);
  const cycleBalanceResult = calcCycleBalance(
    targetZodiac,
    zodiacStateMap,
    zodCount[targetZodiac],
    totalPeriods,
    list
  );

  // 计算动态权重
  // 动态权重 = 1.0 + 热惯性系数 + 遗漏回补系数
  const dynamicWeight = 1.0 + hotInertiaResult.hotInertiaCoeff + missRepairResult.missRepairCoeff;
  
  // 应用动态权重到基础频次分
  const baseWithWeight = freqResult.baseScore * dynamicWeight;
  
  // 总得分计算
  // 总得分 = (基础频次分 × 动态权重) + 热号惯性加分 + 遗漏回补加分 + 轮转平衡得分
  const totalScore = Math.round(
    baseWithWeight +
    hotInertiaResult.hotInertiaBonus +
    missRepairResult.missRepairBonus +
    cycleBalanceResult.cycleBalanceBonus
  );

  return {
    totalScore: Math.max(0, totalScore),
    baseScore: freqResult.baseScore,
    hotInertiaBonus: hotInertiaResult.hotInertiaBonus,
    missRepairBonus: missRepairResult.missRepairBonus,
    cycleBalanceBonus: cycleBalanceResult.cycleBalanceBonus,
    dynamicWeight: dynamicWeight,
    algorithmDetails: {
      hotInertia: hotInertiaResult,
      missRepair: missRepairResult,
      cycleBalance: cycleBalanceResult,
      frequency: freqResult,
      dynamicWeight: dynamicWeight,
      missPeriod: zodMiss[targetZodiac],
      recent2Zodiac: hotInertiaResult.recent2Zodiac,
      cycleState: cycleBalanceResult.cycleState,
      missLevel: missRepairResult.missLevel,
      zodiacCycleState: cycleBalanceResult.zodiacCycleState,
      rotationDirection: cycleBalanceResult.rotationDirection,
      inReboundWindow: missRepairResult.inReboundWindow,
      needSecondarySelection: freqResult.needSecondarySelection,
      confidenceLevel: freqResult.confidenceLevel
    }
  };
}

/**
 * 使用四大算法计算精选生肖 - 升级版V2.0
 * @param {Array} historyData - 历史数据
 * @param {number} periodLimit - 分析期数限制
 * @returns {Array} 排序后的生肖数组
 */
export function calcSelectedZodiacsV2(historyData, periodLimit) {


  let list = historyData.slice(0, Math.min(periodLimit, historyData.length));
  
  if (periodLimit === 'all' || periodLimit === 365) {
    const currentLunarYear = getCurrentLunarYear();
    list = historyData.filter(item => {
      const itemLunarYear = getLunarYearByDate(item.date);
      return itemLunarYear === currentLunarYear;
    }).slice(0, periodLimit === 'all' ? 365 : periodLimit);
  }

  if (list.length === 0) return [];

  const allZodiacScores = [];
  
  ZODIAC_ORDER.forEach(zodiac => {
    const result = calcFourAlgorithmFusion(list, zodiac);
    allZodiacScores.push({
      zodiac: zodiac,
      totalScore: result.totalScore,
      baseScore: result.baseScore,
      hotInertiaBonus: result.hotInertiaBonus,
      missRepairBonus: result.missRepairBonus,
      cycleBalanceBonus: result.cycleBalanceBonus,
      algorithmDetails: result.algorithmDetails
    });
  });

  allZodiacScores.sort((a, b) => b.totalScore - a.totalScore);

  return allZodiacScores;
}

/**
 * 使用四大算法计算精选生肖 - 终极版V3.0
 * 
 * 整体架构（三层结构）：
 * 1. 基础层：四大核心算法（固定基底，不改动）
 * 2. 识别层：5/8/10期多窗口交叉形态识别
 * 3. 融合层：冷热交替专项分支 + 统一加权打分输出结果
 * 
 * 最终打分公式（终极版）：
 * 总得分 = 基础频次分×动态权重 + 热号惯性加分 + 遗漏回补加分 + 轮转平衡得分 + 多窗口形态加权得分 - 过热衰减扣分
 * 
 * @param {Array} historyData - 历史数据
 * @param {number} periodLimit - 分析期数限制
 * @returns {Array} 排序后的生肖数组
 */
export function calcSelectedZodiacsV3(historyData, periodLimit = 30) {
  let list = historyData.slice(0, Math.min(periodLimit, historyData.length));
  
  if (periodLimit === 'all' || periodLimit === 365) {
    const currentLunarYear = getCurrentLunarYear();
    list = historyData.filter(item => {
      const itemLunarYear = getLunarYearByDate(item.date);
      return itemLunarYear === currentLunarYear;
    }).slice(0, periodLimit === 'all' ? 365 : periodLimit);
  }

  if (list.length === 0) return [];

  // 检测冷热交替行情（全局检测，只在第一期计算一次）
  const marketInfo = detectColdHotAlternatingMarket(list);
  const isAlternating = marketInfo.isAlternating;
  const adaptationParams = marketInfo.adaptationParams || {};
  
  const allZodiacScores = [];
  
  ZODIAC_ORDER.forEach(zodiac => {
    // 获取四大基础算法的结果
    const baseResult = calcFourAlgorithmFusion(list, zodiac);
    
    // 获取多窗口形态识别结果
    const patternResult = detectMultiWindowPattern(list, zodiac);
    
    // 计算形态加权得分
    const patternBonus = Math.round(baseResult.totalScore * (patternResult.windowWeight - 1));
    
    // 计算过热衰减扣分（终极版规则1：冷热交替时关闭）
    let overheatPenalty = 0;
    if (!isAlternating) {
      // 非冷热交替行情时应用过热衰减
      if (baseResult.algorithmDetails.hotInertia?.continuousHotCount > 3) {
        overheatPenalty = Math.round(baseResult.hotInertiaBonus * 0.4);
      }
    }
    
    // 冷热交替行情适配（终极版规则2、3、4）
    let adjustedCycleBalance = baseResult.cycleBalanceBonus;
    let adjustedMissRepair = baseResult.missRepairBonus;
    
    if (isAlternating) {
      // 终极版规则2：降低激进冷号回补加分（最多50%）
      if (baseResult.algorithmDetails.missLevel === 'extreme_cold' || 
          baseResult.algorithmDetails.missLevel === 'deep_cold') {
        adjustedMissRepair = Math.round(adjustedMissRepair * adaptationParams.coldReboundDiscount);
      }
      
      // 终极版规则3：轮转平衡权重+25%
      if (adaptationParams.cycleBalanceBoost) {
        adjustedCycleBalance = Math.round(adjustedCycleBalance * adaptationParams.cycleBalanceBoost);
      }
    }
    
    // 终极版规则4：冷热交替时优先选取温态生肖
    let warmPreferenceBonus = 0;
    if (isAlternating && patternResult.midState === 'warm') {
      warmPreferenceBonus = Math.round(baseResult.totalScore * 0.1);
    }
    
    // 终极版最终得分计算
    const v3TotalScore = Math.max(0, Math.round(
      baseResult.totalScore + 
      patternBonus - 
      overheatPenalty + 
      warmPreferenceBonus +
      (adjustedCycleBalance - baseResult.cycleBalanceBonus) +
      (adjustedMissRepair - baseResult.missRepairBonus)
    ));
    
    allZodiacScores.push({
      zodiac: zodiac,
      totalScore: v3TotalScore,
      baseScore: baseResult.baseScore,
      hotInertiaBonus: baseResult.hotInertiaBonus,
      missRepairBonus: adjustedMissRepair,
      cycleBalanceBonus: adjustedCycleBalance,
      patternBonus: patternBonus,
      overheatPenalty: overheatPenalty,
      warmPreferenceBonus: warmPreferenceBonus,
      algorithmDetails: {
        ...baseResult.algorithmDetails,
        // V3新增字段
        pattern: patternResult.pattern,
        patternConfidence: patternResult.patternConfidence,
        patternBonus: patternBonus,
        overheatPenalty: overheatPenalty,
        warmPreferenceBonus: warmPreferenceBonus,
        windowWeight: patternResult.windowWeight,
        weightedWindowWeight: patternResult.weightedWindowWeight,
        multiWindow: {
          short: patternResult.shortState,
          mid: patternResult.midState,
          long: patternResult.longState,
          shortWindow: patternResult.windowConfig.short,
          midWindow: patternResult.windowConfig.mid,
          longWindow: patternResult.windowConfig.long
        },
        validationRule: patternResult.validationRule,
        marketInfo: marketInfo,
        isAlternating: isAlternating,
        adaptationParams: adaptationParams,
        // V3最终得分构成
        scoreComposition: {
          baseScore: baseResult.totalScore,
          patternBonus: patternBonus,
          overheatPenalty: overheatPenalty,
          warmPreferenceBonus: warmPreferenceBonus,
          cycleBalanceAdjustment: adjustedCycleBalance - baseResult.cycleBalanceBonus,
          missRepairAdjustment: adjustedMissRepair - baseResult.missRepairBonus,
          finalScore: v3TotalScore
        }
      }
    });
  });

  allZodiacScores.sort((a, b) => b.totalScore - a.totalScore);

  return allZodiacScores;
}

export default {
  calcHotInertia,
  calcMissRepair,
  calcCycleBalance,
  calcFrequencyScore,
  calcFourAlgorithmFusion,
  calcSelectedZodiacsV2,
  calcSelectedZodiacsV3
};
