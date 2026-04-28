// ====================== 预测历史模块 ======================

// 导入必要的模块
import { CONFIG } from '../config.js';
import { Utils } from '../utils.js';
import { StateManager } from '../state-manager.js';
import { DOM } from '../dom.js';
import { DataQuery } from '../data-query.js';
import { Storage } from '../storage.js';
import { Toast } from '../toast.js';
import { analysisCalc } from './analysis/modules/analysis-calc.js';
import { IssueManager } from './issue-manager.js';

// 统一期号获取工具方法
const getCurrentIssue = () => {
  try {
    const nextIssueObj = IssueManager.getNextIssue();
    return nextIssueObj ? nextIssueObj.full : '2026100';
  } catch (error) {
    console.error('[Prediction] 获取期号失败，使用默认值:', error);
    return '2026100';
  }
};

// 复制到剪贴板工具方法
const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  } catch (error) {
    console.error('[Prediction] 复制到剪贴板失败:', error);
    return false;
  }
};

export const prediction = {
  // 工具方法
  copyToClipboard: copyToClipboard,
  
  getCurrentIssue: getCurrentIssue,
  
  // 精选特码历史相关
  saveSpecialToHistory: () => {
    try {
      const state = StateManager._state;
      const specialHistory = state.analysis.specialHistory || [];
      
      // 获取当前选中的特码
      const selectedSpecial = state.analysis.selectedSpecial || [];
      if (selectedSpecial.length === 0) {
        Toast.show('请先选择特码');
        return;
      }
      
      const newItem = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        special: selectedSpecial,
        note: ''
      };
      
      const updatedHistory = [newItem, ...specialHistory];
      
      // 限制历史记录数量
      if (updatedHistory.length > 50) {
        updatedHistory.splice(50);
      }
      
      // 保存到存储
      Storage.saveSpecialHistory(updatedHistory);
      
      // 更新状态
      StateManager.setState({ analysis: { ...state.analysis, specialHistory: updatedHistory } }, false);
      
      Toast.show('精选特码已保存到历史记录');
    } catch(e) {
      console.error('保存精选特码到历史失败:', e);
      Toast.show('保存失败，请稍后重试');
    }
  },

  updateSpecialHistoryComparison: () => {
    try {
      console.log('[Prediction] 更新精选特码历史对比...');
      
      const numberRecords = Storage.get(Storage.KEYS.NUMBER_RECORDS, []);
      
      if (numberRecords.length === 0) {
        Toast.show('暂无历史记录');
        return;
      }
      
      const lastRecord = numberRecords[0];
      const currentIssue = IssueManager.getNextIssue();
      
      Toast.show(`最近一期: ${lastRecord.period || '未知'} - ${lastRecord.numbers?.join(', ') || '无数据'}`);
    } catch (error) {
      console.error('[Prediction] 更新精选特码历史对比失败:', error);
      Toast.show('更新失败');
    }
  },

  favoriteZodiacNumbers: (zodiac) => {
    try {
      console.log('[Prediction] 收藏生肖号码:', zodiac);
      Toast.show('收藏功能开发中');
    } catch (error) {
      console.error('[Prediction] 收藏生肖号码失败:', error);
      Toast.show('操作失败');
    }
  },

  renderSpecialHistory: () => {
    const state = StateManager._state;
    const specialHistory = state.analysis.specialHistory || [];
    const historyList = document.getElementById('specialHistory');
    if (!historyList) return;

    if (specialHistory.length === 0) {
      historyList.innerHTML = '<div style="text-align:center; padding:40px; color:var(--sub-text);">暂无精选特码历史</div>';
      return;
    }

    const fragment = document.createDocumentFragment();

    specialHistory.forEach((item, index) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'special-history-item';
      itemDiv.setAttribute('role', 'listitem');

      const specialHtml = item.special.map(num => {
        const numStr = String(num).padStart(2, '0');
        return `<span class="special-number">${numStr}</span>`;
      }).join(' ');

      itemDiv.innerHTML = `
        <div class="special-history-header">
          <div class="special-history-time">${new Date(item.timestamp).toLocaleString()}</div>
          <div class="special-history-actions">
            <button class="action-btn" onclick="Business.copySpecialHistory(${index})"><i class="icon-copy"></i> 复制</button>
            <button class="action-btn danger" onclick="Business.deleteSpecialHistoryItem(${index})"><i class="icon-delete"></i> 删除</button>
          </div>
        </div>
        <div class="special-history-content">
          <div class="special-numbers">
            ${specialHtml}
          </div>
          ${item.note ? `<div class="special-note">备注: ${item.note}</div>` : ''}
        </div>
      `;

      fragment.appendChild(itemDiv);
    });

    historyList.innerHTML = '';
    historyList.appendChild(fragment);
  },

  toggleSpecialHistory: () => {
    try {
      console.log('[Prediction] 切换精选特码历史展开状态...');
      record.toggleSpecialCollapse();
    } catch (error) {
      console.error('[Prediction] 切换精选特码历史展开状态失败:', error);
      Toast.show('操作失败');
    }
  },

  clearSpecialHistory: () => {
    try {
      console.log('[Prediction] 清空精选特码历史...');
      
      const numberRecords = Storage.get(Storage.KEYS.NUMBER_RECORDS, []);
      
      if (numberRecords.length === 0) {
        Toast.show('暂无历史记录');
        return;
      }
      
      if (confirm('确定清空所有精选特码历史吗？此操作不可恢复！')) {
        Storage.set(Storage.KEYS.NUMBER_RECORDS, []);
        record.renderSpecialHistory();
        record.renderPredictionStatistics();
        Toast.show('已清空精选特码历史');
        console.log('[Prediction] 精选特码历史已清空');
      }
    } catch (error) {
      console.error('[Prediction] 清空精选特码历史失败:', error);
      Toast.show('清空失败');
    }
  },

  deleteSpecialHistoryItem: (index) => {
    try {
      console.log('[Prediction] 删除精选特码历史项:', index);
      
      const numberRecords = Storage.get(Storage.KEYS.NUMBER_RECORDS, []);
      
      if (index < 0 || index >= numberRecords.length) {
        Toast.show('删除失败：记录不存在');
        return;
      }
      
      const recordToDelete = numberRecords[index];
      
      if (confirm(`确定删除该精选特码记录吗？`)) {
        numberRecords.splice(index, 1);
        Storage.set(Storage.KEYS.NUMBER_RECORDS, numberRecords);
        record.renderSpecialHistory();
        record.renderPredictionStatistics();
        Toast.show('删除成功');
        console.log('[Prediction] 精选特码历史项已删除:', index);
      }
    } catch (error) {
      console.error('[Prediction] 删除精选特码历史项失败:', error);
      Toast.show('删除失败');
    }
  },

  copySpecialHistory: (index) => {
    try {
      console.log('[Prediction] 复制精选特码历史:', index);
      
      const numberRecords = Storage.get(Storage.KEYS.NUMBER_RECORDS, []);
      
      if (index < 0 || index >= numberRecords.length) {
        Toast.show('复制失败：记录不存在');
        return;
      }
      
      const recordToCopy = numberRecords[index];
      const textToCopy = `期号: ${recordToCopy.period || '未知'}\n号码: ${recordToCopy.numbers?.join(', ') || '无数据'}\n模式: ${recordToCopy.mode || '未知'}`;
      
      prediction.copyToClipboard(textToCopy).then(() => {
        Toast.show('已复制到剪贴板');
        console.log('[Prediction] 精选特码历史已复制:', index);
      }).catch(err => {
        console.error('[Prediction] 复制失败:', err);
        Toast.show('复制失败');
      });
    } catch (error) {
      console.error('[Prediction] 复制精选特码历史失败:', error);
      Toast.show('复制失败');
    }
  },

  showSpecialHistoryDetail: (index) => {
    try {
      console.log('[Prediction] 显示精选特码详情:', index);
      
      const numberRecords = Storage.get(Storage.KEYS.NUMBER_RECORDS, []);
      
      if (index < 0 || index >= numberRecords.length) {
        Toast.show('查看失败：记录不存在');
        return;
      }
      
      const record = numberRecords[index];
      
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      
      const content = document.createElement('div');
      content.className = 'modal-content';
      content.style.maxWidth = '90%';
      content.style.width = '450px';
      
      const checkedStatus = record.checked ? (record.matched ? '✅ 已验证-命中' : '❌ 已验证-未中') : '⏳ 待验证';
      const checkedClass = record.checked ? (record.matched ? 'status-hit' : 'status-miss') : 'status-pending';
      
      content.innerHTML = `
        <div class="modal-header">
          <h3 class="modal-title">📋 精选特码详情</h3>
          <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body" style="padding: 20px;">
          <div style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span style="font-size: 14px; color: var(--sub-text);">期号</span>
              <span style="font-size: 16px; font-weight: 600;">${record.period || '未知'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span style="font-size: 14px; color: var(--sub-text);">模式</span>
              <span style="font-size: 16px;">${record.mode || '未知'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span style="font-size: 14px; color: var(--sub-text);">号码数量</span>
              <span style="font-size: 16px;">${record.numCount || record.numbers?.length || 0}个</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span style="font-size: 14px; color: var(--sub-text);">验证状态</span>
              <span class="${checkedClass}" style="font-size: 14px; padding: 4px 12px; border-radius: 12px;">${checkedStatus}</span>
            </div>
          </div>
          
          <div style="margin-bottom: 16px;">
            <div style="font-size: 14px; color: var(--sub-text); margin-bottom: 8px;">精选号码</div>
            <div style="background: var(--bg); padding: 12px; border-radius: 8px; display: flex; flex-wrap: wrap; gap: 8px;">
              ${(record.numbers || []).map(num => `
                <span style="background: var(--primary); color: white; padding: 6px 12px; border-radius: 16px; font-weight: 600;">${num}</span>
              `).join('')}
            </div>
          </div>
          
          ${record.note ? `
            <div style="margin-bottom: 16px;">
              <div style="font-size: 14px; color: var(--sub-text); margin-bottom: 8px;">备注</div>
              <div style="background: var(--bg); padding: 12px; border-radius: 8px; font-size: 14px;">${record.note}</div>
            </div>
          ` : ''}
          
          <div style="margin-bottom: 16px;">
            <div style="font-size: 14px; color: var(--sub-text); margin-bottom: 8px;">保存时间</div>
            <div style="font-size: 14px;">${record.savedAt ? new Date(record.savedAt).toLocaleString('zh-CN') : '未知'}</div>
          </div>
          
          <div style="display: flex; gap: 12px; margin-top: 20px;">
            <button onclick="prediction.copySpecialHistory(${index}); this.closest('.modal-overlay').remove();" 
                    style="flex: 1; padding: 12px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;">
              复制号码
            </button>
            <button onclick="if(confirm('确定删除这条记录吗？')){ prediction.deleteSpecialHistoryItem(${index}); this.closest('.modal-overlay').remove(); }" 
                    style="flex: 1; padding: 12px; background: var(--danger); color: white; border: none; border-radius: 8px; cursor: pointer;">
              删除
            </button>
          </div>
        </div>
      `;
      
      modal.appendChild(content);
      document.body.appendChild(modal);
      
      setTimeout(() => {
        modal.style.opacity = '1';
        content.style.transform = 'scale(1)';
      }, 10);
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.opacity = '0';
          content.style.transform = 'scale(0.9)';
          setTimeout(() => modal.remove(), 300);
        }
      });
    } catch (error) {
      console.error('[Prediction] 显示精选特码详情失败:', error);
      Toast.show('显示详情失败');
    }
  },

  toggleSpecialFiltersPanel: () => {
    try {
      console.log('[Prediction] 切换精选特码筛选面板...');
      record.toggleSpecialFiltersPanel();
    } catch (error) {
      console.error('[Prediction] 切换精选特码筛选面板失败:', error);
      Toast.show('操作失败');
    }
  },

  confirmSpecialFilters: () => {
    try {
      console.log('[Prediction] 确认精选特码筛选...');
      record.confirmSpecialFilters();
    } catch (error) {
      console.error('[Prediction] 确认精选特码筛选失败:', error);
      Toast.show('筛选失败');
    }
  },

  getFilteredSpecialHistory: () => {
    try {
      console.log('[Prediction] 获取精选特码历史...');
      
      const numberRecords = Storage.get(Storage.KEYS.NUMBER_RECORDS, []);
      
      return numberRecords;
    } catch (error) {
      console.error('[Prediction] 获取精选特码历史失败:', error);
      return [];
    }
  },

  goToSpecialHistoryPage: (page) => {
    try {
      console.log('[Prediction] 跳转到精选特码历史页面:', page);
      
      const numberRecords = prediction.getFilteredSpecialHistory();
      const pageSize = 10;
      const totalPages = Math.ceil(numberRecords.length / pageSize);
      
      if (page < 1 || page > totalPages) {
        Toast.show('页码超出范围');
        return;
      }
      
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const pageRecords = numberRecords.slice(start, end);
      
      record.renderSpecialHistory(pageRecords);
      
      const container = document.getElementById('specialHistoryList');
      if (container) {
        const pagination = container.querySelector('.pagination');
        if (pagination) {
          pagination.innerHTML = record._generatePagination(page, totalPages, 'specialHistory');
        }
      }
      
      Toast.show(`已跳转到第 ${page} 页`);
    } catch (error) {
      console.error('[Prediction] 跳转精选特码历史页面失败:', error);
      Toast.show('分页失败');
    }
  },

  // 精选生肖历史相关
  silentSaveAllSelectedZodiacs: () => {
    try {
      console.log('[AutoSave] ========== 开始自动保存精选生肖 ==========');
      
      // 获取预测期号（下一期）
      const nextIssueObj = IssueManager.getNextIssue();
      if (!nextIssueObj || !nextIssueObj.full) {
        console.warn('[AutoSave] ⚠️ 无法获取预测期号，跳过自动保存');
        return;
      }
      
      const issue = nextIssueObj.full;
      console.log('[AutoSave] 📅 预测期号:', issue);
      
      // 获取精选生肖数据（与分析页面显示的一致）
      const zodiacMap = prediction.getSelectedZodiacs();
      const selectedZodiacs = Array.from(zodiacMap.keys());
      
      if (selectedZodiacs.length === 0) {
        console.warn('[AutoSave] 没有精选生肖数据，跳过自动保存');
        return;
      }
      
      console.log('[AutoSave] 精选生肖:', selectedZodiacs.join(', '));
      
      // 检查是否已经存在该期号的记录（去重处理）
      const allRecords = Storage.get('zodiacRecords', []);
      console.log('[AutoSave] 📋 当前历史记录总数:', allRecords.length);
      
      const existingRecord = allRecords.find(r => r.issue === issue && r.recordType === 'selected');
      
      if (existingRecord) {
        console.log('[AutoSave] ⏭️ 期号', issue, '的精选生肖记录已存在，跳过重复保存');
        console.log('[AutoSave] ========== 自动保存结束（跳过） ==========');
        return;
      }
      
      // 构建记录数据
      const recordData = {
        issue: issue,
        zodiacs: selectedZodiacs,
        recordType: 'selected',
        createdAt: new Date().toISOString(),
        checked: false,  // 是否已核对
        matched: false,  // 是否命中
        actualZodiac: null  // 开奖生肖
      };
      
      console.log('[AutoSave] 💾 准备保存记录 - 期号:', issue, ', 生肖:', selectedZodiacs.join(', '));
      
      // 保存到存储
      const success = Storage.saveZodiacRecord(recordData);
      if (success) {
        console.log('[AutoSave] ✅ 自动保存成功！');
        console.log('[AutoSave]    - 期号:', issue);
        console.log('[AutoSave]    - 生肖:', selectedZodiacs.join(', '));
        console.log('[AutoSave] ========== 自动保存完成 ==========');
        
        // 触发自定义事件，通知当前页面的其他模块数据已更新
        window.dispatchEvent(new CustomEvent('zodiacPredictionSaved', { 
          detail: { issue, zodiacs: selectedZodiacs, recordType: 'selected' } 
        }));
        
        // 触发存储事件，通知其他页面更新
        window.dispatchEvent(new StorageEvent('storage', { key: Storage.KEYS.ZODIAC_RECORDS }));
      } else {
        console.error('[AutoSave] ❌ 自动保存精选生肖失败');
        console.log('[AutoSave] ========== 自动保存结束（失败） ==========');
      }
    } catch (error) {
      console.error('[AutoSave] ❌ 自动保存精选生肖失败:', error);
      console.log('[AutoSave] ========== 自动保存结束（错误） ==========');
    }
  },

  updateSelectedZodiacHistoryComparison: () => {
    try {
      console.log('[Prediction] 更新精选生肖历史对比...');
      
      const allRecords = Storage.get('zodiacRecords', []);
      const selectedRecords = allRecords.filter(r => r.recordType === 'selected');
      
      if (selectedRecords.length === 0) {
        Toast.show('暂无历史记录');
        return;
      }
      
      const lastRecord = selectedRecords[0];
      
      Toast.show(`最近一期: ${lastRecord.period || '未知'} - ${lastRecord.selected?.join(', ') || '无数据'}`);
    } catch (error) {
      console.error('[Prediction] 更新精选生肖历史对比失败:', error);
      Toast.show('更新失败');
    }
  },

  getSelectedZodiacs: () => {
    const periods = [10, 20, 30];
    const result = new Map();
    
    periods.forEach((period, periodIndex) => {
      const rankedZodiacs = analysisCalc.calcSelectedZodiacsV3(period);
      if (rankedZodiacs && rankedZodiacs.length > 0) {
        rankedZodiacs.slice(0, 3).forEach((item) => {
          if (!result.has(item.zodiac)) {
            result.set(item.zodiac, []);
          }
          result.get(item.zodiac).push(periodIndex + 1);
        });
      }
    });
    
    return result;
  },

  toggleZodiacSelection: (zodiac) => {
    try {
      console.log('[Prediction] 切换生肖选中状态:', zodiac);
      
      const state = StateManager._state;
      const selectedZodiacs = state.analysis.selectedZodiacs || [];
      
      const index = selectedZodiacs.indexOf(zodiac);
      if (index > -1) {
        selectedZodiacs.splice(index, 1);
      } else {
        selectedZodiacs.push(zodiac);
      }
      
      StateManager.setState('analysis.selectedZodiacs', selectedZodiacs);
      
      Toast.show(`已${index > -1 ? '取消' : '选择'} ${zodiac}`);
    } catch (error) {
      console.error('[Prediction] 切换生肖选中状态失败:', error);
      Toast.show('操作失败');
    }
  },

  clearAllZodiacSelections: () => {
    try {
      console.log('[Prediction] 清除所有生肖选中...');
      
      StateManager.setState('analysis.selectedZodiacs', []);
      
      Toast.show('已清除所有选中');
    } catch (error) {
      console.error('[Prediction] 清除所有生肖选中失败:', error);
      Toast.show('操作失败');
    }
  },

  showSelectedZodiacRatingDetail: (zodiac) => {
    try {
      const periods = [10, 20, 30];
      const periodLabels = { 10: '10期', 20: '20期', 30: '30期' };
      const state = StateManager._state;
      
      const fullNumZodiacMap = state.config?.fullNumZodiacMap;
      const zodiacNumbers = analysisCalc.getZodiacNumbers(zodiac);
      
      const calculateData = (period) => {
        const data = analysisCalc.calcSelectedZodiacsV3(period);
        return data.find(item => item.zodiac === zodiac);
      };

      const renderContent = (content, zodiac) => {
        requestAnimationFrame(() => {
          let periodsHtml = '';
          let totalScore = 0;
          let periodCount = 0;
          
          let totalHotInertia = 0;
          let totalMissRepair = 0;
          let totalCycleBalance = 0;
          let totalBaseScore = 0;
          
          const nextIssueObj = IssueManager.getNextIssue();
          const currentIssue = nextIssueObj ? nextIssueObj.full : '2026100';
          
          periods.forEach(period => {
            const result = calculateData(period);
            if (!result) return;
            
            const { totalScore: score, baseScore, hotInertiaBonus, missRepairBonus, cycleBalanceBonus, algorithmDetails } = result;
            totalScore += score;
            periodCount++;
            
            totalHotInertia += hotInertiaBonus;
            totalMissRepair += missRepairBonus;
            totalCycleBalance += cycleBalanceBonus;
            totalBaseScore += baseScore;
            
            const missPeriod = algorithmDetails?.missPeriod || 0;
            const recent2Zodiac = algorithmDetails?.recent2Zodiac || [];
            const cycleState = algorithmDetails?.cycleState || 'normal';
            const missLevel = algorithmDetails?.missLevel || 'normal';
            const dynamicWeight = algorithmDetails?.dynamicWeight || 1;
            
            periodsHtml += `
              <div style="margin-bottom:16px;">
                <div style="font-size:14px;font-weight:600;margin-bottom:10px;color:var(--text);">${Utils.escapeHtml(periodLabels[period])}分析</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                  <div style="display:flex;flex-direction:column;gap:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                      <span style="font-size:13px;color:var(--sub-text);">总评分</span>
                      <span style="font-size:13px;font-weight:600;color:var(--primary);">${score}分</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                      <span style="font-size:13px;color:var(--sub-text);">基础频次分</span>
                      <span style="font-size:13px;color:var(--text);">${baseScore}分</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                      <span style="font-size:13px;color:var(--sub-text);">动态权重</span>
                      <span style="font-size:13px;color:var(--text);">×${dynamicWeight.toFixed(2)}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                      <span style="font-size:13px;color:var(--sub-text);">遗漏期数</span>
                      <span style="font-size:13px;color:var(--text);">${missPeriod}期</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                      <span style="font-size:13px;color:var(--sub-text);">轮转状态</span>
                      <span style="font-size:13px;padding:2px 8px;border-radius:10px;background:${cycleState === 'hot' ? 'var(--danger)' : cycleState === 'cold' ? 'var(--success)' : 'var(--primary)'};color:white;">${cycleState === 'hot' ? '热' : cycleState === 'cold' ? '冷' : '温'}</span>
                    </div>
                  </div>
                  <div style="display:flex;flex-direction:column;gap:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                      <span style="font-size:13px;color:var(--sub-text);">🔥热号惯性</span>
                      <span style="font-size:13px;font-weight:600;color:var(--danger);">+${hotInertiaBonus}分</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                      <span style="font-size:13px;color:var(--sub-text);">❄️冷号回补</span>
                      <span style="font-size:13px;font-weight:600;color:#FF9800;">+${missRepairBonus}分</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                      <span style="font-size:13px;color:var(--sub-text);">🔄轮换平衡</span>
                      <span style="font-size:13px;font-weight:600;color:${cycleBalanceBonus >= 0 ? 'var(--success)' : 'var(--danger)'};">${cycleBalanceBonus >= 0 ? '+' : ''}${cycleBalanceBonus}分</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                      <span style="font-size:13px;color:var(--sub-text);">遗漏等级</span>
                      <span style="font-size:13px;padding:2px 8px;border-radius:10px;background:${missLevel === 'extreme_cold' ? '#9C27B0' : missLevel === 'deep_cold' ? '#E91E63' : missLevel === 'light_cold' ? '#FF9800' : 'var(--primary)'};color:white;">${missLevel === 'extreme_cold' ? '极冷' : missLevel === 'deep_cold' ? '深冷' : missLevel === 'light_cold' ? '轻冷' : '正常'}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                      <span style="font-size:13px;color:var(--sub-text);">近2期生肖</span>
                      <span style="font-size:13px;color:var(--text);">${recent2Zodiac.length > 0 ? recent2Zodiac.join(' → ') : '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            `;
          });
          
          const averageScore = periodCount > 0 ? (totalScore / periodCount).toFixed(1) : '0.0';
          const avgHotInertia = periodCount > 0 ? Math.round(totalHotInertia / periodCount) : 0;
          const avgMissRepair = periodCount > 0 ? Math.round(totalMissRepair / periodCount) : 0;
          const avgCycleBalance = periodCount > 0 ? Math.round(totalCycleBalance / periodCount) : 0;
          const avgBaseScore = periodCount > 0 ? Math.round(totalBaseScore / periodCount) : 0;
          
          const reasons = [];
          if (avgHotInertia > 0) reasons.push(`🔥近期热号惯性，加分${avgHotInertia}分`);
          if (avgMissRepair > 0) reasons.push(`❄️遗漏回补潜力，加分${avgMissRepair}分`);
          if (avgCycleBalance > 0) reasons.push(`🔄轮换平衡加分${avgCycleBalance}分`);
          else if (avgCycleBalance < 0) reasons.push(`📉连续高热扣分${avgCycleBalance}分`);
          
          const reasonText = reasons.length > 0 ? reasons.join('；') : '暂无明显优势';
          
          const recommendedNumbers = zodiacNumbers.map(num => `<span style="display:inline-block;min-width:36px;padding:6px 12px;background:var(--primary);color:white;border-radius:16px;font-weight:600;margin:4px;">${String(num).padStart(2, '0')}</span>`).join('');
          
          const firstResult = periods.length > 0 ? calculateData(periods[0]) : null;
          const pattern = firstResult?.algorithmDetails?.pattern || '-';
          const patternConfidence = firstResult?.algorithmDetails?.patternConfidence || 0;
          const marketInfo = firstResult?.algorithmDetails?.marketInfo || {};
          const multiWindow = firstResult?.algorithmDetails?.multiWindow || {};
          
          const isAlternating = marketInfo.isAlternating;
          const marketBadge = isAlternating ? '<span style="display:inline-block;padding:2px 8px;background:#9C27B0;color:white;border-radius:10px;font-size:12px;margin-left:8px;">冷热交替行情</span>' : '';
          
          const fragment = document.createDocumentFragment();
          const newContent = document.createElement('div');
          newContent.innerHTML = `
            <div class="modal-header">
              <h3 class="modal-title">🎯 ${Utils.escapeHtml(zodiac)} 精选详情 (第${Utils.escapeHtml(currentIssue)}期)${marketBadge}</h3>
              <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <div class="modal-body">
              <div style="margin-bottom:20px;padding:16px;background:linear-gradient(135deg, var(--primary) 0%, #0051d5 100%);border-radius:12px;color:white;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:14px;font-weight:600;">综合平均评分</span>
                  <span style="font-size:24px;font-weight:700;">${Utils.escapeHtml(averageScore)}分</span>
                </div>
              </div>
              
              <div style="margin-bottom:16px;">
                <div style="font-size:14px;font-weight:600;margin-bottom:8px;color:var(--text);">📈 走势识别</div>
                <div style="padding:12px;background:var(--bg);border-radius:8px;">
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                    <div style="padding:8px;background:white;border-radius:6px;text-align:center;">
                      <div style="font-size:11px;color:var(--sub-text);">短(5期)</div>
                      <div style="font-size:16px;font-weight:700;color:${multiWindow.short === 'hot' ? 'var(--danger)' : multiWindow.short === 'cold' ? 'var(--success)' : 'var(--primary)'};">${multiWindow.short === 'hot' ? '热' : multiWindow.short === 'cold' ? '冷' : '温'}</div>
                    </div>
                    <div style="padding:8px;background:white;border-radius:6px;text-align:center;">
                      <div style="font-size:11px;color:var(--sub-text);">中(8期)</div>
                      <div style="font-size:16px;font-weight:700;color:${multiWindow.mid === 'hot' ? 'var(--danger)' : multiWindow.mid === 'cold' ? 'var(--success)' : 'var(--primary)'};">${multiWindow.mid === 'hot' ? '热' : multiWindow.mid === 'cold' ? '冷' : '温'}</div>
                    </div>
                    <div style="padding:8px;background:white;border-radius:6px;text-align:center;">
                      <div style="font-size:11px;color:var(--sub-text);">长(10期)</div>
                      <div style="font-size:16px;font-weight:700;color:${multiWindow.long === 'hot' ? 'var(--danger)' : multiWindow.long === 'cold' ? 'var(--success)' : 'var(--primary)'};">${multiWindow.long === 'hot' ? '热' : multiWindow.long === 'cold' ? '冷' : '温'}</div>
                    </div>
                    <div style="padding:8px;background:white;border-radius:6px;text-align:center;">
                      <div style="font-size:11px;color:var(--sub-text);">走势判定</div>
                      <div style="font-size:14px;font-weight:700;color:var(--primary);">${pattern}</div>
                    </div>
                  </div>
                  <div style="text-align:center;font-size:12px;color:var(--sub-text);">
                    可信度：${(patternConfidence * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
              
              <div style="margin-bottom:16px;">
                <div style="font-size:14px;font-weight:600;margin-bottom:8px;color:var(--text);">🎰 推荐号码</div>
                <div style="padding:12px;background:var(--bg);border-radius:8px;text-align:center;">
                  ${recommendedNumbers}
                </div>
              </div>
              
              <div style="margin-bottom:16px;">
                <div style="font-size:14px;font-weight:600;margin-bottom:8px;color:var(--text);">📋 推荐理由</div>
                <div style="padding:12px;background:#FFF3E0;border-radius:8px;color:#E65100;font-size:13px;line-height:1.6;">
                  ${reasonText}
                </div>
              </div>
              
              <div style="margin-bottom:16px;">
                <div style="font-size:14px;font-weight:600;margin-bottom:8px;color:var(--text);">🔬 算法评分明细</div>
                <div style="padding:12px;background:var(--bg);border-radius:8px;">
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
                    <div style="padding:8px;background:white;border-radius:6px;text-align:center;">
                      <div style="font-size:12px;color:var(--sub-text);">🔥热号惯性</div>
                      <div style="font-size:18px;font-weight:700;color:var(--danger);">+${avgHotInertia}</div>
                    </div>
                    <div style="padding:8px;background:white;border-radius:6px;text-align:center;">
                      <div style="font-size:12px;color:var(--sub-text);">❄️冷号回补</div>
                      <div style="font-size:18px;font-weight:700;color:#FF9800;">+${avgMissRepair}</div>
                    </div>
                    <div style="padding:8px;background:white;border-radius:6px;text-align:center;">
                      <div style="font-size:12px;color:var(--sub-text);">🔄轮换平衡</div>
                      <div style="font-size:18px;font-weight:700;color:${avgCycleBalance >= 0 ? 'var(--success)' : 'var(--danger)'};">${avgCycleBalance >= 0 ? '+' : ''}${avgCycleBalance}</div>
                    </div>
                    <div style="padding:8px;background:white;border-radius:6px;text-align:center;">
                      <div style="font-size:12px;color:var(--sub-text);">📊基础频次</div>
                      <div style="font-size:18px;font-weight:700;color:var(--primary);">${avgBaseScore}</div>
                    </div>
                  </div>
                  <div style="padding:8px;background:white;border-radius:6px;text-align:center;">
                    <div style="font-size:12px;color:var(--sub-text);">📐 动态权重</div>
                    <div style="font-size:18px;font-weight:700;color:var(--primary);">×${(1 + avgHotInertia/100 + avgMissRepair/100 + avgCycleBalance/100).toFixed(2)}</div>
                  </div>
                </div>
              </div>
              
              ${periodsHtml}
              
              <div style="margin-top:16px;padding:12px;background:linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);border-radius:8px;">
                <div style="font-size:12px;color:var(--sub-text);line-height:1.6;">
                  <div style="font-weight:600;margin-bottom:4px;">📖 V3.0算法说明</div>
                  <div>• 🔥 热号惯性：利用近期开奖惯性，近期开出的生肖有延续概率</div>
                  <div>• ❄️ 冷号回补：长期遗漏的生肖存在概率回补修复需求</div>
                  <div>• 🔄 轮换平衡：12生肖遵循热转冷、冷转热的自然轮转规律</div>
                  <div>• 📊 频次统计：历史开出频率作为模型基础得分盘口</div>
                  <div style="margin-top:4px;">• 📈 走势识别：5/8/10期三窗口交叉验证，识别7种标准走势</div>
                  <div>• 🔄 冷热交替：检测行情类型，动态调整权重</div>
                </div>
              </div>
            </div>
          `;
          
          fragment.appendChild(newContent);
          content.innerHTML = '';
          content.appendChild(fragment);
        });
      };
      
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      
      const content = document.createElement('div');
      content.className = 'modal-content';
      content.style.maxWidth = '90%';
      content.style.width = '480px';
      
      renderContent(content, zodiac);
      
      modal.appendChild(content);
      document.body.appendChild(modal);
      
      setTimeout(() => {
        modal.style.opacity = '1';
        content.style.transform = 'scale(1)';
      }, 10);
      
      modal.addEventListener('click', (e) => {
        if(e.target === modal) {
          modal.style.opacity = '0';
          content.style.transform = 'scale(0.9)';
          setTimeout(() => modal.remove(), 300);
        }
      });
    } catch (e) {
      console.error('显示详细评分失败', e);
      Toast.show('显示详情失败');
    }
  },

  copySelectedZodiacs: async () => {
    try {
      const selectedZodiacsMap = prediction.getSelectedZodiacs();
      
      if (!selectedZodiacsMap || selectedZodiacsMap.size === 0) {
        Toast.show('暂无生肖可复制');
        return;
      }
      
      const zodiacNames = Array.from(selectedZodiacsMap.keys());
      const textToCopy = zodiacNames.join(' ');
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (!successful) {
          throw new Error('复制失败');
        }
      }
      
      Toast.show(`已复制: ${textToCopy}`);
      
      const copyBtn = document.querySelector('.copy-zodiacs-btn');
      if (copyBtn) {
        const originalHtml = copyBtn.innerHTML;
        copyBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          已复制
        `;
        copyBtn.style.background = 'var(--success)';
        copyBtn.style.color = '#fff';
        
        setTimeout(() => {
          copyBtn.innerHTML = originalHtml;
          copyBtn.style.background = '';
          copyBtn.style.color = '';
        }, 2000);
      }
    } catch (e) {
      console.error('复制生肖失败', e);
      Toast.show('复制失败，请手动复制');
    }
  },

  renderSelectedZodiacHistory: () => {
    const state = StateManager._state;
    const selectedZodiacHistory = state.analysis.selectedZodiacHistory || [];
    const historyList = document.getElementById('selectedZodiacHistory');
    if (!historyList) return;

    if (selectedZodiacHistory.length === 0) {
      historyList.innerHTML = '<div style="text-align:center; padding:40px; color:var(--sub-text);">暂无精选生肖历史</div>';
      return;
    }

    const fragment = document.createDocumentFragment();

    selectedZodiacHistory.forEach((item, index) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'selected-zodiac-history-item';
      itemDiv.setAttribute('role', 'listitem');

      const zodiacsHtml = item.zodiacs.map(zodiac => {
        return `<span class="zodiac-tag">${zodiac}</span>`;
      }).join(' ');

      itemDiv.innerHTML = `
        <div class="selected-zodiac-history-header">
          <div class="selected-zodiac-history-time">${new Date(item.timestamp).toLocaleString()}</div>
          <div class="selected-zodiac-history-actions">
            <button class="action-btn" onclick="Business.copySelectedZodiacHistoryItem(${index})"><i class="icon-copy"></i> 复制</button>
            <button class="action-btn danger" onclick="Business.deleteSelectedZodiacHistoryItem(${index})"><i class="icon-delete"></i> 删除</button>
          </div>
        </div>
        <div class="selected-zodiac-history-content">
          <div class="zodiac-tags">
            ${zodiacsHtml}
          </div>
          ${item.note ? `<div class="zodiac-note">备注: ${item.note}</div>` : ''}
        </div>
      `;

      fragment.appendChild(itemDiv);
    });

    historyList.innerHTML = '';
    historyList.appendChild(fragment);
  },

  goToSelectedZodiacHistoryPage: (page) => {
    try {
      console.log('[Prediction] 跳转到精选生肖历史页面:', page);
      
      const allRecords = Storage.get('zodiacRecords', []);
      const selectedRecords = allRecords.filter(r => r.recordType === 'selected');
      const pageSize = 10;
      const totalPages = Math.ceil(selectedRecords.length / pageSize);
      
      if (page < 1 || page > totalPages) {
        Toast.show('页码超出范围');
        return;
      }
      
      record.renderSelectedZodiacHistory(page);
      
      const container = document.getElementById('selectedZodiacHistoryList');
      if (container) {
        const pagination = container.querySelector('.pagination');
        if (pagination) {
          pagination.innerHTML = record._generatePagination(page, totalPages, 'selectedZodiacHistory');
        }
      }
      
      Toast.show(`已跳转到第 ${page} 页`);
    } catch (error) {
      console.error('[Prediction] 跳转精选生肖历史页面失败:', error);
      Toast.show('分页失败');
    }
  },

  deleteSelectedZodiacHistoryItem: (index) => {
    try {
      console.log('[Prediction] 删除精选生肖历史项:', index);
      
      const allRecords = Storage.get('zodiacRecords', []);
      const selectedRecords = allRecords.filter(r => r.recordType === 'selected');
      
      if (index < 0 || index >= selectedRecords.length) {
        Toast.show('删除失败：记录不存在');
        return;
      }
      
      const recordToDelete = selectedRecords[index];
      
      if (confirm(`确定删除 ${recordToDelete.period || '该'} 期的精选生肖记录吗？`)) {
        const recordIndex = allRecords.findIndex(r => 
          r.period === recordToDelete.period && 
          r.recordType === 'selected'
        );
        
        if (recordIndex > -1) {
          allRecords.splice(recordIndex, 1);
          Storage.set('zodiacRecords', allRecords);
          record.renderSelectedZodiacHistory();
          record.renderPredictionStatistics();
          Toast.show('删除成功');
          console.log('[Prediction] 精选生肖历史项已删除:', index);
        }
      }
    } catch (error) {
      console.error('[Prediction] 删除精选生肖历史项失败:', error);
      Toast.show('删除失败');
    }
  },

  copySelectedZodiacHistoryItem: (index) => {
    try {
      console.log('[Prediction] 复制精选生肖历史项:', index);
      
      const allRecords = Storage.get('zodiacRecords', []);
      const selectedRecords = allRecords.filter(r => r.recordType === 'selected');
      
      if (index < 0 || index >= selectedRecords.length) {
        Toast.show('复制失败：记录不存在');
        return;
      }
      
      const recordToCopy = selectedRecords[index];
      const textToCopy = `期号: ${recordToCopy.period || '未知'}\n精选生肖: ${recordToCopy.selected?.join(', ') || '无数据'}`;
      
      prediction.copyToClipboard(textToCopy).then(() => {
        Toast.show('已复制到剪贴板');
        console.log('[Prediction] 精选生肖历史已复制:', index);
      }).catch(err => {
        console.error('[Prediction] 复制失败:', err);
        Toast.show('复制失败');
      });
    } catch (error) {
      console.error('[Prediction] 复制精选生肖历史项失败:', error);
      Toast.show('复制失败');
    }
  },

  showSelectedZodiacDetail: (index) => {
    try {
      console.log('[Prediction] 显示精选生肖详情:', index);
      
      const allRecords = Storage.get('zodiacRecords', []);
      const selectedRecords = allRecords.filter(r => r.recordType === 'selected');
      
      if (index < 0 || index >= selectedRecords.length) {
        Toast.show('查看失败：记录不存在');
        return;
      }
      
      const record = selectedRecords[index];
      
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      
      const content = document.createElement('div');
      content.className = 'modal-content';
      content.style.maxWidth = '90%';
      content.style.width = '450px';
      
      const checkedStatus = record.checked ? (record.matched ? '✅ 已验证-命中' : '❌ 已验证-未中') : '⏳ 待验证';
      const checkedClass = record.checked ? (record.matched ? 'status-hit' : 'status-miss') : 'status-pending';
      
      content.innerHTML = `
        <div class="modal-header">
          <h3 class="modal-title">🌟 精选生肖详情</h3>
          <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body" style="padding: 20px;">
          <div style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span style="font-size: 14px; color: var(--sub-text);">期号</span>
              <span style="font-size: 16px; font-weight: 600;">${record.period || '未知'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span style="font-size: 14px; color: var(--sub-text);">验证状态</span>
              <span class="${checkedClass}" style="font-size: 14px; padding: 4px 12px; border-radius: 12px;">${checkedStatus}</span>
            </div>
          </div>
          
          <div style="margin-bottom: 16px;">
            <div style="font-size: 14px; color: var(--sub-text); margin-bottom: 8px;">精选生肖</div>
            <div style="background: var(--bg); padding: 12px; border-radius: 8px; display: flex; flex-wrap: wrap; gap: 8px;">
              ${(record.selected || []).map(zodiac => `
                <span style="background: var(--primary); color: white; padding: 6px 12px; border-radius: 16px; font-weight: 600;">${zodiac}</span>
              `).join('')}
            </div>
          </div>
          
          <div style="margin-bottom: 16px;">
            <div style="font-size: 14px; color: var(--sub-text); margin-bottom: 8px;">保存时间</div>
            <div style="font-size: 14px;">${record.savedAt ? new Date(record.savedAt).toLocaleString('zh-CN') : '未知'}</div>
          </div>
          
          <div style="display: flex; gap: 12px; margin-top: 20px;">
            <button onclick="prediction.copySelectedZodiacHistoryItem(${index}); this.closest('.modal-overlay').remove();" 
                    style="flex: 1; padding: 12px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;">
              复制生肖
            </button>
            <button onclick="if(confirm('确定删除这条记录吗？')){ prediction.deleteSelectedZodiacHistoryItem(${index}); this.closest('.modal-overlay').remove(); }" 
                    style="flex: 1; padding: 12px; background: var(--danger); color: white; border: none; border-radius: 8px; cursor: pointer;">
              删除
            </button>
          </div>
        </div>
      `;
      
      modal.appendChild(content);
      document.body.appendChild(modal);
      
      setTimeout(() => {
        modal.style.opacity = '1';
        content.style.transform = 'scale(1)';
      }, 10);
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.opacity = '0';
          content.style.transform = 'scale(0.9)';
          setTimeout(() => modal.remove(), 300);
        }
      });
    } catch (error) {
      console.error('[Prediction] 显示精选生肖详情失败:', error);
      Toast.show('显示详情失败');
    }
  },

  clearSelectedZodiacHistory: () => {
    try {
      console.log('[Prediction] 清空精选生肖历史...');
      
      const allRecords = Storage.get('zodiacRecords', []);
      const selectedRecords = allRecords.filter(r => r.recordType === 'selected');
      
      if (selectedRecords.length === 0) {
        Toast.show('暂无历史记录');
        return;
      }
      
      if (confirm('确定清空所有精选生肖历史吗？此操作不可恢复！')) {
        const filtered = allRecords.filter(r => r.recordType !== 'selected');
        Storage.set('zodiacRecords', filtered);
        record.renderSelectedZodiacHistory();
        record.renderPredictionStatistics();
        Toast.show('已清空精选生肖历史');
        console.log('[Prediction] 精选生肖历史已清空');
      }
    } catch (error) {
      console.error('[Prediction] 清空精选生肖历史失败:', error);
      Toast.show('清空失败');
    }
  },

  // 特码热门TOP5历史相关
  silentSaveHotNumbers: () => {
    // 这里需要完整的实现...
  },

  updateHotNumbersHistoryComparison: () => {
    try {
      console.log('[Prediction] 更新热门号码历史对比...');
      
      const hotRecords = Storage.get('hotNumbersRecords', []);
      
      if (hotRecords.length === 0) {
        Toast.show('暂无历史记录');
        return;
      }
      
      const lastRecord = hotRecords[0];
      
      Toast.show(`最近一期: ${lastRecord.period || '未知'} - ${lastRecord.top5?.map(h => h.number).join(', ') || '无数据'}`);
    } catch (error) {
      console.error('[Prediction] 更新热门号码历史对比失败:', error);
      Toast.show('更新失败');
    }
  },

  renderHotNumbersHistory: () => {
    const state = StateManager._state;
    const hotNumbersHistory = state.analysis.hotNumbersHistory || [];
    const historyList = document.getElementById('hotNumbersHistory');
    if (!historyList) return;

    if (hotNumbersHistory.length === 0) {
      historyList.innerHTML = '<div style="text-align:center; padding:40px; color:var(--sub-text);">暂无热门特码历史</div>';
      return;
    }

    const fragment = document.createDocumentFragment();

    hotNumbersHistory.forEach((item, index) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'hot-numbers-history-item';
      itemDiv.setAttribute('role', 'listitem');

      const hotNumbersHtml = item.hotNumbers.map((num, rank) => {
        const numStr = String(num).padStart(2, '0');
        return `<span class="hot-number rank-${rank + 1}">${numStr}</span>`;
      }).join(' ');

      itemDiv.innerHTML = `
        <div class="hot-numbers-history-header">
          <div class="hot-numbers-history-time">${new Date(item.timestamp).toLocaleString()}</div>
          <div class="hot-numbers-history-actions">
            <button class="action-btn" onclick="Business.copyHotNumbersHistory(${index})"><i class="icon-copy"></i> 复制</button>
            <button class="action-btn danger" onclick="Business.deleteHotNumbersHistoryItem(${index})"><i class="icon-delete"></i> 删除</button>
          </div>
        </div>
        <div class="hot-numbers-history-content">
          <div class="hot-numbers">
            ${hotNumbersHtml}
          </div>
          <div class="hot-numbers-info">
            <span>分析期数: ${item.analyzeLimit}</span>
          </div>
        </div>
      `;

      fragment.appendChild(itemDiv);
    });

    historyList.innerHTML = '';
    historyList.appendChild(fragment);
  },

  switchHotNumbersHistoryPage: (page) => {
    try {
      console.log('[Prediction] 切换热门号码历史页面:', page);
      
      const hotRecords = Storage.get('hotNumbersRecords', []);
      const pageSize = 10;
      const totalPages = Math.ceil(hotRecords.length / pageSize);
      
      if (page < 1 || page > totalPages) {
        Toast.show('页码超出范围');
        return;
      }
      
      record.renderHotNumbersHistory(page);
      
      const container = document.getElementById('hotNumbersHistoryList');
      if (container) {
        const pagination = container.querySelector('.pagination');
        if (pagination) {
          pagination.innerHTML = record._generatePagination(page, totalPages, 'hotNumbersHistory');
        }
      }
      
      Toast.show(`已切换到第 ${page} 页`);
    } catch (error) {
      console.error('[Prediction] 切换热门号码历史页面失败:', error);
      Toast.show('分页失败');
    }
  },

  goToHotNumbersHistoryPage: (page) => {
    try {
      console.log('[Prediction] 跳转到热门号码历史页面:', page);
      
      prediction.switchHotNumbersHistoryPage(page);
    } catch (error) {
      console.error('[Prediction] 跳转热门号码历史页面失败:', error);
      Toast.show('跳转失败');
    }
  },

  deleteHotNumbersHistory: (index) => {
    try {
      console.log('[Prediction] 删除热门号码历史项:', index);
      
      const hotRecords = Storage.get('hotNumbersRecords', []);
      
      if (index < 0 || index >= hotRecords.length) {
        Toast.show('删除失败：记录不存在');
        return;
      }
      
      const recordToDelete = hotRecords[index];
      
      if (confirm(`确定删除 ${recordToDelete.period || '该'} 期的热门号码记录吗？`)) {
        hotRecords.splice(index, 1);
        Storage.set('hotNumbersRecords', hotRecords);
        record.renderHotNumbersHistory();
        record.renderPredictionStatistics();
        Toast.show('删除成功');
        console.log('[Prediction] 热门号码历史项已删除:', index);
      }
    } catch (error) {
      console.error('[Prediction] 删除热门号码历史项失败:', error);
      Toast.show('删除失败');
    }
  },

  copyHotNumbersHistory: (index) => {
    try {
      console.log('[Prediction] 复制热门号码历史:', index);
      
      const hotRecords = Storage.get('hotNumbersRecords', []);
      
      if (index < 0 || index >= hotRecords.length) {
        Toast.show('复制失败：记录不存在');
        return;
      }
      
      const recordToCopy = hotRecords[index];
      const top5Numbers = recordToCopy.top5?.map(h => h.number).join(', ') || '无数据';
      
      const textToCopy = `期号: ${recordToCopy.period || '未知'}\nTOP5热门号码: ${top5Numbers}`;
      
      prediction.copyToClipboard(textToCopy).then(() => {
        Toast.show('已复制到剪贴板');
        console.log('[Prediction] 热门号码历史已复制:', index);
      }).catch(err => {
        console.error('[Prediction] 复制失败:', err);
        Toast.show('复制失败');
      });
    } catch (error) {
      console.error('[Prediction] 复制热门号码历史失败:', error);
      Toast.show('复制失败');
    }
  },

  showHotNumbersHistoryDetail: (index) => {
    try {
      console.log('[Prediction] 显示热门号码详情:', index);
      
      const hotRecords = Storage.get('hotNumbersRecords', []);
      
      if (index < 0 || index >= hotRecords.length) {
        Toast.show('查看失败：记录不存在');
        return;
      }
      
      const record = hotRecords[index];
      
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      
      const content = document.createElement('div');
      content.className = 'modal-content';
      content.style.maxWidth = '90%';
      content.style.width = '450px';
      
      const checkedStatus = record.checked ? (record.matched ? '✅ 已验证-命中' : '❌ 已验证-未中') : '⏳ 待验证';
      const checkedClass = record.checked ? (record.matched ? 'status-hit' : 'status-miss') : 'status-pending';
      
      content.innerHTML = `
        <div class="modal-header">
          <h3 class="modal-title">🏆 热门号码详情</h3>
          <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body" style="padding: 20px;">
          <div style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span style="font-size: 14px; color: var(--sub-text);">期号</span>
              <span style="font-size: 16px; font-weight: 600;">${record.period || '未知'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span style="font-size: 14px; color: var(--sub-text);">验证状态</span>
              <span class="${checkedClass}" style="font-size: 14px; padding: 4px 12px; border-radius: 12px;">${checkedStatus}</span>
            </div>
          </div>
          
          <div style="margin-bottom: 16px;">
            <div style="font-size: 14px; color: var(--sub-text); margin-bottom: 8px;">TOP5 热门号码</div>
            <div style="background: var(--bg); padding: 12px; border-radius: 8px;">
              ${(record.top5 || []).map((item, idx) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; ${idx < (record.top5?.length || 0) - 1 ? 'border-bottom: 1px solid var(--border);' : ''}">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="background: var(--primary); color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600;">${idx + 1}</span>
                    <span style="font-size: 16px; font-weight: 600;">${item.number}</span>
                  </div>
                  <span style="font-size: 12px; color: var(--sub-text);">出现 ${item.count || 0} 次</span>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div style="margin-bottom: 16px;">
            <div style="font-size: 14px; color: var(--sub-text); margin-bottom: 8px;">保存时间</div>
            <div style="font-size: 14px;">${record.savedAt ? new Date(record.savedAt).toLocaleString('zh-CN') : '未知'}</div>
          </div>
          
          <div style="display: flex; gap: 12px; margin-top: 20px;">
            <button onclick="prediction.copyHotNumbersHistory(${index}); this.closest('.modal-overlay').remove();" 
                    style="flex: 1; padding: 12px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;">
              复制号码
            </button>
            <button onclick="if(confirm('确定删除这条记录吗？')){ prediction.deleteHotNumbersHistory(${index}); this.closest('.modal-overlay').remove(); }" 
                    style="flex: 1; padding: 12px; background: var(--danger); color: white; border: none; border-radius: 8px; cursor: pointer;">
              删除
            </button>
          </div>
        </div>
      `;
      
      modal.appendChild(content);
      document.body.appendChild(modal);
      
      setTimeout(() => {
        modal.style.opacity = '1';
        content.style.transform = 'scale(1)';
      }, 10);
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.opacity = '0';
          content.style.transform = 'scale(0.9)';
          setTimeout(() => modal.remove(), 300);
        }
      });
    } catch (error) {
      console.error('[Prediction] 显示热门号码详情失败:', error);
      Toast.show('显示详情失败');
    }
  },

  deleteHotNumbersHistoryItem: (index) => {
    try {
      console.log('[Prediction] 删除热门号码历史项(快捷方式):', index);
      
      prediction.deleteHotNumbersHistory(index);
    } catch (error) {
      console.error('[Prediction] 删除热门号码历史项失败:', error);
      Toast.show('删除失败');
    }
  },

  clearHotNumbersHistory: () => {
    try {
      console.log('[Prediction] 清空热门号码历史...');
      
      const hotRecords = Storage.get('hotNumbersRecords', []);
      
      if (hotRecords.length === 0) {
        Toast.show('暂无历史记录');
        return;
      }
      
      if (confirm('确定清空所有热门号码历史吗？此操作不可恢复！')) {
        Storage.set('hotNumbersRecords', []);
        record.renderHotNumbersHistory();
        record.renderPredictionStatistics();
        Toast.show('已清空热门号码历史');
        console.log('[Prediction] 热门号码历史已清空');
      }
    } catch (error) {
      console.error('[Prediction] 清空热门号码历史失败:', error);
      Toast.show('清空失败');
    }
  },

  toggleHotNumbersHistory: () => {
    try {
      console.log('[Prediction] 切换热门号码历史展开状态...');
      record.toggleHotNumbersCollapse();
    } catch (error) {
      console.error('[Prediction] 切换热门号码历史展开状态失败:', error);
      Toast.show('操作失败');
    }
  },

  /**
   * 加载精选特码历史筛选状态
   */
  loadSpecialHistoryFilter: () => {
    // 这里需要完整的实现...
  },

  silentUpdateAllPredictionHistory: () => {
    // 这里需要完整的实现...
  },

  // 预测统计相关
  getPredictionStatistics: () => {
    try {
      console.log('[Prediction] 获取预测统计数据...');
      
      const allRecords = Storage.get('zodiacRecords', []);
      
      const zodiacStats = prediction._calculateCategoryStats(
        allRecords.filter(r => !r.recordType || r.recordType !== 'selected')
      );
      
      const selectedZodiacStats = prediction._calculateCategoryStats(
        allRecords.filter(r => r.recordType === 'selected')
      );
      
      const totalPredictions = zodiacStats.total + selectedZodiacStats.total;
      const totalHits = zodiacStats.hit + selectedZodiacStats.hit;
      const totalMiss = zodiacStats.miss + selectedZodiacStats.miss;
      const totalPending = zodiacStats.pending + selectedZodiacStats.pending;
      const totalHitRate = totalHits + totalMiss > 0 
        ? ((totalHits / (totalHits + totalMiss)) * 100).toFixed(1) 
        : '0.0';
      
      const statistics = {
        total: {
          predictions: totalPredictions,
          hits: totalHits,
          miss: totalMiss,
          pending: totalPending,
          hitRate: totalHitRate
        },
        zodiac: zodiacStats,
        selectedZodiac: selectedZodiacStats,
        mlPrediction: prediction.getMLPredictionStats(),
        special: prediction.getSpecialStats(),
        hotNumbers: prediction.getHotNumbersStats(),
        generatedAt: new Date().toISOString()
      };
      
      console.log('[Prediction] 统计数据获取成功:', statistics);
      return statistics;
    } catch (error) {
      console.error('[Prediction] 获取统计数据失败:', error);
      return null;
    }
  },

  _calculateCategoryStats: (records) => {
    let hit = 0, miss = 0, pending = 0;
    
    records.forEach(rec => {
      if (rec.checked === true) {
        if (rec.matched === true) hit++;
        else miss++;
      } else {
        pending++;
      }
    });
    
    const hitRate = (hit + miss) > 0 
      ? ((hit / (hit + miss)) * 100).toFixed(1) 
      : '0.0';
    
    return { 
      hit, 
      miss, 
      pending, 
      hitRate, 
      total: records.length 
    };
  },

  getMLPredictionStats: () => {
    try {
      const mlRecords = Storage.get('mlPredictionRecords', []);
      let hit = 0, miss = 0, pending = 0;
      
      mlRecords.forEach(rec => {
        if (rec.checked === true) {
          if (rec.matched === true) hit++;
          else miss++;
        } else {
          pending++;
        }
      });
      
      const hitRate = (hit + miss) > 0 
        ? ((hit / (hit + miss)) * 100).toFixed(1) 
        : '0.0';
      
      return { hit, miss, pending, hitRate, total: mlRecords.length };
    } catch (error) {
      console.error('[Prediction] 获取ML预测统计失败:', error);
      return { hit: 0, miss: 0, pending: 0, hitRate: '0.0', total: 0 };
    }
  },

  getSpecialStats: () => {
    try {
      const numberRecords = Storage.get(Storage.KEYS.NUMBER_RECORDS, []);
      let hit = 0, miss = 0, pending = 0;
      
      numberRecords.forEach(rec => {
        if (rec.checked === true) {
          if (rec.matched === true) hit++;
          else miss++;
        } else {
          pending++;
        }
      });
      
      const hitRate = (hit + miss) > 0 
        ? ((hit / (hit + miss)) * 100).toFixed(1) 
        : '0.0';
      
      return { hit, miss, pending, hitRate, total: numberRecords.length };
    } catch (error) {
      console.error('[Prediction] 获取精选特码统计失败:', error);
      return { hit: 0, miss: 0, pending: 0, hitRate: '0.0', total: 0 };
    }
  },

  getHotNumbersStats: () => {
    try {
      const hotRecords = Storage.get('hotNumbersRecords', []);
      let hit = 0, miss = 0, pending = 0;
      
      hotRecords.forEach(rec => {
        if (rec.checked === true) {
          if (rec.matched === true) hit++;
          else miss++;
        } else {
          pending++;
        }
      });
      
      const hitRate = (hit + miss) > 0 
        ? ((hit / (hit + miss)) * 100).toFixed(1) 
        : '0.0';
      
      return { hit, miss, pending, hitRate, total: hotRecords.length };
    } catch (error) {
      console.error('[Prediction] 获取热门号码统计失败:', error);
      return { hit: 0, miss: 0, pending: 0, hitRate: '0.0', total: 0 };
    }
  },

  renderPredictionStatistics: () => {
    try {
      console.log('[Prediction] 渲染预测统计...');
      
      const container = document.getElementById('predictionStatisticsBody');
      if (!container) {
        console.warn('[Prediction] 统计容器不存在: predictionStatisticsBody');
        return;
      }
      
      container.innerHTML = '<div class="loading-tip">加载中...</div>';
      
      const statistics = prediction.getPredictionStatistics();
      
      if (!statistics) {
        container.innerHTML = '<div class="error-tip">统计数据加载失败</div>';
        return;
      }
      
      const { total, zodiac, selectedZodiac } = statistics;
      
      container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
          <div style="background:var(--bg-secondary);border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:var(--primary)">${total.predictions}</div>
            <div style="font-size:12px;color:var(--sub-text);margin-top:4px">总预测数</div>
          </div>
          <div style="background:var(--bg-secondary);border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:var(--green)">${total.hits}</div>
            <div style="font-size:12px;color:var(--sub-text);margin-top:4px">命中数</div>
          </div>
          <div style="background:var(--bg-secondary);border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:var(--primary)">${total.hitRate}%</div>
            <div style="font-size:12px;color:var(--sub-text);margin-top:4px">命中率</div>
          </div>
          <div style="background:var(--bg-secondary);border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:var(--sub-text)">${total.pending}</div>
            <div style="font-size:12px;color:var(--sub-text);margin-top:4px">待开奖</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">
          <div style="background:var(--card);border-radius:12px;padding:16px;border:1px solid var(--border);cursor:pointer;transition:all 0.2s ease;" data-action="showDetailedStatistics" data-type="zodiac">
            <div class="card-header" style="padding:0;margin-bottom:12px;">
              <h2 style="font-size:16px;">生肖预测</h2>
              <div style="font-size:12px;color:var(--sub-text);margin-top:4px;">点击查看详情</div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:14px;color:var(--sub-text)">命中</span>
              <span style="font-size:16px;font-weight:600;color:var(--green)">${zodiac.hit}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:14px;color:var(--sub-text)">未中</span>
              <span style="font-size:16px;font-weight:600;color:var(--danger)">${zodiac.miss}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:14px;color:var(--sub-text)">待开奖</span>
              <span style="font-size:16px;font-weight:600;color:var(--sub-text)">${zodiac.pending}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
              <span style="font-size:14px;color:var(--sub-text)">命中率</span>
              <span style="font-size:16px;font-weight:600;color:var(--primary)">${zodiac.hitRate}%</span>
            </div>
          </div>
          <div style="background:var(--card);border-radius:12px;padding:16px;border:1px solid var(--border);cursor:pointer;transition:all 0.2s ease;" data-action="scrollToSelectedHistory">
            <div class="card-header" style="padding:0;margin-bottom:12px;">
              <h2 style="font-size:16px;">精选生肖</h2>
              <div style="font-size:12px;color:var(--sub-text);margin-top:4px;">点击查看历史</div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:14px;color:var(--sub-text)">命中</span>
              <span style="font-size:16px;font-weight:600;color:var(--green)">${selectedZodiac.hit}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:14px;color:var(--sub-text)">未中</span>
              <span style="font-size:16px;font-weight:600;color:var(--danger)">${selectedZodiac.miss}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:14px;color:var(--sub-text)">待开奖</span>
              <span style="font-size:16px;font-weight:600;color:var(--sub-text)">${selectedZodiac.pending}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
              <span style="font-size:14px;color:var(--sub-text)">命中率</span>
              <span style="font-size:16px;font-weight:600;color:var(--primary)">${selectedZodiac.hitRate}%</span>
            </div>
          </div>
        </div>
      `;
      
      console.log('[Prediction] 预测统计渲染完成');
    } catch (error) {
      console.error('[Prediction] 渲染预测统计失败:', error);
      const container = document.getElementById('predictionStatisticsBody');
      if (container) {
        container.innerHTML = '<div class="error-tip">渲染失败，请刷新重试</div>';
      }
    }
  },

  checkAndUpdatePredictionStatus: () => {
    try {
      console.log('[Prediction] 检查并更新预测状态...');
      
      const statistics = prediction.getPredictionStatistics();
      
      if (statistics && statistics.total.pending > 0) {
        console.log(`[Prediction] 待开奖记录: ${statistics.total.pending}条`);
      }
      
      return statistics;
    } catch (error) {
      console.error('[Prediction] 检查预测状态失败:', error);
      return null;
    }
  },

  showPredictionHistoryDetail: (index) => {
    try {
      console.log('[Prediction] 显示预测历史详情:', index);
      
      const statistics = prediction.getPredictionStatistics();
      
      if (!statistics) {
        Toast.show('统计数据加载失败');
        return;
      }
      
      prediction.showStatisticsDetailModal(statistics);
    } catch (error) {
      console.error('[Prediction] 显示预测历史详情失败:', error);
      Toast.show('显示详情失败');
    }
  },

  showStatisticsDetailModal: (statistics) => {
    try {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      
      const content = document.createElement('div');
      content.className = 'modal-content';
      content.style.maxWidth = '90%';
      content.style.width = '500px';
      
      content.innerHTML = `
        <div class="modal-header">
          <h3 class="modal-title">📊 预测统计详情</h3>
          <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body" style="padding: 20px;">
          <div style="margin-bottom: 24px;">
            <h4 style="margin-bottom: 12px; color: var(--text);">综合统计</h4>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
              <div style="background: var(--bg); padding: 12px; border-radius: 8px; text-align: center;">
                <div style="font-size: 20px; font-weight: 700; color: var(--primary);">${statistics.total.predictions}</div>
                <div style="font-size: 12px; color: var(--sub-text);">总预测数</div>
              </div>
              <div style="background: var(--bg); padding: 12px; border-radius: 8px; text-align: center;">
                <div style="font-size: 20px; font-weight: 700; color: var(--green);">${statistics.total.hits}</div>
                <div style="font-size: 12px; color: var(--sub-text);">命中数</div>
              </div>
              <div style="background: var(--bg); padding: 12px; border-radius: 8px; text-align: center;">
                <div style="font-size: 20px; font-weight: 700; color: var(--danger);">${statistics.total.miss}</div>
                <div style="font-size: 12px; color: var(--sub-text);">未中数</div>
              </div>
              <div style="background: var(--bg); padding: 12px; border-radius: 8px; text-align: center;">
                <div style="font-size: 20px; font-weight: 700; color: var(--primary);">${statistics.total.hitRate}%</div>
                <div style="font-size: 12px; color: var(--sub-text);">命中率</div>
              </div>
            </div>
          </div>
          
          <div style="margin-bottom: 24px;">
            <h4 style="margin-bottom: 12px; color: var(--text);">分类统计</h4>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: var(--bg);">
                  <th style="padding: 10px; text-align: left; border-bottom: 1px solid var(--border);">类型</th>
                  <th style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border);">总数</th>
                  <th style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border);">命中</th>
                  <th style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border);">未中</th>
                  <th style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border);">待开奖</th>
                  <th style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border);">命中率</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid var(--border);">生肖预测</td>
                  <td style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border);">${statistics.zodiac.total}</td>
                  <td style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border); color: var(--green);">${statistics.zodiac.hit}</td>
                  <td style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border); color: var(--danger);">${statistics.zodiac.miss}</td>
                  <td style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border);">${statistics.zodiac.pending}</td>
                  <td style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border);">${statistics.zodiac.hitRate}%</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid var(--border);">精选生肖</td>
                  <td style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border);">${statistics.selectedZodiac.total}</td>
                  <td style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border); color: var(--green);">${statistics.selectedZodiac.hit}</td>
                  <td style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border); color: var(--danger);">${statistics.selectedZodiac.miss}</td>
                  <td style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border);">${statistics.selectedZodiac.pending}</td>
                  <td style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border);">${statistics.selectedZodiac.hitRate}%</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid var(--border);">精选特码</td>
                  <td style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border);">${statistics.special.total}</td>
                  <td style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border); color: var(--green);">${statistics.special.hit}</td>
                  <td style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border); color: var(--danger);">${statistics.special.miss}</td>
                  <td style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border);">${statistics.special.pending}</td>
                  <td style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border);">${statistics.special.hitRate}%</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid var(--border);">热门TOP5</td>
                  <td style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border);">${statistics.hotNumbers.total}</td>
                  <td style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border); color: var(--green);">${statistics.hotNumbers.hit}</td>
                  <td style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border); color: var(--danger);">${statistics.hotNumbers.miss}</td>
                  <td style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border);">${statistics.hotNumbers.pending}</td>
                  <td style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border);">${statistics.hotNumbers.hitRate}%</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div style="text-align: center; color: var(--sub-text); font-size: 12px;">
            数据生成时间: ${new Date(statistics.generatedAt).toLocaleString('zh-CN')}
          </div>
        </div>
      `;
      
      modal.appendChild(content);
      document.body.appendChild(modal);
      
      setTimeout(() => {
        modal.style.opacity = '1';
        content.style.transform = 'scale(1)';
      }, 10);
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.opacity = '0';
          content.style.transform = 'scale(0.9)';
          setTimeout(() => modal.remove(), 300);
        }
      });
    } catch (error) {
      console.error('[Prediction] 显示统计详情弹窗失败:', error);
      Toast.show('显示详情失败');
    }
  },

  /**
   * 后台静默保存精选特码组合
   */
  silentSaveAllSpecialCombinations: () => {
    try {
      // 这里可以添加保存精选特码组合的逻辑
      // 例如：将当前选中的特码保存到历史记录
      console.log('后台静默保存精选特码组合');
    } catch(e) {
      console.error('后台静默保存精选特码失败:', e);
    }
  },



  /**
   * 后台静默保存特码热门TOP5
   */
  silentSaveHotNumbers: () => {
    try {
      // ✅ 特码热门TOP5已在 analysis-render.js 的 updateHotConclusion 中自动保存
      // 此函数保留作为兼容接口，实际无需额外操作
      console.log('特码热门TOP5已自动保存（使用下一期期号）');
    } catch(e) {
      console.error('后台静默保存特码热门TOP5失败:', e);
    }
  },

  /**
   * 获取每期的生肖前6名数据
   * @returns {Array} 前6名生肖数组
   */
  getTop6Zodiacs: () => {
    try {
      // 分析10期、20期、30期的数据
      const periods = [10, 20, 30];
      const zodiacScores = {};
      
      periods.forEach(period => {
        const periodData = analysisCalc.calcZodiacAnalysis(period);
        if(periodData && periodData.zodiacScores) {
          Object.entries(periodData.zodiacScores).forEach(([zod, score]) => {
            if (!zodiacScores[zod]) {
              zodiacScores[zod] = 0;
            }
            zodiacScores[zod] += score;
          });
        }
      });
      
      // 按总分排序，取前6名
      const sortedZodiacs = Object.entries(zodiacScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([zod]) => zod);
      
      return sortedZodiacs;
    } catch (error) {
      console.error('获取生肖前6名失败:', error);
      return [];
    }
  },

  /**
   * 获取当前期号
   * @returns {string} 当前期号
   */
  getCurrentIssue: () => {
    try {
      // 从DOM中获取期号
      const conclusionTitle = document.querySelector('.conclusion-title');
      if (conclusionTitle) {
        const titleText = conclusionTitle.textContent || conclusionTitle.innerText;
        const issueMatch = titleText.match(/第(\d+)期/);
        if (issueMatch && issueMatch[1]) {
          return issueMatch[1];
        }
      }
      
      // 如果从DOM中获取失败，尝试从IssueManager获取
      try {
        const nextIssue = IssueManager.getNextIssue();
        if (nextIssue && nextIssue.full) {
          return nextIssue.full;
        }
      } catch (issueError) {
        console.error('从IssueManager获取期号失败:', issueError);
      }
      
      return '';
    } catch (error) {
      console.error('获取期号失败:', error);
      return '';
    }
  },

  /**
   * 根据指定期数获取前6名生肖
   * @param {number} period - 期数
   * @returns {Array} 前6名生肖数组
   */
  getTopZodiacsByPeriod: (period) => {
    try {
      const periodData = analysisCalc.calcZodiacAnalysis(period);
      if(periodData && periodData.sortedZodiacs) {
        return periodData.sortedZodiacs.slice(0, 6).map(([zod]) => zod);
      }
      return [];
    } catch (error) {
      console.error(`获取${period}期生肖前6名失败:`, error);
      return [];
    }
  }
};
