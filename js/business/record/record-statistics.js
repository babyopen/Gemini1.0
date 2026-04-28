// ====================== 预测统计计算模块 ======================

import { Storage } from '../../storage.js';
import { Toast } from '../../toast.js';
import { RECORD_CONSTANTS } from './record-constants.js';

/**
 * 计算基础统计
 * @param {Array} records - 记录数组
 * @returns {Object} 统计结果
 */
export function calculateStats(records) {
  let hit = 0, miss = 0, pending = 0;
  let latestIssue = null;
  let latestTime = null;
  let latestZodiacs = null;
  
  records.forEach(rec => {
    if (rec.checked) {
      rec.matched === true ? hit++ : miss++;
    } else {
      pending++;
    }
    
    if (!latestIssue && rec.issue) {
      latestIssue = rec.issue;
      latestTime = rec.createdAt;
      latestZodiacs = Array.isArray(rec.zodiacs) ? rec.zodiacs : [];
    }
  });
  
  const total = records.length;
  const rate = (hit + miss) > 0 ? ((hit / (hit + miss)) * 100).toFixed(1) : '0.0';
  
  let latest = '暂无数据';
  if (latestIssue) {
    const dateStr = latestTime ? new Date(latestTime).toLocaleString('zh-CN', RECORD_CONSTANTS.DATE_FORMAT) : '';
    latest = `第${latestIssue}期 ${dateStr}`;
  }
  
  const latestZodiacsStr = latestZodiacs ? latestZodiacs.map(z => z.split('(')[0].trim()).join(' ') : '';
  
  return { total, hit, miss, pending, rate, latest, latestZodiacs: latestZodiacsStr };
}

/**
 * 计算精选特码统计（简化版：只按号码数量筛选）
 * @param {Array} records - 记录数组
 * @param {Object} filter - 筛选条件
 * @returns {Object} 统计结果
 */
export function calculateSpecialStats(records, filter = { numCount: '5' }) {
  let hit = 0, miss = 0, pending = 0;
  let latestIssue = null;
  let latestTime = null;
  let latestNumbers = null;
  
  const { numCount } = filter;
  const numCountNum = parseInt(numCount) || 5;
  
  // 按issue分组，获取最新一期的记录
  const recordsByIssue = {};
  records.forEach(rec => {
    if (!recordsByIssue[rec.issue] || new Date(rec.createdAt) > new Date(recordsByIssue[rec.issue].createdAt)) {
      recordsByIssue[rec.issue] = rec;
    }
  });
  
  // 获取所有issue并排序
  const sortedIssues = Object.keys(recordsByIssue).sort().reverse();
  
  // 在最新一期中查找匹配号码数量的记录
  for (const issue of sortedIssues) {
    const rec = recordsByIssue[issue];
    const recNumCount = String(rec.numCount);
    const numMatch = recNumCount === String(numCount);
    
    if (numMatch) {
      latestIssue = rec.issue;
      latestTime = rec.createdAt;
      latestNumbers = Array.isArray(rec.numbers) ? rec.numbers : [];
      break;
    }
  }
  
  // 如果没有找到匹配，使用任何最新记录
  if (!latestIssue && records.length > 0) {
    const latestRec = records.reduce((latest, rec) => 
      !latest || new Date(rec.createdAt) > new Date(latest.createdAt) ? rec : latest
    , null);
    if (latestRec) {
      latestIssue = latestRec.issue;
      latestTime = latestRec.createdAt;
      latestNumbers = Array.isArray(latestRec.numbers) ? latestRec.numbers : [];
    }
  }
  
  // 统计（统计所有号码数量匹配的记录）
  records.forEach(rec => {
    const recNumCount = String(rec.numCount);
    if (recNumCount === String(numCount)) {
      if (rec.checked) {
        rec.matched === true ? hit++ : miss++;
      } else {
        pending++;
      }
    }
  });
  
  const matchedCount = records.filter(rec => String(rec.numCount) === String(numCount)).length;
  const total = matchedCount;
  const rate = (hit + miss) > 0 ? ((hit / (hit + miss)) * 100).toFixed(1) : '0.0';
  
  let latest = '暂无数据';
  if (latestIssue) {
    const dateStr = latestTime ? new Date(latestTime).toLocaleString('zh-CN', { 
      month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' 
    }) : '';
    latest = `第${latestIssue}期 ${dateStr}`;
  }
  
  const latestNumbersStr = latestNumbers ? latestNumbers.slice(0, numCountNum).map(n => {
    if (typeof n === 'object' && n !== null) {
      return n.number || n.num || '';
    }
    return n;
  }).join(' ') : '';
  
  return { total, hit, miss, pending, rate, latest, latestNumbers: latestNumbersStr };
}

/**
 * 计算特码热门统计
 * @param {Array} records - 记录数组
 * @returns {Object} 统计结果
 */
