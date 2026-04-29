// ====================== 五维度评分算法模块 ======================

import { ZODIAC_ORDER, ZODIAC_ELEMENT, ELEMENT_GENERATE, TAIL_TO_ZODIAC, getZodiacNumbers, getColor, getElement } from './analysis-calc-utils.js';
import { getSpecial } from './analysis-calc-full.js';

/**
 * 【优化版】多维度综合评分方案 - 基于全维度数据分析
 * @param {Object} data - calcZodiacAnalysis 返回的数据对象
 * @returns {Object} { scores: {生肖: 总分}, details: {生肖: {base, shape, interval, trend, momentum, total, rank, status}} }
 */
export function calcContinuousScores(data) {
  if (!data || !data.list || data.list.length === 0) {
    return { scores: {}, details: {} };
  }

  const list = data.list;
  const lastZodiac = list.length > 0 ? getSpecial(list[0]).zod : '';
  const totalPeriods = list.length;

  // ========== 1. 基础热度分（30分）- 基于遗漏期数的非线性映射 ==========
  const zodiacMiss = {};
  ZODIAC_ORDER.forEach(z => { zodiacMiss[z] = totalPeriods; });
  list.forEach((item, idx) => {
    const s = getSpecial(item);
    if (zodiacMiss[s.zod] === totalPeriods) {
      zodiacMiss[s.zod] = idx;
    }
  });

  const baseScores = {};
  ZODIAC_ORDER.forEach(z => {
    const miss = zodiacMiss[z];
    let score = 0;
    
    if (miss <= 2) {
      score = 30 - (miss * 2.5);
    } else if (miss <= 6) {
      score = 25 - ((miss - 2) * 1.75);
    } else if (miss <= 12) {
      score = 18 - ((miss - 6) * 1.33);
    } else if (miss <= 20) {
      score = 10 - ((miss - 12) * 0.75);
    } else {
      score = Math.max(2, 4 - ((miss - 20) * 0.25));
    }
    
    baseScores[z] = Math.round(score);
  });

  // ========== 2. 形态共振分（20分）- 多维度形态匹配 ==========
  const recent15 = list.slice(0, Math.min(15, list.length));
  let oddCount = 0, evenCount = 0, bigCount = 0, smallCount = 0;
  recent15.forEach(item => {
    const s = getSpecial(item);
    if (s.odd) oddCount++; else evenCount++;
    if (s.big) bigCount++; else smallCount++;
  });
  const hotOddEven = oddCount > evenCount ? '单' : '双';
  const hotBigSmall = bigCount > smallCount ? '大' : '小';

  const recent20 = list.slice(0, Math.min(20, list.length));
  const colorStats = { '红': 0, '蓝': 0, '绿': 0 };
  recent20.forEach(item => {
    const s = getSpecial(item);
    if (colorStats.hasOwnProperty(s.colorName)) {
      colorStats[s.colorName]++;
    }
  });
  const hotColor = Object.entries(colorStats).sort((a, b) => b[1] - a[1])[0][0];

  const elementStats = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
  recent20.forEach(item => {
    const s = getSpecial(item);
    if (elementStats.hasOwnProperty(s.wuxing)) {
      elementStats[s.wuxing]++;
    }
  });
  const hotElement = Object.entries(elementStats).sort((a, b) => b[1] - a[1])[0][0];

  const zodiacAttributes = {};
  ZODIAC_ORDER.forEach(z => {
    const nums = getZodiacNumbers(z);
    let oddCnt = 0, bigCnt = 0;
    const colorCnt = { '红': 0, '蓝': 0, '绿': 0 };
    const elementCnt = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
    
    nums.forEach(num => {
      if (num % 2 === 1) oddCnt++;
      if (num >= 25) bigCnt++;
      const color = getColor(num).name;
      if (colorCnt.hasOwnProperty(color)) colorCnt[color]++;
      const element = getElement(num);
      if (elementCnt.hasOwnProperty(element)) elementCnt[element]++;
    });
    
    zodiacAttributes[z] = {
      oddEven: oddCnt > nums.length / 2 ? '单' : '双',
      bigSmall: bigCnt > nums.length / 2 ? '大' : '小',
      dominantColor: Object.entries(colorCnt).sort((a, b) => b[1] - a[1])[0][0],
      dominantElement: Object.entries(elementCnt).sort((a, b) => b[1] - a[1])[0][0]
    };
  });

  const recent5 = list.slice(0, 5);
  const recent5Count = {};
  ZODIAC_ORDER.forEach(z => { recent5Count[z] = 0; });
  recent5.forEach(item => {
    const s = getSpecial(item);
    recent5Count[s.zod]++;
  });

  const shapeScores = {};
  ZODIAC_ORDER.forEach(z => {
    let score = 0;
    const attrs = zodiacAttributes[z];

    // 维度1：单双大小共振
    if (attrs.oddEven === hotOddEven && attrs.bigSmall === hotBigSmall) {
      score += 6;
    } else if (attrs.oddEven === hotOddEven || attrs.bigSmall === hotBigSmall) {
      score += 2;
    }

    // 维度2：波色匹配
    if (attrs.dominantColor === hotColor) {
      score += 4;
    }

    // 维度3：上期尾数关联
    const lastItem = list[0];
    const lastSpecial = lastItem ? getSpecial(lastItem) : null;
    const lastTail = lastSpecial ? lastSpecial.tail : -1;
    if (lastTail !== -1 && TAIL_TO_ZODIAC[lastTail] && TAIL_TO_ZODIAC[lastTail].includes(z)) {
      score += 3;
    }

    // 维度4：连出/遗漏形态
    const miss = zodiacMiss[z];
    const isStreak = recent5Count[z] >= 2;
    const isHighMiss = miss >= 15;
    if (isStreak) score += 3;
    else if (isHighMiss) score += 2;

    // 维度5：五行关系
    if (lastZodiac && ZODIAC_ELEMENT[lastZodiac] && ZODIAC_ELEMENT[z]) {
      const lastEl = ZODIAC_ELEMENT[lastZodiac];
      const curEl = ZODIAC_ELEMENT[z];
      if (curEl === hotElement) score += 2;
      if (ELEMENT_GENERATE[lastEl] && ELEMENT_GENERATE[lastEl].includes(curEl)) {
        score += 2;
      }
    }

    shapeScores[z] = Math.min(score, 20);
  });

  // ========== 3. 间隔规律分（20分） ==========
  const intervalStats = {};
  for (let i = 0; i < 13; i++) intervalStats[i] = 0;
  const recentList = list.slice(0, Math.min(50, list.length));
  
  for (let i = 1; i < recentList.length; i++) {
    const preZod = getSpecial(recentList[i - 1]).zod;
    const curZod = getSpecial(recentList[i]).zod;
    const preIdx = ZODIAC_ORDER.indexOf(preZod);
    const curIdx = ZODIAC_ORDER.indexOf(curZod);
    if (preIdx !== -1 && curIdx !== -1) {
      let diff = curIdx - preIdx;
      if (diff > 6) diff -= 12;
      if (diff < -6) diff += 12;
      intervalStats[diff + 6]++;
    }
  }
  
  const commonIntervals = Object.entries(intervalStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(x => ({ diff: parseInt(x[0]) - 6, count: x[1] }));
  
  const maxIntervalCount = commonIntervals.length > 0 ? commonIntervals[0].count : 1;
  
  const intervalScores = {};
  if (lastZodiac) {
    const lastIdx = ZODIAC_ORDER.indexOf(lastZodiac);
    ZODIAC_ORDER.forEach(z => {
      const curIdx = ZODIAC_ORDER.indexOf(z);
      let diff = curIdx - lastIdx;
      if (diff > 6) diff -= 12;
      if (diff < -6) diff += 12;
      
      const matched = commonIntervals.find(ci => ci.diff === diff);
      if (matched) {
        const frequency = matched.count / maxIntervalCount;
        intervalScores[z] = Math.round(10 + frequency * 10);
      } else {
        intervalScores[z] = 0;
      }
    });
  } else {
    ZODIAC_ORDER.forEach(z => { intervalScores[z] = 0; });
  }

  // ========== 4. 趋势动量分（15分） ==========
  const trendScores = {};
  const momentumScores = {};
  
  ZODIAC_ORDER.forEach(z => {
    let trendScore = 0;
    let momentumScore = 0;
    
    const recent10 = list.slice(0, Math.min(10, list.length));
    const prev10 = list.slice(10, Math.min(20, list.length));
    
    const recentCount = recent10.filter(item => getSpecial(item).zod === z).length;
    const prevCount = prev10.filter(item => getSpecial(item).zod === z).length;
    
    if (recentCount > prevCount) {
      trendScore = Math.min(8, (recentCount - prevCount) * 4);
    } else if (recentCount < prevCount) {
      trendScore = Math.max(-4, (recentCount - prevCount) * 2);
    }
    
    const recent3 = list.slice(0, Math.min(3, list.length));
    const hasRecent = recent3.some(item => getSpecial(item).zod === z);
    
    if (hasRecent) {
      momentumScore = 7;
    } else if (zodiacMiss[z] <= 7) {
      momentumScore = 4;
    } else {
      momentumScore = 2;
    }
    
    trendScores[z] = Math.max(0, trendScore);
    momentumScores[z] = momentumScore;
  });

  // ========== 5. 合并总分及详情 ==========
  const scores = {};
  const details = {};
  const allScores = [];
  
  ZODIAC_ORDER.forEach(z => {
    const base = baseScores[z];
    const shape = shapeScores[z];
    const interval = intervalScores[z];
    const trend = trendScores[z];
    const momentum = momentumScores[z];
    
    const totalScore = base + shape + interval + trend + momentum;
    scores[z] = totalScore;
    allScores.push({ zodiac: z, score: totalScore });
    
    let status = '';
    if (base >= 24) status = '热';
    else if (base >= 14) status = '温';
    else status = '冷';
    
    details[z] = {
      base, shape, interval, trend, momentum,
      total: totalScore,
      status
    };
  });
  
  allScores.sort((a, b) => b.score - a.score);
  
  return { scores, details };
}

export default { calcContinuousScores };
