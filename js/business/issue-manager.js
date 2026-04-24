/**
 * 期号管理模块
 * @namespace IssueManager
 * @description 负责期号的解析、验证、生成和更新
 */
import { StateManager } from '../state-manager.js';

export const IssueManager = {
  /**
   * 解析期号
   * @param {string|number} expect - 期号字符串或数字
   * @returns {Object|null} 解析后的期号对象，包含年份、期数和完整期号
   */
  parseIssueNumber(expect) {
    if (!expect) return null;
    
    const expectStr = String(expect);
    
    if (expectStr.length >= 6) {
      const year = expectStr.substring(0, 4);
      const period = expectStr.substring(4, 7);
      
      if (/^\d{4}$/.test(year) && /^\d{3}$/.test(period)) {
        return {
          year: year,
          period: period,
          full: expectStr.substring(0, 7)
        };
      }
    }
    
    return null;
  },

  /**
   * 验证期号格式
   * @param {string} issueStr - 期号字符串
   * @returns {boolean} 期号格式是否有效
   */
  validateIssueFormat(issueStr) {
    if (!issueStr || issueStr.length < 7) return false;
    return /^\d{7}$/.test(issueStr.substring(0, 7));
  },

  /**
   * 获取下一期号
   * @param {string|number} currentExpect - 当前期号
   * @returns {Object|null} 下一期号对象
   */
  getNextIssueNumber(currentExpect) {
    if (!currentExpect) return null;
    
    const parsed = this.parseIssueNumber(currentExpect);
    if (!parsed) return null;
    
    const year = parseInt(parsed.year, 10);
    const period = parseInt(parsed.period, 10);
    
    let nextYear = year;
    let nextPeriod = period + 1;
    
    if (nextPeriod > 365) {
      nextYear = year + 1;
      nextPeriod = 1;
    }
    
    const nextPeriodStr = String(nextPeriod).padStart(3, '0');
    const nextIssueStr = `${nextYear}${nextPeriodStr}`;
    
    return {
      year: String(nextYear),
      period: nextPeriodStr,
      full: nextIssueStr,
      display: `第${nextYear}${nextPeriodStr}期预测`,
      displaySelected: `第${nextYear}${nextPeriodStr}期精选`
    };
  },

  /**
   * 获取最新期号
   * @returns {Object|null} 最新期号对象
   */
  getLatestIssue() {
    try {
      const state = StateManager._state;
      const historyData = state?.analysis?.historyData || [];
      
      if (historyData.length === 0) {
        return null;
      }
      
      const latestIssue = historyData[0]?.expect;
      if (!latestIssue) return null;
      
      return this.parseIssueNumber(latestIssue);
    } catch (e) {
      console.error('获取最新期号失败:', e);
      return null;
    }
  },

  /**
   * 获取下一期号
   * @returns {Object|null} 下一期号对象
   */
  getNextIssue() {
    try {
      const state = StateManager._state;
      const historyData = state?.analysis?.historyData || [];
      
      if (historyData.length === 0) {
        return null;
      }
      
      const latestIssue = historyData[0]?.expect;
      if (!latestIssue) return null;
      
      return this.getNextIssueNumber(latestIssue);
    } catch (e) {
      console.error('获取下一期号失败:', e);
      return null;
    }
  },

  /**
   * 更新预测标题
   */
  updatePredictionTitles() {
    try {
      const nextIssue = this.getNextIssue();
      if (!nextIssue) return;
      
      const titles = document.querySelectorAll('.conclusion-title');
      titles.forEach(title => {
        const text = title.textContent || title.innerText || '';
        
        if (text.includes('生肖预测') && !text.includes('2.0')) {
          title.innerHTML = `🔮 ${nextIssue.display}`;
        } else if (text.includes('精选生肖')) {
          const buttonHtml = title.querySelector('.copy-zodiacs-btn');
          if (buttonHtml) {
            title.innerHTML = `<span>✨ ${nextIssue.displaySelected}</span>`;
            title.appendChild(buttonHtml.cloneNode(true));
          } else {
            title.innerHTML = `<span>✨ ${nextIssue.displaySelected}</span>`;
          }
        }
      });
    } catch (e) {
      console.error('更新预测标题失败:', e);
    }
  }
};
