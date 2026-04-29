// ====================== 特码热门TOP5历史模块 ======================

import { Storage } from '../../storage.js';
import { Utils } from '../../utils.js';
import { Toast } from '../../toast.js';
import { RECORD_CONSTANTS } from './record-constants.js';

/**
 * 渲染特码热门TOP5历史
 * @param {HTMLElement} container - 容器元素
 */
export function renderHotNumbersHistory(container) {
  if (!container) return;
  
  container.innerHTML = '<div class="loading-tip">加载中...</div>';
  
  try {
    const hotRecords = Storage.get('hotNumbersRecords', []);
    
    if (!hotRecords.length) { 
      container.innerHTML = '<div class="empty-tip">暂无特码热门TOP5历史</div>'; 
      return;
    }
    
    const fragment = document.createDocumentFragment();
    hotRecords.forEach((rec, idx) => {
      try {
        const dateStr = rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN', RECORD_CONSTANTS.DATE_FORMAT) : '';
        const numbers = Array.isArray(rec.numbers) ? rec.numbers : [];
        
        let predictedTagsHtml = '';
        if (rec.checked && rec.actualNumbers && Array.isArray(rec.actualNumbers) && rec.actualNumbers.length > 0) {
          predictedTagsHtml = numbers.map(n => {
            const isMatched = rec.matchedNumbers && rec.matchedNumbers.includes(n);
            const tagClass = isMatched ? 'history-tag history-tag-matched' : 'history-tag';
            return `<div class="${tagClass}">${Utils.escapeHtml(n)}</div>`;
          }).join('');
        } else {
          predictedTagsHtml = numbers.map(n => `<div class="history-tag">${Utils.escapeHtml(n)}</div>`).join('');
        }
        
        let actualTagHtml = '';
        if (rec.checked && rec.actualNumbers && Array.isArray(rec.actualNumbers) && rec.actualNumbers.length > 0) {
          const specialNumber = rec.actualNumbers[rec.actualNumbers.length - 1];
          const actualClass = rec.matched ? 'history-tag history-tag-matched' : 'history-tag history-tag-miss';
          actualTagHtml = `<div class="${actualClass}">${Utils.escapeHtml(specialNumber)}</div>`;
        }
        
        const item = document.createElement('div');
        item.className = 'history-item';
        item.dataset.index = idx;
        item.innerHTML = `
          <div class="history-header">
            <div class="history-nums">第${rec.issue || ''}期 热门TOP5</div>
            <div class="history-time">${dateStr}</div>
          </div>
          <div class="history-tags">
            <div class="history-tags-predicted">${predictedTagsHtml}</div>
            ${actualTagHtml ? `<div class="history-tags-actual">${actualTagHtml}</div>` : ''}
          </div>
        `;
        fragment.appendChild(item);
      } catch (error) {
        console.error('渲染特码热门TOP5历史项失败:', error);
      }
    });
    
    container.innerHTML = '';
    container.appendChild(fragment);
  } catch (error) {
    console.error('加载特码热门TOP5历史失败:', error);
    container.innerHTML = '<div class="error-tip">加载失败，请点击刷新重试</div>';
  }
}

/**
 * 清空特码热门TOP5历史
 */
export function clearHotNumbersHistory() {
  if (confirm('确定清空所有特码热门TOP5历史吗？')) {
    Storage.set('hotNumbersRecords', []);
    Toast.show('已清空特码热门TOP5历史');
  }
}

/**
 * 渲染特码热门历史详情
 * @param {HTMLElement} container - 容器元素
 * @param {HTMLElement} toggle - 展开/收起按钮
 */
export function renderHotNumbersDetailHistory(container, toggle) {
  if (!container) return;

  container.innerHTML = '<div class="loading-tip">加载中...</div>';

  try {
    const hotRecords = Storage.get('hotNumbersRecords', []);

    if (!hotRecords.length) {
      container.innerHTML = '<div class="empty-tip">暂无特码热门历史</div>';
      if (toggle) toggle.style.display = 'none';
      return;
    }

    const fragment = document.createDocumentFragment();
    hotRecords.forEach((rec, idx) => {
      try {
        const dateStr = rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN', {
          month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        }) : '';
        const numbers = Array.isArray(rec.numbers) ? rec.numbers : [];

        const predictedTagsHtml = numbers.map(n => {
          const numStr = typeof n === 'object' ? n.number : n;
          const isMatched = rec.matchedNumbers && rec.matchedNumbers.includes(n);
          const tagClass = isMatched ? 'history-tag history-tag-matched' : 'history-tag';
          return `<div class="${tagClass}">${numStr}</div>`;
        }).join('');

        let actualTagHtml = '';
        if (rec.checked && rec.actualNumbers && rec.actualNumbers.length > 0) {
          const actualClass = rec.matched ? 'history-tag history-tag-actual history-tag-matched' : 'history-tag history-tag-actual history-tag-miss';
          const specialNumber = rec.actualNumbers[rec.actualNumbers.length - 1];
          actualTagHtml = `<div class="${actualClass}" data-type="actual">${specialNumber}</div>`;
        }

        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
          <div class="history-header">
            <div class="history-nums">第${rec.issue || ''}期 热门TOP5</div>
            <div class="history-time">${dateStr}</div>
          </div>
          <div class="history-tags">
            <div class="history-tags-predicted">${predictedTagsHtml}</div>
            ${actualTagHtml ? `<div class="history-tags-actual">${actualTagHtml}</div>` : ''}
          </div>
        `;
        fragment.appendChild(item);
      } catch (error) {
        console.error('渲染特码热门历史详情项失败:', error);
      }
    });

    container.innerHTML = '';
    container.appendChild(fragment);

    if (toggle) toggle.style.display = 'none';
  } catch (error) {
    console.error('加载特码热门历史详情失败:', error);
    container.innerHTML = '<div class="error-tip">加载失败</div>';
  }
}

export default {
  renderHotNumbersHistory,
  clearHotNumbersHistory,
  renderHotNumbersDetailHistory
};
