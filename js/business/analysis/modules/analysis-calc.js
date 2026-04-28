// ====================== 分析计算模块 - 主入口 ======================
/**
 * 分析计算模块
 * 
 * 模块结构：
 * - analysis-calc-utils.js      : 工具函数和常量
 * - analysis-calc-full.js      : 全维度分析
 * - analysis-calc-zodiac.js     : 生肖关联分析
 * - analysis-calc-continuous.js : 五维度评分算法
 * - analysis-calc-special.js    : 精选特码算法
 * - analysis-calc-core.js        : 四大核心算法
 * - analysis-calc-patterns.js    : 走势模式检测
 */

import { CONFIG } from '../../../config.js';
import { StateManager } from '../../../state-manager.js';
import { PerformanceMonitor } from '../../../performance-monitor.js';

// 导出所有子模块
export * from './analysis-calc/analysis-calc-utils.js';
export * from './analysis-calc/analysis-calc-full.js';
export * from './analysis-calc/analysis-calc-zodiac.js';
export * from './analysis-calc/analysis-calc-continuous.js';
export * from './analysis-calc/analysis-calc-special.js';
export * from './analysis-calc/analysis-calc-core.js';
export * from './analysis-calc/analysis-calc-patterns.js';

// 导入子模块
import { 
  getColor as _getColor, 
  getElement as _getElement,
  getTopEntry,
  ZODIAC_NUMBERS,
  ZODIAC_ELEMENT,
  ELEMENT_GENERATE,
  TAIL_TO_ZODIAC,
  ZODIAC_ORDER,
  getZodiacNumbers
} from './analysis-calc/analysis-calc-utils.js';

import { 
  calcFullAnalysis as _calcFullAnalysis,
  getSpecial as _getSpecial,
  getZodiacLevel as _getZodiacLevel,
  buildBall as _buildBall
} from './analysis-calc/analysis-calc-full.js';

import {
  calcZodiacAnalysis as _calcZodiacAnalysis,
  getCurrentLunarYear as _getCurrentLunarYear,
  getLunarYearByDate as _getLunarYearByDate
} from './analysis-calc/analysis-calc-zodiac.js';

import { calcContinuousScores as _calcContinuousScores } from './analysis-calc/analysis-calc-continuous.js';
import { getHotNumbers, getColdReboundNumbers, decideAutoMode } from './analysis-calc/analysis-calc-special.js';
import { 
  calcSelectedZodiacsV2, 
  calcFourAlgorithmFusion,
  calcHotInertia,
  calcMissRepair,
  calcCycleBalance,
  calcFrequencyScore
} from './analysis-calc/analysis-calc-core.js';
import { 
  detectMultiWindowPattern,
  detectColdHotAlternatingMarket
} from './analysis-calc/analysis-calc-patterns.js';

// 缓存
const _colorCache = new Map();
const _elementCache = new Map();

// 兼容旧接口的缓存
const _calcZodiacAnalysisCache = new Map();

// 兼容旧接口的工具函数
function getColor(number) {
  if (_colorCache.has(number)) return _colorCache.get(number);
  const result = _getColor(number);
  _colorCache.set(number, result);
  return result;
}

function getElement(number) {
  if (_elementCache.has(number)) return _elementCache.get(number);
  const result = _getElement(number);
  _elementCache.set(number, result);
  return result;
}

