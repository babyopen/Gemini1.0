// ====================== 1. 常量枚举配置（所有可配置项集中管理，冻结不可修改）======================
/**
 * 全局配置常量
 * @readonly
 * @enum {any}
 */
const CONFIG = Object.freeze({
  VERSION: 'V3.0',
  DATA_VERSION: 1,
  
  // API配置（默认值，用户可自定义）
  API: Object.freeze({
    // 主数据源
    LATEST: 'https://macaumarksix.com/api/macaujc2.com',
    HISTORY: 'https://history.macaumarksix.com/history/macaujc2/y/',
    
    // 备用数据源列表（按优先级排序）
    FALLBACK_SOURCES: Object.freeze([
      {
        name: '备用数据源1',
        latest: 'https://macaumarksix.com/api/macaujc2.com',
        history: 'https://history.macaumarksix.com/history/macaujc2/y/',
        priority: 1
      },
      {
        name: '备用数据源2',
        latest: 'https://api.macaumarksix.com/api',
        history: 'https://history.macaumarksix.com/history/',
        priority: 2
      }
    ])
  }),
  
  // 动画配置
  TOAST_DURATION: 2000,
  SCROLL_HIDE_DELAY: 1500,
  SCROLL_THROTTLE_DELAY: 100,
  CLICK_DEBOUNCE_DELAY: 50,
  
  // 布局配置
  BACK_TOP_THRESHOLD: 300,
  TOP_OFFSET: 240,
  PREVIEW_MAX_COUNT: 8,
  MAX_SAVE_COUNT: 30,
  
  // 生肖配置
  ZODIAC_BASE: Object.freeze({
    '子':'鼠','丑':'牛','寅':'虎','卯':'兔','辰':'龙','巳':'蛇',
    '午':'马','未':'羊','申':'猴','酉':'鸡','戌':'狗','亥':'猪'
  }),
  
  EARTHLY_BRANCHES: Object.freeze(['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']),
  
  SPRING_FESTIVAL: Object.freeze({
    2025: '2025-01-29',
    2026: '2026-02-17',
    2027: '2027-02-06',
    2028: '2028-01-26',
    2029: '2029-02-13',
    2030: '2030-02-03'
  }),
  
  // 分类配置
  JIAQIN: Object.freeze(['马','牛','羊','鸡','狗','猪']),
  YESHOU: Object.freeze(['鼠','虎','兔','龙','蛇','猴']),
  
  NUMBER_GROUPS: Object.freeze(['head','tail','sum','bs','hot','sumOdd','sumBig','tailBig']),
  
  // 号码规则配置
  COLOR_MAP: Object.freeze({
    '红':[1,2,7,8,12,13,18,19,23,24,29,30,34,35,40,45,46],
    '蓝':[3,4,9,10,14,15,20,25,26,31,36,37,41,42,47,48],
    '绿':[5,6,11,16,17,21,22,27,28,32,33,38,39,43,44,49]
  }),
  
  ELEMENT_MAP: Object.freeze({
    '金':[4,5,12,13,26,27,34,35,42,43],
    '木':[8,9,16,17,24,25,38,39,46,47],
    '水':[1,14,15,22,23,30,31,44,45],
    '火':[2,3,10,11,18,19,32,33,40,41,48,49],
    '土':[6,7,20,21,28,29,36,37]
  }),
  
  BIG_RANGE: [25, 49],
  SMALL_RANGE: [1, 24],
  
  // 分析模块配置
  ANALYSIS: Object.freeze({
    ZODIAC_ALL: Object.freeze(["鼠","牛","虎","兔","龙","蛇","马","羊","猴","鸡","狗","猪"]),
    HOME_ZODIAC: Object.freeze(['鼠','牛','兔','马','羊','鸡','狗','猪']),
    WILD_ZODIAC: Object.freeze(['虎','龙','蛇','猴']),
    ZODIAC_TRAD_TO_SIMP: Object.freeze({
      '鼠': '鼠', '牛': '牛', '虎': '虎', '兔': '兔',
      '龍': '龙', '龙': '龙', '蛇': '蛇', '馬': '马', '马': '马',
      '羊': '羊', '猴': '猴', '雞': '鸡', '鸡': '鸡', '狗': '狗',
      '豬': '猪', '猪': '猪'
    }),
    DEFAULT_PERIOD: 30,
    DEFAULT_SHOW_COUNT: 20
  }),
  
  // 动作枚举（避免硬编码字符串错误）
  ACTIONS: Object.freeze({
    // 分组操作
    RESET_GROUP: 'resetGroup',
    SELECT_GROUP: 'selectGroup',
    INVERT_GROUP: 'invertGroup',
    CLEAR_GROUP: 'clearGroup',
    // 全局操作
    SELECT_ALL: 'selectAllFilters',
    CLEAR_ALL: 'clearAllFilters',
    SAVE_FILTER: 'saveFilterPrompt',
    // 排除号码操作
    INVERT_EXCLUDE: 'invertExclude',
    UNDO_EXCLUDE: 'undoExclude',
    BATCH_EXCLUDE: 'batchExcludePrompt',
    CLEAR_EXCLUDE: 'clearExclude',
    // 方案操作
    TOGGLE_SHOW_ALL: 'toggleShowAllFilters',
    LOAD_FILTER: 'loadFilter',
    RENAME_FILTER: 'renameFilter',
    COPY_FILTER: 'copyFilterNums',
    TOP_FILTER: 'topFilter',
    DELETE_FILTER: 'deleteFilter',
    // 收藏操作
    FAVORITE_FILTER: 'favoriteFilter',
    LOAD_FAVORITE: 'loadFavorite',
    RENAME_FAVORITE: 'renameFavorite',
    COPY_FAVORITE: 'copyFavorite',
    // 导航操作
    SWITCH_NAV: 'switchBottomNav',
    // 我的页面菜单操作
    OPEN_SETTINGS: 'openSettings',
    OPEN_NOTIFICATION: 'openNotification',
    OPEN_PRIVACY: 'openPrivacy',
    CLEAR_CACHE: 'clearCache',
    OPEN_HELP: 'openHelp',
    OPEN_FEEDBACK: 'openFeedback',
    OPEN_ABOUT: 'openAbout',
    CHECK_UPDATE: 'checkUpdate'
  })
});

