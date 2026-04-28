// ====================== 生肖预测历史模块 ======================

import { Storage } from '../../storage.js';
import { StateManager } from '../../state-manager.js';
import { Utils } from '../../utils.js';
import { Toast } from '../../toast.js';
import { RECORD_CONSTANTS } from './record-constants.js';

/**
 * 渲染生肖预测历史
 * @param {HTMLElement} container - 容器元素
 * @param {boolean} loadMore - 是否加载更多
 * @param {Object} pagination - 分页状态
 * @param {Object} filter - 筛选状态
 */
export function renderZodiacPredictionHistory(container, loadMore = false, pagination = {}, filter = {}) {
  if (!container) return;
  
  if (!loadMore) {
    pagination.page = 1;
    container.innerHTML = '<div class="loading-tip">加载中...</div>';
  }
  
  try {
    const allRecords = Storage.get('zodiacRecords', []);
    let records = allRecords.filter(r => !r.recordType || r.recordType !== 'selected');
    
    // 应用筛选条件
    const selectedPeriods = filter.selectedPeriods || ['10'];
    if (selectedPeriods.length > 0 && selectedPeriods[0] !== 'all') {
      records = records.filter(rec => {
        if (!rec.periodData) return false;
        const displayPeriod = selectedPeriods[0];
        return rec.periodData.hasOwnProperty(displayPeriod) || rec.periodData.hasOwnProperty(Number(displayPeriod));
      });
    }
    
    if (!records.length) { 
      if (!loadMore) container.innerHTML = '<div class="empty-tip">暂无预测历史</div>'; 
      const toggle = document.getElementById('zodiacPredictionHistoryToggle');
      if (toggle) toggle.style.display = 'none';
      return;
    }
    
    const pageSize = RECORD_CONSTANTS.PAGE_SIZE;
    const page = pagination.page || 1;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedRecords = records.slice(startIndex, endIndex);
    
    const fragment = document.createDocumentFragment();
    paginatedRecords.forEach((rec, idx) => {
      try {
        const dateStr = rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN', RECORD_CONSTANTS.DATE_FORMAT) : '';
        
        let periodInfo = '';
        if (rec.periodData) {
          const availablePeriods = Object.keys(rec.periodData);
          const displayPeriod = selectedPeriods.find(p => availablePeriods.includes(p)) || availablePeriods[0];
          periodInfo = `${displayPeriod}期数据`;
        } else {
          periodInfo = '10期数据';
        }
        
        let zodiacs = [];
        const displayPeriod = selectedPeriods[0];
        if (displayPeriod === 'all') {
          if (rec.periodData) {
            const availableKeys = Object.keys(rec.periodData);
            if (availableKeys.length > 0) zodiacs = rec.periodData[availableKeys[0]];
          }
        } else if (rec.periodData) {
          zodiacs = rec.periodData[displayPeriod] || rec.periodData[Number(displayPeriod)] || [];
        }
        if (!zodiacs || zodiacs.length === 0) zodiacs = Array.isArray(rec.zodiacs) ? rec.zodiacs : [];
        zodiacs = zodiacs.slice(0, 6);
        
        const displayIssue = rec.issue || '';
        
        const predictedTagsHtml = zodiacs.map((z, index) => {
          const zodiacName = z.split('(')[0].trim();
          const isMatched = rec.checked && rec.matched && rec.actualZodiac === zodiacName;
          const className = isMatched ? 'history-tag history-tag-matched' : 'history-tag';
          return `<div class="${className}" data-rank="${index + 1}">${Utils.escapeHtml(zodiacName)}</div>`;
        }).join('');
        
        let actualTagHtml = '';
        if (rec.checked && rec.actualZodiac) {
          const actualClass = rec.matched ? 'history-tag history-tag-actual history-tag-matched' : 'history-tag history-tag-actual history-tag-miss';
          actualTagHtml = `<div class="${actualClass}" data-type="actual">${Utils.escapeHtml(rec.actualZodiac)}</div>`;
        }
        
        const item = document.createElement('div');
        item.className = 'history-item';
        item.dataset.index = idx;
        item.innerHTML = `
          <div class="history-header">
            <div class="history-nums">第${Utils.escapeHtml(displayIssue)}期 ${Utils.escapeHtml(periodInfo)}</div>
            <div class="history-time">${dateStr}</div>
          </div>
          <div class="history-tags">
            <div class="history-tags-predicted">${predictedTagsHtml}</div>
            ${actualTagHtml ? `<div class="history-tags-actual">${actualTagHtml}</div>` : ''}
          </div>
        `;
        fragment.appendChild(item);
      } catch (error) {
        console.error('渲染生肖预测历史项失败:', error);
      }
    });
    
    if (loadMore) {
      container.appendChild(fragment);
    } else {
      container.innerHTML = '';
      container.appendChild(fragment);
    }
    
    pagination.page++;
    
    const toggle = document.getElementById('zodiacPredictionHistoryToggle');
    if (toggle) toggle.style.display = endIndex < records.length ? 'block' : 'none';
  } catch (error) {
    console.error('加载生肖预测历史失败:', error);
    if (!loadMore) container.innerHTML = '<div class="error-tip">加载失败，请点击刷新重试</div>';
    const toggle = document.getElementById('zodiacPredictionHistoryToggle');
    if (toggle) toggle.style.display = 'none';
  }
}

