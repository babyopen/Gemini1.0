// ====================== 路由模块 ======================
/**
 * 路由管理器
 * @namespace Router
 */
import { CONFIG } from './config.js';
import { Utils } from './utils.js';
import { Toast } from './toast.js';
import { ErrorHandler } from './error-handler.js';

export const Router = {
  /**
   * 页面映射
   */
  pages: {
    filter: {
      id: 'filterPage',
      name: '筛选',
      icon: 'filter',
      requireTopBox: true
    },
    analysis: {
      id: 'analysisPage',
      name: '分析',
      icon: 'analysis',
      requireTopBox: false
    },
    record: {
      id: 'recordPage',
      name: '记录',
      icon: 'record',
      requireTopBox: false
    },
    profile: {
      id: 'profilePage',
      name: '我的',
      icon: 'profile',
      requireTopBox: false
    }
  },

  /**
   * 当前页面
   */
  currentPage: 'filter',

  /**
   * 页面切换回调
   */
  pageChangeCallbacks: [],

  /**
   * 初始化路由
   */
  init: () => {
    try {
      // 初始化页面状态
      Router._initializePages();
      
      // 绑定底部导航事件
      Router._bindNavigationEvents();
      
      // 初始显示筛选页
      Router.navigate('filter');
      
      console.log('路由模块初始化完成');
    } catch (error) {
      ErrorHandler.handleError({
        error,
        type: ErrorHandler.ErrorType.SYSTEM,
        level: ErrorHandler.ErrorLevel.ERROR,
        message: '路由模块初始化失败',
        context: { function: 'Router.init' }
      });
    }
  },

  /**
   * 初始化页面状态
   * @private
   */
  _initializePages: () => {
    // 隐藏所有页面
    Object.values(Router.pages).forEach(page => {
      const element = document.getElementById(page.id);
      if (element) {
        element.style.display = 'none';
      }
    });
    
    // 显示顶部结果展示区（默认显示筛选页）
    const topBox = document.getElementById('topBox');
    if (topBox) {
      topBox.style.display = 'block';
    }
    
    // 设置 body-box 的 margin-top
    const bodyBox = document.querySelector('.body-box');
    if (bodyBox) {
      bodyBox.style.marginTop = 'var(--top-offset)';
    }
  },

  /**
   * 绑定导航事件
   * @private
   */
  _bindNavigationEvents: () => {
    // 绑定底部导航按钮事件
    const navButtons = document.querySelectorAll('.bottom-nav-item');
    navButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const pageKey = btn.dataset.page || btn.dataset.index;
        if (pageKey) {
          // 处理数字索引
          let targetPage;
          if (!isNaN(pageKey)) {
            const pageKeys = Object.keys(Router.pages);
            targetPage = pageKeys[Number(pageKey)] || 'filter';
          } else {
            targetPage = pageKey;
          }
          Router.navigate(targetPage);
        }
      });
    });
  },

  /**
   * 导航到指定页面
   * @param {string} pageKey - 页面键值
   * @param {Object} options - 选项
   * @returns {boolean} 是否导航成功
   */
  navigate: (pageKey, options = {}) => {
    try {
      const page = Router.pages[pageKey];
      if (!page) {
        throw new Error(`页面 ${pageKey} 不存在`);
      }
      
      // 隐藏所有页面
      Object.values(Router.pages).forEach(p => {
        const element = document.getElementById(p.id);
        if (element) {
          element.style.display = 'none';
        }
      });
      
      // 显示目标页面
      const targetElement = document.getElementById(page.id);
      if (!targetElement) {
        throw new Error(`页面元素 ${page.id} 不存在`);
      }
      targetElement.style.display = 'block';
      
      // 根据页面类型调整顶部结果展示区
      const topBox = document.getElementById('topBox');
      if (topBox) {
        if (page.requireTopBox) {
          topBox.style.display = 'block';
        } else {
          topBox.style.display = 'none';
        }
      }
      
      // 调整 body-box 的 margin-top
      const bodyBox = document.querySelector('.body-box');
      if (bodyBox) {
        if (page.requireTopBox) {
          bodyBox.style.marginTop = 'var(--top-offset)';
        } else {
          bodyBox.style.marginTop = '0';
        }
      }
      
      // 更新导航按钮状态
      const navButtons = document.querySelectorAll('.bottom-nav-item');
      navButtons.forEach(btn => {
        btn.classList.remove('active');
        const btnPageKey = btn.dataset.page || btn.dataset.index;
        let btnPage;
        if (!isNaN(btnPageKey)) {
          const pageKeys = Object.keys(Router.pages);
          btnPage = pageKeys[Number(btnPageKey)] || 'filter';
        } else {
          btnPage = btnPageKey;
        }
        if (btnPage === pageKey) {
          btn.classList.add('active');
        }
      });
      
      // 更新当前页面
      const previousPage = Router.currentPage;
      Router.currentPage = pageKey;
      
      // 触发页面切换回调
      Router._triggerPageChangeCallbacks(previousPage, pageKey);
      
      // 执行页面初始化逻辑
      if (!options.silent) {
        Router._initializePage(pageKey);
      }
      
      return true;
    } catch (error) {
      ErrorHandler.handleError({
        error,
        type: ErrorHandler.ErrorType.SYSTEM,
        level: ErrorHandler.ErrorLevel.ERROR,
        message: '页面导航失败',
        context: { function: 'Router.navigate', pageKey }
      });
      return false;
    }
  },

  /**
   * 初始化页面
   * @private
   * @param {string} pageKey - 页面键值
   */
  _initializePage: (pageKey) => {
    try {
      switch (pageKey) {
        case 'record':
          // 初始化记录页面
          if (window.Business && window.Business.record && window.Business.record.init) {
            window.Business.record.init();
          }
          break;
        case 'analysis':
          // 初始化分析页面
          if (window.Business && window.Business.initAnalysisPage) {
            window.Business.initAnalysisPage();
          }
          break;
        case 'profile':
          // 初始化个人页面
          // 可在此添加个人页面初始化逻辑
          break;
        case 'filter':
        default:
          // 筛选页面无需特殊初始化
          break;
      }
    } catch (error) {
      ErrorHandler.handleError({
        error,
        type: ErrorHandler.ErrorType.BUSINESS,
        level: ErrorHandler.ErrorLevel.WARN,
        message: `页面 ${pageKey} 初始化失败`,
        context: { function: 'Router._initializePage', pageKey }
      });
    }
  },

  /**
   * 触发页面切换回调
   * @private
   * @param {string} previousPage - 上一个页面
   * @param {string} currentPage - 当前页面
   */
  _triggerPageChangeCallbacks: (previousPage, currentPage) => {
    Router.pageChangeCallbacks.forEach(callback => {
      try {
        callback(previousPage, currentPage);
      } catch (error) {
        ErrorHandler.handleError({
          error,
          type: ErrorHandler.ErrorType.SYSTEM,
          level: ErrorHandler.ErrorLevel.WARN,
          message: '页面切换回调执行失败',
          context: { function: 'Router._triggerPageChangeCallbacks' }
        });
      }
    });
  },

  /**
   * 注册页面切换回调
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消注册函数
   */
  onPageChange: (callback) => {
    Router.pageChangeCallbacks.push(callback);
    return () => {
      const index = Router.pageChangeCallbacks.indexOf(callback);
      if (index > -1) {
        Router.pageChangeCallbacks.splice(index, 1);
      }
    };
  },

  /**
   * 获取当前页面
   * @returns {string} 当前页面键值
   */
  getCurrentPage: () => {
    return Router.currentPage;
  },

  /**
   * 获取当前页面信息
   * @returns {Object} 页面信息
   */
  getCurrentPageInfo: () => {
    return Router.pages[Router.currentPage];
  },

  /**
   * 检查页面是否存在
   * @param {string} pageKey - 页面键值
   * @returns {boolean} 是否存在
   */
  hasPage: (pageKey) => {
    return !!Router.pages[pageKey];
  },

  /**
   * 获取所有页面
   * @returns {Object} 页面映射
   */
  getPages: () => {
    return { ...Router.pages };
  }
};
