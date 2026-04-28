// ====================== 10. 事件绑定模块（统一事件管理，支持键盘/触摸）======================

// 导入必要的模块
import { Business } from './business/index.js';
import { DOM } from './dom.js';
import { Utils } from './utils.js';
import { CONFIG } from './config.js';
import { StateManager } from './state-manager.js';
import { DataQuery } from './data-query.js';
import { Filter } from './filter.js';
import { Toast } from './toast.js';

const _actionHandlers = new Map();
const _debouncedActions = new Set();

const registerAction = (action, handler) => _actionHandlers.set(action, handler);

export const EventBinder = {
  /**
   * 初始化所有事件绑定
   */
  // 触摸滑动相关状态
  _touchStartX: 0,
  _touchStartY: 0,
  _touchEndX: 0,
  _touchEndY: 0,
  _minSwipeDistance: 50,
  _edgeSwipeWidth: 30,
  
  // 下拉刷新相关状态
  _pullStartY: 0,
  _pullCurrentY: 0,
  _isPulling: false,
  _pullThreshold: 80,
  _maxPullDistance: 150,

  init: () => {
    document.addEventListener('click', EventBinder.handleGlobalClick);
    document.addEventListener('change', EventBinder.handleGlobalChange);
    document.addEventListener('keydown', EventBinder.handleKeyDown);
    window.addEventListener('scroll', Business.handleScroll);
    document.addEventListener('click', EventBinder.handleClickOutside);
    window.addEventListener('beforeunload', Business.handlePageUnload);
    window.addEventListener('error', EventBinder.handleGlobalError);
    
    document.addEventListener('touchstart', EventBinder.handleTouchStart, { passive: true });
    document.addEventListener('touchend', EventBinder.handleTouchEnd, { passive: true });
    
    const pullContainer = document.getElementById('analysisPullContainer');
    if(pullContainer) {
      pullContainer.addEventListener('touchstart', EventBinder.handlePullStart, { passive: false });
      pullContainer.addEventListener('touchmove', EventBinder.handlePullMove, { passive: false });
      pullContainer.addEventListener('touchend', EventBinder.handlePullEnd, { passive: true });
    }
    
    const recordPullContainer = document.getElementById('recordPullContainer');
    if(recordPullContainer) {
      recordPullContainer.addEventListener('touchstart', EventBinder.handleRecordPullStart, { passive: false });
      recordPullContainer.addEventListener('touchmove', EventBinder.handleRecordPullMove, { passive: false });
      recordPullContainer.addEventListener('touchend', EventBinder.handleRecordPullEnd, { passive: true });
    }

    const analyzeSelect = document.getElementById('analyzeSelect');
    if(analyzeSelect) {
      analyzeSelect.addEventListener('change', function() {
        Business.syncAnalyze();
      });
    }
    
    const zodiacAnalyzeSelect = document.getElementById('zodiacAnalyzeSelect');
    if(zodiacAnalyzeSelect) {
      zodiacAnalyzeSelect.addEventListener('change', function() {
        Business.syncZodiacAnalyze();
      });
    }
    
    const numCountSelect = document.getElementById('numCountSelect');
    const customNumCount = document.getElementById('customNumCount');
    
    if(numCountSelect) {
      numCountSelect.addEventListener('change', function() {
        const isCustom = this.value === 'custom';
        if(customNumCount) customNumCount.style.display = isCustom ? 'inline-block' : 'none';
        if(!isCustom) {
          const newAnalysis = { 
            ...StateManager._state.analysis, 
            selectedNumCount: Number(this.value)
          };
          StateManager.setState({ analysis: newAnalysis }, false);
          Business.renderZodiacAnalysis();
        }
      });
    }
    
    if(customNumCount) {
      customNumCount.addEventListener('input', function() {
        const val = this.value.trim();
        if(val && !isNaN(val) && Number(val) >= 1 && Number(val) <= 49) {
          const newAnalysis = { 
            ...StateManager._state.analysis, 
            selectedNumCount: Number(val)
          };
          StateManager.setState({ analysis: newAnalysis }, false);
          Business.renderZodiacAnalysis();
        }
      });
    }
  },

  /**
   * 全局点击处理
   * @param {MouseEvent} e - 点击事件
   */
  handleGlobalClick: (e) => {
    const target = e.target;

    // 1. 筛选标签点击
    const tag = target.closest('.tag[data-group]');
    if(tag){
      const group = tag.dataset.group;
      const rawValue = tag.dataset.value;
      const value = Utils.formatTagValue(rawValue, group);
      StateManager.updateSelected(group, value);
      return;
    }

    // 2. 排除号码点击
    const excludeTag = target.closest('.exclude-tag[data-num]');
    if(excludeTag){
      Business.toggleExclude(Number(excludeTag.dataset.num));
      return;
    }

    // 3. 快捷导航模块跳转
    const navTab = target.closest('.nav-tab[data-target]');
    if(navTab){
      const targetId = navTab.dataset.target;
      
      // 检查是否是分析页面的快捷导航
      if (targetId === 'zodiacAnalysisPanel' || targetId === 'analysisPanelContent' || targetId === 'historyPanel') {
        // 映射目标ID到分析标签
        const tabMap = {
          'zodiacAnalysisPanel': 'zodiac',
          'analysisPanelContent': 'analysis',
          'historyPanel': 'history'
        };
        
        const tab = tabMap[targetId];
        if (tab) {
          Business.switchAnalysisTab(tab);
        }
      } else {
        // 其他页面的快捷导航 - 滚动到模块
        console.log('滚动到模块:', targetId);
        const element = document.getElementById(targetId);
        console.log('目标元素是否存在:', !!element);
        if (element) {
          console.log('目标元素位置:', element.getBoundingClientRect());
          Business.scrollToModule(targetId);
        }
      }
      
      // 点击后关闭快捷导航菜单
      Business.toggleQuickNav(false);
      return;
    }

    // 4. 快捷导航开关
    if(target === DOM.quickNavBtn || target.closest('#quickNavBtn')){
      Business.toggleQuickNav();
      return;
    }

    // 5. 返回顶部
    if(target === DOM.backTopBtn){
      Business.backToTop();
      return;
    }

    // 6. 按钮动作处理（用枚举避免硬编码错误）
    const actionBtn = target.closest('[data-action]');
    if(actionBtn){
      const action = actionBtn.dataset.action;
      const group = actionBtn.dataset.group;
      const index = actionBtn.dataset.index;
      
      // 分组操作
      if(action === CONFIG.ACTIONS.RESET_GROUP) {
        // 检查是否是大小单双卡片，需要操作所有相关分组
        const card = actionBtn.closest('.card');
        if (card && card.id === 'mod-bs') {
          // 大小单双卡片：操作所有相关分组（bs、sumOdd、sumBig、tailBig）
          ['bs', 'sumOdd', 'sumBig', 'tailBig'].forEach(g => {
            StateManager.resetGroup(g);
          });
          console.log('[EventBinder] 大小单双卡片：已清除所有分组');
        } else {
          StateManager.resetGroup(group);
        }
      }
      if(action === CONFIG.ACTIONS.SELECT_GROUP) StateManager.selectGroup(group);
      if(action === CONFIG.ACTIONS.INVERT_GROUP) {
        // 检查是否是大小单双卡片，需要操作所有相关分组
        const card = actionBtn.closest('.card');
        if (card && card.id === 'mod-bs') {
          // 大小单双卡片：操作所有相关分组（bs、sumOdd、sumBig、tailBig）
          ['bs', 'sumOdd', 'sumBig', 'tailBig'].forEach(g => {
            StateManager.invertGroup(g);
          });
          console.log('[EventBinder] 大小单双卡片：已反选所有分组');
        } else {
          StateManager.invertGroup(group);
        }
      }
      if(action === CONFIG.ACTIONS.CLEAR_GROUP) {
        // 检查是否是大小单双卡片，需要操作所有相关分组
        const card = actionBtn.closest('.card');
        if (card && card.id === 'mod-bs') {
          // 大小单双卡片：操作所有相关分组（bs、sumOdd、sumBig、tailBig）
          ['bs', 'sumOdd', 'sumBig', 'tailBig'].forEach(g => {
            StateManager.resetGroup(g);
          });
          console.log('[EventBinder] 大小单双卡片：已清除所有分组');
        } else {
          StateManager.resetGroup(group);
        }
      }
      // 全局操作
      if(action === CONFIG.ACTIONS.SELECT_ALL) Filter.selectAllFilters();
      if(action === CONFIG.ACTIONS.CLEAR_ALL) Filter.clearAllFilters();
      if(action === CONFIG.ACTIONS.SAVE_FILTER) Business.saveFilterPrompt();
      // 排除号码操作
      if(action === CONFIG.ACTIONS.INVERT_EXCLUDE) Business.invertExclude();
      if(action === CONFIG.ACTIONS.UNDO_EXCLUDE) Business.undoExclude();
      if(action === CONFIG.ACTIONS.BATCH_EXCLUDE) Business.batchExcludePrompt();
      if(action === CONFIG.ACTIONS.CLEAR_EXCLUDE) Business.clearExclude();
      // 方案操作
      if(action === CONFIG.ACTIONS.TOGGLE_SHOW_ALL) Business.toggleShowAllFilters();
      if(action === CONFIG.ACTIONS.LOAD_FILTER) Business.loadFilter(Number(index));
      if(action === CONFIG.ACTIONS.RENAME_FILTER) Business.renameFilter(Number(index));
      if(action === CONFIG.ACTIONS.COPY_FILTER) Business.copyFilterNums(Number(index));
      if(action === CONFIG.ACTIONS.TOP_FILTER) Business.topFilter(Number(index));
      if(action === CONFIG.ACTIONS.DELETE_FILTER) Business.deleteFilter(Number(index));
      // 收藏操作
      if(action === CONFIG.ACTIONS.FAVORITE_FILTER) Business.favoriteFilter(Number(index));
      if(action === CONFIG.ACTIONS.LOAD_FAVORITE) Business.loadFavorite(Number(index));
      if(action === CONFIG.ACTIONS.RENAME_FAVORITE) Business.renameFavorite(Number(index));
      if(action === CONFIG.ACTIONS.COPY_FAVORITE) Business.copyFavorite(Number(index));
      // 导航操作
      if (action === CONFIG.ACTIONS.SWITCH_NAV) {
        const targetIndex = actionBtn.dataset.index;
        if (targetIndex !== undefined) {
          Business.switchBottomNav(Number(targetIndex));
        }
        return;
      }
      // 我的页面菜单操作
      if(action === CONFIG.ACTIONS.OPEN_SETTINGS) Business.openSettings();
      if(action === CONFIG.ACTIONS.OPEN_NOTIFICATION) Business.openNotification();
      if(action === CONFIG.ACTIONS.OPEN_PRIVACY) Business.openPrivacy();
      if(action === CONFIG.ACTIONS.CLEAR_CACHE) Business.clearCache();
      if(action === CONFIG.ACTIONS.OPEN_HELP) Business.openHelp();
      if(action === CONFIG.ACTIONS.OPEN_FEEDBACK) Business.openFeedback();
      if(action === CONFIG.ACTIONS.OPEN_ABOUT) Business.openAbout();
      if(action === CONFIG.ACTIONS.CHECK_UPDATE) Business.checkUpdate();
      // 分析页面操作
      if(action === 'refreshHistory') Business.refreshHistory();
      if(action === 'syncAnalyze') Business.syncAnalyze();
      if(action === 'syncZodiacAnalyze') Business.syncZodiacAnalyze();
      if(action === 'toggleDetail') Business.toggleDetail(actionBtn.dataset.target);
      if(action === 'loadMoreHistory') Business.loadMoreHistory();
      if(action === 'copyHotNumbers') Business.copyHotNumbers();
      if(action === 'copyZodiacNumbers') Business.copyZodiacNumbers();
      if(action === 'copySelectedZodiacs') Business.copySelectedZodiacs();
      if(action === 'favoriteZodiacNumbers') Business.favoriteZodiacNumbers();
      if(action === 'refreshHotCold') Business.refreshHotCold();
      // 显示连出详情
      if(action === 'showStreakDetail') Business.showStreakDetail(actionBtn.dataset.streakType);
      // 显示统计详情
      if(action === 'showStatDetail') Business.showStatDetail(actionBtn.dataset.statType);
      // 切换精选特码模式
      if(action === 'switchSpecialMode') Business.switchSpecialMode(actionBtn.dataset.mode);
      return;
    }

    // 7. 分析标签页切换
    const analysisTabBtn = target.closest('.analysis-tab-btn[data-analysis-tab]');
    if(analysisTabBtn){
      Business.switchAnalysisTab(analysisTabBtn.dataset.analysisTab);
      return;
    }

    // 8. 加载更多历史
    const loadMoreBtn = target.closest('#loadMore');
    if(loadMoreBtn){
      Business.loadMoreHistory();
      return;
    }

    // 9. 生肖预测项点击
    const zodiacItem = target.closest('.zodiac-prediction-item[data-zodiac]');
    if(zodiacItem){
      const zodiac = zodiacItem.dataset.zodiac;
      Business.showZodiacDetail(zodiac);
      return;
    }

    // 10. 数字标签点击（支持number-tag和history-tag）
    const numberTag = target.closest('.number-tag, .history-tag');
    if(numberTag){
      const text = numberTag.innerText.trim();
      
      // 检查是否是数字
      if(!isNaN(text)) {
        try {
          const num = parseInt(text);
          const attrs = DataQuery.getNumAttrs(num);
          const color = attrs.color;
          const element = attrs.element;
          const zodiac = attrs.zodiac;
          const colorClass = color === '红' ? 'red' : color === '蓝' ? 'blue' : 'green';
          
          // 创建弹窗显示数字信息
          const modal = document.createElement('div');
          modal.className = 'modal-overlay';

          // 生成数字球的HTML
          let ballHtml = `
            <div class="modal-content">
              <div class="modal-header">
                <h3 class="modal-title">号码详情</h3>
                <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
              </div>
              
              <div style="display:flex; flex-direction:column; align-items:center; gap:16px; padding:20px 0;">
                <div class="ball ${colorClass}">${String(num).padStart(2, '0')}</div>
                <div style="font-size:16px; color:var(--text); text-align:center; font-weight:500;">${zodiac} / ${element}</div>
              </div>
            </div>
          `;

          modal.innerHTML = ballHtml;

          modal.addEventListener('click', (e) => {
            if(e.target === modal) modal.remove();
          });

          document.body.appendChild(modal);
        } catch (error) {
          console.error('处理数字标签点击时出错:', error);
          Toast.show('处理点击时出错', 2000);
        }
      } else {
        // 检查是否是生肖
        const zodiac = text;
        const zodiacNumbers = [];
        
        // 获取该生肖对应的所有数字
        for(let num = 1; num <= 49; num++) {
          const attrs = DataQuery.getNumAttrs(num);
          if(attrs.zodiac === zodiac) {
            zodiacNumbers.push(num);
          }
        }
        
        if(zodiacNumbers.length > 0) {
          // 创建弹窗显示生肖对应的数字
          const modal = document.createElement('div');
          modal.className = 'modal-overlay';

          // 生成数字球的HTML
          let ballsHtml = `
            <div class="modal-content">
              <div class="modal-header">
                <h3 class="modal-title">生肖：${zodiac}</h3>
                <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
              </div>
              
              <div style="display:flex; flex-wrap:wrap; gap:12px; justify-content:center; padding:10px 0;">
          `;
          
          zodiacNumbers.forEach(num => {
            const attrs = DataQuery.getNumAttrs(num);
            const color = attrs.color;
            const element = attrs.element;
            const colorClass = color === '红' ? 'red' : color === '蓝' ? 'blue' : 'green';
            
            ballsHtml += `
              <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                <div class="ball ${colorClass}">${String(num).padStart(2, '0')}</div>
                <div style="font-size:11px; color:var(--sub-text); text-align:center; font-weight:500;">${element}</div>
              </div>
            `;
          });
          
          ballsHtml += `
              </div>
            </div>
          `;

          modal.innerHTML = ballsHtml;

          modal.addEventListener('click', (e) => {
            if(e.target === modal) modal.remove();
          });

          document.body.appendChild(modal);
        } else {
          Toast.show('未找到该生肖对应的数字', 2000);
        }
      }
      return;
    }

    // 11. 可展开/折叠的span和div元素
    const collapsibleElement = target.closest('[data-toggle-target]');
    if(collapsibleElement){
      const targetId = collapsibleElement.dataset.toggleTarget;
      Business.toggleDetail(targetId);
      return;
    }


  },

  /**
   * 全局change事件处理
   * @param {Event} e - change事件
   */
  handleGlobalChange: (e) => {
    const target = e.target;
    const actionBtn = target.closest('[data-action]');
    if (!actionBtn) return;
    
    const action = actionBtn.dataset.action;
    if (action === 'toggleExcludeLock') {
      Business.toggleExcludeLock();
    }
  },

  /**
   * 键盘事件处理（无障碍支持，回车/空格触发可交互元素）
   * @param {KeyboardEvent} e - 键盘事件
   */
  handleKeyDown: (e) => {
    // 仅处理回车和空格
    if(e.key !== 'Enter' && e.key !== ' ') return;
    
    const target = e.target;
    // 可交互元素
    const isInteractive = target.matches('.tag, .exclude-tag, .btn-mini, .btn-line, .nav-tab, .nav-toggle-btn, .back-top-btn, .filter-expand, .filter-item-btns button, .bottom-nav-item');
    
    if(isInteractive){
      e.preventDefault();
      target.click();
    }
  },

  /**
   * 点击空白关闭快捷导航
   * @param {MouseEvent} e - 点击事件
   */
  handleClickOutside: (e) => {
    const quickNavBtn = document.getElementById('quickNavBtn');
    const quickNavMenu = document.getElementById('quickNavMenu');
    if(quickNavMenu && quickNavMenu.classList.contains('show')){
      if(!quickNavMenu.contains(e.target) && !quickNavBtn.contains(e.target)){
        Business.toggleQuickNav(false);
      }
    }
  },

  /**
   * 全局错误捕获
   * @param {ErrorEvent} e - 错误事件
   */
  handleGlobalError: (e) => {
    console.error('全局错误', e.error);
    Toast.show('页面出现异常，请刷新重试');
  },

  /**
   * 触摸开始事件处理
   * @param {TouchEvent} e - 触摸事件
   */
  handleTouchStart: (e) => {
    EventBinder._touchStartX = e.changedTouches[0].screenX;
    EventBinder._touchStartY = e.changedTouches[0].screenY;
  },

  /**
   * 触摸结束事件处理（实现边缘滑动切换标签）
   * @param {TouchEvent} e - 触摸事件
   */
  handleTouchEnd: (e) => {
    EventBinder._touchEndX = e.changedTouches[0].screenX;
    EventBinder._touchEndY = e.changedTouches[0].screenY;
    
    const screenWidth = window.innerWidth;
    const startX = EventBinder._touchStartX;
    const endX = EventBinder._touchEndX;
    const deltaX = endX - startX;
    const deltaY = EventBinder._touchEndY - EventBinder._touchStartY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    
    if(absDeltaY > absDeltaX) return;
    if(absDeltaX < EventBinder._minSwipeDistance) return;
    
    if(deltaX > 0 && startX < EventBinder._edgeSwipeWidth) {
      const detailPages = ['selectedZodiacDetailPage', 'mlPredictionDetailPage', 'zodiacPredictionDetailPage', 'hotNumbersDetailPage', 'specialDetailPage'];
      for(const pageId of detailPages) {
        const page = document.getElementById(pageId);
        if(page && page.style.display !== 'none') {
          Router.navigate('record');
          return;
        }
      }
    }
    
    const analysisPage = document.getElementById('analysisPage');
    if(!analysisPage || analysisPage.style.display === 'none') return;
    
    const activeTabBtn = document.querySelector('.analysis-tab-btn.active');
    if(!activeTabBtn) return;
    
    const currentTab = activeTabBtn.dataset.analysisTab;
    const tabs = ['history', 'analysis', 'zodiac'];
    const currentIndex = tabs.indexOf(currentTab);
    if(currentIndex === -1) return;
    
    if(deltaX > 0 && startX < EventBinder._edgeSwipeWidth && currentIndex > 0) {
      Business.switchAnalysisTab(tabs[currentIndex - 1]);
    }
    else if(deltaX < 0 && startX > screenWidth - EventBinder._edgeSwipeWidth && currentIndex < tabs.length - 1) {
      Business.switchAnalysisTab(tabs[currentIndex + 1]);
    }
  },
  
  /**
   * 下拉刷新开始
   * @param {TouchEvent} e - 触摸事件
   */
  handlePullStart: (e) => {
    // 只有在页面顶部时才启用下拉刷新
    if(window.scrollY > 0) return;
    
    EventBinder._pullStartY = e.touches[0].clientY;
    EventBinder._isPulling = true;
  },
  
  /**
   * 下拉刷新移动
   * @param {TouchEvent} e - 触摸事件
   */
  handlePullMove: (e) => {
    if(!EventBinder._isPulling) return;
    
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - EventBinder._pullStartY;
    
    // 只处理向下拉动的情况
    if(deltaY <= 0) return;
    
    // 阻止默认滚动行为
    e.preventDefault();
    
    EventBinder._pullCurrentY = deltaY;
    
    // 计算下拉距离（带阻力效果）
    const pullDistance = Math.min(deltaY * 0.5, EventBinder._maxPullDistance);
    
    // 更新指示器位置和状态
    const indicator = document.getElementById('pullRefreshIndicator');
    const container = document.getElementById('analysisPullContainer');
    const text = document.getElementById('pullRefreshText');
    
    if(indicator && container && text) {
      // 显示指示器
      indicator.classList.add('visible');
      
      // 设置指示器位置
      indicator.style.top = `${-50 + pullDistance}px`;
      
      // 根据拉动距离更新文本
      if(pullDistance >= EventBinder._pullThreshold) {
        text.textContent = '释放刷新';
        indicator.classList.add('refreshing');
      } else {
        text.textContent = '下拉刷新';
        indicator.classList.remove('refreshing');
      }
      
      // 给容器添加拉动效果
      container.classList.add('pulling');
      container.style.transform = `translateY(${pullDistance * 0.3}px)`;
    }
  },
  
  /**
   * 下拉刷新结束
   * @param {TouchEvent} e - 触摸事件
   */
  handlePullEnd: (e) => {
    if(!EventBinder._isPulling) return;
    
    EventBinder._isPulling = false;
    
    const indicator = document.getElementById('pullRefreshIndicator');
    const container = document.getElementById('analysisPullContainer');
    const text = document.getElementById('pullRefreshText');
    
    if(indicator && container && text) {
      // 移除拉动效果
      container.classList.remove('pulling');
      container.style.transform = '';
      
      // 检查是否达到刷新阈值
      if(EventBinder._pullCurrentY >= EventBinder._pullThreshold) {
        // 执行刷新
        text.textContent = '刷新中...';
        indicator.style.top = '-20px';
        
        // 调用刷新函数
        setTimeout(() => {
          Business.refreshHistory(true); // 静默模式
          
          // 刷新完成后隐藏指示器
          setTimeout(() => {
            indicator.classList.remove('visible', 'refreshing');
            indicator.style.top = '-50px';
            text.textContent = '下拉刷新';
          }, 500);
        }, 300);
      } else {
        // 未达到阈值，隐藏指示器
        indicator.classList.remove('visible', 'refreshing');
        indicator.style.top = '-50px';
        text.textContent = '下拉刷新';
      }
    }
    
    // 重置状态
    EventBinder._pullCurrentY = 0;
  },
  
  /**
   * 记录页面下拉刷新开始
   * @param {TouchEvent} e - 触摸事件
   */
  handleRecordPullStart: (e) => {
    // 只有在页面顶部时才启用下拉刷新
    if(window.scrollY > 0) return;
    
    EventBinder._pullStartY = e.touches[0].clientY;
    EventBinder._isPulling = true;
  },
  
  /**
   * 记录页面下拉刷新移动
   * @param {TouchEvent} e - 触摸事件
   */
  handleRecordPullMove: (e) => {
    if(!EventBinder._isPulling) return;
    
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - EventBinder._pullStartY;
    
    // 只处理向下拉动的情况
    if(deltaY <= 0) return;
    
    // 阻止默认滚动行为
    e.preventDefault();
    
    EventBinder._pullCurrentY = deltaY;
    
    // 计算下拉距离（带阻力效果）
    const pullDistance = Math.min(deltaY * 0.5, EventBinder._maxPullDistance);
    
    // 更新指示器位置和状态
    const indicator = document.getElementById('recordPullRefreshIndicator');
    const container = document.getElementById('recordPullContainer');
    const text = document.getElementById('recordPullRefreshText');
    
    if(indicator && container && text) {
      // 显示指示器
      indicator.classList.add('visible');
      
      // 设置指示器位置
      indicator.style.top = `${-50 + pullDistance}px`;
      
      // 根据拉动距离更新文本
      if(pullDistance >= EventBinder._pullThreshold) {
        text.textContent = '释放刷新';
        indicator.classList.add('refreshing');
      } else {
        text.textContent = '下拉刷新';
        indicator.classList.remove('refreshing');
      }
      
      // 给容器添加拉动效果
      container.classList.add('pulling');
      container.style.transform = `translateY(${pullDistance * 0.3}px)`;
    }
  },
  
  /**
   * 记录页面下拉刷新结束
   * @param {TouchEvent} e - 触摸事件
   */
  handleRecordPullEnd: (e) => {
    if(!EventBinder._isPulling) return;
    
    EventBinder._isPulling = false;
    
    const indicator = document.getElementById('recordPullRefreshIndicator');
    const container = document.getElementById('recordPullContainer');
    const text = document.getElementById('recordPullRefreshText');
    
    if(indicator && container && text) {
      // 移除拉动效果
      container.classList.remove('pulling');
      container.style.transform = '';
      
      // 检查是否达到刷新阈值
      if(EventBinder._pullCurrentY >= EventBinder._pullThreshold) {
        // 执行刷新
        text.textContent = '刷新中...';
        indicator.style.top = '-20px';
        
        // 调用刷新函数
        setTimeout(() => {
          // 导入record模块并刷新
          import('./business/record.js').then(({ record }) => {
            const success = record.refreshAll();
            
            // 刷新完成后隐藏指示器
            setTimeout(() => {
              indicator.classList.remove('visible', 'refreshing');
              indicator.style.top = '-50px';
              text.textContent = '下拉刷新';
              
              if(success) {
                Toast.show('数据已刷新', 1500);
              } else {
                Toast.show('刷新失败，请重试', 2000);
              }
            }, 500);
          }).catch(error => {
            console.error('加载record模块失败:', error);
            indicator.classList.remove('visible', 'refreshing');
            indicator.style.top = '-50px';
            text.textContent = '下拉刷新';
            Toast.show('刷新失败，请重试', 2000);
          });
        }, 300);
      } else {
        // 未达到阈值，隐藏指示器
        indicator.classList.remove('visible', 'refreshing');
        indicator.style.top = '-50px';
        text.textContent = '下拉刷新';
      }
    }
    
    // 重置状态
    EventBinder._pullCurrentY = 0;
  }
};
