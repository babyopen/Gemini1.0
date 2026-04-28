// ====================== 分析页面模块 ======================

// 导入必要的模块
import { CONFIG } from '../config.js';
import { StateManager } from '../state-manager.js';
import { Storage } from '../storage.js';
import { Toast } from '../toast.js';
import { IssueManager } from '../issue-manager.js';
import { dataFetch } from './analysis/modules/data-fetch.js';
import { analysisCalc } from './analysis/modules/analysis-calc.js';
import { analysisRender } from './analysis/modules/analysis-render.js';

export const analysis = {

  /**
   * 初始化分析页面
   */
  initAnalysisPage: () => {
    const state = StateManager._state;
    if(state.analysis.historyData.length === 0) {
      // 尝试从缓存加载
      const cache = Storage.loadHistoryCache();
      if(cache.data && cache.data.length > 0) {
        // 使用缓存数据
        const newAnalysis = { 
          ...state.analysis, 
          historyData: cache.data 
        };
        StateManager.setState({ analysis: newAnalysis }, false);
        
        // 渲染数据
        analysisRender.renderLatest(cache.data[0]);
        analysisRender.renderHistory();
        analysisRender.renderFullAnalysis();
        analysisRender.renderZodiacAnalysis();
        analysisRender.updateHotColdStatus();
        
        Toast.show('已从缓存加载数据');
        
        // 后台静默刷新
        setTimeout(() => dataFetch.silentRefreshHistory(), 2000);
      } else {
        // 没有缓存，正常加载
        dataFetch.refreshHistory();
      }
    } else {
      // 已有数据，直接渲染，不再额外刷新（initApp已经处理了）
      analysisRender.renderLatest(state.analysis.historyData[0]);
      analysisRender.renderHistory();
      analysisRender.renderFullAnalysis();
      analysisRender.renderZodiacAnalysis();
      analysisRender.updateHotColdStatus();
    }
    analysisRender.startCountdown();
    analysisRender.startAutoRefresh();
  },

  /**
   * 静默刷新历史数据（不显示加载状态）
   */
  silentRefreshHistory: async () => {
    return dataFetch.silentRefreshHistory();
  },

  /**
   * 刷新历史数据
   * @param {boolean} silent - 是否静默模式（不显示提示）
   */
  refreshHistory: async (silent = false) => {
    return dataFetch.refreshHistory(silent);
  },

  /**
   * 获取模拟历史数据
   * @returns {Array} 模拟历史数据
   */
  getMockHistoryData: () => {
    return dataFetch.getMockHistoryData();
  },

  /**
   * 获取特码信息
   * @param {Object} item - 历史数据项
   * @returns {Object} 特码信息
   */
  getSpecial: (item) => {
    const codeArr = (item.openCode || "0,0,0,0,0,0,0").split(",");
    const zodArrRaw = (item.zodiac || ",,,,,,,,,,,,").split(",");
    const zodArr = zodArrRaw.map(z => CONFIG.ANALYSIS.ZODIAC_TRAD_TO_SIMP[z] || z);
    const te = Math.max(0, Number(codeArr[6]));
    
    return {
      te,
      tail: te % 10,
      head: Math.floor(te / 10),
      wave: analysis.getColor(te),
      colorName: analysis.getColorName(te),
      zod: zodArr[6] || "-",
      odd: te % 2 === 1,
      big: te >= 25,
      animal: CONFIG.ANALYSIS.HOME_ZODIAC.includes(zodArr[6]) ? "家禽" : "野兽",
      wuxing: analysis.getWuxing(te),
      fullZodArr: zodArr
    };
  },

  /**
   * 获取号码对应的颜色类名
   * @param {number} number - 号码
   * @returns {string} 颜色类名
   */
  getColor: (number) => {
    const color = Object.keys(CONFIG.COLOR_MAP).find(c => CONFIG.COLOR_MAP[c].includes(number));
    const colorMap = { '红': 'red', '蓝': 'blue', '绿': 'green' };
    return colorMap[color] || 'red';
  },
  
  /**
   * 获取号码对应的颜色名称
   * @param {number} number - 号码
   * @returns {string} 颜色名称
   */
  getColorName: (number) => {
    const color = Object.keys(CONFIG.COLOR_MAP).find(c => CONFIG.COLOR_MAP[c].includes(number));
    return color || '红';
  },
  
  /**
   * 获取号码对应的五行
   * @param {number} number - 号码
   * @returns {string} 五行名称
   */
  getWuxing: (number) => {
    const element = Object.keys(CONFIG.ELEMENT_MAP).find(e => CONFIG.ELEMENT_MAP[e].includes(number));
    return element || '金';
  },

  /**
   * 获取生肖热度等级
   * @param {number} count - 出现次数
   * @param {number} miss - 遗漏期数
   * @param {number} total - 总期数
   * @returns {Object} 热度等级对象
   */
  getZodiacLevel: (count, miss, total) => {
    const avgCount = total / 12;
    if(count >= avgCount * 1.5 && miss <= 3) return { cls: 'hot', text: '热' };
    if(count <= avgCount * 0.5 || miss >= 8) return { cls: 'cold', text: '冷' };
    return { cls: 'warm', text: '温' };
  },

  /**
   * 渲染最新开奖
   * @param {Object} item - 最新数据项
   */
  renderLatest: (item) => {
    try {
      if(!item) return;
      const codeArr = (item.openCode || '0,0,0,0,0,0,0').split(',');
      const s = analysis.getSpecial(item);
      const zodArr = s?.fullZodArr || [];
      
      let html = '';
      for(let i = 0; i < 6; i++) {
        const num = Number(codeArr[i]);
        html += analysis.buildBall(codeArr[i], analysis.getColor(num), zodArr[i] || '');
      }
      html += '<div class="ball-sep">+</div>' + analysis.buildBall(codeArr[6], s?.wave || 'red', zodArr[6] || '');
      
      const latestBalls = document.getElementById('latestBalls');
      const curExpect = document.getElementById('curExpect');
      if(latestBalls) latestBalls.innerHTML = html;
      if(curExpect) curExpect.innerText = item.expect || '--';
      
      // ✅ 自动核对所有未核对的记录
      if (item.expect && s?.zod) {
        setTimeout(() => {
          const parsed = IssueManager.parseIssueNumber(item.expect);
          const issue = parsed ? parsed.full : item.expect;
          Storage.autoCheckAllRecords({
            issue: issue,
            zodiac: s.zod
          });
        }, 500); // 延迟500ms，确保数据已保存
      }
    } catch(e) {
      console.error('渲染最新开奖失败:', e);
    }
  },

  /**
   * 构建球号元素
   * @param {string|number} num - 号码
   * @param {string} color - 颜色类名
   * @param {string} zodiac - 生肖
   * @returns {string} HTML字符串
   */
  buildBall: (num, color, zodiac) => {
    return `
    <div class="ball-item">
      <div class="ball ${color}">${num}</div>
      <div class="ball-zodiac">${zodiac}</div>
    </div>`;
  },

  /**
   * 渲染历史记录
   */
  renderHistory: () => {
    try {
      const state = StateManager._state;
      const historyData = state?.analysis?.historyData || [];
      const showCount = state?.analysis?.showCount || 20;
      const lastUpdateTime = state?.analysis?.lastUpdateTime || 0;
      const list = historyData.slice(0, showCount);
      const historyList = document.getElementById('historyList');
      
      if(!list.length) {
        if(historyList) historyList.innerHTML = '<div style="padding:20px;text-align:center;">暂无历史数据</div>';
        return;
      }
      
      if(historyList) {
        let historyHTML = list.map(item => {
          try {
            const codeArr = (item.openCode || '0,0,0,0,0,0,0').split(',');
            const s = analysis.getSpecial(item);
            const zodArr = s?.fullZodArr || [];
            let balls = '';
            for(let i = 0; i < 6; i++) {
              const num = Number(codeArr[i]);
              balls += analysis.buildBall(codeArr[i], analysis.getColor(num), zodArr[i] || '');
            }
            const teNum = Number(codeArr[6]);
            balls += '<div class="ball-sep">+</div>' + analysis.buildBall(codeArr[6], analysis.getColor(teNum), zodArr[6] || '');
            return `
            <div class="history-item">
              <div class="history-expect">第${item.expect || ''}期</div>
              <div class="ball-group">${balls}</div>
            </div>`;
          } catch(e) {
            console.error('渲染历史记录项失败:', e);
            return `<div class="history-item">
              <div class="history-expect">数据错误</div>
              <div class="ball-group">数据加载失败</div>
            </div>`;
          }
        }).join('');
        
        // 添加最后更新时间
        if (lastUpdateTime) {
          const updateTime = new Date(lastUpdateTime);
          const formattedTime = updateTime.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          historyHTML += `<div style="padding:10px;text-align:center;font-size:12px;color:var(--sub-text);">最后更新时间: ${formattedTime}</div>`;
        }
        
        historyList.innerHTML = historyHTML;
      }
    } catch(e) {
      console.error('渲染历史记录失败:', e);
      const historyList = document.getElementById('historyList');
      if(historyList) historyList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--danger);">渲染失败，请刷新页面</div>';
    }
  },

  /**
   * 计算全维度分析
   * @returns {Object} 分析数据
   */
  calcFullAnalysis: () => {
    const state = StateManager._state;
    const { historyData, analyzeLimit } = state.analysis;
    if(!historyData.length) return null;

    const list = historyData.slice(0, Math.min(analyzeLimit, historyData.length));
    const total = list.length;

    // 初始化统计对象
    const singleDouble = { '单': 0, '双': 0 };
    const bigSmall = { '大': 0, '小': 0 };
    const range = { '1-9': 0, '10-19': 0, '20-29': 0, '30-39': 0, '40-49': 0 };
    const head = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    const tail = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    const color = { '红': 0, '蓝': 0, '绿': 0 };
    const wuxing = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
    const animal = { '家禽': 0, '野兽': 0 };
    const zodiac = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => zodiac[z] = 0);
    const numCount = {};
    for(let i = 1; i <= 49; i++) numCount[String(i).padStart(2, '0')] = 0;
    const lastAppear = {};
    for(let i = 1; i <= 49; i++) lastAppear[i] = -1;

    // 统计
    list.forEach((item, idx) => {
      const s = analysis.getSpecial(item);
      s.odd ? singleDouble['单']++ : singleDouble['双']++;
      s.big ? bigSmall['大']++ : bigSmall['小']++;
      s.te <= 9 ? range['1-9']++ : s.te <= 19 ? range['10-19']++ : s.te <= 29 ? range['20-29']++ : s.te <= 39 ? range['30-39']++ : range['40-49']++;
      head[s.head]++;
      tail[s.tail]++;
      color[s.colorName]++;
      wuxing[s.wuxing]++;
      animal[s.animal]++;
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) zodiac[s.zod]++;
      numCount[String(s.te).padStart(2, '0')]++;
      if(lastAppear[s.te] === -1) lastAppear[s.te] = idx;
    });

    // 遗漏计算
    let totalMissSum = 0, maxMiss = 0, hot = 0, warm = 0, cold = 0;
    const allMiss = [];
    for(let m = 1; m <= 49; m++) {
      const p = lastAppear[m];
      const currentMiss = p === -1 ? total : p;
      allMiss.push(currentMiss);
      totalMissSum += currentMiss;
      if(currentMiss > maxMiss) maxMiss = currentMiss;
      if(currentMiss <= 3) hot++;
      else if(currentMiss <= 9) warm++;
      else cold++;
    }
    const avgMiss = (totalMissSum / 49).toFixed(1);
    const curMaxMiss = Math.max(...allMiss);

    // 连出计算
    let curStreak = 1, maxStreak = 1, current = 1;
    let curStreakData = [];
    let maxStreakData = [];
    let tempStreakData = [];
    
    // 辅助函数：将布尔值转换为中文形态
    const getShapeText = (odd, big) => {
      const oddText = odd ? '单' : '双';
      const bigText = big ? '大' : '小';
      return `${oddText}_${bigText}`;
    };
    
    if(list.length >= 2) {
      const firstSpecial = analysis.getSpecial(list[0]);
      const firstShape = getShapeText(firstSpecial.odd, firstSpecial.big);
      curStreakData.push({
        expect: list[0].expect,
        te: firstSpecial.te,
        shape: firstShape
      });
      for(let i = 1; i < list.length; i++) {
        const s = analysis.getSpecial(list[i]);
        const shape = getShapeText(s.odd, s.big);
        if(shape === firstShape) {
          curStreak++;
          curStreakData.push({
            expect: list[i].expect,
            te: s.te,
            shape: shape
          });
        } else break;
      }
      
      let prevShape = getShapeText(firstSpecial.odd, firstSpecial.big);
      tempStreakData.push({
        expect: list[0].expect,
        te: firstSpecial.te,
        shape: prevShape
      });
      
      for(let i = 1; i < list.length; i++) {
        const s = analysis.getSpecial(list[i]);
        const shape = getShapeText(s.odd, s.big);
        if(shape === prevShape) {
          current++;
          tempStreakData.push({
            expect: list[i].expect,
            te: s.te,
            shape: shape
          });
          if(current > maxStreak) {
            maxStreak = current;
            maxStreakData = [...tempStreakData];
          }
        } else {
          current = 1;
          prevShape = shape;
          tempStreakData = [{
            expect: list[i].expect,
            te: s.te,
            shape: shape
          }];
        }
      }
    }

    // 热门排序
    const hotSD = Object.entries(singleDouble).sort((a, b) => b[1] - a[1])[0];
    const hotBS = Object.entries(bigSmall).sort((a, b) => b[1] - a[1])[0];
    const hotHead = Object.entries(head).sort((a, b) => b[1] - a[1])[0];
    const hotTail = Object.entries(tail).sort((a, b) => b[1] - a[1])[0];
    const hotColor = Object.entries(color).sort((a, b) => b[1] - a[1])[0];
    const hotWx = Object.entries(wuxing).sort((a, b) => b[1] - a[1])[0];
    const hotZod = Object.entries(zodiac).sort((a, b) => b[1] - a[1]).slice(0, 3).map(i => i[0]).join('、');
    const hotAni = Object.entries(animal).sort((a, b) => b[1] - a[1])[0];
    const hotNum = Object.entries(numCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(i => i[0]).join(' ');

    return {
      total, singleDouble, bigSmall, range, head, tail, color, wuxing, animal, zodiac, numCount,
      hotSD, hotBS, hotHead, hotTail, hotColor, hotWx, hotZod, hotAni, hotNum,
      miss: { curMaxMiss, avgMiss, maxMiss, hot, warm, cold },
      streak: { curStreak, maxStreak, curStreakData, maxStreakData }
    };
  },

  getTopHot: (arr, limit = 2) => {
    return analysisRender.getTopHot(arr, limit);
  },

  renderFullAnalysis: () => {
    return analysisRender.renderFullAnalysis();
  },

  renderFullRank: (containerId, dataObj, total) => {
    return analysisRender.renderFullRank(containerId, dataObj, total);
  },

  /**
   * 计算生肖关联分析（带缓存）
   * @returns {Object} 分析数据
   */
  calcZodiacAnalysis: (customAnalyzeLimit) => {
    return analysisCalc.calcZodiacAnalysis(customAnalyzeLimit);
  },
  
  /**
   * 原始的生肖关联分析计算
   * @private
   * @returns {Object} 分析数据
   */
  _calcZodiacAnalysisOriginal: (customAnalyzeLimit) => {
    return analysisCalc._calcZodiacAnalysisOriginal(customAnalyzeLimit);
  },

  /**
   * 渲染生肖关联分析
   */
  renderZodiacAnalysis: () => {
    return analysisRender.renderZodiacAnalysis();
  },

  /**
   * 渲染精选特码
   * @param {Object} data 分析数据
   */
  renderZodiacFinalNums: (data) => {
    return analysisRender.renderZodiacFinalNums(data);
  },

  /**
   * 获取热门号码
   * @param {Object} data - 分析数据
   * @param {number} targetCount - 目标数量
   * @param {Map} fullNumZodiacMap - 号码生肖映射
   * @returns {Array} 号码数组
   */
  getHotNumbers: (data, targetCount, fullNumZodiacMap) => {
    return analysisCalc.getHotNumbers(data, targetCount, fullNumZodiacMap);
  },

  getColdReboundNumbers: (data, targetCount, fullNumZodiacMap) => {
    return analysisCalc.getColdReboundNumbers(data, targetCount, fullNumZodiacMap);
  },

  decideAutoMode: (data) => {
    return analysisCalc.decideAutoMode(data);
  },

  calcZodiacAnalysisForPeriod: (excludePeriods) => {
    const state = StateManager._state;
    const { historyData } = state.analysis;
    
    // 排除指定期数后的数据
    let filteredData = historyData;
    if(excludePeriods && excludePeriods.length > 0) {
      filteredData = historyData.filter(item => !excludePeriods.includes(item.expect));
    }
    
    // 重新计算分析
    const originalLimit = state.analysis.analyzeLimit;
    state.analysis.analyzeLimit = filteredData.length;
    const result = analysis.calcZodiacAnalysis();
    state.analysis.analyzeLimit = originalLimit;
    
    return result;
  },

  syncAnalyze: () => {
    const state = StateManager._state;
    const analyzeSelect = document.getElementById('analyzeSelect');
    const customNum = document.getElementById('customNum');
    
    let newAnalyzeLimit = 10;
    
    if(analyzeSelect) {
      const selectValue = analyzeSelect.value;
      if(selectValue === 'all') {
        newAnalyzeLimit = 'all';
      } else if(selectValue === 'custom' && customNum && customNum.value) {
        const customValue = parseInt(customNum.value);
        newAnalyzeLimit = isNaN(customValue) ? 10 : Math.max(1, Math.min(1000, customValue));
      } else {
        newAnalyzeLimit = parseInt(selectValue) || 10;
      }
    }
    
    // 更新状态
    const newAnalysis = { 
      ...state.analysis, 
      analyzeLimit: newAnalyzeLimit 
    };
    StateManager.setState({ analysis: newAnalysis }, false);
    
    // 清除缓存
    analysisCalc._calcZodiacAnalysisCache.clear();
    
    // 重新渲染
    analysisRender.renderFullAnalysis();
    analysisRender.updateHotColdStatus();
    
    Toast.show('数据已更新');
  },

  syncZodiacAnalyze: () => {
    const state = StateManager._state;
    const zodiacAnalyzeSelect = document.getElementById('zodiacAnalyzeSelect');
    const zodiacCustomNum = document.getElementById('zodiacCustomNum');
    
    let newAnalyzeLimit = 10;
    
    if(zodiacAnalyzeSelect) {
      const selectValue = zodiacAnalyzeSelect.value;
      if(selectValue === 'all') {
        newAnalyzeLimit = 'all';
      } else if(selectValue === 'custom' && zodiacCustomNum && zodiacCustomNum.value) {
        const customValue = parseInt(zodiacCustomNum.value);
        newAnalyzeLimit = isNaN(customValue) ? 10 : Math.max(1, Math.min(1000, customValue));
      } else {
        newAnalyzeLimit = parseInt(selectValue) || 10;
      }
    }
    
    // 更新状态
    const newAnalysis = { 
      ...state.analysis, 
      analyzeLimit: newAnalyzeLimit 
    };
    StateManager.setState({ analysis: newAnalysis }, false);
    
    // 清除缓存
    analysisCalc._calcZodiacAnalysisCache.clear();
    
    // 重新渲染
    analysisRender.renderZodiacAnalysis();
    
    Toast.show('数据已更新');
  },

  toggleDetail: (targetId) => {
    const targetElementId = targetId || 'detailPanel';
    const detailPanel = document.getElementById(targetElementId);
    if(detailPanel) {
      detailPanel.classList.toggle('show');
      // 同时更新按钮文本
      const button = document.querySelector(`[data-action="toggleDetail"][data-target="${targetElementId}"]`);
      if(button) {
        if(detailPanel.classList.contains('show')) {
          button.textContent = '收起详情';
        } else {
          button.textContent = '展开详情';
        }
      }
    }
  },

  switchAnalysisTab: (tab) => {
    const state = StateManager._state;
    StateManager.setState({ 
      analysis: { 
        ...state.analysis, 
        currentTab: tab 
      } 
    });
    
    // 隐藏所有标签按钮的 active 状态
    const tabButtons = document.querySelectorAll('.analysis-tab-btn');
    tabButtons.forEach(btn => {
      btn.classList.remove('active');
    });

    // 隐藏所有面板
    const panels = document.querySelectorAll('.analysis-tab-panel');
    panels.forEach(panel => {
      panel.classList.remove('active');
    });

    // 显示当前标签按钮的 active 状态
    const activeTabBtn = document.querySelector(`.analysis-tab-btn[data-analysis-tab="${tab}"]`);
    if (activeTabBtn) {
      activeTabBtn.classList.add('active');
    }

    // 显示当前面板
    let panelId;
    if (tab === 'history') {
      panelId = 'historyPanel';
    } else if (tab === 'analysis') {
      panelId = 'analysisPanelContent';
    } else if (tab === 'zodiac') {
      panelId = 'zodiacAnalysisPanel';
    }

    if (panelId) {
      const activePanel = document.getElementById(panelId);
      if (activePanel) {
        activePanel.classList.add('active');
      }
    }
  },

  loadMoreHistory: () => {
    const state = StateManager._state;
    const newShowCount = state.analysis.showCount + 20;
    StateManager.setState({ 
      analysis: { 
        ...state.analysis, 
        showCount: newShowCount 
      } 
    });
    analysisRender.renderHistory();
    
    const loadMore = document.getElementById('loadMore');
    if(loadMore) {
      loadMore.style.display = state.analysis.historyData.length > newShowCount ? 'block' : 'none';
    }
  },

  startCountdown: () => {
    return analysisRender.startCountdown();
  },

  isInDrawTime: () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // 开奖时间：21:30-21:45
    return hours === 21 && minutes >= 30 && minutes <= 45;
  },

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

  startAutoRefresh: () => {
    return analysisRender.startAutoRefresh();
  },

  checkDrawTimeLoop: () => {
    setInterval(() => {
      if(analysis.isInDrawTime()) {
        analysis.silentRefreshHistory();
      }
    }, 30 * 1000);
  },

  updateHotColdStatus: () => {
    return analysisRender.updateHotColdStatus();
  },

  refreshHotCold: () => {
    analysis.updateHotColdStatus();
    Toast.show('冷热号状态已更新');
  },

  showStatDetail: (statType) => {
    return analysisRender.showStatDetail(statType);
  },

  showStreakDetail: (streakType) => {
    return analysisRender.showStreakDetail(streakType);
  },

  showZodiacDetail: (zodiac) => {
    return analysisRender.showZodiacDetail(zodiac);
  },

  getCurrentLunarYear: () => {
    return analysisCalc.getCurrentLunarYear();
  },

  getLunarYearByDate: (date) => {
    return analysisCalc.getLunarYearByDate(date);
  },

  /**
   * 切换特码模式
   * @param {string} mode - 模式
   */
  switchSpecialMode: (mode) => {
    const state = StateManager._state;
    StateManager.setState({ 
      analysis: { 
        ...state.analysis, 
        specialMode: mode 
      } 
    });
    
    // 更新UI
    document.querySelectorAll('.special-mode-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`.special-mode-btn[data-mode="${mode}"]`);
    if(activeBtn) activeBtn.classList.add('active');
    
    // 重新分析（会自动触发渲染和保存）
    analysis.renderZodiacAnalysis();
  },

  /**
   * 启动定时获取开奖数据服务
   */
  startScheduledDataFetch: () => {
    return dataFetch.startScheduledDataFetch();
  }
};
