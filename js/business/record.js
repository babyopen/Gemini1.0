// ====================== 记录页面业务逻辑（修复 map 错误） ======================
import { Storage } from '../storage.js';
import { StateManager } from '../state-manager.js';
import { Toast } from '../toast.js';
import { Filter } from '../filter.js';
import { DataQuery } from '../data-query.js';
import { Utils } from '../utils.js';

export const record = {
  // 标记事件是否已绑定，防止重复绑定
  _eventsBound: false,
  
  // 滑动删除处理器引用缓存（避免重复创建）
  _swipeHandlers: new WeakMap(),
  
  init: () => {
    // 使用DOMContentLoaded确保DOM元素完全加载
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        record._initFilterButtons();
        record.initPullRefresh();
        record.initAndRefresh();
        record.bindEvents();
      });
    } else {
      record._initFilterButtons();
      record.initPullRefresh();
      record.initAndRefresh();
      record.bindEvents();
    }
  },
  
  /**
   * 初始化并自动获取最新数据（第一时间刷新）
   */
  initAndRefresh: () => {
    // 先渲染本地数据（快速显示）
    record.renderAll();
    
    // 立即在后台获取最新数据并核对记录（不阻塞UI）
    record.autoFetchAndCheck().catch(error => {
      console.error('[Record] 自动获取数据失败:', error);
    });
  },
  
  /**
   * 自动获取最新数据并核对所有记录（静默模式）
   */
  autoFetchAndCheck: async () => {
    try {
      console.log('[Record] 🚀 开始自动获取最新数据并核对记录...');
      
      // 动态导入dataFetch模块
      const { dataFetch } = await import('../business/analysis/modules/data-fetch.js');
      
      // 获取最新数据（静默模式）
      await dataFetch.silentRefreshHistory();
      
      // 数据更新后会自动触发_checkAndUpdateRecords，在那里会核对所有记录
      // 但是为了确保第一时间更新，我们在这里也手动触发一次完整的核对
      record._checkAllRecordsWithLatestData();
      
      console.log('[Record] ✅ 自动获取并核对完成');
    } catch (error) {
      console.error('[Record] ❌ 自动获取数据失败:', error);
      // 即使失败，也尝试使用本地数据进行核对
      record._checkAllRecordsWithLatestData();
    }
  },
  
  /**
   * 使用最新数据核对所有记录
   */
  _checkAllRecordsWithLatestData: () => {
    try {
      // 从StateManager获取最新历史数据
      const historyData = StateManager._state.analysis.historyData;
      
      if (!historyData || historyData.length === 0) {
        console.log('[Record] 没有历史数据可核对');
        return;
      }
      
      // 检查最近的开奖记录（最多检查最近20期，确保早期记录也能被核对）
      const recentItems = historyData.slice(0, 20);
      
      console.log('[Record] 🔍 开始核对最近', recentItems.length, '期数据...');
      
      recentItems.forEach(item => {
        const issue = item.expect;
        const openCode = item.openCode || '';
        const actualNumbers = openCode.split(',').map(num => num.trim()).filter(num => num);
        
        if (actualNumbers.length === 0) return;
        
        // 提取特码（最后一个号码）
        const specialNumber = actualNumbers[actualNumbers.length - 1];
        
        // 动态导入analysisCalc来获取生肖
        import('../business/analysis/modules/analysis-calc.js').then(({ analysisCalc }) => {
          const special = analysisCalc.getSpecial(item);
          const resultZodiac = special.zod;
          
          // 自动核对生肖记录
          record.checkZodiacRecord(issue, resultZodiac);
          
          // 自动核对号码记录（精选特码）
          record.checkNumberRecord(issue, actualNumbers);
          
          // 自动核对待码热门TOP5记录
          record.checkHotNumbersRecord(issue, actualNumbers);
          
          // 自动核对ML预测记录
          record.checkMLPredictionRecord(issue, resultZodiac);
        }).catch(error => {
          console.error('[Record] 导入analysisCalc失败:', error);
        });
      });
      
      // 重新渲染统计数据（确保第一时间更新）
      record.renderPredictionStatistics();
      
      console.log('[Record] ✅ 所有记录核对完成，统计数据已更新');
    } catch (error) {
      console.error('[Record] 核对记录失败:', error);
    }
  },
  
  /**
   * 初始化下拉刷新功能
   */
  initPullRefresh: () => {
    const container = document.getElementById('recordPullContainer');
    const indicator = document.getElementById('recordPullRefreshIndicator');
    const refreshText = document.getElementById('recordPullRefreshText');
    
    if (!container || !indicator) {
      console.warn('[Record] 下拉刷新容器不存在');
      return;
    }
    
    let startY = 0;
    let isPulling = false;
    let isRefreshing = false;
    
    // 触摸开始
    const handleTouchStart = (e) => {
      // 只有在页面顶部才能下拉刷新
      if (container.scrollTop <= 0) {
        startY = e.touches[0].pageY;
        isPulling = true;
      }
    };
    
    // 触摸移动
    const handleTouchMove = (e) => {
      if (!isPulling || isRefreshing) return;
      
      const currentY = e.touches[0].pageY;
      const pullDistance = currentY - startY;
      
      // 只有下拉时才触发（而不是上拉）
      if (pullDistance > 0) {
        e.preventDefault();
        
        // 计算下拉距离，最大100px
        const distance = Math.min(pullDistance, 100);
        
        // 设置指示器的transform和opacity
        indicator.style.transform = `translateY(${distance - 50}px)`;
        indicator.style.opacity = distance / 100;
        
        // 更新文字
        if (refreshText) {
          if (distance > 60) {
            refreshText.textContent = '释放刷新';
          } else {
            refreshText.textContent = '下拉刷新';
          }
        }
      }
    };
    
    // 触摸结束
    const handleTouchEnd = () => {
      if (!isPulling || isRefreshing) return;
      
      const transform = indicator.style.transform;
      const match = transform.match(/translateY\(([\d.]+)px\)/);
      const distance = match ? parseFloat(match[1]) : 0;
      
      // 如果下拉距离超过60px，触发刷新
      if (distance > 10) {
        isRefreshing = true;
        
        // 显示加载状态
        indicator.style.transform = 'translateY(50px)';
        indicator.style.opacity = '1';
        if (refreshText) {
          refreshText.textContent = '刷新中...';
        }
        
        // 添加旋转动画
        const icon = indicator.querySelector('.pull-refresh-icon');
        if (icon) {
          icon.classList.add('rotating');
        }
        
        // 执行刷新
        record.autoFetchAndCheck().then(() => {
          // 刷新完成，恢复原状
          setTimeout(() => {
            indicator.style.transform = 'translateY(-50px)';
            indicator.style.opacity = '0';
            if (refreshText) {
              refreshText.textContent = '刷新成功';
            }
            
            // 移除旋转动画
            if (icon) {
              icon.classList.remove('rotating');
            }
            
            // 重新渲染所有数据
            record.renderAll();
            
            // 隐藏指示器
            setTimeout(() => {
              indicator.style.opacity = '0';
              isRefreshing = false;
              isPulling = false;
            }, 500);
          }, 500);
        }).catch(error => {
          console.error('[Record] 下拉刷新失败:', error);
          Toast.show('刷新失败，请重试');
          
          // 恢复原状
          setTimeout(() => {
            indicator.style.transform = 'translateY(-50px)';
            indicator.style.opacity = '0';
            if (refreshText) {
              refreshText.textContent = '下拉刷新';
            }
            
            // 移除旋转动画
            if (icon) {
              icon.classList.remove('rotating');
            }
            
            isRefreshing = false;
            isPulling = false;
          }, 500);
        });
      } else {
        // 下拉距离不够，恢复原状
        indicator.style.transform = 'translateY(-50px)';
        indicator.style.opacity = '0';
        isPulling = false;
      }
    };
    
    // 绑定触摸事件
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    console.log('[Record] ✅ 下拉刷新功能已初始化');
  },
  _initFilterButtons: () => {
    // 默认选中10期按钮（生肖预测）
    const btn10 = document.querySelector('.prediction-period-btn[data-period="10"]');
    if (btn10) {
      btn10.classList.add('active');
    }
    // 确保其他按钮未选中
    document.querySelectorAll('.prediction-period-btn').forEach(btn => {
      if (btn.dataset.period !== '10') {
        btn.classList.remove('active');
      }
    });
    console.log('[Init] 生肖预测历史筛选初始化，默认显示10期数据');
    
    // ✅ 从localStorage加载保存的精选特码筛选条件
    const savedFilters = Storage.loadSpecialFilters();
    
    // ✅ 根据保存的设置选中期数按钮（精选特码）
    const specialBtn = document.querySelector(`.special-period-btn[data-period="${savedFilters.period}"]`);
    if (specialBtn) {
      specialBtn.classList.add('active');
    }
    // 确保其他期数按钮未选中
    document.querySelectorAll('.special-period-btn').forEach(btn => {
      if (btn.dataset.period !== savedFilters.period) {
        btn.classList.remove('active');
      }
    });
    
    // ✅ 根据保存的设置选中数量按钮（精选特码）
    const specialNumBtn = document.querySelector(`.special-num-btn[data-num="${savedFilters.numCount}"]`);
    if (specialNumBtn) {
      specialNumBtn.classList.add('active');
    }
    // 确保其他数量按钮未选中
    document.querySelectorAll('.special-num-btn').forEach(btn => {
      if (btn.dataset.num !== savedFilters.numCount) {
        btn.classList.remove('active');
      }
    });
    
    console.log('[Init] 精选特码筛选条件已加载:', savedFilters);
  },

  // 渲染所有历史记录
  renderAll: () => {
    // 延迟执行，确保DOM元素存在
    setTimeout(() => {
      record.renderFavoriteList();
      record.renderPredictionStatistics();
      record.renderSelectedZodiacHistory();
      record.renderZodiacPredictionHistory();
      record.renderMLPredictionHistory();
      record.renderSpecialHistory();
      record.renderHotNumbersHistory();
    }, 100);
  },
  
  /**
   * 刷新记录页面所有数据（静默模式）
   * @returns {boolean} 是否刷新成功
   */
  refreshAll: () => {
    try {
      // 清除所有相关缓存
      const cacheKeys = ['favorites', 'zodiacRecords', 'mlPredictionRecords', 'numberRecords', 'hotNumbersRecords'];
      cacheKeys.forEach(key => Storage.clearCache(key));
      
      // 重新渲染所有数据
      record.renderAll();
      
      return true;
    } catch (error) {
      console.error('[Record] 刷新记录页面失败:', error);
      Toast.show('刷新失败，请重试');
      return false;
    }
  },

  // ---------- 我的收藏 ----------
  renderFavoriteList: () => {
    const container = document.getElementById('favoriteList');
    if (!container) {
      console.warn('[Record] 容器不存在: favoriteList');
      return;
    }
    
    // 显示加载状态
    container.innerHTML = '<div class="loading-tip">加载中...</div>';
    
    try {
      // ✅ 直接获取数据，不清除缓存
      const favorites = Storage.get('favorites', []);
      
      if (!favorites.length) {
        container.innerHTML = '<div class="empty-tip">暂无收藏方案</div>';
        return;
      }
      
      const fragment = document.createDocumentFragment();
      favorites.forEach((item, idx) => {
        try {
          // ✅ 支持精选特码收藏和普通方案
          let previewList;
          if (item.numbers && Array.isArray(item.numbers)) {
            // 精选特码收藏：直接使用 numbers
            previewList = item.numbers.map(num => DataQuery.getNumAttrs(num));
          } else {
            // 普通方案：使用筛选结果
            previewList = Filter.getFilteredList(item.selected, item.excluded);
          }
          
          const card = document.createElement('div');
          card.className = 'filter-item';
          
          // ✅ 生成号码预览（支持横向滚动，显示所有号码）
          const previewFragment = document.createDocumentFragment();
          previewList.forEach(num => {
            const wrapper = document.createElement('div');
            wrapper.className = 'num-item';
            wrapper.innerHTML = `<div class="num-ball ${num.color}色">${num.s}</div><div class="tag-zodiac">${num.zodiac}</div>`;
            previewFragment.appendChild(wrapper);
          });
          
          card.innerHTML = `
            <div class="filter-row">
              <div class="filter-item-name">${Utils.escapeHtml(item.name)}</div>
              <div class="filter-preview" style="flex: 1; min-width: 0;"></div>
            </div>
            <div class="filter-item-btns">
              <button class="filter-item-btn" data-action="loadFavorite" data-index="${idx}">加载</button>
              <button class="filter-item-btn" data-action="renameFavorite" data-index="${idx}">重命名</button>
              <button class="filter-item-btn" data-action="copyFavorite" data-index="${idx}">复制</button>
            </div>
          `;
          
          // ✅ 将号码预览添加到 filter-preview 容器
          const previewContainer = card.querySelector('.filter-preview');
          previewContainer.appendChild(previewFragment);
          
          fragment.appendChild(card);
        } catch (error) {
          console.error('渲染收藏项失败:', error);
        }
      });
      container.innerHTML = '';
      container.appendChild(fragment);
    } catch (error) {
      console.error('加载收藏列表失败:', error);
      container.innerHTML = '<div class="error-tip">加载失败，请点击刷新重试</div>';
    }
  },
  clearAllFavorites: () => {
    if (confirm('确定清空所有收藏吗？')) {
      Storage.set('favorites', []);
      StateManager.setState({ system: { ...StateManager._state.system, favorites: [] } }, false);
      window.dispatchEvent(new StorageEvent('storage', { key: 'favorites' }));
      record.renderFavoriteList();
      Toast.show('已清空所有收藏');
    }
  },
  removeFavorite: (index) => {
    const favorites = Storage.get('favorites', []);
    if (favorites[index]) {
      favorites.splice(index, 1);
      Storage.set('favorites', favorites);
      StateManager.setState({ system: { ...StateManager._state.system, favorites: favorites } }, false);
      window.dispatchEvent(new StorageEvent('storage', { key: 'favorites' }));
      record.renderFavoriteList();
      Toast.show('已移除收藏');
    }
  },
  loadFavorite: (index) => {
    const favorites = Storage.get('favorites', []);
    const item = favorites[index];
    if (!item) return;
    StateManager.setState({ filter: { ...StateManager._state.filter, selected: item.selected, excluded: item.excluded } });
    Toast.show(`已加载方案：${item.name}`);
    document.querySelector('.bottom-nav-item[data-index="0"]')?.click();
  },
  renameFavorite: (index) => {
    const favorites = Storage.get('favorites', []);
    const item = favorites[index];
    if (!item) return;
    let newName = prompt('请输入新名称', item.name);
    if (newName?.trim()) {
      item.name = newName.trim();
      Storage.set('favorites', favorites);
      StateManager.setState({ system: { ...StateManager._state.system, favorites: favorites } }, false);
      window.dispatchEvent(new StorageEvent('storage', { key: 'favorites' }));
      record.renderFavoriteList();
      Toast.show('重命名成功');
    }
  },
  copyFavorite: (index) => {
    const favorites = Storage.get('favorites', []);
    const item = favorites[index];
    if (!item) return;
    const filtered = Filter.getFilteredList(item.selected, item.excluded);
    const numStr = filtered.map(n => n.s).join(' ');
    if (navigator.clipboard) navigator.clipboard.writeText(numStr).then(() => Toast.show('复制成功'));
    else alert('请手动复制：' + numStr);
  },

  // ---------- 预测统计 ----------
  renderPredictionStatistics: () => {
    try {
      const allRecords = Storage.get('zodiacRecords', []);
      
      // 分离精选生肖和生肖预测记录
      const selectedRecords = allRecords.filter(r => r.recordType === 'selected');
      const zodiacRecords = allRecords.filter(r => !r.recordType || r.recordType !== 'selected');
      
      // 计算精选生肖统计
      const selectedStats = record._calculateStats(selectedRecords);
      
      // 计算生肖预测统计
      const predictionStats = record._calculateStats(zodiacRecords);
      
      // 更新精选生肖卡片
      record._updateSummaryCard('selectedZodiac', {
        total: selectedStats.total,
        hit: selectedStats.hit,
        miss: selectedStats.miss,
        pending: selectedStats.pending,
        rate: selectedStats.rate,
        latest: selectedStats.latest
      });
      
      // 更新生肖预测卡片
      record._updateSummaryCard('zodiacPrediction', {
        total: predictionStats.total,
        hit: predictionStats.hit,
        miss: predictionStats.miss,
        pending: predictionStats.pending,
        rate: predictionStats.rate,
        latest: predictionStats.latest,
        latestZodiacs: predictionStats.latestZodiacs
      });
      
      // 更新精选生肖卡片（位于 selectedZodiacHistorySection）
      record._updateSummaryCard('selectedZodiac', {
        total: selectedStats.total,
        hit: selectedStats.hit,
        miss: selectedStats.miss,
        pending: selectedStats.pending,
        rate: selectedStats.rate,
        latest: selectedStats.latest,
        latestZodiacs: selectedStats.latestZodiacs
      });
      
      // 计算 ML 预测统计
      const mlRecords = Storage.get('mlPredictionRecords', []);
      const mlStats = record._calculateMLPredictionStats(mlRecords);
      
      // 更新 ML 预测卡片
      record._updateSummaryCard('mlPrediction', {
        total: mlStats.total,
        hit: mlStats.hit,
        miss: mlStats.miss,
        pending: mlStats.pending,
        rate: mlStats.rate,
        latest: mlStats.latest,
        latestZodiacs: mlStats.latestZodiacs
      });
      
      // 计算特码热门统计
      const hotRecords = Storage.get('hotNumbersRecords', []);
      const hotStats = record._calculateHotNumbersStats(hotRecords);
      
      // 更新特码热门卡片
      record._updateSummaryCard('hotNumbers', {
        total: hotStats.total,
        hit: hotStats.hit,
        miss: hotStats.miss,
        pending: hotStats.pending,
        rate: hotStats.rate,
        latest: hotStats.latest,
        latestNumbers: hotStats.latestNumbers
      });
      
      // 计算精选特码统计
      const specialRecords = Storage.get('numberRecords', []);
      const specialStats = record._calculateSpecialStats(specialRecords);
      
      // 更新精选特码卡片
      record._updateSummaryCard('special', {
        total: specialStats.total,
        hit: specialStats.hit,
        miss: specialStats.miss,
        pending: specialStats.pending,
        rate: specialStats.rate,
        latest: specialStats.latest,
        latestZodiacs: specialStats.latestNumbers
      });
    } catch (error) {
      console.error('加载预测统计失败:', error);
    }
  },
  
  _calculateStats: (records) => {
    let hit = 0, miss = 0, pending = 0;
    let latestIssue = null;
    let latestTime = null;
    let latestZodiacs = null;
    
    records.forEach(rec => {
      if (rec.checked) {
        rec.matched === true ? hit++ : miss++;
      } else {
        pending++;
      }
      
      if (!latestIssue && rec.issue) {
        latestIssue = rec.issue;
        latestTime = rec.createdAt;
        latestZodiacs = Array.isArray(rec.zodiacs) ? rec.zodiacs : [];
      }
    });
    
    const total = records.length;
    const rate = (hit + miss) > 0 ? ((hit / (hit + miss)) * 100).toFixed(1) : '0.0';
    
    let latest = '暂无数据';
    if (latestIssue) {
      const dateStr = latestTime ? new Date(latestTime).toLocaleString('zh-CN', { 
        month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' 
      }) : '';
      latest = `第${latestIssue}期 ${dateStr}`;
    }
    
    const latestZodiacsStr = latestZodiacs ? latestZodiacs.map(z => z.split('(')[0].trim()).join(' ') : '';
    
    return { total, hit, miss, pending, rate, latest, latestZodiacs: latestZodiacsStr };
  },
  
  _calculateSpecialStats: (records) => {
    let hit = 0, miss = 0, pending = 0;
    let latestIssue = null;
    let latestTime = null;
    let latestNumbers = null;
    
    records.forEach(rec => {
      if (rec.checked) {
        rec.matched === true ? hit++ : miss++;
      } else {
        pending++;
      }
      
      if (!latestIssue && rec.issue) {
        latestIssue = rec.issue;
        latestTime = rec.createdAt;
        latestNumbers = Array.isArray(rec.numbers) ? rec.numbers : [];
      }
    });
    
    const total = records.length;
    const rate = (hit + miss) > 0 ? ((hit / (hit + miss)) * 100).toFixed(1) : '0.0';
    
    let latest = '暂无数据';
    if (latestIssue) {
      const dateStr = latestTime ? new Date(latestTime).toLocaleString('zh-CN', { 
        month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' 
      }) : '';
      latest = `第${latestIssue}期 ${dateStr}`;
    }
    
    const latestNumbersStr = latestNumbers ? latestNumbers.map(n => {
      if (typeof n === 'object' && n !== null) {
        return n.number || n.num || '';
      }
      return n;
    }).join(' ') : '';
    
    return { total, hit, miss, pending, rate, latest, latestNumbers: latestNumbersStr };
  },
  
  _calculateHotNumbersStats: (records) => {
    let hit = 0, miss = 0, pending = 0;
    let latestIssue = null;
    let latestTime = null;
    let latestNumbers = null;
    
    records.forEach(rec => {
      if (rec.checked) {
        rec.matched === true ? hit++ : miss++;
      } else {
        pending++;
      }
      
      if (!latestIssue && rec.issue) {
        latestIssue = rec.issue;
        latestTime = rec.createdAt;
        latestNumbers = Array.isArray(rec.numbers) ? rec.numbers : [];
      }
    });
    
    const total = records.length;
    const rate = (hit + miss) > 0 ? ((hit / (hit + miss)) * 100).toFixed(1) : '0.0';
    
    let latest = '暂无数据';
    if (latestIssue) {
      const dateStr = latestTime ? new Date(latestTime).toLocaleString('zh-CN', { 
        month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' 
      }) : '';
      latest = `第${latestIssue}期 ${dateStr}`;
    }
    
    const latestNumbersStr = latestNumbers ? latestNumbers.map(n => {
      if (typeof n === 'object' && n !== null) {
        return n.number || n.num || '';
      }
      return n;
    }).join(' ') : '';
    
    return { total, hit, miss, pending, rate, latest, latestNumbers: latestNumbersStr };
  },
  
  _calculateMLPredictionStats: (records) => {
    let hit = 0, miss = 0, pending = 0;
    let latestIssue = null;
    let latestTime = null;
    let latestPredictions = null;
    let latestIsTrained = false;
    
    records.forEach(rec => {
      if (rec.checked) {
        rec.matched === true ? hit++ : miss++;
      } else {
        pending++;
      }
      
      if (!latestIssue && rec.issue) {
        latestIssue = rec.issue;
        latestTime = rec.createdAt;
        latestPredictions = Array.isArray(rec.predictions) ? rec.predictions : [];
        latestIsTrained = rec.isTrained || false;
      }
    });
    
    const total = records.length;
    const rate = (hit + miss) > 0 ? ((hit / (hit + miss)) * 100).toFixed(1) : '0.0';
    
    let latest = '暂无数据';
    if (latestIssue) {
      const dateStr = latestTime ? new Date(latestTime).toLocaleString('zh-CN', { 
        month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' 
      }) : '';
      latest = `第${latestIssue}期 ${dateStr}`;
    }
    
    const latestPredictionsStr = latestPredictions ? latestPredictions.map(z => z.split('(')[0].trim()).join(' ') : '';
    
    // ✅ 添加训练标识到显示
    const latestWithType = latestIsTrained ? `🤖 ${latestPredictionsStr}` : `📊 ${latestPredictionsStr}`;
    
    return { total, hit, miss, pending, rate, latest, latestZodiacs: latestWithType };
  },
  
  _updateSummaryCard: (prefix, stats) => {
    const totalEl = document.getElementById(`${prefix}Total`);
    const hitEl = document.getElementById(`${prefix}Hit`);
    const missEl = document.getElementById(`${prefix}Miss`);
    const pendingEl = document.getElementById(`${prefix}Pending`);
    const rateEl = document.getElementById(`${prefix}Rate`);
    const latestEl = document.getElementById(`${prefix}LatestContent`);
    const latestZodiacsEl = document.getElementById(`${prefix}LatestZodiacs`);
    
    if (totalEl) totalEl.textContent = stats.total;
    if (hitEl) hitEl.textContent = stats.hit;
    if (missEl) missEl.textContent = stats.miss;
    if (pendingEl) pendingEl.textContent = stats.pending;
    if (rateEl) rateEl.textContent = stats.rate + '%';
    if (latestEl) latestEl.textContent = stats.latest;
    if (latestZodiacsEl) {
      if (stats.latestNumbers) {
        // 精选特码和特码热门：显示号码
        const numbersArr = stats.latestNumbers.split(' ').filter(n => n.trim());
        latestZodiacsEl.innerHTML = numbersArr.map(n => `<span class="history-tag">${n}</span>`).join('');
      } else if (stats.latestZodiacs) {
        // 生肖预测和ML预测：显示生肖（可能包含emoji前缀）
        const zodiacsStr = stats.latestZodiacs;
        // 检查是否包含emoji前缀
        const hasEmoji = zodiacsStr.match(/^[🤖📊]\s/);
        if (hasEmoji) {
          // 提取emoji和剩余的生肖
          const emoji = hasEmoji[0];
          const zodiacsPart = zodiacsStr.substring(emoji.length);
          const zodiacsArr = zodiacsPart.split(' ').filter(z => z.trim());
          latestZodiacsEl.innerHTML = emoji + zodiacsArr.map(z => `<span class="zodiac-tag">${z}</span>`).join(' ');
        } else {
          // 没有emoji，直接显示
          const zodiacsArr = zodiacsStr.split(' ').filter(z => z.trim());
          latestZodiacsEl.innerHTML = zodiacsArr.map(z => `<span class="zodiac-tag">${z}</span>`).join(' ');
        }
      } else {
        latestZodiacsEl.innerHTML = '';
      }
    }
  },
  _getCategoryStats: (type) => {
    const allRecords = Storage.get('zodiacRecords', []);
    let records = type === 'selected' 
      ? allRecords.filter(r => r.recordType === 'selected')
      : allRecords.filter(r => !r.recordType || r.recordType !== 'selected');
    let hit = 0, miss = 0, pending = 0;
    records.forEach(rec => {
      if (rec.checked === true) rec.matched === true ? hit++ : miss++;
      else pending++;
    });
    const hitRate = (hit + miss) > 0 ? ((hit / (hit + miss)) * 100).toFixed(1) : '0.0';
    return { hit, miss, pending, hitRate, total: records.length };
  },
  refreshPredictionStatistics: () => { record.renderPredictionStatistics(); Toast.show('统计已刷新'); },

  // ---------- 精选生肖历史 ----------
  renderSelectedZodiacHistory: () => {
    const container = document.getElementById('selectedZodiacHistoryList');
    if (!container) {
      console.warn('[Record] 容器不存在: selectedZodiacHistoryList');
      return;
    }
    
    // 显示加载状态
    container.innerHTML = '<div class="loading-tip">加载中...</div>';
    
    try {
      // ✅ 直接从Storage获取数据，不清除缓存（提升性能）
      const allRecords = Storage.get('zodiacRecords', []);
      const records = allRecords.filter(r => r.recordType === 'selected');
      
      if (!records.length) { 
        container.innerHTML = '<div class="empty-tip">暂无精选生肖历史</div>'; 
        return;
      }
      
      const fragment = document.createDocumentFragment();
      records.forEach((rec, idx) => {
        try {
          const dateStr = rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
          const zodiacs = Array.isArray(rec.zodiacs) ? rec.zodiacs : [];
          
          // 构建预测生肖标签HTML
          const predictedTagsHtml = zodiacs.map(z => {
            // ✅ 只取生肖名称，去除可能的百分比部分（如 "鼠(11.2%)" -> "鼠"）
            const zodiacName = z.split('(')[0].trim();
            // 判断是否命中（只有命中的那个生肖才高亮）
            const isMatched = rec.checked && rec.matched && rec.actualZodiac === zodiacName;
            const className = isMatched ? 'history-tag history-tag-matched' : 'history-tag';
            return `<div class="${className}">${Utils.escapeHtml(zodiacName)}</div>`;
          }).join('');
          
          // 构建开奖生肖标签HTML
          let actualTagHtml = '';
          if (rec.checked && rec.actualZodiac) {
            const actualClass = rec.matched ? 'history-tag history-tag-actual history-tag-matched' : 'history-tag history-tag-actual history-tag-miss';
            actualTagHtml = `<div class="${actualClass}" data-type="actual">${Utils.escapeHtml(rec.actualZodiac)}</div>`;
          }
          
          const item = document.createElement('div');
          item.className = 'history-item';
          item.dataset.index = idx;
          item.innerHTML = `
            <div class="history-header">
              <div class="history-nums">第${rec.issue || ''}期</div>
              <div class="history-time">${dateStr}</div>
            </div>
            <div class="history-tags">
              <div class="history-tags-predicted">${predictedTagsHtml}</div>
              ${actualTagHtml ? `<div class="history-tags-actual">${actualTagHtml}</div>` : ''}
            </div>
          `;
          
          // 绑定触摸事件
          record._bindSwipeDeleteToItem(item, idx, 'selectedZodiac', () => {
            record._deleteSelectedZodiacRecord(idx);
          });
          
          fragment.appendChild(item);
        } catch (error) {
          console.error('渲染精选生肖历史项失败:', error);
        }
      });
      container.innerHTML = '';
      container.appendChild(fragment);
      
      // ✅ 应用折叠/展开逻辑
      record._applyCollapseLogic('selectedZodiacHistoryList', 'selectedZodiacHistoryToggle', 'selectedZodiac');
    } catch (error) {
      console.error('加载精选生肖历史失败:', error);
      container.innerHTML = '<div class="error-tip">加载失败，请点击刷新重试</div>';
    }
  },
  clearSelectedZodiacHistory: () => {
    if (confirm('确定清空所有精选生肖记录吗？')) {
      const allRecords = Storage.get('zodiacRecords', []);
      const filtered = allRecords.filter(r => r.recordType !== 'selected');
      Storage.set('zodiacRecords', filtered);
      record.renderSelectedZodiacHistory();
      record.renderSelectedZodiacDetailHistory();
      record.renderPredictionStatistics();
      Toast.show('已清空精选生肖记录');
    }
  },

  // 精选生肖历史详情页初始化
  initSelectedZodiacDetail: () => {
    record.renderSelectedZodiacDetailHistory();
  },

  // 渲染精选生肖历史详情
  renderSelectedZodiacDetailHistory: () => {
    const container = document.getElementById('selectedZodiacDetailList');
    const toggle = document.getElementById('selectedZodiacDetailToggle');
    if (!container) return;

    container.innerHTML = '<div class="loading-tip">加载中...</div>';

    try {
      const allRecords = Storage.get('zodiacRecords', []);
      const records = allRecords.filter(r => r.recordType === 'selected');

      if (!records.length) {
        container.innerHTML = '<div class="empty-tip">暂无精选生肖历史</div>';
        if (toggle) toggle.style.display = 'none';
        return;
      }

      const fragment = document.createDocumentFragment();
      records.forEach((rec, idx) => {
        try {
          const dateStr = rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN', {
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
          }) : '';
          const zodiacs = Array.isArray(rec.zodiacs) ? rec.zodiacs : [];

          const predictedTagsHtml = zodiacs.map(z => {
            const zodiacName = z.split('(')[0].trim();
            const isMatched = rec.checked && rec.matched && rec.actualZodiac === zodiacName;
            const className = isMatched ? 'history-tag history-tag-matched' : 'history-tag';
            return `<div class="${className}">${zodiacName}</div>`;
          }).join('');

          let actualTagHtml = '';
          if (rec.checked && rec.actualZodiac) {
            const actualClass = rec.matched ? 'history-tag history-tag-actual history-tag-matched' : 'history-tag history-tag-actual history-tag-miss';
            actualTagHtml = `<div class="${actualClass}" data-type="actual">${rec.actualZodiac}</div>`;
          }

          const item = document.createElement('div');
          item.className = 'history-item';
          item.innerHTML = `
            <div class="history-header">
              <div class="history-nums">第${rec.issue || ''}期</div>
              <div class="history-time">${dateStr}</div>
            </div>
            <div class="history-tags">
              <div class="history-tags-predicted">${predictedTagsHtml}</div>
              ${actualTagHtml ? `<div class="history-tags-actual">${actualTagHtml}</div>` : ''}
            </div>
          `;
          
          // ✅ 绑定滑动删除事件
          record._bindSwipeDeleteToItem(item, idx, 'selectedZodiac', () => {
            record._deleteSelectedZodiacRecord(idx);
          });
          
          fragment.appendChild(item);
        } catch (error) {
          console.error('渲染精选生肖历史详情项失败:', error);
        }
      });

      container.innerHTML = '';
      container.appendChild(fragment);

      if (records.length > 5) {
        if (toggle) {
          toggle.style.display = 'block';
          record._applyCollapseLogic('selectedZodiacDetailList', 'selectedZodiacDetailToggle', 'selectedZodiacDetail');
        }
      } else {
        if (toggle) toggle.style.display = 'none';
      }
    } catch (error) {
      console.error('加载精选生肖历史详情失败:', error);
      container.innerHTML = '<div class="error-tip">加载失败</div>';
    }
  },

  // ML预测历史详情页初始化
  initMLPredictionDetail: () => {
    record.renderMLPredictionDetailHistory();
  },

  // 生肖预测历史详情页初始化
  initZodiacPredictionDetail: () => {
    record.renderZodiacPredictionDetailHistory();
  },

  // 特码热门历史详情页初始化
  initHotNumbersDetail: () => {
    record.renderHotNumbersDetailHistory();
  },

  // 精选特码历史详情页初始化
  initSpecialDetail: () => {
    record.renderSpecialDetailHistory();
  },

  // 渲染ML预测历史详情
  renderMLPredictionDetailHistory: () => {
    const container = document.getElementById('mlPredictionDetailList');
    const toggle = document.getElementById('mlPredictionDetailToggle');
    if (!container) return;

    container.innerHTML = '<div class="loading-tip">加载中...</div>';

    try {
      const mlRecords = Storage.get('mlPredictionRecords', []);

      if (!mlRecords.length) {
        container.innerHTML = '<div class="empty-tip">暂无ML预测历史</div>';
        if (toggle) toggle.style.display = 'none';
        return;
      }

      const fragment = document.createDocumentFragment();
      mlRecords.forEach((rec) => {
        try {
          const dateStr = rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN', {
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
          }) : '';
          const predictions = Array.isArray(rec.predictions) ? rec.predictions : [];

          const predictedTagsHtml = predictions.map(z => {
            const zodiacName = z.split('(')[0].trim();
            const isMatched = rec.checked && rec.matched && rec.actualZodiac === zodiacName;
            const className = isMatched ? 'history-tag history-tag-matched' : 'history-tag';
            return `<div class="${className}">${zodiacName}</div>`;
          }).join('');

          let actualTagHtml = '';
          if (rec.checked && rec.actualZodiac) {
            const actualClass = rec.matched ? 'history-tag history-tag-actual history-tag-matched' : 'history-tag history-tag-actual history-tag-miss';
            actualTagHtml = `<div class="${actualClass}" data-type="actual">${rec.actualZodiac}</div>`;
          }

          // ✅ 显示训练前后标识
          const typeLabel = rec.isTrained ? '<span style="color:#10b981;">🤖 已训练</span>' : '<span style="color:#f59e0b;">📊 未训练</span>';

          const item = document.createElement('div');
          item.className = 'history-item';
          item.innerHTML = `
            <div class="history-header">
              <div class="history-nums">第${rec.issue || ''}期 ML预测 ${typeLabel}</div>
              <div class="history-time">${dateStr}</div>
            </div>
            <div class="history-tags">
              <div class="history-tags-predicted">${predictedTagsHtml}</div>
              ${actualTagHtml ? `<div class="history-tags-actual">${actualTagHtml}</div>` : ''}
            </div>
            ${rec.modelVersion ? `<div class="history-meta" style="font-size: 12px; color: #999; margin-top: 5px;">模型版本: ${rec.modelVersion} | 特征: ${rec.inputFeatures || '历史开奖数据'}</div>` : ''}
          `;
          
          // ✅ 绑定滑动删除事件
          record._bindSwipeDeleteToItem(item, idx, 'mlPrediction', () => {
            record._deleteMLPredictionRecord(rec);
          });
          
          fragment.appendChild(item);
        } catch (error) {
          console.error('渲染ML预测历史详情项失败:', error);
        }
      });

      container.innerHTML = '';
      container.appendChild(fragment);

      if (mlRecords.length > 5) {
        if (toggle) {
          toggle.style.display = 'block';
          record._applyCollapseLogic('mlPredictionDetailList', 'mlPredictionDetailToggle', 'mlPredictionDetail');
        }
      } else {
        if (toggle) toggle.style.display = 'none';
      }
    } catch (error) {
      console.error('加载ML预测历史详情失败:', error);
      container.innerHTML = '<div class="error-tip">加载失败</div>';
    }
  },

  // 渲染生肖预测历史详情
  renderZodiacPredictionDetailHistory: () => {
    const container = document.getElementById('zodiacPredictionDetailList');
    const toggle = document.getElementById('zodiacPredictionDetailToggle');
    if (!container) return;

    container.innerHTML = '<div class="loading-tip">加载中...</div>';

    try {
      const allRecords = Storage.get('zodiacRecords', []);
      const zodiacRecords = allRecords.filter(r => !r.recordType || r.recordType !== 'selected');

      if (!zodiacRecords.length) {
        container.innerHTML = '<div class="empty-tip">暂无生肖预测历史</div>';
        if (toggle) toggle.style.display = 'none';
        return;
      }

      const fragment = document.createDocumentFragment();
      zodiacRecords.forEach((rec, idx) => {
        try {
          const dateStr = rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN', {
            month: '2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'
          }) : '';
          const zodiacs = Array.isArray(rec.zodiacs) ? rec.zodiacs : [];

          const predictedTagsHtml = zodiacs.map(z => {
            const zodiacName = z.split('(')[0].trim();
            const isMatched = rec.checked && rec.matched && rec.actualZodiac === zodiacName;
            const className = isMatched ? 'history-tag history-tag-matched' : 'history-tag';
            return `<div class="${className}">${zodiacName}</div>`;
          }).join('');

          let actualTagHtml = '';
          if (rec.checked && rec.actualZodiac) {
            const actualClass = rec.matched ? 'history-tag history-tag-actual history-tag-matched' : 'history-tag history-tag-actual history-tag-miss';
            actualTagHtml = `<div class="${actualClass}" data-type="actual">${rec.actualZodiac}</div>`;
          }

          const item = document.createElement('div');
          item.className = 'history-item';
          item.innerHTML = `
            <div class="history-header">
              <div class="history-nums">第${rec.issue || ''}期 10期数据</div>
              <div class="history-time">${dateStr}</div>
            </div>
            <div class="history-tags">
              <div class="history-tags-predicted">${predictedTagsHtml}</div>
              ${actualTagHtml ? `<div class="history-tags-actual">${actualTagHtml}</div>` : ''}
            </div>
          `;
          
          // ✅ 绑定滑动删除事件
          record._bindSwipeDeleteToItem(item, idx, 'zodiacPrediction', () => {
            record._deleteZodiacPredictionRecord(rec.issue);
          });
          
          fragment.appendChild(item);
        } catch (error) {
          console.error('渲染生肖预测历史详情项失败:', error);
        }
      });

      container.innerHTML = '';
      container.appendChild(fragment);

      if (zodiacRecords.length > 5) {
        if (toggle) {
          toggle.style.display = 'block';
          record._applyCollapseLogic('zodiacPredictionDetailList', 'zodiacPredictionDetailToggle', 'zodiacPredictionDetail');
        }
      } else {
        if (toggle) toggle.style.display = 'none';
      }
    } catch (error) {
      console.error('加载生肖预测历史详情失败:', error);
      container.innerHTML = '<div class="error-tip">加载失败</div>';
    }
  },

  // 渲染特码热门历史详情
  renderHotNumbersDetailHistory: () => {
    const container = document.getElementById('hotNumbersDetailList');
    const toggle = document.getElementById('hotNumbersDetailToggle');
    if (!container) return;

    container.innerHTML = '<div class="loading-tip">加载中...</div>';

    try {
      const hotRecords = Storage.get('hotNumbersRecords', []);

      if (!hotRecords.length) {
        container.innerHTML = '<div class="empty-tip">暂无特码热门历史</div>';
        if (toggle) toggle.style.display = 'none';
        return;
      }

      const fragment = document.createDocumentFragment();
      hotRecords.forEach((rec, idx) => {
        try {
          const dateStr = rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN', {
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
          }) : '';
          const numbers = Array.isArray(rec.numbers) ? rec.numbers : [];

          const predictedTagsHtml = numbers.map(n => {
            const numStr = typeof n === 'object' ? n.number : n;
            return `<div class="history-tag">${numStr}</div>`;
          }).join('');

          let actualTagHtml = '';
          if (rec.checked && rec.actualNumbers && rec.actualNumbers.length > 0) {
            const actualClass = rec.matched ? 'history-tag history-tag-actual history-tag-matched' : 'history-tag history-tag-actual history-tag-miss';
            actualTagHtml = `<div class="${actualClass}" data-type="actual">${rec.actualNumbers[0]}</div>`;
          }

          const item = document.createElement('div');
          item.className = 'history-item';
          item.innerHTML = `
            <div class="history-header">
              <div class="history-nums">第${rec.issue || ''}期 热门TOP5</div>
              <div class="history-time">${dateStr}</div>
            </div>
            <div class="history-tags">
              <div class="history-tags-predicted">${predictedTagsHtml}</div>
              ${actualTagHtml ? `<div class="history-tags-actual">${actualTagHtml}</div>` : ''}
            </div>
          `;
          
          // ✅ 绑定滑动删除事件
          record._bindSwipeDeleteToItem(item, idx, 'hotNumbers', () => {
            record._deleteHotNumbersRecord(rec.issue);
          });
          
          fragment.appendChild(item);
        } catch (error) {
          console.error('渲染特码热门历史详情项失败:', error);
        }
      });

      container.innerHTML = '';
      container.appendChild(fragment);

      if (hotRecords.length > 5) {
        if (toggle) {
          toggle.style.display = 'block';
          record._applyCollapseLogic('hotNumbersDetailList', 'hotNumbersDetailToggle', 'hotNumbersDetail');
        }
      } else {
        if (toggle) toggle.style.display = 'none';
      }
    } catch (error) {
      console.error('加载特码热门历史详情失败:', error);
      container.innerHTML = '<div class="error-tip">加载失败</div>';
    }
  },

  // 渲染精选特码历史详情
  renderSpecialDetailHistory: () => {
    const container = document.getElementById('specialDetailList');
    const toggle = document.getElementById('specialDetailToggle');
    if (!container) return;

    container.innerHTML = '<div class="loading-tip">加载中...</div>';

    try {
      const specialRecords = Storage.get('numberRecords', []);

      if (!specialRecords.length) {
        container.innerHTML = '<div class="empty-tip">暂无精选特码历史</div>';
        if (toggle) toggle.style.display = 'none';
        return;
      }

      const fragment = document.createDocumentFragment();
      specialRecords.forEach((rec, idx) => {
        try {
          const dateStr = rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN', {
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
          }) : '';
          const numbers = Array.isArray(rec.numbers) ? rec.numbers : [];

          const predictedTagsHtml = numbers.map(n => {
            const numStr = typeof n === 'object' ? n.number : n;
            return `<div class="history-tag">${numStr}</div>`;
          }).join('');

          let actualTagHtml = '';
          if (rec.checked && rec.actualNumbers && rec.actualNumbers.length > 0) {
            const actualClass = rec.matched ? 'history-tag history-tag-actual history-tag-matched' : 'history-tag history-tag-actual history-tag-miss';
            actualTagHtml = `<div class="${actualClass}" data-type="actual">${rec.actualNumbers[0]}</div>`;
          }

          const periodLabel = rec.periods ? `${rec.periods}期` : '10期';
          const numCount = rec.numCount || 5;
          
          const item = document.createElement('div');
          item.className = 'history-item';
          item.innerHTML = `
            <div class="history-header">
              <div class="history-nums">第${rec.issue || ''}期 精选特码<span style="font-size:11px;color:#9c36b5;margin-left:8px;">🤖</span></div>
              <div class="history-time">${dateStr}</div>
            </div>
            <div class="history-tags">
              <div class="history-tags-predicted">${predictedTagsHtml}</div>
              ${actualTagHtml ? `<div class="history-tags-actual">${actualTagHtml}</div>` : ''}
            </div>
            <div class="history-meta" style="font-size:11px;color:#999;margin-top:4px;display:flex;gap:8px;align-items:center;">
              <span>📊 ${periodLabel}</span>
              <span>🎯 ${numCount}个</span>
            </div>
          `;
          
          // ✅ 绑定滑动删除事件
          record._bindSwipeDeleteToItem(item, idx, 'special', () => {
            record._deleteSpecialRecord(rec);
          });
          
          fragment.appendChild(item);
        } catch (error) {
          console.error('渲染精选特码历史详情项失败:', error);
        }
      });

      container.innerHTML = '';
      container.appendChild(fragment);

      if (specialRecords.length > 5) {
        if (toggle) {
          toggle.style.display = 'block';
          record._applyCollapseLogic('specialDetailList', 'specialDetailToggle', 'specialDetail');
        }
      } else {
        if (toggle) toggle.style.display = 'none';
      }
    } catch (error) {
      console.error('加载精选特码历史详情失败:', error);
      container.innerHTML = '<div class="error-tip">加载失败</div>';
    }
  },

  // 分页参数
  _pagination: {
    zodiacPrediction: { page: 1, pageSize: 5 },
    mlPrediction: { page: 1, pageSize: 5 },
    specialHistory: { page: 1, pageSize: 5 },
    hotNumbers: { page: 1, pageSize: 5 }
  },
  
  // ✅ 折叠/展开状态管理
  _collapseState: {
    selectedZodiac: false,  // 精选生肖
    selectedZodiacDetail: false, // 精选生肖历史详情
    mlPrediction: false, // ML预测
    mlPredictionDetail: false, // ML预测历史详情
    zodiacPrediction: false, // 生肖预测
    zodiacPredictionDetail: false, // 生肖预测历史详情
    special: false,          // 精选特码
    specialDetail: false,    // 精选特码历史详情
    hotNumbers: false,        // 特码热门TOP5
    hotNumbersDetail: false  // 特码热门历史详情
  },
  
  // ✅ 精选特码历史筛选状态
  _specialHistoryFilter: {
    selectedPeriod: '10',   // 默认10期
    selectedNumCount: '5'   // 默认5个
  },
  
  /**
   * ✅ 应用折叠/展开逻辑
   * @param {string} containerId - 容器ID
   * @param {string} toggleId - 切换按钮ID
   * @param {string} stateKey - 状态键名
   */
  _applyCollapseLogic: (containerId, toggleId, stateKey) => {
    const container = document.getElementById(containerId);
    const toggle = document.getElementById(toggleId);
    
    if (!container || !toggle) return;
    
    const items = container.querySelectorAll('.history-item');
    const isExpanded = record._collapseState[stateKey];
    
    if (items.length <= 2) {
      // 如果记录数不超过2条，隐藏切换按钮
      toggle.style.display = 'none';
      return;
    }
    
    // 显示切换按钮
    toggle.style.display = 'block';
    toggle.textContent = isExpanded ? '收起' : '展开更多';
    
    // 根据状态显示/隐藏多余的记录
    items.forEach((item, index) => {
      if (index >= 2) {
        item.style.display = isExpanded ? 'block' : 'none';
      }
    });
  },
  
  /**
   * ✅ 切换折叠/展开状态
   * @param {string} stateKey - 状态键名
   * @param {string} containerId - 容器ID
   * @param {string} toggleId - 切换按钮ID
   */
  _toggleCollapse: (stateKey, containerId, toggleId) => {
    record._collapseState[stateKey] = !record._collapseState[stateKey];
    record._applyCollapseLogic(containerId, toggleId, stateKey);
  },
  
  // 生肖预测历史筛选状态
  _zodiacPredictionFilter: {
    selectedPeriods: ['10'] // 默认只显示10期数据
  },

  // ---------- 生肖预测历史 ----------
  renderZodiacPredictionHistory: (loadMore = false) => {
    const container = document.getElementById('zodiacPredictionHistoryList');
    if (!container) return;
    
    // 如果不是加载更多，重置分页参数
    if (!loadMore) {
      record._pagination.zodiacPrediction.page = 1;
      // 显示加载状态
      container.innerHTML = '<div class="loading-tip">加载中...</div>';
    }
    
    try {
      // ✅ 直接获取数据，不清除缓存
      const allRecords = Storage.get('zodiacRecords', []);
      let records = allRecords.filter(r => !r.recordType || r.recordType !== 'selected');
      
      // 应用筛选条件：根据选择的期数过滤
      const selectedPeriods = record._zodiacPredictionFilter.selectedPeriods;
      if (selectedPeriods && selectedPeriods.length > 0) {
        records = records.filter(rec => {
          if (!rec.periodData) return false;
          
          const selectedPeriod = selectedPeriods[0]; // 单选模式，只取第一个
          
          // 如果选择的是"全年"，显示所有记录
          if (selectedPeriod === 'all') {
            return true;
          }
          
          // 检查记录是否包含选中的期数（注意：存储时是数字键，需要转换）
          return rec.periodData.hasOwnProperty(selectedPeriod) || 
                 rec.periodData.hasOwnProperty(Number(selectedPeriod));
        });
      }
      
      if (!records.length) { 
        if (!loadMore) {
          container.innerHTML = '<div class="empty-tip">暂无预测历史</div>'; 
        }
        // 隐藏展开更多按钮
        const toggle = document.getElementById('zodiacPredictionHistoryToggle');
        if (toggle) toggle.style.display = 'none';
        return;
      }
      
      // 计算分页数据
      const { page, pageSize } = record._pagination.zodiacPrediction;
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedRecords = records.slice(startIndex, endIndex);
      
      const fragment = document.createDocumentFragment();
      paginatedRecords.forEach((rec, idx) => {
        try {
          const dateStr = rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
          
          // 根据筛选条件显示对应的期数信息
          let periodInfo = '';
          if (rec.periodData) {
            const availablePeriods = Object.keys(rec.periodData);
            // 显示选中的期数中第一个可用的
            const displayPeriod = selectedPeriods.find(p => availablePeriods.includes(p)) || availablePeriods[0];
            periodInfo = `${displayPeriod}期数据`;
          } else {
            periodInfo = '10期数据';
          }
          
          // 获取对应期数的生肖数据（前6名，按顺序）
          let zodiacs = [];
          const displayPeriod = selectedPeriods[0]; // 单选模式，只取第一个
          
          if (displayPeriod === 'all') {
            // 全年模式：显示第一条可用期数的数据
            if (rec.periodData) {
              const availableKeys = Object.keys(rec.periodData);
              if (availableKeys.length > 0) {
                zodiacs = rec.periodData[availableKeys[0]];
              }
            }
          } else if (rec.periodData) {
            // 尝试字符串键和数字键
            zodiacs = rec.periodData[displayPeriod] || rec.periodData[Number(displayPeriod)] || [];
          }
          
          // 如果没有期数数据，使用旧的zodiacs字段
          if (!zodiacs || zodiacs.length === 0) {
            zodiacs = Array.isArray(rec.zodiacs) ? rec.zodiacs : [];
          }
          
          // 确保只显示前6名，并按顺序排列
          zodiacs = zodiacs.slice(0, 6);
          
          // 直接使用保存的期号（已经是预测期号，无需+1）
          const displayIssue = rec.issue || '';
          
          // 调试日志：显示期号信息
          if (idx === 0) {
            console.log('[Record] 📅 最新历史记录期号:', displayIssue, '(应与分析页面标题中的期号一致)');
          }
          
          const item = document.createElement('div');
          item.className = 'history-item';
          item.dataset.index = idx;
          
          // 构建预测生肖标签HTML
          const predictedTagsHtml = zodiacs.map((z, index) => {
            // ✅ 只取生肖名称，去除可能的百分比部分（如 "鼠(11.2%)" -> "鼠"）
            const zodiacName = z.split('(')[0].trim();
            // 判断是否命中
            const isMatched = rec.checked && rec.matched && rec.actualZodiac === zodiacName;
            const className = isMatched ? 'history-tag history-tag-matched' : 'history-tag';
            return `<div class="${className}" data-rank="${index + 1}">${Utils.escapeHtml(zodiacName)}</div>`;
          }).join('');
          
          // 构建开奖生肖标签HTML
          let actualTagHtml = '';
          if (rec.checked && rec.actualZodiac) {
            const actualClass = rec.matched ? 'history-tag history-tag-actual history-tag-matched' : 'history-tag history-tag-actual history-tag-miss';
            actualTagHtml = `<div class="${actualClass}" data-type="actual">${Utils.escapeHtml(rec.actualZodiac)}</div>`;
          }
          
          item.innerHTML = `
            <div class="history-header">
              <div class="history-nums">第${Utils.escapeHtml(displayIssue)}期 ${Utils.escapeHtml(periodInfo)}</div>
              <div class="history-time">${dateStr}</div>
            </div>
            <div class="history-tags">
              <div class="history-tags-predicted">${predictedTagsHtml}</div>
              ${actualTagHtml ? `<div class="history-tags-actual">${actualTagHtml}</div>` : ''}
            </div>
          `;
          
          // 绑定触摸事件
          record._bindSwipeDeleteToItem(item, idx, 'zodiacPrediction', () => {
            record._deleteZodiacPredictionRecord(rec.issue);
          });
          
          fragment.appendChild(item);
        } catch (error) {
          console.error('渲染生肖预测历史项失败:', error);
        }
      });
      
      // 如果是加载更多，追加内容；否则替换内容
      if (loadMore) {
        container.appendChild(fragment);
      } else {
        container.innerHTML = '';
        container.appendChild(fragment);
      }
      
      // 更新分页参数
      record._pagination.zodiacPrediction.page++;
      
      // 显示/隐藏展开更多按钮
      const toggle = document.getElementById('zodiacPredictionHistoryToggle');
      if (toggle) {
        toggle.style.display = endIndex < records.length ? 'block' : 'none';
      }
    } catch (error) {
      console.error('加载生肖预测历史失败:', error);
      if (!loadMore) {
        container.innerHTML = '<div class="error-tip">加载失败，请点击刷新重试</div>';
      }
      // 隐藏展开更多按钮
      const toggle = document.getElementById('zodiacPredictionHistoryToggle');
      if (toggle) toggle.style.display = 'none';
    }
  },
  clearZodiacPredictionHistory: () => {
    if (confirm('确定清空所有生肖预测历史吗？')) {
      const allRecords = Storage.get('zodiacRecords', []);
      const filtered = allRecords.filter(r => r.recordType === 'selected');
      Storage.set('zodiacRecords', filtered);
      record.renderZodiacPredictionHistory();
      record.renderPredictionStatistics();
      Toast.show('已清空生肖预测历史');
    }
  },

  // ---------- ML预测历史 ----------
  renderMLPredictionHistory: (loadMore = false) => {
    const container = document.getElementById('mlPredictionHistoryList');
    if (!container) return;
    
    // 如果不是加载更多，重置分页参数
    if (!loadMore) {
      record._pagination.mlPrediction.page = 1;
      // 显示加载状态
      container.innerHTML = '<div class="loading-tip">加载中...</div>';
    }
    
    try {
      // ✅ 直接获取数据，不清除缓存
      const mlRecords = Storage.get('mlPredictionRecords', []);
      
      if (!mlRecords.length) { 
        if (!loadMore) {
          container.innerHTML = '<div class="empty-tip">暂无ML预测历史</div>'; 
        }
        // 隐藏展开更多按钮
        const toggle = document.getElementById('mlPredictionHistoryToggle');
        if (toggle) toggle.style.display = 'none';
        return;
      }
      
      // ✅ 去重处理：按 issue 去重，保留每个期号的最新预测（数组中靠前的记录）
      const seenIssues = new Set();
      const uniqueRecords = [];
      
      // 调试：查看原始数据
      if (mlRecords.length > 0) {
        console.log('[Record] 🔍 原始数据前3条:');
        mlRecords.slice(0, 3).forEach((rec, idx) => {
          console.log(`  [${idx}] issue:`, rec.issue, '| type:', typeof rec.issue, '| createdAt:', rec.createdAt);
        });
      }
      
      mlRecords.forEach((rec, idx) => {
        // 统一转换为字符串进行比较，避免数字/字符串类型不匹配
        const issueKey = String(rec.issue);
        if (seenIssues.has(issueKey)) {
          console.log(`[Record] ⏭️ [${idx}] 跳过重复期号:`, rec.issue, '(类型:', typeof rec.issue, ')');
          return; // 已存在该期号，跳过
        }
        seenIssues.add(issueKey);
        uniqueRecords.push(rec);
      });
      
      console.log('[Record] 📊 ML预测历史 - 原始:', mlRecords.length, '条, 去重后:', uniqueRecords.length, '条');
      if (uniqueRecords.length > 0) {
        console.log('[Record] 📋 去重后的前3条期号:', uniqueRecords.slice(0, 3).map(r => ({ issue: r.issue, time: r.createdAt })));
      }
      
      // 计算分页数据
      const { page, pageSize } = record._pagination.mlPrediction;
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedRecords = uniqueRecords.slice(startIndex, endIndex);
      
      const fragment = document.createDocumentFragment();
      paginatedRecords.forEach((rec, idx) => {
        try {
          const dateStr = rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
          const zodiacs = Array.isArray(rec.predictions) ? rec.predictions : [];
          const modelVersion = rec.modelVersion || '1.0';
          const inputFeatures = rec.inputFeatures || '历史开奖数据';
          
          // ✅ 构建预测生肖标签HTML（带核对状态）
          const predictedTagsHtml = zodiacs.map((z, index) => {
            // ✅ 只取生肖名称，去除可能的百分比部分（如 "龙(14.9%)" -> "龙"）
            const zodiacName = z.split('(')[0].trim();
            // 判断是否命中
            const isMatched = rec.checked && rec.matched && rec.actualZodiac === zodiacName;
            const className = isMatched ? 'history-tag history-tag-matched' : 'history-tag';
            return `<div class="${className}">${Utils.escapeHtml(zodiacName)}</div>`;
          }).join('');
          
          // ✅ 构建开奖生肖标签HTML
          let actualTagHtml = '';
          if (rec.checked && rec.actualZodiac) {
            const actualClass = rec.matched ? 'history-tag history-tag-actual history-tag-matched' : 'history-tag history-tag-actual history-tag-miss';
            actualTagHtml = `<div class="${actualClass}">${Utils.escapeHtml(rec.actualZodiac)}</div>`;
          }
          
          const item = document.createElement('div');
          item.className = 'history-item';
          item.dataset.index = idx;
          item.innerHTML = `
            <div class="history-header">
              <div class="history-nums">第${rec.issue || ''}期 ML预测</div>
              <div class="history-time">${dateStr}</div>
            </div>
            <div class="history-tags">
              <div class="history-tags-predicted">${predictedTagsHtml}</div>
              ${actualTagHtml ? `<div class="history-tags-actual">${actualTagHtml}</div>` : ''}
            </div>
            <div class="history-meta" style="font-size: 12px; color: #999; margin-top: 5px;">模型版本: ${Utils.escapeHtml(modelVersion)} | 特征: ${Utils.escapeHtml(inputFeatures)}</div>
          `;
          
          // 绑定触摸事件
          record._bindSwipeDeleteToItem(item, idx, 'mlPrediction', () => {
            record._deleteMLPredictionRecord(rec);
          });
          
          fragment.appendChild(item);
        } catch (error) {
          console.error('渲染ML预测历史项失败:', error);
        }
      });
      
      // 如果是加载更多，追加内容；否则替换内容
      if (loadMore) {
        container.appendChild(fragment);
      } else {
        container.innerHTML = '';
        container.appendChild(fragment);
      }
      
      // 更新分页参数
      record._pagination.mlPrediction.page++;
      
      // 显示/隐藏展开更多按钮
      const toggle = document.getElementById('mlPredictionHistoryToggle');
      if (toggle) {
        toggle.style.display = endIndex < uniqueRecords.length ? 'block' : 'none';
      }
    } catch (error) {
      console.error('加载ML预测历史失败:', error);
      if (!loadMore) {
        container.innerHTML = '<div class="error-tip">加载失败，请点击刷新重试</div>';
      }
      // 隐藏展开更多按钮
      const toggle = document.getElementById('mlPredictionHistoryToggle');
      if (toggle) toggle.style.display = 'none';
    }
  },
  refreshMLPredictionHistory: () => { record.renderMLPredictionHistory(); Toast.show('ML预测历史已刷新'); },
  clearMLPredictionHistory: () => {
    if (confirm('确定清空所有ML预测历史吗？')) {
      Storage.set('mlPredictionRecords', []);
      record.renderMLPredictionHistory();
      Toast.show('已清空ML预测历史');
    }
  },
  /**
   * 核对 ML 预测记录
   * @param {string} issue - 期号
   * @param {string} actualZodiac - 实际开奖生肖
   */
  checkMLPredictionRecord: (issue, actualZodiac) => {
    const result = Storage.checkMLPredictionRecord(issue, actualZodiac);
    if (result.success) {
      record.renderMLPredictionHistory();
    }
    return result;
  },

  // ---------- 精选特码历史 ----------
  renderSpecialHistory: () => {
    const container = document.getElementById('specialHistoryList');
    if (!container) {
      console.warn('[Record] 容器不存在: specialHistoryList');
      return;
    }
    
    // 显示加载状态
    container.innerHTML = '<div class="loading-tip">加载中...</div>';
    
    try {
      // ✅ 直接获取数据，不清除缓存
      const specialRecords = Storage.get('numberRecords', []);
      
      if (!specialRecords.length) { 
        container.innerHTML = '<div class="empty-tip">暂无精选特码历史</div>'; 
        return;
      }
      
      // ✅ 获取当前历史记录模式
      const activeModeBtn = document.querySelector('.special-history-mode-btn.active');
      const historyMode = activeModeBtn ? activeModeBtn.dataset.mode : 'all';
      
      // ✅ 获取当前筛选条件（期数和号码数量）
      const selectedPeriod = record._specialHistoryFilter.selectedPeriod;
      const selectedNumCount = record._specialHistoryFilter.selectedNumCount;
      console.log('[Record] 📊 精选特码筛选条件:', { period: selectedPeriod, numCount: selectedNumCount });
      
      // ✅ 根据模式筛选记录
      let filteredRecords = specialRecords;
      if (historyMode !== 'all') {
        filteredRecords = specialRecords.filter(rec => {
          if (historyMode === 'hot') {
            // 热号模式：显示mode='hot'或mode='auto-hot'的记录
            return rec.mode === 'hot' || rec.type === 'auto-hot';
          } else if (historyMode === 'cold') {
            // 冷号模式：显示mode='cold'或mode='auto-cold'的记录
            return rec.mode === 'cold' || rec.type === 'auto-cold';
          }
          return true;
        });
      }
      
      // ✅ 根据期数和号码数量筛选
      console.log('[Record] 🔍 开始筛选记录...');
      console.log('[Record] 📊 当前筛选条件:', { period: selectedPeriod, numCount: selectedNumCount, 类型: typeof selectedPeriod, 数量类型: typeof selectedNumCount });
      
      filteredRecords = filteredRecords.filter((rec, index) => {
        // 记录前3条数据的详细信息
        if (index < 3) {
          console.log(`[Record] 📝 记录[${index}]:`, {
            issue: rec.issue,
            period: rec.period,
            period类型: typeof rec.period,
            numCount: rec.numCount,
            numCount类型: typeof rec.numCount,
            numbers数量: rec.numbers ? rec.numbers.length : 0
          });
        }
        
        // 期数匹配：如果记录有period字段，需要匹配
        if (rec.period !== undefined) {
          // 处理'全年'和'all'的兼容性
          const recordPeriod = rec.period === 'all' ? 'all' : String(rec.period);
          const matchPeriod = recordPeriod === selectedPeriod;
          
          if (index < 3) {
            console.log(`[Record] 📊 记录[${index}] 期数匹配:`, {
              记录期数: recordPeriod,
              筛选期数: selectedPeriod,
              匹配结果: matchPeriod
            });
          }
          
          if (!matchPeriod) {
            return false;
          }
        }
        
        // 号码数量匹配：如果记录有numCount字段，需要匹配
        if (rec.numCount !== undefined) {
          const recordNumCount = String(rec.numCount);
          const matchNumCount = recordNumCount === selectedNumCount;
          
          if (index < 3) {
            console.log(`[Record] 🎯 记录[${index}] 数量匹配:`, {
              记录数量: recordNumCount,
              筛选数量: selectedNumCount,
              匹配结果: matchNumCount
            });
          }
          
          if (!matchNumCount) {
            return false;
          }
        }
        
        return true;
      });
      
      console.log('[Record] 📊 筛选结果:', { 
        总记录数: specialRecords.length, 
        模式筛选后: filteredRecords.length,
        筛选条件: { period: selectedPeriod, numCount: selectedNumCount }
      });
      
      const fragment = document.createDocumentFragment();
      filteredRecords.forEach((rec, idx) => {
        try {
          const dateStr = rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
          
          // ✅ 根据当前历史记录模式决定显示哪些号码
          let displayNumbers = [];
          let modeLabel = '';
          
          if (historyMode === 'hot' && rec.hotNumbers && rec.hotNumbers.length > 0) {
            // 热号模式：优先显示热号
            displayNumbers = rec.hotNumbers;
            modeLabel = '<span style="font-size:11px;color:#ff6b6b;margin-left:8px;">🔥 热号</span>';
          } else if (historyMode === 'cold' && rec.coldNumbers && rec.coldNumbers.length > 0) {
            // 冷号模式：优先显示冷号
            displayNumbers = rec.coldNumbers;
            modeLabel = '<span style="font-size:11px;color:#4dabf7;margin-left:8px;">❄️ 冷号</span>';
          } else {
            // 全部模式或没有对应数据：显示实际保存的号码
            displayNumbers = Array.isArray(rec.numbers) ? rec.numbers : [];
            // 添加模式标识
            if (rec.mode === 'hot') {
              modeLabel = '<span style="font-size:11px;color:#ff6b6b;margin-left:8px;">🔥</span>';
            } else if (rec.mode === 'cold') {
              modeLabel = '<span style="font-size:11px;color:#4dabf7;margin-left:8px;">❄️</span>';
            } else if (rec.mode === 'auto') {
              modeLabel = '<span style="font-size:11px;color:#9c36b5;margin-left:8px;">🤖</span>';
            }
          }
          
          // ✅ 构建元数据显示（期数范围和号码数量）
          let metaInfo = '';
          if (rec.period && rec.numCount) {
            const periodText = rec.period === 'all' ? '全年' : `${rec.period}期`;
            const countText = `${rec.numCount}个`;
            metaInfo = `<div class="history-meta" style="font-size:11px;color:#999;margin-top:4px;display:flex;gap:8px;align-items:center;">
              <span>📊 ${periodText}</span>
              <span>🎯 ${countText}</span>
            </div>`;
          }
          
          // 构建预测号码标签HTML
          let predictedTagsHtml = '';
          if (rec.checked && rec.actualNumbers && Array.isArray(rec.actualNumbers) && rec.actualNumbers.length > 0) {
            // 提取特码（最后一个号码）
            const specialNumber = rec.actualNumbers[rec.actualNumbers.length - 1];
            // 为每个预测号码添加相应的样式类
            predictedTagsHtml = displayNumbers.map(n => {
              // 如果命中且当前号码等于特码，则高亮蓝色
              const tagClass = (rec.matched && n === specialNumber) ? 'history-tag history-tag-matched' : 'history-tag';
              return `<div class="${tagClass}">${Utils.escapeHtml(n)}</div>`;
            }).join('');
          } else {
            predictedTagsHtml = displayNumbers.map(n => `<div class="history-tag">${Utils.escapeHtml(n)}</div>`).join('');
          }
          
          // 构建开奖号码标签HTML（如果有开奖号码数据）
          let actualTagHtml = '';
          if (rec.checked && rec.actualNumbers && Array.isArray(rec.actualNumbers) && rec.actualNumbers.length > 0) {
            // 提取特码（最后一个号码）
            const specialNumber = rec.actualNumbers[rec.actualNumbers.length - 1];
            const actualClass = rec.matched ? 'history-tag history-tag-matched' : 'history-tag history-tag-miss';
            actualTagHtml = `<div class="${actualClass}">${Utils.escapeHtml(specialNumber)}</div>`;
          }
          
          const item = document.createElement('div');
          item.className = 'history-item';
          item.dataset.index = idx;
          item.innerHTML = `
            <div class="history-header">
              <div class="history-nums">第${rec.issue || ''}期 精选特码${modeLabel}</div>
              <div class="history-time">${dateStr}</div>
            </div>
            <div class="history-tags">
              <div class="history-tags-predicted">${predictedTagsHtml}</div>
              ${actualTagHtml ? `<div class="history-tags-actual">${actualTagHtml}</div>` : ''}
            </div>
            ${metaInfo}
          `;
          
          // 绑定触摸事件
          record._bindSwipeDeleteToItem(item, idx, 'special', () => {
            record._deleteSpecialRecord(rec);
          });
          
          fragment.appendChild(item);
        } catch (error) {
          console.error('渲染精选特码历史项失败:', error);
        }
      });
      container.innerHTML = '';
      container.appendChild(fragment);
      
      // ✅ 如果没有符合条件的记录
      if (filteredRecords.length === 0) {
        container.innerHTML = `<div class="empty-tip">暂无${historyMode === 'hot' ? '热号' : '冷号'}模式的历史记录</div>`;
      }
      
      // ✅ 应用折叠/展开逻辑
      record._applyCollapseLogic('specialHistoryList', 'specialHistoryToggle', 'special');
    } catch (error) {
      console.error('加载精选特码历史失败:', error);
      container.innerHTML = '<div class="error-tip">加载失败，请点击刷新重试</div>';
    }
  },
  clearSpecialHistory: () => {
    if (confirm('确定清空所有精选特码历史吗？')) {
      Storage.set('numberRecords', []);
      record.renderSpecialHistory();
      Toast.show('已清空精选特码历史');
    }
  },

  // ---------- 特码热门TOP5历史 ----------
  renderHotNumbersHistory: () => {
    const container = document.getElementById('hotNumbersHistoryList');
    if (!container) {
      console.warn('[Record] 容器不存在: hotNumbersHistoryList');
      return;
    }
    
    // 显示加载状态
    container.innerHTML = '<div class="loading-tip">加载中...</div>';
    
    try {
      // ✅ 直接获取数据，不清除缓存
      const hotRecords = Storage.get('hotNumbersRecords', []);
      
      if (!hotRecords.length) { 
        container.innerHTML = '<div class="empty-tip">暂无特码热门TOP5历史</div>'; 
        return;
      }
      
      const fragment = document.createDocumentFragment();
      hotRecords.forEach((rec, idx) => {
        try {
          const dateStr = rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
          const numbers = Array.isArray(rec.numbers) ? rec.numbers : [];
          
          // 构建预测号码标签HTML
          let predictedTagsHtml = '';
          if (rec.checked && rec.actualNumbers && Array.isArray(rec.actualNumbers) && rec.actualNumbers.length > 0) {
            // 提取特码（最后一个号码）
            const specialNumber = rec.actualNumbers[rec.actualNumbers.length - 1];
            // 为每个预测号码添加相应的样式类
            predictedTagsHtml = numbers.map(n => {
              // 如果命中且当前号码等于特码，则高亮蓝色
              const tagClass = (rec.matched && n === specialNumber) ? 'history-tag history-tag-matched' : 'history-tag';
              return `<div class="${tagClass}">${Utils.escapeHtml(n)}</div>`;
            }).join('');
          } else {
            predictedTagsHtml = numbers.map(n => `<div class="history-tag">${Utils.escapeHtml(n)}</div>`).join('');
          }
          
          // 构建开奖号码标签HTML（如果有开奖号码数据）
          let actualTagHtml = '';
          if (rec.checked && rec.actualNumbers && Array.isArray(rec.actualNumbers) && rec.actualNumbers.length > 0) {
            // 提取特码（最后一个号码）
            const specialNumber = rec.actualNumbers[rec.actualNumbers.length - 1];
            const actualClass = rec.matched ? 'history-tag history-tag-matched' : 'history-tag history-tag-miss';
            actualTagHtml = `<div class="${actualClass}">${Utils.escapeHtml(specialNumber)}</div>`;
          }
          
          const item = document.createElement('div');
          item.className = 'history-item';
          item.dataset.index = idx;
          item.innerHTML = `
            <div class="history-header">
              <div class="history-nums">第${rec.issue || ''}期 热门TOP5</div>
              <div class="history-time">${dateStr}</div>
            </div>
            <div class="history-tags">
              <div class="history-tags-predicted">${predictedTagsHtml}</div>
              ${actualTagHtml ? `<div class="history-tags-actual">${actualTagHtml}</div>` : ''}
            </div>
          `;
          
          // 绑定触摸事件
          record._bindSwipeDeleteToItem(item, idx, 'hotNumbers', () => {
            record._deleteHotNumbersRecord(rec.issue);
          });
          
          fragment.appendChild(item);
        } catch (error) {
          console.error('渲染特码热门TOP5历史项失败:', error);
        }
      });
      container.innerHTML = '';
      container.appendChild(fragment);
      
      // ✅ 应用折叠/展开逻辑
      record._applyCollapseLogic('hotNumbersHistoryList', 'hotNumbersHistoryToggle', 'hotNumbers');
    } catch (error) {
      console.error('加载特码热门TOP5历史失败:', error);
      container.innerHTML = '<div class="error-tip">加载失败，请点击刷新重试</div>';
    }
  },
  clearHotNumbersHistory: () => {
    if (confirm('确定清空所有特码热门TOP5历史吗？')) {
      Storage.set('hotNumbersRecords', []);
      record.renderHotNumbersHistory();
      Toast.show('已清空特码热门TOP5历史');
    }
  },

  // ---------- 筛选面板操作 ----------
  togglePredictionFiltersPanel: () => {
    const panel = document.getElementById('predictionFiltersPanel');
    if (panel) panel.classList.toggle('show');
  },
  toggleSpecialFiltersPanel: () => {
    const panel = document.getElementById('specialFiltersPanel');
    if (panel) panel.classList.toggle('show');
  },
  selectAllPredictionPeriods: () => {
    // 在单选模式下，全选没有意义，默认选中第一个（10期）
    const buttons = document.querySelectorAll('.prediction-period-btn');
    buttons.forEach((btn, index) => {
      if (index === 0) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    record._zodiacPredictionFilter.selectedPeriods = ['10'];
    console.log('[Filter] 全选操作（单选模式），设置为10期');
  },
  resetPredictionPeriods: () => {
    // 在单选模式下，重置为默认值（10期）
    const buttons = document.querySelectorAll('.prediction-period-btn');
    buttons.forEach((btn, index) => {
      if (index === 0) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    record._zodiacPredictionFilter.selectedPeriods = ['10'];
    console.log('[Filter] 重置操作（单选模式），设置为10期');
  },
  confirmPredictionFilters: () => {
    // 获取当前选中的期数按钮（单选模式）
    const activeButton = document.querySelector('.prediction-period-btn.active');
    const selectedPeriod = activeButton ? activeButton.dataset.period : '10';
    
    // 更新筛选状态为单选
    record._zodiacPredictionFilter.selectedPeriods = [selectedPeriod];
    
    console.log('[Filter] 生肖预测历史筛选条件:', record._zodiacPredictionFilter.selectedPeriods);
    
    // 关闭筛选面板
    const panel = document.getElementById('predictionFiltersPanel');
    if (panel) panel.classList.remove('show');
    
    // 重新渲染生肖预测历史
    record.renderZodiacPredictionHistory();
    
    Toast.show(`已应用筛选：${selectedPeriod === 'all' ? '全年' : selectedPeriod + '期'}`);
  },
  confirmSpecialFilters: () => {
    // 获取当前选中的期数按钮
    const activePeriodBtn = document.querySelector('.special-period-btn.active');
    const selectedPeriod = activePeriodBtn ? activePeriodBtn.dataset.period : '10';
    
    // 获取当前选中的号码数量按钮
    const activeNumBtn = document.querySelector('.special-num-btn.active');
    const selectedNumCount = activeNumBtn ? activeNumBtn.dataset.num : '5';
    
    // 更新筛选状态
    record._specialHistoryFilter.selectedPeriod = selectedPeriod;
    record._specialHistoryFilter.selectedNumCount = selectedNumCount;
    
    console.log('[Record] 📊 精选特码筛选条件已更新:', record._specialHistoryFilter);
    
    // 关闭筛选面板
    const panel = document.getElementById('specialFiltersPanel');
    if (panel) panel.classList.remove('show');
    
    // 重新渲染精选特码历史
    record.renderSpecialHistory();
    
    const periodText = selectedPeriod === 'all' ? '全年' : selectedPeriod + '期';
    Toast.show(`已应用筛选：${periodText} ${selectedNumCount}个`);
  },
  switchSpecialHistoryMode: (mode) => {
    const buttons = document.querySelectorAll('.special-history-mode-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.special-history-mode-btn[data-mode="${mode}"]`)?.classList.add('active');
    
    // ✅ 重新渲染历史记录，根据新模式筛选
    record.renderSpecialHistory();
    
    // 显示提示
    Toast.show(`已切换到${mode === 'hot' ? '🔥 热号' : mode === 'cold' ? '❄️ 冷号' : '全部'}模式`);
  },

  // ---------- 展开/收起操作 ----------
  toggleZodiacPredictionHistory: () => {
    // 加载更多数据
    record.renderZodiacPredictionHistory(true);
  },
  toggleMLPredictionHistory: () => {
    record.renderMLPredictionHistory(true);
  },
  toggleMLPredictionDetailCollapse: () => {
    record._toggleCollapse('mlPredictionDetail', 'mlPredictionDetailList', 'mlPredictionDetailToggle');
  },
  toggleZodiacPredictionDetailCollapse: () => {
    record._toggleCollapse('zodiacPredictionDetail', 'zodiacPredictionDetailList', 'zodiacPredictionDetailToggle');
  },

  // ✅ 折叠/展开切换
  toggleSelectedZodiacCollapse: () => {
    record._toggleCollapse('selectedZodiac', 'selectedZodiacHistoryList', 'selectedZodiacHistoryToggle');
  },
  toggleSelectedZodiacDetailCollapse: () => {
    record._toggleCollapse('selectedZodiacDetail', 'selectedZodiacDetailList', 'selectedZodiacDetailToggle');
  },
  toggleSpecialCollapse: () => {
    record._toggleCollapse('special', 'specialHistoryList', 'specialHistoryToggle');
  },
  toggleSpecialDetailCollapse: () => {
    record._toggleCollapse('specialDetail', 'specialDetailList', 'specialDetailToggle');
  },
  toggleHotNumbersCollapse: () => {
    record._toggleCollapse('hotNumbers', 'hotNumbersHistoryList', 'hotNumbersHistoryToggle');
  },
  toggleHotNumbersDetailCollapse: () => {
    record._toggleCollapse('hotNumbersDetail', 'hotNumbersDetailList', 'hotNumbersDetailToggle');
  },

  // ---------- 兼容 prediction.js 和 data-fetch.js 调用的方法 ----------
  saveZodiacRecord: (recordData) => {
    return Storage.saveZodiacRecord(recordData);
  },
  checkZodiacRecord: (issue, actualZodiac) => {
    const result = Storage.checkZodiacRecord(issue, actualZodiac);
    if (result.success) {
      record.renderZodiacPredictionHistory();
      record.renderSelectedZodiacHistory();
      record.renderPredictionStatistics();
    }
    return result;
  },
  
  /**
   * 手动核对生肖预测记录
   * @param {string} issue - 期号
   * @param {string} actualZodiac - 实际开奖生肖
   */
  manualCheckZodiacRecord: (issue, actualZodiac) => {
    if (!issue || !actualZodiac) {
      Toast.show('请输入期号和开奖生肖');
      return false;
    }
    
    const result = record.checkZodiacRecord(issue, actualZodiac);
    if (result.success) {
      Toast.show(result.matched ? '核对成功：命中！' : '核对成功：未中');
    } else {
      Toast.show(result.message || '核对失败');
    }
    return result;
  },
  
  /**
   * 显示核对对话框
   */
  showCheckDialog: () => {
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: var(--card);
      border-radius: 16px;
      padding: 24px;
      max-width: 90%;
      width: 320px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    `;
    
    content.innerHTML = `
      <h3 style="margin: 0 0 20px 0; font-size: 18px; text-align: center;">核对生肖预测</h3>
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-size: 14px; color: var(--sub-text);">期号：</label>
        <input type="text" id="checkIssueInput" placeholder="例如：2026101" 
               style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; background: var(--bg-secondary); color: var(--text);">
      </div>
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 8px; font-size: 14px; color: var(--sub-text);">开奖生肖：</label>
        <input type="text" id="checkZodiacInput" placeholder="例如：龙" 
               style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; background: var(--bg-secondary); color: var(--text);">
      </div>
      <div style="display: flex; gap: 12px;">
        <button id="cancelCheckBtn" style="flex: 1; padding: 12px; border: none; border-radius: 8px; background: var(--bg-secondary); color: var(--text); font-size: 14px; cursor: pointer;">取消</button>
        <button id="confirmCheckBtn" style="flex: 1; padding: 12px; border: none; border-radius: 8px; background: var(--primary); color: #fff; font-size: 14px; cursor: pointer;">确认</button>
      </div>
    `;
    
    dialog.appendChild(content);
    document.body.appendChild(dialog);
    
    // 绑定事件
    document.getElementById('cancelCheckBtn').addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
    
    document.getElementById('confirmCheckBtn').addEventListener('click', () => {
      const issue = document.getElementById('checkIssueInput').value.trim();
      const zodiac = document.getElementById('checkZodiacInput').value.trim();
      
      if (!issue || !zodiac) {
        Toast.show('请填写完整信息');
        return;
      }
      
      record.manualCheckZodiacRecord(issue, zodiac);
      document.body.removeChild(dialog);
    });
    
    // 点击背景关闭
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        document.body.removeChild(dialog);
      }
    });
  },
  saveNumberRecord: (recordData) => {
    return Storage.saveNumberRecord(recordData);
  },
  checkNumberRecord: (issue, actualNumbers) => {
    const result = Storage.checkNumberRecord(issue, actualNumbers);
    if (result.success) {
      record.renderSpecialHistory();
    }
    return result;
  },
  
  /**
   * ✅ 核对待码热门TOP5记录
   * @param {string} issue - 期号
   * @param {Array} actualNumbers - 实际开奖号码
   */
  checkHotNumbersRecord: (issue, actualNumbers) => {
    const result = Storage.checkHotNumbersRecord(issue, actualNumbers);
    if (result.success) {
      record.renderHotNumbersHistory();
    }
    return result;
  },
  loadZodiacRecords: () => {
    record.renderZodiacPredictionHistory();
    record.renderSelectedZodiacHistory();
    record.renderPredictionStatistics();
  },

  // 显示精选生肖历史页面（点击精选生肖卡片时调用）
  showSelectedZodiacHistory: () => {
    // 滚动到精选生肖历史区域
    const selectedHistorySection = document.getElementById('selectedZodiacHistorySection');
    if (selectedHistorySection) {
      selectedHistorySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // 如果历史列表为空，先刷新数据
      const historyList = document.getElementById('selectedZodiacHistoryList');
      if (historyList && historyList.querySelector('.empty-tip')) {
        record.renderSelectedZodiacHistory();
      }
    }
  },

  // 显示生肖预测历史页面（点击生肖预测卡片时调用）
  showZodiacPredictionHistory: () => {
    // 滚动到生肖预测历史区域
    const zodiacHistorySection = document.querySelector('.card:has(#zodiacPredictionHistoryList)');
    if (zodiacHistorySection) {
      zodiacHistorySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // 如果历史列表为空，先刷新数据
      const historyList = document.getElementById('zodiacPredictionHistoryList');
      if (historyList && historyList.querySelector('.empty-tip')) {
        record.renderZodiacPredictionHistory();
      }
    }
  },

  // 显示详细统计弹窗
  showDetailedStatistics: (type) => {
    try {
      // 创建弹窗容器
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      
      // 创建弹窗内容
      const content = document.createElement('div');
      content.className = 'modal-content';
      
      // 初始内容
      const initialContent = `
        <div class="modal-header">
          <h3 class="modal-title">${type === 'zodiac' ? '生肖预测' : '精选生肖'}详细统计</h3>
          <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom:20px;">
            <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--text);">选择统计周期</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn-mini period-btn active" data-period="10">10期</button>
              <button class="btn-mini period-btn" data-period="20">20期</button>
              <button class="btn-mini period-btn" data-period="30">30期</button>
              <button class="btn-mini period-btn" data-period="all">全年</button>
            </div>
          </div>
          <div id="statisticsContent" style="min-height:280px;padding-bottom:20px;">
            <div style="display:flex;justify-content:center;align-items:center;padding:40px;">
              <div style="text-align:center;">
                <div style="font-size:48px;margin-bottom:12px;">📊</div>
                <div style="font-size:16px;color:var(--sub-text);">请选择统计周期</div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      content.innerHTML = initialContent;
      modal.appendChild(content);
      document.body.appendChild(modal);
      
      // 触发动画
      setTimeout(() => {
        modal.style.opacity = '1';
        content.style.transform = 'scale(1)';
      }, 10);
      
      // ✅ 默认加载10期统计数据
      setTimeout(() => {
        record.loadPeriodStatistics(type, '10', content.querySelector('#statisticsContent'));
      }, 100);
      
      // 绑定周期按钮点击事件
      const periodBtns = content.querySelectorAll('.period-btn');
      periodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          // 更新按钮状态
          periodBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          
          // 获取选中的周期
          const period = btn.dataset.period;
          
          // 加载对应周期的统计数据
          record.loadPeriodStatistics(type, period, content.querySelector('#statisticsContent'));
        });
      });
      
      // 点击模态框外部关闭
      modal.addEventListener('click', (e) => {
        if(e.target === modal) {
          modal.style.opacity = '0';
          content.style.transform = 'scale(0.9)';
          setTimeout(() => {
            modal.remove();
          }, 300);
        }
      });
    } catch (e) {
      console.error('显示详细统计失败', e);
      Toast.show('显示详情失败');
    }
  },
  
  // 加载指定周期的统计数据
  loadPeriodStatistics: (type, period, container) => {
    try {
      container.innerHTML = `
        <div style="display:flex;justify-content:center;align-items:center;padding:40px;">
          <div style="text-align:center;">
            <div style="font-size:24px;margin-bottom:12px;">加载中...</div>
            <div style="font-size:14px;color:var(--sub-text);">正在分析数据</div>
          </div>
        </div>
      `;
      
      // 延迟一下，让加载动画显示
      setTimeout(() => {
        // ✅ 获取真实数据
        const allRecords = Storage.get('zodiacRecords', []);
        
        // 根据类型筛选记录
        let records = type === 'selected' 
          ? allRecords.filter(r => r.recordType === 'selected')
          : allRecords.filter(r => !r.recordType || r.recordType !== 'selected');
        
        // 根据周期筛选
        if (period !== 'all') {
          const periodNum = parseInt(period);
          // 只取已核对的记录，按 createdAt 排序，取最近的 N 期
          const checkedRecords = records.filter(r => r.checked === true)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, periodNum);
          records = checkedRecords;
        } else {
          // 全年：只取已核对的记录
          records = records.filter(r => r.checked === true);
        }
        
        // 统计数据
        let hit = 0, miss = 0;
        records.forEach(rec => {
          if (rec.matched === true) hit++;
          else if (rec.matched === false) miss++;
        });
        
        const total = records.length;
        const hitRate = hit + miss > 0 ? ((hit / (hit + miss)) * 100).toFixed(1) : '0.0';
        
        console.log(`[Statistics] ${type} - ${period}期:`, { total, hit, miss, hitRate });
        
        // 渲染统计数据
        container.innerHTML = `
          <div style="margin-bottom:20px;padding:16px;background:linear-gradient(135deg, var(--primary) 0%, #0051d5 100%);border-radius:12px;color:white;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:14px;font-weight:600;">周期统计概览</span>
              <span style="font-size:14px;">${period === 'all' ? '全年' : period + '期'}</span>
            </div>
          </div>
          
          <div style="margin-bottom:20px;">
            <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--text);">关键指标</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(120px, 1fr));gap:12px;">
              <div style="background:var(--card);border-radius:8px;padding:12px;border:1px solid var(--border);">
                <div style="font-size:12px;color:var(--sub-text);margin-bottom:4px;">总记录</div>
                <div style="font-size:18px;font-weight:600;color:var(--text);">${total}</div>
              </div>
              <div style="background:var(--card);border-radius:8px;padding:12px;border:1px solid var(--border);">
                <div style="font-size:12px;color:var(--sub-text);margin-bottom:4px;">命中</div>
                <div style="font-size:18px;font-weight:600;color:var(--green);">${hit}</div>
              </div>
              <div style="background:var(--card);border-radius:8px;padding:12px;border:1px solid var(--border);">
                <div style="font-size:12px;color:var(--sub-text);margin-bottom:4px;">未中</div>
                <div style="font-size:18px;font-weight:600;color:var(--danger);">${miss}</div>
              </div>
              <div style="background:var(--card);border-radius:8px;padding:12px;border:1px solid var(--border);">
                <div style="font-size:12px;color:var(--sub-text);margin-bottom:4px;">命中率</div>
                <div style="font-size:18px;font-weight:600;color:var(--primary);">${hitRate}%</div>
              </div>
            </div>
          </div>
          
          <div style="margin-bottom:20px;">
            <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--text);">趋势分析</div>
            <div style="background:var(--card);border-radius:8px;padding:16px;border:1px solid var(--border);">
              <div style="display:flex;justify-content:center;align-items:center;padding:20px;">
                <div style="text-align:center;">
                  <div style="font-size:32px;margin-bottom:12px;">📈</div>
                  <div style="font-size:14px;color:var(--sub-text);">${period === 'all' ? '全年' : period + '期'}趋势图表</div>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--text);">详细数据</div>
            <div style="background:var(--card);border-radius:8px;padding:16px;border:1px solid var(--border);">
              <div style="font-size:13px;color:var(--sub-text);text-align:center;padding:20px;">
                ${total > 0 ? `共 ${total} 条记录，命中 ${hit} 次，未中 ${miss} 次` : '暂无数据'}
              </div>
            </div>
          </div>
        `;
      }, 300);
    } catch (e) {
      console.error('加载统计数据失败', e);
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger);">加载失败，请重试</div>';
    }
  },

  // ---------- 事件绑定 ----------
  bindEvents: () => {
    // 防止重复绑定事件
    if (record._eventsBound) {
      console.log('[Record] 事件已绑定，跳过重复绑定');
      return;
    }
    record._eventsBound = true;
    
    // 点击事件处理（委托）
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const index = btn.dataset.index !== undefined ? parseInt(btn.dataset.index) : null;
      const mode = btn.dataset.mode;
      
      // 收藏相关
      if (action === 'loadFavorite' && index !== null) record.loadFavorite(index);
      if (action === 'renameFavorite' && index !== null) record.renameFavorite(index);
      if (action === 'copyFavorite' && index !== null) record.copyFavorite(index);
      if (action === 'removeFavorite' && index !== null) record.removeFavorite(index);
      if (action === 'clearAllFavorites') record.clearAllFavorites();
      
      // 统计相关
      if (action === 'refreshPredictionStatistics') record.refreshPredictionStatistics();
      
      // 精选生肖相关
      if (action === 'clearSelectedZodiacHistory') record.clearSelectedZodiacHistory();
      if (action === 'toggleSelectedZodiacDetailCollapse') record.toggleSelectedZodiacDetailCollapse();

      // 生肖预测历史相关
      if (action === 'clearZodiacPredictionHistory') record.clearZodiacPredictionHistory();
      if (action === 'togglePredictionFiltersPanel') record.togglePredictionFiltersPanel();
      if (action === 'selectAllPredictionPeriods') record.selectAllPredictionPeriods();
      if (action === 'resetPredictionPeriods') record.resetPredictionPeriods();
      if (action === 'confirmPredictionFilters') record.confirmPredictionFilters();
      if (action === 'toggleZodiacPredictionHistory') record.toggleZodiacPredictionHistory();
      
      // ML预测历史相关
      if (action === 'refreshMLPredictionHistory') record.refreshMLPredictionHistory();
      if (action === 'clearMLPredictionHistory') record.clearMLPredictionHistory();
      if (action === 'toggleMLPredictionHistory') record.toggleMLPredictionHistory();
      if (action === 'toggleMLPredictionDetailCollapse') record.toggleMLPredictionDetailCollapse();
      if (action === 'toggleZodiacPredictionDetailCollapse') record.toggleZodiacPredictionDetailCollapse();

      // 详细统计弹窗
      if (action === 'showDetailedStatistics') {
        const type = btn.dataset.type;
        record.showDetailedStatistics(type);
      }
      
      // ✅ 滚动到精选生肖历史
      if (action === 'scrollToSelectedHistory') {
        const selectedHistorySection = document.getElementById('selectedZodiacHistorySection');
        if (selectedHistorySection) {
          selectedHistorySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
      
      // 精选特码历史相关
      if (action === 'clearSpecialHistory') record.clearSpecialHistory();
      if (action === 'toggleSpecialFiltersPanel') record.toggleSpecialFiltersPanel();
      if (action === 'confirmSpecialFilters') record.confirmSpecialFilters();
      if (action === 'switchSpecialHistoryMode' && mode) record.switchSpecialHistoryMode(mode);
      
      // 特码热门TOP5历史相关
      if (action === 'clearHotNumbersHistory') record.clearHotNumbersHistory();
      
      // ✅ 折叠/展开切换
      if (action === 'toggleSelectedZodiacCollapse') record.toggleSelectedZodiacCollapse();
      if (action === 'toggleSpecialCollapse') record.toggleSpecialCollapse();
      if (action === 'toggleSpecialDetailCollapse') record.toggleSpecialDetailCollapse();
      if (action === 'toggleHotNumbersCollapse') record.toggleHotNumbersCollapse();
      if (action === 'toggleHotNumbersDetailCollapse') record.toggleHotNumbersDetailCollapse();
    });
    
    // 期数按钮点击事件（单选模式）- 使用事件委托，避免与上面的冲突
    document.addEventListener('click', (e) => {
      const periodBtn = e.target.closest('.prediction-period-btn');
      if (!periodBtn) return;
      
      // 如果按钮有 data-action，由上面的处理器处理
      if (periodBtn.dataset.action) return;
      
      const period = periodBtn.dataset.period;
      if (!period) return;
      
      // 移除所有按钮的active类（实现单选）
      document.querySelectorAll('.prediction-period-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      
      // 给当前点击的按钮添加active类
      periodBtn.classList.add('active');
      
      // 更新筛选状态为单选
      record._zodiacPredictionFilter.selectedPeriods = [period];
      
      console.log('[Filter] 期数按钮点击，当前筛选:', record._zodiacPredictionFilter.selectedPeriods);
      
      // 立即重新渲染
      record.renderZodiacPredictionHistory();
    });
    
    // ✅ 精选特码历史筛选按钮点击事件（期数 - 单选，立即筛选并自动保存）
    document.addEventListener('click', (e) => {
      const periodBtn = e.target.closest('.special-period-btn');
      if (!periodBtn) return;
      
      // 如果按钮有 data-action，由上面的处理器处理
      if (periodBtn.dataset.action) return;
      
      const period = periodBtn.dataset.period;
      if (!period) return;
      
      // 移除所有期数按钮的active类（实现单选）
      document.querySelectorAll('.special-period-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      
      // 给当前点击的按钮添加active类
      periodBtn.classList.add('active');
      
      // 获取当前选中的数量
      const activeNumBtn = document.querySelector('.special-num-btn.active');
      const numCount = activeNumBtn ? activeNumBtn.dataset.num : '5';
      
      // 更新筛选状态
      record._specialHistoryFilter.selectedPeriod = period;
      
      // ✅ 自动保存到localStorage
      Storage.saveSpecialFilters({ period, numCount });
      
      // ✅ 立即执行筛选和渲染
      record.renderSpecialHistory();
      
      console.log('[Record] 📊 精选特码期数选择并保存:', period, '数量:', numCount);
    });
    
    // ✅ 精选特码历史筛选按钮点击事件（数量 - 单选，立即筛选并自动保存）
    document.addEventListener('click', (e) => {
      const numBtn = e.target.closest('.special-num-btn');
      if (!numBtn) return;
      
      // 如果按钮有 data-action，由上面的处理器处理
      if (numBtn.dataset.action) return;
      
      const numCount = numBtn.dataset.num;
      if (!numCount) return;
      
      // 移除所有数量按钮的active类（实现单选）
      document.querySelectorAll('.special-num-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      
      // 给当前点击的按钮添加active类
      numBtn.classList.add('active');
      
      // 获取当前选中的期数
      const activePeriodBtn = document.querySelector('.special-period-btn.active');
      const period = activePeriodBtn ? activePeriodBtn.dataset.period : '10';
      
      // 更新筛选状态
      record._specialHistoryFilter.selectedNumCount = numCount;
      
      // ✅ 自动保存到localStorage
      Storage.saveSpecialFilters({ period, numCount });
      
      // ✅ 立即执行筛选和渲染
      record.renderSpecialHistory();
      
      console.log('[Record] 📊 精选特码数量选择并保存:', numCount, '期数:', period);
    });
    
    // localStorage变化监听，确保数据实时同步
    window.addEventListener('storage', (event) => {
      if (!event.key) return;
      
      // 根据变化的key重新渲染对应的历史记录
      switch (event.key) {
        case 'favorites':
          record.renderFavoriteList();
          break;
        case 'zodiacRecords':
          record.renderSelectedZodiacHistory();
          record.renderZodiacPredictionHistory();
          record.renderPredictionStatistics();
          break;
        case 'mlPredictionRecords':
          record.renderMLPredictionHistory();
          break;
        case 'numberRecords':
          record.renderSpecialHistory();
          break;
        case 'hotNumbersRecords':
          record.renderHotNumbersHistory();
          break;
      }
    });
    
    // 监听生肖预测保存事件（同一页面内的数据更新）
    window.addEventListener('zodiacPredictionSaved', (event) => {
      console.log('[Record] 收到生肖预测保存事件，刷新历史记录');
      // 延迟一下再刷新，确保数据已完全保存
      setTimeout(() => {
        record.renderZodiacPredictionHistory();
        record.renderPredictionStatistics();
      }, 100);
    });
    
    // 监听页面可见性变化，当用户切换回记录页面时刷新数据
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('[Record] 👁️ 页面变为可见，自动刷新所有数据...');
        
        // ✅ 先快速渲染本地数据（不阻塞UI）
        record.renderAll();
        
        // ✅ 然后在后台自动获取最新数据并核对（第一时间更新）
        record.autoFetchAndCheck().catch(error => {
          console.error('[Record] 可见性变化时自动刷新失败:', error);
        });
      }
    });
    
    console.log('[Record] 事件绑定完成');
  },

  /**
   * 绑定滑动删除事件到历史记录项
   * 使用事件委托优化性能，避免为每个元素单独绑定
   * @param {HTMLElement} item - 历史记录项元素
   * @param {number} idx - 索引
   * @param {string} type - 类型（selectedZodiac/zodiacPrediction/mlPrediction/special/hotNumbers）
   * @param {Function} deleteCallback - 删除回调函数
   */
  _bindSwipeDeleteToItem: (item, idx, type, deleteCallback) => {
    if (!item || typeof deleteCallback !== 'function') {
      console.warn('[Record] 无效的滑动删除参数');
      return;
    }
    
    const handler = Utils.SwipeDeleteHandler;
    
    // 使用 passive 选项优化触摸性能
    const touchStartHandler = (e) => handler.handleTouchStart(e, idx, type);
    const touchMoveHandler = (e) => handler.handleTouchMove(e, idx, type);
    const touchEndHandler = (e) => handler.handleTouchEnd(e, idx, type, deleteCallback);
    
    item.addEventListener('touchstart', touchStartHandler, { passive: true });
    item.addEventListener('touchmove', touchMoveHandler, { passive: false });
    item.addEventListener('touchend', touchEndHandler, { passive: true });
    
    // 存储处理器引用，便于后续清理（防止内存泄漏）
    record._swipeHandlers.set(item, {
      touchStartHandler,
      touchMoveHandler,
      touchEndHandler
    });
  },
  
  /**
   * 清理滑动删除事件绑定（防止内存泄漏）
   * @param {HTMLElement} item - 要清理的元素
   */
  _unbindSwipeDelete: (item) => {
    if (!item) return;
    
    const handlers = record._swipeHandlers.get(item);
    if (handlers) {
      item.removeEventListener('touchstart', handlers.touchStartHandler);
      item.removeEventListener('touchmove', handlers.touchMoveHandler);
      item.removeEventListener('touchend', handlers.touchEndHandler);
      record._swipeHandlers.delete(item);
    }
  },

  /**
   * 删除精选生肖记录
   * @param {number} index - 记录索引
   */
  _deleteSelectedZodiacRecord: (index) => {
    try {
      if (typeof index !== 'number' || index < 0) {
        console.warn('[Record] 无效的索引:', index);
        return;
      }
      
      const allRecords = Storage.get('zodiacRecords', []);
      if (!Array.isArray(allRecords)) {
        console.error('[Record] 数据格式错误');
        Toast.show('数据异常，请刷新页面');
        return;
      }
      
      const selectedRecords = allRecords.filter(r => r.recordType === 'selected');
      
      if (!selectedRecords[index]) {
        console.warn('[Record] 记录不存在:', index);
        return;
      }
      
      // 从总记录中移除
      const recordToRemove = selectedRecords[index];
      const filtered = allRecords.filter(r => !(r.recordType === 'selected' && r.createdAt === recordToRemove.createdAt));
      
      Storage.set('zodiacRecords', filtered);
      StateManager.setState({ analysis: { ...StateManager._state.analysis, zodiacRecords: filtered } }, false);
      
      // 重新渲染
      record.renderSelectedZodiacHistory();
      record.renderPredictionStatistics();
      
      Toast.show('已删除记录');
    } catch (error) {
      console.error('[Record] 删除精选生肖记录失败:', error);
      Toast.show('删除失败，请重试');
    }
  },

  /**
   * 删除生肖预测记录
   * @param {string} issue - 期号
   */
  _deleteZodiacPredictionRecord: (issue) => {
    try {
      if (!issue || typeof issue !== 'string') {
        console.warn('[Record] 无效的期号:', issue);
        return;
      }
      
      const allRecords = Storage.get('zodiacRecords', []);
      if (!Array.isArray(allRecords)) {
        console.error('[Record] 数据格式错误');
        Toast.show('数据异常，请刷新页面');
        return;
      }
      
      const filtered = allRecords.filter(r => !(r.issue === issue && (!r.recordType || r.recordType !== 'selected')));
      
      if (filtered.length === allRecords.length) {
        console.warn('[Record] 未找到要删除的记录:', issue);
        return;
      }
      
      Storage.set('zodiacRecords', filtered);
      StateManager.setState({ analysis: { ...StateManager._state.analysis, zodiacRecords: filtered } }, false);
      
      // 重新渲染
      record.renderZodiacPredictionHistory();
      record.renderPredictionStatistics();
      
      Toast.show('已删除记录');
    } catch (error) {
      console.error('[Record] 删除生肖预测记录失败:', error);
      Toast.show('删除失败，请重试');
    }
  },

  /**
   * 删除 ML 预测记录
   * @param {Object} recordData - 记录对象
   */
  _deleteMLPredictionRecord: (recordData) => {
    try {
      if (!recordData || !recordData.issue) {
        console.warn('[Record] 无效的记录:', recordData);
        return;
      }
        
      const mlRecords = Storage.get('mlPredictionRecords', []);
      if (!Array.isArray(mlRecords)) {
        console.error('[Record] 数据格式错误');
        Toast.show('数据异常，请刷新页面');
        return;
      }
        
      const originalLength = mlRecords.length;
      const filtered = mlRecords.filter(r => r.issue !== recordData.issue);
        
      if (filtered.length === originalLength) {
        console.warn('[Record] 未找到要删除的记录:', recordData);
        return;
      }
        
      Storage.set('mlPredictionRecords', filtered);
        
      // 重新渲染
      record.renderMLPredictionHistory();
        
      Toast.show('已删除记录');
    } catch (error) {
      console.error('[Record] 删除ML预测记录失败:', error);
      Toast.show('删除失败，请重试');
    }
  },

  /**
   * 删除精选特码记录
   * @param {string} issue - 期号
   */
  _deleteSpecialRecord: (record) => {
    try {
      if (!record || !record.issue) {
        console.warn('[Record] 无效的记录:', record);
        return;
      }
      
      const numberRecords = Storage.get('numberRecords', []);
      if (!Array.isArray(numberRecords)) {
        console.error('[Record] 数据格式错误');
        Toast.show('数据异常，请刷新页面');
        return;
      }
      
      const originalLength = numberRecords.length;
      
      // ✅ 使用复合键删除：期号 + 期数范围 + 号码数量
      const filtered = numberRecords.filter(r => {
        // 如果记录有 period 和 numCount，使用复合键匹配
        if (record.period && record.numCount) {
          return !(r.issue === record.issue && r.period === record.period && r.numCount === record.numCount);
        }
        // 否则只按期号匹配（兼容旧数据）
        return r.issue !== record.issue;
      });
      
      if (filtered.length === originalLength) {
        console.warn('[Record] 未找到要删除的记录:', record);
        return;
      }
      
      Storage.set('numberRecords', filtered);
      
      // 重新渲染
      record.renderSpecialHistory();
      
      Toast.show('已删除记录');
    } catch (error) {
      console.error('[Record] 删除精选特码记录失败:', error);
      Toast.show('删除失败，请重试');
    }
  },

  /**
   * 删除特码热门TOP5记录
   * @param {string} issue - 期号
   */
  _deleteHotNumbersRecord: (issue) => {
    try {
      if (!issue || typeof issue !== 'string') {
        console.warn('[Record] 无效的期号:', issue);
        return;
      }
      
      const hotRecords = Storage.get('hotNumbersRecords', []);
      if (!Array.isArray(hotRecords)) {
        console.error('[Record] 数据格式错误');
        Toast.show('数据异常，请刷新页面');
        return;
      }
      
      const originalLength = hotRecords.length;
      const filtered = hotRecords.filter(r => r.issue !== issue);
      
      if (filtered.length === originalLength) {
        console.warn('[Record] 未找到要删除的记录:', issue);
        return;
      }
      
      Storage.set('hotNumbersRecords', filtered);
      
      // 重新渲染
      record.renderHotNumbersHistory();
      
      Toast.show('已删除记录');
    } catch (error) {
      console.error('[Record] 删除特码热门TOP5记录失败:', error);
      Toast.show('删除失败，请重试');
    }
  }
};

