// ====================== 7. 筛选逻辑模块（纯逻辑，与视图无直接关联）======================
/**
 * 筛选逻辑管理器
 * @namespace Filter
 */

// 导入必要的模块
import { CONFIG } from './config.js';
import { Utils } from './utils.js';
import { StateManager } from './state-manager.js';
import { Toast } from './toast.js';

const _filterCache = new Map();
const _cacheTimeout = 5000;
let _lastFilterTime = 0;

export const Filter = {
  /**
   * 获取带缓存的筛选结果
   * @param {Object|null} selected - 选中的筛选条件
   * @param {Array|null} excluded - 排除的号码
   * @param {boolean} useCache - 是否使用缓存
   * @returns {Array} 筛选后的号码列表
   */
  getFilteredList: (selected = null, excluded = null, useCache = true) => {
    try {
      const state = StateManager._state;
      const targetSelected = selected || state.filter.selected;
      const targetExcluded = excluded || state.filter.excluded;
      const numList = state.data.numList;

      if (useCache && selected === null && excluded === null) {
        const cacheKey = JSON.stringify({ selected: targetSelected, excluded: targetExcluded });
        
        if (_filterCache.has(cacheKey)) {
          const cached = _filterCache.get(cacheKey);
          if (Date.now() - cached.timestamp < _cacheTimeout) {
            return cached.result;
          }
        }
        
        const result = Filter._computeFilteredList(targetSelected, targetExcluded, numList);
        _filterCache.set(cacheKey, { result, timestamp: Date.now() });
        
        if (_filterCache.size > 20) {
          const firstKey = _filterCache.keys().next().value;
          _filterCache.delete(firstKey);
        }
        
        return result;
      }

      return Filter._computeFilteredList(targetSelected, targetExcluded, numList);
    } catch(e) {
      console.error('筛选失败', e);
      return [];
    }
  },
  
  /**
   * 计算筛选结果（内部方法）
   * @private
   */
  _computeFilteredList: (targetSelected, targetExcluded, numList) => {
    const excludedSet = new Set(targetExcluded);
    
    const selectedSets = {};
    for(const group in targetSelected){
      if(targetSelected[group].length) {
        selectedSets[group] = new Set(targetSelected[group]);
      }
    }

    return numList.filter(item => {
      if(excludedSet.has(item.num)) return false;
      for(const group in selectedSets){
        if(!selectedSets[group].has(item[group])) return false;
      }
      return true;
    });
  },
  
  /**
   * 清除筛选缓存
   */
  clearFilterCache: () => {
    _filterCache.clear();
  },

  /**
   * 全选所有筛选条件（防抖优化）
   */
  selectAllFilters: Utils.debounce(() => {
    const state = StateManager._state;
    Object.keys(state.filter.selected).forEach(group => StateManager.selectGroup(group));
    Toast.show('已全选所有筛选条件');
  }, CONFIG.CLICK_DEBOUNCE_DELAY),

  /**
   * 清除所有筛选条件（防抖优化）
   */
  clearAllFilters: Utils.debounce(() => {
    try {
      console.log('[Filter] 开始清除所有筛选条件...');
      
      const state = StateManager._state;
      
      if (!state || !state.filter || !state.filter.selected) {
        console.error('[Filter] 状态无效，无法清除筛选条件');
        Toast.show('清除失败：状态异常');
        return;
      }
      
      // 获取所有筛选分组
      const filterGroups = Object.keys(state.filter.selected);
      
      if (filterGroups.length === 0) {
        console.log('[Filter] 没有需要清除的筛选条件');
        Toast.show('当前无筛选条件');
        return;
      }
      
      // 重置所有筛选条件
      console.log(`[Filter] 准备重置 ${filterGroups.length} 个筛选分组`);
      
      filterGroups.forEach(group => {
        try {
          StateManager.resetGroup(group);
          console.log(`[Filter] 已重置分组: ${group}`);
        } catch (groupError) {
          console.error(`[Filter] 重置分组失败: ${group}`, groupError);
        }
      });
      
      // 重置排除号码
      try {
        const currentFilter = StateManager._state.filter;
        StateManager.setState({
          filter: {
            ...currentFilter,
            excluded: [],
            excludeHistory: currentFilter.excludeHistory || [],
            lockExclude: false
          }
        }, false, '清除排除号码');
        console.log('[Filter] 已重置排除号码');
      } catch (excludeError) {
        console.error('[Filter] 重置排除号码失败:', excludeError);
      }
      
      // 更新锁定排除复选框
      try {
        const lockExcludeCheckbox = document.getElementById('lockExclude');
        if (lockExcludeCheckbox) {
          lockExcludeCheckbox.checked = false;
        }
      } catch (domError) {
        console.warn('[Filter] 无法更新锁定排除复选框:', domError);
      }
      
      // 验证状态更新
      const updatedState = StateManager._state;
      const allCleared = filterGroups.every(group => 
        !updatedState.filter.selected[group] || 
        updatedState.filter.selected[group].length === 0
      );
      
      const excludeCleared = !updatedState.filter.excluded || 
                            updatedState.filter.excluded.length === 0;
      
      if (allCleared && excludeCleared) {
        console.log('[Filter] ✅ 所有筛选条件清除成功');
        Toast.show('已清除所有筛选与排除条件');
        
        // 触发UI更新
        Filter.updateFilterDisplay();
      } else {
        console.warn('[Filter] ⚠️ 部分筛选条件可能未完全清除');
        Toast.show('部分筛选条件清除失败，请重试');
      }
      
    } catch (error) {
      console.error('[Filter] 清除所有筛选条件失败:', error);
      Toast.show('清除失败，请稍后重试');
    }
  }, CONFIG.CLICK_DEBOUNCE_DELAY),

  /**
   * 更新筛选UI显示
   * 清除所有复选框的选中状态
   */
  updateFilterDisplay: () => {
    try {
      console.log('[Filter] 更新筛选UI显示...');
      
      // 清除所有筛选复选框
      const checkboxes = document.querySelectorAll('.filter-checkbox, .filter-item input[type="checkbox"]');
      let clearedCount = 0;
      
      checkboxes.forEach(checkbox => {
        try {
          if (checkbox.checked) {
            checkbox.checked = false;
            clearedCount++;
          }
        } catch (checkboxError) {
          console.warn('[Filter] 清除复选框失败:', checkboxError);
        }
      });
      
      console.log(`[Filter] 已清除 ${clearedCount} 个复选框`);
      
      // 清除排除号码显示
      const excludedNumbersContainer = document.getElementById('excludedNumbers');
      if (excludedNumbersContainer) {
        excludedNumbersContainer.innerHTML = '';
      }
      
      // 更新统计显示
      Filter.updateFilterStats();
      
      console.log('[Filter] ✅ UI显示更新完成');
    } catch (error) {
      console.error('[Filter] 更新筛选UI显示失败:', error);
    }
  },

  /**
   * 更新筛选统计信息
   */
  updateFilterStats: () => {
    try {
      const state = StateManager._state;
      const selected = state.filter.selected;
      
      // 计算选中的总数
      let totalSelected = 0;
      for (const group in selected) {
        totalSelected += selected[group].length;
      }
      
      // 更新显示（如果有对应的DOM元素）
      const statsElement = document.getElementById('filterStats');
      if (statsElement) {
        statsElement.textContent = `已选: ${totalSelected}个`;
      }
      
      // 更新排除号码计数
      const excludedCount = state.filter.excluded?.length || 0;
      const excludedStatsElement = document.getElementById('excludedStats');
      if (excludedStatsElement) {
        excludedStatsElement.textContent = `排除: ${excludedCount}个`;
      }
      
    } catch (error) {
      console.warn('[Filter] 更新筛选统计失败:', error);
    }
  }
};
