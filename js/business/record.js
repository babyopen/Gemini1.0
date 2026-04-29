// ====================== 记录页面业务逻辑 ======================
/**
 * 记录页面业务逻辑 - 主入口模块
 * 
 * 模块结构：
 * - record-constants.js  : 常量配置
 * - record-favorites.js  : 收藏方案管理
 * - record-statistics.js : 预测统计计算
 * - record-selected-zodiac.js : 精选生肖历史
 * - record-zodiac-prediction.js : 生肖预测历史
 * - record-ml-prediction.js : ML预测历史
 * - record-special.js : 精选特码历史
 * - record-hot.js : 特码热门TOP5历史
 * - record-check.js : 开奖结果核对
 * - record-pull.js : 下拉刷新和滑动删除
 */

// 导入所有子模块
import { RECORD_CONSTANTS } from './record/record-constants.js';
import * as recordFavorites from './record/record-favorites.js';
import * as recordStatistics from './record/record-statistics.js';
import * as recordSelectedZodiac from './record/record-selected-zodiac.js';
import * as recordZodiacPrediction from './record/record-zodiac-prediction.js';
import * as recordMLPrediction from './record/record-ml-prediction.js';
import * as recordSpecial from './record/record-special.js';
import * as recordHot from './record/record-hot.js';
import * as recordCheck from './record/record-check.js';
import { initPullRefresh, SwipeDeleteManager, toggleCollapse } from './record/record-pull.js';

// 导入基础模块
import { Storage } from '../storage.js';
import { StateManager } from '../state-manager.js';
import { Toast } from '../toast.js';
import { Utils } from '../utils.js';

