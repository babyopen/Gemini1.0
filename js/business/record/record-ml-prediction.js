// ====================== ML预测历史模块 ======================

import { Storage } from '../../storage.js';
import { Utils } from '../../utils.js';
import { Toast } from '../../toast.js';
import { RECORD_CONSTANTS } from './record-constants.js';

/**
 * 渲染ML预测历史
 * @param {HTMLElement} container - 容器元素
 * @param {boolean} loadMore - 是否加载更多
 * @param {Object} pagination - 分页状态
 */
export function renderMLPredictionHistory(container, loadMore = false, pagination = {}) {
  if (!container) return;
  
  if (!loadMore) {
    pagination.page = 1;
    container.innerHTML = '<div class="loading-tip">加载中...</div>';
  }
  
  try {
    const mlRecords = Storage.get('mlPredictionRecords', []);
    
    if (!mlRecords.length) { 
      if (!loadMore) container.innerHTML = '<div class="empty-tip">暂无ML预测历史</div>'; 
      const toggle = document.getElementById('mlPredictionHistoryToggle');
      if (toggle) toggle.style.display = 'none';
      return;
    }
    
    // 去重处理
    const seenIssues = new Set();
    const uniqueRecords = [];
    mlRecords.forEach(rec => {
      const issueKey = String(rec.issue);
      if (seenIssues.has(issueKey)) return;
      seenIssues.add(issueKey);
      uniqueRecords.push(rec);
    });
    
    const pageSize = RECORD_CONSTANTS.PAGE_SIZE;
    const page = pagination.page || 1;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedRecords = uniqueRecords.slice(startIndex, endIndex);
    
    const fragment = document.createDocumentFragment();
    paginatedRecords.forEach((rec, idx) => {
      try {
        const dateStr = rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN', RECORD_CONSTANTS.DATE_FORMAT) : '';
        const zodiacs = Array.isArray(rec.predictions) ? rec.predictions : [];
        const modelVersion = rec.modelVersion || '1.0';
        const inputFeatures = rec.inputFeatures || '历史开奖数据';
        
        const predictedTagsHtml = zodiacs.map(z => {
          const zodiacName = z.split('(')[0].trim();
          const isMatched = rec.checked && rec.matched && rec.actualZodiac === zodiacName;
          const className = isMatched ? 'history-tag history-tag-matched' : 'history-tag';
          return `<div class="${className}">${Utils.escapeHtml(zodiacName)}</div>`;
        }).join('');
        
        let actualTagHtml = '';
        if (rec.checked && rec.actualZodiac) {
          const actualClass = rec.matched ? 'history-tag history-tag-actual history-tag-matched' : 'history-tag history-tag-actual history-tag-miss';
          actualTagHtml = `<div class="${actualClass}">${Utils.escapeHtml(rec.actualZodiac)}</div>`;
        }
        
        const item = document.createElement('div');
        item.className = 'history-item';
        item.dataset.index = idx;
        item.innerHTML = `
          <div class="history-header">
            <div class="history-nums">第${rec.issue || ''}期 ML预测</div>
            <div class="history-time">${dateStr}</div>
          </div>
          <div class="history-tags">
            <div class="history-tags-predicted">${predictedTagsHtml}</div>
            ${actualTagHtml ? `<div class="history-tags-actual">${actualTagHtml}</div>` : ''}
          </div>
          <div class="history-meta" style="font-size: 12px; color: #999; margin-top: 5px;">模型版本: ${Utils.escapeHtml(modelVersion)} | 特征: ${Utils.escapeHtml(inputFeatures)}</div>
        `;
        fragment.appendChild(item);
      } catch (error) {
        console.error('渲染ML预测历史项失败:', error);
      }
    });
    
    if (loadMore) {
      container.appendChild(fragment);
    } else {
      container.innerHTML = '';
      container.appendChild(fragment);
    }
    
    pagination.page++;
    
    const toggle = document.getElementById('mlPredictionHistoryToggle');
    if (toggle) toggle.style.display = endIndex < uniqueRecords.length ? 'block' : 'none';
  } catch (error) {
    console.error('加载ML预测历史失败:', error);
    if (!loadMore) container.innerHTML = '<div class="error-tip">加载失败，请点击刷新重试</div>';
    const toggle = document.getElementById('mlPredictionHistoryToggle');
    if (toggle) toggle.style.display = 'none';
  }
}

/**
 * 刷新ML预测历史
 */
export function refreshMLPredictionHistory() { 
  Toast.show('ML预测历史已刷新'); 
}

/**
 * 清空ML预测历史
 */
export function clearMLPredictionHistory() {
  if (confirm('确定清空所有ML预测历史吗？')) {
    Storage.set('mlPredictionRecords', []);
    Toast.show('已清空ML预测历史');
  }
}

/**
 * 渲染ML预测历史详情
 * @param {HTMLElement} container - 容器元素
 * @param {HTMLElement} toggle - 展开/收起按钮
 */
export function renderMLPredictionDetailHistory(container, toggle) {
  if (!container) return;

  container.innerHTML = '<div class="loading-tip">加载中...</div>';

  try {
    const mlRecords = Storage.get('mlPredictionRecords', []);

    if (!mlRecords.length) {
      container.innerHTML = '<div class="empty-tip">暂无ML预测历史</div>';
      if (toggle) toggle.style.display = 'none';
      return;
    }

    const fragment = document.createDocumentFragment();
    mlRecords.forEach((rec, idx) => {
      try {
        const dateStr = rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN', {
          month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        }) : '';
        const predictions = Array.isArray(rec.predictions) ? rec.predictions : [];

        const predictedTagsHtml = predictions.map(z => {
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

        const typeLabel = rec.isTrained ? '<span style="color:#10b981;">🤖 已训练</span>' : '<span style="color:#f59e0b;">📊 未训练</span>';

        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
          <div class="history-header">
            <div class="history-nums">第${rec.issue || ''}期 ML预测 ${typeLabel}</div>
            <div class="history-time">${dateStr}</div>
          </div>
          <div class="history-tags">
            <div class="history-tags-predicted">${predictedTagsHtml}</div>
            ${actualTagHtml ? `<div class="history-tags-actual">${actualTagHtml}</div>` : ''}
          </div>
          ${rec.modelVersion ? `<div class="history-meta" style="font-size: 12px; color: #999; margin-top: 5px;">模型版本: ${rec.modelVersion} | 特征: ${rec.inputFeatures || '历史开奖数据'}</div>` : ''}
        `;
        fragment.appendChild(item);
      } catch (error) {
        console.error('渲染ML预测历史详情项失败:', error);
      }
    });

    container.innerHTML = '';
    container.appendChild(fragment);

    if (toggle) toggle.style.display = 'none';
  } catch (error) {
    console.error('加载ML预测历史详情失败:', error);
    container.innerHTML = '<div class="error-tip">加载失败</div>';
  }
}

export default {
  renderMLPredictionHistory,
  refreshMLPredictionHistory,
  clearMLPredictionHistory,
  renderMLPredictionDetailHistory
};
