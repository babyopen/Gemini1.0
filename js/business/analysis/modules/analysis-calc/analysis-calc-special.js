// ====================== 精选特码算法模块 ======================

import { ZODIAC_ORDER, ZODIAC_ELEMENT, ELEMENT_GENERATE, TAIL_TO_ZODIAC, getZodiacNumbers, getColor, getElement } from './analysis-calc-utils.js';
import { getSpecial } from './analysis-calc-full.js';

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
 * 获取热门号码
 * @param {Object} data - 分析数据
 * @param {number} targetCount - 目标数量
 * @param {Map} fullNumZodiacMap - 号码生肖映射
 * @param {Array} historyData - 历史数据
 * @returns {Array} 号码数组
 */
export function getHotNumbers(data, targetCount, fullNumZodiacMap, historyData) {
  if (historyData && historyData.length > 0) {
    return getHotNumbersV2(historyData, targetCount, fullNumZodiacMap);
  }

  let coreZodiacs = [];
  if (data.sortedZodiacs && data.sortedZodiacs.length > 0) {
    coreZodiacs = data.sortedZodiacs.slice(0, 6).map(i => i[0]);
  } else if (data.topZod && Array.isArray(data.topZod)) {
    coreZodiacs = data.topZod.slice(0, 6).map(i => i[0]);
  } else if (data.zodiac) {
    coreZodiacs = Object.entries(data.zodiac).sort((a, b) => b[1] - a[1]).slice(0, 6).map(i => i[0]);
  }

  let hotTails = [];
  if (data.topTail && Array.isArray(data.topTail) && data.topTail.length > 0) {
    hotTails = data.topTail.slice(0, 6).map(i => i.t !== undefined ? i.t : parseInt(i[0]));
  } else if (data.tail) {
    hotTails = Object.entries(data.tail).sort((a, b) => b[1] - a[1]).slice(0, 6).map(i => parseInt(i[0]));
  }
  
  let hotColors = [];
  if (data.topColor && Array.isArray(data.topColor) && data.topColor.length > 0) {
    hotColors = data.topColor.slice(0, 2).map(i => i[0]);
  } else if (data.color) {
    hotColors = Object.entries(data.color).sort((a, b) => b[1] - a[1]).slice(0, 2).map(i => i[0]);
  }
  
  let hotHeads = [];
  if (data.topHead && Array.isArray(data.topHead) && data.topHead.length > 0) {
    hotHeads = data.topHead.slice(0, 3).map(i => parseInt(i[0]));
  } else if (data.head) {
    hotHeads = Object.entries(data.head).sort((a, b) => b[1] - a[1]).slice(0, 3).map(i => parseInt(i[0]));
  }

  return selectCandidateNumbers(coreZodiacs, hotTails, hotColors, hotHeads, targetCount, fullNumZodiacMap);
}

/**
 * 获取冷号反弹号码
 * @param {Object} data - 分析数据
 * @param {number} targetCount - 目标数量
 * @param {Map} fullNumZodiacMap - 号码生肖映射
 * @returns {Array} 号码数组
 */
export function getColdReboundNumbers(data, targetCount, fullNumZodiacMap) {
  let coreZodiacs = [];
  
  if (data.zodMiss) {
    coreZodiacs = Object.entries(data.zodMiss).sort((a, b) => b[1] - a[1]).slice(0, 6).map(i => i[0]);
  } else if (data.sortedZodiacs && data.sortedZodiacs.length > 0) {
    coreZodiacs = data.sortedZodiacs.slice(-6).map(i => i[0]);
  }

  let hotTails = [];
  if (data.topTail && Array.isArray(data.topTail) && data.topTail.length > 0) {
    hotTails = data.topTail.slice(0, 6).map(i => i.t !== undefined ? i.t : parseInt(i[0]));
  } else if (data.tail) {
    hotTails = Object.entries(data.tail).sort((a, b) => b[1] - a[1]).slice(0, 6).map(i => parseInt(i[0]));
  }
  
  let hotColors = [];
  if (data.topColor && Array.isArray(data.topColor) && data.topColor.length > 0) {
    hotColors = data.topColor.slice(0, 2).map(i => i[0]);
  } else if (data.color) {
    hotColors = Object.entries(data.color).sort((a, b) => b[1] - a[1]).slice(0, 2).map(i => i[0]);
  }
  
  let hotHeads = [];
  if (data.topHead && Array.isArray(data.topHead) && data.topHead.length > 0) {
    hotHeads = data.topHead.slice(0, 3).map(i => parseInt(i[0]));
  } else if (data.head) {
    hotHeads = Object.entries(data.head).sort((a, b) => b[1] - a[1]).slice(0, 3).map(i => parseInt(i[0]));
  }

  return selectCandidateNumbers(coreZodiacs, hotTails, hotColors, hotHeads, targetCount, fullNumZodiacMap);
}

