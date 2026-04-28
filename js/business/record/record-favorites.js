// ====================== 收藏方案管理模块 ======================

import { Storage } from '../../storage.js';
import { StateManager } from '../../state-manager.js';
import { Filter } from '../../filter.js';
import { DataQuery } from '../../data-query.js';
import { Utils } from '../../utils.js';
import { Toast } from '../../toast.js';
import { RECORD_CONSTANTS } from './record-constants.js';

/**
 * 渲染收藏列表
 * @param {HTMLElement} container - 容器元素
 */
export function renderFavoriteList(container) {
  if (!container) return;
  
  container.innerHTML = '<div class="loading-tip">加载中...</div>';
  
  try {
    const favorites = Storage.get('favorites', []);
    
    if (!favorites.length) {
      container.innerHTML = '<div class="empty-tip">暂无收藏方案</div>';
      return;
    }
    
    const fragment = document.createDocumentFragment();
    favorites.forEach((item, idx) => {
      try {
        let previewList;
        if (item.numbers && Array.isArray(item.numbers)) {
          previewList = item.numbers.map(num => DataQuery.getNumAttrs(num));
        } else {
          previewList = Filter.getFilteredList(item.selected, item.excluded);
        }
        
        const card = document.createElement('div');
        card.className = 'filter-item';
        
        const previewFragment = document.createDocumentFragment();
        previewList.forEach(num => {
          const wrapper = document.createElement('div');
          wrapper.className = 'num-item';
          wrapper.innerHTML = `<div class="num-ball ${num.color}色">${num.s}</div><div class="tag-zodiac">${num.zodiac}</div>`;
          previewFragment.appendChild(wrapper);
        });
        
        card.innerHTML = `
          <div class="filter-row">
            <div class="filter-item-name">${Utils.escapeHtml(item.name)}</div>
            <div class="filter-preview" style="flex: 1; min-width: 0;"></div>
          </div>
          <div class="filter-item-btns">
            <button class="filter-item-btn" data-action="loadFavorite" data-index="${idx}">加载</button>
            <button class="filter-item-btn" data-action="renameFavorite" data-index="${idx}">重命名</button>
            <button class="filter-item-btn" data-action="copyFavorite" data-index="${idx}">复制</button>
          </div>
        `;
        
        const previewContainer = card.querySelector('.filter-preview');
        previewContainer.appendChild(previewFragment);
        fragment.appendChild(card);
      } catch (error) {
        console.error('渲染收藏项失败:', error);
      }
    });
    
    container.innerHTML = '';
    container.appendChild(fragment);
  } catch (error) {
    console.error('加载收藏列表失败:', error);
    container.innerHTML = '<div class="error-tip">加载失败，请点击刷新重试</div>';
  }
}

/**
 * 清空所有收藏
 */
export function clearAllFavorites() {
  if (confirm('确定清空所有收藏吗？')) {
    Storage.set('favorites', []);
    StateManager.setState({ system: { ...StateManager._state.system, favorites: [] } }, false);
    window.dispatchEvent(new StorageEvent('storage', { key: 'favorites' }));
    Toast.show('已清空所有收藏');
  }
}

/**
 * 移除单个收藏
 * @param {number} index - 索引
 */
export function removeFavorite(index) {
  const favorites = Storage.get('favorites', []);
  if (favorites[index]) {
    favorites.splice(index, 1);
    Storage.set('favorites', favorites);
    StateManager.setState({ system: { ...StateManager._state.system, favorites: favorites } }, false);
    window.dispatchEvent(new StorageEvent('storage', { key: 'favorites' }));
    Toast.show('已移除收藏');
  }
}

/**
 * 加载收藏方案
 * @param {number} index - 索引
 */
export function loadFavorite(index) {
  const favorites = Storage.get('favorites', []);
  const item = favorites[index];
  if (!item) return;
  StateManager.setState({ filter: { ...StateManager._state.filter, selected: item.selected, excluded: item.excluded } });
  Toast.show(`已加载方案：${item.name}`);
  document.querySelector('.bottom-nav-item[data-index="0"]')?.click();
}

/**
 * 重命名收藏方案
 * @param {number} index - 索引
 */
export function renameFavorite(index) {
  const favorites = Storage.get('favorites', []);
  const item = favorites[index];
  if (!item) return;
  let newName = prompt('请输入新名称', item.name);
  if (newName?.trim()) {
    item.name = newName.trim();
    Storage.set('favorites', favorites);
    StateManager.setState({ system: { ...StateManager._state.system, favorites: favorites } }, false);
    window.dispatchEvent(new StorageEvent('storage', { key: 'favorites' }));
    Toast.show('重命名成功');
  }
}

/**
 * 复制收藏方案号码
 * @param {number} index - 索引
 */
export function copyFavorite(index) {
  const favorites = Storage.get('favorites', []);
  const item = favorites[index];
  if (!item) return;
  const filtered = Filter.getFilteredList(item.selected, item.excluded);
  const numStr = filtered.map(n => n.s).join(' ');
  if (navigator.clipboard) navigator.clipboard.writeText(numStr).then(() => Toast.show('复制成功'));
  else alert('请手动复制：' + numStr);
}

export default {
  renderFavoriteList,
  clearAllFavorites,
  removeFavorite,
  loadFavorite,
  renameFavorite,
  copyFavorite
};