/**
 * 清空生肖预测历史
 */
export function clearZodiacPredictionHistory() {
  if (confirm('确定清空所有生肖预测历史吗？')) {
    const allRecords = Storage.get('zodiacRecords', []);
    const filtered = allRecords.filter(r => r.recordType === 'selected');
    Storage.set('zodiacRecords', filtered);
    Toast.show('已清空生肖预测历史');
  }
}

/**
 * 渲染生肖预测历史详情
 * @param {HTMLElement} container - 容器元素
 * @param {HTMLElement} toggle - 展开/收起按钮
 */
export function renderZodiacPredictionDetailHistory(container, toggle) {
  if (!container) return;

  container.innerHTML = '<div class="loading-tip">加载中...</div>';

  try {
    const allRecords = Storage.get('zodiacRecords', []);
    const zodiacRecords = allRecords.filter(r => !r.recordType || r.recordType !== 'selected');

    if (!zodiacRecords.length) {
      container.innerHTML = '<div class="empty-tip">暂无生肖预测历史</div>';
      if (toggle) toggle.style.display = 'none';
      return;
    }

    const fragment = document.createDocumentFragment();
    zodiacRecords.forEach((rec, idx) => {
      try {
        const dateStr = rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN', {
          month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        }) : '';
        const zodiacs = Array.isArray(rec.zodiacs) ? rec.zodiacs : [];

        const predictedTagsHtml = zodiacs.map(z => {
          const zodiacName = z.split('(')[0].trim();
          const isMatched = rec.checked && rec.matched && rec.actualZodiac === zodiacName;
          const className = isMatched ? 'history-tag history-tag-matched' : 'history-tag';
          return `<div class="${className}">${zodiacName}</div>`;
        }).join('');

        let actualTagHtml = '';
        if (rec.checked && rec.actualZodiac) {
          const actualClass = rec.matched ? 'history-tag history-tag-actual history-tag-matched' : 'history-tag history-tag-actual history-tag-miss';
          actualTagHtml = `<div class="${actualClass}" data-type="actual">${rec.actualZodiac}</div>`;
        }

        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
          <div class="history-header">
            <div class="history-nums">第${rec.issue || ''}期</div>
            <div class="history-time">${dateStr}</div>
          </div>
          <div class="history-tags">
            <div class="history-tags-predicted">${predictedTagsHtml}</div>
            ${actualTagHtml ? `<div class="history-tags-actual">${actualTagHtml}</div>` : ''}
          </div>
        `;
        fragment.appendChild(item);
      } catch (error) {
        console.error('渲染生肖预测历史详情项失败:', error);
      }
    });

    container.innerHTML = '';
    container.appendChild(fragment);

    if (toggle) toggle.style.display = 'none';
  } catch (error) {
    console.error('加载生肖预测历史详情失败:', error);
    container.innerHTML = '<div class="error-tip">加载失败</div>';
  }
}

export default {
  renderZodiacPredictionHistory,
  clearZodiacPredictionHistory,
  renderZodiacPredictionDetailHistory
};
