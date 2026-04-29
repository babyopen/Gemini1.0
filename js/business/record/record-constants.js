// ====================== 记录页面常量配置 ======================
/**
 * 记录页面常量配置
 * 集中管理所有魔法数字和字符串，便于维护和修改
 */

export const RECORD_CONSTANTS = {
  // 分页配置
  PAGE_SIZE: 5,
  COLLAPSE_THRESHOLD: 2,
  
  // 筛选配置
  VALID_NUM_COUNTS: ['5', '10', '15', '20'],
  DEFAULT_NUM_COUNT: '5',
  DEFAULT_PERIOD: '10',
  
  // 动画配置
  RENDER_DELAY: 100,
  DEBOUNCE_DELAY: 100,
  
  // 下拉刷新配置
  PULL_THRESHOLD: 60,
  PULL_MAX_DISTANCE: 100,
  
  // 显示配置
  SPECIAL_DISPLAY_COUNT: 5,
  
  // 检查配置
  CHECK_RECENT_COUNT: 20,
  
  // 历史记录模式
  HISTORY_MODES: {
    ALL: 'all',
    HOT: 'hot',
    COLD: 'cold'
  },
  
  // 缓存键
  CACHE_KEYS: {
    FAVORITES: 'favorites',
    ZODIAC_RECORDS: 'zodiacRecords',
    ML_PREDICTION_RECORDS: 'mlPredictionRecords',
    NUMBER_RECORDS: 'numberRecords',
    HOT_NUMBERS_RECORDS: 'hotNumbersRecords'
  },
  
  // 期数选项
  PERIOD_OPTIONS: ['10', '20', '30', 'all'],
  
  // 时间格式
  DATE_FORMAT: {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }
};
