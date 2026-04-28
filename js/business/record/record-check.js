// ====================== 开奖结果核对模块 ======================

import { Storage } from '../../storage.js';
import { Toast } from '../../toast.js';

/**
 * 核对生肖记录
 * @param {string} issue - 期号
 * @param {string} actualZodiac - 实际开奖生肖
 * @returns {Object} 核对结果
 */
export function checkZodiacRecord(issue, actualZodiac) {
  return Storage.checkZodiacRecord(issue, actualZodiac);
}

/**
 * 核对号码记录
 * @param {string} issue - 期号
 * @param {Array} actualNumbers - 实际开奖号码
 * @returns {Object} 核对结果
 */
export function checkNumberRecord(issue, actualNumbers) {
  return Storage.checkNumberRecord(issue, actualNumbers);
}

/**
 * 核对待码热门TOP5记录
 * @param {string} issue - 期号
 * @param {Array} actualNumbers - 实际开奖号码
 * @returns {Object} 核对结果
 */
export function checkHotNumbersRecord(issue, actualNumbers) {
  return Storage.checkHotNumbersRecord(issue, actualNumbers);
}

/**
 * 核对ML预测记录
 * @param {string} issue - 期号
 * @param {string} actualZodiac - 实际开奖生肖
 * @returns {Object} 核对结果
 */
export function checkMLPredictionRecord(issue, actualZodiac) {
  return Storage.checkMLPredictionRecord(issue, actualZodiac);
}

/**
 * 手动核对生肖预测记录
 * @param {string} issue - 期号
 * @param {string} actualZodiac - 实际开奖生肖
 * @returns {boolean} 是否成功
 */
export function manualCheckZodiacRecord(issue, actualZodiac) {
  if (!issue || !actualZodiac) {
    Toast.show('请输入期号和开奖生肖');
    return false;
  }
  
  const result = checkZodiacRecord(issue, actualZodiac);
  if (result.success) {
    Toast.show(result.matched ? '核对成功：命中！' : '核对成功：未中');
  } else {
    Toast.show(result.message || '核对失败');
  }
  return result.success;
}

/**
 * 显示核对对话框
 */
export function showCheckDialog() {
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
    
    manualCheckZodiacRecord(issue, zodiac);
    document.body.removeChild(dialog);
  });
  
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      document.body.removeChild(dialog);
    }
  });
}

export default {
  checkZodiacRecord,
  checkNumberRecord,
  checkHotNumbersRecord,
  checkMLPredictionRecord,
  manualCheckZodiacRecord,
  showCheckDialog
};