/**
 * API配置管理器（支持用户自定义数据源）
 * @namespace ApiConfig
 */
const ApiConfig = {
  /**
   * 存储key常量
   * @readonly
   */
  STORAGE_KEYS: Object.freeze({
    CUSTOM_API_CONFIG: 'customApiConfig'
  }),

  /**
   * 获取API配置（优先使用用户自定义配置，后备使用默认配置）
   * @returns {Object} API配置对象
   */
  getConfig: () => {
    try {
      const customConfigJson = localStorage.getItem(ApiConfig.STORAGE_KEYS.CUSTOM_API_CONFIG);
      if (customConfigJson) {
        const customConfig = JSON.parse(customConfigJson);
        if (customConfig.latest && customConfig.history) {
          return {
            LATEST: customConfig.latest,
            HISTORY: customConfig.history,
            FALLBACK_SOURCES: customConfig.fallbackSources || CONFIG.API.FALLBACK_SOURCES
          };
        }
      }
    } catch (error) {
      console.error('读取自定义API配置失败，使用默认配置:', error);
    }
    
    return CONFIG.API;
  },
  
  /**
   * 获取所有可用数据源（包括主数据源和备用数据源）
   * @returns {Array} 数据源列表
   */
  getAllDataSources: () => {
    const config = ApiConfig.getConfig();
    const sources = [];
    
    // 添加主数据源（优先级最高）
    sources.push({
      name: '主数据源',
      url: config.LATEST,
      priority: 0,
      isPrimary: true
    });
    
    // 添加备用数据源
    if (config.FALLBACK_SOURCES && Array.isArray(config.FALLBACK_SOURCES)) {
      config.FALLBACK_SOURCES.forEach(source => {
        sources.push({
          name: source.name,
          url: source.latest,
          priority: source.priority,
          isPrimary: false
        });
      });
    }
    
    return sources;
  },

  /**
   * 获取最新开奖API地址
   * @returns {string} 最新开奖API地址
   */
  getLatestApi: () => {
    const config = ApiConfig.getConfig();
    return config.LATEST;
  },

  /**
   * 获取历史数据API地址
   * @param {number} [year] - 年份
   * @returns {string} 历史数据API地址
   */
  getHistoryApi: (year) => {
    const config = ApiConfig.getConfig();
    let historyUrl = config.HISTORY;
    
    if (!historyUrl.endsWith('/')) {
      historyUrl += '/';
    }
    
    if (year) {
      return historyUrl + year;
    }
    return historyUrl;
  },
  
  /**
   * 获取所有历史数据源
   * @param {number} [year] - 年份
   * @returns {Array} 历史数据源列表
   */
  getAllHistorySources: (year) => {
    const config = ApiConfig.getConfig();
    const sources = [];
    
    // 添加主历史数据源
    let mainUrl = config.HISTORY;
    if (!mainUrl.endsWith('/')) {
      mainUrl += '/';
    }
    if (year) {
      mainUrl += year;
    }
    
    sources.push({
      name: '主数据源',
      url: mainUrl,
      priority: 0,
      isPrimary: true
    });
    
    // 添加备用历史数据源
    if (config.FALLBACK_SOURCES && Array.isArray(config.FALLBACK_SOURCES)) {
      config.FALLBACK_SOURCES.forEach(source => {
        let url = source.history;
        if (!url.endsWith('/')) {
          url += '/';
        }
        if (year) {
          url += year;
        }
        
        sources.push({
          name: source.name,
          url: url,
          priority: source.priority,
          isPrimary: false
        });
      });
    }
    
    return sources;
  },

  /**
   * 验证URL格式
   * @param {string} url - 要验证的URL
   * @returns {boolean} 是否有效
   */
  validateUrl: (url) => {
    if (!url || typeof url !== 'string') {
      return false;
    }
    
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (error) {
      return false;
    }
  },

  /**
   * 转义HTML特殊字符防止XSS
   * @param {string} text - 要转义的文本
   * @returns {string} 转义后的文本
   */
  escapeHtml: (text) => {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };
    
    return text.replace(/[&<>"'/]/g, (char) => escapeMap[char] || char);
  }
};

// 导出 CONFIG 和 ApiConfig
export { CONFIG, ApiConfig };
