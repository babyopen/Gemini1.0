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
import { 
  getHotNumbers, 
  getColdReboundNumbers, 
  getHotNumbersV3, 
  getColdReboundNumbersV3,
  decideAutoMode 
} from './analysis-calc/analysis-calc-special.js';
import { 
  calcSelectedZodiacsV2, 
  calcSelectedZodiacsV3,
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
  getColorName: (number) => getColor(number).cls,
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

  // V3.0四大核心算法版本
  getHotNumbersV3: (data, targetCount, fullNumZodiacMap) => {
    const state = StateManager._state;
    const historyData = state.analysis?.historyData || [];
    return getHotNumbersV3(data, targetCount, fullNumZodiacMap, historyData);
  },

  getColdReboundNumbersV3: (data, targetCount, fullNumZodiacMap) => {
    return getColdReboundNumbersV3(data, targetCount, fullNumZodiacMap);
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

  // 精选生肖 V3（使用30期数据，整合多窗口形态识别和冷热交替行情适配）
  calcSelectedZodiacsV3: (periodLimit = 30) => {
    const state = StateManager._state;
    const { historyData } = state.analysis;
    return calcSelectedZodiacsV3(historyData, periodLimit);
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
  detectColdHotAlternatingMarket,

  // ==================== V2.0 五大核心算法 ====================
  
  /**
   * 步骤1: 构建特码历史统计
   * 分析所有历史开奖数据，统计每个生肖和号码的出现次数、遗漏期数
   */
  buildSpecialCodeHistory: (historyData, periodLimit = 'all') => {
    const state = StateManager._state;
    const list = historyData.slice(0, periodLimit === 'all' ? historyData.length : Math.min(periodLimit, historyData.length));
    
    const zodiacStats = {};
    const numStats = {};
    const missTracker = {};
    
    const ZODIAC_ORDER = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
    ZODIAC_ORDER.forEach(z => {
      zodiacStats[z] = { count: 0, miss: 0, level: 'normal' };
      missTracker[z] = 0;
    });
    
    list.forEach((item, idx) => {
      const special = analysisCalc.getSpecial(item);
      if (!special || !special.te) return;
      
      // 统计生肖
      if (zodiacStats[special.zod]) {
        zodiacStats[special.zod].count++;
        zodiacStats[special.zod].miss = 0;
      }
      ZODIAC_ORDER.forEach(z => {
        if (z !== special.zod) {
          missTracker[z]++;
        }
      });
      
      // 统计号码
      numStats[special.te] = (numStats[special.te] || 0) + 1;
    });
    
    // 计算平均遗漏和热度等级
    const avgZodiacMiss = list.length / 12;
    const avgNumMiss = list.length / 49;
    
    ZODIAC_ORDER.forEach(z => {
      zodiacStats[z].miss = missTracker[z];
      if (zodiacStats[z].count >= (list.length / 12) * 1.5) {
        zodiacStats[z].level = 'hot';
      } else if (zodiacStats[z].count <= (list.length / 12) * 0.5 || missTracker[z] >= avgZodiacMiss * 2) {
        zodiacStats[z].level = 'cold';
      } else if (missTracker[z] >= avgZodiacMiss * 1.5) {
        zodiacStats[z].level = 'warm';
      }
    });
    
    // 计算号码热度等级
    Object.keys(numStats).forEach(num => {
      const avg = list.length / 49;
      if (numStats[num] >= avg * 2) {
        numStats[num] = { count: numStats[num], level: 'hot' };
      } else if (numStats[num] <= avg * 0.5) {
        numStats[num] = { count: numStats[num], level: 'cold' };
      } else {
        numStats[num] = { count: numStats[num], level: 'normal' };
      }
    });
    
    return {
      zodiacStats,
      numStats,
      totalPeriods: list.length,
      avgZodiacMiss,
      avgNumMiss
    };
  },

  /**
   * 步骤2: 计算热号惯性
   * 分析最近3期的开奖数据，识别连开的生肖，给连开生肖增加惯性权重
   */
  calcHotNumberInertia: (historyData) => {
    const recent3 = historyData.slice(0, 3);
    const inertiaMap = {};
    const ZODIAC_ORDER = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
    ZODIAC_ORDER.forEach(z => inertiaMap[z] = { weight: 0, consecutive: 0 });
    
    recent3.forEach((item, idx) => {
      const special = analysisCalc.getSpecial(item);
      if (!special || !special.zod) return;
      inertiaMap[special.zod].consecutive++;
    });
    
    // 分配惯性权重
    ZODIAC_ORDER.forEach(z => {
      if (inertiaMap[z].consecutive >= 3) {
        inertiaMap[z].weight = 1.5;  // 三连热
      } else if (inertiaMap[z].consecutive >= 2) {
        inertiaMap[z].weight = 1.2;  // 二连热
      } else if (inertiaMap[z].consecutive >= 1) {
        inertiaMap[z].weight = 1.0;  // 单热
      }
    });
    
    return inertiaMap;
  },

  /**
   * 步骤3: 计算冷号回补窗口
   * 计算每个生肖和号码的遗漏期数，识别达到回补阈值的冷门生肖和号码
   */
  calcColdReboundWindow: (historyData) => {
    const list = historyData.slice(0, 30);
    const missMap = {};
    const numMissMap = {};
    const ZODIAC_ORDER = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
    
    ZODIAC_ORDER.forEach(z => missMap[z] = 0);
    for (let i = 1; i <= 49; i++) numMissMap[i] = 0;
    
    list.forEach((item, idx) => {
      const special = analysisCalc.getSpecial(item);
      if (!special || !special.te) return;
      
      // 更新生肖遗漏
      ZODIAC_ORDER.forEach(z => {
        if (z !== special.zod) missMap[z]++;
      });
      
      // 更新号码遗漏
      for (let i = 1; i <= 49; i++) {
        if (i !== special.te) numMissMap[i]++;
      }
    });
    
    const avgMiss = list.length / 12;
    const avgNumMiss = list.length / 49;
    const threshold = avgMiss * 1.5;
    const numThreshold = avgNumMiss * 1.5;
    
    const reboundMap = {};
    ZODIAC_ORDER.forEach(z => {
      reboundMap[z] = {
        miss: missMap[z],
        inWindow: missMap[z] >= threshold,
        weight: missMap[z] >= threshold ? (missMap[z] / avgMiss) : 0
      };
    });
    
    const numReboundMap = {};
    for (let i = 1; i <= 49; i++) {
      numReboundMap[i] = {
        miss: numMissMap[i],
        inWindow: numMissMap[i] >= numThreshold,
        weight: numMissMap[i] >= numThreshold ? (numMissMap[i] / avgNumMiss) : 0
      };
    }
    
    return { zodiacRebound: reboundMap, numRebound: numReboundMap, threshold, numThreshold };
  },

  /**
   * 步骤4: 计算生肖轮换周期
   * 分析最近10期的热门生肖，判断当前处于哪个轮换阶段
   */
  calcZodiacRotationCycle: (historyData) => {
    const recent10 = historyData.slice(0, 10);
    const zodiacCount = {};
    const ZODIAC_ORDER = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
    ZODIAC_ORDER.forEach(z => zodiacCount[z] = 0);
    
    recent10.forEach(item => {
      const special = analysisCalc.getSpecial(item);
      if (special && special.zod) {
        zodiacCount[special.zod]++;
      }
    });
    
    const sorted = Object.entries(zodiacCount).sort((a, b) => b[1] - a[1]);
    const avg = recent10.length / 12;
    
    let phase = 'balanced';
    if (sorted[0] && sorted[0][1] >= avg * 2) {
      phase = 'hot_dominant';
    } else if (sorted[sorted.length - 1] && sorted[sorted.length - 1][1] === 0) {
      phase = 'cold_emerging';
    }
    
    return {
      zodiacCount,
      phase,
      topZodiacs: sorted.slice(0, 6).map(([z]) => z),
      bottomZodiacs: sorted.slice(-3).map(([z]) => z)
    };
  },

  /**
   * 步骤5: 多维度综合筛选
   * 精选生肖前6名 + 热门尾数TOP6 + 热门波色TOP2 + 热门头数TOP3
   */
  finalSelection: (historyData, targetCount = 5, fullNumZodiacMap) => {
    const list = historyData.slice(0, 30);
    const recent10 = historyData.slice(0, 10);
    
    // 5.1 确定核心维度
    // 🎯 使用V3.0四大核心算法计算精选生肖前6名
    const rankedZodiacs = analysisCalc.calcSelectedZodiacsV3(30);
    const topZodiacs = rankedZodiacs.slice(0, 6).map(item => item.zodiac);
    
    // 热门尾数TOP6 (最近10期)
    const tailCounts = {};
    for (let i = 0; i < 10; i++) tailCounts[i] = 0;
    recent10.forEach(item => {
      const special = analysisCalc.getSpecial(item);
      if (special && special.tail !== undefined) tailCounts[special.tail]++;
    });
    const hotTails = Object.entries(tailCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => parseInt(t));
    
    // 热门波色TOP2 (最近10期)
    const colorCounts = { '红': 0, '蓝': 0, '绿': 0 };
    recent10.forEach(item => {
      const special = analysisCalc.getSpecial(item);
      if (special && special.colorName) colorCounts[special.colorName]++;
    });
    const hotColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([c]) => c);
    
    // 热门头数TOP3 (最近10期)
    const headCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    recent10.forEach(item => {
      const special = analysisCalc.getSpecial(item);
      if (special && special.head !== undefined) headCounts[special.head]++;
    });
    const hotHeads = Object.entries(headCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h]) => parseInt(h));
    
    // 5.2 候选号码筛选
    const candidates = [];
    for (let num = 1; num <= 49; num++) {
      if (!fullNumZodiacMap.has(num)) continue;
      
      const zodiac = fullNumZodiacMap.get(num);
      const special = analysisCalc.getSpecial({ openCode: `0,0,0,0,0,0,${num}` });
      
      let matchCount = 0;
      if (topZodiacs.includes(zodiac)) matchCount++;
      if (hotTails.includes(special.tail)) matchCount++;
      if (hotColors.includes(special.colorName)) matchCount++;
      if (hotHeads.includes(special.head)) matchCount++;
      
      if (matchCount >= 2) {
        candidates.push({
          num,
          zodiac,
          matchCount,
          tail: special.tail,
          color: special.colorName,
          head: special.head
        });
      }
    }
    
    // 5.3 最终加权排序（结合V3.0精选生肖评分）
    const step1 = analysisCalc.buildSpecialCodeHistory(historyData);
    const step2 = analysisCalc.calcHotNumberInertia(historyData);
    const step3 = analysisCalc.calcColdReboundWindow(historyData);
    const step4 = analysisCalc.calcZodiacRotationCycle(historyData);
    
    candidates.forEach(c => {
      let score = 0;
      
      // 🎯 结合V3.0精选生肖评分
      const zodiacScore = rankedZodiacs.find(r => r.zodiac === c.zodiac)?.totalScore || 0;
      score += zodiacScore * 0.3;  // 精选生肖评分占30%权重
      
      // V2.0各维度权重
      score += step2[c.zodiac]?.weight || 0;
      score += step3.zodiacRebound[c.zodiac]?.weight || 0;
      score += step3.numRebound[c.num]?.weight || 0;
      if (step4.topZodiacs.includes(c.zodiac)) score += 0.5;
      if (step1.numStats[c.num]?.level === 'hot') score += 1;
      
      c.score = score;
    });
    
    candidates.sort((a, b) => {
      if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
      return b.score - a.score;
    });
    
    return {
      topZodiacs,
      hotTails,
      hotColors,
      hotHeads,
      candidates: candidates.slice(0, targetCount)
    };
  },

  /**
   * V2.0 主入口函数 - 整合五大步骤
   */
  getHotNumbersV2: (historyData, targetCount, fullNumZodiacMap) => {
    if (!historyData || historyData.length === 0) {
      return [];
    }
    
    const result = analysisCalc.finalSelection(historyData, targetCount, fullNumZodiacMap);
    return result.candidates.map(c => c.num);
  },

  /**
   * 获取V2.0推演报告
   */
  getHotNumbersReport: (historyData, fullNumZodiacMap) => {
    if (!historyData || historyData.length === 0) {
      return null;
    }
    
    const step1 = analysisCalc.buildSpecialCodeHistory(historyData);
    const step2 = analysisCalc.calcHotNumberInertia(historyData);
    const step3 = analysisCalc.calcColdReboundWindow(historyData);
    const step4 = analysisCalc.calcZodiacRotationCycle(historyData);
    const step5 = analysisCalc.finalSelection(historyData, 5, fullNumZodiacMap);
    
    return {
      step1,
      step2,
      step3,
      step4,
      step5,
      topNumbers: step5.candidates
    };
  },

  /**
   * 新一期开奖后的回调函数
   */
  onNewLotteryResult: (newResult) => {
    console.log('🔔 V2.0算法检测到新开奖结果', newResult);
  }
};

export default analysisCalc;
