// ====================== 应用入口模块 ======================

// 导入所有必要的模块
import { Render } from './render.js';
import { DataQuery } from './data-query.js';
import { Storage } from './storage.js';
import { StateManager } from './state-manager.js';
import { Business } from './business/index.js';
import { EventBinder } from './event-binder.js';
import { Toast } from './toast.js';
import { CONFIG } from './config.js';
import { Utils } from './utils.js';
import { PerformanceMonitor } from './performance-monitor.js';
import { ErrorHandler } from './error-handler.js';
import { Router } from './router.js';
import { core } from './business/core.js';
import { record } from './business/record.js';
import { DOM } from './dom.js';

/**
 * 应用初始化
 */
async function initApp() {
  PerformanceMonitor.init();
  DOM.init();
  
  // 并行初始化不需要依赖的模块
  Promise.all([
    Render.buildZodiacCycle(),
    Render.buildNumList(),
    DataQuery.init(),
    Render.renderZodiacTags(),
    Render.renderExcludeGrid()
  ]).catch(e => console.warn('并行初始化失败:', e));
  
  try {
    Storage.loadSavedFilters();
    Storage.loadFavorites();
    Render.renderFilterList();
    Render.renderResult();
  } catch(e) { console.warn('初始UI渲染失败:', e); }
  
  Utils.initSwipeHandlers();
  EventBinder.init();
  Router.init();
  
  const cache = Storage.loadHistoryCache();
  
  // 立即渲染缓存数据，提高首屏加载速度
  if(cache.data && cache.data.length > 0) {
    StateManager.setState({ analysis: { ...StateManager._state.analysis, historyData: cache.data } }, false);
    // 并行渲染多个组件
    Promise.allSettled([
      Business.renderLatest(cache.data[0]),
      Business.renderHistory(),
      Business.renderFullAnalysis(),
      Business.renderZodiacAnalysis(),
      Business.updateHotColdStatus()
    ]);
    // 后台静默刷新数据
    setTimeout(() => Business.silentRefreshHistory(), 100);
  } else {
    setTimeout(() => Business.refreshHistory(true), 100);
  }
  
  // 减少延时时间并合并定时任务
  setTimeout(() => {
    Promise.allSettled([
      Business.startCountdown(),
      Business.checkDrawTimeLoop(),
      Business.startScheduledDataFetch(),
      Business.initAnalysisPage()
    ]);
  }, 200); // 从300ms和600ms减少到200ms
  
  // 延迟初始化 record 页面（只在需要时加载）
  setTimeout(() => {
    try {
      Business.record.init();
    } catch(e) {
      console.warn('Record 初始化失败:', e);
    }
  }, 500); // 延迟500ms再初始化 record，让首屏更快显示
  
  const bottomNav = document.querySelector('.bottom-nav');
  if(bottomNav) bottomNav.classList.add('needs-space');
  
  Render.hideLoading();
  
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible') {
      setTimeout(() => { try { Business.silentRefreshHistory(); } catch(e) {} }, 300);
    }
  });
  
  console.log('应用初始化完成');
  PerformanceMonitor.logMetrics();
}

// 为了兼容原 HTML 中的内联 onclick，将 Business、Router 和 record 挂载到 window
window.Business = Business;
window.Router = Router;
window.record = record;

// 导出core模块的方法到Business对象
Object.assign(Business, {
  toggleExclude: core.toggleExclude,
  invertExclude: core.invertExclude,
  undoExclude: core.undoExclude,
  clearExclude: core.clearExclude,
  batchExcludePrompt: core.batchExcludePrompt,
  saveFilterPrompt: core.saveFilterPrompt,
  loadFilter: core.loadFilter,
  renameFilter: core.renameFilter,
  copyFilterNums: core.copyFilterNums,
  topFilter: core.topFilter,
  deleteFilter: core.deleteFilter,
  favoriteFilter: core.favoriteFilter,
  loadFavorite: core.loadFavorite,
  renameFavorite: core.renameFavorite,
  copyFavorite: core.copyFavorite,
  toggleShowAllFilters: core.toggleShowAllFilters,
  switchBottomNav: core.switchBottomNav,
  toggleQuickNav: core.toggleQuickNav,
  scrollToModule: core.scrollToModule,
  copyHotNumbers: core.copyHotNumbers,
  copyZodiacNumbers: core.copyZodiacNumbers
});

