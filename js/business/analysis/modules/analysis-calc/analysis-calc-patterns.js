// ====================== 走势模式检测模块 V2.0 ======================
// 重构说明：
// - 完善多窗口交叉形态识别
// - 优化冷热交替行情检测
// - 支持7种标准走势识别

import { ZODIAC_ORDER } from './analysis-calc-utils.js';
import { getSpecial } from './analysis-calc-full.js';

/**
 * 【核心模块】多窗口交叉形态识别
 * 识别7种标准走势
 * @param {Array} list - 历史数据列表
 * @param {string} targetZodiac - 目标生肖
 * @returns {Object} 模式检测结果
 */
export function detectMultiWindowPattern(list, targetZodiac) {
  const WINDOWS = {
    short: 5,
    mid: 8,
    long: 10
  };

  const avgCount = list.length / 12;

  const getZodiacState = (periodList) => {
    const counts = {};
    ZODIAC_ORDER.forEach(z => counts[z] = 0);
    periodList.forEach(item => {
      const z = getSpecial(item).zod;
      if (counts.hasOwnProperty(z)) counts[z]++;
    });
    
    const targetCount = counts[targetZodiac] || 0;
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

  const states = [shortState, midState, longState];
  const stateCounts = { hot: 0, warm: 0, cold: 0 };
  states.forEach(s => stateCounts[s]++);

  let pattern = '';
  let patternConfidence = 0;
  let windowWeight = 1;

  // 三窗口一致：信号有效，权重拉满
  if (stateCounts.hot === 3) {
    pattern = '持续热肖';
    patternConfidence = 0.95;
    windowWeight = 1.2;
  } else if (stateCounts.cold === 3) {
    pattern = '持续冷肖';
    patternConfidence = 0.9;
    windowWeight = 1.1;
  } else if (stateCounts.warm === 3) {
    pattern = '温态肖';
    patternConfidence = 0.8;
    windowWeight = 1.0;
  } 
  // 两窗口一致：按多数判定，适度降权
  else if (stateCounts.hot >= 2) {
    pattern = '先热后冷';
    patternConfidence = 0.75;
    windowWeight = 0.9;
  } else if (stateCounts.cold >= 2) {
    pattern = '先冷后热';
    patternConfidence = 0.75;
    windowWeight = 0.95;
  } else if (stateCounts.warm >= 2) {
    pattern = '震荡轮转';
    patternConfidence = 0.7;
    windowWeight = 0.85;
  } 
  // 三窗口全冲突：无序震荡，启用轮转平衡算法
  else {
    pattern = '冷热交替';
    patternConfidence = 0.65;
    windowWeight = 0.8;
  }

  // 检测三窗口全冲突
  if (states[0] !== states[1] && states[1] !== states[2] && states[0] !== states[2]) {
    pattern = '无序震荡';
    patternConfidence = 0.5;
    windowWeight = 0.6;
  }

  return {
    pattern,
    patternConfidence,
    windowWeight,
    shortState,
    midState,
    longState,
    windowConfig: WINDOWS,
    stateCounts
  };
}

/**
 * 【专项模块】冷热交替行情适配检测
 * 优化版：更准确的行情特征检测
 * @param {Array} list - 历史数据列表
 * @returns {Object} 行情检测结果
 */
export function detectColdHotAlternatingMarket(list) {
  if (list.length < 10) {
    return { 
      isAlternating: false, 
      confidence: 0,
      marketType: 'insufficient_data'
    };
  }

  const recent10 = list.slice(0, 10);
  
  const zodMiss = {};
  ZODIAC_ORDER.forEach(z => { zodMiss[z] = 10; });
  recent10.forEach((item, idx) => {
    const s = getSpecial(item);
    if (zodMiss[s.zod] === 10) {
      zodMiss[s.zod] = idx;
    }
  });

  const avgMiss = 10 / 12;
  
  let hotCount = 0;
  let warmCount = 0;
  let coldCount = 0;
  let extremeColdCount = 0;

  ZODIAC_ORDER.forEach(z => {
    const miss = zodMiss[z];
    if (miss <= 3) {
      hotCount++;
    } else if (miss <= avgMiss * 1.5) {
      warmCount++;
    } else if (miss < 15) {
      coldCount++;
    } else {
      extremeColdCount++;
    }
  });

  const hotRatio = hotCount / 12;
  const warmRatio = warmCount / 12;
  const coldRatio = coldCount / 12;
  const extremeColdRatio = extremeColdCount / 12;

  // 检测冷热交替特征
  // 特征1：没有长连热（hotRatio 不会太高）
  // 特征2：没有长期死冷（extremeColdRatio 不会太高）
  // 特征3：温态生肖占比高
  const hasNoLongHot = hotRatio < 0.4;
  const hasNoDeadCold = extremeColdRatio < 0.3;
  const hasMoreWarm = warmRatio > 0.3;
  
  // 计算冷热变化频率
  let alternationCount = 0;
  for (let i = 1; i < Math.min(10, recent10.length); i++) {
    const prevZod = getSpecial(recent10[i-1]).zod;
    const currZod = getSpecial(recent10[i]).zod;
    if (prevZod !== currZod) {
      alternationCount++;
    }
  }
  const alternationRate = alternationCount / 9;

  // 综合判断
  const isAlternating = (
    hasNoLongHot && 
    hasNoDeadCold && 
    hasMoreWarm && 
    alternationRate > 0.6
  );

  const confidence = Math.min(0.95, (
    (hasNoLongHot ? 0.2 : 0) +
    (hasNoDeadCold ? 0.2 : 0) +
    (hasMoreWarm ? 0.15 : 0) +
    (alternationRate > 0.6 ? 0.25 : alternationRate * 0.3)
  ));

  let marketType = 'normal';
  if (isAlternating) {
    marketType = 'cold_hot_alternating';
  } else if (hotRatio > 0.5) {
    marketType = 'continuous_hot';
  } else if (extremeColdRatio > 0.4) {
    marketType = 'continuous_cold';
  }

  return {
    isAlternating,
    confidence,
    marketType,
    stats: {
      hotCount,
      warmCount,
      coldCount,
      extremeColdCount,
      alternationRate
    },
    signals: {
      hasNoLongHot,
      hasNoDeadCold,
      hasMoreWarm,
      highAlternation: alternationRate > 0.6
    }
  };
}

/**
 * 识别号码的属性状态
 * @param {number} num - 号码
 * @param {string} zodiac - 生肖
 * @param {Object} zodMiss - 遗漏数据
 * @param {Object} zodCount - 次数数据
 * @param {number} totalPeriods - 总期数
 * @returns {Object} 属性状态
 */
export function getNumberAttributeState(num, zodiac, zodMiss, zodCount, totalPeriods) {
  const avgMiss = totalPeriods / 12;
  const avgCount = totalPeriods / 12;

  const miss = zodMiss[zodiac];
  const count = zodCount[zodiac];

  let state = 'normal';
  let stateLevel = 0;

  if (count >= avgCount * 1.5 && miss <= 3) {
    state = 'hot';
    stateLevel = 2;
  } else if (count >= avgCount * 1.2) {
    state = 'warm';
    stateLevel = 1;
  } else if (count <= avgCount * 0.5 || miss >= avgMiss * 2) {
    state = 'cold';
    stateLevel = -1;
  } else if (miss >= avgMiss * 1.5) {
    state = 'cold';
    stateLevel = -2;
  }

  return {
    state,
    stateLevel,
    missPeriod: miss,
    appearCount: count,
    tail: num % 10,
    head: Math.floor(num / 10)
  };
}

export default {
  detectMultiWindowPattern,
  detectColdHotAlternatingMarket,
  getNumberAttributeState
};