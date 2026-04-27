// ====================== 4. 存储模块（统一管理本地存储，加校验和兜底）======================
/**
 * 本地存储管理器
 * @namespace Storage
 */

// 导入必要的模块
import { CONFIG } from './config.js';
import { Utils } from './utils.js';
import { StateManager } from './state-manager.js';
import { Toast } from './toast.js';

export const Storage = {
  /**
   * 存储key常量
   * @readonly
   * @enum {string}
   */
  KEYS: Object.freeze({
    SAVED_FILTERS: 'savedFilters',
    DATA_VERSION: 'dataVersion',
    HISTORY_CACHE: 'historyCache',
    HISTORY_CACHE_TIME: 'historyCacheTime',
    ZODIAC_RECORDS: 'zodiacRecords',
    NUMBER_RECORDS: 'numberRecords',
    CUSTOM_API_CONFIG: 'customApiConfig'
  }),

  /**
   * 缓存有效期（毫秒）- 1小时
   * @readonly
   */
  CACHE_DURATION: 60 * 60 * 1000,



  /**
   * 预测状态枚举
   * @readonly
   */
  PREDICTION_STATUS: Object.freeze({
    PENDING: 'pending',
    HIT: 'hit',
    MISS: 'miss',
    PARTIAL: 'partial'
  }),

  /**
   * 内存兜底存储（隐私模式下localStorage不可用时使用）
   * @private
   */
  _memoryStorage: {},

  /**
   * 内存缓存（减少localStorage访问次数）
   * @private
   */
  _memoryCache: {},

  /**
   * 内存缓存有效期（毫秒）- 5分钟
   * @readonly
   */
  MEMORY_CACHE_DURATION: 5 * 60 * 1000,

  /**
   * 检测localStorage是否可用
   * @returns {boolean} 是否可用
   */
  isLocalStorageAvailable: () => {
    try {
      const testKey = '__test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch(e) {
      return false;
    }
  },

  /**
   * 获取存储数据
   * @param {string} key - 存储key
   * @param {any} defaultValue - 默认值
   * @returns {any} 存储的值
   */
  get: (key, defaultValue = null) => {
    try {
      // 检查内存缓存
      const cached = Storage._memoryCache[key];
      if (cached) {
        const now = Date.now();
        if (now - cached.timestamp < Storage.MEMORY_CACHE_DURATION) {
          return cached.value;
        }
        // 缓存过期，删除
        delete Storage._memoryCache[key];
      }

      let value;
      if(Storage.isLocalStorageAvailable()){
        const storedValue = localStorage.getItem(key);
        value = storedValue ? JSON.parse(storedValue) : defaultValue;
      } else {
        value = Storage._memoryStorage[key] || defaultValue;
      }

      // 更新内存缓存
      Storage._memoryCache[key] = {
        value: value,
        timestamp: Date.now()
      };

      return value;
    } catch(e) {
      console.error('存储读取失败', e);
      return defaultValue;
    }
  },

  /**
   * 写入存储数据
   * @param {string} key - 存储key
   * @param {any} value - 要存储的值
   * @returns {boolean} 是否成功
   */
  set: (key, value) => {
    try {
      const serialized = JSON.stringify(value);
      if(Storage.isLocalStorageAvailable()){
        localStorage.setItem(key, serialized);
      } else {
        Storage._memoryStorage[key] = value;
      }

      // 更新内存缓存
      Storage._memoryCache[key] = {
        value: value,
        timestamp: Date.now()
      };

      return true;
    } catch(e) {
      console.error('存储写入失败', e);
      Toast.show('保存失败，存储空间可能已满');
      return false;
    }
  },

  /**
   * 清除特定key的内存缓存
   * @param {string} key - 存储key
   */
  clearCache: (key) => {
    delete Storage._memoryCache[key];
  },

  /**
   * 清除所有内存缓存
   */
  clearAllCache: () => {
    Storage._memoryCache = {};
  },

  /**
   * 移除存储数据
   * @param {string} key - 存储key
   * @returns {boolean} 是否成功
   */
  remove: (key) => {
    try {
      if(Storage.isLocalStorageAvailable()){
        localStorage.removeItem(key);
      } else {
        delete Storage._memoryStorage[key];
      }

      // 从内存缓存中删除
      delete Storage._memoryCache[key];

      return true;
    } catch(e) {
      console.error('存储移除失败', e);
      return false;
    }
  },

  /**
   * 加载并校验保存的方案
   * @returns {Array} 合法的方案列表
   */
  loadSavedFilters: () => {
    // 数据版本校验
    const savedVersion = Storage.get(Storage.KEYS.DATA_VERSION, 0);
    if(savedVersion < CONFIG.DATA_VERSION){
      // 后续可添加数据迁移逻辑
      Storage.set(Storage.KEYS.DATA_VERSION, CONFIG.DATA_VERSION);
    }

    const rawList = Storage.get(Storage.KEYS.SAVED_FILTERS, []);
    const validList = Array.isArray(rawList) ? rawList.filter(Utils.validateFilterItem) : [];
    StateManager.setState({ filter: { ...StateManager._state.filter, savedFilters: validList } }, false);
    return validList;
  },

  /**
   * 保存方案到本地
   * @param {Object} filterItem - 方案对象
   * @returns {boolean} 是否成功
   */
  saveFilter: (filterItem) => {
    const state = StateManager._state;
    const newList = [filterItem, ...state.filter.savedFilters];
    const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
    if(success) StateManager.setState({ filter: { ...state.filter, savedFilters: newList } });
    return success;
  },

  /**
   * 加载收藏的方案
   * @returns {Array} 收藏的方案列表
   */
  loadFavorites: () => {
    const rawList = Storage.get('favorites', []);
    const validList = Array.isArray(rawList) ? rawList.filter(Utils.validateFilterItem) : [];
    StateManager.setState({ system: { ...StateManager._state.system, favorites: validList } }, false);
    return validList;
  },

  /**
   * 保存历史数据到缓存
   * @param {Array} historyData - 历史数据
   */
  saveHistoryCache: (historyData) => {
    Storage.set(Storage.KEYS.HISTORY_CACHE, historyData);
    Storage.set(Storage.KEYS.HISTORY_CACHE_TIME, Date.now());
  },

  /**
   * 加载缓存的历史数据
   * @returns {Object|null} 缓存的数据和是否过期
   */
  loadHistoryCache: () => {
    const cacheTime = Storage.get(Storage.KEYS.HISTORY_CACHE_TIME, 0);
    const now = Date.now();
    
    // 检查缓存是否过期
    if(now - cacheTime > Storage.CACHE_DURATION) {
      return { data: null, expired: true };
    }
    
    const historyData = Storage.get(Storage.KEYS.HISTORY_CACHE, []);
    return { data: historyData, expired: false };
  },

  /**
   * 清除历史数据缓存
   */
  clearHistoryCache: () => {
    Storage.remove(Storage.KEYS.HISTORY_CACHE);
    Storage.remove(Storage.KEYS.HISTORY_CACHE_TIME);
  },

  /**
   * 保存生肖记录
   * @param {Object} recordData - 生肖记录对象
   * @param {boolean} autoRefresh - 是否自动刷新记录页面
   * @returns {boolean} 是否成功
   */
  saveZodiacRecord: (recordData, autoRefresh = true) => {
    try {
      if (!recordData || !recordData.issue || !recordData.zodiacs) {
        console.error('保存生肖记录失败：数据不完整');
        return false;
      }

      const records = Storage.get(Storage.KEYS.ZODIAC_RECORDS, []);
      const existingIndex = records.findIndex(r => 
        r.issue === recordData.issue && 
        r.recordType === recordData.recordType
      );
      
      if (existingIndex >= 0) {
        records[existingIndex] = {
          ...records[existingIndex],
          ...recordData,
          updatedAt: Date.now()
        };
      } else {
        records.unshift({
          ...recordData,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          checked: false,
          matched: null
        });
      }
      
      if (records.length > 50) {
        records.splice(50);
      }
      
      const result = Storage.set(Storage.KEYS.ZODIAC_RECORDS, records);
      
      if (result && autoRefresh) {
        setTimeout(() => {
          window.dispatchEvent(new StorageEvent('storage', { key: 'zodiacRecords' }));
        }, 50);
      }
      
      return result;
    } catch (e) {
      console.error('保存生肖记录失败:', e);
      return false;
    }
  },

  /**
   * 加载生肖记录
   * @returns {Array} 生肖记录列表
   */
  loadZodiacRecords: () => {
    try {
      const records = Storage.get(Storage.KEYS.ZODIAC_RECORDS, []);
      return Array.isArray(records) ? records : [];
    } catch (e) {
      console.error('加载生肖记录失败:', e);
      return [];
    }
  },

  /**
   * 核对生肖记录
   * @param {string} issue - 期号
   * @param {string} actualZodiac - 实际开奖生肖
   * @returns {Object} 核对结果
   */
  checkZodiacRecord: (issue, actualZodiac) => {
    try {
      if (!issue || !actualZodiac) {
        return { success: false, message: '参数不完整' };
      }

      const records = Storage.get(Storage.KEYS.ZODIAC_RECORDS, []);
      let found = false;
      let allResults = [];
      
      // 查找所有匹配期号的记录并核对
      records.forEach((record, index) => {
        if (record.issue === issue) {
          found = true;
          if (record.zodiacs && Array.isArray(record.zodiacs)) {
            const matched = record.zodiacs.includes(actualZodiac);
            
            // 更新记录
            records[index] = {
              ...record,
              checked: true,
              matched: matched,
              actualZodiac: actualZodiac,
              checkedAt: Date.now()
            };
            
            allResults.push({ success: true, matched: matched, record: records[index] });
          }
        }
      });
      
      if (found) {
        Storage.set(Storage.KEYS.ZODIAC_RECORDS, records);
        return { success: true, results: allResults };
      }
      
      return { success: false, message: '未找到对应期号的记录' };
    } catch (e) {
      console.error('核对生肖记录失败:', e);
      return { success: false, message: '核对失败' };
    }
  },

  /**
   * 清除所有生肖记录
   * @returns {boolean} 是否成功
   */
  clearZodiacRecords: () => {
    try {
      return Storage.remove(Storage.KEYS.ZODIAC_RECORDS);
    } catch (e) {
      console.error('清除生肖记录失败:', e);
      return false;
    }
  },

  /**
   * 自动核对所有未核对的记录
   * @param {Object} drawData - 开奖数据 { issue, zodiac }
   * @returns {Object} 核对结果
   */
  autoCheckAllRecords: (drawData) => {
    try {
      if (!drawData || !drawData.issue || !drawData.zodiac) {
        return { success: false, message: '开奖数据不完整' };
      }

      const { issue, zodiac } = drawData;
      console.log('[AutoCheck] 🔄 开始自动核对比号:', issue, '开奖:', zodiac);

      // 使用现有的 checkZodiacRecord 方法
      const result = Storage.checkZodiacRecord(issue, zodiac);
      
      if (result.success) {
        console.log('[AutoCheck] ✅ 自动核对成功，共核对', result.results?.length || 0, '条记录');
        
        // 触发自定义事件，通知页面更新
        window.dispatchEvent(new CustomEvent('zodiacRecordsChecked', { 
          detail: { issue, zodiac, results: result.results } 
        }));
        
        // 触发存储事件
        window.dispatchEvent(new StorageEvent('storage', { key: Storage.KEYS.ZODIAC_RECORDS }));
      } else {
        console.warn('[AutoCheck] ⚠️ 自动核对失败:', result.message);
      }
      
      return result;
    } catch (e) {
      console.error('[AutoCheck] ❌ 自动核对异常:', e);
      return { success: false, message: '自动核对异常' };
    }
  },

  /**
   * 保存号码记录
   * @param {Object} recordData - 号码记录对象
   * @param {boolean} autoRefresh - 是否自动刷新记录页面
   * @returns {boolean} 是否成功
   */
  saveNumberRecord: (recordData, autoRefresh = true) => {
    try {
      if (!recordData || !recordData.issue || !recordData.numbers) {
        console.error('保存号码记录失败：数据不完整');
        return false;
      }

      const records = Storage.get(Storage.KEYS.NUMBER_RECORDS, []);
      
      const existingIndex = records.findIndex(r => 
        r.issue === recordData.issue && 
        r.period === recordData.period && 
        r.numCount === recordData.numCount
      );
      
      if (existingIndex >= 0) {
        records[existingIndex] = {
          ...records[existingIndex],
          ...recordData,
          updatedAt: Date.now()
        };
        console.log('🔄 更新现有记录:', { issue: recordData.issue, period: recordData.period, numCount: recordData.numCount });
      } else {
        records.unshift({
          ...recordData,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          checked: false,
          matched: null
        });
        console.log('➕ 添加新记录:', { issue: recordData.issue, period: recordData.period, numCount: recordData.numCount });
      }
      
      if (records.length > 200) {
        records.splice(200);
      }
      
      const result = Storage.set(Storage.KEYS.NUMBER_RECORDS, records);
      
      if (result && autoRefresh) {
        setTimeout(() => {
          window.dispatchEvent(new StorageEvent('storage', { key: 'numberRecords' }));
        }, 50);
      }
      
      return result;
    } catch (e) {
      console.error('保存号码记录失败:', e);
      return false;
    }
  },

  /**
   * 加载号码记录
   * @returns {Array} 号码记录列表
   */
  loadNumberRecords: () => {
    try {
      const records = Storage.get(Storage.KEYS.NUMBER_RECORDS, []);
      return Array.isArray(records) ? records : [];
    } catch (e) {
      console.error('加载号码记录失败:', e);
      return [];
    }
  },

  /**
   * 核对号码记录
   * @param {string} issue - 期号
   * @param {Array} actualNumbers - 实际开奖号码
   * @returns {Object} 核对结果
   */
  checkNumberRecord: (issue, actualNumbers) => {
    try {
      if (!issue || !actualNumbers || !Array.isArray(actualNumbers)) {
        return { success: false, message: '参数不完整' };
      }

      const records = Storage.get(Storage.KEYS.NUMBER_RECORDS, []);
      
      // ✅ 查找所有匹配该期号的记录（可能有多个，对应不同筛选条件）
      let updatedCount = 0;
      const updatedRecords = records.map(record => {
        if (record.issue === issue && record.numbers && Array.isArray(record.numbers)) {
          // 判断预测的号码中是否有任意一个命中实际开奖号码
          const matched = actualNumbers.some(num => record.numbers.includes(num));
          
          // 更新记录
          return {
            ...record,
            checked: true,
            matched: matched,
            actualNumbers: actualNumbers,
            checkedAt: Date.now()
          };
        }
        return record;
      });
      
      // 计算更新了多少条记录
      updatedCount = updatedRecords.filter((r, idx) => {
        return r.issue === issue && r.checked && records[idx].checked !== r.checked;
      }).length;
      
      if (updatedCount > 0) {
        Storage.set(Storage.KEYS.NUMBER_RECORDS, updatedRecords);
        return { 
          success: true, 
          message: `已核对 ${updatedCount} 条记录`,
          updatedCount: updatedCount
        };
      }
      
      return { success: false, message: '未找到对应期号的记录' };
    } catch (e) {
      console.error('核对号码记录失败:', e);
      return { success: false, message: '核对失败' };
    }
  },

  /**
   * ✅ 核对待码热门TOP5记录
   * @param {string} issue - 期号
   * @param {Array} actualNumbers - 实际开奖号码
   * @returns {Object} 核对结果
   */
  checkHotNumbersRecord: (issue, actualNumbers) => {
    try {
      if (!issue || !actualNumbers || !Array.isArray(actualNumbers)) {
        return { success: false, message: '参数不完整' };
      }

      const records = Storage.get('hotNumbersRecords', []);
      const recordIndex = records.findIndex(r => r.issue === issue);
      
      if (recordIndex >= 0) {
        const record = records[recordIndex];
        if (!record.numbers || !Array.isArray(record.numbers)) {
          return { success: false, message: '记录数据格式错误' };
        }
        
        // 判断预测的TOP5号码中是否有任意一个命中实际开奖号码
        const matched = actualNumbers.some(num => record.numbers.includes(num));
        
        // 更新记录
        records[recordIndex] = {
          ...record,
          checked: true,
          matched: matched,
          actualNumbers: actualNumbers,
          checkedAt: Date.now()
        };
        
        Storage.set('hotNumbersRecords', records);
        return { success: true, matched: matched, record: records[recordIndex] };
      }
      
      return { success: false, message: '未找到对应期号的记录' };
    } catch (e) {
      console.error('核对待码热门TOP5记录失败:', e);
      return { success: false, message: '核对失败' };
    }
  },

  /**
   * 核对 ML 预测记录
   * @param {string} issue - 期号
   * @param {string} actualZodiac - 实际开奖生肖
   * @returns {Object} 核对结果
   */
  checkMLPredictionRecord: (issue, actualZodiac) => {
    try {
      if (!issue || !actualZodiac) {
        return { success: false, message: '参数不完整' };
      }

      const records = Storage.get('mlPredictionRecords', []);
      
      // ✅ 查找所有匹配该期号的记录
      let updatedCount = 0;
      const updatedRecords = records.map(record => {
        if (record.issue === issue && record.predictions && Array.isArray(record.predictions)) {
          // 提取预测的生肖名称列表（去除百分比部分）
          const predictedZodiacs = record.predictions.map(z => z.split('(')[0].trim());
          
          // 判断实际开奖生肖是否在预测列表中
          const matched = predictedZodiacs.includes(actualZodiac);
          
          // 更新记录
          return {
            ...record,
            checked: true,
            matched: matched,
            actualZodiac: actualZodiac,
            checkedAt: Date.now()
          };
        }
        return record;
      });
      
      // 计算更新了多少条记录
      updatedCount = updatedRecords.filter((r, idx) => {
        return r.issue === issue && r.checked && records[idx].checked !== r.checked;
      }).length;
      
      if (updatedCount > 0) {
        Storage.set('mlPredictionRecords', updatedRecords);
        return { 
          success: true, 
          message: `已核对 ${updatedCount} 条记录`,
          updatedCount: updatedCount
        };
      }
      
      return { success: false, message: '未找到对应期号的记录' };
    } catch (e) {
      console.error('核对ML预测记录失败:', e);
      return { success: false, message: '核对失败' };
    }
  },

  /**
   * 清除所有号码记录
   * @returns {boolean} 是否成功
   */
  clearNumberRecords: () => {
    try {
      return Storage.remove(Storage.KEYS.NUMBER_RECORDS);
    } catch (e) {
      console.error('清除号码记录失败:', e);
      return false;
    }
  },

  /**
   * 保存特码热门TOP5记录
   * @param {Object} recordData - 特码热门TOP5记录对象
   * @param {boolean} autoRefresh - 是否自动刷新记录页面
   * @returns {boolean} 是否成功
   */
  saveHotNumbersRecord: (recordData, autoRefresh = true) => {
    try {
      if (!recordData || !recordData.issue || !recordData.numbers) {
        console.error('保存特码热门TOP5记录失败：数据不完整');
        return false;
      }

      const records = Storage.get('hotNumbersRecords', []);
      const existingIndex = records.findIndex(r => r.issue === recordData.issue);
      
      if (existingIndex >= 0) {
        records[existingIndex] = {
          ...records[existingIndex],
          ...recordData,
          updatedAt: Date.now()
        };
      } else {
        records.unshift({
          ...recordData,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
      
      if (records.length > 50) {
        records.splice(50);
      }
      
      const result = Storage.set('hotNumbersRecords', records);
      
      if (result && autoRefresh) {
        setTimeout(() => {
          window.dispatchEvent(new StorageEvent('storage', { key: 'hotNumbersRecords' }));
        }, 50);
      }
      
      return result;
    } catch (e) {
      console.error('保存特码热门TOP5记录失败:', e);
      return false;
    }
  },

  /**
   * 加载特码热门TOP5记录
   * @returns {Array} 特码热门TOP5记录列表
   */
  loadHotNumbersRecords: () => {
    try {
      const records = Storage.get('hotNumbersRecords', []);
      return Array.isArray(records) ? records : [];
    } catch (e) {
      console.error('加载特码热门TOP5记录失败:', e);
      return [];
    }
  },

  /**
   * 清除所有特码热门TOP5记录
   * @returns {boolean} 是否成功
   */
  clearHotNumbersRecords: () => {
    try {
      return Storage.set('hotNumbersRecords', []);
    } catch (e) {
      console.error('清除特码热门TOP5记录失败:', e);
      return false;
    }
  },

  /**
   * 保存自定义API配置
   * @param {Object} apiConfig - API配置对象
   * @param {string} apiConfig.latest - 最新开奖API地址
   * @param {string} apiConfig.history - 历史数据API地址
   * @returns {boolean} 是否保存成功
   */
  saveCustomApi: (apiConfig) => {
    try {
      if (!apiConfig || typeof apiConfig !== 'object') {
        Toast.show('API配置格式错误');
        return false;
      }
      
      const { latest, history } = apiConfig;
      if (!latest || !history) {
        Toast.show('请填写完整的API地址');
        return false;
      }
      
      // 验证URL格式
      const validateUrl = (url) => {
        if (!url || typeof url !== 'string') {
          return false;
        }
        try {
          const urlObj = new URL(url);
          return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch (error) {
          return false;
        }
      };
      
      if (!validateUrl(latest)) {
        Toast.show('最新开奖API地址格式无效');
        return false;
      }
      if (!validateUrl(history)) {
        Toast.show('历史数据API地址格式无效');
        return false;
      }
      
      // 转义URL防止XSS
      const escapeHtml = (text) => {
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
      };
      
      const escapedConfig = {
        latest: escapeHtml(latest),
        history: escapeHtml(history)
      };
      
      const success = Storage.set(Storage.KEYS.CUSTOM_API_CONFIG, escapedConfig);
      if (success) {
        Toast.show('API配置保存成功，请刷新页面生效');
      }
      return success;
    } catch (e) {
      console.error('保存自定义API配置失败:', e);
      Toast.show('保存失败，请重试');
      return false;
    }
  },

  /**
   * 加载自定义API配置
   * @returns {Object|null} API配置对象或null
   */
  loadCustomApi: () => {
    try {
      return Storage.get(Storage.KEYS.CUSTOM_API_CONFIG, null);
    } catch (e) {
      console.error('加载自定义API配置失败:', e);
      return null;
    }
  },

  /**
   * 重置自定义API配置（恢复为默认）
   * @returns {boolean} 是否重置成功
   */
  resetCustomApi: () => {
    try {
      const success = Storage.remove(Storage.KEYS.CUSTOM_API_CONFIG);
      if (success) {
        Toast.show('API配置已重置为默认，请刷新页面生效');
      }
      return success;
    } catch (e) {
      console.error('重置自定义API配置失败:', e);
      Toast.show('重置失败，请重试');
      return false;
    }
  }

}; 
