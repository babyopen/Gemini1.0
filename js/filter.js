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

export const Filter = {
  /**
   * 通用筛选函数
   * @param {Object|null} selected - 选中的筛选条件
   * @param {Array|null} excluded - 排除的号码
   * @returns {Array} 筛选后的号码列表
   */
  getFilteredList: (selected = null, excluded = null) => {
    try {
      const state = StateManager._state;
      const targetSelected = selected || state.filter.selected;
      const targetExcluded = excluded || state.filter.excluded;
      const numList = state.data.numList;

      // 转换为Set提高查找效率
      const excludedSet = new Set(targetExcluded);
      
      // 预处理选中条件，转换为Set
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
    } catch(e) {
      console.error('筛选失败', e);
      return [];
    }
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
    const state = StateManager._state;
    // 重置所有筛选条件
    Object.keys(state.filter.selected).forEach(group => StateManager.resetGroup(group));
    // 重置排除号码
    StateManager.setState({
      filter: {
        ...state.filter,
        excluded: [],
        excludeHistory: [],
        lockExclude: false
      }
    });
    // 更新复选框
    // DOM.lockExclude.checked = false;
    Toast.show('已清除所有筛选与排除条件');
  }, CONFIG.CLICK_DEBOUNCE_DELAY)
};
