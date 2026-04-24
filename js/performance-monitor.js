// ====================== 性能监控模块 ======================
/**
 * 性能监控器
 * @namespace PerformanceMonitor
 */

export const PerformanceMonitor = {
  /**
   * 性能指标存储
   * @private
   */
  _metrics: {
    pageLoad: {
      start: 0,
      end: 0,
      duration: 0
    },
    dataFetch: {
      count: 0,
      totalDuration: 0,
      averageDuration: 0,
      maxDuration: 0,
      minDuration: Infinity
    },
    dataProcessing: {
      count: 0,
      totalDuration: 0,
      averageDuration: 0,
      maxDuration: 0,
      minDuration: Infinity
    },
    rendering: {
      count: 0,
      totalDuration: 0,
      averageDuration: 0,
      maxDuration: 0,
      minDuration: Infinity
    },
    memory: {
      current: 0,
      peak: 0
    }
  },

  /**
   * 标记开始时间
   * @param {string} metric - 指标名称
   * @returns {number} 开始时间戳
   */
  markStart: (metric) => {
    const startTime = performance.now();
    if (PerformanceMonitor._metrics[metric]) {
      PerformanceMonitor._metrics[metric].start = startTime;
    }
    return startTime;
  },

  /**
   * 标记结束时间并计算持续时间
   * @param {string} metric - 指标名称
   * @param {number} [startTime] - 开始时间戳
   * @returns {number} 持续时间（毫秒）
   */
  markEnd: (metric, startTime) => {
    const endTime = performance.now();
    const actualStartTime = startTime || PerformanceMonitor._metrics[metric]?.start || endTime;
    const duration = endTime - actualStartTime;

    if (PerformanceMonitor._metrics[metric]) {
      PerformanceMonitor._metrics[metric].end = endTime;
      PerformanceMonitor._metrics[metric].duration = duration;

      // 对于计数类型的指标，更新统计数据
      if (PerformanceMonitor._metrics[metric].count !== undefined) {
        PerformanceMonitor._metrics[metric].count++;
        PerformanceMonitor._metrics[metric].totalDuration += duration;
        PerformanceMonitor._metrics[metric].averageDuration = 
          PerformanceMonitor._metrics[metric].totalDuration / PerformanceMonitor._metrics[metric].count;
        PerformanceMonitor._metrics[metric].maxDuration = 
          Math.max(PerformanceMonitor._metrics[metric].maxDuration, duration);
        PerformanceMonitor._metrics[metric].minDuration = 
          Math.min(PerformanceMonitor._metrics[metric].minDuration, duration);
      }
    }

    return duration;
  },

  /**
   * 监控数据获取性能
   * @param {Function} fetchFn - 数据获取函数
   * @param {string} [label] - 标签
   * @returns {Promise<any>} 数据获取结果
   */
  monitorFetch: async (fetchFn, label = 'dataFetch') => {
    const startTime = PerformanceMonitor.markStart(label);
    try {
      const result = await fetchFn();
      PerformanceMonitor.markEnd(label, startTime);
      return result;
    } catch (error) {
      PerformanceMonitor.markEnd(label, startTime);
      throw error;
    }
  },

  /**
   * 监控数据处理性能
   * @param {Function} processFn - 数据处理函数
   * @param {string} [label] - 标签
   * @returns {any} 数据处理结果
   */
  monitorProcessing: (processFn, label = 'dataProcessing') => {
    const startTime = PerformanceMonitor.markStart(label);
    try {
      const result = processFn();
      PerformanceMonitor.markEnd(label, startTime);
      return result;
    } catch (error) {
      PerformanceMonitor.markEnd(label, startTime);
      throw error;
    }
  },

  /**
   * 监控渲染性能
   * @param {Function} renderFn - 渲染函数
   * @param {string} [label] - 标签
   * @returns {any} 渲染结果
   */
  monitorRendering: (renderFn, label = 'rendering') => {
    const startTime = PerformanceMonitor.markStart(label);
    try {
      const result = renderFn();
      PerformanceMonitor.markEnd(label, startTime);
      return result;
    } catch (error) {
      PerformanceMonitor.markEnd(label, startTime);
      throw error;
    }
  },

  /**
   * 更新内存使用情况
   */
  updateMemoryUsage: () => {
    if (performance.memory) {
      const memory = performance.memory;
      PerformanceMonitor._metrics.memory.current = memory.usedJSHeapSize;
      PerformanceMonitor._metrics.memory.peak = Math.max(
        PerformanceMonitor._metrics.memory.peak,
        memory.usedJSHeapSize
      );
    }
  },

  /**
   * 获取性能指标
   * @returns {Object} 性能指标
   */
  getMetrics: () => {
    PerformanceMonitor.updateMemoryUsage();
    return JSON.parse(JSON.stringify(PerformanceMonitor._metrics));
  },

  /**
   * 重置性能指标
   */
  resetMetrics: () => {
    PerformanceMonitor._metrics = {
      pageLoad: {
        start: 0,
        end: 0,
        duration: 0
      },
      dataFetch: {
        count: 0,
        totalDuration: 0,
        averageDuration: 0,
        maxDuration: 0,
        minDuration: Infinity
      },
      dataProcessing: {
        count: 0,
        totalDuration: 0,
        averageDuration: 0,
        maxDuration: 0,
        minDuration: Infinity
      },
      rendering: {
        count: 0,
        totalDuration: 0,
        averageDuration: 0,
        maxDuration: 0,
        minDuration: Infinity
      },
      memory: {
        current: 0,
        peak: 0
      }
    };
  },

  /**
   * 打印性能指标
   */
  logMetrics: () => {
    try {
      const metrics = PerformanceMonitor.getMetrics();
      console.log('====================================');
      console.log('性能监控指标');
      console.log('====================================');
      
      // 页面加载时间
      const pageLoadDuration = metrics.pageLoad?.duration || 0;
      console.log('页面加载时间:', (typeof pageLoadDuration === 'number' ? pageLoadDuration.toFixed(2) : '0.00'), 'ms');
      
      // 数据获取
      const dataFetchCount = metrics.dataFetch?.count || 0;
      const dataFetchAvg = metrics.dataFetch?.averageDuration || 0;
      const dataFetchMax = metrics.dataFetch?.maxDuration || 0;
      const dataFetchMin = metrics.dataFetch?.minDuration === Infinity ? 0 : (metrics.dataFetch?.minDuration || 0);
      console.log('数据获取:', 
        `计数: ${dataFetchCount}, `,
        `平均: ${(typeof dataFetchAvg === 'number' ? dataFetchAvg.toFixed(2) : '0.00')}ms, `,
        `最大: ${(typeof dataFetchMax === 'number' ? dataFetchMax.toFixed(2) : '0.00')}ms, `,
        `最小: ${(typeof dataFetchMin === 'number' ? dataFetchMin.toFixed(2) : '0.00')}ms`
      );
      
      // 数据处理
      const dataProcessingCount = metrics.dataProcessing?.count || 0;
      const dataProcessingAvg = metrics.dataProcessing?.averageDuration || 0;
      const dataProcessingMax = metrics.dataProcessing?.maxDuration || 0;
      const dataProcessingMin = metrics.dataProcessing?.minDuration === Infinity ? 0 : (metrics.dataProcessing?.minDuration || 0);
      console.log('数据处理:', 
        `计数: ${dataProcessingCount}, `,
        `平均: ${(typeof dataProcessingAvg === 'number' ? dataProcessingAvg.toFixed(2) : '0.00')}ms, `,
        `最大: ${(typeof dataProcessingMax === 'number' ? dataProcessingMax.toFixed(2) : '0.00')}ms, `,
        `最小: ${(typeof dataProcessingMin === 'number' ? dataProcessingMin.toFixed(2) : '0.00')}ms`
      );
      
      // 渲染
      const renderingCount = metrics.rendering?.count || 0;
      const renderingAvg = metrics.rendering?.averageDuration || 0;
      const renderingMax = metrics.rendering?.maxDuration || 0;
      const renderingMin = metrics.rendering?.minDuration === Infinity ? 0 : (metrics.rendering?.minDuration || 0);
      console.log('渲染:', 
        `计数: ${renderingCount}, `,
        `平均: ${(typeof renderingAvg === 'number' ? renderingAvg.toFixed(2) : '0.00')}ms, `,
        `最大: ${(typeof renderingMax === 'number' ? renderingMax.toFixed(2) : '0.00')}ms, `,
        `最小: ${(typeof renderingMin === 'number' ? renderingMin.toFixed(2) : '0.00')}ms`
      );
      
      // 内存使用
      const memoryCurrent = metrics.memory?.current || 0;
      const memoryPeak = metrics.memory?.peak || 0;
      console.log('内存使用:', 
        `当前: ${(typeof memoryCurrent === 'number' ? (memoryCurrent / 1024 / 1024).toFixed(2) : '0.00')}MB, `,
        `峰值: ${(typeof memoryPeak === 'number' ? (memoryPeak / 1024 / 1024).toFixed(2) : '0.00')}MB`
      );
      
      console.log('====================================');
    } catch (error) {
      console.error('打印性能指标失败:', error);
    }
  },

  /**
   * 初始化性能监控
   */
  init: () => {
    // 监控页面加载时间
    PerformanceMonitor.markStart('pageLoad');
    
    window.addEventListener('load', () => {
      PerformanceMonitor.markEnd('pageLoad');
      console.log('页面加载时间:', PerformanceMonitor._metrics.pageLoad.duration.toFixed(2), 'ms');
    });
    
    // 定期更新内存使用情况
    setInterval(() => {
      PerformanceMonitor.updateMemoryUsage();
    }, 5000);
    
    console.log('性能监控已初始化');
  }
};
