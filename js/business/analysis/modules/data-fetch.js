// ====================== 数据获取模块 ======================

import { CONFIG, ApiConfig } from '../../../config.js';
import { Storage } from '../../../storage.js';
import { StateManager } from '../../../state-manager.js';
import { Toast } from '../../../toast.js';
import { PerformanceMonitor } from '../../../performance-monitor.js';
import { IssueManager } from '../../issue-manager.js';
import { analysisRender } from './analysis-render.js';
import { analysisCalc } from './analysis-calc.js';

export const dataFetch = {
  /**
   * 带超时的 fetch 请求
   * @private
   * @param {string} url - 请求 URL
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise} - 返回 fetch 响应
   */
  _fetchWithTimeout: (url, timeout = 10000) => {
    return Promise.race([
      fetch(url),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('请求超时')), timeout)
      )
    ]);
  },

  /**
   * 记录日志
   * @private
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   * @param {Error} error - 错误对象
   */
  _log: (level, message, error = null) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    
    switch (level) {
      case 'error':
        if (error) {
          console.error(logMessage, error);
        } else {
          console.error(logMessage);
        }
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
      case 'debug':
        console.debug(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  },

  /**
   * 获取最新开奖记录
   * @private
   * @param {number} retries - 重试次数
   * @returns {Promise<Array>} - 返回最新开奖记录
   */
  _fetchLatestData: async (retries = 3) => {
    dataFetch._log('info', `开始获取最新开奖记录，重试次数: ${retries}`);
    
    // 定义多个数据源（主数据源和备用数据源）
    const dataSources = [
      {
        name: '主数据源',
        url: ApiConfig.getLatestApi()
      },
      {
        name: '备用数据源1',
        url: 'https://api.ka666.com/latest'
      },
      {
        name: '备用数据源2',
        url: 'https://api.macau6.com/latest'
      }
    ];
    
    // 尝试每个数据源
    for (const source of dataSources) {
      dataFetch._log('info', `尝试从 ${source.name} 获取最新开奖数据: ${source.url}`);
      
      for (let i = 0; i < retries; i++) {
        try {
          dataFetch._log('info', `尝试 ${i + 1}/${retries} 获取数据...`);
          const res = await dataFetch._fetchWithTimeout(source.url);
          
          dataFetch._log('debug', `响应状态: ${res.status} ${res.statusText}`);
          
          if (!res.ok) {
            throw new Error(`API请求失败: ${res.status} ${res.statusText}`);
          }
          
          dataFetch._log('info', '响应成功，开始解析数据...');
          const data = await res.json();
          dataFetch._log('info', `数据解析成功，数据长度: ${data ? data.length : 0}`);
          
          return data || [];
        } catch (e) {
          dataFetch._log('error', `从 ${source.name} 获取最新开奖记录失败（尝试 ${i + 1}/${retries}）:`, e);
          if (i === retries - 1) {
            dataFetch._log('warn', `${source.name} 不可用，尝试下一个数据源`);
            break; // 尝试下一个数据源
          }
          // 等待一段时间后重试
          const waitTime = 1000 * (i + 1);
          dataFetch._log('info', `等待 ${waitTime} 毫秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    // 所有数据源都失败
    throw new Error('所有数据源都不可用');
  },

  /**
   * 带重试机制的历史数据获取
   * @private
   * @param {number} year - 年份
   * @param {number} retries - 重试次数
   * @returns {Promise<Array>} - 返回历史数据
   */
  _fetchHistoryData: async (year, retries = 3) => {
    dataFetch._log('info', `开始获取历史数据，年份: ${year}，重试次数: ${retries}`);
    const url = ApiConfig.getHistoryApi(year);
    dataFetch._log('debug', `请求URL: ${url}`);
    
    for (let i = 0; i < retries; i++) {
      try {
        dataFetch._log('info', `尝试 ${i + 1}/${retries} 获取数据...`);
        const res = await dataFetch._fetchWithTimeout(url);
        
        dataFetch._log('debug', `响应状态: ${res.status} ${res.statusText}`);
        
        if (!res.ok) {
          throw new Error(`API请求失败: ${res.status} ${res.statusText}`);
        }
        
        dataFetch._log('info', '响应成功，开始解析数据...');
        const data = await res.json();
        dataFetch._log('info', `数据解析成功，数据长度: ${data.data ? data.data.length : 0}`);
        
        return data.data || [];
      } catch (e) {
        dataFetch._log('error', `获取历史数据失败（尝试 ${i + 1}/${retries}）:`, e);
        if (i === retries - 1) {
          throw e;
        }
        // 等待一段时间后重试
        const waitTime = 1000 * (i + 1);
        dataFetch._log('info', `等待 ${waitTime} 毫秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  },

  /**
   * 处理历史数据
   * @private
   * @param {Array} rawData - 原始数据
   * @returns {Array} - 处理后的数据
   */
  _processHistoryData: (rawData) => {
    if (!rawData || !Array.isArray(rawData)) return [];
    
    // 过滤无效数据并标准化字段名
    const filteredData = rawData.filter(item => {
      const expect = item?.expect || '';
      const openCode = item?.openCode || item?.opencode || '';
      return expect && openCode && openCode.split(',').length === 7;
    }).map(item => {
      // 标准化字段名，兼容不同的命名方式
      return {
        expect: item?.expect || '',
        opentime: item?.openTime || item?.opentime || '',
        opencode: item?.openCode || item?.opencode || '',
        openCode: item?.openCode || item?.opencode || '', // 保持兼容
        wave: item?.wave || '',
        zodiac: item?.zodiac || ''
      };
    });

    // 去重并排序
    const uniqueMap = new Map();
    filteredData.forEach(item => {
      const expectNum = Number(item?.expect || 0);
      if (expectNum && !isNaN(expectNum)) {
        uniqueMap.set(expectNum, item);
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => {
      return Number(b?.expect || 0) - Number(a?.expect || 0);
    });
  },

  /**
   * 检查数据是否有变化
   * @param {Array} currentData - 当前数据
   * @param {Array} newData - 新数据
   * @returns {boolean} 数据是否有变化
   */
  hasDataChanged: (currentData, newData) => {
    if(!currentData || !newData) return true;
    if(currentData.length !== newData.length) return true;
    
    // 比较最新的几期数据
    const compareCount = Math.min(5, currentData.length);
    for(let i = 0; i < compareCount; i++) {
      if(currentData[i]?.expect !== newData[i]?.expect) {
        return true;
      }
      if(currentData[i]?.openCode !== newData[i]?.openCode) {
        return true;
      }
    }
    
    return false;
  },

  /**
   * 处理数据更新
   * @private
   * @param {Array} sortedData - 处理后的数据
   * @param {boolean} silent - 是否静默模式
   */
  _handleDataUpdate: (sortedData, silent = false) => {
    // 验证数据准确性
    const currentData = StateManager._state.analysis.historyData;
    if (!dataFetch.verifyDataAccuracy(sortedData, currentData)) {
      dataFetch._log('warn', '数据验证失败，不更新本地数据');
      if (!silent) Toast.show('数据验证失败，可能是数据异常');
      return;
    }

    // 检查数据是否有变化
    const hasDataChanged = dataFetch.hasDataChanged(currentData, sortedData);

    if (hasDataChanged) {
      dataFetch._log('info', '数据有变化，开始更新');
      
      // 更新状态
      const newAnalysis = { 
        ...StateManager._state.analysis, 
        historyData: sortedData,
        lastUpdateTime: Date.now()
      };
      StateManager.setState({ analysis: newAnalysis }, false);

      // 保存到缓存
      Storage.saveHistoryCache(sortedData);
      dataFetch._log('info', '数据已保存到本地存储');

      // 渲染
      analysisRender.renderLatest(sortedData[0]);
      analysisRender.renderHistory();
      analysisRender.renderFullAnalysis();
      analysisRender.renderZodiacAnalysis();
      analysisRender.updateHotColdStatus();
      
      // 更新预测标题
      IssueManager.updatePredictionTitles();
      
      // 静默更新所有期数的预测历史
      import('../../prediction.js').then(({ prediction }) => {
        prediction.silentUpdateAllPredictionHistory();
        // 同时更新精选特码历史的开奖记录比较
        prediction.updateSpecialHistoryComparison();
        // 重新渲染精选特码历史以显示最新比较结果
        prediction.renderSpecialHistory();
      });
      
      if(!silent) Toast.show('数据加载成功');
    } else if (!silent) {
      Toast.show('数据已是最新');
    }
    
    // 无论数据是否有变化，都检查历史数据中的最新记录并进行核对
    // 优先在历史开奖记录中查找核对，如果有数据就不用触发最新开奖结果接口
    dataFetch._checkAndUpdateRecords(sortedData);
  },

  /**
   * 检查并更新记录
   * @private
   * @param {Array} sortedData - 处理后的数据
   */
  _checkAndUpdateRecords: (sortedData) => {
    if (sortedData.length > 0) {
      // ✅ 检查最近20期的开奖数据，确保早期记录也能被核对（第一时间更新）
      const recentItems = sortedData.slice(0, 20);
      
      import('../../record.js').then(({ record }) => {
        recentItems.forEach(item => {
          const issue = item.expect;
          const s = analysisCalc.getSpecial(item);
          const resultZodiac = s.zod;
          
          // 提取实际开奖号码
          const openCode = item.openCode || '';
          const actualNumbers = openCode.split(',').map(num => num.trim()).filter(num => num);
          
          // 自动核对生肖记录
          record.checkZodiacRecord(issue, resultZodiac);
          // 自动核对号码记录（精选特码）
          if (actualNumbers.length > 0) {
            record.checkNumberRecord(issue, actualNumbers);
            // ✅ 自动核对待码热门TOP5记录
            record.checkHotNumbersRecord(issue, actualNumbers);
            // ✅ 自动核对ML预测记录
            record.checkMLPredictionRecord(issue, resultZodiac);
          }
        });
      });
    }
  },

  /**
   * 尝试使用模拟数据
   * @private
   * @param {boolean} silent - 是否静默模式
   */
  _tryUseMockData: (silent = false) => {
    try {
      const mockData = dataFetch.getMockHistoryData();
      const currentData = StateManager._state.analysis.historyData;
      const hasDataChanged = dataFetch.hasDataChanged(currentData, mockData);
      
      if (hasDataChanged) {
        const newAnalysis = { 
          ...StateManager._state.analysis, 
          historyData: mockData 
        };
        StateManager.setState({ analysis: newAnalysis }, false);
        
        // 渲染
        analysisRender.renderLatest(mockData[0]);
        analysisRender.renderHistory();
        analysisRender.renderFullAnalysis();
        analysisRender.renderZodiacAnalysis();
        analysisRender.updateHotColdStatus();
        
        if(!silent) Toast.show('已使用模拟数据');
      }
    } catch(mockError) {
      console.debug('使用模拟数据失败:', mockError.message);
    }
  },

  /**
   * 从本地存储加载历史数据
   * @returns {Object|null} 缓存的数据和是否过期
   * @private
   */
  _loadHistoryFromStorage: () => {
    try {
      const cacheData = Storage.get(Storage.KEYS.HISTORY_CACHE, null);
      const cacheTime = Storage.get(Storage.KEYS.HISTORY_CACHE_TIME, 0);
      const now = Date.now();
      
      // 检查缓存是否存在
      if (cacheData && Array.isArray(cacheData) && cacheData.length > 0) {
        // 最新开奖数据缓存时间较短（5分钟）
        const latestCacheTime = Storage.get('latestDataCacheTime', 0);
        const latestDataExpired = now - latestCacheTime > 5 * 60 * 1000;
        
        // 历史数据缓存时间较长（24小时）
        const historyDataExpired = now - cacheTime > 24 * 60 * 60 * 1000;
        
        return {
          data: cacheData,
          latestExpired: latestDataExpired,
          historyExpired: historyDataExpired,
          lastUpdate: cacheTime
        };
      }
      return null;
    } catch (e) {
      dataFetch._log('error', '从本地存储加载历史数据失败:', e);
      return null;
    }
  },

  /**
   * 保存历史数据到本地存储
   * @param {Array} data - 历史数据
   * @private
   */
  _saveHistoryToStorage: (data) => {
    try {
      Storage.set(Storage.KEYS.HISTORY_CACHE, data);
      Storage.set(Storage.KEYS.HISTORY_CACHE_TIME, Date.now());
      dataFetch._log('info', '历史数据已保存到本地存储');
    } catch (e) {
      dataFetch._log('error', '保存历史数据到本地存储失败:', e);
    }
  },

  /**
   * 静默刷新历史数据（不显示加载状态）
   */
  silentRefreshHistory: async () => {
    try {
      dataFetch._log('info', '开始静默刷新历史数据');
      
      // 先尝试从本地存储加载数据
      const cachedData = dataFetch._loadHistoryFromStorage();
      if (cachedData) {
        dataFetch._log('info', '从本地存储加载历史数据成功');
        dataFetch._handleDataUpdate(cachedData.data, true);
      }
      
      // ✅ 无论是否在开奖时间窗口内，都尝试获取最新数据
      let latestData = [];
      let historyData = [];
      let hasError = false;
      
      // 尝试获取最新开奖记录（失败不影响历史数据获取）
      try {
        latestData = await dataFetch._fetchLatestData();
        dataFetch._log('info', '获取最新开奖记录成功');
      } catch (latestError) {
        dataFetch._log('warn', '获取最新开奖记录失败，将尝试获取历史数据:', latestError);
        hasError = true;
      }
      
      // 尝试获取历史数据
      try {
        const year = new Date().getFullYear();
        historyData = await dataFetch._fetchHistoryData(year);
        dataFetch._log('info', '获取历史数据成功');
      } catch (historyError) {
        dataFetch._log('warn', '获取历史数据失败:', historyError);
        hasError = true;
      }
      
      // 合并数据，最新开奖记录优先
      const combinedData = [...latestData, ...historyData];
      
      if (combinedData.length > 0) {
        const sortedData = dataFetch._processHistoryData(combinedData);
        // 处理数据更新
        dataFetch._handleDataUpdate(sortedData, true);
        // 保存到本地存储
        dataFetch._saveHistoryToStorage(sortedData);
        dataFetch._log('info', '静默刷新历史数据成功');
        
        // ✅ 数据更新后，自动保存精选特码记录
        dataFetch._autoSaveSpecialRecords();
      } else {
        // 没有任何数据，使用模拟数据
        dataFetch._log('warn', '没有获取到任何数据，使用模拟数据');
        dataFetch._tryUseMockData(true);
      }
    } catch(e) {
      dataFetch._log('warn', '静默刷新失败（API可能不可用）:', e);
      // 不显示错误，保持静默
      // 尝试使用模拟数据
      dataFetch._tryUseMockData(true);
    }
  },

  /**
   * 刷新历史数据
   * @param {boolean} silent - 是否静默模式（不显示提示）
   */
  refreshHistory: async (silent = false) => {
    return PerformanceMonitor.monitorFetch(async () => {
      const historyList = document.getElementById('historyList');
      if(historyList && !silent) historyList.innerHTML = '<div style="padding:20px;text-align:center;">加载中...</div>';
      
      try {
        dataFetch._log('info', '开始刷新历史数据');
        
        // 先尝试从本地存储加载数据
        const cachedData = dataFetch._loadHistoryFromStorage();
        if (cachedData && historyList && !silent) {
          dataFetch._log('info', '从本地存储加载历史数据成功');
          dataFetch._handleDataUpdate(cachedData.data, silent);
          // 显示缓存数据，同时继续尝试刷新
          historyList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--sub-text);">加载中，显示缓存数据...</div>';
        }
        
        // 手动刷新时，无论是否在开奖时间窗口内，都尝试获取最新数据
        let latestData = [];
        let historyData = [];
        let hasError = false;
        
        // 尝试获取最新开奖记录（失败不影响历史数据获取）
        try {
          latestData = await dataFetch._fetchLatestData();
          dataFetch._log('info', '获取最新开奖记录成功');
        } catch (latestError) {
          dataFetch._log('warn', '获取最新开奖记录失败，将尝试获取历史数据:', latestError);
          hasError = true;
        }
        
        // 尝试获取历史数据
        try {
          const year = new Date().getFullYear();
          historyData = await dataFetch._fetchHistoryData(year);
          dataFetch._log('info', '获取历史数据成功');
        } catch (historyError) {
          dataFetch._log('error', '获取历史数据失败:', historyError);
          hasError = true;
        }
        
        // 合并数据，最新开奖记录优先
        const combinedData = [...latestData, ...historyData];
        
        if (combinedData.length > 0) {
          const sortedData = dataFetch._processHistoryData(combinedData);
          // 处理数据更新
          dataFetch._handleDataUpdate(sortedData, silent);
          // 保存到本地存储
          dataFetch._saveHistoryToStorage(sortedData);
          dataFetch._log('info', '刷新历史数据成功');
          
          // ✅ 数据更新后，自动保存精选特码记录
          if (!silent) {
            dataFetch._autoSaveSpecialRecords();
          }
          
          if (hasError && !silent) {
            Toast.show('部分数据加载失败，显示缓存数据');
          }
        } else {
          // 没有任何数据，使用模拟数据
          dataFetch._log('warn', '没有获取到任何数据，使用模拟数据');
          dataFetch._tryUseMockData(silent);
          if (!silent) {
            Toast.show('数据加载失败，显示模拟数据');
          }
        }
      } catch(e) {
        dataFetch._log('error', '加载历史数据失败:', e);
        if(historyList && !silent) {
          historyList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--danger);">数据加载失败，可能是网络问题</div>';
        }
        if(!silent) Toast.show('数据加载失败，可能是网络问题');
        
        // 尝试使用模拟数据
        dataFetch._tryUseMockData(silent);
      }
      
      const loadMore = document.getElementById('loadMore');
      if(loadMore) {
        loadMore.style.display = StateManager._state.analysis.historyData.length > StateManager._state.analysis.showCount ? 'block' : 'none';
      }
    }, 'dataFetch');
  },

  /**
   * 获取模拟历史数据
   * @returns {Array} 模拟历史数据
   */
  getMockHistoryData: () => {
    const mockData = [];
    const zodiacs = CONFIG.ANALYSIS.ZODIAC_ALL;
    const colors = ['红', '蓝', '绿'];
    
    for(let i = 1; i <= 50; i++) {
      const te = Math.floor(Math.random() * 49) + 1;
      const codeArr = [];
      const zodArr = [];
      
      // 生成6个普通号码
      for(let j = 0; j < 6; j++) {
        let num;
        do {
          num = Math.floor(Math.random() * 49) + 1;
        } while(codeArr.includes(num));
        codeArr.push(num);
        zodArr.push(zodiacs[Math.floor(Math.random() * 12)]);
      }
      
      // 添加特码
      codeArr.push(te);
      zodArr.push(zodiacs[Math.floor(Math.random() * 12)]);
      
      mockData.push({
        expect: `2026${String(i).padStart(3, '0')}`,
        opentime: `2026-0${Math.floor(Math.random() * 12) + 1}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
        openCode: codeArr.join(','),
        zodiac: zodArr.join(','),
        openCodeArr: codeArr,
        zodiacArr: zodArr
      });
    }
    
    return mockData;
  },

  /**
   * 检查是否在开奖时间窗口内
   * @returns {boolean} 是否在时间窗口内
   */
  _isInDrawTimeWindow: () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // 开奖时间窗口为21:32-21:35
    return hours === 21 && minutes >= 32 && minutes <= 35;
  },

  /**
   * ✅ 后台自动保存精选特码记录
   * 自动获取分析数据并保存所有16种组合（期数×数量）
   */
  _autoSaveSpecialRecords: async () => {
    try {
      const state = StateManager._state;
      const { historyData } = state.analysis;
      
      // 检查是否有数据
      if (!historyData || historyData.length === 0) {
        dataFetch._log('warn', '无历史数据，跳过自动保存精选特码记录');
        return;
      }
      
      // 计算完整分析
      const fullData = analysisCalc.calcFullAnalysis();
      if (!fullData) {
        dataFetch._log('warn', '无法计算分析数据，跳过自动保存精选特码记录');
        return;
      }
      
      // 获取热号和冷号
      const config = CONFIG?.ANALYSIS || {};
      const topCount = config.TOP_ZODIAC_COUNT || 12;
      const fullNumZodiacMap = state.analysis?.fullNumZodiacMap || {};
      
      // 获取热门号码
      const hotNumbers = analysisCalc.getHotNumbers(fullData, topCount, fullNumZodiacMap);
      // 获取冷门号码
      const coldNumbers = analysisCalc.getColdNumbers(fullData, topCount, fullNumZodiacMap);
      
      if (!hotNumbers || hotNumbers.length === 0) {
        dataFetch._log('warn', '无热门号码数据，跳过自动保存精选特码记录');
        return;
      }
      
      // 获取最终显示的号码（使用热门号码作为主要数据）
      const finalNums = hotNumbers.map(item => {
        if (typeof item === 'object' && item.num !== undefined) {
          return item.num;
        }
        return item;
      });
      
      // 调用保存方法（使用 'hot' 模式）
      await analysisRender.autoSaveSpecialRecord(finalNums, hotNumbers, coldNumbers, 'hot');
      
      dataFetch._log('info', '✅ 后台自动保存精选特码记录成功');
    } catch (e) {
      dataFetch._log('warn', '后台自动保存精选特码记录失败:', e);
      // 不显示错误，保持静默
    }
  },

  /**
   * 计算距离下次开奖的时间（毫秒）
   * @returns {number} 距离下次开奖的时间
   */
  _getNextDrawTime: () => {
    const now = new Date();
    const nextDraw = new Date();
    nextDraw.setHours(21, 33, 0, 0);
    
    // 如果当前时间已经过了今天的开奖时间，设置为明天的开奖时间
    if (now > nextDraw) {
      nextDraw.setDate(nextDraw.getDate() + 1);
    }
    
    return nextDraw - now;
  },

  /**
   * 定时获取开奖数据
   */
  startScheduledDataFetch: () => {
    dataFetch._log('info', '启动定时获取开奖数据服务');
    
    // 立即检查一次
    dataFetch._checkAndFetchData();
    
    // 每5分钟检查一次
    setInterval(() => {
      dataFetch._checkAndFetchData();
    }, 5 * 60 * 1000);
  },

  /**
   * 检查并获取数据
   * @private
   */
  _checkAndFetchData: async () => {
    try {
      // 检查是否在开奖时间窗口内
      if (dataFetch._isInDrawTimeWindow()) {
        dataFetch._log('info', '在开奖时间窗口内，开始获取最新数据');
        await dataFetch.silentRefreshHistory();
      }
    } catch (e) {
      dataFetch._log('error', '定时检查数据失败:', e);
    }
  },

  /**
   * 核对数据准确性
   * @param {Array} newData - 新获取的数据
   * @param {Array} localData - 本地数据
   * @returns {boolean} 数据是否准确
   */
  verifyDataAccuracy: (newData, localData) => {
    if (!newData || newData.length === 0) {
      dataFetch._log('warn', '新数据为空，无法验证');
      return false;
    }
    
    // 获取最新的一条记录
    const latestNewData = newData[0];
    const latestLocalData = localData && localData.length > 0 ? localData[0] : null;
    
    // 验证数据格式
    if (!latestNewData.expect || !latestNewData.openCode) {
      dataFetch._log('warn', '新数据格式不正确');
      return false;
    }
    
    // 验证期号是否合理（递增）
    if (latestLocalData) {
      const newIssue = parseInt(latestNewData.expect);
      const localIssue = parseInt(latestLocalData.expect);
      
      if (newIssue < localIssue) {
        dataFetch._log('warn', '新数据期号小于本地数据期号');
        return false;
      }
      
      // 验证开奖号码格式
      const newCodeArr = latestNewData.openCode.split(',');
      if (newCodeArr.length !== 7) {
        dataFetch._log('warn', '新数据开奖号码格式不正确');
        return false;
      }
    }
    
    dataFetch._log('info', '数据验证通过');
    return true;
  }
};