// ====================== 3. 状态管理模块（统一管理所有状态，避免状态与视图不同步）======================
/**
 * 状态管理器
 * @namespace StateManager
 */

// 导入必要的模块
import { Utils } from './utils.js';
import { Render } from './render.js';
import { Toast } from './toast.js';

const _stateChangeListeners = new Map();
const _pendingUpdates = new Set();

export const StateManager = {
  /**
   * 私有状态对象
   * @private
   */
  _state: {
    // 筛选相关状态
    filter: {
      selected: {
        zodiac: [],
        color: [],
        colorsx: [],
        type: [],
        element: [],
        head: [],
        tail: [],
        sum: [],
        bs: [],
        hot: [],
        sumOdd: [],
        sumBig: [],
        tailBig: []
      },
      excluded: [],
      excludeHistory: [],
      lockExclude: false,
      savedFilters: [],
      showAllFilters: false
    },
    // 数据相关状态
    data: {
      numList: [],
      currentZodiac: '',
      zodiacCycle: []
    },
    // 分析模块状态
    analysis: {
      historyData: [],
      analyzeLimit: 10,
      selectedNumCount: 5,
      showCount: 20,
      currentTab: 'history',
      autoRefreshTimer: null,
      specialMode: 'auto', // 'hot' | 'cold' | 'auto'
      autoModeDecision: {
        lastDecision: 'auto',
        lastDecisionPeriod: 0,
        holdPeriods: 0
      }
    },
    // 系统状态
    system: {
      scrollTimer: null,
      favorites: [],
      lastUpdateTime: Date.now()
    }
  },
  
  /**
   * 状态变更历史
   * @private
   */
  _history: [],
  
  /**
   * 最大历史记录数
   * @private
   */
  _maxHistory: 50,

  /**
   * 获取只读状态快照
   * @returns {Object} 状态快照
   */
  getState: () => Utils.deepClone(StateManager._state),
  
  /**
   * 获取指定路径的状态
   * @param {string} path - 状态路径，如 'filter.selected.zodiac'
   * @returns {*} 状态值
   */
  getStateByPath: (path) => {
    const keys = path.split('.');
    let value = StateManager._state;
    for (const key of keys) {
      if (value === undefined || value === null) return undefined;
      value = value[key];
    }
    return Utils.deepClone(value);
  },

  /**
   * 统一更新状态入口
   * @param {Object} partialState - 要更新的部分状态
   * @param {boolean} needRender - 是否自动触发渲染
   * @param {string} action - 操作描述
   */
  setState: (partialState, needRender = true, action = 'unknown') => {
    try {
      // 记录状态变更历史
      StateManager._recordHistory(action);
      
      // 深度合并状态
      StateManager._state = StateManager._deepMerge(StateManager._state, partialState);
      
      // 更新最后更新时间
      StateManager._state.system.lastUpdateTime = Date.now();
      
      if(needRender) Render.renderAll();
    } catch(e) {
      console.error('状态更新失败', e);
      Toast.show('操作失败，请刷新重试');
    }
  },
  
  /**
   * 深度合并对象
   * @private
   * @param {Object} target - 目标对象
   * @param {Object} source - 源对象
   * @returns {Object} 合并后的对象
   */
  _deepMerge: (target, source) => {
    if (target === null || typeof target !== 'object') return source;
    if (source === null || typeof source !== 'object') return source;
    
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = StateManager._deepMerge(result[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  },
  
  /**
   * 记录状态变更历史
   * @private
   * @param {string} action - 操作描述
   */
  _recordHistory: (action) => {
    const snapshot = {
      timestamp: Date.now(),
      action,
      state: StateManager.getState()
    };
    
    StateManager._history.push(snapshot);
    
    // 限制历史记录数量
    if (StateManager._history.length > StateManager._maxHistory) {
      StateManager._history.shift();
    }
  },

  /**
   * 更新选中的筛选条件
   * @param {string} group - 分组名
   * @param {string|number} value - 选中的值
   */
  updateSelected: (group, value) => {
    const state = StateManager._state;
    const index = state.filter.selected[group].indexOf(value);
    const newSelected = { ...state.filter.selected };
    
    index > -1 
      ? newSelected[group] = newSelected[group].filter(item => item !== value)
      : newSelected[group] = [...newSelected[group], value];

    StateManager.setState({ filter: { ...state.filter, selected: newSelected } }, true, `更新${group}筛选条件`);
  },

  /**
   * 重置分组选中状态
   * @param {string} group - 分组名
   */
  resetGroup: (group) => {
    const state = StateManager._state;
    const newSelected = { ...state.filter.selected };
    newSelected[group] = [];
    StateManager.setState({ filter: { ...state.filter, selected: newSelected } }, true, `重置${group}筛选条件`);
  },

  /**
   * 获取初始空的selected对象
   * @returns {Object} 空的selected对象
   */
  getEmptySelected: () => ({
    zodiac: [],
    color: [],
    colorsx: [],
    type: [],
    element: [],
    head: [],
    tail: [],
    sum: [],
    bs: [],
    hot: [],
    sumOdd: [],
    sumBig: [],
    tailBig: []
  }),

  /**
   * 全选分组
   * @param {string} group - 分组名
   */
  selectGroup: (group) => {
    const allTags = [...document.querySelectorAll(`.tag[data-group="${group}"]`)];
    const allValues = allTags.map(tag => Utils.formatTagValue(tag.dataset.value, group));
    const state = StateManager._state;
    const newSelected = { ...state.filter.selected };
    newSelected[group] = allValues;
    StateManager.setState({ filter: { ...state.filter, selected: newSelected } }, true, `全选${group}筛选条件`);
  },

  /**
   * 反选分组
   * @param {string} group - 分组名
   */
  invertGroup: (group) => {
    const state = StateManager._state;
    const allTags = [...document.querySelectorAll(`.tag[data-group="${group}"]`)];
    const allValues = allTags.map(tag => Utils.formatTagValue(tag.dataset.value, group));
    const newSelected = { ...state.filter.selected };
    newSelected[group] = allValues.filter(v => !state.filter.selected[group].includes(v));
    StateManager.setState({ filter: { ...state.filter, selected: newSelected } }, true, `反选${group}筛选条件`);
  },

  /**
   * 清理所有定时器，避免内存泄漏
   */
  clearAllTimers: () => {
    const state = StateManager._state;
    if(state.system.scrollTimer) {
      clearTimeout(state.system.scrollTimer);
      StateManager.setState({ system: { ...state.system, scrollTimer: null } }, false, '清理滚动定时器');
    }
    Toast.clearTimer();
  },
  
  /**
   * 重置所有状态
   */
  resetState: () => {
    StateManager.setState({
      filter: {
        selected: StateManager.getEmptySelected(),
        excluded: [],
        excludeHistory: [],
        lockExclude: false,
        savedFilters: [],
        showAllFilters: false
      },
      data: {
        numList: [],
        currentZodiac: '',
        zodiacCycle: []
      },
      analysis: {
        historyData: [],
        analyzeLimit: 10,
        selectedNumCount: 5,
        showCount: 20,
        currentTab: 'history',
        autoRefreshTimer: null,
        specialMode: 'auto',
        autoModeDecision: {
          lastDecision: 'auto',
          lastDecisionPeriod: 0,
          holdPeriods: 0
        }
      },
      system: {
        scrollTimer: null,
        favorites: [],
        lastUpdateTime: Date.now()
      }
    }, true, '重置所有状态');
  },
  
  /**
   * 获取状态变更历史
   * @returns {Array} 状态变更历史
   */
  getHistory: () => Utils.deepClone(StateManager._history),
  
  /**
   * 订阅状态变化
   * @param {string} key - 状态路径
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消订阅函数
   */
  subscribe: (key, callback) => {
    if (!_stateChangeListeners.has(key)) {
      _stateChangeListeners.set(key, new Set());
    }
    _stateChangeListeners.get(key).add(callback);
    
    return () => {
      const listeners = _stateChangeListeners.get(key);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  },
  
  /**
   * 批量更新状态（合并多次更新为一次渲染）
   * @param {Function} updater - 更新函数
   */
  batchUpdate: (updater) => {
    if (_pendingUpdates.has(updater)) return;
    
    _pendingUpdates.add(updater);
    
    requestAnimationFrame(() => {
      updater(StateManager._state);
      StateManager.setState({}, true, '批量更新');
      _pendingUpdates.delete(updater);
    });
  },
  
  /**
   * 选择性渲染更新（只更新特定部分）
   * @param {string} path - 状态路径
   */
  partialRender: (path) => {
    const value = StateManager.getStateByPath(path);
    
    if (path === 'filter.selected') {
      Render.renderTagStatus();
    } else if (path === 'filter.excluded') {
      Render.renderExcludeGrid();
    } else if (path === 'data.numList') {
      Render.renderResult();
    }
    
    const listeners = _stateChangeListeners.get(path);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(value);
        } catch (e) {
          console.error('状态监听器执行失败:', e);
        }
      });
    }
  },
  
  /**
   * 获取状态变更历史记录数
   * @returns {number}
   */
  getHistoryCount: () => StateManager._history.length,
  
  /**
   * 清理历史记录（释放内存）
   * @param {number} keepCount - 保留记录数
   */
  trimHistory: (keepCount = 50) => {
    if (StateManager._history.length > keepCount) {
      StateManager._history = StateManager._history.slice(-keepCount);
    }
  },
  
  /**
   * 保存状态到本地存储
   */
  saveState: () => {
    try {
      const stateToSave = {
        filter: StateManager._state.filter,
        system: {
          favorites: StateManager._state.system.favorites
        }
      };
      localStorage.setItem('gemini-state', JSON.stringify(stateToSave));
      return true;
    } catch (e) {
      console.error('保存状态失败', e);
      return false;
    }
  },
  
  /**
   * 从本地存储加载状态
   */
  loadState: () => {
    try {
      const savedState = localStorage.getItem('gemini-state');
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        StateManager.setState(parsedState, true, '从本地存储加载状态');
        return true;
      }
      return false;
    } catch (e) {
      console.error('加载状态失败', e);
      return false;
    }
  }
};
