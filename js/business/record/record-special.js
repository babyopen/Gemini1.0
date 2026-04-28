// ====================== 精选特码历史模块 ======================

import { Storage } from '../../storage.js';
import { Utils } from '../../utils.js';
import { Toast } from '../../toast.js';
import { RECORD_CONSTANTS } from './record-constants.js';

/**
 * 渲染精选特码历史
 * @param {HTMLElement} container - 容器元素
 * @param {Object} filter - 筛选状态
 */
export function renderSpecialHistory(container, filter = {}) {
  if (!container) return;
  
  container.innerHTML = '<div class="loading-tip">加载中...</div>';
  
  try {
    const specialRecords = Storage.get(Storage.KEYS.NUMBER_RECORDS, []);
    
    if (!specialRecords.length) { 
      container.innerHTML = '<div class="empty-tip">暂无精选特码历史</div>'; 
      return;
    }
    
    const historyMode = filter.mode || 'all';
    const selectedNumCount = filter.numCount || '5';
    
    let filteredRecords = specialRecords;
    if (historyMode !== 'all') {
      filteredRecords = specialRecords.filter(rec => {
        if (historyMode === 'hot') {
          return rec.mode === 'hot' || rec.type === 'auto-hot';
        } else if (historyMode === 'cold') {
          return rec.mode === 'cold' || rec.type === 'auto-cold';
        }
        return true;
      });
    }
    
    filteredRecords = filteredRecords.filter(rec => {
      const recordNumCount = String(rec.numCount);
      return recordNumCount === selectedNumCount;
    });
    
    const fragment = document.createDocumentFragment();
    filteredRecords.forEach((rec, idx) => {
      try {
        const dateStr = rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN', RECORD_CONSTANTS.DATE_FORMAT) : '';
        
        let displayNumbers = [];
        let modeLabel = '';
        
        if (historyMode === 'hot' && rec.hotNumbers && rec.hotNumbers.length > 0) {
          displayNumbers = rec.hotNumbers;
          modeLabel = '<span style="font-size:11px;color:#ff6b6b;margin-left:8px;">🔥 热号</span>';
        } else if (historyMode === 'cold' && rec.coldNumbers && rec.coldNumbers.length > 0) {
          displayNumbers = rec.coldNumbers;
          modeLabel = '<span style="font-size:11px;color:#4dabf7;margin-left:8px;">❄️ 冷号</span>';
        } else {
          displayNumbers = Array.isArray(rec.numbers) ? rec.numbers : [];
          if (rec.mode === 'hot') modeLabel = '<span style="font-size:11px;color:#ff6b6b;margin-left:8px;">🔥</span>';
          else if (rec.mode === 'cold') modeLabel = '<span style="font-size:11px;color:#4dabf7;margin-left:8px;">❄️</span>';
          else if (rec.mode === 'auto') modeLabel = '<span style="font-size:11px;color:#9c36b5;margin-left:8px;">🤖</span>';
        }
        
        let metaInfo = '';
        if (rec.numCount) {
          const countText = `${rec.numCount}个`;
          metaInfo = `<div class="history-meta" style="font-size:11px;color:#999;margin-top:4px;display:flex;gap:8px;align-items:center;">
            <span>🎯 ${countText}</span>
          </div>`;
        }
        
        const numCountToShow = parseInt(rec.numCount) || 5;
        const displayNumbersLimited = displayNumbers.slice(0, numCountToShow);
        
        let predictedTagsHtml = '';
        if (rec.checked && rec.actualNumbers && Array.isArray(rec.actualNumbers) && rec.actualNumbers.length > 0) {
          const specialNumber = rec.actualNumbers[rec.actualNumbers.length - 1];
          predictedTagsHtml = displayNumbersLimited.map(n => {
            const tagClass = (rec.matched && n === specialNumber) ? 'history-tag history-tag-matched' : 'history-tag';
            return `<div class="${tagClass}">${Utils.escapeHtml(n)}</div>`;
          }).join('');
        } else {
          predictedTagsHtml = displayNumbersLimited.map(n => `<div class="history-tag">${Utils.escapeHtml(n)}</div>`).join('');
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
            <div class="history-nums">第${rec.issue || ''}期 精选特码${modeLabel}</div>
            <div class="history-time">${dateStr}</div>
          </div>
          <div class="history-tags">
            <div class="history-tags-predicted">${predictedTagsHtml}</div>
            ${actualTagHtml ? `<div class="history-tags-actual">${actualTagHtml}</div>` : ''}
          </div>
          ${metaInfo}
        `;
        fragment.appendChild(item);
      } catch (error) {
        console.error('渲染精选特码历史项失败:', error);
      }
    });
    
    container.innerHTML = '';
    container.appendChild(fragment);
    
    if (filteredRecords.length === 0) {
      container.innerHTML = `<div class="empty-tip">暂无${historyMode === 'hot' ? '热号' : '冷号'}模式的历史记录</div>`;
    }
  } catch (error) {
    console.error('加载精选特码历史失败:', error);
    container.innerHTML = '<div class="error-tip">加载失败，请点击刷新重试</div>';
  }
}

/**
 * 清空精选特码历史
 */
export function clearSpecialHistory() {
  if (confirm('确定清空所有精选特码历史吗？')) {
    Storage.set(Storage.KEYS.NUMBER_RECORDS, []);
    Toast.show('已清空精选特码历史');
  }
}

/**
 * 渲染精选特码历史详情
 * @param {HTMLElement} container - 容器元素
 * @param {HTMLElement} toggle - 展开/收起按钮
 */
export function renderSpecialDetailHistory(container, toggle) {
  if (!container) return;

  container.innerHTML = '<div class="loading-tip">加载中...</div>';

  try {
    const specialRecords = Storage.get(Storage.KEYS.NUMBER_RECORDS, []);

    if (!specialRecords.length) {
      container.innerHTML = '<div class="empty-tip">暂无精选特码历史</div>';
      if (toggle) toggle.style.display = 'none';
      return;
    }

    const fragment = document.createDocumentFragment();
    specialRecords.forEach((rec, idx) => {
      try {
        const dateStr = rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN', {
          month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        }) : '';
        const numbers = Array.isArray(rec.numbers) ? rec.numbers : [];

        const predictedTagsHtml = numbers.map(n => {
          const numStr = typeof n === 'object' ? n.number : n;
          return `<div class="history-tag">${numStr}</div>`;
        }).join('');

        let actualTagHtml = '';
        if (rec.checked && rec.actualNumbers && rec.actualNumbers.length > 0) {
          const actualClass = rec.matched ? 'history-tag history-tag-actual history-tag-matched' : 'history-tag history-tag-actual history-tag-miss';
          actualTagHtml = `<div class="${actualClass}" data-type="actual">${rec.actualNumbers[0]}</div>`;
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
        console.error('渲染精选特码历史详情项失败:', error);
      }
    });

    container.innerHTML = '';
    container.appendChild(fragment);

    if (toggle) toggle.style.display = 'none';
  } catch (error) {
    console.error('加载精选特码历史详情失败:', error);
    container.innerHTML = '<div class="error-tip">加载失败</div>';
  }
}

export default {
  renderSpecialHistory,
  clearSpecialHistory,
  renderSpecialDetailHistory
};
