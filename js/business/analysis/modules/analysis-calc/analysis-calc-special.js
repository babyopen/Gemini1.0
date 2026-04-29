// ====================== 精选特码算法模块 V2.0 ======================
// 重构说明：
// - 整合三窗口交叉形态识别（5/8/10期）
// - 结合四大核心算法统一打分
// - 冷热交替行情适配

import { ZODIAC_ORDER, getColor, getElement } from './analysis-calc-utils.js';
import { getSpecial } from './analysis-calc-full.js';
import { 
  calcHotInertia, 
  calcMissRepair, 
  calcCycleBalance, 
  calcFrequencyScore,
  calcFourAlgorithmFusion 
} from './analysis-calc-core.js';
import { detectMultiWindowPattern, detectColdHotAlternatingMarket } from './analysis-calc-patterns.js';

/**
 * 自动模式决策
 * @param {Object} data - 分析数据
 * @returns {string} 模式名称
 */
export function decideAutoMode(data) {
  if (!data || !data.total) return 'hot';
  
  const hotCount = data.miss ? data.miss.hot : 0;
  const coldCount = data.miss ? data.miss.cold : 0;
  
  if (coldCount > hotCount) return 'cold';
  return 'hot';
}

/**
 * 统一的号码打分系统（核心公式）
 * 总得分 = 基础频次分×动态权重 + 热号惯性加分 + 遗漏回补加分 + 轮转平衡得分 + 多窗口形态加权 - 过热衰减扣分
 * @param {number} num - 号码
 * @param {Object} params - 参数字段
 * @returns {Object} 得分详情
 */
