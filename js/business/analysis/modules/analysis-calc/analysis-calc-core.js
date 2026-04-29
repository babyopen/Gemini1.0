// ====================== 四大核心算法模块 ======================

import { ZODIAC_ORDER, ZODIAC_ELEMENT, ELEMENT_GENERATE, getZodiacNumbers, getColor, getElement } from './analysis-calc-utils.js';
import { getSpecial } from './analysis-calc-full.js';
import { getCurrentLunarYear, getLunarYearByDate } from './analysis-calc-zodiac.js';

/**
 * 【算法一】热号惯性算法
 * 核心目的：利用短期开奖惯性，近期开出的生肖有延续出号概率
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
    isContinuousHot: false,
    continuousHotCount: 0
  };

  if (!list || list.length < 2) return result;

  const recent2Zodiacs = [
    getSpecial(list[0]).zod,
    getSpecial(list[1]).zod
  ];

  result.recent2Zodiac = recent2Zodiacs;

  let hotCount = 0;
  recent2Zodiacs.forEach(z => { if (z === zodiac) hotCount++; });

  if (hotCount > 0) {
    result.continuousHotCount = hotCount;
    result.isContinuousHot = recent2Zodiacs[0] === recent2Zodiacs[1];

    if (result.isContinuousHot && zodiac === recent2Zodiacs[0]) {
      result.hotInertiaCoeff = 0.15;
      result.hotInertiaBonus = 15;
    } else if (hotCount >= 1) {
      result.hotInertiaCoeff = 0.10;
      result.hotInertiaBonus = 10;
    }

    const recent3 = list.slice(0, Math.min(3, list.length));
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

    if (streakCount > 3) {
      const decayFactor = Math.max(0.5, 1 - (streakCount - 3) * 0.1);
      result.hotInertiaBonus = Math.round(result.hotInertiaBonus * decayFactor);
    }
  }

  return result;
}

/**
 * 【算法二】冷号遗漏回补算法
 * 核心目的：大数规律下，长期遗漏不出的生肖存在概率回补修复需求
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
    missPeriod: missPeriod
  };

  const DEEP_COLD_THRESHOLD = 15;
  const EXTREME_COLD_THRESHOLD = 30;
  const LIGHT_MISS_MIN = 5;
  const LIGHT_MISS_MAX = 14;

  if (missPeriod >= EXTREME_COLD_THRESHOLD) {
    result.missLevel = 'extreme_cold';
    const maxBonus = 25;
    const overflow = missPeriod - EXTREME_COLD_THRESHOLD;
    const overflowRatio = Math.min(overflow / 20, 0.5);
    result.missRepairBonus = Math.round(maxBonus * (1 - overflowRatio));
    result.missRepairCoeff = Math.round(result.missRepairBonus / 30 * 15) / 10;
  } else if (missPeriod >= DEEP_COLD_THRESHOLD) {
    result.missLevel = 'deep_cold';
    const overflow = missPeriod - DEEP_COLD_THRESHOLD;
    result.missRepairBonus = Math.round(20 + overflow * 0.5);
    result.missRepairCoeff = 0.5 + Math.min(overflow * 0.05, 0.3);
  } else if (missPeriod >= LIGHT_MISS_MIN && missPeriod <= LIGHT_MISS_MAX) {
    result.missLevel = 'light_cold';
    const factor = (missPeriod - LIGHT_MISS_MIN) / (LIGHT_MISS_MAX - LIGHT_MISS_MIN);
    result.missRepairBonus = Math.round(5 + factor * 10);
    result.missRepairCoeff = 0.2 + factor * 0.3;
  } else {
    result.missLevel = 'normal';
    result.missRepairBonus = missPeriod > avgMiss ? Math.round((missPeriod - avgMiss) * 0.5) : 0;
    result.missRepairCoeff = 0;
  }

  return result;
}

/**
 * 【算法三】生肖轮换平衡算法
 * 核心目的：12生肖不会长期扎堆开出，遵循热转温、温转冷、冷转回补自然轮转
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
    balanceScore: 0
  };

  const avgCount = totalPeriods / 12;
  const hotThreshold = avgCount * 1.3;
  const coldThreshold = avgCount * 0.7;

  if (currentHotCount >= hotThreshold) {
    result.cycleState = 'hot';
    result.cycleBalanceBonus = -5;
    result.balanceScore = -5;
  } else if (currentHotCount <= coldThreshold) {
    result.cycleState = 'cold';
    const coldRatio = 1 - (currentHotCount / coldThreshold);
    result.cycleBalanceBonus = Math.round(10 + coldRatio * 15);
    result.balanceScore = result.cycleBalanceBonus;
  } else {
    result.cycleState = 'warm';
    result.cycleBalanceBonus = 3;
    result.balanceScore = 3;
  }

  const recent5 = list.slice(0, Math.min(5, list.length));
  const recent5Zodiacs = recent5.map(item => getSpecial(item).zod);
  const hotZodiacInRecent5 = recent5Zodiacs.filter(z => z === zodiac).length;

  if (hotZodiacInRecent5 >= 2) {
    result.cycleBalanceBonus -= 3;
    result.balanceScore -= 3;
  }

  const recent10 = list.slice(0, Math.min(10, list.length));
  const coldZodiacInRecent10 = recent10.filter(item => {
    const z = getSpecial(item).zod;
    return zodiacStateMap[z] === 'cold' || zodiacStateMap[z] === 'extreme_cold';
  }).length;

  if (coldZodiacInRecent10 >= 7 && result.cycleState !== 'hot') {
    result.cycleBalanceBonus += 5;
    result.balanceScore += 5;
  }

  return result;
}

/**
 * 【算法四】频次统计排序算法
 * 核心目的：以历史整体开出频率作为模型基础得分盘口
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
    shortTermScore: 0
  };

  const totalRatio = count / totalPeriods;
  result.longTermScore = Math.round(totalRatio * 40);

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
  const recent30Ratio = recent30Count[ZODIAC_ORDER[0]] !== undefined ? count / recent30Total : totalRatio;
  result.shortTermScore = Math.round(Math.min(recent30Ratio, 1) * 30);

  result.baseScore = Math.round(
    result.longTermWeight * result.longTermScore +
    result.shortTermWeight * result.shortTermScore
  );

  return result;
}

/**
 * ========================================
 * 综合算法融合 - 总公式计算
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
      algorithmDetails: {}
    };
  }

  const zodMiss = {};
  ZODIAC_ORDER.forEach(z => { zodMiss[z] = totalPeriods; });
  list.forEach((item, idx) => {
    const s = getSpecial(item);
    if (zodMiss[s.zod] === totalPeriods) {
      zodMiss[s.zod] = idx;
    }
  });

  const avgMiss = totalPeriods / 12;

  const zodCount = {};
  ZODIAC_ORDER.forEach(z => { zodCount[z] = 0; });
  list.forEach(item => {
    const s = getSpecial(item);
    zodCount[s.zod]++;
  });

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

  const dynamicWeight = 1.0 + hotInertiaResult.hotInertiaCoeff + missRepairResult.missRepairCoeff;
  const baseWithWeight = freqResult.baseScore * dynamicWeight;
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
    algorithmDetails: {
      hotInertia: hotInertiaResult,
      missRepair: missRepairResult,
      cycleBalance: cycleBalanceResult,
      frequency: freqResult,
      dynamicWeight: dynamicWeight,
      missPeriod: zodMiss[targetZodiac],
      recent2Zodiac: hotInertiaResult.recent2Zodiac,
      cycleState: cycleBalanceResult.cycleState,
      missLevel: missRepairResult.missLevel
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

export default {
  calcHotInertia,
  calcMissRepair,
  calcCycleBalance,
  calcFrequencyScore,
  calcFourAlgorithmFusion,
  calcSelectedZodiacsV2
};
