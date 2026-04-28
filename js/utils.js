// ====================== 2. 工具函数模块（纯函数，无副作用）======================
/**
 * 通用工具函数
 * @namespace Utils
 */
import { CONFIG } from './config.js';
import { DataQuery } from './data-query.js';

export const Utils = {
  /**
   * 节流函数（优化高频事件）
   * @param {Function} fn - 要执行的函数
   * @param {number} delay - 节流延迟(ms)
   * @returns {Function} 节流后的函数
   */
  throttle: (fn, delay) => {
    let lastTime = 0;
    let timer = null;
    return function(...args) {
      const now = Date.now();
      const remaining = delay - (now - lastTime);
      
      if (remaining <= 0) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        lastTime = now;
        fn.apply(this, args);
      } else if (!timer) {
        timer = setTimeout(() => {
          lastTime = Date.now();
          timer = null;
          fn.apply(this, args);
        }, remaining);
      }
    }
  },

  /**
   * 防抖函数（优化高频点击）
   * @param {Function} fn - 要执行的函数
   * @param {number} delay - 防抖延迟(ms)
   * @returns {Function} 防抖后的函数
   */
  debounce: (fn, delay) => {
    let timer = null;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    }
  },

  /**
   * 左滑删除处理器（通用版）
   * 支持所有历史记录容器的左滑删除功能
   * @namespace SwipeDeleteHandler
   */
  SwipeDeleteHandler: {
    _activeItem: null,
    _threshold: 80,
    _directionThreshold: 15,
    _maxAngle: 40,

    // 计算滑动角度
    _getSwipeAngle: (deltaX, deltaY) => {
      const angle = Math.atan2(Math.abs(deltaY), Math.abs(deltaX)) * 180 / Math.PI;
      return angle;
    },

    // 显示删除指示器
    _showDeleteIndicator: (item, progress) => {
      if (!item) return;
      
      let indicator = item.querySelector('.swipe-delete-indicator');
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'swipe-delete-indicator';
        item.appendChild(indicator);
      }
      indicator.style.transform = `scaleY(${Math.min(progress, 1)})`;
    },

    // 隐藏删除指示器
    _hideDeleteIndicator: (item) => {
      if (!item) return;
      
      const indicator = item.querySelector('.swipe-delete-indicator');
      if (indicator) {
        indicator.style.transform = 'scaleY(0)';
        setTimeout(() => {
          try {
            if (indicator && indicator.parentNode) {
              indicator.remove();
            }
          } catch (e) {
            // 忽略错误
          }
        }, 200);
      }
    },

    // 显示删除按钮
    _showDeleteButton: function(item, deleteCallback) {
      if (!item) {
        console.warn('[Utils] 显示删除按钮失败：item 为空');
        return;
      }
      
      // 如果已经有删除按钮显示在其他item上，先隐藏它
      if (this._activeItem && this._activeItem !== item) {
        this._hideDeleteButton(this._activeItem);
      }
      
      // 移除已存在的删除按钮
      const existingBtn = item.querySelector('.swipe-delete-btn');
      if (existingBtn) {
        existingBtn.remove();
      }
      
      // 创建删除按钮
      const deleteBtn = document.createElement('div');
      deleteBtn.className = 'swipe-delete-btn';
      deleteBtn.textContent = '🗑️ 删除';
      
      // 阻止删除按钮上的触摸事件冒泡
      deleteBtn.addEventListener('touchstart', (e) => {
        e.stopPropagation();
      }, { passive: true });
      
      deleteBtn.addEventListener('touchmove', (e) => {
        e.stopPropagation();
      }, { passive: true });
      
      deleteBtn.addEventListener('touchend', (e) => {
        e.stopPropagation();
        e.preventDefault();
      }, { passive: false });
      
      // 点击删除按钮显示确认弹窗
      const handler = this;
      deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handler._showDeleteConfirmDialog(item, deleteCallback);
      });
      
      item.appendChild(deleteBtn);
      
      // 动画显示删除按钮
      requestAnimationFrame(() => {
        deleteBtn.style.transform = 'translateX(0)';
      });
      
      // 设置当前激活的item
      this._activeItem = item;
      
      // 点击其他地方关闭删除按钮
      const closeHandler = (e) => {
        // 如果点击的是删除按钮本身或其子元素，不关闭
        if (deleteBtn.contains(e.target)) {
          return;
        }
        // 如果点击的不是 item 内的元素，关闭
        if (!item.contains(e.target)) {
          handler._hideDeleteButton(item);
          document.removeEventListener('click', closeHandler);
          handler._activeItem = null;
        }
      };
      
      // 延迟添加点击监听，避免立即触发
      setTimeout(() => {
        document.addEventListener('click', closeHandler);
      }, 100);
    },

    // 隐藏删除按钮
    _hideDeleteButton: function(item) {
      if (!item) return;
      
      const deleteBtn = item.querySelector('.swipe-delete-btn');
      if (deleteBtn) {
        deleteBtn.style.transform = 'translateX(100%)';
        setTimeout(() => {
          try {
            if (deleteBtn && deleteBtn.parentNode) {
              deleteBtn.remove();
            }
          } catch (e) {
            // 忽略错误
          }
        }, 300);
      }
      
      // 恢复内容位置
      item.style.transform = 'translateX(0)';
      item.style.transition = 'transform 0.3s ease-out';
      item.style.willChange = 'auto';
      
      // 清除激活状态
      if (this._activeItem === item) {
        this._activeItem = null;
      }
    },

    // 执行删除操作
    _performDelete: async (item, deleteCallback) => {
      try {
        if (!item || !deleteCallback || typeof deleteCallback !== 'function') {
          console.error('[Utils] 删除参数无效');
          return false;
        }

        // 获取当前高度
        const currentHeight = item.offsetHeight;
        
        // 设置初始状态
        item.style.height = currentHeight + 'px';
        item.style.overflow = 'hidden';
        
        // 强制浏览器重绘
        item.offsetHeight;
        
        // 添加删除动画
        item.style.transition = 'height 0.3s ease-out, opacity 0.3s ease-out, transform 0.3s ease-out';
        item.style.transform = 'translateX(-100%)';
        item.style.opacity = '0';
        
        // 等待动画完成后执行删除
        setTimeout(() => {
          // 设置高度为 0
          item.style.height = '0';
          item.style.paddingTop = '0';
          item.style.paddingBottom = '0';
          item.style.marginTop = '0';
          item.style.marginBottom = '0';
          
          setTimeout(() => {
            try {
              // 清理事件绑定，防止内存泄漏
              if (typeof record !== 'undefined' && record && typeof record._unbindSwipeDelete === 'function') {
                record._unbindSwipeDelete(item);
              }
              
              // 移除元素
              if (item.parentNode) {
                item.remove();
              }
              
              // 执行删除回调
              deleteCallback();
            } catch (error) {
              console.error('[Utils] 删除回调执行失败:', error);
            }
          }, 300);
        }, 300);

        return true;
      } catch (e) {
        console.error('[Utils] 删除失败', e);
        return false;
      }
    },
    
    // ✅ 显示删除确认弹窗
    _showDeleteConfirmDialog: (item, deleteCallback) => {
      // 检查是否已经有弹窗存在，避免重复显示
      const existingOverlay = document.querySelector('.delete-confirm-overlay');
      if (existingOverlay) {
        return;
      }
      
      // 创建弹窗遮罩层
      const overlay = document.createElement('div');
      overlay.className = 'delete-confirm-overlay';
      
      // 创建弹窗内容
      const dialog = document.createElement('div');
      dialog.className = 'dialog-content';
      
      dialog.innerHTML = `
        <div class="delete-confirm-icon">⚠️</div>
        <div class="delete-confirm-title">确认删除</div>
        <div class="delete-confirm-message">删除后将无法恢复，确定要删除吗？</div>
        <div class="delete-confirm-buttons">
          <button class="cancel-delete-btn">取消</button>
          <button class="confirm-delete-btn">确定删除</button>
        </div>
      `;
      
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      
      // 动画显示
      requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        dialog.style.transform = 'scale(1)';
      });
      
      // 取消按钮处理
      const cancelBtn = dialog.querySelector('.cancel-delete-btn');
      let cancelHandled = false;
      const handleCancel = () => {
        if (cancelHandled) return;
        cancelHandled = true;
        
        Utils.SwipeDeleteHandler._closeDeleteDialog(overlay);
        if (item) {
          Utils.SwipeDeleteHandler._hideDeleteButton(item);
        }
        if (typeof Toast !== 'undefined') {
          Toast.show('已取消删除');
        }
      };
      cancelBtn.addEventListener('click', handleCancel);
      
      // 确认按钮处理
      const confirmBtn = dialog.querySelector('.confirm-delete-btn');
      let confirmHandled = false;
      const handleConfirm = () => {
        if (confirmHandled) return;
        confirmHandled = true;
        
        Utils.SwipeDeleteHandler._closeDeleteDialog(overlay);
        if (item && deleteCallback) {
          Utils.SwipeDeleteHandler._performDelete(item, deleteCallback);
        }
      };
      confirmBtn.addEventListener('click', handleConfirm);
      
      // 点击背景关闭
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          Utils.SwipeDeleteHandler._closeDeleteDialog(overlay);
          if (item) {
            Utils.SwipeDeleteHandler._hideDeleteButton(item);
          }
          if (typeof Toast !== 'undefined') {
            Toast.show('已取消删除');
          }
        }
      });
    },
    
    // ✅ 关闭删除弹窗
    _closeDeleteDialog: (overlay) => {
      if (!overlay || !overlay.parentNode) return;
      
      const dialog = overlay.querySelector('div.dialog-content');
      if (!dialog) {
        overlay.remove();
        return;
      }
      
      try {
        overlay.style.opacity = '0';
        dialog.style.transform = 'scale(0.9)';
        setTimeout(() => {
          try {
            if (overlay.parentNode) {
              overlay.remove();
            }
          } catch (e) {
            console.warn('[Utils] 移除弹窗失败:', e);
          }
        }, 200);
      } catch (e) {
        console.error('[Utils] 关闭弹窗失败:', e);
        try {
          overlay.remove();
        } catch (e2) {
          // ignore
        }
      }
    },

    handleTouchStart: function(e, idx, prefix) {
      if (!e || !e.touches || e.touches.length === 0) return;
      
      const touch = e.touches[0];
      const item = e.currentTarget;
      if (!item) return;
      
      // 存储触摸数据到元素上
      item._swipeData = {
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        currentY: touch.clientY,
        startTime: Date.now(),
        isHorizontal: false,
        hasDirection: false,
        isLeftSwipe: false
      };
    },

    handleTouchMove: function(e, idx, prefix) {
      if (!e || !e.touches || e.touches.length === 0) return;
      
      const touch = e.touches[0];
      const item = e.currentTarget;
      if (!item || !item._swipeData) return;
      
      const data = item._swipeData;
      const deltaX = touch.clientX - data.startX;
      const deltaY = touch.clientY - data.startY;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);
      
      if (!data.hasDirection) {
        if (absDeltaX > this._directionThreshold || absDeltaY > this._directionThreshold) {
          data.hasDirection = true;
          
          const angle = this._getSwipeAngle(deltaX, deltaY);
          data.isHorizontal = absDeltaX > absDeltaY && angle <= this._maxAngle;
          data.isLeftSwipe = deltaX < 0;
          
          if (!data.isHorizontal || deltaX >= 0) {
            // 如果不是水平滑动或不是向左滑动，恢复原位
            item.style.transform = 'translateX(0)';
            item.style.transition = 'transform 0.3s ease-out';
            return;
          }
        }
      }
      
      if (!data.isHorizontal || !data.isLeftSwipe) {
        return;
      }
      
      e.preventDefault();
      
      // 如果已经有删除按钮显示，不允许继续滑动
      const existingBtn = item.querySelector('.swipe-delete-btn');
      if (existingBtn) return;
      
      const progress = Math.min(absDeltaX / this._threshold, 1);
      const translateX = Math.max(deltaX * 0.5, -80);
      
      requestAnimationFrame(() => {
        this._showDeleteIndicator(item, progress);
        item.style.willChange = 'transform';
        item.style.transform = `translateX(${translateX}px)`;
        
        const indicator = item.querySelector('.swipe-delete-indicator');
        if (indicator && absDeltaX >= this._threshold) {
          indicator.style.background = 'linear-gradient(to bottom, #ff453a, #ff3b30)';
          indicator.style.boxShadow = '0 0 8px rgba(255, 59, 48, 0.6)';
        }
      });
    },

    handleTouchEnd: function(e, idx, prefix, deleteCallback) {
      const item = e.currentTarget;
      if (!item || !item._swipeData) return;
      
      const data = item._swipeData;
      const deltaX = data.currentX - data.startX;
      const deltaTime = Date.now() - data.startTime;
      
      // 隐藏删除指示器
      this._hideDeleteIndicator(item);
      
      // 移除 will-change 提示
      item.style.willChange = 'auto';
      
      // 如果不是向左滑动，恢复原位
      if (!data.isHorizontal || !data.isLeftSwipe) {
        item.style.transform = 'translateX(0)';
        item.style.transition = 'transform 0.3s ease-out';
        delete item._swipeData;
        return;
      }
      
      // 判断是否达到触发条件
      const isQuickSwipe = deltaTime < 200 && deltaX < -40;
      const isLongSwipe = Math.abs(deltaX) >= this._threshold;
      
      if (isQuickSwipe || isLongSwipe) {
        // 滑动成功，显示删除按钮
        this._showDeleteButton(item, deleteCallback);
      } else {
        // 滑动距离不够，恢复原位
        item.style.transform = 'translateX(0)';
        item.style.transition = 'transform 0.3s ease-out';
      }
      
      delete item._swipeData;
    }
  },

  /**
   * 向右滑动复制处理器（优化版）
   * 支持精选特码和精选生肖历史的右滑复制
   * 特点：低延迟、高精度、60fps动画、视觉反馈
   */
  SwipeRightCopyHandler: {
    _startX: {},
    _startY: {},
    _currentX: {},
    _currentY: {},
    _startTime: {},
    _threshold: 80,
    _directionThreshold: 15,
    _maxAngle: 30,
    _isHorizontal: {},
    _hasDirection: {},
    _isRightSwipe: {},

    // 获取元素文本内容
    _getElementText: (element) => {
      const text = element.innerText || element.textContent || '';
      return text.trim().replace(/\s+/g, ' ');
    },

    // 计算滑动角度
    _getSwipeAngle: (deltaX, deltaY) => {
      const angle = Math.atan2(Math.abs(deltaY), Math.abs(deltaX)) * 180 / Math.PI;
      return angle;
    },

    // 显示滑动轨迹指示器
    _showSwipeIndicator: (item, progress) => {
      let indicator = item.querySelector('.swipe-indicator');
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'swipe-indicator';
        item.appendChild(indicator);
      }
      indicator.style.transform = `scaleY(${Math.min(progress, 1)})`;
    },

    // 隐藏滑动轨迹指示器
    _hideSwipeIndicator: (item) => {
      const indicator = item.querySelector('.swipe-indicator');
      if (indicator) {
        indicator.style.transform = 'scaleY(0)';
        setTimeout(() => indicator.remove(), 200);
      }
    },

    // 显示复制成功反馈
    _showCopyFeedback: (item, text) => {
      const feedback = document.createElement('div');
      feedback.className = 'copy-feedback';
      feedback.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>已复制</span>
      `;
      item.appendChild(feedback);

      requestAnimationFrame(() => {
        feedback.classList.add('show');
      });

      setTimeout(() => {
        feedback.classList.remove('show');
        setTimeout(() => feedback.remove(), 300);
      }, 2000);
    },

    // 执行复制操作
    _performCopy: async (text, item) => {
      try {
        if (!text || text.trim() === '') {
          console.log('暂无内容可复制');
          return false;
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.cssText = 'position:fixed;left:-9999px;top:0;';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          if (!successful) throw new Error('复制失败');
        }

        this._showCopyFeedback(item, text);
        console.log(`已复制: ${text.substring(0, 20)}${text.length > 20 ? '...' : ''}`);
        return true;
      } catch (e) {
        console.error('复制失败', e);
        console.log('复制失败，请手动复制');
        return false;
      }
    },

    handleTouchStart: function(e, idx, prefix) {
      const key = `${prefix}_${idx}`;
      const touch = e.touches[0];
      
      this._startX[key] = touch.clientX;
      this._startY[key] = touch.clientY;
      this._currentX[key] = touch.clientX;
      this._currentY[key] = touch.clientY;
      this._startTime[key] = Date.now();
      this._isHorizontal[key] = false;
      this._hasDirection[key] = false;
      this._isRightSwipe[key] = false;
    },

    handleTouchMove: function(e, idx, prefix) {
      const key = `${prefix}_${idx}`;
      if (this._startX[key] === undefined) return;
      
      const touch = e.touches[0];
      this._currentX[key] = touch.clientX;
      this._currentY[key] = touch.clientY;
      
      const deltaX = touch.clientX - this._startX[key];
      const deltaY = touch.clientY - this._startY[key];
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);
      
      if (!this._hasDirection[key]) {
        if (absDeltaX > this._directionThreshold || 
            absDeltaY > this._directionThreshold) {
          this._hasDirection[key] = true;
          
          const angle = this._getSwipeAngle(deltaX, deltaY);
          
          const isHorizontal = absDeltaX > absDeltaY && angle <= this._maxAngle;
          this._isHorizontal[key] = isHorizontal;
          this._isRightSwipe[key] = deltaX > 0;
          
          if (!isHorizontal || deltaX <= 0) {
            return;
          }
        }
      }
      
      if (!this._isHorizontal[key] || !this._isRightSwipe[key]) {
        return;
      }
      
      e.preventDefault();
      
      const item = e.currentTarget;
      
      const progress = Math.min(absDeltaX / this._threshold, 1);
      
      this._showSwipeIndicator(item, progress);
      
      const content = item.querySelector('.special-history-content');
      if (content) {
        const translateX = Math.min(deltaX * 0.3, 30);
        content.style.transform = `translateX(${translateX}px)`;
        content.style.transition = 'transform 0.05s ease-out';
      }
      
      const indicator = item.querySelector('.swipe-indicator');
      if (indicator && absDeltaX >= this._threshold) {
        indicator.classList.add('ready');
      }
    },

    handleTouchEnd: function(e, idx, prefix, getTextCallback) {
      const key = `${prefix}_${idx}`;
      const item = e.currentTarget;
      
      const content = item.querySelector('.special-history-content');
      if (content) {
        content.style.transform = 'translateX(0)';
        content.style.transition = 'transform 0.3s ease-out';
      }
      
      if (!this._isHorizontal[key] || !this._isRightSwipe[key]) {
        this._hideSwipeIndicator(item);
        this._cleanup(key);
        return;
      }
      
      const deltaX = this._currentX[key] - this._startX[key];
      const deltaTime = Date.now() - this._startTime[key];
      
      const isQuickSwipe = deltaTime < 200 && deltaX > 40;
      const isLongSwipe = deltaX >= this._threshold;
      
      if (isQuickSwipe || isLongSwipe) {
        const text = getTextCallback ? getTextCallback(item) : 
                     this._getElementText(content || item);
        
        this._performCopy(text, item);
      }
      
      this._hideSwipeIndicator(item);
      this._cleanup(key);
    },

    _cleanup: function(key) {
      delete this._startX[key];
      delete this._startY[key];
      delete this._currentX[key];
      delete this._currentY[key];
      delete this._startTime[key];
      delete this._isHorizontal[key];
      delete this._hasDirection[key];
      delete this._isRightSwipe[key];
    }
  },

  // 在应用初始化时设置滑动处理器
  initSwipeHandlers: () => {
    // 右滑复制功能已集成到其他模块
  },

  /**
   * 深拷贝对象
   * @param {any} obj - 要拷贝的对象
   * @returns {any} 拷贝后的对象
   */
  deepClone: (obj) => {
    try {
      if(typeof obj !== 'object' || obj === null) {
        return obj;
      }
      if(typeof structuredClone === 'function') {
        return structuredClone(obj);
      }
      return JSON.parse(JSON.stringify(obj));
    } catch(e) {
      console.error('深拷贝失败', e);
      return obj;
    }
  },

  /**
   * 标签值类型转换（解决数字/字符串匹配问题）
   * @param {string|number} value - 标签值
   * @param {string} group - 分组名
   * @returns {string|number} 转换后的值
   */
  formatTagValue: (value, group) => {
    return CONFIG.NUMBER_GROUPS.includes(group) ? Number(value) : value;
  },

  /**
   * 获取安全区顶部高度
   * @returns {number} 安全区高度(px)
   */
  getSafeTop: () => {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0;
  },

  /**
   * 校验筛选方案格式
   * @param {any} item - 要校验的方案对象
   * @returns {boolean} 是否合法
   */
  validateFilterItem: (item) => {
    return item && 
      typeof item === 'object' && 
      typeof item.name === 'string' && 
      item.selected && typeof item.selected === 'object' &&
      Array.isArray(item.excluded);
  },

  /**
   * 生成DocumentFragment优化DOM渲染
   * @param {Array} list - 要渲染的列表
   * @param {Function} renderItem - 单个元素渲染函数
   * @returns {DocumentFragment} 生成的文档片段
   */
  createFragment: (list, renderItem) => {
    const fragment = document.createDocumentFragment();
    list.forEach((item, index) => {
      const el = renderItem(item, index);
      if(el) fragment.appendChild(el);
    });
    return fragment;
  },

  /**
   * HTML转义函数，防止XSS攻击
   * @param {string} text - 要转义的文本
   * @returns {string} 转义后的文本
   */
  escapeHtml: (text) => {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * 生成分页HTML
   * @param {number} currentPage - 当前页码
   * @param {number} totalPages - 总页数
   * @param {number} totalItems - 总记录数
   * @param {string} pageFunc - 翻页函数名
   * @returns {string} 分页HTML
   */
  renderPagination: (currentPage, totalPages, totalItems, pageFunc) => {
    if(totalPages <= 1) return '';
    
    let html = '<div style="display:flex;justify-content:center;align-items:center;gap:12px;margin-top:16px;padding:12px;background:var(--bg);border-radius:8px;">';
    if(currentPage > 1) {
      html += `<button class="btn-mini" onclick="Business.${pageFunc}(${currentPage - 1})">上一页</button>`;
    }
    html += `<span style="color:var(--sub-text);font-size:13px;">第 ${currentPage} / ${totalPages} 页 (共 ${totalItems} 条)</span>`;
    if(currentPage < totalPages) {
      html += `<button class="btn-mini" onclick="Business.${pageFunc}(${currentPage + 1})">下一页</button>`;
    }
    html += '</div>';
    return html;
  },

  /**
   * 批量更新DOM元素文本
   * @param {Object} elements - 元素ID和值的映射
   */
  updateElements: (elements) => {
    Object.entries(elements).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if(el) el.innerText = value;
    });
  },

  /**
   * 创建带缓存的数据计算函数
   * @param {Function} calculateFn - 计算函数
   * @param {number} cacheDuration - 缓存有效期（毫秒）
   * @returns {Function} 带缓存的计算函数
   */
  createCachedFunction: (calculateFn, cacheDuration = 10000) => {
    const cache = {
      lastUpdated: 0,
      data: null
    };

    return () => {
      const now = Date.now();
      if (cache.data && (now - cache.lastUpdated) < cacheDuration) {
        return cache.data;
      }

      const data = calculateFn();
      cache.data = data;
      cache.lastUpdated = now;
      return data;
    };
  },

  /**
   * 获取号码的颜色
   * @param {number} num - 号码
   * @returns {string} 颜色类名
   */
  getNumColor: (num) => {
    if(CONFIG.COLOR_MAP['红'].includes(num)) return 'red';
    if(CONFIG.COLOR_MAP['蓝'].includes(num)) return 'blue';
    if(CONFIG.COLOR_MAP['绿'].includes(num)) return 'green';
    return 'red';
  },

  /**
   * 获取号码的五行
   * @param {number} num - 号码
   * @returns {string} 五行
   */
  getNumElement: (num) => {
    if(CONFIG.ELEMENT_MAP['金'].includes(num)) return '金';
    if(CONFIG.ELEMENT_MAP['木'].includes(num)) return '木';
    if(CONFIG.ELEMENT_MAP['水'].includes(num)) return '水';
    if(CONFIG.ELEMENT_MAP['火'].includes(num)) return '火';
    if(CONFIG.ELEMENT_MAP['土'].includes(num)) return '土';
    return '';
  },

  /**
   * 构建完整的号码-生肖映射
   * @returns {Map} 号码-生肖映射
   */
  buildNumZodiacMap: () => {
    const map = new Map();
    for(let num = 1; num <= 49; num++) {
      const zod = DataQuery._getZodiacByNum(num);
      if(zod) map.set(num, zod);
    }
    return map;
  },

  /**
   * 创建通用弹窗
   * @param {Object} options - 弹窗配置
   * @param {string} options.title - 弹窗标题
   * @param {string} options.content - 弹窗内容
   * @param {string} options.className - 弹窗类名
   * @returns {HTMLElement} 弹窗元素
   */
  createModal: (options) => {
    const { title, content, className = 'modal' } = options;
    
    const modal = document.createElement('div');
    modal.className = `${className}-modal`;
    modal.innerHTML = `
      <div class="${className}-content">
        <div class="${className}-header">
          <h3>${title}</h3>
          <button class="close-btn" onclick="this.closest('.${className}-modal').remove()">×</button>
        </div>
        <div class="${className}-body">
          ${content}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
      if(e.target === modal) {
        modal.remove();
      }
    });
    
    return modal;
  },

  /**
   * 繁体转简体
   * @param {string} text - 要转换的文本
   * @returns {string} 转换后的简体文本
   */
  traditionalToSimplified: (text) => {
    if (typeof text !== 'string') return text;
    
    const traditionalToSimplifiedMap = {
      '繁': '繁',
      '體': '体',
      '轉': '转',
      '換': '换',
      '開': '开',
      '獎': '奖',
      '號': '号',
      '碼': '码',
      '時': '时',
      '間': '间',
      '期': '期',
      '數': '数',
      '據': '据',
      '分': '分',
      '析': '析',
      '預': '预',
      '測': '测',
      '歷': '历',
      '史': '史',
      '特': '特',
      '生': '生',
      '肖': '肖',
      '波': '波',
      '色': '色',
      '紅': '红',
      '藍': '蓝',
      '綠': '绿',
      '單': '单',
      '雙': '双',
      '大': '大',
      '小': '小',
      '左': '左',
      '中': '中',
      '右': '右',
      '資': '资',
      '訊': '讯',
      '服': '服',
      '務': '务',
      '技': '技',
      '術': '术',
      '支': '支',
      '持': '持',
      '郵': '邮',
      '件': '件',
      '雞': '鸡',
      '馬': '马',
      '羊': '羊',
      '猴': '猴',
      '狗': '狗',
      '豬': '猪',
      '鼠': '鼠',
      '牛': '牛',
      '虎': '虎',
      '兔': '兔',
      '龍': '龙',
      '蛇': '蛇'
    };
    
    return text.split('').map(char => traditionalToSimplifiedMap[char] || char).join('');
  },

  /**
   * 简体转繁体
   * @param {string} text - 要转换的文本
   * @returns {string} 转换后的繁体文本
   */
  simplifiedToTraditional: (text) => {
    if (typeof text !== 'string') return text;
    
    const simplifiedToTraditionalMap = {
      '繁': '繁',
      '体': '體',
      '转': '轉',
      '换': '換',
      '开': '開',
      '奖': '獎',
      '号': '號',
      '码': '碼',
      '时': '時',
      '间': '間',
      '期': '期',
      '数': '數',
      '据': '據',
      '分': '分',
      '析': '析',
      '预': '預',
      '测': '測',
      '历': '歷',
      '史': '史',
      '特': '特',
      '生': '生',
      '肖': '肖',
      '波': '波',
      '色': '色',
      '红': '紅',
      '蓝': '藍',
      '绿': '綠',
      '单': '單',
      '双': '雙',
      '大': '大',
      '小': '小',
      '左': '左',
      '中': '中',
      '右': '右',
      '资': '資',
      '讯': '訊',
      '服': '服',
      '务': '務',
      '技': '技',
      '术': '術',
      '支': '支',
      '持': '持',
      '邮': '郵',
      '件': '件',
      '鸡': '雞',
      '马': '馬',
      '羊': '羊',
      '猴': '猴',
      '狗': '狗',
      '猪': '豬',
      '鼠': '鼠',
      '牛': '牛',
      '虎': '虎',
      '兔': '兔',
      '龙': '龍',
      '蛇': '蛇'
    };
    
    return text.split('').map(char => simplifiedToTraditionalMap[char] || char).join('');
  },

  /**
   * 全局错误处理器
   * @param {Error} error - 错误对象
   * @param {string} context - 错误上下文
   */
  handleError: (error, context = 'Unknown') => {
    console.error(`[${context}]`, error);
    
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.trace();
    }
  },

  /**
   * 性能监控：测量函数执行时间
   * @param {Function} fn - 要测量的函数
   * @param {string} label - 标签名称
   * @returns {*} 函数返回值
   */
  measurePerformance: (fn, label = 'Performance') => {
    const start = performance.now();
    try {
      const result = fn();
      const end = performance.now();
      console.log(`[${label}] 执行时间: ${(end - start).toFixed(2)}ms`);
      return result;
    } catch (error) {
      Utils.handleError(error, label);
      throw error;
    }
  }
};