// 修复事件绑定中的导航操作，让它能够正确处理 data-index 属性
if (EventBinder && EventBinder.handleGlobalClick) {
  const originalHandleGlobalClick = EventBinder.handleGlobalClick;
  EventBinder.handleGlobalClick = (e) => {
    const target = e.target;
    const actionBtn = target.closest('[data-action]');
    if(actionBtn && actionBtn.dataset.action === 'switchBottomNav') {
      // 优先使用 data-index
      if(actionBtn.dataset.index) {
        Business.switchBottomNav(Number(actionBtn.dataset.index));
        return;
      }
    }
    originalHandleGlobalClick(e);
  };
}

if (!Business.toggleQuickNav) {
  Business.toggleQuickNav = (force) => {
    const quickNavMenu = document.getElementById('quickNavMenu');
    if(quickNavMenu) {
      if(force === true) {
        quickNavMenu.classList.add('show');
      } else if(force === false) {
        quickNavMenu.classList.remove('show');
      } else {
        quickNavMenu.classList.toggle('show');
      }
    }
  };
}

if (!Business.silentSaveAllSpecialCombinations) {
  Business.silentSaveAllSpecialCombinations = () => {
    try {
      // 获取精选特码数据
      const state = StateManager._state;
      const selected = state.selected || [];
      
      if (selected.length > 0) {
        // 获取当前期号
        let issue = '';
        const conclusionTitle = document.querySelector('.conclusion-title');
        if (conclusionTitle) {
          const titleText = conclusionTitle.textContent || conclusionTitle.innerText;
          const issueMatch = titleText.match(/第(\d+)期/);
          if (issueMatch && issueMatch[1]) {
            issue = issueMatch[1];
          }
        }
        
        if (issue) {
          // ✅ 获取当前筛选条件
          const period = state.analysis?.analyzeLimit || 10;
          const numCount = state.analysis?.selectedNumCount || selected.length;
          
          // 保存到历史记录
          Storage.saveNumberRecord({
            issue: issue,
            period: period,           // ✅ 期数范围
            numCount: numCount,       // ✅ 号码数量
            numbers: selected,
            recordType: 'special'
          });
          console.log('后台静默保存精选特码组合成功:', { issue, period, numCount, count: selected.length });
        }
      }
    } catch(e) {
      console.error('后台静默保存精选特码失败:', e);
    }
  };
}

if (!Business.silentSaveAllSelectedZodiacs) {
  Business.silentSaveAllSelectedZodiacs = () => {
    try {
      console.log('后台静默保存精选生肖');
    } catch(e) {
      console.error('后台静默保存精选生肖失败:', e);
    }
  };
}

if (!Business.silentSaveHotNumbers) {
  Business.silentSaveHotNumbers = () => {
    try {
      // 获取特码热门TOP5数据
      const hotNumberEl = document.getElementById('zodiacFinalNumContent');
      if(hotNumberEl) {
        // 提取热门号码
        const numbers = [];
        const balls = hotNumberEl.querySelectorAll('.num-ball');
        balls.forEach(ball => {
          const num = ball.textContent.trim();
          if (num && !isNaN(num)) {
            numbers.push(parseInt(num));
          }
        });
        
        if (numbers.length > 0) {
          // 获取当前期号
          let issue = '';
          const conclusionTitle = document.querySelector('.conclusion-title');
          if (conclusionTitle) {
            const titleText = conclusionTitle.textContent || conclusionTitle.innerText;
            const issueMatch = titleText.match(/第(\d+)期/);
            if (issueMatch && issueMatch[1]) {
              issue = issueMatch[1];
            }
          }
          
          if (issue) {
            // 保存到历史记录
            Storage.saveHotNumbersRecord({
              issue: issue,
              numbers: numbers,
              analyzeLimit: 10 // 默认分析10期数据
            });
            console.log('后台静默保存特码热门TOP5成功:', numbers);
          }
        }
      }
    } catch(e) {
      console.error('后台静默保存特码热门TOP5失败:', e);
    }
  };
}