function calcNumberScore(num, params) {
  const {
    fullNumZodiacMap,
    historyData,
    isAlternatingMarket,
    patternWeight = 1.0
  } = params;

  const zodiac = fullNumZodiacMap.get(num);
  const list = historyData;
  const totalPeriods = list.length;

  if (!zodiac || totalPeriods === 0) {
    return { totalScore: 0, baseScore: 0, bonusDetails: {} };
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

  const freqResult = calcFrequencyScore(zodCount[zodiac], totalPeriods, list);
  const hotInertiaResult = calcHotInertia(list, zodiac, totalPeriods);
  const missRepairResult = calcMissRepair(zodMiss[zodiac], avgMiss, totalPeriods);
  const cycleBalanceResult = calcCycleBalance(zodiac, zodiacStateMap, zodCount[zodiac], totalPeriods, list);

  let hotInertiaBonus = hotInertiaResult.hotInertiaBonus;
  let missRepairBonus = missRepairResult.missRepairBonus;
  let cycleBalanceBonus = cycleBalanceResult.cycleBalanceBonus;

  // 冷热交替行情适配
  if (isAlternatingMarket) {
    cycleBalanceBonus *= 1.25;
    if (hotInertiaResult.continuousHotCount > 3) {
      hotInertiaBonus *= 0.6;
    }
  }

  // 动态权重计算
  const dynamicWeight = 1.0 + hotInertiaResult.hotInertiaCoeff + missRepairResult.missRepairCoeff;
  
  // 多窗口形态加权
  const patternResult = detectMultiWindowPattern(list, zodiac);
  const windowWeight = patternResult.windowWeight;

  // 总得分公式
  const baseWithWeight = freqResult.baseScore * dynamicWeight * patternWeight * windowWeight;
  const totalScore = Math.round(
    baseWithWeight +
    hotInertiaBonus +
    missRepairBonus +
    cycleBalanceBonus
  );

  return {
    num,
    zodiac,
    totalScore: Math.max(0, totalScore),
    baseScore: freqResult.baseScore,
    hotInertiaBonus,
    missRepairBonus,
    cycleBalanceBonus,
    patternName: patternResult.pattern,
    patternConfidence: patternResult.patternConfidence,
    windowWeight,
    bonusDetails: {
      dynamicWeight,
      hotInertiaCoeff: hotInertiaResult.hotInertiaCoeff,
      missRepairCoeff: missRepairResult.missRepairCoeff,
      cycleState: cycleBalanceResult.cycleState,
      missLevel: missRepairResult.missLevel
    }
  };
}

/**
 * 获取热门号码 V2（新逻辑）
 * 使用三窗口交叉形态识别 + 四大核心算法统一打分
 * @param {Array} historyData - 历史数据
 * @param {number} targetCount - 目标数量
 * @param {Map} fullNumZodiacMap - 号码生肖映射
 * @returns {Array} 号码数组（包含得分详情）
 */
export function getHotNumbers(data, targetCount, fullNumZodiacMap, historyData) {
  const list = historyData && historyData.length > 0 ? historyData : (data?.historyData || []);
  
  if (list.length === 0) return [];

  // 检测冷热交替行情
  const marketResult = detectColdHotAlternatingMarket(list);
  const isAlternatingMarket = marketResult.isAlternating;

  // 统计近期热门属性（用于形态识别）
  const recentStats = calcRecentStats(list);

  // 对所有49个号码计算统一得分
  const allScores = [];
  
  for (let num = 1; num <= 49; num++) {
    if (!fullNumZodiacMap.has(num)) continue;
    
    const scoreResult = calcNumberScore(num, {
      fullNumZodiacMap,
      historyData: list,
      isAlternatingMarket,
      recentStats,
      patternWeight: 1.0
    });
    
    allScores.push(scoreResult);
  }

  // 按总分排序
  allScores.sort((a, b) => b.totalScore - a.totalScore);

  // 返回目标数量的号码（提取号码数字）
  return allScores.slice(0, targetCount).map(item => item.num);
}

/**
 * 计算近期统计特征
 * @param {Array} list - 历史数据
 * @returns {Object} 统计结果
 */
function calcRecentStats(list) {
  const stats = {
    tailStats: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
    colorStats: { '红': 0, '蓝': 0, '绿': 0 },
    headStats: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
    zodiacCount: {}
  };

  const recentList = list.slice(0, Math.min(10, list.length));
  
  recentList.forEach(item => {
    const s = getSpecial(item);
    
    if (s.tail !== undefined && s.tail >= 0 && s.tail <= 9) {
      stats.tailStats[s.tail]++;
    }
    if (s.colorName && stats.colorStats.hasOwnProperty(s.colorName)) {
      stats.colorStats[s.colorName]++;
    }
    if (s.head !== undefined && s.head >= 0 && s.head <= 4) {
      stats.headStats[s.head]++;
    }
    if (s.zod) {
      stats.zodiacCount[s.zod] = (stats.zodiacCount[s.zod] || 0) + 1;
    }
  });

  stats.hotTails = Object.entries(stats.tailStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(item => parseInt(item[0]));
  
  stats.hotColors = Object.entries(stats.colorStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(item => item[0]);
  
  stats.hotHeads = Object.entries(stats.headStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(item => parseInt(item[0]));
  
  stats.topZodiacs = Object.entries(stats.zodiacCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(item => item[0]);

  return stats;
}

/**
 * 获取冷号反弹号码
 * @param {Object} data - 分析数据
 * @param {number} targetCount - 目标数量
 * @param {Map} fullNumZodiacMap - 号码生肖映射
 * @returns {Array} 号码数组
 */
export function getColdReboundNumbers(data, targetCount, fullNumZodiacMap) {
  const list = data?.historyData || [];
  
  if (list.length === 0) return [];

  const allScores = [];
  
  for (let num = 1; num <= 49; num++) {
    if (!fullNumZodiacMap.has(num)) continue;
    
    const zodiac = fullNumZodiacMap.get(num);
    const totalPeriods = list.length;

    const zodMiss = {};
    ZODIAC_ORDER.forEach(z => { zodMiss[z] = totalPeriods; });
    list.forEach((item, idx) => {
      const s = getSpecial(item);
      if (zodMiss[s.zod] === totalPeriods) {
        zodMiss[s.zod] = idx;
      }
    });

    const avgMiss = totalPeriods / 12;
    const missRepairResult = calcMissRepair(zodMiss[zodiac], avgMiss, totalPeriods);

    const missBonus = missRepairResult.missRepairBonus;
    const missLevel = missRepairResult.missLevel;

    const score = missBonus + (missLevel === 'extreme_cold' ? 10 : 0) + (missLevel === 'deep_cold' ? 5 : 0);
    
    allScores.push({
      num,
      zodiac,
      totalScore: score,
      missBonus,
      missLevel,
      missPeriod: zodMiss[zodiac]
    });
  }

  allScores.sort((a, b) => b.totalScore - a.totalScore);
  
  // 返回号码数字数组
  return allScores.slice(0, targetCount).map(item => item.num);
}

/**
 * 三窗口交叉验证得分
 * @param {Array} list - 历史数据
 * @param {string} zodiac - 生肖名称
 * @returns {Object} 窗口得分
 */
function calcWindowCrossScore(list, zodiac) {
  const WINDOWS = {
    short: 5,
    mid: 8,
    long: 10
  };

  const getZodiacState = (periodList) => {
    const counts = {};
    ZODIAC_ORDER.forEach(z => counts[z] = 0);
    periodList.forEach(item => {
      const z = getSpecial(item).zod;
      if (counts.hasOwnProperty(z)) counts[z]++;
    });
    
    const targetCount = counts[zodiac] || 0;
    const avg = periodList.length / 12;
    
    if (targetCount >= avg * 1.5) return 'hot';
    if (targetCount <= avg * 0.5) return 'cold';
    return 'warm';
  };

  const shortList = list.slice(0, WINDOWS.short);
  const midList = list.slice(0, WINDOWS.mid);
  const longList = list.slice(0, WINDOWS.long);

  const shortState = shortList.length >= 3 ? getZodiacState(shortList) : 'warm';
  const midState = midList.length >= 5 ? getZodiacState(midList) : 'warm';
  const longState = longList.length >= 7 ? getZodiacState(longList) : 'warm';

  const stateScore = { hot: 3, warm: 2, cold: 1 };
  
  const totalStateScore = stateScore[shortState] + stateScore[midState] * 1.5 + stateScore[longState];
  const maxScore = stateScore.hot * (1 + 1.5 + 1);

  return {
    windowScore: totalStateScore / maxScore,
    shortState,
    midState,
    longState,
    midWeight: 1.5
  };
}

/**
 * 获取热门号码 V3（四大核心算法版）
 * 使用热号惯性 + 冷号回补 + 轮换平衡 + 频次统计
 * @param {Array} historyData - 历史数据
 * @param {number} targetCount - 目标数量
 * @param {Map} fullNumZodiacMap - 号码生肖映射
 * @returns {Array} 号码数组
 */
export function getHotNumbersV3(data, targetCount, fullNumZodiacMap, historyData) {
  return getHotNumbers(data, targetCount, fullNumZodiacMap, historyData);
}

/**
 * 获取冷号反弹号码 V3（四大核心算法版）
 * 使用冷号遗漏回补算法
 * @param {Object} data - 分析数据
 * @param {number} targetCount - 目标数量
 * @param {Map} fullNumZodiacMap - 号码生肖映射
 * @returns {Array} 号码数组
 */
export function getColdReboundNumbersV3(data, targetCount, fullNumZodiacMap) {
  return getColdReboundNumbers(data, targetCount, fullNumZodiacMap);
}

export default {
  decideAutoMode,
  getHotNumbers,
  getColdReboundNumbers,
  getHotNumbersV3,
  getColdReboundNumbersV3,
  calcNumberScore,
  calcRecentStats
};