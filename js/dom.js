// ====================== 6. DOM缓存模块（所有常用DOM提前缓存，避免重复查询）======================
/**
 * DOM元素缓存 - 支持懒加载和缓存
 * @namespace DOM
 */

const _cache = new Map();
const _initialized = new Set();

const getElement = (id) => {
  if (_cache.has(id)) return _cache.get(id);
  const el = document.getElementById(id);
  if (el) _cache.set(id, el);
  return el;
};

const getElements = (selector) => {
  if (_cache.has(selector)) return _cache.get(selector);
  const els = document.querySelectorAll(selector);
  _cache.set(selector, els);
  return els;
};

// 创建代理对象，支持直接访问如 DOM.resultNums
const _createProxy = () => new Proxy({}, {
  get: (_, prop) => {
    if (prop === 'get') return getElement;
    if (prop === 'getAll') return getElements;
    if (prop === 'getSafe') {
      return (id) => {
        const el = getElement(id);
        if (!el) console.warn(`[DOM] Element not found: ${id}`);
        return el;
      };
    }
    if (prop === 'init') return init;
    if (prop === 'clearCache') return clearCache;
    if (prop === 'refresh') return refresh;
    return getElement(prop);
  },
  has: (_, prop) => _cache.has(prop),
  ownKeys: () => Array.from(_cache.keys()),
  getOwnPropertyDescriptor: (_, prop) => {
    if (_cache.has(prop)) {
      return { enumerable: true, configurable: true, value: _cache.get(prop) };
    }
    return undefined;
  }
});

const init = () => {
  const elements = [
    'loadingMask', 'resultCount', 'resultNums', 'excludeCount',
    'excludeGrid', 'lockExclude', 'filterList', 'zodiacTags',
    'quickNavBtn', 'quickNavMenu', 'navTabs', 'backTopBtn',
    'latestBalls', 'curExpect', 'countdown', 'historyList',
    'hotWrap', 'emptyTip', 'hotNumber', 'zodiacContent',
    'zodiacPredictionGrid', 'mlPredictionSection', 'mlGrid',
    'mlModelStatus', 'mlPredictionResult', 'trainModelBtn',
    'runMlPredictBtn', 'specialHistoryList', 'hotNumbersHistoryList',
    'favoriteList', 'predictionStatisticsBody', 'selectedZodiacHistoryList'
  ];

  elements.forEach(id => {
    const el = document.getElementById(id);
    if (el) _cache.set(id, el);
  });

  _initialized.add('common');
  console.log(`[DOM] Cached ${elements.length} common elements`);
};

const clearCache = () => {
  _cache.clear();
  _initialized.clear();
  console.log('[DOM] Cache cleared');
};

const refresh = (id) => {
  _cache.delete(id);
  return getElement(id);
};

// 使用Proxy支持 DOM.xxx 方式访问
export const DOM = _createProxy();
