// ====================== 2.5. 数据查询模块（统一数据查询，打通所有关联关系）======================
/**
 * 数据查询模块 - 打通生肖、五行、波色、家禽野兽、大小单双等所有关联关系
 * @namespace DataQuery
 */
import { CONFIG } from './config.js';

import { StateManager } from './state-manager.js';

const _lazyInitPromise = null;
const _initQueue = [];

export const DataQuery = {
  /**
   * 缓存：号码到所有属性的映射
   * @private
   */
  _numToAttrMap: null,
  
  /**
   * 缓存：属性到号码的反向映射
   * @private
   */
  _attrToNumMap: null,
  
  /**
   * 缓存：条件查询结果
   * @private
   */
  _conditionCache: new Map(),

  /**
   * 检查是否已初始化
   * @returns {boolean}
   */
  isInitialized: () => DataQuery._numToAttrMap !== null && DataQuery._attrToNumMap !== null,

  /**
   * 延迟初始化（提高应用启动速度）
   * @returns {Promise}
   */
  initAsync: async () => {
    if (DataQuery.isInitialized()) return;
    
    await new Promise(resolve => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', resolve, { once: true });
      }
    });
    
    DataQuery.init();
    
    _initQueue.forEach(fn => {
      try { fn(); } catch (e) { console.error('init callback error:', e); }
    });
    _initQueue.length = 0;
  },

  /**
   * 初始化数据查询模块（预计算所有映射关系）
   */
  init: () => {
    if(DataQuery._numToAttrMap && DataQuery._attrToNumMap) {
      return;
    }
    
    DataQuery._numToAttrMap = {};
    DataQuery._attrToNumMap = {
      zodiac: {},
      color: {},
      element: {},
      type: {},
      head: {},
      tail: {},
      sum: {},
      bs: {},
      colorsx: {},
      big: {},
      odd: {},
      sumOdd: {},
      sumBig: {},
      tailBig: {}
    };
    
    for(let num = 1; num <= 49; num++) {
      const attrs = DataQuery.getNumAttrs(num);
      DataQuery._numToAttrMap[num] = attrs;
      
      Object.keys(attrs).forEach(key => {
        if(DataQuery._attrToNumMap[key]) {
          if(!DataQuery._attrToNumMap[key][attrs[key]]) {
            DataQuery._attrToNumMap[key][attrs[key]] = [];
          }
          DataQuery._attrToNumMap[key][attrs[key]].push(num);
        }
      });
    }
  },

  /**
   * 清除缓存
   */
  clearCache: () => {
    DataQuery._numToAttrMap = null;
    DataQuery._attrToNumMap = null;
    DataQuery._conditionCache.clear();
  },
  
  /**
   * 批量获取多个号码的属性（优化批量查询）
   * @param {Array<number>} nums - 号码数组
   * @returns {Array<Object>} 属性数组
   */
  getBatchNumAttrs: (nums) => {
    DataQuery.init();
    return nums.map(num => DataQuery.getNumAttrs(num));
  },
  
  /**
   * 预加载号码属性（批量初始化）
   * @param {Array<number>} nums - 号码数组
   */
  preloadNumAttrs: (nums) => {
    DataQuery.init();
    nums.forEach(num => DataQuery.getNumAttrs(num));
  },

  /**
   * 获取单个号码的所有属性
   * @param {number} num - 号码 (1-49)
   * @returns {Object} 包含所有属性的对象
   */
  getNumAttrs: (num) => {
    num = Number(num);
    
    // 优先从缓存获取
    if(DataQuery._numToAttrMap && DataQuery._numToAttrMap[num]) {
      return DataQuery._numToAttrMap[num];
    }
    
    const s = num.toString().padStart(2, '0');
    const head = Math.floor(num / 10);
    const tail = num % 10;
    const sum = head + tail;
    const big = num >= 25 ? '大' : '小';
    const odd = num % 2 === 1 ? '单' : '双';
    const bs = big + odd;
    
    // 合单/合双/合大/合小
    const sumOdd = sum % 2 === 1 ? '合单' : '合双';
    const sumBig = sum >= 7 ? '合大' : '合小';
    
    // 尾大/尾小
    const tailBig = tail >= 5 ? '尾大' : '尾小';
    
    const color = Object.keys(CONFIG.COLOR_MAP).find(c => CONFIG.COLOR_MAP[c].includes(num));
    const element = Object.keys(CONFIG.ELEMENT_MAP).find(e => CONFIG.ELEMENT_MAP[e].includes(num));
    
    const type = CONFIG.JIAQIN.includes(DataQuery._getZodiacByNum(num)) ? '家禽' : '野兽';
    
    const attrs = {
      num,
      s,
      color,
      element,
      zodiac: DataQuery._getZodiacByNum(num),
      type,
      head,
      tail,
      sum,
      big,
      odd,
      bs,
      colorsx: color + odd,
      sumOdd,
      sumBig,
      tailBig
    };
    
    // 缓存结果
    if(DataQuery._numToAttrMap) {
      DataQuery._numToAttrMap[num] = attrs;
    }
    
    return attrs;
  },

  /**
   * 根据号码获取生肖（私有辅助方法）
   * @private
   * @param {number} num - 号码
   * @returns {string} 生肖
   */
  _getZodiacByNum: (num) => {
    const state = StateManager._state;
    if(state.data && state.data.zodiacCycle && state.data.zodiacCycle.length === 12) {
      return state.data.zodiacCycle[(num - 1) % 12];
    }
    const fallbackCycle = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
    return fallbackCycle[(num - 1) % 12];
  },

  /**
   * 通过属性获取号码列表
   * @param {string} attrType - 属性类型 (zodiac/color/element/type/head/tail/sum/bs/colorsx)
   * @param {string|number} attrValue - 属性值
   * @returns {Array<number>} 号码列表
   */
  getNumsByAttr: (attrType, attrValue) => {
    DataQuery.init();
    if(!DataQuery._attrToNumMap[attrType]) {
      return [];
    }
    return DataQuery._attrToNumMap[attrType][attrValue] || [];
  },

  /**
   * 生成条件缓存键
   * @private
   * @param {Object} conditions - 查询条件
   * @returns {string} 缓存键
   */
  _getConditionCacheKey: (conditions) => {
    return JSON.stringify(Object.keys(conditions).sort().map(key => [key, conditions[key]]));
  },

  /**
   * 批量查询：通过多个属性获取交集号码
   * @param {Object} conditions - 查询条件对象 {zodiac: '鼠', color: '红', ...}
   * @returns {Array<number>} 符合所有条件的号码列表
   */
  getNumsByConditions: (conditions) => {
    DataQuery.init();
    
    // 生成缓存键
    const cacheKey = DataQuery._getConditionCacheKey(conditions);
    
    // 优先从缓存获取
    if(DataQuery._conditionCache.has(cacheKey)) {
      return DataQuery._conditionCache.get(cacheKey);
    }
    
    // 优化：先获取最小的号码集合，再进行筛选
    let result = null;
    let minLength = Infinity;
    
    // 找出条件中号码数量最少的属性
    Object.keys(conditions).forEach(attrType => {
      const attrValue = conditions[attrType];
      const nums = DataQuery.getNumsByAttr(attrType, attrValue);
      if(nums.length < minLength) {
        minLength = nums.length;
        result = nums;
      }
    });
    
    // 如果没有条件，返回所有号码
    if(result === null) {
      result = Array.from({length: 49}, (_, i) => i + 1);
    }
    
    // 对剩余条件进行筛选
    Object.keys(conditions).forEach(attrType => {
      const attrValue = conditions[attrType];
      const nums = DataQuery.getNumsByAttr(attrType, attrValue);
      // 使用Set提高查找效率
      const numSet = new Set(nums);
      result = result.filter(n => numSet.has(n));
    });
    
    // 缓存结果
    DataQuery._conditionCache.set(cacheKey, result);
    
    return result;
  },

  /**
   * 检查号码是否符合某个属性
   * @param {number} num - 号码
   * @param {string} attrType - 属性类型
   * @param {string|number} attrValue - 属性值
   * @returns {boolean}
   */
  checkNumAttr: (num, attrType, attrValue) => {
    const attrs = DataQuery.getNumAttrs(num);
    return attrs[attrType] === attrValue;
  },

  /**
   * 获取两个号码的所有共同属性
   * @param {number} num1 - 号码1
   * @param {number} num2 - 号码2
   * @returns {Array<string>} 共同属性列表
   */
  getCommonAttrs: (num1, num2) => {
    const attrs1 = DataQuery.getNumAttrs(num1);
    const attrs2 = DataQuery.getNumAttrs(num2);
    const common = [];
    
    ['zodiac', 'color', 'element', 'type', 'big', 'odd', 'bs', 'colorsx'].forEach(key => {
      if(attrs1[key] === attrs2[key]) {
        common.push(key);
      }
    });
    
    return common;
  }
};
