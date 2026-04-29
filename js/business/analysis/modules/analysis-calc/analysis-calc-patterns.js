// ====================== 走势模式检测模块 ======================

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
  } else if (stateCounts.hot >= 2) {
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
  } else {
    pattern = '冷热交替';
    patternConfidence = 0.65;
    windowWeight = 0.8;
  }

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
    windowConfig: WINDOWS
  };
}

/**
 * 【专项模块】冷热交替行情适配
 * @param {Array} list - 历史数据列表
 * @returns {Object} 行情检测结果
 */
export function detectColdHotAlternatingMarket(list) {
  if (list.length < 10) return { isAlternating: false, confidence: 0 };

  const recent10 = list.slice(0, 10);
  
  const hotCount = recent10.filter(item => {
    const s = getSpecial(item);
    return s.zodMiss !== undefined && s.zodMiss <= 3;
  }).length;

  const coldCount = recent10.filter(item => {
    const s = getSpecial(item);
    return s.zodMiss !== undefined && s.zodMiss >= 15;
  }).length;

  const isAlternating = coldCount > hotCount * 1.5;
  const confidence = Math.min(0.9, (coldCount / 10) * 1.2);

  return { isAlternating, confidence };
}

export default {
  detectMultiWindowPattern,
  detectColdHotAlternatingMarket
};
