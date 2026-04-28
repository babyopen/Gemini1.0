// ====================== 分析计算模块 ======================

import { CONFIG } from '../../../config.js';
import { StateManager } from '../../../state-manager.js';
import { DataQuery } from '../../../data-query.js';
import { PerformanceMonitor } from '../../../performance-monitor.js';

const getTopEntry = (obj, count = 1) => 
  Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, count);

const _colorCache = new Map();
const _elementCache = new Map();
const _getColor = (number) => {
  if (_colorCache.has(number)) return _colorCache.get(number);
  const color = Object.keys(CONFIG.COLOR_MAP).find(c => CONFIG.COLOR_MAP[c].includes(number));
  const result = color ? { cls: { '红': 'red', '蓝': 'blue', '绿': 'green' }[color] || 'red', name: color || '红' } : { cls: 'red', name: '红' };
  _colorCache.set(number, result);
  return result;
};
const _getElement = (number) => {
  if (_elementCache.has(number)) return _elementCache.get(number);
  const element = Object.keys(CONFIG.ELEMENT_MAP).find(e => CONFIG.ELEMENT_MAP[e].includes(number));
  _elementCache.set(number, element || '金');
  return element || '金';
};

export const analysisCalc = {
  _calcZodiacAnalysisCache: new Map(),

  getTopEntry,

  _colorCache, _elementCache,

  /**
   * 计算全维度分析
   * @returns {Object} 分析数据
   */
  calcFullAnalysis: () => {
    return PerformanceMonitor.monitorProcessing(() => {
      const state = StateManager._state;
      const { historyData, analyzeLimit } = state.analysis;
      if(!historyData.length) return null;

      const list = historyData.slice(0, Math.min(analyzeLimit, historyData.length));
      const total = list.length;

      // 初始化统计对象
      const singleDouble = { '单': 0, '双': 0 };
      const bigSmall = { '大': 0, '小': 0 };
      const range = { '1-9': 0, '10-19': 0, '20-29': 0, '30-39': 0, '40-49': 0 };
      const head = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      const tail = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
      const color = { '红': 0, '蓝': 0, '绿': 0 };
      const wuxing = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
      const animal = { '家禽': 0, '野兽': 0 };
      const zodiac = {};
      CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => zodiac[z] = 0);
      const numCount = {};
      for(let i = 1; i <= 49; i++) numCount[String(i).padStart(2, '0')] = 0;
      const lastAppear = {};
      for(let i = 1; i <= 49; i++) lastAppear[i] = -1;

      // 统计
      list.forEach((item, idx) => {
        const s = analysisCalc.getSpecial(item);
        s.odd ? singleDouble['单']++ : singleDouble['双']++;
        s.big ? bigSmall['大']++ : bigSmall['小']++;
        s.te <= 9 ? range['1-9']++ : s.te <= 19 ? range['10-19']++ : s.te <= 29 ? range['20-29']++ : s.te <= 39 ? range['30-39']++ : range['40-49']++;
        head[s.head]++;
        tail[s.tail]++;
        color[s.colorName]++;
        wuxing[s.wuxing]++;
        animal[s.animal]++;
        if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) zodiac[s.zod]++;
        numCount[String(s.te).padStart(2, '0')]++;
        if(lastAppear[s.te] === -1) lastAppear[s.te] = idx;
      });

      // 遗漏计算
      let totalMissSum = 0, maxMiss = 0, hot = 0, warm = 0, cold = 0;
      const allMiss = [];
      for(let m = 1; m <= 49; m++) {
        const p = lastAppear[m];
        const currentMiss = p === -1 ? total : p;
        allMiss.push(currentMiss);
        totalMissSum += currentMiss;
        if(currentMiss > maxMiss) maxMiss = currentMiss;
        if(currentMiss <= 3) hot++;
        else if(currentMiss <= 9) warm++;
        else cold++;
      }
      const avgMiss = (totalMissSum / 49).toFixed(1);
      const curMaxMiss = Math.max(...allMiss);

      // 连出计算
      let curStreak = 1, maxStreak = 1, current = 1;
      let curStreakData = [];
      let maxStreakData = [];
      let tempStreakData = [];
      
      // 辅助函数：将布尔值转换为中文形态
      const getShapeText = (odd, big) => {
        const oddText = odd ? '单' : '双';
        const bigText = big ? '大' : '小';
        return `${oddText}_${bigText}`;
      };
      
      if(list.length >= 2) {
        const firstSpecial = analysisCalc.getSpecial(list[0]);
        const firstShape = getShapeText(firstSpecial.odd, firstSpecial.big);
        curStreakData.push({
          expect: list[0].expect,
          te: firstSpecial.te,
          shape: firstShape
        });
        for(let i = 1; i < list.length; i++) {
          const s = analysisCalc.getSpecial(list[i]);
          const shape = getShapeText(s.odd, s.big);
          if(shape === firstShape) {
            curStreak++;
            curStreakData.push({
              expect: list[i].expect,
              te: s.te,
              shape: shape
            });
          } else break;
        }
        
        let prevShape = getShapeText(firstSpecial.odd, firstSpecial.big);
        tempStreakData.push({
          expect: list[0].expect,
          te: firstSpecial.te,
          shape: prevShape
        });
        
        for(let i = 1; i < list.length; i++) {
          const s = analysisCalc.getSpecial(list[i]);
          const shape = getShapeText(s.odd, s.big);
          if(shape === prevShape) {
            current++;
            tempStreakData.push({
              expect: list[i].expect,
              te: s.te,
              shape: shape
            });
            if(current > maxStreak) {
              maxStreak = current;
              maxStreakData = [...tempStreakData];
            }
          } else {
            current = 1;
            prevShape = shape;
            tempStreakData = [{
              expect: list[i].expect,
              te: s.te,
              shape: shape
            }];
          }
        }
      }

      // 热门排序
      const hotSD = getTopEntry(singleDouble)[0];
      const hotBS = getTopEntry(bigSmall)[0];
      const hotHead = getTopEntry(head)[0];
      const hotTail = getTopEntry(tail)[0];
      const hotColor = getTopEntry(color)[0];
      const hotWx = getTopEntry(wuxing)[0];
      const hotZod = getTopEntry(zodiac, 3).map(i => i[0]).join('、');
      const hotAni = getTopEntry(animal)[0];
      const hotNum = getTopEntry(numCount, 5).map(i => i[0]).join(' ');

      return {
        total, singleDouble, bigSmall, range, head, tail, color, wuxing, animal, zodiac, numCount,
        hotSD, hotBS, hotHead, hotTail, hotColor, hotWx, hotZod, hotAni, hotNum,
        miss: { curMaxMiss, avgMiss, maxMiss, hot, warm, cold },
        streak: { curStreak, maxStreak, curStreakData, maxStreakData }
      };
    }, 'dataProcessing');
  },

  /**
   * 计算生肖关联分析（带缓存）
   * @returns {Object} 分析数据
   */
  calcZodiacAnalysis: (customAnalyzeLimit) => {
    const state = StateManager._state;
    const { historyData } = state.analysis;
    const analyzeLimit = customAnalyzeLimit !== undefined ? customAnalyzeLimit : state.analysis.analyzeLimit;
    
    // 检查缓存
    const cacheKey = String(analyzeLimit);
    const cached = analysisCalc._calcZodiacAnalysisCache.get(cacheKey);
    
    // 验证缓存有效性：检查历史数据是否变化
    if(cached && historyData && historyData.length > 0) {
      const latestExpect = historyData[0].expect;
      if(cached.latestExpect === latestExpect) {
        return cached.result; // 缓存有效，直接返回
      }
    }
    
    // 缓存无效或不存在，执行原始计算逻辑
    const result = analysisCalc._calcZodiacAnalysisOriginal(analyzeLimit);
    
    // 更新缓存
    if(result && historyData && historyData.length > 0) {
      analysisCalc._calcZodiacAnalysisCache.set(cacheKey, {
        latestExpect: historyData[0].expect,
        result: result
      });
    }
    
    return result;
  },
  
  /**
   * 原始的生肖关联分析计算
   * @private
   * @returns {Object} 分析数据
   */
  _calcZodiacAnalysisOriginal: (customAnalyzeLimit) => {
    return PerformanceMonitor.monitorProcessing(() => {
      const state = StateManager._state;
      const { historyData } = state.analysis;
      const analyzeLimit = customAnalyzeLimit !== undefined ? customAnalyzeLimit : state.analysis.analyzeLimit;
      
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
      for(let t = 0; t <= 9; t++) tailZodMap[t] = {};
      
      // 如果有历史数据，进行统计
      if(historyData.length >= 2) {
        // 处理"全年数据"选项：只统计当前农历年份的数据
        if(analyzeLimit === 'all' || analyzeLimit === 365) {
          const currentLunarYear = analysisCalc.getCurrentLunarYear();
          // 筛选当前农历年份的数据
          list = historyData.filter(item => {
            const itemLunarYear = analysisCalc.getLunarYearByDate(item.date);
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

        // 循环统计
        list.forEach((item, idx) => {
          const s = analysisCalc.getSpecial(item);
          if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) {
            zodCount[s.zod]++;
            if(lastAppear[s.zod] === -1) lastAppear[s.zod] = idx;
          }
          if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) {
            tailZodMap[s.tail][s.zod] = (tailZodMap[s.tail][s.zod] || 0) + 1;
          }
          // 统计波色
          if(s.colorName && colorCount.hasOwnProperty(s.colorName)) {
            colorCount[s.colorName]++;
          }
          // 统计头数
          if(s.head >= 0 && s.head <= 4) {
            headCount[s.head]++;
          }
        });

        // 跟随统计
        for(let i = 1; i < list.length; i++) {
          const preZod = analysisCalc.getSpecial(list[i-1]).zod;
          const curZod = analysisCalc.getSpecial(list[i]).zod;
          if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(preZod) && CONFIG.ANALYSIS.ZODIAC_ALL.includes(curZod)) {
            if(!followMap[preZod]) followMap[preZod] = {};
            followMap[preZod][curZod] = (followMap[preZod][curZod] || 0) + 1;
          }
        }

        // 热门排序
        topZod = getTopEntry(zodCount);
        topTail = Array.from({ length: 10 }, (_, t) => ({
          t, sum: Object.values(tailZodMap[t] || {}).reduce((a, b) => a + b, 0)
        })).sort((a, b) => b.sum - a.sum);
        
        // 热门波色排序
        topColor = getTopEntry(colorCount);
        
        // 热门头数排序
        topHead = getTopEntry(headCount);
      }

      // 遗漏期数计算
      const zodMiss = {};
      const zodAvgMiss = {};
      CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
        zodMiss[z] = lastAppear[z] === -1 ? total : lastAppear[z];
        zodAvgMiss[z] = zodCount[z] > 0 ? (total / zodCount[z]).toFixed(1) : total;
      });

      // ========== 生肖预测算法 ==========
      const zodiacScores = {};
      const zodiacDetails = {};

      // 1. 热号状态分析 (0-20分)
      const hotZodiacs = topZod.slice(0, 3).map(z => z[0]);
      
      // 2. 冷号状态分析 (0-30分) - 需要更长历史数据
      let maxMiss = 0;
      Object.values(zodMiss).forEach(m => { if(m > maxMiss) maxMiss = m; });

      // 3. 间隔规律分析
      const zodiacOrder = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
      const intervalStats = {};
      for(let i = 0; i < 12; i++) intervalStats[i] = 0;
      
      for(let i = 1; i < list.length && i < 30; i++) {
        const preZod = analysisCalc.getSpecial(list[i-1]).zod;
        const curZod = analysisCalc.getSpecial(list[i]).zod;
        const preIdx = zodiacOrder.indexOf(preZod);
        const curIdx = zodiacOrder.indexOf(curZod);
        if(preIdx !== -1 && curIdx !== -1) {
          let diff = curIdx - preIdx;
          if(diff > 6) diff -= 12;
          if(diff < -6) diff += 12;
          intervalStats[diff + 6]++;
        }
      }
      const commonIntervals = Object.entries(intervalStats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => parseInt(x[0]) - 6);

      // 4. 上期生肖用于形态匹配
      const lastZod = list.length > 0 ? analysisCalc.getSpecial(list[0]).zod : '';
      
      // 五行相生关系
      const elementGenerate = {
        '金': ['水'],
        '水': ['木'],
        '木': ['火'],
        '火': ['土'],
        '土': ['金']
      };

      // 生肖五行映射
      const zodiacElement = {
        '鼠': '水', '牛': '土', '虎': '木', '兔': '木',
        '龙': '土', '蛇': '火', '马': '火', '羊': '土',
        '猴': '金', '鸡': '金', '狗': '土', '猪': '水'
      };

      // 计算每个生肖的综合分数
      CONFIG.ANALYSIS.ZODIAC_ALL.forEach(zod => {
        let score = 0;
        const details = { cold: 0, hot: 0, shape: 0, interval: 0 };

        // 冷号状态 (0-30分)
        const missValue = zodMiss[zod] || 0;
        if(maxMiss > 0 && missValue >= maxMiss * 0.8) {
          details.cold = 30;
          score += 30;
        } else if(missValue >= 24) {
          details.cold = 20;
          score += 20;
        } else if(missValue >= 12) {
          details.cold = 10;
          score += 10;
        }

        // 热号状态 (0-20分)
        if(hotZodiacs.includes(zod)) {
          details.hot = 20;
          score += 20;
        }

        // 形态匹配 (0-30分) - 五行相生
        if(lastZod && zodiacElement[lastZod] && zodiacElement[zod]) {
          const lastElement = zodiacElement[lastZod];
          const currentElement = zodiacElement[zod];
          if(elementGenerate[lastElement] && elementGenerate[lastElement].includes(currentElement)) {
            details.shape = 15;
            score += 15;
          }
        }

        // 间隔匹配 (0-20分)
        if(lastZod) {
          const lastIdx = zodiacOrder.indexOf(lastZod);
          const currentIdx = zodiacOrder.indexOf(zod);
          if(lastIdx !== -1 && currentIdx !== -1) {
            let diff = currentIdx - lastIdx;
            if(diff > 6) diff -= 12;
            if(diff < -6) diff += 12;
            if(commonIntervals.includes(diff)) {
              details.interval = 20;
              score += 20;
            }
          }
        }

        zodiacScores[zod] = score;
        zodiacDetails[zod] = details;
      });

      // 按分数排序
      const sortedZodiacs = getTopEntry(zodiacScores);

      return { list, total, avgExpect, zodCount, zodMiss, zodAvgMiss, tailZodMap, followMap, topZod, topTail, topColor, topHead, zodiacScores, zodiacDetails, sortedZodiacs };
    }, 'dataProcessing');
  },

  /**
   * 获取特码信息
   * @param {Object} item - 历史数据项
   * @returns {Object} 特码信息
   */
  getSpecial: (item) => {
    const codeArr = (item.openCode || "0,0,0,0,0,0,0").split(",");
    const zodArrRaw = (item.zodiac || ",,,,,,,,,,,").split(",");
    const zodArr = zodArrRaw.map(z => CONFIG.ANALYSIS.ZODIAC_TRAD_TO_SIMP[z] || z);
    const te = Math.max(0, Number(codeArr[6]));
    const colorInfo = _getColor(te);
    
    return {
      te,
      tail: te % 10,
      head: Math.floor(te / 10),
      wave: colorInfo.cls,
      colorName: colorInfo.name,
      zod: zodArr[6] || "-",
      odd: te % 2 === 1,
      big: te >= 25,
      animal: CONFIG.ANALYSIS.HOME_ZODIAC.includes(zodArr[6]) ? "家禽" : "野兽",
      wuxing: _getElement(te),
      fullZodArr: zodArr
    };
  },

  /**
   * 获取号码对应的颜色类名
   * @param {number} number - 号码
   * @returns {string} 颜色类名
   */
  getColor: (number) => _getColor(number).cls,
  
  /**
   * 获取号码对应的颜色名称
   * @param {number} number - 号码
   * @returns {string} 颜色名称
   */
  getColorName: (number) => _getColor(number).name,
  
  /**
   * 获取号码对应的五行
   * @param {number} number - 号码
   * @returns {string} 五行名称
   */
  getWuxing: (number) => _getElement(number),

  /**
   * 获取生肖热度等级
   * @param {number} count - 出现次数
   * @param {number} miss - 遗漏期数
   * @param {number} total - 总期数
   * @returns {Object} 热度等级对象
   */
  getZodiacLevel: (count, miss, total) => {
    const avgCount = total / 12;
    if(count >= avgCount * 1.5 && miss <= 3) return { cls: 'hot', text: '热' };
    if(count <= avgCount * 0.5 || miss >= 8) return { cls: 'cold', text: '冷' };
    return { cls: 'warm', text: '温' };
  },

  /**
   * 获取当前农历年份
   * @returns {number} 农历年份
   */
  getCurrentLunarYear: () => {
    const now = new Date();
    return analysisCalc.getLunarYearByDate(now);
  },

  /**
   * 根据日期获取农历年份
   * @param {Date|string|Object} date - 日期
   * @returns {number} 农历年份
   */
  getLunarYearByDate: (date) => {
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
    
    // 春节日期配置 (农历正月初一)
    const springFestival = CONFIG.SPRING_FESTIVAL[year] || { month: 1, day: 1 };
    
    // 如果目标日期在春节之前，农历年份为公历年份减1
    if (month < springFestival.month || (month === springFestival.month && day < springFestival.day)) {
      return year - 1;
    }
    
    // 否则，农历年份为公历年份
    return year;
  },

  /**
   * 构建球号元素
   * @param {string|number} num - 号码
   * @param {string} color - 颜色类名
   * @param {string} zodiac - 生肖
   * @returns {string} HTML字符串
   */
  buildBall: (num, color, zodiac) => {
    return `<div class="ball-item"><div class="ball ${color}">${num}</div><div class="ball-zodiac">${zodiac}</div></div>`;
  },

  /**
   * 获取热门号码
   * @param {Object} data - 分析数据
   * @param {number} targetCount - 目标数量
   * @param {Map} fullNumZodiacMap - 号码生肖映射
   * @returns {Array} 号码数组
   */
  getHotNumbers: (data, targetCount, fullNumZodiacMap) => {
    const state = StateManager._state;
    const historyData = state.analysis?.historyData || [];

    if (historyData.length > 0) {
      return analysisCalc.getHotNumbersV2(historyData, targetCount, fullNumZodiacMap);
    }

    let coreZodiacs = [];
    
    // 首先尝试使用精选生肖
    // 注意：由于是同步函数，无法使用动态导入，直接使用预测高分的前6个生肖
    if(data.sortedZodiacs && data.sortedZodiacs.length > 0) {
      // 精选特码的数据结构
      coreZodiacs = data.sortedZodiacs.slice(0, 6).map(i => i[0]);
    } else if(data.topZod && Array.isArray(data.topZod)) {
      // 兼容结构
      coreZodiacs = data.topZod.slice(0, 6).map(i => i[0]);
    } else if(data.zodiac) {
      // 综合分析的数据结构：从zodiac对象计算前6个热门生肖
      coreZodiacs = Object.entries(data.zodiac)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(i => i[0]);
    }

    // 锁定热门尾数TOP6
    let hotTails = [];
    if(data.topTail && Array.isArray(data.topTail) && data.topTail.length > 0) {
      hotTails = data.topTail.slice(0, 6).map(i => i.t !== undefined ? i.t : parseInt(i[0]));
    } else if(data.tail) {
      // 从tail对象计算
      hotTails = Object.entries(data.tail)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(i => parseInt(i[0]));
    }
    
    // 锁定热门波色TOP2
    let hotColors = [];
    if(data.topColor && Array.isArray(data.topColor) && data.topColor.length > 0) {
      hotColors = data.topColor.slice(0, 2).map(i => i[0]);
    } else if(data.color) {
      // 从color对象计算
      hotColors = Object.entries(data.color)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(i => i[0]);
    }
    
    // 锁定热门头数TOP3
    let hotHeads = [];
    if(data.topHead && Array.isArray(data.topHead) && data.topHead.length > 0) {
      hotHeads = data.topHead.slice(0, 3).map(i => parseInt(i[0]));
    } else if(data.head) {
      // 从head对象计算
      hotHeads = Object.entries(data.head)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(i => parseInt(i[0]));
    }

    // 筛选候选号码（必须同时满足4个条件）
    const candidateNums = [];
    for(let num = 1; num <= 49; num++) {
      const zodiac = fullNumZodiacMap.get(num);
      if(!zodiac) continue;
      
      const tail = num % 10;
      const head = Math.floor(num / 10);
      const colorName = analysisCalc.getColorName(num);
      
      // 必须同时满足4个条件
      if(coreZodiacs.includes(zodiac) && 
         hotTails.includes(tail) && 
         hotColors.includes(colorName) && 
         hotHeads.includes(head)) {
        candidateNums.push(num);
      }
    }
    
    // 如果候选号码不足，放宽条件（只需要满足3个条件）
    if(candidateNums.length < targetCount) {
      for(let num = 1; num <= 49; num++) {
        if(candidateNums.includes(num)) continue;
        
        const zodiac = fullNumZodiacMap.get(num);
        if(!zodiac) continue;
        
        const tail = num % 10;
        const head = Math.floor(num / 10);
        const colorName = analysisCalc.getColorName(num);
        
        let matchCount = 0;
        if(coreZodiacs.includes(zodiac)) matchCount++;
        if(hotTails.includes(tail)) matchCount++;
        if(hotColors.includes(colorName)) matchCount++;
        if(hotHeads.includes(head)) matchCount++;
        
        if(matchCount >= 3) {
          candidateNums.push(num);
        }
      }
    }
    
    // 如果候选号码仍然不足，再放宽条件（只需要满足2个条件）
    if(candidateNums.length < targetCount) {
      for(let num = 1; num <= 49; num++) {
        if(candidateNums.includes(num)) continue;
        
        const zodiac = fullNumZodiacMap.get(num);
        if(!zodiac) continue;
        
        const tail = num % 10;
        const head = Math.floor(num / 10);
        const colorName = analysisCalc.getColorName(num);
        
        let matchCount = 0;
        if(coreZodiacs.includes(zodiac)) matchCount++;
        if(hotTails.includes(tail)) matchCount++;
        if(hotColors.includes(colorName)) matchCount++;
        if(hotHeads.includes(head)) matchCount++;
        
        if(matchCount >= 2) {
          candidateNums.push(num);
        }
      }
    }
    
    // 从候选号码中选择前targetCount个
    return candidateNums.slice(0, targetCount);
  },

  /**
   * 获取冷号反弹号码
   * @param {Object} data - 分析数据
   * @param {number} targetCount - 目标数量
   * @param {Map} fullNumZodiacMap - 号码生肖映射
   * @returns {Array} 号码数组
   */
  getColdReboundNumbers: (data, targetCount, fullNumZodiacMap) => {
    // 适配两种数据结构：精选特码的完整数据结构 和 综合分析的简化数据结构
    
    // 锁定核心生肖池：使用高遗漏的前6个生肖（冷号反弹）
    let coreZodiacs = [];
    
    if(data.zodMiss) {
      // 从zodMiss对象计算前6个高遗漏生肖
      coreZodiacs = Object.entries(data.zodMiss)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(i => i[0]);
    } else if(data.sortedZodiacs && data.sortedZodiacs.length > 0) {
      // 从sortedZodiacs中选择得分较低的后6个生肖
      coreZodiacs = data.sortedZodiacs.slice(-6).map(i => i[0]);
    }

    // 锁定热门尾数TOP6
    let hotTails = [];
    if(data.topTail && Array.isArray(data.topTail) && data.topTail.length > 0) {
      hotTails = data.topTail.slice(0, 6).map(i => i.t !== undefined ? i.t : parseInt(i[0]));
    } else if(data.tail) {
      // 从tail对象计算
      hotTails = Object.entries(data.tail)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(i => parseInt(i[0]));
    }
    
    // 锁定热门波色TOP2
    let hotColors = [];
    if(data.topColor && Array.isArray(data.topColor) && data.topColor.length > 0) {
      hotColors = data.topColor.slice(0, 2).map(i => i[0]);
    } else if(data.color) {
      // 从color对象计算
      hotColors = Object.entries(data.color)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(i => i[0]);
    }
    
    // 锁定热门头数TOP3
    let hotHeads = [];
    if(data.topHead && Array.isArray(data.topHead) && data.topHead.length > 0) {
      hotHeads = data.topHead.slice(0, 3).map(i => parseInt(i[0]));
    } else if(data.head) {
      // 从head对象计算
      hotHeads = Object.entries(data.head)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(i => parseInt(i[0]));
    }

    // 筛选候选号码（必须同时满足4个条件）
    const candidateNums = [];
    for(let num = 1; num <= 49; num++) {
      const zodiac = fullNumZodiacMap.get(num);
      if(!zodiac) continue;
      
      const tail = num % 10;
      const head = Math.floor(num / 10);
      const colorName = analysisCalc.getColorName(num);
      
      // 必须同时满足4个条件
      if(coreZodiacs.includes(zodiac) && 
         hotTails.includes(tail) && 
         hotColors.includes(colorName) && 
         hotHeads.includes(head)) {
        candidateNums.push(num);
      }
    }
    
    // 如果候选号码不足，放宽条件（只需要满足3个条件）
    if(candidateNums.length < targetCount) {
      for(let num = 1; num <= 49; num++) {
        if(candidateNums.includes(num)) continue;
        
        const zodiac = fullNumZodiacMap.get(num);
        if(!zodiac) continue;
        
        const tail = num % 10;
        const head = Math.floor(num / 10);
        const colorName = analysisCalc.getColorName(num);
        
        let matchCount = 0;
        if(coreZodiacs.includes(zodiac)) matchCount++;
        if(hotTails.includes(tail)) matchCount++;
        if(hotColors.includes(colorName)) matchCount++;
        if(hotHeads.includes(head)) matchCount++;
        
        if(matchCount >= 3) {
          candidateNums.push(num);
        }
      }
    }
    
    // 如果候选号码仍然不足，再放宽条件（只需要满足2个条件）
    if(candidateNums.length < targetCount) {
      for(let num = 1; num <= 49; num++) {
        if(candidateNums.includes(num)) continue;
        
        const zodiac = fullNumZodiacMap.get(num);
        if(!zodiac) continue;
        
        const tail = num % 10;
        const head = Math.floor(num / 10);
        const colorName = analysisCalc.getColorName(num);
        
        let matchCount = 0;
        if(coreZodiacs.includes(zodiac)) matchCount++;
        if(hotTails.includes(tail)) matchCount++;
        if(hotColors.includes(colorName)) matchCount++;
        if(hotHeads.includes(head)) matchCount++;
        
        if(matchCount >= 2) {
          candidateNums.push(num);
        }
      }
    }
    
    // 从候选号码中选择前targetCount个
    return candidateNums.slice(0, targetCount);
  },

  /**
   * 自动模式决策
   * @param {Object} data - 分析数据
   * @returns {string} 模式名称
   */
  decideAutoMode: (data) => {
    // 基于历史数据的冷热状态自动决定使用热号还是冷号模式
    if(!data || !data.total) return 'hot';
    
    // 计算冷热比例
    const hotCount = data.miss ? data.miss.hot : 0;
    const coldCount = data.miss ? data.miss.cold : 0;
    
    // 如果冷号数量多于热号，使用冷号模式
    if(coldCount > hotCount) {
      return 'cold';
    }
    
    // 否则使用热号模式
    return 'hot';
  },

  /** 
  * 【优化版】多维度综合评分方案 - 基于全维度数据分析
  * @param {Object} data - calcZodiacAnalysis 返回的数据对象 
  * @returns {Object} { scores: {生肖: 总分}, details: {生肖: {base, shape, interval, trend, momentum, total, rank, status}} } 
  */ 
 calcContinuousScores: (data) => { 
     if (!data || !data.list || data.list.length === 0) { 
         return { scores: {}, details: {} }; 
     } 
 
     const zodiacOrder = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪']; 
     const list = data.list; 
     const lastZodiac = list.length > 0 ? analysisCalc.getSpecial(list[0]).zod : ''; 
     const totalPeriods = list.length;
 
     // ========== 1. 基础热度分（30分）- 基于遗漏期数的非线性映射 ==========
     const zodiacMiss = {}; 
     zodiacOrder.forEach(z => { zodiacMiss[z] = totalPeriods; }); 
     list.forEach((item, idx) => { 
         const s = analysisCalc.getSpecial(item); 
         if (zodiacMiss[s.zod] === totalPeriods) { 
             zodiacMiss[s.zod] = idx; 
         } 
     });
 
     // 计算平均遗漏和标准差，用于动态阈值
     const missValues = Object.values(zodiacMiss);
     const avgMiss = missValues.reduce((a, b) => a + b, 0) / missValues.length;
     const maxMiss = Math.max(...missValues);
     const minMiss = Math.min(...missValues);
 
     const baseScores = {}; 
     zodiacOrder.forEach(z => {
         const miss = zodiacMiss[z];
         let score = 0;
          
         // 使用S型曲线映射：近期出现(0-3期)得高分，长期遗漏(>20期)也得中等分
         if (miss <= 2) {
             // 极热状态：25-30分
             score = 30 - (miss * 2.5);
         } else if (miss <= 6) {
             // 温热状态：18-25分
             score = 25 - ((miss - 2) * 1.75);
         } else if (miss <= 12) {
             // 温和状态：10-18分
             score = 18 - ((miss - 6) * 1.33);
         } else if (miss <= 20) {
             // 偏冷状态：4-10分
             score = 10 - ((miss - 12) * 0.75);
         } else {
             // 极冷反弹潜力：2-4分
             score = Math.max(2, 4 - ((miss - 20) * 0.25));
         }
          
         baseScores[z] = Math.round(score);
     });

     // ========== 2. 形态共振分（20分）- 多维度形态匹配 ==========
     // 2.1 单双大小形态分析（最近15期）
     const recent15 = list.slice(0, Math.min(15, list.length));
     let oddCount = 0, evenCount = 0, bigCount = 0, smallCount = 0;
     recent15.forEach(item => {
       const s = analysisCalc.getSpecial(item);
       if (s.odd) oddCount++; else evenCount++;
       if (s.big) bigCount++; else smallCount++;
     });
     const hotOddEven = oddCount > evenCount ? '单' : '双';
     const hotBigSmall = bigCount > smallCount ? '大' : '小';
     const oddRatio = oddCount / recent15.length;
     const bigRatio = bigCount / recent15.length;

     // 2.2 波色趋势分析（最近20期）
     const recent20 = list.slice(0, Math.min(20, list.length));
     const colorStats = { '红': 0, '蓝': 0, '绿': 0 };
     recent20.forEach(item => {
       const s = analysisCalc.getSpecial(item);
       if (colorStats.hasOwnProperty(s.colorName)) {
         colorStats[s.colorName]++;
       }
     });
     const hotColor = Object.entries(colorStats).sort((a, b) => b[1] - a[1])[0][0];

     // 2.3 五行趋势分析
     const elementStats = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
     recent20.forEach(item => {
       const s = analysisCalc.getSpecial(item);
       if (elementStats.hasOwnProperty(s.wuxing)) {
         elementStats[s.wuxing]++;
       }
     });
     const hotElement = Object.entries(elementStats).sort((a, b) => b[1] - a[1])[0][0];

     // 2.4 每个生肖的属性映射
     const zodiacAttributes = {};
     zodiacOrder.forEach(z => {
       const nums = analysisCalc.getZodiacNumbers(z);
       let oddCnt = 0, bigCnt = 0;
       const colorCnt = { '红': 0, '蓝': 0, '绿': 0 };
       const elementCnt = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
       
       nums.forEach(num => {
         if (num % 2 === 1) oddCnt++;
         if (num >= 25) bigCnt++;
         const color = analysisCalc.getColorName(num);
         if (colorCnt.hasOwnProperty(color)) colorCnt[color]++;
         const element = analysisCalc.getWuxing(num);
         if (elementCnt.hasOwnProperty(element)) elementCnt[element]++;
       });
       
       zodiacAttributes[z] = {
         oddEven: oddCnt > nums.length/2 ? '单' : '双',
         bigSmall: bigCnt > nums.length/2 ? '大' : '小',
         dominantColor: Object.entries(colorCnt).sort((a, b) => b[1] - a[1])[0][0],
         dominantElement: Object.entries(elementCnt).sort((a, b) => b[1] - a[1])[0][0]
       };
     });

     // 2.5 上期尾数关联
     const tailToZodiacMap = {
       0: ['鼠','猪'], 1: ['牛','狗'], 2: ['虎','鸡'], 3: ['兔','猴'],
       4: ['龙','羊'], 5: ['蛇','马'], 6: ['马','蛇'], 7: ['羊','龙'],
       8: ['猴','兔'], 9: ['鸡','虎']
     };

     // 2.6 连出/遗漏形态
     const recent5 = list.slice(0, 5);
     const recent5Count = {};
     zodiacOrder.forEach(z => { recent5Count[z] = 0; });
     recent5.forEach(item => {
       const s = analysisCalc.getSpecial(item);
       recent5Count[s.zod]++;
     });

     // 2.7 五行相生相克关系
     const elementGenerate = {
       '金': ['水'], '水': ['木'], '木': ['火'], '火': ['土'], '土': ['金']
     };
     const elementOvercome = {
       '金': ['木'], '木': ['土'], '土': ['水'], '水': ['火'], '火': ['金']
     };
     const zodiacElement = {
       '鼠': '水', '牛': '土', '虎': '木', '兔': '木', '龙': '土', '蛇': '火',
       '马': '火', '羊': '土', '猴': '金', '鸡': '金', '狗': '土', '猪': '水'
     };

     // 2.8 计算形态分
     const shapeScores = {};
     zodiacOrder.forEach(z => {
       let score = 0;
       const attrs = zodiacAttributes[z];

       // 维度1：单双大小共振（6分）- 根据热门程度加权
       if (attrs.oddEven === hotOddEven && attrs.bigSmall === hotBigSmall) {
         // 如果该形态占比超过60%，给予更高分数
         const ratio = hotOddEven === '单' ? oddRatio : (1 - oddRatio);
         const bigRatioVal = hotBigSmall === '大' ? bigRatio : (1 - bigRatio);
         const avgRatio = (ratio + bigRatioVal) / 2;
         score += Math.round(4 + avgRatio * 2);
       } else if (attrs.oddEven === hotOddEven || attrs.bigSmall === hotBigSmall) {
         score += 2;
       }

       // 维度2：波色匹配（4分）
       if (attrs.dominantColor === hotColor) {
         const colorRatio = colorStats[hotColor] / recent20.length;
         score += Math.round(2 + colorRatio * 2);
       }

       // 维度3：上期尾数关联（3分）
       const lastItem = list[0];
       const lastSpecial = lastItem ? analysisCalc.getSpecial(lastItem) : null;
       const lastTail = lastSpecial ? lastSpecial.tail : -1;
       if (lastTail !== -1 && tailToZodiacMap[lastTail] && tailToZodiacMap[lastTail].includes(z)) {
         score += 3;
       }

       // 维度4：连出/遗漏形态（3分）
       const miss = zodiacMiss[z];
       const isStreak = recent5Count[z] >= 2;
       const isHighMiss = miss >= 15;
       if (isStreak) {
         score += 3; // 连出加分
       } else if (isHighMiss) {
         score += 2; // 高遗漏反弹潜力
       }

       // 维度5：五行关系（4分）- 相生>相同>相克
       if (lastZodiac && zodiacElement[lastZodiac] && zodiacElement[z]) {
         const lastEl = zodiacElement[lastZodiac];
         const curEl = zodiacElement[z];
         
         if (curEl === hotElement) {
           score += 2; // 当前五行是热门五行
         }
         
         if (elementGenerate[lastEl] && elementGenerate[lastEl].includes(curEl)) {
           score += 2; // 相生关系
         } else if (lastEl === curEl) {
           score += 1; // 相同五行
         }
       }

       shapeScores[z] = Math.min(score, 20);
     }); 

     // ========== 3. 间隔规律分（20分）- 增强版 ==========
     const intervalStats = {}; 
     for (let i = 0; i < 13; i++) intervalStats[i] = 0; 
     const recentList = list.slice(0, Math.min(50, list.length)); 
     
     // 统计所有间隔模式
     for (let i = 1; i < recentList.length; i++) { 
         const preZod = analysisCalc.getSpecial(recentList[i-1]).zod; 
         const curZod = analysisCalc.getSpecial(recentList[i]).zod; 
         const preIdx = zodiacOrder.indexOf(preZod); 
         const curIdx = zodiacOrder.indexOf(curZod); 
         if (preIdx !== -1 && curIdx !== -1) { 
             let diff = curIdx - preIdx; 
             if (diff > 6) diff -= 12; 
             if (diff < -6) diff += 12; 
             intervalStats[diff + 6]++; 
         } 
     } 
     
     // 获取前5个常见间隔（增加容错）
     const commonIntervals = Object.entries(intervalStats) 
         .sort((a,b) => b[1] - a[1]) 
         .slice(0, 5) 
         .map(x => ({ diff: parseInt(x[0]) - 6, count: x[1] }));
     
     const maxIntervalCount = commonIntervals.length > 0 ? commonIntervals[0].count : 1;
     
     const intervalScores = {}; 
     if (lastZodiac) { 
         const lastIdx = zodiacOrder.indexOf(lastZodiac); 
         zodiacOrder.forEach(z => { 
             const curIdx = zodiacOrder.indexOf(z); 
             let diff = curIdx - lastIdx; 
             if (diff > 6) diff -= 12; 
             if (diff < -6) diff += 12; 
             
             // 查找匹配的间隔
             const matched = commonIntervals.find(ci => ci.diff === diff);
             if (matched) {
                 // 根据出现频率给予不同分数
                 const frequency = matched.count / maxIntervalCount;
                 intervalScores[z] = Math.round(10 + frequency * 10);
             } else {
                 intervalScores[z] = 0;
             }
         }); 
     } else { 
         zodiacOrder.forEach(z => { intervalScores[z] = 0; }); 
     } 

     // ========== 4. 趋势动量分（15分）- 新增维度 ==========
     const trendScores = {};
     const momentumScores = {};
      
     zodiacOrder.forEach(z => {
       let trendScore = 0;
       let momentumScore = 0;
        
       // 4.1 短期趋势（最近10期 vs 之前10期）
       const recent10 = list.slice(0, Math.min(10, list.length));
       const prev10 = list.slice(10, Math.min(20, list.length));
        
       const recentCount = recent10.filter(item => {
         const s = analysisCalc.getSpecial(item);
         return s.zod === z;
       }).length;
        
       const prevCount = prev10.filter(item => {
         const s = analysisCalc.getSpecial(item);
         return s.zod === z;
       }).length;
        
       // 上升趋势加分
       if (recentCount > prevCount) {
         trendScore = Math.min(8, (recentCount - prevCount) * 4);
       } else if (recentCount < prevCount) {
         // 下降趋势减分
         trendScore = Math.max(-4, (recentCount - prevCount) * 2);
       }
        
       // 4.2 动量指标（最近3期是否有出现）
       const recent3 = list.slice(0, Math.min(3, list.length));
       const hasRecent = recent3.some(item => {
         const s = analysisCalc.getSpecial(item);
         return s.zod === z;
       });
        
       if (hasRecent) {
         momentumScore = 7; // 近期有出现，动量强
       } else if (zodiacMiss[z] <= 7) {
         momentumScore = 4; // 7期内出现过
       } else {
         momentumScore = 2; // 较久未出现
       }
        
       trendScores[z] = Math.max(0, trendScore);
       momentumScores[z] = momentumScore;
     });
 
     // ========== 5. 合并总分及详情 ==========
     const scores = {}; 
     const details = {}; 
     const allScores = [];
      
     zodiacOrder.forEach(z => { 
         const base = baseScores[z]; 
         const shape = shapeScores[z]; 
         const interval = intervalScores[z]; 
         const trend = trendScores[z];
         const momentum = momentumScores[z];
          
         // 总分 = 基础分(30) + 形态分(20) + 间隔分(20) + 趋势分(15) + 动量分(15)
         const totalScore = base + shape + interval + trend + momentum;
         scores[z] = totalScore;
         allScores.push({ zodiac: z, score: totalScore });
          
         // 根据基础分给出辅助状态文字
         let status = ''; 
         if (base >= 24) status = '热'; 
         else if (base >= 14) status = '温'; 
         else status = '冷'; 
          
         details[z] = { 
             base: base, 
             shape: shape, 
             interval: interval,
             trend: trend,
             momentum: momentum,
             total: totalScore, 
             status: status 
         }; 
     });
      
     // 按总分排序
     allScores.sort((a, b) => b.score - a.score);
     const sortedByMiss = allScores.map(item => item.zodiac);
 
     return { scores, details }; 
 },

  /**
   * 获取指定生肖对应的号码列表
   * @param {string} zodiac - 生肖名称
   * @returns {Array} 号码数组
   */
  getZodiacNumbers: (zodiac) => {
    const zodiacNums = {
      '鼠': [10, 22, 34, 46],
      '牛': [9, 21, 33, 45],
      '虎': [8, 20, 32, 44],
      '兔': [7, 19, 31, 43],
      '龙': [6, 18, 30, 42],
      '蛇': [5, 17, 29, 41],
      '马': [4, 16, 28, 40],
      '羊': [3, 15, 27, 39],
      '猴': [2, 14, 26, 38],
      '鸡': [1, 13, 25, 37, 49],
      '狗': [12, 24, 36, 48],
      '猪': [11, 23, 35, 47]
    };
    return zodiacNums[zodiac] || [];
  },

  /**
   * ========================================
   * 特码推演四大核心算法 V2.0
   * ========================================
   * 一、热号惯性算法（趋势延续逻辑）
   * 二、冷号遗漏回补算法（周期修复逻辑）
   * 三、生肖轮换平衡逻辑（12宫轮转逻辑）
   * 四、频次统计排序算法（历史概率基底逻辑）
   */

  /**
   * 【算法一】热号惯性算法
   * 核心目的：利用短期开奖惯性，近期开出的生肖有延续出号概率
   * @param {Array} list - 历史数据列表
   * @param {string} zodiac - 生肖名称
   * @param {number} totalPeriods - 总期数
   * @returns {Object} 热惯性得分和系数
   */
  calcHotInertia: (list, zodiac, totalPeriods) => {
    const result = {
      hotInertiaBonus: 0,
      hotInertiaCoeff: 0,
      recent2Zodiac: [],
      isContinuousHot: false,
      continuousHotCount: 0
    };

    if (!list || list.length < 2) {
      return result;
    }

    const recent2Zodiacs = [
      analysisCalc.getSpecial(list[0]).zod,
      analysisCalc.getSpecial(list[1]).zod
    ];

    result.recent2Zodiac = recent2Zodiacs;

    let hotCount = 0;
    recent2Zodiacs.forEach(z => {
      if (z === zodiac) hotCount++;
    });

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
      let prevZodiac = analysisCalc.getSpecial(recent3[0]).zod;
      for (let i = 1; i < recent3.length; i++) {
        const currentZodiac = analysisCalc.getSpecial(recent3[i]).zod;
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
  },

  /**
   * 【算法二】冷号遗漏回补算法
   * 核心目的：大数规律下，长期遗漏不出的生肖存在概率回补修复需求
   * @param {number} missPeriod - 当前遗漏期数
   * @param {number} avgMiss - 平均遗漏期数
   * @param {number} totalPeriods - 总期数
   * @returns {Object} 遗漏回补得分和系数
   */
  calcMissRepair: (missPeriod, avgMiss, totalPeriods) => {
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
  },

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
  calcCycleBalance: (zodiac, zodiacStateMap, currentHotCount, totalPeriods, list) => {
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
    const recent5Zodiacs = recent5.map(item => analysisCalc.getSpecial(item).zod);
    const hotZodiacInRecent5 = recent5Zodiacs.filter(z => z === zodiac).length;

    if (hotZodiacInRecent5 >= 2) {
      result.cycleBalanceBonus -= 3;
      result.balanceScore -= 3;
    }

    const recent10 = list.slice(0, Math.min(10, list.length));
    const coldZodiacInRecent10 = recent10.filter(item => {
      const z = analysisCalc.getSpecial(item).zod;
      return zodiacStateMap[z] === 'cold' || zodiacStateMap[z] === 'extreme_cold';
    }).length;

    if (coldZodiacInRecent10 >= 7 && result.cycleState !== 'hot') {
      result.cycleBalanceBonus += 5;
      result.balanceScore += 5;
    }

    return result;
  },

  /**
   * 【算法四】频次统计排序算法
   * 核心目的：以历史整体开出频率作为模型基础得分盘口
   * @param {number} count - 生肖出现次数
   * @param {number} totalPeriods - 总期数
   * @param {Array} list - 历史数据列表（用于计算近期频次）
   * @returns {Object} 频次基础分
   */
  calcFrequencyScore: (count, totalPeriods, list) => {
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
    const zodiacOrder = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
    zodiacOrder.forEach(z => { recent30Count[z] = 0; });
    recent30.forEach(item => {
      const z = analysisCalc.getSpecial(item).zod;
      if (recent30Count.hasOwnProperty(z)) {
        recent30Count[z]++;
      }
    });

    const recent30Total = recent30.length;
    const recent30Ratio = recent30Count[Object.keys(recent30Count)[0]] !== undefined 
      ? count / recent30Total 
      : totalRatio;
    result.shortTermScore = Math.round(Math.min(recent30Ratio, 1) * 30);

    result.baseScore = Math.round(
      result.longTermWeight * result.longTermScore + 
      result.shortTermWeight * result.shortTermScore
    );

    return result;
  },

  /**
   * ========================================
   * 综合算法融合 - 总公式计算
   * ========================================
   * 总得分 = 
   *   基础频次分 × 动态权重 
   *   + 热号惯性加分（+10%~15%）
   *   + 遗漏回补加分 
   *   + 轮转平衡得分
   * 按总得分降序，选出最优独胆 + 三码特码
   */
  calcFourAlgorithmFusion: (list, targetZodiac) => {
    const zodiacOrder = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
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
    zodiacOrder.forEach(z => { zodMiss[z] = totalPeriods; });
    list.forEach((item, idx) => {
      const s = analysisCalc.getSpecial(item);
      if (zodMiss[s.zod] === totalPeriods) {
        zodMiss[s.zod] = idx;
      }
    });

    const avgMiss = totalPeriods / 12;

    const zodCount = {};
    zodiacOrder.forEach(z => { zodCount[z] = 0; });
    list.forEach(item => {
      const s = analysisCalc.getSpecial(item);
      zodCount[s.zod]++;
    });

    const zodiacStateMap = {};
    const avgCount = totalPeriods / 12;
    zodiacOrder.forEach(z => {
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

    const freqResult = analysisCalc.calcFrequencyScore(zodCount[targetZodiac], totalPeriods, list);
    const hotInertiaResult = analysisCalc.calcHotInertia(list, targetZodiac, totalPeriods);
    const missRepairResult = analysisCalc.calcMissRepair(zodMiss[targetZodiac], avgMiss, totalPeriods);
    const cycleBalanceResult = analysisCalc.calcCycleBalance(
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
  },

  /**
   * 使用四大算法计算精选生肖 - 升级版V2.0
   * @param {number} periodLimit - 分析期数限制
   * @returns {Array} 排序后的生肖数组 [{zodiac, totalScore, algorithmDetails}, ...]
   */
  calcSelectedZodiacsV2: (periodLimit) => {
    const state = StateManager._state;
    const { historyData } = state.analysis;
    const zodiacOrder = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];

    let list = historyData.slice(0, Math.min(periodLimit, historyData.length));
    
    if (periodLimit === 'all' || periodLimit === 365) {
      const currentLunarYear = analysisCalc.getCurrentLunarYear();
      list = historyData.filter(item => {
        const itemLunarYear = analysisCalc.getLunarYearByDate(item.date);
        return itemLunarYear === currentLunarYear;
      }).slice(0, periodLimit === 'all' ? 365 : periodLimit);
    }

    if (list.length === 0) {
      return [];
    }

    const allZodiacScores = [];
    
    zodiacOrder.forEach(zodiac => {
      const result = analysisCalc.calcFourAlgorithmFusion(list, zodiac);
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
  },

  /**
   * 获取精选生肖（兼容旧版接口）
   * @param {number} periodLimit - 分析期数限制
   * @returns {Map} 生肖Map，生肖名 -> 出现期数数组
   */
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

  /**
   * 获取精选生肖（简化版，直接返回生肖名）
   * @returns {Array} 生肖名数组
   */
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

  /**
   * 获取精选特码（基于四大算法）
   * @param {number} targetCount - 目标数量
   * @param {string} mode - 模式：'hot'/'cold'/'auto'
   * @returns {Array} 号码数组
   */
  getSpecialNumbersV2: (targetCount = 10, mode = 'hot') => {
    const rankedZodiacs = analysisCalc.calcSelectedZodiacsV2(30);
    const state = StateManager._state;
    const config = state.config || {};
    const fullNumZodiacMap = config.fullNumZodiacMap || new Map();

    if (rankedZodiacs.length === 0) {
      return [];
    }

    let targetZodiacs = [];
    if (mode === 'hot') {
      targetZodiacs = rankedZodiacs.slice(0, 6).map(item => item.zodiac);
    } else if (mode === 'cold') {
      targetZodiacs = rankedZodiacs.slice(-6).map(item => item.zodiac);
    } else {
      const autoHotCount = rankedZodiacs.filter(item => item.algorithmDetails?.missLevel === 'normal' || item.algorithmDetails?.missLevel === 'warm').length;
      targetZodiacs = rankedZodiacs.slice(0, Math.max(3, Math.ceil(autoHotCount / 2))).map(item => item.zodiac);
    }

    const recent10 = state.analysis.historyData?.slice(0, 10) || [];
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
      const colorName = analysisCalc.getColorName(num);

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

  /**
   * ========================================
   * 特码推演算法 V3.0 - 终极版
   * ========================================
   * 核心升级：多窗口交叉识别 + 冷热交替行情适配
   */

  /**
   * 【核心模块】多窗口交叉形态识别
   * 识别7种标准走势
   */
  detectMultiWindowPattern: (list, targetZodiac) => {
    const WINDOWS = {
      short: 5,
      mid: 8,
      long: 10
    };

    const zodiacOrder = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
    const avgCount = list.length / 12;

    const getZodiacState = (periodList) => {
      const counts = {};
      zodiacOrder.forEach(z => counts[z] = 0);
      periodList.forEach(item => {
        const z = analysisCalc.getSpecial(item).zod;
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
  },

  /**
   * 【专项模块】冷热交替行情适配
   */
  detectColdHotAlternatingMarket: (list) => {
    if (list.length < 10) return { isAlternating: false, confidence: 0 };

    const zodiacOrder = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
    const recent10 = list.slice(0, 10);
    
    const hotCount = recent10.filter(item => {
      const z = analysisCalc.getSpecial(item).zod;
      const avg = recent10.length / 12;
      const counts = {};
      zodiacOrder.forEach(z => counts[z] = 0);
      recent10.forEach(i => counts[analysisCalc.getSpecial(i).zod]++);
      return counts[z] >= avg * 1.3;
    }).length;

    const coldCount = recent10.filter(item => {
      const z = analysisCalc.getSpecial(item).zod;
      const avg = recent10.length / 12;
      const counts = {};
      zodiacOrder.forEach(z => counts[z] = 0);
      recent10.forEach(i => counts[analysisCalc.getSpecial(i).zod]++);
      return counts[z] <= avg * 0.7;
    }).length;

    const hotRatio = hotCount / 10;
    const coldRatio = coldCount / 10;

    const consecutiveHot = (() => {
      let max = 1, current = 1;
      for (let i = 1; i < recent10.length; i++) {
        const prev = analysisCalc.getSpecial(recent10[i-1]).zod;
        const curr = analysisCalc.getSpecial(recent10[i]).zod;
        if (prev === curr) {
          current++;
          max = Math.max(max, current);
        } else {
          current = 1;
        }
      }
      return max;
    })();

    const isAlternating = hotRatio < 0.4 && coldRatio < 0.4 && consecutiveHot <= 2;
    const confidence = isAlternating ? Math.min(0.9, 0.6 + (1 - hotRatio) * 0.3) : 0;

    return {
      isAlternating,
      confidence,
      hotRatio,
      coldRatio,
      consecutiveHot,
      marketType: isAlternating ? 'cold_hot_alternating' : 'normal'
    };
  },

  /**
   * 【V3.0核心】终极版精选生肖计算
   * 融合：四大基础算法 + 多窗口识别 + 冷热交替适配
   */
  calcSelectedZodiacsV3: (periodLimit) => {
    const state = StateManager._state;
    const { historyData } = state.analysis;
    const zodiacOrder = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];

    let list = historyData.slice(0, Math.min(periodLimit, historyData.length));
    
    if (periodLimit === 'all' || periodLimit === 365) {
      const currentLunarYear = analysisCalc.getCurrentLunarYear();
      list = historyData.filter(item => {
        const itemLunarYear = analysisCalc.getLunarYearByDate(item.date);
        return itemLunarYear === currentLunarYear;
      }).slice(0, periodLimit === 'all' ? 365 : periodLimit);
    }

    if (list.length === 0) {
      return [];
    }

    const marketInfo = analysisCalc.detectColdHotAlternatingMarket(list);
    const isAlternating = marketInfo.isAlternating;
    const marketBonus = isAlternating ? 0.25 : 0;

    const allZodiacScores = [];
    
    zodiacOrder.forEach(zodiac => {
      const patternInfo = analysisCalc.detectMultiWindowPattern(list, zodiac);
      const baseResult = analysisCalc.calcFourAlgorithmFusion(list, zodiac);
      
      let { totalScore, baseScore, hotInertiaBonus, missRepairBonus, cycleBalanceBonus } = baseResult;
      const { algorithmDetails } = baseResult;
      
      let patternBonus = 0;
      let overheatPenalty = 0;

      const recent3 = list.slice(0, 3);
      const consecutiveCount = (() => {
        if (recent3.length < 2) return 1;
        let count = 1;
        const firstZ = analysisCalc.getSpecial(recent3[0]).zod;
        for (let i = 1; i < recent3.length; i++) {
          if (analysisCalc.getSpecial(recent3[i]).zod === firstZ) count++;
          else break;
        }
        return count;
      })();

      if (consecutiveCount > 3) {
        overheatPenalty = Math.round(totalScore * 0.4);
      }

      if (patternInfo.pattern === '持续热肖') {
        patternBonus = Math.round(baseScore * 0.15 * patternInfo.windowWeight);
      } else if (patternInfo.pattern === '持续冷肖' || patternInfo.pattern === '先冷后热') {
        patternBonus = Math.round(baseScore * 0.12 * patternInfo.windowWeight);
      } else if (patternInfo.pattern === '温态肖') {
        patternBonus = Math.round(baseScore * 0.08 * patternInfo.windowWeight);
      } else if (patternInfo.pattern === '冷热交替') {
        patternBonus = Math.round(baseScore * 0.05 * patternInfo.windowWeight);
      }

      if (isAlternating) {
        cycleBalanceBonus = Math.round(cycleBalanceBonus * (1 + marketBonus));
        if (hotInertiaBonus > 0 && consecutiveCount > 3) {
          hotInertiaBonus = Math.round(hotInertiaBonus * 0.5);
        }
        if (patternInfo.pattern !== '持续热肖' && patternInfo.pattern !== '持续冷肖') {
          patternBonus = Math.round(patternBonus * (1 + marketBonus * 0.5));
        }
      }

      const finalScore = Math.max(0, Math.round(
        totalScore - overheatPenalty + patternBonus
      ));

      allZodiacScores.push({
        zodiac,
        totalScore: finalScore,
        baseScore,
        hotInertiaBonus,
        missRepairBonus,
        cycleBalanceBonus,
        patternBonus,
        overheatPenalty,
        algorithmDetails: {
          ...algorithmDetails,
          pattern: patternInfo.pattern,
          patternConfidence: patternInfo.patternConfidence,
          windowWeight: patternInfo.windowWeight,
          marketInfo,
          multiWindow: {
            short: patternInfo.shortState,
            mid: patternInfo.midState,
            long: patternInfo.longState
          }
        }
      });
    });

    allZodiacScores.sort((a, b) => b.totalScore - a.totalScore);

    return allZodiacScores;
  },

  /**
   * 【兼容接口】V3主入口，外部调用默认使用此函数
   */
  getSelectedZodiacsFinal: () => {
    return analysisCalc.calcSelectedZodiacsV3(30);
  },

  /**
   * 获取精选特码 V3（基于V3算法）
   */
  getSpecialNumbersV3: (targetCount = 10, mode = 'hot') => {
    const rankedZodiacs = analysisCalc.calcSelectedZodiacsV3(30);
    const state = StateManager._state;
    const fullNumZodiacMap = state.config?.fullNumZodiacMap || new Map();

    if (rankedZodiacs.length === 0) {
      return [];
    }

    let targetZodiacs = [];
    if (mode === 'hot') {
      targetZodiacs = rankedZodiacs.slice(0, 6).map(item => item.zodiac);
    } else if (mode === 'cold') {
      targetZodiacs = rankedZodiacs.slice(-6).map(item => item.zodiac);
    } else {
      const warmZodiacs = rankedZodiacs.filter(item => 
        item.algorithmDetails?.multiWindow?.mid === 'warm' || 
        item.algorithmDetails?.pattern === '温态肖'
      );
      targetZodiacs = warmZodiacs.length > 0 
        ? warmZodiacs.slice(0, 6).map(item => item.zodiac)
        : rankedZodiacs.slice(0, 6).map(item => item.zodiac);
    }

    const recent10 = state.analysis.historyData?.slice(0, 10) || [];
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
      const colorName = analysisCalc.getColorName(num);

      let matchCount = 0;
      if (targetZodiacs.includes(zodiac)) matchCount++;
      if (hotTails.includes(tail)) matchCount++;
      if (hotColors.includes(colorName)) matchCount++;
      if (hotHeads.includes(head)) matchCount++;

      if (matchCount >= 3) {
        const zodiacScore = rankedZodiacs.find(r => r.zodiac === zodiac)?.totalScore || 0;
        candidateNums.push({ num, matchCount, score: zodiacScore });
      }
    }

    candidateNums.sort((a, b) => {
      if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
      return b.score - a.score;
    });

    return candidateNums.slice(0, targetCount).map(item => item.num);
  },

  // ====================== 特码热门TOP5全新推演算法 ======================

  /**
   * 【步骤1】全网历史特码数据建档
   * 统计每个生肖和数字的总开出次数，标记热/温/冷码
   * @param {Array} historyData - 历史数据
   * @param {number} periodLimit - 分析期数限制
   * @returns {Object} 建档数据
   */
  buildSpecialCodeHistory: (historyData, periodLimit = 'all') => {
    const state = StateManager._state;
    const fullNumZodiacMap = state.config?.fullNumZodiacMap || new Map();

    let list = historyData.slice(0, Math.min(periodLimit, historyData.length));

    if (periodLimit === 'all' || periodLimit === 365) {
      const currentLunarYear = analysisCalc.getCurrentLunarYear();
      list = historyData.filter(item => {
        const itemLunarYear = analysisCalc.getLunarYearByDate(item.date);
        return itemLunarYear === currentLunarYear;
      }).slice(0, periodLimit === 'all' ? 365 : periodLimit);
    }

    const zodiacStats = {};
    const numStats = {};
    const zodiacMiss = {};

    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => zodiacStats[z] = 0);
    for (let i = 1; i <= 49; i++) numStats[i] = 0;

    list.forEach((item, idx) => {
      const special = analysisCalc.getSpecial(item);
      if (special && special.te) {
        const num = special.te;
        const zodiac = special.zod;

        if (zodiac && zodiacStats[zodiac] !== undefined) {
          zodiacStats[zodiac]++;
        }

        if (num >= 1 && num <= 49) {
          numStats[num]++;
        }
      }
    });

    Object.keys(zodiacStats).forEach(z => {
      zodiacMiss[z] = list.length - zodiacStats[z];
    });

    const avgZodiacCount = list.length / 12;
    const avgNumCount = list.length / 49;

    const zodiacHeatLevel = {};
    Object.entries(zodiacStats).forEach(([z, count]) => {
      if (count > avgZodiacCount * 1.3) zodiacHeatLevel[z] = 'hot';
      else if (count > avgZodiacCount * 0.7) zodiacHeatLevel[z] = 'warm';
      else zodiacHeatLevel[z] = 'cold';
    });

    const numHeatLevel = {};
    Object.entries(numStats).forEach(([num, count]) => {
      if (count > avgNumCount * 1.3) numHeatLevel[num] = 'hot';
      else if (count > avgNumCount * 0.7) numHeatLevel[num] = 'warm';
      else numHeatLevel[num] = 'cold';
    });

    return {
      zodiacStats,
      numStats,
      zodiacMiss,
      zodiacHeatLevel,
      numHeatLevel,
      totalPeriods: list.length,
      avgZodiacCount,
      avgNumCount
    };
  },

  /**
   * 【步骤2】热号惯性延续算法
   * 连开生肖标记为一级热度权重，防止热号立即断档
   * @param {Array} recentPeriods - 最近N期数据（至少需要上期和上上期）
   * @param {Object} zodiacStats - 生肖统计数据
   * @returns {Object} 热号惯性数据
   */
  calcHotNumberInertia: (recentPeriods, zodiacStats) => {
    const inertiaWeight = {};

    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => inertiaWeight[z] = 0);

    if (recentPeriods.length < 1) {
      return { inertiaWeight, consecutiveHot: [], recentHotZodiac: null };
    }

    const recentHotZodiac = analysisCalc.getSpecial(recentPeriods[0])?.zod;

    let consecutiveCount = 1;
    if (recentPeriods.length >= 2) {
      const firstZ = analysisCalc.getSpecial(recentPeriods[0])?.zod;
      const secondZ = analysisCalc.getSpecial(recentPeriods[1])?.zod;
      if (firstZ === secondZ) {
        consecutiveCount = 2;
        if (recentPeriods.length >= 3) {
          const thirdZ = analysisCalc.getSpecial(recentPeriods[2])?.zod;
          if (secondZ === thirdZ) consecutiveCount = 3;
        }
      }
    }

    if (recentHotZodiac && inertiaWeight[recentHotZodiac] !== undefined) {
      inertiaWeight[recentHotZodiac] = consecutiveCount * 0.3;
    }

    const consecutiveHot = [];
    if (recentPeriods.length >= 2) {
      let tempZ = analysisCalc.getSpecial(recentPeriods[0])?.zod;
      let tempCount = 1;
      for (let i = 1; i < recentPeriods.length; i++) {
        const currZ = analysisCalc.getSpecial(recentPeriods[i])?.zod;
        if (currZ === tempZ) {
          tempCount++;
          if (tempCount >= 2) {
            consecutiveHot.push({ zodiac: tempZ, count: tempCount });
          }
        } else {
          tempZ = currZ;
          tempCount = 1;
        }
      }
    }

    return {
      inertiaWeight,
      consecutiveHot,
      recentHotZodiac,
      consecutiveCount
    };
  },

  /**
   * 【步骤3】冷号周期回补算法
   * 遗漏值达到临界周期，判定触发回补窗口期
   * @param {Object} zodiacMiss - 生肖遗漏值
   * @param {Object} numMiss - 数字遗漏值
   * @param {number} totalPeriods - 总期数
   * @returns {Object} 回补窗口期数据
   */
  calcColdReboundWindow: (zodiacMiss, numMiss, totalPeriods) => {
    const avgMiss = totalPeriods / 12;
    const avgNumMiss = totalPeriods / 49;

    const reboundWeight = {};
    const criticalThreshold = avgMiss * 1.5;
    const numCriticalThreshold = avgNumMiss * 1.5;

    Object.entries(zodiacMiss).forEach(([zodiac, miss]) => {
      if (miss >= criticalThreshold) {
        const excessRate = (miss - avgMiss) / avgMiss;
        reboundWeight[zodiac] = Math.min(0.5, excessRate * 0.2);
      } else {
        reboundWeight[zodiac] = 0;
      }
    });

    const numReboundWeight = {};
    Object.entries(numMiss).forEach(([num, miss]) => {
      if (miss >= numCriticalThreshold) {
        const excessRate = (miss - avgNumMiss) / avgNumMiss;
        numReboundWeight[num] = Math.min(0.5, excessRate * 0.2);
      } else {
        numReboundWeight[num] = 0;
      }
    });

    const triggerReboundZodiacs = Object.entries(reboundWeight)
      .filter(([_, w]) => w > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([zodiac, weight]) => ({ zodiac, weight, miss: zodiacMiss[zodiac] }));

    const triggerReboundNums = Object.entries(numReboundWeight)
      .filter(([_, w]) => w > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([num, weight]) => ({ num: parseInt(num), weight, miss: numMiss[num] }));

    return {
      reboundWeight,
      numReboundWeight,
      triggerReboundZodiacs,
      triggerReboundNums,
      criticalThreshold,
      numCriticalThreshold
    };
  },

  /**
   * 【步骤4】生肖闭环轮换逻辑
   * 热肖退场→温肖过渡→冷肖补位，循环往复
   * @param {Object} zodiacHeatLevel - 生肖冷热级别
   * @param {Object} zodiacStats - 生肖统计数据
   * @param {Array} recentHotZodiacs - 最近热出的生肖
   * @returns {Object} 轮换筛选数据
   */
  calcZodiacRotationCycle: (zodiacHeatLevel, zodiacStats, recentHotZodiacs) => {
    const rotationWeight = {};

    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => rotationWeight[z] = 1.0);

    const recentSet = new Set(recentHotZodiacs || []);

    Object.entries(zodiacHeatLevel).forEach(([zodiac, level]) => {
      if (level === 'hot' && recentSet.has(zodiac)) {
        rotationWeight[zodiac] = 0.4;
      } else if (level === 'cold') {
        rotationWeight[zodiac] = 1.5;
      } else if (level === 'warm') {
        rotationWeight[zodiac] = 1.0;
      } else if (level === 'hot') {
        rotationWeight[zodiac] = 0.7;
      }
    });

    const hotZodiacs = Object.entries(zodiacHeatLevel)
      .filter(([_, level]) => level === 'hot')
      .map(([z]) => z);
    const coldZodiacs = Object.entries(zodiacHeatLevel)
      .filter(([_, level]) => level === 'cold')
      .map(([z]) => z);

    const rotationPhase = hotZodiacs.length > 6 ? '热肖退场期' :
                          coldZodiacs.length > 6 ? '冷肖补位期' : '温肖过渡期';

    return {
      rotationWeight,
      hotZodiacs,
      coldZodiacs,
      rotationPhase
    };
  },

  /**
   * 【步骤5】最终一精三筛选定稿
   * 综合权重排序，精选1个独胆+3个备选
   * @param {Array} candidateNums - 候选号码池
   * @param {Object} weights - 各维度权重
   * @param {number} targetCount - 目标数量
   * @returns {Array} 最终精选号码
   */
  finalSelection: (candidateNums, weights, targetCount = 4) => {
    const scored = candidateNums.map(num => {
      const inertia = weights.inertiaWeight?.[weights.targetZodiacs?.find(z => weights.fullNumZodiacMap?.get(num) === z)] || 0;
      const rebound = weights.numReboundWeight?.[num] || 0;
      const rotation = weights.rotationWeight?.[weights.fullNumZodiacMap?.get(num)] || 1.0;
      const heat = weights.numHeatLevel?.[num] === 'hot' ? 0.8 :
                   weights.numHeatLevel?.[num] === 'warm' ? 1.0 : 1.2;

      const totalScore = (heat * 0.3 + inertia * 0.25 + rebound * 0.25 + rotation * 0.2) * 100;

      return {
        num,
        totalScore,
        breakdown: { heat, inertia, rebound, rotation }
      };
    });

    scored.sort((a, b) => b.totalScore - a.totalScore);

    const finalNums = scored.slice(0, targetCount);

    return {
      primary: finalNums[0]?.num || null,
      backups: finalNums.slice(1).map(item => item.num),
      all: finalNums.map(item => item.num),
      detail: finalNums
    };
  },

  /**
   * 【主入口】特码热门TOP5全新推演算法
   * 整合五大步骤，输出完整推演结果
   * @param {Array} historyData - 历史数据
   * @param {number} targetCount - 目标数量
   * @param {Map} fullNumZodiacMap - 号码生肖映射
   * @returns {Array} 精选号码数组
   */
  getHotNumbersV2: (historyData, targetCount = 5, fullNumZodiacMap) => {
    const state = StateManager._state;
    const actualFullNumZodiacMap = fullNumZodiacMap || state.config?.fullNumZodiacMap || new Map();

    const recent30 = historyData.slice(0, 30);
    const recent10 = historyData.slice(0, 10);
    const recent3 = historyData.slice(0, 3);

    const step1Data = analysisCalc.buildSpecialCodeHistory(historyData, 'all');

    const step2Data = analysisCalc.calcHotNumberInertia(recent3, step1Data.zodiacStats);

    const recentHotZodiacs = recent10.map(item => analysisCalc.getSpecial(item)?.zod).filter(Boolean);

    const numMiss = {};
    for (let num = 1; num <= 49; num++) {
      let miss = 0;
      for (let i = 0; i < historyData.length; i++) {
        if (analysisCalc.getSpecial(historyData[i])?.te === num) break;
        miss++;
      }
      numMiss[num] = miss;
    }

    const step3Data = analysisCalc.calcColdReboundWindow(step1Data.zodiacMiss, numMiss, step1Data.totalPeriods);

    const step4Data = analysisCalc.calcZodiacRotationCycle(
      step1Data.zodiacHeatLevel,
      step1Data.zodiacStats,
      recentHotZodiacs
    );

    const rankedZodiacs = analysisCalc.calcSelectedZodiacsV3(30);
    const hotZodiacs = rankedZodiacs.slice(0, 6).map(item => item.zodiac);

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
      const zodiac = actualFullNumZodiacMap.get(num);
      if (!zodiac || !hotZodiacs.includes(zodiac)) continue;

      const tail = num % 10;
      const head = Math.floor(num / 10);
      const colorName = analysisCalc.getColorName(num);

      let matchCount = 0;
      if (hotZodiacs.includes(zodiac)) matchCount++;
      if (hotTails.includes(tail)) matchCount++;
      if (hotColors.includes(colorName)) matchCount++;
      if (hotHeads.includes(head)) matchCount++;

      if (matchCount >= 3) {
        candidateNums.push(num);
      }
    }

    if (candidateNums.length < targetCount) {
      for (let num = 1; num <= 49; num++) {
        if (candidateNums.includes(num)) continue;
        const zodiac = actualFullNumZodiacMap.get(num);
        if (!zodiac) continue;

        const tail = num % 10;
        const head = Math.floor(num / 10);
        const colorName = analysisCalc.getColorName(num);

        let matchCount = 0;
        if (hotZodiacs.includes(zodiac)) matchCount++;
        if (hotTails.includes(tail)) matchCount++;
        if (hotColors.includes(colorName)) matchCount++;
        if (hotHeads.includes(head)) matchCount++;

        if (matchCount >= 2) {
          candidateNums.push(num);
        }
      }
    }

    const weights = {
      inertiaWeight: step2Data.inertiaWeight,
      reboundWeight: step3Data.reboundWeight,
      numReboundWeight: step3Data.numReboundWeight,
      rotationWeight: step4Data.rotationWeight,
      targetZodiacs: hotZodiacs,
      fullNumZodiacMap: actualFullNumZodiacMap,
      numHeatLevel: step1Data.numHeatLevel
    };

    const finalResult = analysisCalc.finalSelection(candidateNums, weights, targetCount);

    console.log('[特码热门V2算法] 推演完成', {
      步骤1: { 总期数: step1Data.totalPeriods, 热肖数: Object.values(step1Data.zodiacHeatLevel).filter(v => v === 'hot').length },
      步骤2: { 连开生肖: step2Data.recentHotZodiac, 连开次数: step2Data.consecutiveCount },
      步骤3: { 触发回补生肖: step3Data.triggerReboundZodiacs.length, 触发回补号码: step3Data.triggerReboundNums.length },
      步骤4: { 轮换阶段: step4Data.rotationPhase, 热肖: step4Data.hotZodiacs.length, 冷肖: step4Data.coldZodiacs.length },
      步骤5: { 独胆: finalResult.primary, 备选: finalResult.backups }
    });

    return finalResult.all;
  },

  /**
   * 实时刷新冷热排行回调
   * 当新一期开奖后自动触发，更新所有冷热数据
   * @param {Object} newResult - 最新一期开奖结果
   * @param {Array} historyData - 更新后的历史数据
   */
  onNewLotteryResult: (newResult, historyData) => {
    console.log('[特码热门V2算法] 检测到新一期开奖，开始刷新冷热排行...', newResult);

    const step1Data = analysisCalc.buildSpecialCodeHistory(historyData, 'all');
    console.log('[刷新完成] 步骤1数据已更新', {
      总期数: step1Data.totalPeriods,
      热肖: Object.values(step1Data.zodiacHeatLevel).filter(v => v === 'hot').length,
      冷肖: Object.values(step1Data.zodiacHeatLevel).filter(v => v === 'cold').length
    });

    const recent3 = historyData.slice(0, 3);
    const step2Data = analysisCalc.calcHotNumberInertia(recent3, step1Data.zodiacStats);
    console.log('[刷新完成] 步骤2热号惯性已更新', {
      最新热肖: step2Data.recentHotZodiac,
      连开次数: step2Data.consecutiveCount
    });

    const numMiss = {};
    for (let num = 1; num <= 49; num++) {
      let miss = 0;
      for (let i = 0; i < historyData.length; i++) {
        if (analysisCalc.getSpecial(historyData[i])?.te === num) break;
        miss++;
      }
      numMiss[num] = miss;
    }

    const step3Data = analysisCalc.calcColdReboundWindow(step1Data.zodiacMiss, numMiss, step1Data.totalPeriods);
    console.log('[刷新完成] 步骤3冷号回补已更新', {
      触发回补生肖数: step3Data.triggerReboundZodiacs.length,
      触发回补号码数: step3Data.triggerReboundNums.length
    });

    const recent10 = historyData.slice(0, 10);
    const recentHotZodiacs = recent10.map(item => analysisCalc.getSpecial(item)?.zod).filter(Boolean);
    const step4Data = analysisCalc.calcZodiacRotationCycle(step1Data.zodiacHeatLevel, step1Data.zodiacStats, recentHotZodiacs);
    console.log('[刷新完成] 步骤4生肖轮换已更新', {
      轮换阶段: step4Data.rotationPhase,
      热肖数: step4Data.hotZodiacs.length,
      冷肖数: step4Data.coldZodiacs.length
    });

    console.log('[特码热门V2算法] ✅ 冷热排行刷新完成，准备重新计算下期推荐');

    return {
      step1Data,
      step2Data,
      step3Data,
      step4Data
    };
  },

  /**
   * 获取特码热门TOP5推演详情报告
   * @param {Array} historyData - 历史数据
   * @returns {Object} 完整推演报告
   */
  getHotNumbersReport: (historyData) => {
    const state = StateManager._state;
    const fullNumZodiacMap = state.config?.fullNumZodiacMap || new Map();

    const recent30 = historyData.slice(0, 30);
    const recent10 = historyData.slice(0, 10);
    const recent3 = historyData.slice(0, 3);

    const step1Data = analysisCalc.buildSpecialCodeHistory(historyData, 'all');

    const step2Data = analysisCalc.calcHotNumberInertia(recent3, step1Data.zodiacStats);

    const recentHotZodiacs = recent10.map(item => analysisCalc.getSpecial(item)?.zod).filter(Boolean);

    const numMiss = {};
    for (let num = 1; num <= 49; num++) {
      let miss = 0;
      for (let i = 0; i < historyData.length; i++) {
        if (analysisCalc.getSpecial(historyData[i])?.te === num) break;
        miss++;
      }
      numMiss[num] = miss;
    }

    const step3Data = analysisCalc.calcColdReboundWindow(step1Data.zodiacMiss, numMiss, step1Data.totalPeriods);

    const step4Data = analysisCalc.calcZodiacRotationCycle(
      step1Data.zodiacHeatLevel,
      step1Data.zodiacStats,
      recentHotZodiacs
    );

    const rankedZodiacs = analysisCalc.calcSelectedZodiacsV3(30);
    const hotZodiacs = rankedZodiacs.slice(0, 6).map(item => item.zodiac);

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

    const weights = {
      inertiaWeight: step2Data.inertiaWeight,
      reboundWeight: step3Data.reboundWeight,
      numReboundWeight: step3Data.numReboundWeight,
      rotationWeight: step4Data.rotationWeight,
      targetZodiacs: hotZodiacs,
      fullNumZodiacMap: fullNumZodiacMap,
      numHeatLevel: step1Data.numHeatLevel
    };

    const candidateNums = [];
    for (let num = 1; num <= 49; num++) {
      const zodiac = fullNumZodiacMap.get(num);
      if (!zodiac || !hotZodiacs.includes(zodiac)) continue;

      const tail = num % 10;
      const head = Math.floor(num / 10);
      const colorName = analysisCalc.getColorName(num);

      let matchCount = 0;
      if (hotZodiacs.includes(zodiac)) matchCount++;
      if (hotTails.includes(tail)) matchCount++;
      if (hotColors.includes(colorName)) matchCount++;
      if (hotHeads.includes(head)) matchCount++;

      if (matchCount >= 3) {
        candidateNums.push(num);
      }
    }

    if (candidateNums.length < 5) {
      for (let num = 1; num <= 49; num++) {
        if (candidateNums.includes(num)) continue;
        const zodiac = fullNumZodiacMap.get(num);
        if (!zodiac) continue;

        const tail = num % 10;
        const head = Math.floor(num / 10);
        const colorName = analysisCalc.getColorName(num);

        let matchCount = 0;
        if (hotZodiacs.includes(zodiac)) matchCount++;
        if (hotTails.includes(tail)) matchCount++;
        if (hotColors.includes(colorName)) matchCount++;
        if (hotHeads.includes(head)) matchCount++;

        if (matchCount >= 2) {
          candidateNums.push(num);
        }
      }
    }

    const finalResult = analysisCalc.finalSelection(candidateNums, weights, 5);

    return {
      step1: {
        ...step1Data,
        hotZodiacs: Object.entries(step1Data.zodiacHeatLevel)
          .filter(([_, level]) => level === 'hot')
          .map(([z]) => z),
        coldZodiacs: Object.entries(step1Data.zodiacHeatLevel)
          .filter(([_, level]) => level === 'cold')
          .map(([z]) => z)
      },
      step2: {
        ...step2Data,
        consecutiveHot: step2Data.consecutiveHot
      },
      step3: {
        ...step3Data,
        topReboundZodiacs: step3Data.triggerReboundZodiacs.slice(0, 5),
        topReboundNums: step3Data.triggerReboundNums.slice(0, 5)
      },
      step4: step4Data,
      step5: finalResult,
      hotTails,
      hotColors,
      hotHeads,
      hotZodiacs
    };
  }
};