// ====================== 8. 渲染模块（只负责DOM操作，不包含业务逻辑）======================
/**
 * 渲染管理器
 * @namespace Render
 */

// 导入必要的模块
import { CONFIG } from './config.js';
import { Utils } from './utils.js';
import { StateManager } from './state-manager.js';
import { Filter } from './filter.js';
import { DOM } from './dom.js';
import { DataQuery } from './data-query.js';
import { Toast } from './toast.js';

const _lastRenderedList = [];
const _cachedFragments = new Map();
let _renderThrottleTimer = null;

export const Render = {
  /**
   * 渲染所有视图（状态变化时调用）
   */
  renderAll: () => {
    Render.renderResult();
    Render.renderTagStatus();
    Render.renderExcludeGrid();
  },

  /**
   * 节流渲染（避免频繁刷新）
   * @param {Function} renderFn - 渲染函数
   * @param {number} delay - 延迟毫秒
   */
  throttleRender: (renderFn, delay = 16) => {
    if (_renderThrottleTimer) return;
    
    _renderThrottleTimer = setTimeout(() => {
      renderFn();
      _renderThrottleTimer = null;
    }, delay);
  },

  /**
   * 增量渲染筛选结果（只更新变化的部分）
   */
  renderResult: () => {
    try {
      const state = StateManager._state;
      const filteredList = Filter.getFilteredList();
      
      const fragment = Utils.createFragment(filteredList, (item) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'num-item';
        wrapper.setAttribute('role', 'listitem');
        wrapper.innerHTML = `<div class="num-ball ${item.color}色">${item.s}</div><div class="tag-zodiac">${item.zodiac}</div>`;
        return wrapper;
      });

      DOM.resultNums.innerHTML = '';
      DOM.resultNums.appendChild(fragment);
      
      DOM.resultCount.innerText = filteredList.length;
      DOM.excludeCount.innerText = state.filter.excluded.length;
    } catch(e) {
      console.error('渲染结果失败', e);
    }
  },

  /**
   * 增量更新标签选中状态（仅更新对应分组，不重渲染整个DOM）
   * @param {string|null} group - 要更新的分组，不传则更新所有
   */
  renderTagStatus: (group = null) => {
    try {
      const state = StateManager._state;
      const groups = group ? [group] : Object.keys(state.filter.selected);
      
      groups.forEach(g => {
        const selectedList = state.filter.selected[g];
        document.querySelectorAll(`.tag[data-group="${g}"]`).forEach(tag => {
          const tagValue = Utils.formatTagValue(tag.dataset.value, g);
          const isActive = selectedList.includes(tagValue);
          tag.classList.toggle('active', isActive);
          tag.setAttribute('aria-checked', isActive);
        });
      });
    } catch(e) {
      console.error('渲染标签状态失败', e);
    }
  },

  /**
   * 渲染排除号码网格
   */
  renderExcludeGrid: () => {
    try {
      const state = StateManager._state;
      const fragment = Utils.createFragment(Array.from({length:49}, (_,i)=>i+1), (num) => {
        const isExcluded = state.filter.excluded.includes(num);
        const wrapper = document.createElement('div');
        wrapper.className = `exclude-tag ${isExcluded ? 'excluded' : ''}`;
        wrapper.dataset.num = num;
        wrapper.setAttribute('aria-checked', isExcluded);
        wrapper.setAttribute('tabindex', '0');
        wrapper.innerText = num.toString().padStart(2,'0');
        return wrapper;
      });

      DOM.excludeGrid.innerHTML = '';
      DOM.excludeGrid.appendChild(fragment);
    } catch(e) {
      console.error('渲染排除网格失败', e);
    }
  },

  /**
   * 渲染生肖标签
   */
  renderZodiacTags: () => {
    try {
      const state = StateManager._state;
      const fragment = Utils.createFragment(state.data.zodiacCycle, (zodiac) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'tag';
        wrapper.dataset.value = zodiac;
        wrapper.dataset.group = 'zodiac';
        wrapper.setAttribute('role', 'checkbox');
        wrapper.setAttribute('tabindex', '0');
        wrapper.innerText = zodiac;
        return wrapper;
      });

      DOM.zodiacTags.innerHTML = '';
      DOM.zodiacTags.appendChild(fragment);
    } catch(e) {
      console.error('渲染生肖标签失败', e);
    }
  },

  /**
   * 渲染方案列表
   */
  renderFilterList: () => {
    try {
      const state = StateManager._state;
      const savedList = state.filter.savedFilters;

      if(!savedList.length){
        DOM.filterList.innerHTML = "<div style='text-align:center;color:var(--sub-text)'>暂无保存的方案</div>";
        return;
      }

      const showCount = 2;
      const displayList = state.filter.showAllFilters ? savedList : savedList.slice(0, showCount);
      const fragment = document.createDocumentFragment();

      displayList.forEach((item, index) => {
        const realIndex = state.filter.showAllFilters ? index : index;
        const previewList = Filter.getFilteredList(item.selected, item.excluded); // 显示所有号码
        const previewFragment = Utils.createFragment(previewList, (num) => {
          const wrapper = document.createElement('div');
          wrapper.className = 'num-item';
          wrapper.innerHTML = `<div class="num-ball ${num.color}色">${num.s}</div><div class="tag-zodiac">${num.zodiac}</div>`;
          return wrapper;
        });

        const isFavorited = state.system.favorites.some(fav => fav.name === item.name);
        const itemWrapper = document.createElement('div');
        itemWrapper.className = 'filter-item';
        itemWrapper.setAttribute('role', 'listitem');
        itemWrapper.innerHTML = `
          <div class="filter-row">
            <div class="filter-item-name">${item.name}</div>
            <div class="filter-preview" style="flex: 1; min-width: 0;"></div>
          </div>
          <div class="filter-item-btns">
            <button data-action="${CONFIG.ACTIONS.LOAD_FILTER}" data-index="${realIndex}">加载</button>
            <button data-action="${CONFIG.ACTIONS.RENAME_FILTER}" data-index="${realIndex}">重命名</button>
            <button data-action="${CONFIG.ACTIONS.COPY_FILTER}" data-index="${realIndex}">复制</button>
            <button data-action="${CONFIG.ACTIONS.TOP_FILTER}" data-index="${realIndex}">置顶</button>
            <button data-action="favoriteFilter" data-index="${realIndex}" ${isFavorited ? 'class="red"' : ''}>收藏</button>
            <button class="del" data-action="${CONFIG.ACTIONS.DELETE_FILTER}" data-index="${realIndex}">删除</button>
          </div>
        `;
        itemWrapper.querySelector('.filter-preview').appendChild(previewFragment);
        fragment.appendChild(itemWrapper);
      });

      if(savedList.length > showCount){
        const expandBtn = document.createElement('div');
        expandBtn.className = 'filter-expand';
        expandBtn.dataset.action = CONFIG.ACTIONS.TOGGLE_SHOW_ALL;
        expandBtn.innerText = state.filter.showAllFilters ? '收起' : `展开全部(${savedList.length}条)`;
        fragment.appendChild(expandBtn);
      }

      DOM.filterList.innerHTML = '';
      DOM.filterList.appendChild(fragment);
    } catch(e) {
      console.error('渲染方案列表失败', e);
    }
  },

  /**
   * 生成号码基础数据（使用统一数据查询模块）
   * @returns {Array} 号码列表
   */
  buildNumList: () => {
    try {
      const list = [];
      for(let i=1; i<=49; i++){
        const attrs = DataQuery.getNumAttrs(i);
        list.push({
          num: attrs.num,
          s: attrs.s,
          color: attrs.color,
          zodiac: attrs.zodiac,
          element: attrs.element,
          type: attrs.type,
          bs: attrs.bs,
          colorsx: attrs.colorsx,
          head: attrs.head,
          tail: attrs.tail,
          sum: attrs.sum,
          sumOdd: attrs.sumOdd,
          sumBig: attrs.sumBig,
          tailBig: attrs.tailBig,
          hot: '温号'
        });
      }
      StateManager.setState({ data: { ...StateManager._state.data, numList: list } }, false);
      return list;
    } catch(e) {
      console.error('生成号码列表失败', e);
      Toast.show('数据初始化失败，请刷新重试');
      return [];
    }
  },

  /**
   * 生成生肖循环
   * @returns {Object} 生肖信息
   */
  buildZodiacCycle: () => {
    try {
      // 获取当前农历生肖
      const now = new Date();
      const year = now.getFullYear();
      const thisYearSpring = new Date(CONFIG.SPRING_FESTIVAL[year]);
      const zodiacYear = now < thisYearSpring ? year - 1 : year;
      const branchIndex = (zodiacYear - 4) % 12;
      const currentBranch = CONFIG.EARTHLY_BRANCHES[branchIndex];
      const currentZodiac = CONFIG.ZODIAC_BASE[currentBranch];
      
      // 生成生肖循环数组
      const currentIndex = CONFIG.EARTHLY_BRANCHES.indexOf(currentBranch);
      const cycleBranches = [];
      for(let i=0; i<12; i++){
        const index = (currentIndex - i + 12) % 12;
        cycleBranches.push(CONFIG.EARTHLY_BRANCHES[index]);
      }
      const zodiacCycle = cycleBranches.map(branch => CONFIG.ZODIAC_BASE[branch]);

      StateManager.setState({ data: { ...StateManager._state.data, currentZodiac, zodiacCycle } }, false);
      
      // 生肖循环变化，重新初始化数据查询模块
      DataQuery._numToAttrMap = null;
      DataQuery._attrToNumMap = null;
      DataQuery.init();
      
      return { currentZodiac, zodiacCycle };
    } catch(e) {
      console.error('生成生肖循环失败', e);
      Toast.show('生肖数据初始化失败');
      const fallbackCycle = ['马','蛇','龙','兔','虎','牛','鼠','猪','狗','鸡','猴','羊'];
      StateManager.setState({ data: { ...StateManager._state.data, currentZodiac: '马', zodiacCycle: fallbackCycle } }, false);
      
      // 生肖循环变化，重新初始化数据查询模块
      DataQuery._numToAttrMap = null;
      DataQuery._attrToNumMap = null;
      DataQuery.init();
      
      return { currentZodiac: '马', zodiacCycle: fallbackCycle };
    }
  },

  /**
   * 隐藏加载遮罩
   */
  hideLoading: () => {
    DOM.loadingMask.classList.add('hide');
    setTimeout(() => {
      DOM.loadingMask.style.display = 'none';
    }, CONFIG.ANIM_NORMAL);
  }
};
