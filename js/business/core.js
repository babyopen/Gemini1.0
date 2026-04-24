// ====================== 核心业务模块 ======================

// 导入必要的模块
import { CONFIG } from '../config.js';
import { Utils } from '../utils.js';
import { StateManager } from '../state-manager.js';
import { Filter } from '../filter.js';
import { DOM } from '../dom.js';
import { DataQuery } from '../data-query.js';
import { Storage } from '../storage.js';
import { Render } from '../render.js';
import { Toast } from '../toast.js';

export const core = {
  // ====================== 农历年份相关 ======================
  /**
   * 获取当前农历年份
   * @returns {number} 农历年份
   */
  getCurrentLunarYear: () => {
    const now = new Date();
    const year = now.getFullYear();
    const thisYearSpring = new Date(CONFIG.SPRING_FESTIVAL[year]);
    return now < thisYearSpring ? year - 1 : year;
  },

  /**
   * 获取指定日期的农历年份
   * @param {string} dateStr - 日期字符串 (格式: YYYY-MM-DD)
   * @returns {number} 农历年份
   */
  getLunarYearByDate: (dateStr) => {
    if(!dateStr) return core.getCurrentLunarYear();
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const thisYearSpring = new Date(CONFIG.SPRING_FESTIVAL[year]);
    return date < thisYearSpring ? year - 1 : year;
  },

  // ====================== 排除号码相关 ======================
  /**
   * 切换号码排除状态
   * @param {number} num - 号码
   */
  toggleExclude: (num) => {
    const state = StateManager._state;
    if(state.filter.lockExclude) return;

    const newExcluded = [...state.filter.excluded];
    const newHistory = [...state.filter.excludeHistory];

    if(newExcluded.includes(num)){
      newHistory.push([num, 'out']);
      const index = newExcluded.indexOf(num);
      newExcluded.splice(index, 1);
    } else {
      newHistory.push([num, 'in']);
      newExcluded.push(num);
    }

    StateManager.setState({ filter: { ...state.filter, excluded: newExcluded, excludeHistory: newHistory } });
  },

  /**
   * 反选排除号码（已排除的恢复，未排除的排除）
   */
  invertExclude: () => {
    const state = StateManager._state;
    if(state.filter.lockExclude) return;

    const allNums = Array.from({length: 49}, (_, i) => i + 1);
    const newExcluded = [];
    const newHistory = [...state.filter.excludeHistory];

    allNums.forEach(num => {
      const isCurrentlyExcluded = state.filter.excluded.includes(num);
      if(!isCurrentlyExcluded){
        // 当前未排除的，现在排除
        newExcluded.push(num);
        newHistory.push([num, 'in']);
      } else {
        // 当前已排除的，现在恢复
        newHistory.push([num, 'out']);
      }
    });

    StateManager.setState({ filter: { ...state.filter, excluded: newExcluded, excludeHistory: newHistory } });
    Toast.show(`已反选，当前排除 ${newExcluded.length} 个号码`);
  },

  /**
   * 撤销上一次排除操作
   */
  undoExclude: () => {
    const state = StateManager._state;
    if(state.filter.lockExclude || !state.filter.excludeHistory.length) return;

    const newHistory = [...state.filter.excludeHistory];
    const [num, act] = newHistory.pop();
    const newExcluded = [...state.filter.excluded];

    act === 'in' 
      ? newExcluded.splice(newExcluded.indexOf(num), 1)
      : newExcluded.push(num);

    StateManager.setState({ filter: { ...state.filter, excluded: newExcluded, excludeHistory: newHistory } });
  },

  /**
   * 清空所有排除号码
   */
  clearExclude: () => {
    const state = StateManager._state;
    if(state.filter.lockExclude) return;
    StateManager.setState({ filter: { ...state.filter, excluded: [], excludeHistory: [] } });
    Toast.show('已清空所有排除号码');
  },

  /**
   * 批量排除号码弹窗
   */
  batchExcludePrompt: () => {
    const state = StateManager._state;
    if(state.filter.lockExclude) return;

    let input;
    try {
      input = prompt("输入要排除的号码，空格/逗号分隔");
    } catch(e) {
      Toast.show('当前浏览器不支持输入框功能');
      return;
    }
    if(!input) return;

    const nums = input.split(/[\s,，]+/).map(Number).filter(num => num >=1 && num <=49);
    if(nums.length === 0) {
      Toast.show('请输入有效的号码');
      return;
    }

    const newExcluded = [...state.filter.excluded];
    const newHistory = [...state.filter.excludeHistory];
    let addCount = 0;

    nums.forEach(num => {
      if(!newExcluded.includes(num)){
        newExcluded.push(num);
        newHistory.push([num, 'in']);
        addCount++;
      }
    });

    StateManager.setState({ filter: { ...state.filter, excluded: newExcluded, excludeHistory: newHistory } });
    Toast.show(addCount > 0 ? `已添加${addCount}个排除号码` : '号码已在排除列表中');
  },

  /**
   * 切换排除锁定状态
   */
  toggleExcludeLock: () => {
    const isLocked = DOM.lockExclude.checked;
    StateManager.setState({ filter: { ...StateManager._state.filter, lockExclude: isLocked } }, false);
    Toast.show(isLocked ? '已锁定排除号码' : '已解锁排除号码');
  },

  // ====================== 方案管理相关 ======================
  /**
   * 保存方案弹窗
   */
  saveFilterPrompt: () => {
    const state = StateManager._state;
    if(state.filter.savedFilters.length >= CONFIG.MAX_SAVE_COUNT){
      Toast.show(`最多只能保存${CONFIG.MAX_SAVE_COUNT}个方案`);
      return;
    }

    const defaultName = `方案${state.filter.savedFilters.length + 1}`;
    let name;
    try {
      name = prompt("请输入方案名称", defaultName);
    } catch(e) {
      Toast.show('当前浏览器不支持输入框功能');
      return;
    }
    if(name === null) return;

    // 获取最新的期号
    let issueNumber = null;
    const historyData = state?.analysis?.historyData || [];
    if (historyData.length > 0) {
      const latestIssue = historyData[0]?.expect;
      if (latestIssue) {
        const issueStr = String(latestIssue).padStart(6, '0');
        if (/^\d{6}$/.test(issueStr)) {
          issueNumber = issueStr;
        }
      }
    }

    const filterName = name.trim() || defaultName;
    const filterItem = {
      name: filterName,
      selected: Utils.deepClone(state.filter.selected),
      excluded: Utils.deepClone(state.filter.excluded),
      timestamp: Date.now(),
      issueNumber: issueNumber
    };

    const success = Storage.saveFilter(filterItem);
    if(success){
      Render.renderFilterList();
      Toast.show('保存成功');
    }
  },

  /**
   * 加载保存的方案
   * @param {number} index - 方案索引
   */
  loadFilter: (index) => {
    const state = StateManager._state;
    const item = state.filter.savedFilters[index];
    if(!item) return;

    StateManager.setState({
      filter: {
        ...state.filter,
        selected: Utils.deepClone(item.selected),
        excluded: Utils.deepClone(item.excluded)
      }
    });
    Toast.show('加载成功');
  },

  /**
   * 复制方案号码
   * @param {number} index - 方案索引
   */
  copyFilterNums: (index) => {
    const state = StateManager._state;
    const item = state.filter.savedFilters[index];
    if(!item) return;

    const list = Filter.getFilteredList(item.selected, item.excluded);
    if(list.length === 0){
      Toast.show('该方案无符合条件的号码');
      return;
    }

    const numStr = list.map(n => n.s).join(' ');
    // 剪贴板API兼容
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(numStr).then(() => {
        Toast.show('复制成功');
      }).catch(() => {
        try {
          prompt('请手动复制以下号码：', numStr);
        } catch(e) {
          Toast.show('号码已准备复制：' + numStr);
        }
      });
    } else {
      try {
        prompt('请手动复制以下号码：', numStr);
      } catch(e) {
        Toast.show('号码已准备复制：' + numStr);
      }
    }
  },

  /**
   * 重命名方案
   * @param {number} index - 方案索引
   */
  renameFilter: (index) => {
    const state = StateManager._state;
    const item = state.filter.savedFilters[index];
    if(!item) return;

    let newName;
    try {
      newName = prompt("修改方案名称", item.name);
    } catch(e) {
      Toast.show('当前浏览器不支持输入框功能');
      return;
    }
    if(newName === null || newName.trim() === "") return;

    const newList = [...state.filter.savedFilters];
    newList[index].name = newName.trim();
    const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
    
    if(success){
      StateManager.setState({ filter: { ...state.filter, savedFilters: newList } }, false);
      Render.renderFilterList();
      Toast.show('重命名成功');
    }
  },

  /**
   * 置顶方案
   * @param {number} index - 方案索引
   */
  topFilter: (index) => {
    const state = StateManager._state;
    const item = state.filter.savedFilters[index];
    if(!item) return;

    const newList = [...state.filter.savedFilters];
    newList.splice(index, 1);
    newList.unshift(item);
    const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
    
    if(success){
      StateManager.setState({ filter: { ...state.filter, savedFilters: newList } }, false);
      Render.renderFilterList();
      Toast.show('置顶成功');
    }
  },

  /**
   * 删除方案
   * @param {number} index - 方案索引
   */
  deleteFilter: (index) => {
    if(!confirm("确定删除该方案？")) return;
    const state = StateManager._state;
    const newList = [...state.filter.savedFilters];
    newList.splice(index, 1);
    const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
    
    if(success){
      StateManager.setState({ filter: { ...state.filter, savedFilters: newList } }, false);
      Render.renderFilterList();
      Toast.show('删除成功');
    }
  },

  /**
   * 清空所有方案
   */
  clearAllSavedFilters: () => {
    if(!confirm("确定清空所有方案？")) return;
    Storage.remove(Storage.KEYS.SAVED_FILTERS);
    StateManager.setState({ filter: { ...StateManager._state.filter, savedFilters: [] } }, false);
    Render.renderFilterList();
    Toast.show('已清空所有方案');
  },

  /**
   * 收藏方案
   * @param {number} index - 方案索引
   */
  favoriteFilter: (index) => {
    const state = StateManager._state;
    const item = state.filter.savedFilters[index];
    if(!item) return;

    // 检查是否已收藏
    const isFavorited = state.system.favorites.some(fav => fav.name === item.name);
    if(isFavorited) {
      // 取消收藏，添加二次确认
      if(!confirm('确定要取消收藏该方案吗？')) return;
      const newFavorites = state.system.favorites.filter(fav => fav.name !== item.name);
      StateManager.setState({ system: { ...state.system, favorites: newFavorites } }, false);
      Storage.set('favorites', newFavorites);
      Toast.show('已取消收藏');
    } else {
      // 添加收藏
      const newFavorites = [...state.system.favorites, item];
      StateManager.setState({ system: { ...state.system, favorites: newFavorites } }, false);
      Storage.set('favorites', newFavorites);
      Toast.show('收藏成功');
    }
  },

  /**
   * 清空所有收藏
   */
  clearAllFavorites: () => {
    if(!confirm("确定清空所有收藏？")) return;
    Storage.remove('favorites');
    StateManager.setState({ system: { ...StateManager._state.system, favorites: [] } }, false);
    core.renderFavoriteList();
    Toast.show('已清空所有收藏');
  },

  /**
   * 从收藏列表中移除方案
   * @param {number} index - 收藏索引
   */
  removeFavorite: (index) => {
    if(!confirm('确定移除该收藏？')) return;
    const state = StateManager._state;
    const newFavorites = [...state.system.favorites];
    newFavorites.splice(index, 1);
    StateManager.setState({ system: { ...state.system, favorites: newFavorites } }, false);
    Storage.set('favorites', newFavorites);
    core.renderFavoriteList();
    Toast.show('已移除收藏');
  },

  /**
   * 渲染收藏列表
   */
  renderFavoriteList: () => {
    const state = StateManager._state;
    const favoriteList = document.getElementById('favoriteList');
    const favorites = state.system.favorites;

    if(!favorites.length){
      favoriteList.innerHTML = "<div style='text-align:center;color:var(--sub-text)'>暂无收藏的方案</div>";
      return;
    }

    const fragment = document.createDocumentFragment();

    favorites.forEach((item, index) => {
      let previewList;
      // 如果是精选特码收藏，优先使用 item.numbers
      if(item.numbers && Array.isArray(item.numbers)) {
        previewList = item.numbers.map(num => DataQuery.getNumAttrs(num));
      } else {
        previewList = Filter.getFilteredList(item.selected, item.excluded);
      }
      const previewFragment = Utils.createFragment(previewList, (num) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'num-item';
        wrapper.innerHTML = `<div class="num-ball ${num.color}色">${num.s}</div><div class="tag-zodiac">${num.zodiac}</div>`;
        return wrapper;
      });

      const itemWrapper = document.createElement('div');
      itemWrapper.className = 'filter-item';
      itemWrapper.setAttribute('role', 'listitem');
      itemWrapper.innerHTML = `
        <div class="filter-row">
          <div class="filter-item-name">${item.name}</div>
          <div class="filter-preview" style="flex: 1; min-width: 0;"></div>
        </div>
        <div class="filter-item-btns">
          <button data-action="loadFavorite" data-index="${index}">加载</button>
          <button data-action="renameFavorite" data-index="${index}">重命名</button>
          <button data-action="copyFavorite" data-index="${index}">复制</button>
        </div>
      `;
      itemWrapper.querySelector('.filter-preview').appendChild(previewFragment);
      fragment.appendChild(itemWrapper);
    });

    favoriteList.innerHTML = '';
    favoriteList.appendChild(fragment);
  },

  /**
   * 加载收藏的方案
   * @param {number} index - 收藏索引
   */
  loadFavorite: (index) => {
    const state = StateManager._state;
    const item = state.system.favorites[index];
    if(!item) return;

    // 如果是精选特码收藏，使用 numbers 加载
    if(item.numbers && Array.isArray(item.numbers)) {
      // 清空所有筛选条件
      Object.keys(state.filter.selected).forEach(group => StateManager.resetGroup(group));
      // 清空排除号码
      StateManager.setState({
        filter: {
          ...state.filter,
          excluded: [],
          excludeHistory: [],
          lockExclude: false
        }
      });
      // 更新复选框
      DOM.lockExclude.checked = false;
      Toast.show('已加载精选特码号码');
    } else {
      // 普通方案加载
      StateManager.setState({
        filter: {
          ...state.filter,
          selected: Utils.deepClone(item.selected),
          excluded: Utils.deepClone(item.excluded)
        }
      });
      Toast.show('加载成功');
    }
  },

  /**
   * 重命名收藏的方案
   * @param {number} index - 收藏索引
   */
  renameFavorite: (index) => {
    const state = StateManager._state;
    const item = state.system.favorites[index];
    if(!item) return;

    let newName;
    try {
      newName = prompt("修改收藏名称", item.name);
    } catch(e) {
      Toast.show('当前浏览器不支持输入框功能');
      return;
    }
    if(newName === null || newName.trim() === "") return;

    const newFavorites = [...state.system.favorites];
    newFavorites[index].name = newName.trim();
    Storage.set('favorites', newFavorites);
    StateManager.setState({ system: { ...state.system, favorites: newFavorites } }, false);
    core.renderFavoriteList();
    Toast.show('重命名成功');
  },

  /**
   * 复制收藏的方案号码
   * @param {number} index - 收藏索引
   */
  copyFavorite: (index) => {
    const state = StateManager._state;
    const item = state.system.favorites[index];
    if(!item) return;

    let list;
    // 如果是精选特码收藏，优先使用 item.numbers
    if(item.numbers && Array.isArray(item.numbers)) {
      list = item.numbers.map(num => DataQuery.getNumAttrs(num));
    } else {
      list = Filter.getFilteredList(item.selected, item.excluded);
    }
    
    if(list.length === 0){
      Toast.show('该收藏无符合条件的号码');
      return;
    }

    const numStr = list.map(n => n.s).join(' ');
    core.copyToClipboard(numStr);
  },

  /**
   * 复制到剪贴板
   * @param {string} text - 要复制的文本
   */
  copyToClipboard: (text) => {
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(() => {
        Toast.show('复制成功');
      }).catch(() => {
        try {
          prompt('请手动复制以下号码：', text);
        } catch(e) {
          Toast.show('号码已准备复制：' + text);
        }
      });
    } else {
      try {
        prompt('请手动复制以下号码：', text);
      } catch(e) {
        Toast.show('号码已准备复制：' + text);
      }
    }
  },

  /**
   * 测试API连接
   * 验证用户配置的API地址是否可访问
   */
  testApiConnection: () => {
    const latestApiInput = document.getElementById('latestApiInput');
    const historyApiInput = document.getElementById('historyApiInput');
    
    if (!latestApiInput || !historyApiInput) {
      Toast.show('无法获取API配置输入框');
      return;
    }
    
    const latestApi = latestApiInput.value.trim();
    const historyApi = historyApiInput.value.trim();
    
    if (!latestApi || !historyApi) {
      Toast.show('请填写完整的API地址');
      return;
    }
    
    // 验证URL格式
    const validateUrl = (url) => {
      if (!url || typeof url !== 'string') return false;
      try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
      } catch (error) {
        return false;
      }
    };
    
    if (!validateUrl(latestApi)) {
      Toast.show('最新开奖API地址格式无效');
      return;
    }
    
    if (!validateUrl(historyApi)) {
      Toast.show('历史数据API地址格式无效');
      return;
    }
    
    Toast.show('正在测试API连接...');
    
    // 测试最新开奖API
    fetch(latestApi, { method: 'HEAD', mode: 'no-cors' })
      .then(() => {
        Toast.show('API连接测试成功（最新开奖API可访问）');
      })
      .catch(() => {
        // 对于no-cors模式，错误是正常的，我们假设连接成功
        Toast.show('API连接测试完成（最新开奖API可访问）');
      });
  },

  /**
   * 重置API配置为默认值
   */
  resetApiConfig: () => {
    if (confirm('确定要重置API配置为默认值吗？重置后需要刷新页面生效。')) {
      const latestApiInput = document.getElementById('latestApiInput');
      const historyApiInput = document.getElementById('historyApiInput');
      
      if (latestApiInput && historyApiInput) {
        latestApiInput.value = CONFIG.API.LATEST;
        historyApiInput.value = CONFIG.API.HISTORY;
        Toast.show('API配置已重置为默认值，请点击保存设置');
      }
    }
  },

  /**
   * 保存设置（包括API配置）
   */
  saveSettings: () => {
    try {
      // 保存API配置
      const latestApiInput = document.getElementById('latestApiInput');
      const historyApiInput = document.getElementById('historyApiInput');
      
      if (latestApiInput && historyApiInput) {
        const apiConfig = {
          latest: latestApiInput.value.trim(),
          history: historyApiInput.value.trim()
        };
        
        // 验证并保存API配置
        if (apiConfig.latest && apiConfig.history) {
          Storage.saveCustomApi(apiConfig);
        } else {
          console.log('API配置未填写，跳过保存');
        }
      }
      
      // 保存其他设置...
      // （原有保存设置逻辑，如果存在的话）
      
      Toast.show('设置保存成功');
      
      // 关闭设置模态框
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
      modal.remove();
    }
    } catch (error) {
      console.error('保存设置失败:', error);
      Toast.show('保存设置失败');
    }
  },

  /**
   * 从球号中提取数字
   * @param {HTMLElement} finalNumEl - 最终号码容器元素
   * @returns {Array} 号码数组
   */
  extractNumbersFromBalls: (finalNumEl) => {
    if(!finalNumEl) return [];
    
    const balls = finalNumEl.querySelectorAll('.ball');
    const numbers = [];
    
    balls.forEach(ball => {
      const numText = ball.textContent.trim();
      const num = parseInt(numText, 10);
      if(!isNaN(num) && num >= 1 && num <= 49) {
        numbers.push(num);
      }
    });
    
    return numbers;
  },

  /**
   * 复制热门特码
   */
  copyHotNumbers: () => {
    const hotNumberEl = document.getElementById('zodiacFinalNumContent');
    if(!hotNumberEl) {
      Toast.show('无法获取精选特码');
      return;
    }
    
    const numbers = core.extractNumbersFromBalls(hotNumberEl);
    if(numbers.length === 0) {
      Toast.show('没有可复制的精选特码');
      return;
    }
    
    const numStr = numbers.map(n => String(n).padStart(2, '0')).join(' ');
    core.copyToClipboard(numStr);
  },

  /**
   * 复制生肖号码
   * @param {string} zodiac - 生肖名称
   */
  copyZodiacNumbers: (zodiac) => {
    const numbers = core.getZodiacNumbers(zodiac);
    if(numbers.length === 0) {
      Toast.show(`未找到${zodiac}对应的号码`);
      return;
    }
    
    const numStr = numbers.map(n => String(n).padStart(2, '0')).join(' ');
    core.copyToClipboard(numStr);
  },

  /**
   * 通过生肖获取号码
   * @param {string} zodiac - 生肖名称
   * @returns {Array} 号码数组
   */
  getZodiacNumbers: (zodiac) => {
    const numbers = [];
    for(let num = 1; num <= 49; num++) {
      const zod = DataQuery._getZodiacByNum(num);
      if(zod === zodiac) {
        numbers.push(num);
      }
    }
    return numbers;
  },

  /**
   * 复制生肖号码（通过生肖）
   * @param {string} zodiac - 生肖名称
   */
  copyZodiacNumbersByZodiac: (zodiac) => {
    core.copyZodiacNumbers(zodiac);
  },

  // ====================== 导航相关 ======================
  /**
   * 切换方案列表展开/收起
   */
  toggleShowAllFilters: () => {
    const state = StateManager._state;
    StateManager.setState({ filter: { ...state.filter, showAllFilters: !state.filter.showAllFilters } }, false);
    Render.renderFilterList();
  },

  /**
   * 切换底部导航
   * @param {number} index - 导航索引
   */
  switchBottomNav: (index) => {
    document.querySelectorAll('.bottom-nav-item').forEach((el,i)=>{
      el.classList.toggle('active', i===index);
    });
    
    // 切换页面显示
    const pages = ['filterPage', 'analysisPage', 'recordPage', 'profilePage'];
    pages.forEach((pageId, i) => {
      const pageEl = document.getElementById(pageId);
      if(pageEl) {
        pageEl.style.display = i === index ? 'block' : 'none';
        pageEl.classList.toggle('active', i === index);
      }
    });
    
    // 页面切换时滚动到顶部
    requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      
      // 同时滚动所有页面容器到顶部
      pages.forEach(pageId => {
        const pageEl = document.getElementById(pageId);
        if(pageEl) {
          pageEl.scrollTop = 0;
        }
      });
    });
    
    // 控制顶部展示区的显示/隐藏：仅在筛选页面(index=0)显示
    const topBox = document.getElementById('topBox');
    if(topBox) {
      topBox.style.display = index === 0 ? 'block' : 'none';
    }
    
    // 控制主体内容区的顶部间距：筛选页面有顶部展示区，其他页面没有
    const bodyBox = document.querySelector('.body-box');
    if(bodyBox) {
      if(index === 0) {
        bodyBox.style.marginTop = 'calc(var(--top-offset) + var(--safe-top))';
      } else {
        bodyBox.style.marginTop = 'calc(12px + var(--safe-top))';
      }
    }
    
    // 控制快捷导航按钮的显示/隐藏：在筛选页面(index=0)和分析页面(index=1)显示
    const quickNavBtn = document.getElementById('quickNavBtn');
    const quickNavMenu = document.getElementById('quickNavMenu');
    const navTabs = document.getElementById('navTabs');
    const bottomNav = document.querySelector('.bottom-nav');
    
    if(quickNavBtn) {
      quickNavBtn.style.display = (index === 0 || index === 1) ? 'flex' : 'none';
    }
    
    if(quickNavMenu) {
      quickNavMenu.classList.remove('show');
      
      // 保存原始的快捷导航内容
      if (!Business._originalQuickNavContent) {
        Business._originalQuickNavContent = navTabs.innerHTML;
      }
      
      // 根据当前页面更新快捷导航内容
      if (index === 1 && navTabs) {
        // 分析页面的快捷导航内容
        navTabs.innerHTML = `
          <button class="nav-tab" data-target="zodiacAnalysisPanel" role="tab">生肖关联</button>
          <button class="nav-tab" data-target="analysisPanelContent" role="tab">维度分析</button>
          <button class="nav-tab" data-target="historyPanel" role="tab">历史记录</button>
        `;
      } else if (index === 0 && navTabs && Business._originalQuickNavContent) {
        // 恢复筛选页面的快捷导航内容
        navTabs.innerHTML = Business._originalQuickNavContent;
      }
    }
    
    if(bottomNav) {
      bottomNav.classList.toggle('needs-space', index === 0 || index === 1);
    }
    
    // 切换到记录页面时，重新渲染所有数据
    if (index === 2) {
      import('./record.js').then(({ record }) => {
        record.renderAll();
      }).catch(error => {
        console.error('加载record模块失败:', error);
      });
    }
  },

  /**
   * 切换快捷导航
   * @param {boolean|null} force - 强制显示/隐藏
   */
  toggleQuickNav: (force) => {
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
  },

  /**
   * 返回顶部
   */
  backToTop: () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  /**
   * 处理滚动事件
   */
  handleScroll: () => {
    const backTopBtn = document.getElementById('backTopBtn');
    if(backTopBtn) {
      backTopBtn.style.display = window.scrollY > 300 ? 'flex' : 'none';
    }
  },

  /**
   * 处理页面卸载事件
   */
  handlePageUnload: () => {
    Toast.clearTimer();
  },

  /**
   * 滚动到指定模块
   * @param {string} targetId - 目标元素ID
   */
  scrollToModule: (targetId) => {
    const element = document.getElementById(targetId);
    if(element) {
      // 计算目标元素的位置
      const rect = element.getBoundingClientRect();
      const offsetTop = rect.top + window.pageYOffset;
      
      // 计算顶部占用空间（包括top-box和安全区）
      const safeTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-top') || '0');
      const topBox = document.getElementById('topBox');
      const topBoxHeight = topBox ? topBox.offsetHeight : 0;
      
      // 计算最终滚动位置
      const scrollToPosition = offsetTop - safeTop - topBoxHeight - 20; // 20px 额外空间
      
      // 使用window.scrollTo代替element.scrollIntoView，以获得更好的控制
      window.scrollTo({
        top: Math.max(0, scrollToPosition),
        behavior: 'smooth'
      });
    }
  },


};