if (!Business.scrollToModule) {
  Business.scrollToModule = (targetId) => {
    try {
      const element = document.getElementById(targetId);
      if(element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } catch(e) {
      console.error('滚动到指定模块失败:', e);
    }
  };
}

if (!Business.toggleExclude) {
  Business.toggleExclude = (num) => {
    try {
      const state = StateManager._state;
      if(state.lockExclude) return;

      const newExcluded = [...state.excluded];
      const newHistory = [...state.excludeHistory];

      if(newExcluded.includes(num)){
        newHistory.push([num, 'out']);
        const index = newExcluded.indexOf(num);
        newExcluded.splice(index, 1);
      } else {
        newHistory.push([num, 'in']);
        newExcluded.push(num);
      }

      StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
    } catch(e) {
      console.error('切换号码排除状态失败:', e);
    }
  };
}

if (!Business.saveFilterPrompt) {
  Business.saveFilterPrompt = () => {
    try {
      const name = prompt('请输入方案名称:');
      if(!name || !name.trim()) return;

      const state = StateManager._state;
      
      // 获取最新的期号
      let issueNumber = null;
      const historyData = state?.analysis?.historyData || [];
      if (historyData.length > 0) {
        const latestIssue = historyData[0]?.expect;
        if (latestIssue) {
          // 确保期号是6位数字格式
          const issueStr = String(latestIssue).padStart(6, '0');
          if (/^\d{6}$/.test(issueStr)) {
            issueNumber = issueStr;
          }
        }
      }

      const filterItem = {
        name: name.trim(),
        selected: Utils.deepClone(state.selected),
        excluded: [...state.excluded],
        timestamp: Date.now(),
        issueNumber: issueNumber
      };

      const success = Storage.saveFilter(filterItem);
      if(success) {
        Toast.show('方案保存成功');
      } else {
        Toast.show('方案保存失败');
      }
    } catch(e) {
      console.error('保存方案失败:', e);
      Toast.show('保存方案失败');
    }
  };
}

if (!Business.invertExclude) {
  Business.invertExclude = () => {
    try {
      const state = StateManager._state;
      if(state.lockExclude) return;

      const allNums = Array.from({length: 49}, (_, i) => i + 1);
      const newExcluded = allNums.filter(num => !state.excluded.includes(num));
      const newHistory = [...state.excludeHistory, ...newExcluded.map(num => [num, 'in'])];

      StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
    } catch(e) {
      console.error('反选排除号码失败:', e);
    }
  };
}

if (!Business.undoExclude) {
  Business.undoExclude = () => {
    try {
      const state = StateManager._state;
      if(state.lockExclude || state.excludeHistory.length === 0) return;

      const lastAction = state.excludeHistory.pop();
      const [num, action] = lastAction;
      const newExcluded = [...state.excluded];

      if(action === 'in') {
        const index = newExcluded.indexOf(num);
        if(index > -1) newExcluded.splice(index, 1);
      } else {
        newExcluded.push(num);
      }

      StateManager.setState({ excluded: newExcluded, excludeHistory: state.excludeHistory });
    } catch(e) {
      console.error('撤销排除号码失败:', e);
    }
  };
}

if (!Business.batchExcludePrompt) {
  Business.batchExcludePrompt = () => {
    try {
      const input = prompt('请输入要排除的号码，用逗号分隔:');
      if(!input) return;

      const nums = input.split(',').map(n => Number(n.trim())).filter(n => !isNaN(n) && n >= 1 && n <= 49);
      if(nums.length === 0) return;

      const state = StateManager._state;
      const newExcluded = [...state.excluded];
      const newHistory = [...state.excludeHistory];

      nums.forEach(num => {
        if(!newExcluded.includes(num)) {
          newExcluded.push(num);
          newHistory.push([num, 'in']);
        }
      });

      StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
    } catch(e) {
      console.error('批量排除号码失败:', e);
    }
  };
}

if (!Business.clearExclude) {
  Business.clearExclude = () => {
    try {
      StateManager.setState({ excluded: [], excludeHistory: [] });
    } catch(e) {
      console.error('清除排除号码失败:', e);
    }
  };
}

if (!Business.toggleShowAllFilters) {
  Business.toggleShowAllFilters = () => {
    try {
      const state = StateManager._state;
      StateManager.setState({ showAllFilters: !state.showAllFilters });
    } catch(e) {
      console.error('切换显示所有方案失败:', e);
    }
  };
}

if (!Business.loadFilter) {
  Business.loadFilter = (index) => {
    try {
      const state = StateManager._state;
      const filterItem = state.savedFilters[index];
      if(!filterItem) return;

      StateManager.setState({ selected: filterItem.selected, excluded: filterItem.excluded });
    } catch(e) {
      console.error('加载方案失败:', e);
    }
  };
}

if (!Business.renameFilter) {
  Business.renameFilter = (index) => {
    try {
      const state = StateManager._state;
      const filterItem = state.savedFilters[index];
      if(!filterItem) return;

      const newName = prompt('请输入新的方案名称:', filterItem.name);
      if(!newName || !newName.trim()) return;

      filterItem.name = newName.trim();
      Storage.set(Storage.KEYS.SAVED_FILTERS, state.savedFilters);
      StateManager.setState({ savedFilters: state.savedFilters });
    } catch(e) {
      console.error('重命名方案失败:', e);
    }
  };
}

if (!Business.copyFilterNums) {
  Business.copyFilterNums = (index) => {
    try {
      const state = StateManager._state;
      const filterItem = state.savedFilters[index];
      if(!filterItem) return;

      StateManager.setState({ selected: filterItem.selected, excluded: filterItem.excluded });
    } catch(e) {
      console.error('复制方案号码失败:', e);
    }
  };
}

if (!Business.topFilter) {
  Business.topFilter = (index) => {
    try {
      const state = StateManager._state;
      const filterItem = state.savedFilters[index];
      if(!filterItem) return;

      const newList = [filterItem, ...state.savedFilters.filter((_, i) => i !== index)];
      Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
      StateManager.setState({ savedFilters: newList });
    } catch(e) {
      console.error('置顶方案失败:', e);
    }
  };
}

if (!Business.deleteFilter) {
  Business.deleteFilter = (index) => {
    try {
      if(!confirm("确定删除该方案？")) return;
      const state = StateManager._state;
      const newList = [...state.savedFilters];
      newList.splice(index, 1);
      const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
      
      if(success){
        StateManager.setState({ savedFilters: newList }, false);
        Render.renderFilterList();
        Toast.show('删除成功');
      }
    } catch(e) {
      console.error('删除方案失败:', e);
      Toast.show('删除失败');
    }
  };
}

if (!Business.favoriteFilter) {
  Business.favoriteFilter = (index) => {
    try {
      const state = StateManager._state;
      const filterItem = state.savedFilters[index];
      if(!filterItem) return;

      const favorites = Storage.get('favorites', []);
      favorites.push(filterItem);
      Storage.set('favorites', favorites);
      StateManager.setState({ favorites: favorites });
      window.dispatchEvent(new StorageEvent('storage', { key: 'favorites' }));
    } catch(e) {
      console.error('收藏方案失败:', e);
    }
  };
}

if (!Business.loadFavorite) {
  Business.loadFavorite = (index) => {
    try {
      const state = StateManager._state;
      const favoriteItem = state.favorites[index];
      if(!favoriteItem) return;

      StateManager.setState({ selected: favoriteItem.selected, excluded: favoriteItem.excluded });
    } catch(e) {
      console.error('加载收藏方案失败:', e);
    }
  };
}

if (!Business.renameFavorite) {
  Business.renameFavorite = (index) => {
    try {
      const state = StateManager._state;
      const favoriteItem = state.favorites[index];
      if(!favoriteItem) return;

      const newName = prompt('请输入新的收藏名称:', favoriteItem.name);
      if(!newName || !newName.trim()) return;

      favoriteItem.name = newName.trim();
      Storage.set('favorites', state.favorites);
      StateManager.setState({ favorites: state.favorites });
    } catch(e) {
      console.error('重命名收藏方案失败:', e);
    }
  };
}

if (!Business.copyFavorite) {
  Business.copyFavorite = (index) => {
    try {
      const state = StateManager._state;
      const favoriteItem = state.favorites[index];
      if(!favoriteItem) return;

      StateManager.setState({ selected: favoriteItem.selected, excluded: favoriteItem.excluded });
    } catch(e) {
      console.error('复制收藏方案号码失败:', e);
    }
  };
}

if (!Business.syncZodiacAnalyze) {
  Business.syncZodiacAnalyze = () => {
    try {
      console.log('同步生肖分析');
    } catch(e) {
      console.error('同步生肖分析失败:', e);
    }
  };
}

if (!Business.toggleDetail) {
  Business.toggleDetail = (targetId) => {
    try {
      const targetElementId = targetId || 'detailPanel';
      const detailPanel = document.getElementById(targetElementId);
      if(detailPanel) {
        detailPanel.classList.toggle('show');
        // 同时更新按钮文本
        const button = document.querySelector(`[data-action="toggleDetail"][data-target="${targetElementId}"]`);
        if(button) {
          if(detailPanel.classList.contains('show')) {
            button.textContent = '收起详情';
          } else {
            button.textContent = '展开详情';
          }
        }
      }
    } catch(e) {
      console.error('切换详情失败:', e);
    }
  };
}

if (!Business.loadMoreHistory) {
  Business.loadMoreHistory = () => {
    try {
      console.log('加载更多历史数据');
    } catch(e) {
      console.error('加载更多历史数据失败:', e);
    }
  };
}

if (!Business.copyHotNumbers) {
  Business.copyHotNumbers = () => {
    try {
      console.log('复制热门号码');
    } catch(e) {
      console.error('复制热门号码失败:', e);
    }
  };
}

if (!Business.copyZodiacNumbers) {
  Business.copyZodiacNumbers = () => {
    try {
      console.log('复制生肖号码');
    } catch(e) {
      console.error('复制生肖号码失败:', e);
    }
  };
}

if (!Business.favoriteZodiacNumbers) {
  Business.favoriteZodiacNumbers = () => {
    try {
      console.log('收藏生肖号码');
    } catch(e) {
      console.error('收藏生肖号码失败:', e);
    }
  };
}

if (!Business.refreshHotCold) {
  Business.refreshHotCold = () => {
    try {
      console.log('刷新冷热状态');
    } catch(e) {
      console.error('刷新冷热状态失败:', e);
    }
  };
}

if (!Business.selectAllPredictionPeriods) {
  Business.selectAllPredictionPeriods = () => {
    try {
      console.log('全选预测历史期数');
    } catch(e) {
      console.error('全选预测历史期数失败:', e);
    }
  };
}

if (!Business.resetPredictionPeriods) {
  Business.resetPredictionPeriods = () => {
    try {
      console.log('重置预测历史期数');
    } catch(e) {
      console.error('重置预测历史期数失败:', e);
    }
  };
}

if (!Business.togglePredictionFiltersPanel) {
  Business.togglePredictionFiltersPanel = () => {
    try {
      console.log('切换预测历史筛选面板');
    } catch(e) {
      console.error('切换预测历史筛选面板失败:', e);
    }
  };
}

if (!Business.confirmPredictionFilters) {
  Business.confirmPredictionFilters = () => {
    try {
      console.log('确认预测历史筛选条件');
    } catch(e) {
      console.error('确认预测历史筛选条件失败:', e);
    }
  };
}



if (!Business.checkAndUpdatePredictionStatus) {
  Business.checkAndUpdatePredictionStatus = () => {
    try {
      console.log('检查并更新预测状态');
    } catch(e) {
      console.error('检查并更新预测状态失败:', e);
    }
  };
}

if (!Business.updateSelectedZodiacHistoryComparison) {
  Business.updateSelectedZodiacHistoryComparison = () => {
    try {
      console.log('更新精选生肖历史比较');
    } catch(e) {
      console.error('更新精选生肖历史比较失败:', e);
    }
  };
}

if (!Business.renderPredictionStatistics) {
  Business.renderPredictionStatistics = () => {
    try {
      console.log('渲染预测统计');
    } catch(e) {
      console.error('渲染预测统计失败:', e);
    }
  };
}

if (!Business.renderSelectedZodiacHistory) {
  Business.renderSelectedZodiacHistory = () => {
    try {
      console.log('渲染精选生肖历史');
    } catch(e) {
      console.error('渲染精选生肖历史失败:', e);
    }
  };
}

if (!Business.toggleMLPredictionHistory) {
  Business.toggleMLPredictionHistory = () => {
    try {
      console.log('切换ML预测历史展开/折叠');
    } catch(e) {
      console.error('切换ML预测历史展开/折叠失败:', e);
    }
  };
}

if (!Business.renderMLPredictionHistory) {
  Business.renderMLPredictionHistory = () => {
    try {
      console.log('渲染ML预测历史');
    } catch(e) {
      console.error('渲染ML预测历史失败:', e);
    }
  };
}

if (!Business.toggleSpecialHistory) {
  Business.toggleSpecialHistory = () => {
    try {
      console.log('切换精选特码历史展开/折叠');
    } catch(e) {
      console.error('切换精选特码历史展开/折叠失败:', e);
    }
  };
}

if (!Business.toggleSpecialFiltersPanel) {
  Business.toggleSpecialFiltersPanel = () => {
    try {
      console.log('切换精选特码历史筛选面板');
    } catch(e) {
      console.error('切换精选特码历史筛选面板失败:', e);
    }
  };
}

if (!Business.confirmSpecialFilters) {
  Business.confirmSpecialFilters = () => {
    try {
      console.log('确认精选特码历史筛选条件');
    } catch(e) {
      console.error('确认精选特码历史筛选条件失败:', e);
    }
  };
}

if (!Business.switchSpecialHistoryMode) {
  Business.switchSpecialHistoryMode = (mode) => {
    try {
      console.log('切换精选特码历史模式筛选:', mode);
    } catch(e) {
      console.error('切换精选特码历史模式筛选失败:', e);
    }
  };
}

if (!Business.showStreakDetail) {
  Business.showStreakDetail = (streakType) => {
    try {
      console.log('显示连出详情:', streakType);
    } catch(e) {
      console.error('显示连出详情失败:', e);
    }
  };
}

if (!Business.showStatDetail) {
  Business.showStatDetail = (statType) => {
    try {
      console.log('显示统计详情:', statType);
    } catch(e) {
      console.error('显示统计详情失败:', e);
    }
  };
}

if (!Business.switchSpecialMode) {
  Business.switchSpecialMode = (mode) => {
    try {
      console.log('切换精选特码模式:', mode);
    } catch(e) {
      console.error('切换精选特码模式失败:', e);
    }
  };
}

if (!Business.toggleSelectedZodiacHistory) {
  Business.toggleSelectedZodiacHistory = () => {
    try {
      console.log('切换精选生肖历史展开/折叠');
    } catch(e) {
      console.error('切换精选生肖历史展开/折叠失败:', e);
    }
  };
}

if (!Business.toggleHotNumbersHistory) {
  Business.toggleHotNumbersHistory = () => {
    try {
      console.log('切换特码热门top5历史展开/折叠');
    } catch(e) {
      console.error('切换特码热门top5历史展开/折叠失败:', e);
    }
  };
}

if (!Business.switchHotNumbersHistoryPage) {
  Business.switchHotNumbersHistoryPage = (page) => {
    try {
      console.log('切换特码热门top5历史页码:', page);
    } catch(e) {
      console.error('切换特码热门top5历史页码失败:', e);
    }
  };
}



if (!Business.showZodiacDetail) {
  Business.showZodiacDetail = (zodiac) => {
    try {
      console.log('显示生肖详情:', zodiac);
    } catch(e) {
      console.error('显示生肖详情失败:', e);
    }
  };
}











// 页面加载完成后启动应用
window.addEventListener('DOMContentLoaded', initApp);
