// ====================== 生肖关联分析模块 ======================

import { CONFIG } from '../../../../config.js';
import { PerformanceMonitor } from '../../../../performance-monitor.js';
import { getTopEntry, ZODIAC_ORDER, ZODIAC_ELEMENT, ELEMENT_GENERATE, getZodiacNumbers, getColor, getElement } from './analysis-calc-utils.js';
import { getSpecial } from './analysis-calc-full.js';

// 缓存
const _calcZodiacAnalysisCache = new Map();

/**
 * 计算生肖关联分析（带缓存）
 * @param {Array} historyData - 历史数据
 * @param {number|string} analyzeLimit - 分析期数限制
 * @returns {Object} 分析数据
 */
export function calcZodiacAnalysis(historyData, analyzeLimit) {
  // 检查缓存
  const cacheKey = String(analyzeLimit);
  const cached = _calcZodiacAnalysisCache.get(cacheKey);
  
  // 验证缓存有效性
  if (cached && historyData && historyData.length > 0) {
    const latestExpect = historyData[0].expect;
    if (cached.latestExpect === latestExpect) {
      return cached.result;
    }
  }
  
  // 缓存无效或不存在，执行原始计算逻辑
  const result = calcZodiacAnalysisOriginal(historyData, analyzeLimit);
  
  // 更新缓存
  if (result && historyData && historyData.length > 0) {
    _calcZodiacAnalysisCache.set(cacheKey, {
      latestExpect: historyData[0].expect,
      result: result
    });
  }
  
  return result;
}

/**
 * 原始的生肖关联分析计算
 * @param {Array} historyData - 历史数据
 * @param {number|string} analyzeLimit - 分析期数限制
 * @returns {Object} 分析数据
 */
