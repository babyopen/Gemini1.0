// ====================== 下拉刷新和滑动删除模块 ======================

import { RECORD_CONSTANTS } from './record-constants.js';
import { Toast } from '../../toast.js';

/**
 * 初始化下拉刷新功能
 * @param {HTMLElement} container - 容器元素
 * @param {Function} onRefresh - 刷新回调
 */
export function initPullRefresh(container, onRefresh) {
  const indicator = document.getElementById('recordPullRefreshIndicator');
  const refreshText = document.getElementById('recordPullRefreshText');
  
  if (!container || !indicator) return;
  
  let startY = 0;
  let isPulling = false;
  let isRefreshing = false;
  
  const handleTouchStart = (e) => {
    if (container.scrollTop <= 0) {
      startY = e.touches[0].pageY;
      isPulling = true;
    }
  };
  
  const handleTouchMove = (e) => {
    if (!isPulling || isRefreshing) return;
    
    const currentY = e.touches[0].pageY;
    const pullDistance = currentY - startY;
    
    if (pullDistance > 0) {
      e.preventDefault();
      const distance = Math.min(pullDistance, RECORD_CONSTANTS.PULL_MAX_DISTANCE);
      indicator.style.transform = `translateY(${distance - 50}px)`;
      indicator.style.opacity = distance / RECORD_CONSTANTS.PULL_MAX_DISTANCE;
      
      if (refreshText) {
        refreshText.textContent = distance > RECORD_CONSTANTS.PULL_THRESHOLD ? '释放刷新' : '下拉刷新';
      }
    }
  };
  
  const handleTouchEnd = () => {
    if (!isPulling || isRefreshing) return;
    
    const transform = indicator.style.transform;
    const match = transform.match(/translateY\(([\d.]+)px\)/);
    const distance = match ? parseFloat(match[1]) : 0;
    
    if (distance > 10) {
      isRefreshing = true;
      indicator.style.transform = 'translateY(50px)';
      indicator.style.opacity = '1';
      if (refreshText) refreshText.textContent = '刷新中...';
      
      const icon = indicator.querySelector('.pull-refresh-icon');
      if (icon) icon.classList.add('rotating');
      
      Promise.resolve(onRefresh()).then(() => {
        setTimeout(() => {
          indicator.style.transform = 'translateY(-50px)';
          indicator.style.opacity = '0';
          if (refreshText) refreshText.textContent = '刷新成功';
          if (icon) icon.classList.remove('rotating');
          isRefreshing = false;
          isPulling = false;
        }, 500);
      }).catch(error => {
        console.error('[PullRefresh] 刷新失败:', error);
        Toast.show('刷新失败，请重试');
        setTimeout(() => {
          indicator.style.transform = 'translateY(-50px)';
          indicator.style.opacity = '0';
          if (refreshText) refreshText.textContent = '下拉刷新';
          if (icon) icon.classList.remove('rotating');
          isRefreshing = false;
          isPulling = false;
        }, 500);
      });
    } else {
      indicator.style.transform = 'translateY(-50px)';
      indicator.style.opacity = '0';
      isPulling = false;
    }
  };
  
  container.addEventListener('touchstart', handleTouchStart, { passive: true });
  container.addEventListener('touchmove', handleTouchMove, { passive: false });
  container.addEventListener('touchend', handleTouchEnd, { passive: true });
}

/**
 * 滑动删除处理器管理
 */
export const SwipeDeleteManager = {
  _swipeHandlers: new WeakMap(),
  
  /**
   * 绑定滑动删除事件
   * @param {HTMLElement} item - 要绑定的元素
   * @param {number} idx - 索引
   * @param {string} type - 类型
   * @param {Function} deleteCallback - 删除回调
   */
  bind: (item, idx, type, deleteCallback) => {
    if (!item || typeof deleteCallback !== 'function') return;
    
    if (SwipeDeleteManager._swipeHandlers.has(item)) {
      SwipeDeleteManager.unbind(item);
    }
    
    const handler = Utils.SwipeDeleteHandler;
    
    const touchStartHandler = (e) => {
      if (!item.contains(e.target) && e.target !== item) return;
      handler.handleTouchStart(e, idx, type);
    };
    const touchMoveHandler = (e) => {
      if (!item.contains(e.target) && e.target !== item) return;
      handler.handleTouchMove(e, idx, type);
    };
    const touchEndHandler = (e) => {
      if (!item.contains(e.target) && e.target !== item) return;
      handler.handleTouchEnd(e, idx, type, deleteCallback);
    };
    
    item.addEventListener('touchstart', touchStartHandler, { passive: false });
    item.addEventListener('touchmove', touchMoveHandler, { passive: false });
    item.addEventListener('touchend', touchEndHandler, { passive: false });
    
    SwipeDeleteManager._swipeHandlers.set(item, { touchStartHandler, touchMoveHandler, touchEndHandler });
  },
  
  /**
   * 解绑滑动删除事件
   * @param {HTMLElement} item - 要解绑的元素
   */
  unbind: (item) => {
    if (!item) return;
    const handlers = SwipeDeleteManager._swipeHandlers.get(item);
    if (handlers) {
      item.removeEventListener('touchstart', handlers.touchStartHandler);
      item.removeEventListener('touchmove', handlers.touchMoveHandler);
      item.removeEventListener('touchend', handlers.touchEndHandler);
      SwipeDeleteManager._swipeHandlers.delete(item);
    }
  },
  
  /**
   * 清理容器中所有元素的滑动事件
   * @param {HTMLElement} container - 容器元素
   */
  cleanupContainer: (container) => {
    if (!container) return;
    const items = container.querySelectorAll('.history-item');
    items.forEach(item => {
      if (SwipeDeleteManager._swipeHandlers.has(item)) {
        SwipeDeleteManager.unbind(item);
      }
    });
  }
};

/**
 * 折叠/展开切换
 * @param {string} type - 类型
 * @param {string} listId - 列表容器ID
 * @param {string} toggleId - 切换按钮ID
 */
export function toggleCollapse(type, listId, toggleId) {
  const list = document.getElementById(listId);
  const toggle = document.getElementById(toggleId);
  
  if (!list || !toggle) return;
  
  const isCollapsed = toggle.classList.contains('collapsed');
  
  if (isCollapsed) {
    // 展开
    list.style.display = 'block';
    toggle.classList.remove('collapsed');
    toggle.textContent = '收起';
  } else {
    // 折叠
    list.style.display = 'none';
    toggle.classList.add('collapsed');
    toggle.textContent = '展开';
  }
}

export default {
  initPullRefresh,
  SwipeDeleteManager,
  toggleCollapse
};