// 记录模块主对象
export const record = {
  // 版本信息
  VERSION: '2.0.0',
  
  // 标记事件是否已绑定
  _eventsBound: false,
  
  // 标记各组件是否已渲染
  _renderedComponents: {
    favorites: false,
    statistics: false,
    selectedZodiac: false,
    zodiacPrediction: false,
    mlPrediction: false,
    special: false,
    hotNumbers: false
  },

  // 分页状态
  _pagination: {
    selectedZodiac: { page: 1, pageSize: RECORD_CONSTANTS.PAGE_SIZE },
    zodiacPrediction: { page: 1, pageSize: RECORD_CONSTANTS.PAGE_SIZE },
    mlPrediction: { page: 1, pageSize: RECORD_CONSTANTS.PAGE_SIZE },
    special: { page: 1, pageSize: RECORD_CONSTANTS.PAGE_SIZE },
    hotNumbers: { page: 1, pageSize: RECORD_CONSTANTS.PAGE_SIZE }
  },
  
  // 筛选状态
  _zodiacPredictionFilter: { selectedPeriods: ['10'] },
  _specialHistoryFilter: { selectedNumCount: '5' },
  
  // 滑动删除管理器
  _swipeHandlers: new WeakMap(),
  
  // 初始化
  init: () => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        record._initFilterButtons();
        record.initPullRefresh();
        record.initAndRefresh();
        record.bindEvents();
      });
    } else {
      Promise.allSettled([
        record._initFilterButtons(),
        record.initPullRefresh(),
        record.initAndRefresh(),
        record.bindEvents()
      ]);
    }
  },
  
  // 下拉刷新初始化
  initPullRefresh: () => {
    const container = document.getElementById('recordPullContainer');
    if (container) {
      initPullRefresh(container, record.autoFetchAndCheck);
    }
  },
  
  // 初始化并自动获取最新数据（优化版）
  initAndRefresh: () => {
    // 延迟渲染，避免阻塞首屏
    setTimeout(() => {
      record.renderAll();
    }, 100);
    
    // 延迟获取数据，让渲染先完成
    setTimeout(() => {
      record.autoFetchAndCheck().catch(error => {
        console.error('[Record] 自动获取数据失败:', error);
      });
    }, 300);
  },
  
  // 自动获取并核对
  autoFetchAndCheck: async () => {
    try {
      console.log('[Record] 🚀 开始自动获取最新数据并核对记录...');
      const { dataFetch } = await import('../business/analysis/modules/data-fetch.js');
      await dataFetch.silentRefreshHistory();
      record._checkAllRecordsWithLatestData();
      console.log('[Record] ✅ 自动获取并核对完成');
    } catch (error) {
      console.error('[Record] ❌ 自动获取数据失败:', error);
      record._checkAllRecordsWithLatestData();
    }
  },
  
  // 初始化筛选按钮
  _initFilterButtons: () => {
    const btn10 = document.querySelector('.prediction-period-btn[data-period="10"]');
    if (btn10) btn10.classList.add('active');
    
    const savedFilters = Storage.loadSpecialFilters();
    const validNumCounts = RECORD_CONSTANTS.VALID_NUM_COUNTS;
    const validNumCount = validNumCounts.includes(savedFilters.numCount) ? savedFilters.numCount : RECORD_CONSTANTS.DEFAULT_NUM_COUNT;
    
    record._specialHistoryFilter.selectedNumCount = validNumCount;
    
    const popupCountBtn = document.querySelector(`.special-history-count-btn[data-count="${validNumCount}"]`);
    if (popupCountBtn) popupCountBtn.classList.add('active');
    
    const panelCountBtn = document.querySelector(`.special-num-btn[data-num="${validNumCount}"]`);
    if (panelCountBtn) panelCountBtn.classList.add('active');
    
    console.log('[Init] 精选特码筛选条件已加载:', { numCount: validNumCount });
  },
  
  // 防抖版本的 renderAll
  renderAllDebounced: Utils.debounce(() => {
    record.renderAll();
  }, RECORD_CONSTANTS.DEBOUNCE_DELAY),
  
  // 渲染所有历史记录（优化版：分批延迟渲染）
  renderAll: () => {
    // 优先渲染关键组件（收藏和统计）
    setTimeout(() => {
      recordFavorites.renderFavoriteList(document.getElementById('favoriteList'));
      record._renderedComponents.favorites = true;
    }, 10);
    
    setTimeout(() => {
      record.renderPredictionStatistics();
      record._renderedComponents.statistics = true;
    }, 50);
    
    // 使用 requestIdleCallback 在浏览器空闲时渲染次要组件
    const idleCallback = window.requestIdleCallback || window.requestAnimationFrame;
    
    idleCallback(() => {
      if (!record._renderedComponents.selectedZodiac) {
        recordSelectedZodiac.renderSelectedZodiacHistory(document.getElementById('selectedZodiacHistoryList'));
        record._renderedComponents.selectedZodiac = true;
      }
    }, { timeout: 500 });
    
    idleCallback(() => {
      if (!record._renderedComponents.zodiacPrediction) {
        recordZodiacPrediction.renderZodiacPredictionHistory(document.getElementById('zodiacPredictionHistoryList'), false, record._pagination.zodiacPrediction, record._zodiacPredictionFilter);
        record._renderedComponents.zodiacPrediction = true;
      }
    }, { timeout: 1000 });
    
    idleCallback(() => {
      if (!record._renderedComponents.mlPrediction) {
        recordMLPrediction.renderMLPredictionHistory(document.getElementById('mlPredictionHistoryList'), false, record._pagination.mlPrediction);
        record._renderedComponents.mlPrediction = true;
      }
    }, { timeout: 1500 });
    
    idleCallback(() => {
      if (!record._renderedComponents.special) {
        recordSpecial.renderSpecialHistory(document.getElementById('specialHistoryList'), record._specialHistoryFilter);
        record._renderedComponents.special = true;
      }
    }, { timeout: 2000 });
    
    idleCallback(() => {
      if (!record._renderedComponents.hotNumbers) {
        recordHot.renderHotNumbersHistory(document.getElementById('hotNumbersHistoryList'));
        record._renderedComponents.hotNumbers = true;
      }
    }, { timeout: 2500 });
  },
  
  // 刷新所有数据
  refreshAll: () => {
    try {
      const cacheKeys = ['favorites', 'zodiacRecords', 'mlPredictionRecords', 'numberRecords', 'hotNumbersRecords'];
      cacheKeys.forEach(key => Storage.clearCache(key));
      record.renderAll();
      return true;
    } catch (error) {
      console.error('[Record] 刷新记录页面失败:', error);
      Toast.show('刷新失败，请重试');
      return false;
    }
  },
  
  // 渲染预测统计
  renderPredictionStatistics: () => {
    try {
      const allRecords = Storage.get('zodiacRecords', []);
      const selectedRecords = allRecords.filter(r => r.recordType === 'selected');
      const zodiacRecords = allRecords.filter(r => !r.recordType || r.recordType !== 'selected');
      
      const selectedStats = recordStatistics.calculateStats(selectedRecords);
      const predictionStats = recordStatistics.calculateStats(zodiacRecords);
      
      recordStatistics.updateSummaryCard('selectedZodiac', {
        total: selectedStats.total,
        hit: selectedStats.hit,
        miss: selectedStats.miss,
        pending: selectedStats.pending,
        rate: selectedStats.rate,
        latest: selectedStats.latest,
        latestZodiacs: selectedStats.latestZodiacs
      });
      
      recordStatistics.updateSummaryCard('zodiacPrediction', {
        total: predictionStats.total,
        hit: predictionStats.hit,
        miss: predictionStats.miss,
        pending: predictionStats.pending,
        rate: predictionStats.rate,
        latest: predictionStats.latest,
        latestZodiacs: predictionStats.latestZodiacs
      });
      
      const mlRecords = Storage.get('mlPredictionRecords', []);
      const mlStats = recordStatistics.calculateMLPredictionStats(mlRecords);
      recordStatistics.updateSummaryCard('mlPrediction', {
        total: mlStats.total,
        hit: mlStats.hit,
        miss: mlStats.miss,
        pending: mlStats.pending,
        rate: mlStats.rate,
        latest: mlStats.latest,
        latestZodiacs: mlStats.latestZodiacs
      });
      
      const hotRecords = Storage.get('hotNumbersRecords', []);
      const hotStats = recordStatistics.calculateHotNumbersStats(hotRecords);
      recordStatistics.updateSummaryCard('hotNumbers', {
        total: hotStats.total,
        hit: hotStats.hit,
        miss: hotStats.miss,
        pending: hotStats.pending,
        rate: hotStats.rate,
        latest: hotStats.latest,
        latestNumbers: hotStats.latestNumbers
      });
      
      const selectedNumCount = record._specialHistoryFilter.selectedNumCount || '5';
      const specialRecords = Storage.get(Storage.KEYS.NUMBER_RECORDS, []);
      const specialStats = recordStatistics.calculateSpecialStats(specialRecords, { numCount: selectedNumCount });
      recordStatistics.updateSummaryCard('special', {
        total: specialStats.total,
        hit: specialStats.hit,
        miss: specialStats.miss,
        pending: specialStats.pending,
        rate: specialStats.rate,
        latest: specialStats.latest,
        latestNumbers: specialStats.latestNumbers
      });
    } catch (error) {
      console.error('加载预测统计失败:', error);
    }
  },
  
  // 使用最新数据核对所有记录
  _checkAllRecordsWithLatestData: () => {
    try {
      const historyData = StateManager._state.analysis.historyData;
      if (!historyData || historyData.length === 0) return;
      
      const recentItems = historyData.slice(0, RECORD_CONSTANTS.CHECK_RECENT_COUNT);
      console.log('[Record] 🔍 开始核对最近', recentItems.length, '期数据...');
      
      recentItems.forEach(item => {
        const issue = item.expect;
        const openCode = item.openCode || '';
        const actualNumbers = openCode.split(',').map(num => num.trim()).filter(num => num);
        if (actualNumbers.length === 0) return;
        
        const specialNumber = actualNumbers[actualNumbers.length - 1];
        
        import('../business/analysis/modules/analysis-calc.js').then(({ analysisCalc }) => {
          const special = analysisCalc.getSpecial(item);
          const resultZodiac = special.zod;
          
          recordCheck.checkZodiacRecord(issue, resultZodiac);
          recordCheck.checkNumberRecord(issue, actualNumbers);
          recordCheck.checkHotNumbersRecord(issue, actualNumbers);
          recordCheck.checkMLPredictionRecord(issue, resultZodiac);
        }).catch(error => {
          console.error('[Record] 导入analysisCalc失败:', error);
        });
      });
      
      record.renderPredictionStatistics();
      console.log('[Record] ✅ 所有记录核对完成，统计数据已更新');
    } catch (error) {
      console.error('[Record] 核对记录失败:', error);
    }
  },
  
  // 刷新预测统计
  refreshPredictionStatistics: () => { record.renderPredictionStatistics(); Toast.show('统计已刷新'); },
  
  // ========== 收藏相关 ==========
  renderFavoriteList: () => recordFavorites.renderFavoriteList(document.getElementById('favoriteList')),
  clearAllFavorites: () => recordFavorites.clearAllFavorites(),
  removeFavorite: (index) => recordFavorites.removeFavorite(index),
  loadFavorite: (index) => recordFavorites.loadFavorite(index),
  renameFavorite: (index) => recordFavorites.renameFavorite(index),
  copyFavorite: (index) => recordFavorites.copyFavorite(index),
  
  // ========== 精选生肖历史 ==========
  renderSelectedZodiacHistory: () => recordSelectedZodiac.renderSelectedZodiacHistory(document.getElementById('selectedZodiacHistoryList')),
  clearSelectedZodiacHistory: () => recordSelectedZodiac.clearSelectedZodiacHistory(),
  renderSelectedZodiacDetailHistory: () => recordSelectedZodiac.renderSelectedZodiacDetailHistory(
    document.getElementById('selectedZodiacDetailList'),
    document.getElementById('selectedZodiacDetailToggle')
  ),
  initSelectedZodiacDetail: () => record.renderSelectedZodiacDetailHistory(),
  
  // ========== 生肖预测历史 ==========
  renderZodiacPredictionHistory: (loadMore = false) => recordZodiacPrediction.renderZodiacPredictionHistory(
    document.getElementById('zodiacPredictionHistoryList'),
    loadMore,
    record._pagination.zodiacPrediction,
    record._zodiacPredictionFilter
  ),
  clearZodiacPredictionHistory: () => recordZodiacPrediction.clearZodiacPredictionHistory(),
  renderZodiacPredictionDetailHistory: () => recordZodiacPrediction.renderZodiacPredictionDetailHistory(
    document.getElementById('zodiacPredictionDetailList'),
    document.getElementById('zodiacPredictionDetailToggle')
  ),
  initZodiacPredictionDetail: () => record.renderZodiacPredictionDetailHistory(),
  
  // ========== ML预测历史 ==========
  renderMLPredictionHistory: (loadMore = false) => recordMLPrediction.renderMLPredictionHistory(
    document.getElementById('mlPredictionHistoryList'),
    loadMore,
    record._pagination.mlPrediction
  ),
  refreshMLPredictionHistory: () => recordMLPrediction.refreshMLPredictionHistory(),
  clearMLPredictionHistory: () => recordMLPrediction.clearMLPredictionHistory(),
  renderMLPredictionDetailHistory: () => recordMLPrediction.renderMLPredictionDetailHistory(
    document.getElementById('mlPredictionDetailList'),
    document.getElementById('mlPredictionDetailToggle')
  ),
  initMLPredictionDetail: () => record.renderMLPredictionDetailHistory(),
  
  // ========== 精选特码历史 ==========
  renderSpecialHistory: () => recordSpecial.renderSpecialHistory(
    document.getElementById('specialHistoryList'),
    record._specialHistoryFilter
  ),
  clearSpecialHistory: () => recordSpecial.clearSpecialHistory(),
  renderSpecialDetailHistory: () => recordSpecial.renderSpecialDetailHistory(
    document.getElementById('specialDetailList'),
    document.getElementById('specialDetailToggle')
  ),
  initSpecialDetail: () => record.renderSpecialDetailHistory(),
  
  // ========== 特码热门TOP5历史 ==========
  renderHotNumbersHistory: () => recordHot.renderHotNumbersHistory(document.getElementById('hotNumbersHistoryList')),
  clearHotNumbersHistory: () => recordHot.clearHotNumbersHistory(),
  renderHotNumbersDetailHistory: () => recordHot.renderHotNumbersDetailHistory(
    document.getElementById('hotNumbersDetailList'),
    document.getElementById('hotNumbersDetailToggle')
  ),
  initHotNumbersDetail: () => record.renderHotNumbersDetailHistory(),
  
  // ========== 核对相关 ==========
  checkZodiacRecord: (issue, actualZodiac) => {
    const result = recordCheck.checkZodiacRecord(issue, actualZodiac);
    if (result.success) {
      record.renderZodiacPredictionHistory();
      record.renderSelectedZodiacHistory();
      record.renderPredictionStatistics();
    }
    return result;
  },
  manualCheckZodiacRecord: (issue, actualZodiac) => recordCheck.manualCheckZodiacRecord(issue, actualZodiac),
  showCheckDialog: () => recordCheck.showCheckDialog(),
  checkNumberRecord: (issue, actualNumbers) => {
    const result = recordCheck.checkNumberRecord(issue, actualNumbers);
    if (result.success) record.renderSpecialHistory();
    return result;
  },
  checkHotNumbersRecord: (issue, actualNumbers) => {
    const result = recordCheck.checkHotNumbersRecord(issue, actualNumbers);
    if (result.success) record.renderHotNumbersHistory();
    return result;
  },
  checkMLPredictionRecord: (issue, actualZodiac) => {
    const result = recordCheck.checkMLPredictionRecord(issue, actualZodiac);
    if (result.success) record.renderMLPredictionHistory();
    return result;
  },
  
  // ========== 筛选面板操作 ==========
  togglePredictionFiltersPanel: () => {
    const panel = document.getElementById('predictionFiltersPanel');
    if (panel) panel.classList.toggle('show');
  },
  toggleSpecialFiltersPanel: () => {
    const panel = document.getElementById('specialFiltersPanel');
    if (panel) panel.classList.toggle('show');
  },
  selectAllPredictionPeriods: () => {
    const buttons = document.querySelectorAll('.prediction-period-btn');
    buttons.forEach((btn, index) => {
      if (index === 0) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    record._zodiacPredictionFilter.selectedPeriods = ['10'];
  },
  resetPredictionPeriods: () => record.selectAllPredictionPeriods(),
  confirmPredictionFilters: () => {
    const activeButton = document.querySelector('.prediction-period-btn.active');
    const selectedPeriod = activeButton ? activeButton.dataset.period : '10';
    record._zodiacPredictionFilter.selectedPeriods = [selectedPeriod];
    
    const panel = document.getElementById('predictionFiltersPanel');
    if (panel) panel.classList.remove('show');
    
    record.renderZodiacPredictionHistory();
    Toast.show(`已应用筛选：${selectedPeriod === 'all' ? '全年' : selectedPeriod + '期'}`);
  },
  confirmSpecialFilters: () => {
    const activeNumBtn = document.querySelector('.special-num-btn.active');
    const selectedNumCount = activeNumBtn ? activeNumBtn.dataset.num : '5';
    const validNumCounts = RECORD_CONSTANTS.VALID_NUM_COUNTS;
    const validCount = validNumCounts.includes(selectedNumCount) ? selectedNumCount : RECORD_CONSTANTS.DEFAULT_NUM_COUNT;
    
    record._specialHistoryFilter.selectedNumCount = validCount;
    Storage.saveSpecialFilters({ numCount: validCount });
    
    const panel = document.getElementById('specialFiltersPanel');
    if (panel) panel.classList.remove('show');
    
    record.renderSpecialHistory();
    Toast.show(`已应用筛选：显示${validCount}个号码`);
  },
  switchSpecialHistoryMode: (mode) => {
    const buttons = document.querySelectorAll('.special-history-mode-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.special-history-mode-btn[data-mode="${mode}"]`)?.classList.add('active');
    record.renderSpecialHistory();
    Toast.show(`已切换到${mode === 'hot' ? '🔥 热号' : mode === 'cold' ? '❄️ 冷号' : '全部'}模式`);
  },
  switchSpecialHistoryCount: (count) => {
    const validNumCounts = RECORD_CONSTANTS.VALID_NUM_COUNTS;
    const validCount = validNumCounts.includes(String(count)) ? String(count) : RECORD_CONSTANTS.DEFAULT_NUM_COUNT;
    
    const buttons = document.querySelectorAll('.special-history-count-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.special-history-count-btn[data-count="${validCount}"]`)?.classList.add('active');
    
    record._specialHistoryFilter.selectedNumCount = validCount;
    Storage.saveSpecialFilters({ numCount: validCount });
    record.renderPredictionStatistics();
    Toast.show(`已切换到显示${validCount}个号码`);
  },
  
  // ========== 展开/收起 ==========
  toggleSelectedZodiacCollapse: () => toggleCollapse('selectedZodiac', 'selectedZodiacHistoryList', 'selectedZodiacHistoryToggle'),
  toggleSelectedZodiacDetailCollapse: () => toggleCollapse('selectedZodiacDetail', 'selectedZodiacDetailList', 'selectedZodiacDetailToggle'),
  toggleSpecialCollapse: () => toggleCollapse('special', 'specialHistoryList', 'specialHistoryToggle'),
  toggleSpecialDetailCollapse: () => toggleCollapse('specialDetail', 'specialDetailList', 'specialDetailToggle'),
  toggleHotNumbersCollapse: () => toggleCollapse('hotNumbers', 'hotNumbersHistoryList', 'hotNumbersHistoryToggle'),
  toggleHotNumbersDetailCollapse: () => toggleCollapse('hotNumbersDetail', 'hotNumbersDetailList', 'hotNumbersDetailToggle'),
  toggleZodiacPredictionHistory: () => record.renderZodiacPredictionHistory(true),
  toggleMLPredictionHistory: () => record.renderMLPredictionHistory(true),
  toggleMLPredictionDetailCollapse: () => toggleCollapse('mlPredictionDetail', 'mlPredictionDetailList', 'mlPredictionDetailToggle'),
  toggleZodiacPredictionDetailCollapse: () => toggleCollapse('zodiacPredictionDetail', 'zodiacPredictionDetailList', 'zodiacPredictionDetailToggle'),
  
  // ========== 事件绑定 ==========
  bindEvents: () => {
    if (record._eventsBound) {
      console.log('[Record] 事件已绑定，跳过重复绑定');
      return;
    }
    record._eventsBound = true;
    
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const index = btn.dataset.index !== undefined ? parseInt(btn.dataset.index) : null;
      const mode = btn.dataset.mode;
      const count = btn.dataset.count;
      const period = btn.dataset.period;
      
      if (action === 'loadFavorite' && index !== null) record.loadFavorite(index);
      if (action === 'renameFavorite' && index !== null) record.renameFavorite(index);
      if (action === 'copyFavorite' && index !== null) record.copyFavorite(index);
      if (action === 'removeFavorite' && index !== null) record.removeFavorite(index);
      if (action === 'clearAllFavorites') record.clearAllFavorites();
      if (action === 'refreshPredictionStatistics') record.refreshPredictionStatistics();
      if (action === 'clearSelectedZodiacHistory') record.clearSelectedZodiacHistory();
      if (action === 'toggleSelectedZodiacDetailCollapse') record.toggleSelectedZodiacDetailCollapse();
      if (action === 'clearZodiacPredictionHistory') record.clearZodiacPredictionHistory();
      if (action === 'togglePredictionFiltersPanel') record.togglePredictionFiltersPanel();
      if (action === 'selectAllPredictionPeriods') record.selectAllPredictionPeriods();
      if (action === 'resetPredictionPeriods') record.resetPredictionPeriods();
      if (action === 'confirmPredictionFilters') record.confirmPredictionFilters();
      if (action === 'toggleZodiacPredictionHistory') record.toggleZodiacPredictionHistory();
      if (action === 'refreshMLPredictionHistory') record.refreshMLPredictionHistory();
      if (action === 'clearMLPredictionHistory') record.clearMLPredictionHistory();
      if (action === 'toggleMLPredictionHistory') record.toggleMLPredictionHistory();
      if (action === 'toggleMLPredictionDetailCollapse') record.toggleMLPredictionDetailCollapse();
      if (action === 'toggleZodiacPredictionDetailCollapse') record.toggleZodiacPredictionDetailCollapse();
      if (action === 'showDetailedStatistics') record.showDetailedStatistics(btn.dataset.type);
      if (action === 'clearSpecialHistory') record.clearSpecialHistory();
      if (action === 'toggleSpecialFiltersPanel') record.toggleSpecialFiltersPanel();
      if (action === 'confirmSpecialFilters') record.confirmSpecialFilters();
      if (action === 'switchSpecialHistoryMode' && mode) record.switchSpecialHistoryMode(mode);
      if (action === 'switchSpecialHistoryCount' && count !== undefined) record.switchSpecialHistoryCount(count);
      if (action === 'clearHotNumbersHistory') record.clearHotNumbersHistory();
      if (action === 'toggleSelectedZodiacCollapse') record.toggleSelectedZodiacCollapse();
      if (action === 'toggleSpecialCollapse') record.toggleSpecialCollapse();
      if (action === 'toggleSpecialDetailCollapse') record.toggleSpecialDetailCollapse();
      if (action === 'toggleHotNumbersCollapse') record.toggleHotNumbersCollapse();
      if (action === 'toggleHotNumbersDetailCollapse') record.toggleHotNumbersDetailCollapse();
    });
    
    // 期数按钮点击
    document.addEventListener('click', (e) => {
      const periodBtn = e.target.closest('.prediction-period-btn');
      if (!periodBtn || periodBtn.dataset.action) return;
      
      const period = periodBtn.dataset.period;
      if (!period) return;
      
      document.querySelectorAll('.prediction-period-btn').forEach(btn => btn.classList.remove('active'));
      periodBtn.classList.add('active');
      record._zodiacPredictionFilter.selectedPeriods = [period];
      record.renderZodiacPredictionHistory();
    });
    
    // 精选特码数量按钮点击
    document.addEventListener('click', (e) => {
      const numBtn = e.target.closest('.special-num-btn');
      if (!numBtn || numBtn.dataset.action) return;
      
      const numCount = numBtn.dataset.num;
      if (!numCount) return;
      
      document.querySelectorAll('.special-num-btn').forEach(btn => btn.classList.remove('active'));
      numBtn.classList.add('active');
      record._specialHistoryFilter.selectedNumCount = numCount;
      Storage.saveSpecialFilters({ numCount });
      record.renderSpecialHistory();
    });
    
    // localStorage变化监听
    window.addEventListener('storage', (event) => {
      if (!event.key) return;
      switch (event.key) {
        case 'favorites': record.renderFavoriteList(); break;
        case 'zodiacRecords': record.renderSelectedZodiacHistory(); record.renderZodiacPredictionHistory(); record.renderPredictionStatistics(); break;
        case 'mlPredictionRecords': record.renderMLPredictionHistory(); break;
        case Storage.KEYS.NUMBER_RECORDS: record.renderSpecialHistory(); break;
        case 'hotNumbersRecords': record.renderHotNumbersHistory(); break;
      }
    });
    
    // 页面可见性变化
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('[Record] 👁️ 页面变为可见，自动刷新所有数据...');
        record.renderAll();
        record.autoFetchAndCheck().catch(error => {
          console.error('[Record] 可见性变化时自动刷新失败:', error);
        });
      }
    });
    
    console.log('[Record] 事件绑定完成');
  },
  
  // ========== 滑动删除 ==========
  _bindSwipeDeleteToItem: (item, idx, type, deleteCallback) => {
    SwipeDeleteManager.bind(item, idx, type, deleteCallback);
  },
  _cleanupSwipeHandlers: (container) => {
    SwipeDeleteManager.cleanupContainer(container);
  },
  _unbindSwipeDelete: (item) => {
    SwipeDeleteManager.unbind(item);
  },
  
  // ========== 删除操作 ==========
  _deleteSelectedZodiacRecord: (index) => {
    try {
      const allRecords = Storage.get('zodiacRecords', []);
      if (!Array.isArray(allRecords)) return;
      
      const selectedRecords = allRecords.filter(r => r.recordType === 'selected');
      if (!selectedRecords[index]) return;
      
      const recordToRemove = selectedRecords[index];
      const filtered = allRecords.filter(r => !(r.recordType === 'selected' && r.createdAt === recordToRemove.createdAt));
      
      Storage.set('zodiacRecords', filtered);
      StateManager.setState({ analysis: { ...StateManager._state.analysis, zodiacRecords: filtered } }, false);
      record.renderSelectedZodiacHistory();
      record.renderPredictionStatistics();
      Toast.show('已删除记录');
    } catch (error) {
      console.error('[Record] 删除精选生肖记录失败:', error);
      Toast.show('删除失败，请重试');
    }
  },
  _deleteZodiacPredictionRecord: (issue) => {
    try {
      const allRecords = Storage.get('zodiacRecords', []);
      const filtered = allRecords.filter(r => !(r.issue === issue && (!r.recordType || r.recordType !== 'selected')));
      if (filtered.length === allRecords.length) return;
      
      Storage.set('zodiacRecords', filtered);
      StateManager.setState({ analysis: { ...StateManager._state.analysis, zodiacRecords: filtered } }, false);
      record.renderZodiacPredictionHistory();
      record.renderPredictionStatistics();
      Toast.show('已删除记录');
    } catch (error) {
      console.error('[Record] 删除生肖预测记录失败:', error);
      Toast.show('删除失败，请重试');
    }
  },
  _deleteMLPredictionRecord: (recordData) => {
    try {
      const mlRecords = Storage.get('mlPredictionRecords', []);
      const filtered = mlRecords.filter(r => r.issue !== recordData.issue);
      if (filtered.length === mlRecords.length) return;
      
      Storage.set('mlPredictionRecords', filtered);
      record.renderMLPredictionHistory();
      Toast.show('已删除记录');
    } catch (error) {
      console.error('[Record] 删除ML预测记录失败:', error);
      Toast.show('删除失败，请重试');
    }
  },
  _deleteSpecialRecord: (record) => {
    try {
      const numberRecords = Storage.get(Storage.KEYS.NUMBER_RECORDS, []);
      const filtered = numberRecords.filter(r => !(r.issue === record.issue && r.numCount === record.numCount));
      if (filtered.length === numberRecords.length) return;
      
      Storage.set(Storage.KEYS.NUMBER_RECORDS, filtered);
      record.renderSpecialHistory();
      Toast.show('已删除记录');
    } catch (error) {
      console.error('[Record] 删除精选特码记录失败:', error);
      Toast.show('删除失败，请重试');
    }
  },
  _deleteHotNumbersRecord: (issue) => {
    try {
      const hotRecords = Storage.get('hotNumbersRecords', []);
      const filtered = hotRecords.filter(r => r.issue !== issue);
      if (filtered.length === hotRecords.length) return;
      
      Storage.set('hotNumbersRecords', filtered);
      record.renderHotNumbersHistory();
      Toast.show('已删除记录');
    } catch (error) {
      console.error('[Record] 删除特码热门TOP5记录失败:', error);
      Toast.show('删除失败，请重试');
    }
  },
  
  // ========== 兼容 prediction.js 和 data-fetch.js ==========
  saveZodiacRecord: (recordData) => Storage.saveZodiacRecord(recordData),
  saveNumberRecord: (recordData) => Storage.saveNumberRecord(recordData),
  loadZodiacRecords: () => {
    record.renderZodiacPredictionHistory();
    record.renderSelectedZodiacHistory();
    record.renderPredictionStatistics();
  },
  showSelectedZodiacHistory: () => {
    const section = document.getElementById('selectedZodiacHistorySection');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  showZodiacPredictionHistory: () => {
    const section = document.querySelector('.card:has(#zodiacPredictionHistoryList)');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  showDetailedStatistics: (type) => {
    try {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      const content = document.createElement('div');
      content.className = 'modal-content';
      
      content.innerHTML = `
        <div class="modal-header">
          <h3 class="modal-title">${type === 'zodiac' ? '生肖预测' : '精选生肖'}详细统计</h3>
          <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom:20px;">
            <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--text);">选择统计周期</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn-mini period-btn active" data-period="10">10期</button>
              <button class="btn-mini period-btn" data-period="20">20期</button>
              <button class="btn-mini period-btn" data-period="30">30期</button>
              <button class="btn-mini period-btn" data-period="all">全年</button>
            </div>
          </div>
          <div id="statisticsContent" style="min-height:280px;padding-bottom:20px;">
            <div style="display:flex;justify-content:center;align-items:center;padding:40px;">
              <div style="text-align:center;">
                <div style="font-size:48px;margin-bottom:12px;">📊</div>
                <div style="font-size:16px;color:var(--sub-text);">请选择统计周期</div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      modal.appendChild(content);
      document.body.appendChild(modal);
      
      setTimeout(() => {
        modal.style.opacity = '1';
        content.style.transform = 'scale(1)';
      }, 10);
      
      setTimeout(() => {
        record.loadPeriodStatistics(type, '10', content.querySelector('#statisticsContent'));
      }, 100);
      
      const periodBtns = content.querySelectorAll('.period-btn');
      periodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          periodBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          record.loadPeriodStatistics(type, btn.dataset.period, content.querySelector('#statisticsContent'));
        });
      });
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.opacity = '0';
          content.style.transform = 'scale(0.9)';
          setTimeout(() => modal.remove(), 300);
        }
      });
    } catch (e) {
      console.error('显示详细统计失败', e);
      Toast.show('显示详情失败');
    }
  },
  loadPeriodStatistics: (type, period, container) => {
    try {
      container.innerHTML = `
        <div style="display:flex;justify-content:center;align-items:center;padding:40px;">
          <div style="text-align:center;">
            <div style="font-size:24px;margin-bottom:12px;">加载中...</div>
            <div style="font-size:14px;color:var(--sub-text);">正在分析数据</div>
          </div>
        </div>
      `;
      
      setTimeout(() => {
        const allRecords = Storage.get('zodiacRecords', []);
        let records = type === 'selected' 
          ? allRecords.filter(r => r.recordType === 'selected')
          : allRecords.filter(r => !r.recordType || r.recordType !== 'selected');
        
        if (period !== 'all') {
          const periodNum = parseInt(period);
          records = records.filter(r => r.checked === true)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, periodNum);
        } else {
          records = records.filter(r => r.checked === true);
        }
        
        let hit = 0, miss = 0;
        records.forEach(rec => {
          if (rec.matched === true) hit++;
          else if (rec.matched === false) miss++;
        });
        
        const total = records.length;
        const hitRate = hit + miss > 0 ? ((hit / (hit + miss)) * 100).toFixed(1) : '0.0';
        
        container.innerHTML = `
          <div style="margin-bottom:20px;padding:16px;background:linear-gradient(135deg, var(--primary) 0%, #0051d5 100%);border-radius:12px;color:white;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:14px;font-weight:600;">周期统计概览</span>
              <span style="font-size:14px;">${period === 'all' ? '全年' : period + '期'}</span>
            </div>
          </div>
          <div style="margin-bottom:20px;">
            <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--text);">关键指标</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(120px, 1fr));gap:12px;">
              <div style="background:var(--card);border-radius:8px;padding:12px;border:1px solid var(--border);">
                <div style="font-size:12px;color:var(--sub-text);margin-bottom:4px;">总记录</div>
                <div style="font-size:18px;font-weight:600;color:var(--text);">${total}</div>
              </div>
              <div style="background:var(--card);border-radius:8px;padding:12px;border:1px solid var(--border);">
                <div style="font-size:12px;color:var(--sub-text);margin-bottom:4px;">命中</div>
                <div style="font-size:18px;font-weight:600;color:var(--green);">${hit}</div>
              </div>
              <div style="background:var(--card);border-radius:8px;padding:12px;border:1px solid var(--border);">
                <div style="font-size:12px;color:var(--sub-text);margin-bottom:4px;">未中</div>
                <div style="font-size:18px;font-weight:600;color:var(--danger);">${miss}</div>
              </div>
              <div style="background:var(--card);border-radius:8px;padding:12px;border:1px solid var(--border);">
                <div style="font-size:12px;color:var(--sub-text);margin-bottom:4px;">命中率</div>
                <div style="font-size:18px;font-weight:600;color:var(--primary);">${hitRate}%</div>
              </div>
            </div>
          </div>
          <div>
            <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--text);">详细数据</div>
            <div style="background:var(--card);border-radius:8px;padding:16px;border:1px solid var(--border);">
              <div style="font-size:13px;color:var(--sub-text);text-align:center;padding:20px;">
                ${total > 0 ? `共 ${total} 条记录，命中 ${hit} 次，未中 ${miss} 次` : '暂无数据'}
              </div>
            </div>
          </div>
        `;
      }, 300);
    } catch (e) {
      console.error('加载统计数据失败', e);
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger);">加载失败，请重试</div>';
    }
  }
};

// 页面加载完成后启动应用
window.addEventListener('DOMContentLoaded', () => {
  record.init();
});

export default record;
