// ====================== 精选生肖历史模块 ======================

import { Storage } from '../../storage.js';
import { StateManager } from '../../state-manager.js';
import { Utils } from '../../utils.js';
import { Toast } from '../../toast.js';
import { RECORD_CONSTANTS } from './record-constants.js';

/**
 * 渲染精选生肖历史
 * @param {HTMLElement} container - 容器元素
 */
export function renderSelectedZodiacHistory(container) {
  if (!container) return;
  
  container.innerHTML = '<div class="loading-tip">加载中...</div>';
  
  try {
    const allRecords = Storage.get('zodiacRecords', []);
    const records = allRecords.filter(r => r.recordType === 'selected');
    
    if (!records.length) { 
      container.innerHTML = '<div class="empty-tip">暂无精选生肖历史</div>'; 
      return;
    }
    
    const fragment = document.createDocumentFragment();
    records.forEach((rec, idx) => {
      try {
        const dateStr = rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN', RECORD_CONSTANTS.DATE_FORMAT) : '';
        const zodiacs = Array.isArray(rec.zodiacs) ? rec.zodiacs : [];
        
        const predictedTagsHtml = zodiacs.map(z => {
          const zodiacName = z.split('(')[0].trim();
          const isMatched = rec.checked && rec.matched && rec.actualZodiac === zodiacName;
          const className = isMatched ? 'history-tag history-tag-matched' : 'history-tag';
          return `<div class="${className}">${Utils.escapeHtml(zodiacName)}</div>`;
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
        console.error('渲染精选生肖历史项失败:', error);
      }
    });
    
    container.innerHTML = '';
    container.appendChild(fragment);
  } catch (error) {
    console.error('加载精选生肖历史失败:', error);
    container.innerHTML = '<div class="error-tip">加载失败，请点击刷新重试</div>';
  }
}

/**
 * 清空精选生肖历史
 */
export function clearSelectedZodiacHistory() {
  if (confirm('确定清空所有精选生肖记录吗？')) {
    const allRecords = Storage.get('zodiacRecords', []);
    const filtered = allRecords.filter(r => r.recordType !== 'selected');
    Storage.set('zodiacRecords', filtered);
    Toast.show('已清空精选生肖记录');
  }
}

/**
 * 渲染精选生肖历史详情
 * @param {HTMLElement} container - 容器元素
 * @param {HTMLElement} toggle - 展开/收起按钮
 */
export function renderSelectedZodiacDetailHistory(container, toggle) {
  if (!container) return;

  container.innerHTML = '<div class="loading-tip">加载中...</div>';

  try {
    const allRecords = Storage.get('zodiacRecords', []);
    const records = allRecords.filter(r => r.recordType === 'selected');

    if (!records.length) {
      container.innerHTML = '<div class="empty-tip">暂无精选生肖历史</div>';
      if (toggle) toggle.style.display = 'none';
      return;
    }

    const fragment = document.createDocumentFragment();
    records.forEach((rec, idx) => {
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
        console.error('渲染精选生肖历史详情项失败:', error);
      }
    });

    container.innerHTML = '';
    container.appendChild(fragment);

    if (toggle) {
      toggle.style.display = 'none';
    }
  } catch (error) {
    console.error('加载精选生肖历史详情失败:', error);
    container.innerHTML = '<div class="error-tip">加载失败</div>';
  }
}

export default {
  renderSelectedZodiacHistory,
  clearSelectedZodiacHistory,
  renderSelectedZodiacDetailHistory
};