export function calculateHotNumbersStats(records) {
  let hit = 0, miss = 0, pending = 0;
  let latestIssue = null;
  let latestTime = null;
  let latestNumbers = null;
  
  records.forEach(rec => {
    if (rec.checked) {
      rec.matched === true ? hit++ : miss++;
    } else {
      pending++;
    }
    
    if (!latestIssue && rec.issue) {
      latestIssue = rec.issue;
      latestTime = rec.createdAt;
      latestNumbers = Array.isArray(rec.numbers) ? rec.numbers : [];
    }
  });
  
  const total = records.length;
  const rate = (hit + miss) > 0 ? ((hit / (hit + miss)) * 100).toFixed(1) : '0.0';
  
  let latest = '暂无数据';
  if (latestIssue) {
    const dateStr = latestTime ? new Date(latestTime).toLocaleString('zh-CN', RECORD_CONSTANTS.DATE_FORMAT) : '';
    latest = `第${latestIssue}期 ${dateStr}`;
  }
  
  const latestNumbersStr = latestNumbers ? latestNumbers.map(n => {
    if (typeof n === 'object' && n !== null) {
      return n.number || n.num || '';
    }
    return n;
  }).join(' ') : '';
  
  return { total, hit, miss, pending, rate, latest, latestNumbers: latestNumbersStr };
}

/**
 * 计算ML预测统计
 * @param {Array} records - 记录数组
 * @returns {Object} 统计结果
 */
export function calculateMLPredictionStats(records) {
  let hit = 0, miss = 0, pending = 0;
  let latestIssue = null;
  let latestTime = null;
  let latestPredictions = null;
  let latestIsTrained = false;
  
  records.forEach(rec => {
    if (rec.checked) {
      rec.matched === true ? hit++ : miss++;
    } else {
      pending++;
    }
    
    if (!latestIssue && rec.issue) {
      latestIssue = rec.issue;
      latestTime = rec.createdAt;
      latestPredictions = Array.isArray(rec.predictions) ? rec.predictions : [];
      latestIsTrained = rec.isTrained || false;
    }
  });
  
  const total = records.length;
  const rate = (hit + miss) > 0 ? ((hit / (hit + miss)) * 100).toFixed(1) : '0.0';
  
  let latest = '暂无数据';
  if (latestIssue) {
    const dateStr = latestTime ? new Date(latestTime).toLocaleString('zh-CN', RECORD_CONSTANTS.DATE_FORMAT) : '';
    latest = `第${latestIssue}期 ${dateStr}`;
  }
  
  const latestPredictionsStr = latestPredictions ? latestPredictions.map(z => z.split('(')[0].trim()).join(' ') : '';
  const latestWithType = latestIsTrained ? `🤖 ${latestPredictionsStr}` : `📊 ${latestPredictionsStr}`;
  
  return { total, hit, miss, pending, rate, latest, latestZodiacs: latestWithType };
}

/**
 * 更新汇总卡片
 * @param {string} prefix - 前缀
 * @param {Object} stats - 统计数据
 */
export function updateSummaryCard(prefix, stats) {
  const totalEl = document.getElementById(`${prefix}Total`);
  const hitEl = document.getElementById(`${prefix}Hit`);
  const missEl = document.getElementById(`${prefix}Miss`);
  const pendingEl = document.getElementById(`${prefix}Pending`);
  const rateEl = document.getElementById(`${prefix}Rate`);
  const latestEl = document.getElementById(`${prefix}LatestContent`);
  const latestZodiacsEl = document.getElementById(`${prefix}LatestZodiacs`);
  
  if (totalEl) totalEl.textContent = stats.total;
  if (hitEl) hitEl.textContent = stats.hit;
  if (missEl) missEl.textContent = stats.miss;
  if (pendingEl) pendingEl.textContent = stats.pending;
  if (rateEl) rateEl.textContent = stats.rate + '%';
  if (latestEl) latestEl.textContent = stats.latest;
  if (latestZodiacsEl) {
    if (stats.latestNumbers) {
      const numbersArr = stats.latestNumbers.split(' ').filter(n => n.trim());
      latestZodiacsEl.innerHTML = numbersArr.map(n => `<span class="history-tag">${n}</span>`).join('');
    } else if (stats.latestZodiacs) {
      const zodiacsStr = stats.latestZodiacs;
      const hasEmoji = zodiacsStr.match(/^[🤖📊]\s/);
      if (hasEmoji) {
        const emoji = hasEmoji[0];
        const zodiacsPart = zodiacsStr.substring(emoji.length);
        const zodiacsArr = zodiacsPart.split(' ').filter(z => z.trim());
        latestZodiacsEl.innerHTML = emoji + zodiacsArr.map(z => `<span class="zodiac-tag">${z}</span>`).join(' ');
      } else {
        const zodiacsArr = zodiacsStr.split(' ').filter(z => z.trim());
        latestZodiacsEl.innerHTML = zodiacsArr.map(z => `<span class="zodiac-tag">${z}</span>`).join(' ');
      }
    } else {
      latestZodiacsEl.innerHTML = '';
    }
  }
}

/**
 * 获取分类统计
 * @param {string} type - 类型 ('selected' | 'zodiac')
 * @returns {Object} 统计结果
 */
export function getCategoryStats(type) {
  const allRecords = Storage.get('zodiacRecords', []);
  let records = type === 'selected' 
    ? allRecords.filter(r => r.recordType === 'selected')
    : allRecords.filter(r => !r.recordType || r.recordType !== 'selected');
  let hit = 0, miss = 0, pending = 0;
  records.forEach(rec => {
    if (rec.checked === true) rec.matched === true ? hit++ : miss++;
    else pending++;
  });
  const hitRate = (hit + miss) > 0 ? ((hit / (hit + miss)) * 100).toFixed(1) : '0.0';
  return { hit, miss, pending, hitRate, total: records.length };
}

export default {
  calculateStats,
  calculateSpecialStats,
  calculateHotNumbersStats,
  calculateMLPredictionStats,
  updateSummaryCard,
  getCategoryStats
};
