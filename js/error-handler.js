// ====================== 错误处理模块 ======================
/**
 * 错误处理管理器
 * @namespace ErrorHandler
 */
import { Toast } from './toast.js';

export const ErrorHandler = {
  /**
   * 错误类型定义
   */
  ErrorType: {
    NETWORK: 'network',
    VALIDATION: 'validation',
    BUSINESS: 'business',
    SYSTEM: 'system',
    UNKNOWN: 'unknown'
  },

  /**
   * 错误级别
   */
  ErrorLevel: {
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
    CRITICAL: 'critical'
  },

  /**
   * 错误处理配置
   */
  config: {
    showToast: true,
    logErrors: true,
    captureErrors: true
  },

  /**
   * 初始化错误处理
   * @param {Object} config - 配置选项
   */
  init: (config = {}) => {
    ErrorHandler.config = { ...ErrorHandler.config, ...config };
    
    // 全局错误捕获
    window.addEventListener('error', ErrorHandler.handleGlobalError);
    window.addEventListener('unhandledrejection', ErrorHandler.handleUnhandledRejection);
  },

  /**
   * 处理全局错误
   * @param {ErrorEvent} event - 错误事件
   */
  handleGlobalError: (event) => {
    ErrorHandler.handleError({
      error: event.error,
      type: ErrorHandler.ErrorType.SYSTEM,
      level: ErrorHandler.ErrorLevel.CRITICAL,
      message: '全局错误',
      context: { event }
    });
  },

  /**
   * 处理未捕获的Promise拒绝
   * @param {PromiseRejectionEvent} event - 拒绝事件
   */
  handleUnhandledRejection: (event) => {
    ErrorHandler.handleError({
      error: event.reason,
      type: ErrorHandler.ErrorType.SYSTEM,
      level: ErrorHandler.ErrorLevel.ERROR,
      message: '未捕获的Promise拒绝',
      context: { event }
    });
  },

  /**
   * 处理错误
   * @param {Object} errorInfo - 错误信息
   * @param {Error} errorInfo.error - 错误对象
   * @param {string} errorInfo.type - 错误类型
   * @param {string} errorInfo.level - 错误级别
   * @param {string} errorInfo.message - 错误消息
   * @param {Object} errorInfo.context - 错误上下文
   * @returns {void}
   */
  handleError: (errorInfo) => {
    const {
      error,
      type = ErrorHandler.ErrorType.UNKNOWN,
      level = ErrorHandler.ErrorLevel.ERROR,
      message = '未知错误',
      context = {}
    } = errorInfo;

    // 构建错误对象
    const errorObj = {
      type,
      level,
      message,
      timestamp: new Date().toISOString(),
      stack: error?.stack || '',
      context
    };

    // 记录错误
    if (ErrorHandler.config.logErrors) {
      ErrorHandler.logError(errorObj);
    }

    // 显示错误提示
    if (ErrorHandler.config.showToast) {
      ErrorHandler.showErrorToast(errorObj);
    }

    // 捕获错误（可用于错误监控系统）
    if (ErrorHandler.config.captureErrors) {
      ErrorHandler.captureError(errorObj);
    }
  },

  /**
   * 记录错误
   * @param {Object} errorObj - 错误对象
   */
  logError: (errorObj) => {
    const { level, message, type, stack, context } = errorObj;
    
    switch (level) {
      case ErrorHandler.ErrorLevel.INFO:
        console.info(`[${type}] ${message}`, context);
        break;
      case ErrorHandler.ErrorLevel.WARN:
        console.warn(`[${type}] ${message}`, context);
        break;
      case ErrorHandler.ErrorLevel.ERROR:
        console.error(`[${type}] ${message}`, context, stack);
        break;
      case ErrorHandler.ErrorLevel.CRITICAL:
        console.error(`[CRITICAL] [${type}] ${message}`, context, stack);
        break;
      default:
        console.error(`[${type}] ${message}`, context, stack);
    }
  },

  /**
   * 显示错误提示
   * @param {Object} errorObj - 错误对象
   */
  showErrorToast: (errorObj) => {
    const { message, type } = errorObj;
    
    let displayMessage = message;
    
    // 根据错误类型显示不同的消息
    switch (type) {
      case ErrorHandler.ErrorType.NETWORK:
        displayMessage = displayMessage || '网络连接失败，请检查网络设置';
        break;
      case ErrorHandler.ErrorType.VALIDATION:
        displayMessage = displayMessage || '输入数据无效，请检查输入';
        break;
      case ErrorHandler.ErrorType.BUSINESS:
        // 业务错误通常有具体消息
        break;
      case ErrorHandler.ErrorType.SYSTEM:
        displayMessage = displayMessage || '系统错误，请稍后重试';
        break;
      default:
        displayMessage = displayMessage || '发生错误，请稍后重试';
    }
    
    Toast.show(displayMessage, 'error');
  },

  /**
   * 捕获错误（可用于错误监控系统）
   * @param {Object} errorObj - 错误对象
   */
  captureError: (errorObj) => {
    // 这里可以集成错误监控系统，如Sentry等
    // 暂时只做本地存储记录
    try {
      const errorHistory = JSON.parse(localStorage.getItem('errorHistory') || '[]');
      errorHistory.push(errorObj);
      // 只保留最近100条错误记录
      if (errorHistory.length > 100) {
        errorHistory.splice(0, errorHistory.length - 100);
      }
      localStorage.setItem('errorHistory', JSON.stringify(errorHistory));
    } catch (e) {
      console.error('保存错误记录失败:', e);
    }
  },

  /**
   * 包装函数，添加错误处理
   * @param {Function} fn - 要包装的函数
   * @param {Object} options - 选项
   * @returns {Function} 包装后的函数
   */
  wrap: (fn, options = {}) => {
    return function(...args) {
      try {
        return fn.apply(this, args);
      } catch (error) {
        ErrorHandler.handleError({
          error,
          ...options
        });
        return options.defaultValue;
      }
    };
  },

  /**
   * 包装异步函数，添加错误处理
   * @param {Function} fn - 要包装的异步函数
   * @param {Object} options - 选项
   * @returns {Function} 包装后的函数
   */
  wrapAsync: (fn, options = {}) => {
    return async function(...args) {
      try {
        return await fn.apply(this, args);
      } catch (error) {
        ErrorHandler.handleError({
          error,
          ...options
        });
        return options.defaultValue;
      }
    };
  }
};

// 默认初始化
ErrorHandler.init();
