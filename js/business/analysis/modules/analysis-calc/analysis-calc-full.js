// ====================== 全维度分析模块 ======================

import { CONFIG } from '../../../../config.js';
import { PerformanceMonitor } from '../../../../performance-monitor.js';
import { getTopEntry, getColor, getElement } from './analysis-calc-utils.js';

/**
 * 计算全维度分析
 * @param {Array} historyData - 历史数据
 * @param {number} analyzeLimit - 分析期数限制
 * @returns {Object} 分析数据
 */
export function calcFullAnalysis(historyData, analyzeLimit) {
  return PerformanceMonitor.monitorProcessing(() => {
    if (!historyData || !historyData.length) return null;

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
    for (let i = 1; i <= 49; i++) numCount[String(i).padStart(2, '0')] = 0;
    const lastAppear = {};
    for (let i = 1; i <= 49; i++) lastAppear[i] = -1;

    // 统计
    list.forEach((item, idx) => {
      const s = getSpecial(item);
      s.odd ? singleDouble['单']++ : singleDouble['双']++;
      s.big ? bigSmall['大']++ : bigSmall['小']++;
      s.te <= 9 ? range['1-9']++ : s.te <= 19 ? range['10-19']++ : s.te <= 29 ? range['20-29']++ : s.te <= 39 ? range['30-39']++ : range['40-49']++;
      head[s.head]++;
      tail[s.tail]++;
      color[s.colorName]++;
      wuxing[s.wuxing]++;
      animal[s.animal]++;
      if (CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) zodiac[s.zod]++;
      numCount[String(s.te).padStart(2, '0')]++;
      if (lastAppear[s.te] === -1) lastAppear[s.te] = idx;
    });

    // 遗漏计算
    let totalMissSum = 0, maxMiss = 0, hot = 0, warm = 0, cold = 0;
    const allMiss = [];
    for (let m = 1; m <= 49; m++) {
      const p = lastAppear[m];
      const currentMiss = p === -1 ? total : p;
      allMiss.push(currentMiss);
      totalMissSum += currentMiss;
      if (currentMiss > maxMiss) maxMiss = currentMiss;
      if (currentMiss <= 3) hot++;
      else if (currentMiss <= 9) warm++;
      else cold++;
    }
    const avgMiss = (totalMissSum / 49).toFixed(1);
    const curMaxMiss = Math.max(...allMiss);

    // 连出计算
    let curStreak = 1, maxStreak = 1, current = 1;
    let curStreakData = [];
    let maxStreakData = [];
    let tempStreakData = [];
    
    const getShapeText = (odd, big) => {
      const oddText = odd ? '单' : '双';
      const bigText = big ? '大' : '小';
      return `${oddText}_${bigText}`;
    };
    
    if (list.length >= 2) {
      const firstSpecial = getSpecial(list[0]);
      const firstShape = getShapeText(firstSpecial.odd, firstSpecial.big);
      curStreakData.push({ expect: list[0].expect, te: firstSpecial.te, shape: firstShape });
      for (let i = 1; i < list.length; i++) {
        const s = getSpecial(list[i]);
        const shape = getShapeText(s.odd, s.big);
        if (shape === firstShape) {
          curStreak++;
          curStreakData.push({ expect: list[i].expect, te: s.te, shape });
        } else break;
      }
      
      let prevShape = getShapeText(firstSpecial.odd, firstSpecial.big);
      tempStreakData.push({ expect: list[0].expect, te: firstSpecial.te, shape: prevShape });
      
      for (let i = 1; i < list.length; i++) {
        const s = getSpecial(list[i]);
        const shape = getShapeText(s.odd, s.big);
        if (shape === prevShape) {
          current++;
          tempStreakData.push({ expect: list[i].expect, te: s.te, shape });
          if (current > maxStreak) {
            maxStreak = current;
            maxStreakData = [...tempStreakData];
          }
        } else {
          current = 1;
          prevShape = shape;
          tempStreakData = [{ expect: list[i].expect, te: s.te, shape }];
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
}

/**
 * 获取特码信息
 * @param {Object} item - 历史数据项
 * @returns {Object} 特码信息
 */
export function getSpecial(item) {
  const codeArr = (item.openCode || "0,0,0,0,0,0,0").split(",");
  const zodArrRaw = (item.zodiac || ",,,,,,,,,,,").split(",");
  const zodArr = zodArrRaw.map(z => CONFIG.ANALYSIS.ZODIAC_TRAD_TO_SIMP[z] || z);
  const te = Math.max(0, Number(codeArr[6]));
  const colorInfo = getColor(te);
  
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
    wuxing: getElement(te),
    fullZodArr: zodArr
  };
}

/**
 * 获取生肖热度等级
 * @param {number} count - 出现次数
 * @param {number} miss - 遗漏期数
 * @param {number} total - 总期数
 * @returns {Object} 热度等级对象
 */
export function getZodiacLevel(count, miss, total) {
  const avgCount = total / 12;
  if (count >= avgCount * 1.5 && miss <= 3) return { cls: 'hot', text: '热' };
  if (count <= avgCount * 0.5 || miss >= 8) return { cls: 'cold', text: '冷' };
  return { cls: 'warm', text: '温' };
}

/**
 * 构建球号元素
 * @param {string|number} num - 号码
 * @param {string} color - 颜色类名
 * @param {string} zodiac - 生肖
 * @returns {string} HTML字符串
 */
export function buildBall(num, color, zodiac) {
  return `<div class="ball-item"><div class="ball ${color}">${num}</div><div class="ball-zodiac">${zodiac}</div></div>`;
}



export default {
  calcFullAnalysis,
  getSpecial,
  getZodiacLevel,
  buildBall
};