function calcZodiacAnalysisOriginal(historyData, analyzeLimit) {
  return PerformanceMonitor.monitorProcessing(() => {
    let list = [];
    let total = 0;
    let avgExpect = 12;
    let zodCount = {};
    let lastAppear = {};
    let tailZodMap = {};
    let followMap = {};
    let topZod = [];
    let topTail = [];
    let topColor = [];
    let topHead = [];
    
    // 初始化统计对象
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => { zodCount[z] = 0; lastAppear[z] = -1; });
    for (let t = 0; t <= 9; t++) tailZodMap[t] = {};
    
    if (historyData.length >= 2) {
      // 处理"全年数据"选项
      if (analyzeLimit === 'all' || analyzeLimit === 365) {
        const currentLunarYear = getCurrentLunarYear();
        list = historyData.filter(item => {
          const itemLunarYear = getLunarYearByDate(item.date);
          return itemLunarYear === currentLunarYear;
        });
      } else {
        list = historyData.slice(0, Math.min(analyzeLimit, historyData.length));
      }
      total = list.length;
      avgExpect = total / 12;

      // 波色和头数统计
      const colorCount = { '红': 0, '蓝': 0, '绿': 0 };
      const headCount = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };

      list.forEach((item, idx) => {
        const s = getSpecial(item);
        if (CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) {
          zodCount[s.zod]++;
          if (lastAppear[s.zod] === -1) lastAppear[s.zod] = idx;
        }
        if (CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) {
          tailZodMap[s.tail][s.zod] = (tailZodMap[s.tail][s.zod] || 0) + 1;
        }
        if (s.colorName && colorCount.hasOwnProperty(s.colorName)) {
          colorCount[s.colorName]++;
        }
        if (s.head >= 0 && s.head <= 4) {
          headCount[s.head]++;
        }
      });

      // 跟随统计
      for (let i = 1; i < list.length; i++) {
        const preZod = getSpecial(list[i - 1]).zod;
        const curZod = getSpecial(list[i]).zod;
        if (CONFIG.ANALYSIS.ZODIAC_ALL.includes(preZod) && CONFIG.ANALYSIS.ZODIAC_ALL.includes(curZod)) {
          if (!followMap[preZod]) followMap[preZod] = {};
          followMap[preZod][curZod] = (followMap[preZod][curZod] || 0) + 1;
        }
      }

      // 热门排序
      topZod = getTopEntry(zodCount);
      topTail = Array.from({ length: 10 }, (_, t) => ({
        t, sum: Object.values(tailZodMap[t] || {}).reduce((a, b) => a + b, 0)
      })).sort((a, b) => b.sum - a.sum);
      
      topColor = getTopEntry(colorCount);
      topHead = getTopEntry(headCount);
    }

    // 遗漏期数计算
    const zodMiss = {};
    const zodAvgMiss = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
      zodMiss[z] = lastAppear[z] === -1 ? total : lastAppear[z];
      zodAvgMiss[z] = zodCount[z] > 0 ? (total / zodCount[z]).toFixed(1) : total;
    });

    // 生肖预测算法
    const zodiacScores = {};
    const zodiacDetails = {};

    const hotZodiacs = topZod.slice(0, 3).map(z => z[0]);
    let maxMiss = 0;
    Object.values(zodMiss).forEach(m => { if (m > maxMiss) maxMiss = m; });

    // 间隔规律分析
    const intervalStats = {};
    for (let i = 0; i < 12; i++) intervalStats[i] = 0;
    
    for (let i = 1; i < list.length && i < 30; i++) {
      const preZod = getSpecial(list[i - 1]).zod;
      const curZod = getSpecial(list[i]).zod;
      const preIdx = ZODIAC_ORDER.indexOf(preZod);
      const curIdx = ZODIAC_ORDER.indexOf(curZod);
      if (preIdx !== -1 && curIdx !== -1) {
        let diff = curIdx - preIdx;
        if (diff > 6) diff -= 12;
        if (diff < -6) diff += 12;
        intervalStats[diff + 6]++;
      }
    }
    const commonIntervals = Object.entries(intervalStats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => parseInt(x[0]) - 6);

    const lastZod = list.length > 0 ? getSpecial(list[0]).zod : '';


    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(zod => {
      let score = 0;
      const details = { cold: 0, hot: 0, shape: 0, interval: 0 };

      // 冷号状态 (0-30分)
      const missValue = zodMiss[zod] || 0;
      if (maxMiss > 0 && missValue >= maxMiss * 0.8) {
        details.cold = 30;
        score += 30;
      } else if (missValue >= 24) {
        details.cold = 20;
        score += 20;
      } else if (missValue >= 12) {
        details.cold = 10;
        score += 10;
      }

      // 热号状态 (0-20分)
      if (hotZodiacs.includes(zod)) {
        details.hot = 20;
        score += 20;
      }

      // 形态匹配 (0-30分)
      if (lastZod && ZODIAC_ELEMENT[lastZod] && ZODIAC_ELEMENT[zod]) {
        const lastElement = ZODIAC_ELEMENT[lastZod];
        const currentElement = ZODIAC_ELEMENT[zod];
        if (ELEMENT_GENERATE[lastElement] && ELEMENT_GENERATE[lastElement].includes(currentElement)) {
          details.shape = 15;
          score += 15;
        }
      }

      // 间隔匹配 (0-20分)
      if (lastZod) {
        const lastIdx = ZODIAC_ORDER.indexOf(lastZod);
        const currentIdx = ZODIAC_ORDER.indexOf(zod);
        if (lastIdx !== -1 && currentIdx !== -1) {
          let diff = currentIdx - lastIdx;
          if (diff > 6) diff -= 12;
          if (diff < -6) diff += 12;
          if (commonIntervals.includes(diff)) {
            details.interval = 20;
            score += 20;
          }
        }
      }

      zodiacScores[zod] = score;
      zodiacDetails[zod] = details;
    });

    const sortedZodiacs = getTopEntry(zodiacScores);

    return { list, total, avgExpect, zodCount, zodMiss, zodAvgMiss, tailZodMap, followMap, topZod, topTail, topColor, topHead, zodiacScores, zodiacDetails, sortedZodiacs };
  }, 'dataProcessing');
}

/**
 * 获取当前农历年份
 * @returns {number} 农历年份
 */
export function getCurrentLunarYear() {
  const now = new Date();
  return getLunarYearByDate(now);
}

/**
 * 根据日期获取农历年份
 * @param {Date|string|Object} date - 日期
 * @returns {number} 农历年份
 */
export function getLunarYearByDate(date) {
  let targetDate;
  
  if (date instanceof Date) {
    targetDate = date;
  } else if (typeof date === 'string') {
    targetDate = new Date(date);
  } else if (date && typeof date === 'object' && (date.opentime || date.date)) {
    targetDate = new Date(date.opentime || date.date);
  } else {
    targetDate = new Date();
  }
  
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1;
  const day = targetDate.getDate();
  
  const springFestival = CONFIG.SPRING_FESTIVAL[year] || { month: 1, day: 1 };
  
  if (month < springFestival.month || (month === springFestival.month && day < springFestival.day)) {
    return year - 1;
  }
  
  return year;
}

/**
 * 清除生肖分析缓存
 */
export function clearCache() {
  _calcZodiacAnalysisCache.clear();
}

export default {
  calcZodiacAnalysis,
  getCurrentLunarYear,
  getLunarYearByDate,
  clearCache
};