/**
 * 选择候选号码（核心筛选逻辑）
 */
function selectCandidateNumbers(coreZodiacs, hotTails, hotColors, hotHeads, targetCount, fullNumZodiacMap) {
  // 筛选候选号码（必须同时满足4个条件）
  const candidateNums = [];
  for (let num = 1; num <= 49; num++) {
    const zodiac = fullNumZodiacMap.get(num);
    if (!zodiac) continue;
    
    const tail = num % 10;
    const head = Math.floor(num / 10);
    const colorName = getColor(num).name;
    
    if (coreZodiacs.includes(zodiac) && hotTails.includes(tail) && hotColors.includes(colorName) && hotHeads.includes(head)) {
      candidateNums.push(num);
    }
  }
  
  // 如果候选号码不足，放宽条件
  if (candidateNums.length < targetCount) {
    for (let num = 1; num <= 49; num++) {
      if (candidateNums.includes(num)) continue;
      const zodiac = fullNumZodiacMap.get(num);
      if (!zodiac) continue;
      const tail = num % 10;
      const head = Math.floor(num / 10);
      const colorName = getColor(num).name;
      
      let matchCount = 0;
      if (coreZodiacs.includes(zodiac)) matchCount++;
      if (hotTails.includes(tail)) matchCount++;
      if (hotColors.includes(colorName)) matchCount++;
      if (hotHeads.includes(head)) matchCount++;
      
      if (matchCount >= 3) candidateNums.push(num);
    }
  }
  
  if (candidateNums.length < targetCount) {
    for (let num = 1; num <= 49; num++) {
      if (candidateNums.includes(num)) continue;
      const zodiac = fullNumZodiacMap.get(num);
      if (!zodiac) continue;
      const tail = num % 10;
      const head = Math.floor(num / 10);
      const colorName = getColor(num).name;
      
      let matchCount = 0;
      if (coreZodiacs.includes(zodiac)) matchCount++;
      if (hotTails.includes(tail)) matchCount++;
      if (hotColors.includes(colorName)) matchCount++;
      if (hotHeads.includes(head)) matchCount++;
      
      if (matchCount >= 2) candidateNums.push(num);
    }
  }
  
  return candidateNums.slice(0, targetCount);
}

/**
 * 获取热门号码 V2（基于历史数据）
 */
function getHotNumbersV2(historyData, targetCount, fullNumZodiacMap) {
  const list = historyData.slice(0, Math.min(10, historyData.length));
  
  // 统计热门属性
  const tailStats = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
  const colorStats = { '红': 0, '蓝': 0, '绿': 0 };
  const headStats = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  const zodiacCount = {};
  
  list.forEach(item => {
    const s = getSpecial(item);
    tailStats[s.tail]++;
    if (colorStats.hasOwnProperty(s.colorName)) colorStats[s.colorName]++;
    if (s.head >= 0 && s.head <= 4) headStats[s.head]++;
    zodiacCount[s.zod] = (zodiacCount[s.zod] || 0) + 1;
  });
  
  const topZodiacs = Object.entries(zodiacCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(i => i[0]);
  const hotTails = Object.entries(tailStats).sort((a, b) => b[1] - a[1]).slice(0, 6).map(i => parseInt(i[0]));
  const hotColors = Object.entries(colorStats).sort((a, b) => b[1] - a[1]).slice(0, 2).map(i => i[0]);
  const hotHeads = Object.entries(headStats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(i => parseInt(i[0]));
  
  return selectCandidateNumbers(topZodiacs, hotTails, hotColors, hotHeads, targetCount, fullNumZodiacMap);
}

export default {
  decideAutoMode,
  getHotNumbers,
  getColdReboundNumbers
};
