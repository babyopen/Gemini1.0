// ====================== 分析渲染模块 ======================

import { CONFIG } from '../../../config.js';
import { StateManager } from '../../../state-manager.js';
import { analysisCalc } from './analysis-calc.js';
import { PerformanceMonitor } from '../../../performance-monitor.js';
import { Toast } from '../../../toast.js';
import { DataQuery } from '../../../data-query.js';
import { IssueManager } from '../../issue-manager.js';
import { Utils } from '../../../utils.js';
import { Storage } from '../../../storage.js';

/**
 * 分析渲染模块
 * 负责分析页面的各种数据渲染和交互功能
 */
export const analysisRender = {
  /**
   * 渲染最新开奖
   * @param {Object} item - 最新数据项
   */
  renderLatest: (item) => {
    try {
      if(!item) return;
      const codeArr = (item.openCode || '0,0,0,0,0,0,0').split(',');
      const s = analysisCalc.getSpecial(item);
      const zodArr = s?.fullZodArr || [];
      
      let html = '';
      for(let i = 0; i < 6; i++) {
        const num = Number(codeArr[i]);
        html += analysisCalc.buildBall(codeArr[i], analysisCalc.getColor(num), zodArr[i] || '');
      }
      html += '<div class="ball-sep">+</div>' + analysisCalc.buildBall(codeArr[6], s?.wave || 'red', zodArr[6] || '');
      
      const latestBalls = document.getElementById('latestBalls');
      const curExpect = document.getElementById('curExpect');
      if(latestBalls) latestBalls.innerHTML = html;
      if(curExpect) curExpect.innerText = item.expect || '--';
    } catch(e) {
      console.error('渲染最新开奖失败:', e);
    }
  },

  /**
   * 更新热门结论部分DOM元素
   * @param {Object} data - 分析数据
   * @param {Map} fullNumZodiacMap - 号码-生肖映射
   */
  updateHotConclusion: (data, fullNumZodiacMap) => {
    // 构建热门特码的球号显示（使用多维度筛选算法）
    const buildHotNumberBalls = (hotNumStr) => {
      // 使用多维度筛选算法获取热门号码
      let hotNums = analysisCalc.getHotNumbers(data, 5, fullNumZodiacMap);
      
      // 按数字大小排序
      hotNums.sort((a, b) => a - b);
      
      let ballHtml = '<div class="ball-group">';
      hotNums.forEach(num => {
        const color = analysisCalc.getColor(num);
        const zodiac = DataQuery._getZodiacByNum(num);
        const element = analysisCalc.getWuxing(num);
        const numStr = String(num).padStart(2, '0');
        const zodiacText = element ? `${zodiac}/${element}` : zodiac;
        ballHtml += `
          <div class="ball-item">
            <div class="ball ${color}">${numStr}</div>
            <div class="ball-zodiac">${zodiacText}</div>
          </div>
        `;
      });
      ballHtml += '</div>';
      return ballHtml;
    };

    // 热门结论相关DOM元素
    const hotConclusionElements = {
      'hotShape': `${data.hotSD[0]} / ${data.hotBS[0]}`,
      'hotZodiac': data.hotZod,
      'hotHeadTail': `${data.hotHead[0]}头 / ${data.hotTail[0]}尾`,
      'hotColorWx': `${data.hotColor[0]} / ${data.hotWx[0]}`,
      'hotMiss': `热:${data.miss.hot} 温:${data.miss.warm} 冷:${data.miss.cold} | 最大遗漏:${data.miss.maxMiss}期`,
      'hotShape2': analysisRender.getTopHot(Object.entries(data.singleDouble).concat(Object.entries(data.bigSmall))),
      'hotRange2': analysisRender.getTopHot(Object.entries(data.range)),
      'hotHead2': analysisRender.getTopHot(Object.entries(data.head)),
      'hotTail2': analysisRender.getTopHot(Object.entries(data.tail)),
      'hotColor2': analysisRender.getTopHot(Object.entries(data.color)),
      'hotWuxing2': analysisRender.getTopHot(Object.entries(data.wuxing)),
      'hotAnimal': analysisRender.getTopHot(Object.entries(data.animal)),
      'hotZodiac2': Object.entries(data.zodiac).sort((a, b) => b[1] - a[1]).slice(0, 5).map(i => `${i[0]}(${i[1]})`).join(' '),
      'missCur': data.miss.curMaxMiss,
      'missAvg': data.miss.avgMiss,
      'missMax': data.miss.maxMiss,
      'missHot': data.miss.hot,
      'missWarm': data.miss.warm,
      'missCold': data.miss.cold,
      'hotColdTip': `热:${data.miss.hot} 温:${data.miss.warm} 冷:${data.miss.cold}`,
      'streakCur': data.streak.curStreak,
      'streakMax': data.streak.maxStreak,
      'streakTip': `当前:${data.streak.curStreak}期 最长:${data.streak.maxStreak}期`
    };

    // 使用工具函数批量更新DOM元素
    Utils.updateElements(hotConclusionElements);

    // 特殊处理热门特码的显示
    const hotNumberEl = document.getElementById('hotNumber');
    if(hotNumberEl) {
      hotNumberEl.innerHTML = buildHotNumberBalls(data.hotNum);
      hotNumberEl.style.color = 'inherit';
    }
    
    // ✅ 自动保存特码热门TOP5记录
    analysisRender.autoSaveHotNumbersRecord(data, fullNumZodiacMap);
  },

  /**
   * ✅ 自动保存特码热门TOP5记录（使用下一期期号）
   * @param {Object} data - 分析数据
   * @param {Map} fullNumZodiacMap - 号码-生肖映射
   */
  autoSaveHotNumbersRecord: (data, fullNumZodiacMap) => {
    try {
      // ✅ 获取下一期期号（预测数据必须使用下一期）
      const nextIssueObj = IssueManager.getNextIssue();
      if (!nextIssueObj || !nextIssueObj.full) {
        console.warn('未找到下一期期号，跳过特码热门TOP5自动保存');
        return;
      }
      const issue = nextIssueObj.full;

      // 使用多维度筛选算法获取热门号码
      let hotNums = analysisCalc.getHotNumbers(data, 5, fullNumZodiacMap);
      
      // 按数字大小排序
      hotNums.sort((a, b) => a - b);
      
      // 转换为字符串格式
      const numbersStr = hotNums.map(n => String(n).padStart(2, '0'));

      // 构建记录对象
      const recordData = {
        issue: issue,
        numbers: numbersStr
      };

      // 异步导入storage模块并保存
      import('../../../storage.js').then(({ Storage }) => {
        const success = Storage.saveHotNumbersRecord(recordData);
        if (success) {
          console.log('✅ 特码热门TOP5记录已自动保存', { issue: `${issue}(下一期)`, count: numbersStr.length });
        } else {
          console.error('❌ 特码热门TOP5记录自动保存失败');
        }
      }).catch(err => {
        console.error('导入storage模块失败:', err);
      });
    } catch (error) {
      console.error('自动保存特码热门TOP5记录失败:', error);
    }
  },

  /**
   * 更新统计网格部分DOM元素
   * @param {Object} data - 分析数据
   */
  updateStatsGrid: (data) => {
    // 统计网格相关DOM元素
    const statsGridElements = {
      'odd': data.singleDouble['单'],
      'even': data.singleDouble['双'],
      'big': data.bigSmall['大'],
      'small': data.bigSmall['小'],
      'r1': data.range['1-9'],
      'r2': data.range['10-19'],
      'r3': data.range['20-29'],
      'r4': data.range['30-39'],
      'r5': data.range['40-49'],
      'h0': data.head[0],
      'h1': data.head[1],
      'h2': data.head[2],
      'h3': data.head[3],
      'h4': data.head[4],
      'cRed': data.color['红'],
      'cBlue': data.color['蓝'],
      'cGreen': data.color['绿'],
      'wJin': data.wuxing['金'],
      'wMu': data.wuxing['木'],
      'wShui': data.wuxing['水'],
      'wHuo': data.wuxing['火'],
      'wTu': data.wuxing['土'],
      'aniHome': data.animal['家禽'],
      'aniWild': data.animal['野兽']
    };

    // 使用工具函数批量更新DOM元素
    Utils.updateElements(statsGridElements);

    // 尾数行渲染
    const tailRow = document.getElementById('tailRow');
    if(tailRow) {
      let tailHtml = '';
      for(let t = 0; t <= 9; t++) {
        tailHtml += `<div class="analysis-item" data-action="showStatDetail" data-stat-type="tail${t}" style="cursor:pointer;"><div class="label">尾${t}</div><div class="value">${data.tail[t]}</div></div>`;
      }
      tailRow.innerHTML = tailHtml;
    }
  },

  /**
   * 渲染排行榜部分
   * @param {Object} data - 分析数据
   * @description 渲染各种维度的排行榜，包括单双、大小、区间、头数、尾数、颜色、五行、动物、生肖等
   */
  renderRankings: (data) => {
    // 完整排行渲染
    analysisRender.renderFullRank('singleDoubleRank', data.singleDouble, data.total); // 单双排行
    analysisRender.renderFullRank('bigSmallRank', data.bigSmall, data.total); // 大小排行
    analysisRender.renderFullRank('rangeRank', data.range, data.total); // 区间排行
    analysisRender.renderFullRank('headRank', data.head, data.total); // 头数排行
    analysisRender.renderFullRank('tailRank', data.tail, data.total); // 尾数排行
    analysisRender.renderFullRank('colorRank', data.color, data.total); // 颜色排行
    analysisRender.renderFullRank('wuxingRank', data.wuxing, data.total); // 五行排行
    analysisRender.renderFullRank('animalRank', data.animal, data.total); // 动物排行
    analysisRender.renderFullRank('zodiacRank', data.zodiac, data.total); // 生肖排行
  },

  /**
   * 虚拟列表组件
   */
  VirtualList: {
    baseItemHeight: 72,
    buffer: 5,
    maxItemsForSimpleRender: 50,
    
    getItemHeight: function() {
      const width = window.innerWidth;
      if (width <= 320) return 58;
      if (width <= 375) return 64;
      if (width <= 414) return 70;
      if (width <= 480) return 76;
      if (width <= 768) return 82;
      if (width <= 1024) return 88;
      if (width <= 1200) return 94;
      return 105;
    },
    
    getVisibleCount: function() {
      const width = window.innerWidth;
      const baseOffset = width <= 480 ? 200 : 250;
      const itemHeight = this.getItemHeight();
      return Math.max(5, Math.floor((window.innerHeight - baseOffset) / itemHeight));
    },
    
    getBallSize: function() {
      const width = window.innerWidth;
      if (width <= 320) return { ball: 24, font: 9, gap: 3 };
      if (width <= 375) return { ball: 26, font: 10, gap: 3 };
      if (width <= 414) return { ball: 28, font: 11, gap: 4 };
      if (width <= 480) return { ball: 30, font: 12, gap: 4 };
      if (width <= 768) return { ball: 32, font: 13, gap: 5 };
      if (width <= 1024) return { ball: 34, font: 14, gap: 5 };
      if (width <= 1200) return { ball: 36, font: 15, gap: 6 };
      return { ball: 42, font: 17, gap: 8 };
    },
    
    /**
     * 渲染虚拟列表
     * @param {Array} data - 完整数据
     * @param {HTMLElement} container - 容器元素
     */
    render: (data, container) => {
      if(!container) return;
      
      if(!data || data.length === 0) {
        container.innerHTML = '<div style="padding:20px;text-align:center;">暂无历史数据</div>';
        return;
      }
      
      if(data.length <= analysisRender.VirtualList.maxItemsForSimpleRender) {
        container.innerHTML = '';
        const fragment = document.createDocumentFragment();
        data.forEach((item) => {
          try {
            const escapedOpenCode = Utils.escapeHtml(item.openCode || '0,0,0,0,0,0,0');
            const codeArr = escapedOpenCode.split(',');
            const s = analysisCalc.getSpecial(item);
            const zodArr = s?.fullZodArr || [];
            let balls = '';
            for(let i = 0; i < 6; i++) {
              const num = Number(codeArr[i]);
              balls += analysisCalc.buildBall(codeArr[i], analysisCalc.getColor(num), zodArr[i] || '');
            }
            const teNum = Number(codeArr[6]);
            balls += '<div class="ball-sep">+</div>' + analysisCalc.buildBall(codeArr[6], analysisCalc.getColor(teNum), zodArr[6] || '');
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'history-item';
            itemDiv.innerHTML = `
              <div class="history-expect">第${Utils.escapeHtml(item.expect || '')}期</div>
              <div class="ball-group">${balls}</div>
            `;
            fragment.appendChild(itemDiv);
          } catch(e) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'history-item';
            itemDiv.innerHTML = `<div class="history-expect">数据错误</div><div class="ball-group">数据加载失败</div>`;
            fragment.appendChild(itemDiv);
          }
        });
        container.appendChild(fragment);
        return;
      }
      
      const itemHeight = analysisRender.VirtualList.getItemHeight();
      const visibleCount = analysisRender.VirtualList.getVisibleCount();
      const totalHeight = data.length * itemHeight;
      
      container.innerHTML = `
        <div class="virtual-list-container" style="position: relative; overflow-y: auto; height: ${visibleCount * itemHeight}px;">
          <div class="virtual-list-placeholder" style="height: ${totalHeight}px; position: relative;"></div>
          <div class="virtual-list-content" style="position: absolute; top: 0; left: 0; right: 0;"></div>
        </div>
      `;
      
      const scrollContainer = container.querySelector('.virtual-list-container');
      const contentContainer = container.querySelector('.virtual-list-content');
      
      analysisRender.VirtualList.update(contentContainer, data, 0);
      
      scrollContainer.addEventListener('scroll', () => {
        const scrollTop = scrollContainer.scrollTop;
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - analysisRender.VirtualList.buffer);
        analysisRender.VirtualList.update(contentContainer, data, startIndex);
      });
    },
    
    /**
     * 更新虚拟列表内容
     * @param {HTMLElement} container - 内容容器
     * @param {Array} data - 完整数据
     * @param {number} startIndex - 起始索引
     */
    update: (container, data, startIndex) => {
      const itemHeight = analysisRender.VirtualList.getItemHeight();
      const visibleCount = analysisRender.VirtualList.getVisibleCount();
      const endIndex = Math.min(data.length, startIndex + visibleCount + analysisRender.VirtualList.buffer * 2);
      const visibleData = data.slice(startIndex, endIndex);
      
      const offsetTop = startIndex * itemHeight;
      container.style.transform = `translateY(${offsetTop}px)`;
      
      const fragment = document.createDocumentFragment();
      
      visibleData.forEach((item, index) => {
        try {
          const escapedOpenCode = Utils.escapeHtml(item.openCode || '0,0,0,0,0,0,0');
          const codeArr = escapedOpenCode.split(',');
          const s = analysisCalc.getSpecial(item);
          const zodArr = s?.fullZodArr || [];
          let balls = '';
          for(let i = 0; i < 6; i++) {
            const num = Number(codeArr[i]);
            balls += analysisCalc.buildBall(codeArr[i], analysisCalc.getColor(num), zodArr[i] || '');
          }
          const teNum = Number(codeArr[6]);
          balls += '<div class="ball-sep">+</div>' + analysisCalc.buildBall(codeArr[6], analysisCalc.getColor(teNum), zodArr[6] || '');
          
          const itemDiv = document.createElement('div');
          itemDiv.className = 'history-item';
          itemDiv.innerHTML = `
            <div class="history-expect">第${Utils.escapeHtml(item.expect || '')}期</div>
            <div class="ball-group">${balls}</div>
          `;
          fragment.appendChild(itemDiv);
        } catch(e) {
          const itemDiv = document.createElement('div');
          itemDiv.className = 'history-item';
          itemDiv.innerHTML = `
            <div class="history-expect">数据错误</div>
            <div class="ball-group">数据加载失败</div>
          `;
          fragment.appendChild(itemDiv);
        }
      });
      
      container.innerHTML = '';
      container.appendChild(fragment);
    }
  },
  
  /**
   * 渲染历史记录（使用虚拟列表）
   */
  renderHistory: () => {
    return PerformanceMonitor.monitorRendering(() => {
      try {
        const state = StateManager._state;
        const historyData = state?.analysis?.historyData || [];
        const historyList = document.getElementById('historyList');
        
        if(!historyList) return;
        
        // 使用虚拟列表渲染
        analysisRender.VirtualList.render(historyData, historyList);
      } catch(e) {
        console.error('渲染历史记录失败:', e);
        const historyList = document.getElementById('historyList');
        if(historyList) historyList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--danger);">渲染失败，请刷新页面</div>';
      }
    }, 'renderHistory');
  },

  /**
   * 渲染全维度分析
   */
  renderFullAnalysis: () => {
    return PerformanceMonitor.monitorRendering(() => {
      const data = analysisCalc.calcFullAnalysis();
      
      // 一次性获取DOM元素
      const hotWrap = document.getElementById('hotWrap');
      const emptyTip = document.getElementById('emptyTip');
      
      if(!data) {
        if(hotWrap) hotWrap.style.display = 'none';
        if(emptyTip) emptyTip.style.display = 'block';
        return;
      }
      
      if(hotWrap) hotWrap.style.display = 'block';
      if(emptyTip) emptyTip.style.display = 'none';

      // 建立完整的号码-生肖映射（用于多维度筛选）
      const fullNumZodiacMap = Utils.buildNumZodiacMap();

      // 调用子函数完成DOM更新
      analysisRender.updateHotConclusion(data, fullNumZodiacMap);
      analysisRender.updateStatsGrid(data);
      analysisRender.renderRankings(data);
    }, 'renderFullAnalysis');
  },

  /**
   * 渲染完整排行
   * @param {string} containerId - 容器ID
   * @param {Object} dataObj - 数据对象
   * @param {number} total - 总期数
   */
  renderFullRank: (containerId, dataObj, total) => {
    try {
      const container = document.getElementById(containerId);
      if(!container) return;
      if(total === 0) { container.innerHTML = ''; return; }
      
      const sorted = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
      let html = `
      <div class="rank-header">
        <div class="rank-no">名次</div>
        <div class="rank-name">分类</div>
        <div class="rank-count">次数</div>
        <div class="rank-rate">占比</div>
        <div class="rank-miss">遗漏</div>
      </div>`;
      
      sorted.forEach(([name, count], idx) => {
        const rate = ((count / total) * 100).toFixed(0) + '%';
        const miss = count > 0 ? Math.floor((total - count) / count) : total;
        html += `
        <div class="rank-row">
          <div class="rank-no">${idx + 1}</div>
          <div class="rank-name">${name}</div>
          <div class="rank-count">${count}</div>
          <div class="rank-rate">${rate}</div>
          <div class="rank-miss">${miss}</div>
        </div>`;
      });
      
      container.innerHTML = html;
    } catch (error) {
      console.error(`渲染完整排行失败 (${containerId}):`, error);
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--danger);">渲染失败</div>';
      }
    }
  },

  /**
   * 渲染生肖关联分析
   */
  renderZodiacAnalysis: () => {
    return PerformanceMonitor.monitorRendering(() => {
      try {
        const data = analysisCalc.calcZodiacAnalysis();
        const zodiacEmptyTip = document.getElementById('zodiacEmptyTip');
        const zodiacContent = document.getElementById('zodiacContent');
        
        if(!data) {
          if(zodiacEmptyTip) zodiacEmptyTip.style.display = 'block';
          if(zodiacContent) zodiacContent.style.display = 'none';
          return;
        }
        
        if(zodiacEmptyTip) zodiacEmptyTip.style.display = 'none';
        if(zodiacContent) zodiacContent.style.display = 'block';
        
        IssueManager.updatePredictionTitles();

        // 生肖预测
        const zodiacPredictionGrid = document.getElementById('zodiacPredictionGrid');
        if(zodiacPredictionGrid) {
          try {
            if(data.sortedZodiacs && data.sortedZodiacs.length > 0) {
              // 使用连续线性评分方案
              const continuous = analysisCalc.calcContinuousScores(data);
              const sortedZodiacs = Object.entries(continuous.scores).sort((a, b) => b[1] - a[1]);
              
              let predictionHtml = '';
              sortedZodiacs.forEach(([zod, totalScore], idx) => {
                const det = continuous.details[zod];
                let topClass = '';
                if (idx === 0) topClass = 'top-1';
                else if (idx === 1) topClass = 'top-2';
                else if (idx === 2) topClass = 'top-3';

                // 生成标签（显示基础分、形态分、间隔分、趋势分、动量分）
                const tags = [];
                if (det.base > 0) tags.push(`${det.status}${det.base}`);
                if (det.shape > 0) tags.push(`形${det.shape}`);
                if (det.interval > 0) tags.push(`间${det.interval}`);
                if (det.trend > 0) tags.push(`趋${det.trend}`);
                if (det.momentum > 0) tags.push(`动${det.momentum}`);

                predictionHtml += `
                    <div class="zodiac-prediction-item ${topClass}" data-zodiac="${zod}">
                        <div class="zodiac-prediction-zodiac">${zod}</div>
                        <div class="zodiac-prediction-score">${totalScore}分</div>
                        <div class="zodiac-prediction-details">
                            ${tags.map(t => `<span class="zodiac-prediction-tag">${t}</span>`).join('')}
                        </div>
                    </div>
                `;
              });
              zodiacPredictionGrid.innerHTML = predictionHtml;
              
              // 生肖预测历史功能已移除
              
              // 自动保存生肖预测到记录页面（使用最新的连续评分数据）
              const updatedData = {
                ...data,
                sortedZodiacs: sortedZodiacs
              };
              analysisRender.autoSaveZodiacPrediction(updatedData);
            } else {
              zodiacPredictionGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--sub-text);">暂无预测数据</div>';
            }
          } catch (error) {
            console.error('渲染生肖预测失败:', error);
            zodiacPredictionGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--danger);">渲染失败</div>';
          }
        }
        
        // 精选生肖
        const selectedZodiacsGrid = document.getElementById('selectedZodiacsGrid');
        if(selectedZodiacsGrid) {
          import('../../prediction.js').then(({ prediction }) => {
            try {
              const rankedZodiacs = analysisCalc.calcSelectedZodiacsV3(30);
              
              if(rankedZodiacs && rankedZodiacs.length > 0) {
                let selectedHtml = '';
                const topZodiacs = rankedZodiacs.slice(0, 6);
                
                topZodiacs.forEach((item) => {
                  const score = item.totalScore;
                  const scoreClass = score >= 70 ? 'high-score' : score >= 50 ? 'mid-score' : 'low-score';
                  const pattern = item.algorithmDetails?.pattern || '未知';
                  const patternBadge = pattern === '持续热肖' ? '🔥' : 
                                       pattern === '持续冷肖' ? '❄️' : 
                                       pattern === '冷热交替' ? '🔄' : 
                                       pattern === '温态肖' ? '🌡️' : '';
                  
                  selectedHtml += `
                    <div class="selected-zodiac-item" data-zodiac="${item.zodiac}">
                      <div class="zodiac-name">${item.zodiac}</div>
                      <div class="zodiac-score ${scoreClass}">${score}分</div>
                      ${patternBadge ? `<div class="zodiac-pattern">${patternBadge}</div>` : ''}
                    </div>
                  `;
                });
                selectedZodiacsGrid.innerHTML = selectedHtml;
                
                selectedZodiacsGrid.onclick = (e) => {
                  const item = e.target.closest('.selected-zodiac-item');
                  if (item) {
                    prediction.showSelectedZodiacRatingDetail(item.dataset.zodiac);
                  }
                };
                
                // 自动保存精选生肖到历史记录
                prediction.silentSaveAllSelectedZodiacs();
              } else {
                selectedZodiacsGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--sub-text);">暂无精选生肖数据</div>';
              }
            } catch (error) {
              console.error('渲染精选生肖失败:', error);
              selectedZodiacsGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--danger);">渲染失败</div>';
            }
          }).catch(error => {
            console.error('导入prediction.js失败:', error);
            selectedZodiacsGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--danger);">加载失败</div>';
          });
        }

        // ML 神经网络预测
        const mlSection = document.getElementById('mlPredictionSection');
        const mlGrid = document.getElementById('mlPredictionGrid');
        const mlStatus = document.getElementById('mlModelStatus');
        const mlPredictionResult = document.getElementById('mlPredictionResult');
        
        if (mlSection && mlGrid && mlStatus) {
          try {
            mlSection.style.display = 'block';
            
            // 绑定训练按钮事件
            const trainBtn = document.getElementById('trainModelBtn');
            if (trainBtn) {
              trainBtn.onclick = async () => {
                try {
                  // 训练开始：添加加载状态
                  trainBtn.disabled = true;
                  trainBtn.classList.add('loading');
                  trainBtn.innerHTML = '<span class="loading-spinner"></span> 训练中...';
                  
                  // 动态更新训练状态
                  let progress = 0;
                  mlStatus.classList.add('loading');
                  const progressInterval = setInterval(() => {
                    progress += 5;
                    if (progress <= 100) {
                      mlStatus.innerHTML = `模型状态: 训练中... ${progress}%`;
                    }
                  }, 200);
                  
                  // 执行训练
                  mlStatus.innerText = '模型状态: 加载数据...';
                  const { mlPredict } = await import('../../ml-predict.js');
                  
                  mlStatus.innerText = '模型状态: 构建模型...';
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  
                  mlStatus.innerText = '模型状态: 训练模型...';
                  await mlPredict.loadAndTrain();
                  
                  // 清除进度更新
                  clearInterval(progressInterval);
                  
                  // 训练完成：更新状态和样式
                  mlStatus.classList.remove('loading');
                  mlStatus.classList.add('success');
                  mlStatus.innerText = '模型状态: 已训练';
                  trainBtn.classList.remove('loading');
                  trainBtn.classList.add('trained');
                  trainBtn.innerHTML = '已训练';
                  
                  // 恢复按钮功能
                  setTimeout(() => {
                    trainBtn.disabled = false;
                  }, 1000);
                } catch (error) {
                  console.error('模型训练失败:', error);
                  // 清除进度更新
                  clearInterval(progressInterval);
                  // 训练失败：更新状态和样式
                  mlStatus.classList.remove('loading');
                  mlStatus.classList.add('error');
                  mlStatus.innerText = '模型状态: 训练失败';
                  // 训练失败：恢复按钮状态
                  trainBtn.disabled = false;
                  trainBtn.classList.remove('loading');
                  trainBtn.innerHTML = '训练';
                }
              };
            }
            
            // 绑定预测按钮事件
            const predictBtn = document.getElementById('runMlPredictBtn');
            if (predictBtn) {
              predictBtn.onclick = async () => {
                try {
                  mlStatus.innerText = '模型状态: 预测中...';
                  const { mlPredict } = await import('../../ml-predict.js');
                  const results = await mlPredict.getPrediction();
                  
                  if (results && results.length > 0) {
                    let html = '';
                    const predictions = [];
                    results.forEach((item, idx) => {
                      const prob = (item.probability * 100).toFixed(1);
                      html += `
                        <div class="selected-zodiac-item" data-zodiac="${item.zodiac}">
                          <div class="zodiac-periods">
                            <span class="selected-zodiac-period-tag">${prob}%</span>
                          </div>
                          <div class="zodiac-name">${item.zodiac}</div>
                        </div>
                      `;
                      // ✅ 只保存生肖名称，不保存百分比
                      predictions.push(item.zodiac);
                    });
                    mlGrid.innerHTML = html;
                    mlStatus.innerText = '模型状态: 预测完成';
                    
                    // 更新ML预测结果显示
                    if (mlPredictionResult) {
                      const primaryPrediction = results[0];
                      mlPredictionResult.innerText = `特码：${primaryPrediction.zodiac}，生肖：${predictions.slice(0, 3).join('、')}`;
                    }
                    
                    // 保存ML预测历史
                    const { Storage } = await import('../../../storage.js');
                    const { mlPredict } = await import('../../ml-predict.js');
                    
                    // ✅ 获取下一期期号（统一使用IssueManager）
                    const nextIssueObj = IssueManager.getNextIssue();
                    const issue = nextIssueObj ? nextIssueObj.full : '2026100';
                    
                    // ✅ 区分训练前和训练后的预测
                    const isTrained = mlPredict.modelReady && !mlPredict.isTraining;
                    const predictionType = isTrained ? 'after-train' : 'before-train';
                    const typeLabel = isTrained ? '已训练' : '未训练';
                    
                    console.log('[ML] 💾 保存预测 - 期号:', issue, '- 类型:', typeLabel);
                    
                    const mlRecord = {
                      issue: issue,
                      predictions: predictions,
                      modelVersion: '1.0',
                      inputFeatures: '历史开奖数据',
                      predictionType: predictionType,
                      isTrained: isTrained,
                      createdAt: new Date().toISOString()
                    };
                    
                    // 获取现有记录
                    const existingRecords = Storage.get('mlPredictionRecords', []);
                    
                    // ✅ 使用复合键（期号+类型）去重：同一期号同一类型只保留最新一条
                    const recordKey = `${issue}_${predictionType}`;
                    const filteredRecords = existingRecords.filter(rec => {
                      const recKey = `${rec.issue}_${rec.predictionType}`;
                      return recKey !== recordKey;
                    });
                    
                    // 添加新记录到开头（时间倒序）
                    filteredRecords.unshift(mlRecord);
                    // 限制历史记录数量
                    const limitedRecords = filteredRecords.slice(0, 100);
                    // 保存到localStorage
                    Storage.set('mlPredictionRecords', limitedRecords);
                    
                    // 通知记录页面更新
                    window.dispatchEvent(new StorageEvent('storage', { key: 'mlPredictionRecords' }));
                  } else {
                    mlGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--sub-text);">无法生成预测</div>';
                    mlStatus.innerText = '模型状态: 预测失败';
                    if (mlPredictionResult) {
                      mlPredictionResult.innerText = '暂无预测结果';
                    }
                  }
                } catch (error) {
                  console.error('模型预测失败:', error);
                  mlGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--danger);">预测失败</div>';
                  mlStatus.innerText = '模型状态: 预测失败';
                  if (mlPredictionResult) {
                    mlPredictionResult.innerText = '预测失败';
                  }
                }
              };
            }
          } catch (error) {
            console.error('初始化ML预测失败:', error);
            mlStatus.innerText = '模型状态: 初始化失败';
            if (mlPredictionResult) {
              mlPredictionResult.innerText = '初始化失败';
            }
          }
        }

        // 共振组合
        const combo1 = document.getElementById('combo1');
        const combo2 = document.getElementById('combo2');
        const combo3 = document.getElementById('combo3');
        if(combo1) combo1.innerText = `1. 首选：尾${data.topTail[0]?.t ?? '-'} + ${data.topZod[0]?.[0] ?? '-'}（出现${data.topZod[0]?.[1] ?? 0}次）`;
        if(combo2) combo2.innerText = `2. 次选：尾${data.topTail[1]?.t ?? '-'} + ${data.topZod[1]?.[0] ?? '-'}（出现${data.topZod[1]?.[1] ?? 0}次）`;
        if(combo3) combo3.innerText = `3. 备选：尾${data.topTail[2]?.t ?? '-'} + ${data.topZod[2]?.[0] ?? '-'}（出现${data.topZod[2]?.[1] ?? 0}次）`;

        // 尾数→生肖网格
        const tailZodiacGrid = document.getElementById('tailZodiacGrid');
        if(tailZodiacGrid) {
          try {
            let tailHtml = '';
            for(let t = 0; t <= 9; t++) {
              const arr = Object.entries(data.tailZodMap[t]).sort((a, b) => b[1] - a[1]);
              const topZ = arr.length ? arr[0][0] : '-';
              const cnt = arr.length ? arr[0][1] : 0;
              const level = analysisCalc.getZodiacLevel(cnt, data.zodMiss[topZ] || 0, data.total);
              tailHtml += `<div class="data-item-z ${level.cls}">尾${t}<br>${topZ}<br>${cnt}次</div>`;
            }
            tailZodiacGrid.innerHTML = tailHtml;
          } catch (error) {
            console.error('渲染尾数→生肖网格失败:', error);
            tailZodiacGrid.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger);">渲染失败</div>';
          }
        }

        // 跟随表格
        const zodiacFollowTable = document.getElementById('zodiacFollowTable');
        if(zodiacFollowTable) {
          try {
            let followHtml = `<tr><th>上期生肖</th><th>首选(次数)</th><th>次选(次数)</th><th>排除生肖</th></tr>`;
            const followKeys = Object.keys(data.followMap).slice(0, 4);
            followKeys.forEach(k => {
              const arr = Object.entries(data.followMap[k]).sort((a, b) => b[1] - a[1]);
              const first = arr[0] ? `${arr[0][0]}(${arr[0][1]})` : '-';
              const second = arr[1] ? `${arr[1][0]}(${arr[1][1]})` : '-';
              const exclude = CONFIG.ANALYSIS.ZODIAC_ALL.filter(z => !arr.some(x => x[0] === z)).slice(0, 2).join('、');
              followHtml += `<tr><td>${k}</td><td>${first}</td><td>${second}</td><td>${exclude || '-'}</td></tr>`;
            });
            zodiacFollowTable.innerHTML = followHtml;
          } catch (error) {
            console.error('渲染跟随表格失败:', error);
            zodiacFollowTable.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--danger);">渲染失败</td></tr>';
          }
        }

        // 12生肖统计
        const zodiacTotalGrid = document.getElementById('zodiacTotalGrid');
        if(zodiacTotalGrid) {
          try {
            let zodHtml = '';
            CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
              const cnt = data.zodCount[z];
              const miss = data.zodMiss[z];
              const rate = ((cnt / data.total) * 100).toFixed(0) + '%';
              const level = analysisCalc.getZodiacLevel(cnt, miss, data.total);
              zodHtml += `<div class="data-item-z ${level.cls}">${z}<br>${cnt}次/${rate}<br>遗${miss}</div>`;
            });
            zodiacTotalGrid.innerHTML = zodHtml;
          } catch (error) {
            console.error('渲染12生肖统计失败:', error);
            zodiacTotalGrid.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger);">渲染失败</div>';
          }
        }

        // 高遗漏生肖
        const zodiacMissGrid = document.getElementById('zodiacMissGrid');
        if(zodiacMissGrid) {
          try {
            const missSort = Object.entries(data.zodMiss).sort((a, b) => b[1] - a[1]).slice(0, 3);
            let missHtml = '';
            missSort.forEach(([z, m]) => {
              const avgMiss = data.zodAvgMiss[z];
              const tag = m > avgMiss ? '超平均' : '';
              missHtml += `<div class="data-item-z cold">${z}<br>遗${m}期<br>${tag}</div>`;
            });
            zodiacMissGrid.innerHTML = missHtml;
          } catch (error) {
            console.error('渲染高遗漏生肖失败:', error);
            zodiacMissGrid.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger);">渲染失败</div>';
          }
        }

        // 精选特码
        analysisRender.renderZodiacFinalNums(data);
      } catch (error) {
        console.error('渲染生肖关联分析失败:', error);
        const zodiacEmptyTip = document.getElementById('zodiacEmptyTip');
        const zodiacContent = document.getElementById('zodiacContent');
        if(zodiacEmptyTip) zodiacEmptyTip.style.display = 'block';
        if(zodiacContent) zodiacContent.style.display = 'none';
      }
    }, 'renderZodiacAnalysis');
  },

  /**
   * 渲染精选特码
   * @param {Object} data 分析数据
   */
  renderZodiacFinalNums: (data) => {
    console.log('🎯 renderZodiacFinalNums 被调用', { hasData: !!data, sortedZodiacs: data?.sortedZodiacs?.length });
    
    const state = StateManager._state;
    const zodiacFinalNumContent = document.getElementById('zodiacFinalNumContent');
    const mode = state.analysis.specialMode || 'hot';
    console.log('📊 当前模式:', mode);
    
    // 同步模式按钮状态
    document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    if(!data || !data.sortedZodiacs || data.sortedZodiacs.length === 0) {
      console.warn('⚠️ 没有数据，跳过渲染和保存');
      if(zodiacFinalNumContent) {
        zodiacFinalNumContent.innerHTML = '✅ 精选特码：暂无数据';
        zodiacFinalNumContent.classList.remove('final-recommend-z-balls');
      }
      return;
    }
    
    // 建立完整的号码-生肖映射
    const fullNumZodiacMap = Utils.buildNumZodiacMap();

    const targetCount = state.analysis.selectedNumCount;
    let finalNums = [];
    let hotNumbers = [];  // ✅ 热号数据
    let coldNumbers = []; // ✅ 冷号数据

    // 根据模式选择不同的筛选策略
    if(mode === 'cold') {
      // ❄️ 冷号反弹模式
      coldNumbers = analysisCalc.getColdReboundNumbers(data, targetCount, fullNumZodiacMap);
      finalNums = [...coldNumbers];
      // ✅ 同时计算热号
      hotNumbers = analysisCalc.getHotNumbers(data, targetCount, fullNumZodiacMap);
    } else if(mode === 'auto') {
      // 🤖 自动模式：智能判断使用热号还是冷号模式
      const modeDecision = analysisCalc.decideAutoMode(data);
      if(modeDecision === 'cold') {
        coldNumbers = analysisCalc.getColdReboundNumbers(data, targetCount, fullNumZodiacMap);
        finalNums = [...coldNumbers];
        // ✅ 同时计算热号
        hotNumbers = analysisCalc.getHotNumbers(data, targetCount, fullNumZodiacMap);
      } else {
        hotNumbers = analysisCalc.getHotNumbers(data, targetCount, fullNumZodiacMap);
        finalNums = [...hotNumbers];
        // ✅ 同时计算冷号
        coldNumbers = analysisCalc.getColdReboundNumbers(data, targetCount, fullNumZodiacMap);
      }
    } else {
      // 🔥 热号模式（默认）
      hotNumbers = analysisCalc.getHotNumbers(data, targetCount, fullNumZodiacMap);
      finalNums = [...hotNumbers];
      // ✅ 同时计算冷号
      coldNumbers = analysisCalc.getColdReboundNumbers(data, targetCount, fullNumZodiacMap);
    }

    // 排序
    finalNums.sort((a, b) => a - b);
    hotNumbers.sort((a, b) => a - b);
    coldNumbers.sort((a, b) => a - b);

    console.log('🔢 计算完成，准备保存', { 
      finalNums: finalNums.length, 
      hotNumbers: hotNumbers.length, 
      coldNumbers: coldNumbers.length,
      mode 
    });

    // ✅ 自动保存记录（包含热号、冷号和当前模式）
    analysisRender.autoSaveSpecialRecord(finalNums, hotNumbers, coldNumbers, mode);

    // 渲染成带颜色、生肖和五行的球号
    let ballHtml = '<div class="ball-group">';
    finalNums.forEach(num => {
      const color = Utils.getNumColor(num);
      const zodiac = fullNumZodiacMap.get(num) || '';
      const element = Utils.getNumElement(num);
      const numStr = String(num).padStart(2, '0');
      const zodiacText = element ? `${zodiac}/${element}` : zodiac;
      ballHtml += `
        <div class="ball-item">
          <div class="ball ${color}">${numStr}</div>
          <div class="ball-zodiac">${zodiacText}</div>
        </div>
      `;
    });
    ballHtml += '</div>';
    
    // 为自动模式添加子模式显示
    if(mode === 'auto') {
      const modeDecision = analysisCalc.decideAutoMode(data);
      const subModeText = modeDecision === 'cold' ? '❄️ 冷号模式' : '🔥 热号模式';
      ballHtml = `<div class="auto-mode-submode" style="text-align:center; margin-bottom:10px; font-size:14px; color:#666;">自动模式当前选择：${subModeText}</div>` + ballHtml;
    }

    if(zodiacFinalNumContent) {
      zodiacFinalNumContent.innerHTML = ballHtml;
      zodiacFinalNumContent.classList.add('final-recommend-z-balls');
    }
  },

  /**
   * ✅ 自动保存精选特码记录（包含热号、冷号和当前模式）
   * ✅ 保存所有筛选条件组合（10/20/30/all期 × 5/10/15/20个）
   * @param {Array} finalNums - 最终显示的号码
   * @param {Array} hotNumbers - 热号数据
   * @param {Array} coldNumbers - 冷号数据
   * @param {string} mode - 当前模式 (hot/cold/auto)
   */
  autoSaveSpecialRecord: (finalNums, hotNumbers, coldNumbers, mode) => {
    try {
      console.log('🔍 开始自动保存精选特码', { finalNums, mode });
      
      // ✅ 获取下一期期号（预测数据必须使用下一期）
      const nextIssueObj = IssueManager.getNextIssue();
      console.log('📅 下一期期号对象:', nextIssueObj);
      
      if (!nextIssueObj || !nextIssueObj.full) {
        console.warn('⚠️ 未找到下一期期号，跳过自动保存');
        return;
      }
      const issue = nextIssueObj.full;
      console.log('✅ 获取到下一期期号:', issue);

      // ✅ 定义所有筛选条件组合
      const allPeriods = [10, 20, 30, 'all'];  // 所有期数选项
      const allNumCounts = [5, 10, 15, 20];    // 所有号码数量选项
      
      console.log('🎯 准备保存所有筛选条件组合:', { periods: allPeriods, numCounts: allNumCounts });

      // 转换为字符串格式
      const allNumbersStr = finalNums.map(n => String(n).padStart(2, '0'));
      const hotNumbersStr = hotNumbers.map(n => String(n).padStart(2, '0'));
      const coldNumbersStr = coldNumbers.map(n => String(n).padStart(2, '0'));
      console.log('🔢 号码数据:', { numbers: allNumbersStr.length, hot: hotNumbersStr.length, cold: coldNumbersStr.length });

      // 确定类型
      let type = mode;
      if (mode === 'auto') {
        // 自动模式下，根据实际选择的子模式设置type
        const data = analysisCalc.calcFullAnalysis();
        if (data) {
          const modeDecision = analysisCalc.decideAutoMode(data);
          type = `auto-${modeDecision}`; // auto-hot 或 auto-cold
          console.log('🤖 自动模式子类型:', type);
        }
      }

      // ✅ 异步导入record模块并保存所有组合
      import('../../record.js').then(({ record }) => {
        console.log('📥 record模块导入成功');
        
        let successCount = 0;
        let failCount = 0;
        
        // 遍历所有期数选项
        allPeriods.forEach(period => {
          // 遍历所有号码数量选项
          allNumCounts.forEach(numCount => {
            try {
              // ✅ 只保存完整的号码列表，不截取
              // 在显示时根据 numCount 动态截取
              
              // 构建记录对象
              const recordData = {
                issue: issue,
                period: period,           // 期数范围：10/20/30/all
                numCount: numCount,       // 号码数量：5/10/15/20
                numbers: allNumbersStr,   // 保存完整列表
                hotNumbers: hotNumbersStr, // 保存完整热号列表
                coldNumbers: coldNumbersStr, // 保存完整冷号列表
                mode: mode,               // 保存当前模式
                type: type                // 保存类型（用于筛选）
              };
              
              // 保存记录
              const success = record.saveNumberRecord(recordData);
              if (success) {
                successCount++;
              } else {
                failCount++;
              }
            } catch (err) {
              console.error(`❌ 保存记录失败 [${period}期/${numCount}个]:`, err);
              failCount++;
            }
          });
        });
        
        console.log('✅ 精选特码记录批量保存完成:', { 
          总数: allPeriods.length * allNumCounts.length,
          成功: successCount,
          失败: failCount 
        });
        
        if (successCount > 0) {
          console.log('✅ 精选特码记录已自动保存', { 
            issue: `${issue}(下一期)`, 
            mode, 
            总组合数: successCount 
          });
        } else {
          console.error('❌ 所有精选特码记录自动保存失败');
        }
      }).catch(err => {
        console.error('❌ 导入record模块失败:', err);
      });
    } catch (error) {
      console.error('❌ 自动保存精选特码记录失败:', error);
      console.error('错误堆栈:', error.stack);
    }
  },

  /**
   * 获取热门数据
   * @param {Array} arr - 数据数组
   * @param {number} limit - 限制数量
   * @returns {string} 热门数据字符串
   */
  getTopHot: (arr, limit = 2) => {
    return arr.sort((a, b) => b[1] - a[1]).slice(0, limit).map(i => i[0]).join(' / ');
  },

  /**
   * 显示统计详情
   * @param {string} statType - 统计类型
   */
  showStatDetail: (statType) => {
    const data = analysisCalc.calcFullAnalysis();
    if(!data) {
      Toast.show('暂无数据可分析');
      return;
    }

    // 统计类型映射
    const statTypeMap = {
      'odd': { name: '单数', data: data.singleDouble['单'], total: data.total },
      'even': { name: '双数', data: data.singleDouble['双'], total: data.total },
      'big': { name: '大(≥25)', data: data.bigSmall['大'], total: data.total },
      'small': { name: '小(&lt;25)', data: data.bigSmall['小'], total: data.total },
      'range1': { name: '1-9', data: data.range['1-9'], total: data.total },
      'range2': { name: '10-19', data: data.range['10-19'], total: data.total },
      'range3': { name: '20-29', data: data.range['20-29'], total: data.total },
      'range4': { name: '30-39', data: data.range['30-39'], total: data.total },
      'range5': { name: '40-49', data: data.range['40-49'], total: data.total },
      'head0': { name: '头0', data: data.head[0], total: data.total },
      'head1': { name: '头1', data: data.head[1], total: data.total },
      'head2': { name: '头2', data: data.head[2], total: data.total },
      'head3': { name: '头3', data: data.head[3], total: data.total },
      'head4': { name: '头4', data: data.head[4], total: data.total },
      'red': { name: '红波', data: data.color['红'], total: data.total },
      'blue': { name: '蓝波', data: data.color['蓝'], total: data.total },
      'green': { name: '绿波', data: data.color['绿'], total: data.total },
      'jin': { name: '金', data: data.wuxing['金'], total: data.total },
      'mu': { name: '木', data: data.wuxing['木'], total: data.total },
      'shui': { name: '水', data: data.wuxing['水'], total: data.total },
      'huo': { name: '火', data: data.wuxing['火'], total: data.total },
      'tu': { name: '土', data: data.wuxing['土'], total: data.total },
      'home': { name: '家禽', data: data.animal['家禽'], total: data.total },
      'wild': { name: '野兽', data: data.animal['野兽'], total: data.total }
    };

    // 处理尾数统计
    if(statType.startsWith('tail')) {
      const tailNum = parseInt(statType.replace('tail', ''));
      statTypeMap[statType] = {
        name: `尾${tailNum}`,
        data: data.tail[tailNum],
        total: data.total
      };
    }

    const stat = statTypeMap[statType];
    if(!stat) {
      Toast.show('无效的统计类型');
      return;
    }

    const percentage = data.total > 0 ? ((stat.data / data.total) * 100).toFixed(2) : '0.00';
    const average = data.total > 0 ? (data.total / stat.data).toFixed(2) : '0.00';

    // 创建弹窗内容
    const content = `
      <div class="stat-detail-header" style="padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 18px; color: #333;">${stat.name}统计详情</h3>
        <button class="close-btn" onclick="this.closest('.stat-detail-modal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">×</button>
      </div>
      <div class="stat-detail-body" style="padding: 20px;">
        <div class="stat-detail-item" style="display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px 0; border-bottom: 1px solid #f5f5f5;">
          <span class="label" style="font-size: 14px; color: #666;">出现次数：</span>
          <span class="value" style="font-size: 14px; font-weight: 500;">${stat.data}次</span>
        </div>
        <div class="stat-detail-item" style="display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px 0; border-bottom: 1px solid #f5f5f5;">
          <span class="label" style="font-size: 14px; color: #666;">总期数：</span>
          <span class="value" style="font-size: 14px; font-weight: 500;">${stat.total}期</span>
        </div>
        <div class="stat-detail-item" style="display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px 0; border-bottom: 1px solid #f5f5f5;">
          <span class="label" style="font-size: 14px; color: #666;">占比：</span>
          <span class="value" style="font-size: 14px; font-weight: 500;">${percentage}%</span>
        </div>
        <div class="stat-detail-item" style="display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px 0; border-bottom: 1px solid #f5f5f5;">
          <span class="label" style="font-size: 14px; color: #666;">平均周期：</span>
          <span class="value" style="font-size: 14px; font-weight: 500;">${average}期</span>
        </div>
      </div>
    `;

    // 使用工具函数创建弹窗
    const modal = document.createElement('div');
    modal.className = 'stat-detail-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease-in-out;
      backdrop-filter: blur(3px);
    `;

    const modalContent = document.createElement('div');
    modalContent.className = 'stat-detail-modal-content';
    modalContent.style.cssText = `
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      max-width: 90%;
      max-height: 80%;
      overflow-y: auto;
      transform: scale(0.9);
      transition: transform 0.3s ease-in-out;
    `;

    modalContent.innerHTML = content;
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // 触发动画
    setTimeout(() => {
      modal.style.opacity = '1';
      modalContent.style.transform = 'scale(1)';
    }, 10);

    // 点击模态框外部关闭
    modal.addEventListener('click', (e) => {
      if(e.target === modal) {
        modal.style.opacity = '0';
        modalContent.style.transform = 'scale(0.9)';
        setTimeout(() => {
          modal.remove();
        }, 300);
      }
    });
  },

  /**
   * 显示连出详情
   * @param {string} streakType - 连出类型
   */
  showStreakDetail: (streakType) => {
    const data = analysisCalc.calcFullAnalysis();
    if(!data) {
      Toast.show('暂无数据可分析');
      return;
    }

    const streakData = streakType === 'current' ? data.streak.curStreakData : data.streak.maxStreakData;
    const streakName = streakType === 'current' ? '当前连出' : '最长连出';

    if(!streakData || streakData.length === 0) {
      Toast.show('暂无连出数据');
      return;
    }

    let detailHtml = '';
    streakData.forEach(item => {
      detailHtml += `
        <div class="streak-detail-item" style="display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px 0; border-bottom: 1px solid #f5f5f5;">
          <span class="expect" style="font-size: 14px; color: #333;">第${item.expect}期</span>
          <span class="te" style="font-size: 14px; color: #666;">特码：${item.te}</span>
          <span class="shape" style="font-size: 14px; color: #666;">形态：${item.shape}</span>
        </div>
      `;
    });

    // 创建弹窗内容
    const content = `
      <div class="streak-detail-header" style="padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 18px; color: #333;">${streakName}详情</h3>
        <button class="close-btn" onclick="this.closest('.streak-detail-modal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">×</button>
      </div>
      <div class="streak-detail-body" style="padding: 20px;">
        <div class="streak-detail-list">
          ${detailHtml}
        </div>
      </div>
    `;

    // 使用工具函数创建弹窗
    const modal = document.createElement('div');
    modal.className = 'streak-detail-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease-in-out;
      backdrop-filter: blur(3px);
    `;

    const modalContent = document.createElement('div');
    modalContent.className = 'streak-detail-modal-content';
    modalContent.style.cssText = `
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      max-width: 90%;
      max-height: 80%;
      overflow-y: auto;
      transform: scale(0.9);
      transition: transform 0.3s ease-in-out;
    `;

    modalContent.innerHTML = content;
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // 触发动画
    setTimeout(() => {
      modal.style.opacity = '1';
      modalContent.style.transform = 'scale(1)';
    }, 10);

    // 点击模态框外部关闭
    modal.addEventListener('click', (e) => {
      if(e.target === modal) {
        modal.style.opacity = '0';
        modalContent.style.transform = 'scale(0.9)';
        setTimeout(() => {
          modal.remove();
        }, 300);
      }
    });
  },

  /**
   * 显示生肖详情
   * @param {string} zodiac - 生肖
   */
  showZodiacDetail: (zodiac) => {
    // 计算不同期数的分析数据（带缓存）
    const calculateData = Utils.createCachedFunction(() => {
      const data10 = analysisCalc.calcZodiacAnalysis(10);
      const data20 = analysisCalc.calcZodiacAnalysis(20);
      const data30 = analysisCalc.calcZodiacAnalysis(30);
      return data10 || data20 || data30;
    });
    
    const data = calculateData();
    
    if(!data) {
      Toast.show('暂无数据可分析');
      return;
    }

    // 生肖号码缓存
    const zodiacNumbersCache = {};
    
    // 获取该生肖对应的号码（带缓存）
    const getZodiacNumbers = (z) => {
      if (zodiacNumbersCache[z]) {
        return zodiacNumbersCache[z];
      }
      
      const numbers = [];
      for(let num = 1; num <= 49; num++) {
        const numZodiac = DataQuery._getZodiacByNum(num);
        if(numZodiac === z) {
          numbers.push(num);
        }
      }
      
      zodiacNumbersCache[z] = numbers;
      return numbers;
    };

    // 按波色分组
    const getColorGroups = (numbers) => {
      const colorGroups = {
        '红': [],
        '蓝': [],
        '绿': []
      };
      numbers.forEach(num => {
        const color = analysisCalc.getColorName(num);
        if(colorGroups[color]) {
          colorGroups[color].push(num);
        }
      });
      return colorGroups;
    };

        // 创建号码分组HTML（优化版 - 单行显示）
    const createNumbersHtml = (colorGroups) => {
      let html = '<div class="zodiac-numbers-section">';
      
      // 合并所有号码到一个数组
      const allNumbers = [];
      Object.entries(colorGroups).forEach(([color, numbers]) => {
        numbers.forEach(num => {
          allNumbers.push({ num, color });
        });
      });
      
      if(allNumbers.length > 0) {
        html += `
          <div class="zodiac-numbers-single-row">
            ${allNumbers.map(({ num, color }) => {
              const colorClass = analysisCalc.getColor(num);
              const element = analysisCalc.getWuxing(num);
              return `<div class="zodiac-ball-wrapper" title="${color}波 · 五行：${element}">
                <span class="zodiac-number ${colorClass}">${String(num).padStart(2, '0')}</span>
              </div>`;
            }).join('')}
          </div>
        `;
      }
      
      html += '</div>';
      return html;
    };

    // 渲染弹窗内容（使用requestAnimationFrame优化）
    const renderContent = (content, zodiac) => {
      // 使用requestAnimationFrame优化DOM更新
      requestAnimationFrame(() => {
        const data = calculateData();
        if(!data) return;

        const count = data.zodCount[zodiac] || 0;
        const miss = data.zodMiss[zodiac] || 0;
        const avgMiss = data.zodAvgMiss[zodiac] || 0;
        const percentage = data.total > 0 ? ((count / data.total) * 100).toFixed(2) : '0.00';
        
        // 获取新算法的评分详情
        const continuous = analysisCalc.calcContinuousScores(data);
        const scoreDetails = continuous.details[zodiac] || {};
        const totalScore = continuous.scores[zodiac] || 0;

        // 获取当前期号并计算下一期
        const currentIssue = document.getElementById('curExpect')?.innerText || '2026100';
        // 计算下一期期号（当前期号 + 1）
        const nextIssue = String(Number(currentIssue) + 1);

        const zodiacNumbers = getZodiacNumbers(zodiac);
        const colorGroups = getColorGroups(zodiacNumbers);
        const numbersHtml = createNumbersHtml(colorGroups);

        // 构建评分维度卡片
        const dimensionCards = `
          <div class="score-dimensions">
            <div class="dimension-card">
              <div class="dimension-icon base">🔥</div>
              <div class="dimension-info">
                <div class="dimension-label">基础热度</div>
                <div class="dimension-value">${scoreDetails.base || 0}<span class="dimension-unit">分</span></div>
                <div class="dimension-status ${scoreDetails.status === '热' ? 'hot' : scoreDetails.status === '温' ? 'warm' : 'cold'}">${scoreDetails.status || '-'}</div>
              </div>
            </div>
            <div class="dimension-card">
              <div class="dimension-icon shape">✨</div>
              <div class="dimension-info">
                <div class="dimension-label">形态共振</div>
                <div class="dimension-value">${scoreDetails.shape || 0}<span class="dimension-unit">分</span></div>
                <div class="dimension-desc">单双/大小/波色</div>
              </div>
            </div>
            <div class="dimension-card">
              <div class="dimension-icon interval">📊</div>
              <div class="dimension-info">
                <div class="dimension-label">间隔规律</div>
                <div class="dimension-value">${scoreDetails.interval || 0}<span class="dimension-unit">分</span></div>
                <div class="dimension-desc">位置偏移匹配</div>
              </div>
            </div>
            <div class="dimension-card">
              <div class="dimension-icon trend">📈</div>
              <div class="dimension-info">
                <div class="dimension-label">趋势动量</div>
                <div class="dimension-value">${(scoreDetails.trend || 0) + (scoreDetails.momentum || 0)}<span class="dimension-unit">分</span></div>
                <div class="dimension-desc">趋${scoreDetails.trend || 0}/动${scoreDetails.momentum || 0}</div>
              </div>
            </div>
          </div>
        `;

        // 创建弹窗内容（优化版）
        const newContent = `
          <div class="zodiac-detail-header-v2">
            <div class="header-main">
              <div class="zodiac-badge">${zodiac}</div>
              <div class="header-info">
                <h3>生肖统计详情</h3>
                <div class="issue-tag">第${Utils.escapeHtml(nextIssue)}期预测</div>
              </div>
            </div>
            <div class="header-actions">
              <button class="close-btn-v2" title="关闭">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="zodiac-detail-body-v2">
            <!-- 核心指标卡片 -->
            <div class="core-metrics">
              <div class="metric-card primary">
                <div class="metric-label">预测总分</div>
                <div class="metric-value">${totalScore}</div>
                <div class="metric-unit">分</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">出现次数</div>
                <div class="metric-value">${count}</div>
                <div class="metric-unit">次</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">遗漏期数</div>
                <div class="metric-value">${miss}</div>
                <div class="metric-unit">期</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">占比</div>
                <div class="metric-value">${percentage}</div>
                <div class="metric-unit">%</div>
              </div>
            </div>

            <!-- 评分维度拆解 -->
            <div class="detail-section">
              <div class="section-title">
                <span class="title-icon">🎯</span>
                评分维度拆解
              </div>
              ${dimensionCards}
            </div>

            <!-- 对应号码 -->
            <div class="detail-section">
              <div class="section-title">
                <span class="title-icon">🔢</span>
                对应号码分布
              </div>
              ${numbersHtml}
            </div>
          </div>
        `;
        
        // 清空并添加新内容
        content.innerHTML = newContent;
        
        // 添加关闭按钮事件
        const closeBtn = content.querySelector('.close-btn-v2');
        if(closeBtn) {
          closeBtn.addEventListener('click', () => {
            const modal = content.closest('.zodiac-detail-modal');
            if(modal) {
              modal.style.opacity = '0';
              content.style.transform = 'scale(0.9)';
              setTimeout(() => {
                modal.remove();
              }, 300);
            }
          });
        }
      });
    };

    // 创建弹窗内容
    const initialContent = `
      <div class="zodiac-detail-header" style="padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 18px; color: #333;">${Utils.escapeHtml(zodiac)}统计详情</h3>
        <div style="display: flex; gap: 10px; align-items: center;">
          <button class="refresh-btn" style="background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer;">刷新</button>
          <button class="close-btn" onclick="this.closest('.zodiac-detail-modal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">×</button>
        </div>
      </div>
      <div class="zodiac-detail-body" style="padding: 20px;">
        <div style="text-align: center; padding: 40px 0;">
          <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid #ccc; border-radius: 50%; border-top-color: #333; animation: spin 1s linear infinite;"></div>
          <p style="margin-top: 10px; color: #666;">加载中...</p>
        </div>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;

    // 创建弹窗容器
    const modal = document.createElement('div');
    modal.className = 'zodiac-detail-modal';
    
    // 创建弹窗内容
    const content = document.createElement('div');
    content.className = 'zodiac-detail-modal-content';
    
    content.innerHTML = initialContent;
    modal.appendChild(content);
    document.body.appendChild(modal);

    // 触发动画
    setTimeout(() => {
      modal.style.opacity = '1';
      content.style.transform = 'scale(1)';
    }, 10);

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
    
    // 渲染详细内容
    renderContent(content, zodiac);
  },

  /**
   * 开始倒计时
   */
  startCountdown: () => {
    // 倒计时功能实现
    const countdown = document.getElementById('countdown');
    if(!countdown) return;

    const updateCountdown = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      
      // 计算距离下一次开奖的时间
      let nextOpenHour = 21;
      let nextOpenMinute = 30;
      
      let timeLeft = (nextOpenHour - hours) * 3600 + (nextOpenMinute - minutes) * 60 - seconds;
      if(timeLeft < 0) {
        timeLeft += 24 * 3600;
      }
      
      const h = Math.floor(timeLeft / 3600);
      const m = Math.floor((timeLeft % 3600) / 60);
      const s = timeLeft % 60;
      
      countdown.innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    updateCountdown();
    setInterval(updateCountdown, 1000);
  },

  /**
   * 开始自动刷新
   */
  startAutoRefresh: () => {
    // 每5分钟自动刷新一次数据
    setInterval(() => {
      import('./data-fetch.js').then(({ dataFetch }) => {
        dataFetch.silentRefreshHistory();
      });
    }, 5 * 60 * 1000);
  },

  /**
   * 更新冷热状态
   */
  updateHotColdStatus: () => {
    // 更新冷热状态的实现
    const hotColdStatus = document.getElementById('hotColdStatus');
    if(!hotColdStatus) return;

    const data = analysisCalc.calcFullAnalysis();
    if(!data) return;

    const hotCount = data.miss.hot;
    const warmCount = data.miss.warm;
    const coldCount = data.miss.cold;

    hotColdStatus.innerText = `热:${hotCount} 温:${warmCount} 冷:${coldCount}`;
  },

  /**
   * 自动保存生肖预测到记录页面
   * @param {Object} data - 分析数据
   */
  autoSaveZodiacPrediction: (data) => {
    try {
      console.log('[AutoSave] ========== 开始自动保存生肖预测 ==========');
      
      // 获取预测期号（下一期），与分析页面保持一致
      const nextIssueObj = IssueManager.getNextIssue();
      if (!nextIssueObj || !nextIssueObj.full) {
        console.warn('[AutoSave] ⚠️ 无法获取预测期号，跳过自动保存');
        return;
      }
      
      const issue = nextIssueObj.full;
      console.log('[AutoSave] 📅 预测期号:', issue, '(对应分析页面标题中的期号)');
      
      // 获取前6名生肖（基于10期、20期、30期数据）
      const topZodiacs = data.sortedZodiacs ? data.sortedZodiacs.slice(0, 6).map(([zod]) => zod) : [];
      
      if (!topZodiacs || topZodiacs.length === 0) {
        console.warn('[AutoSave] 没有生肖预测数据，跳过自动保存');
        return;
      }
      
      console.log('[AutoSave] 前6名生肖:', topZodiacs.join(', '));
      
      // 检查是否已经存在该期号的记录（去重处理）
      const allRecords = Storage.get(Storage.KEYS.ZODIAC_RECORDS, []);
      console.log('[AutoSave] 📋 当前历史记录总数:', allRecords.length);
      
      const existingRecord = allRecords.find(r => r.issue === issue && (!r.recordType || r.recordType !== 'selected'));
      
      if (existingRecord) {
        console.log('[AutoSave] ⏭️ 期号', issue, '的生肖预测已存在，跳过重复保存');
        console.log('[AutoSave] ========== 自动保存结束（跳过） ==========');
        return;
      }
      
      // 准备多期数数据（使用字符串键名，与HTML按钮的data-period属性保持一致）
      const periodData = {};
      ['10', '20', '30'].forEach(period => {
        const periodAnalysis = analysisCalc.calcZodiacAnalysis(Number(period));
        if (periodAnalysis && periodAnalysis.sortedZodiacs) {
          // ✅ 使用五维度评分算法（与预测一致）
          const continuous = analysisCalc.calcContinuousScores(periodAnalysis);
          const sortedZodiacs = Object.entries(continuous.scores).sort((a, b) => b[1] - a[1]);
          // 只保存前6名生肖
          periodData[period] = sortedZodiacs.slice(0, 6).map(([zod]) => zod);
        }
      });
      
      console.log('[AutoSave] 📊 多期数数据:', Object.keys(periodData).join(', '));
      
      // 构建记录数据
      const recordData = {
        issue: issue,
        zodiacs: topZodiacs, // 只保存前6名
        periodData: periodData, // 每个期数都只保存前6名
        createdAt: new Date().toISOString()
      };
      
      console.log('[AutoSave] 💾 准备保存记录 - 期号:', issue, ', 生肖:', topZodiacs.join(', '));
      
      // 导入record模块并保存
      import('../../record.js').then(({ record }) => {
        try {
          const success = record.saveZodiacRecord(recordData);
          if (success) {
            console.log('[AutoSave] ✅ 自动保存成功！');
            console.log('[AutoSave]    - 期号:', issue, '(与分析页面标题一致)');
            console.log('[AutoSave]    - 生肖:', topZodiacs.join(', '));
            console.log('[AutoSave] ========== 自动保存完成 ==========');
            
            // 触发自定义事件，通知当前页面的其他模块数据已更新
            window.dispatchEvent(new CustomEvent('zodiacPredictionSaved', { 
              detail: { issue, zodiacs: topZodiacs } 
            }));
            
            // 触发存储事件，通知其他页面更新
            window.dispatchEvent(new StorageEvent('storage', { key: Storage.KEYS.ZODIAC_RECORDS }));
          } else {
            console.error('[AutoSave] ❌ 自动保存生肖预测失败');
            console.log('[AutoSave] ========== 自动保存结束（失败） ==========');
          }
        } catch (saveError) {
          console.error('[AutoSave] ❌ 自动保存生肖预测异常:', saveError);
          console.log('[AutoSave] ========== 自动保存结束（异常） ==========');
        }
      }).catch(importError => {
        console.error('[AutoSave] ❌ 导入record模块失败:', importError);
        console.log('[AutoSave] ========== 自动保存结束（导入失败） ==========');
      });
    } catch (error) {
      console.error('[AutoSave] ❌ 自动保存生肖预测失败:', error);
      console.log('[AutoSave] ========== 自动保存结束（错误） ==========');
    }
  },


};