// 主分析计算对象
export const analysisCalc = {
  // 缓存
  _calcZodiacAnalysisCache,
  _colorCache,
  _elementCache,

  // 工具方法
  getTopEntry,
  getColor,
  getElement,
  getZodiacNumbers,
  buildBall: _buildBall,

  // 全维度分析
  calcFullAnalysis: () => {
    const state = StateManager._state;
    const { historyData, analyzeLimit } = state.analysis;
    return _calcFullAnalysis(historyData, analyzeLimit);
  },

  // 生肖关联分析（带缓存）
  calcZodiacAnalysis: (customAnalyzeLimit) => {
    const state = StateManager._state;
    const { historyData } = state.analysis;
    const analyzeLimit = customAnalyzeLimit !== undefined ? customAnalyzeLimit : state.analysis.analyzeLimit;
    return _calcZodiacAnalysis(historyData, analyzeLimit);
  },

  // 原始生肖分析（无缓存）
  _calcZodiacAnalysisOriginal: (customAnalyzeLimit) => {
    const state = StateManager._state;
    const { historyData } = state.analysis;
    const analyzeLimit = customAnalyzeLimit !== undefined ? customAnalyzeLimit : state.analysis.analyzeLimit;
    return _calcZodiacAnalysis(historyData, analyzeLimit);
  },

  // 特码信息
  getSpecial: (item) => _getSpecial(item),

  // 生肖热度等级
  getZodiacLevel: (count, miss, total) => _getZodiacLevel(count, miss, total),

  // 农历年份
  getCurrentLunarYear: () => _getCurrentLunarYear(),
  getLunarYearByDate: (date) => _getLunarYearByDate(date),

  // 五维度评分
  calcContinuousScores: (data) => _calcContinuousScores(data),

  // 获取五行
  getWuxing: (number) => {
    const element = Object.keys(CONFIG.ELEMENT_MAP).find(e => CONFIG.ELEMENT_MAP[e].includes(number));
    return element || '金';
  },

  // 热门/冷号号码
  getHotNumbers: (data, targetCount, fullNumZodiacMap) => {
    const state = StateManager._state;
    const historyData = state.analysis?.historyData || [];
    return getHotNumbers(data, targetCount, fullNumZodiacMap, historyData);
  },

  getColdReboundNumbers: (data, targetCount, fullNumZodiacMap) => {
    return getColdReboundNumbers(data, targetCount, fullNumZodiacMap);
  },

  decideAutoMode: (data) => decideAutoMode(data),

  // 四大算法
  calcFourAlgorithmFusion: (list, targetZodiac) => calcFourAlgorithmFusion(list, targetZodiac),

  // 精选生肖 V2
  calcSelectedZodiacsV2: (periodLimit) => {
    const state = StateManager._state;
    const { historyData } = state.analysis;
    return calcSelectedZodiacsV2(historyData, periodLimit);
  },

  getSelectedZodiacsWithPeriods: (periodLimit) => {
    const periodOptions = [10, 20, 30];
    const result = new Map();

    periodOptions.forEach((period, periodIndex) => {
      const rankedZodiacs = analysisCalc.calcSelectedZodiacsV2(period);
      if (rankedZodiacs && rankedZodiacs.length > 0) {
        rankedZodiacs.slice(0, 3).forEach((item) => {
          if (!result.has(item.zodiac)) {
            result.set(item.zodiac, []);
          }
          result.get(item.zodiac).push(periodIndex + 1);
        });
      }
    });

    return result;
  },

  getSelectedZodiacsSimple: () => {
    const result = new Map();
    const periods = [10, 20, 30];

    periods.forEach((period, periodIndex) => {
      const rankedZodiacs = analysisCalc.calcSelectedZodiacsV2(period);
      if (rankedZodiacs && rankedZodiacs.length > 0) {
        rankedZodiacs.slice(0, 3).forEach((item) => {
          if (!result.has(item.zodiac)) {
            result.set(item.zodiac, []);
          }
          result.get(item.zodiac).push(periodIndex + 1);
        });
      }
    });

    return Array.from(result.keys());
  },

  // 获取精选特码 V2
  getSpecialNumbersV2: (targetCount = 10, mode = 'hot') => {
    const rankedZodiacs = analysisCalc.calcSelectedZodiacsV2(30);
    const state = StateManager._state;
    const config = state.config || {};
    const fullNumZodiacMap = config.fullNumZodiacMap || new Map();

    if (rankedZodiacs.length === 0) return [];

    let targetZodiacs = [];
    if (mode === 'hot') {
      targetZodiacs = rankedZodiacs.slice(0, 6).map(item => item.zodiac);
    } else if (mode === 'cold') {
      targetZodiacs = rankedZodiacs.slice(-6).map(item => item.zodiac);
    } else {
      const autoHotCount = rankedZodiacs.filter(item => 
        item.algorithmDetails?.missLevel === 'normal' || item.algorithmDetails?.missLevel === 'warm'
      ).length;
      targetZodiacs = rankedZodiacs.slice(0, Math.max(3, Math.ceil(autoHotCount / 2))).map(item => item.zodiac);
    }

    const historyData = state.analysis.historyData || [];
    const recent10 = historyData.slice(0, 10);
    const tailStats = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    const colorStats = { '红': 0, '蓝': 0, '绿': 0 };
    const headStats = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };

    recent10.forEach(item => {
      const s = analysisCalc.getSpecial(item);
      if (s.tail !== undefined) tailStats[s.tail]++;
      if (s.colorName) colorStats[s.colorName]++;
      if (s.head !== undefined && s.head >= 0 && s.head <= 4) headStats[s.head]++;
    });

    const hotTails = Object.entries(tailStats).sort((a, b) => b[1] - a[1]).slice(0, 6).map(item => parseInt(item[0]));
    const hotColors = Object.entries(colorStats).sort((a, b) => b[1] - a[1]).slice(0, 2).map(item => item[0]);
    const hotHeads = Object.entries(headStats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(item => parseInt(item[0]));

    const candidateNums = [];
    for (let num = 1; num <= 49; num++) {
      const zodiac = fullNumZodiacMap.get(num);
      if (!zodiac || !targetZodiacs.includes(zodiac)) continue;

      const tail = num % 10;
      const head = Math.floor(num / 10);
      const colorName = getColor(num).name;

      let matchCount = 0;
      if (targetZodiacs.includes(zodiac)) matchCount++;
      if (hotTails.includes(tail)) matchCount++;
      if (hotColors.includes(colorName)) matchCount++;
      if (hotHeads.includes(head)) matchCount++;

      if (matchCount >= 3) {
        candidateNums.push({ num, matchCount, score: rankedZodiacs.find(r => r.zodiac === zodiac)?.totalScore || 0 });
      }
    }

    candidateNums.sort((a, b) => {
      if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
      return b.score - a.score;
    });

    return candidateNums.slice(0, targetCount).map(item => item.num);
  },

  // 四大算法组件（暴露给外部）
  calcHotInertia,
  calcMissRepair,
  calcCycleBalance,
  calcFrequencyScore,

  // 模式检测
  detectMultiWindowPattern,
  detectColdHotAlternatingMarket
};

export default analysisCalc;
