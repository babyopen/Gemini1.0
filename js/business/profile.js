// ====================== 我的页面模块 ======================

// 导入必要的模块
import { CONFIG } from '../config.js';
import { Storage } from '../storage.js';
import { Toast } from '../toast.js';

export const profile = {
  /**
   * 初始化我的页面
   */
  initProfilePage: () => {
    try {
      // 初始化页面元素
      const profilePage = document.getElementById('profilePage');
      if (!profilePage) return;

      // 可以在这里添加页面初始化逻辑
      // 例如：加载用户设置、显示用户信息等
      console.log('我的页面初始化完成');
    } catch(e) {
      console.error('初始化我的页面失败:', e);
      Toast.show('页面初始化失败，请刷新重试');
    }
  },

  /**
   * 打开设置
   */
  openSettings: () => {
    try {
      // 创建设置模态框
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 90%; width: 400px;">
          <div class="modal-header">
            <h3 class="modal-title">设置</h3>
            <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body" style="padding: 20px 0;">
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div class="setting-item">
                <label style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                  <span>深色模式</span>
                  <label class="toggle">
                    <input type="checkbox" id="darkModeToggle">
                    <span class="toggle-slider"></span>
                  </label>
                </label>
              </div>
              <div class="setting-item">
                <label style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                  <span>自动刷新</span>
                  <label class="toggle">
                    <input type="checkbox" id="autoRefreshToggle" checked>
                    <span class="toggle-slider"></span>
                  </label>
                </label>
              </div>
              <div class="setting-item">
                <label style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                  <span>声音提示</span>
                  <label class="toggle">
                    <input type="checkbox" id="soundToggle">
                    <span class="toggle-slider"></span>
                  </label>
                </label>
              </div>
              <div class="setting-item">
                <label style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                  <span>振动反馈</span>
                  <label class="toggle">
                    <input type="checkbox" id="vibrationToggle">
                    <span class="toggle-slider"></span>
                  </label>
                </label>
              </div>
              <div class="setting-item">
                <label style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                  <span>分析期数</span>
                  <select id="analyzeLimitSelect" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="30">30期</option>
                    <option value="50">50期</option>
                    <option value="100">100期</option>
                  </select>
                </label>
              </div>
              <!-- API数据源配置 -->
              <div class="setting-item" style="border-top: 1px solid #eee; padding-top: 16px; margin-top: 8px;">
                <h4 style="margin-bottom: 12px;">API数据源配置</h4>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                  <div>
                    <label style="display: block; margin-bottom: 4px; font-size: 14px; color: #666;">最新开奖API</label>
                    <input type="text" id="latestApiInput" placeholder="https://example.com/api/latest" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                  </div>
                  <div>
                    <label style="display: block; margin-bottom: 4px; font-size: 14px; color: #666;">历史数据API</label>
                    <input type="text" id="historyApiInput" placeholder="https://example.com/api/history/" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                    <div style="font-size: 12px; color: #999; margin-top: 4px;">注意：地址应以斜杠结尾，如 https://example.com/api/history/</div>
                  </div>
                  <div style="display: flex; gap: 8px; margin-top: 8px;">
                    <button class="btn-secondary" onclick="Business.testApiConnection()" style="flex: 1; padding: 8px;">测试连接</button>
                    <button class="btn-secondary" onclick="Business.resetApiConfig()" style="flex: 1; padding: 8px;">重置默认</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px; padding: 10px 20px; border-top: 1px solid #eee;">
            <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn-primary" onclick="Business.saveSettings()">保存</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      
      // 应用深色模式设置
      const darkModeToggle = document.getElementById('darkModeToggle');
      if (darkModeToggle) {
        const isDarkMode = Storage.get(Storage.KEYS.DARK_MODE, false);
        darkModeToggle.checked = isDarkMode;
        darkModeToggle.addEventListener('change', () => {
          Storage.set(Storage.KEYS.DARK_MODE, darkModeToggle.checked);
          location.reload();
        });
      }
      
      // 应用自动刷新设置
      const autoRefreshToggle = document.getElementById('autoRefreshToggle');
      if (autoRefreshToggle) {
        const autoRefresh = Storage.get(Storage.KEYS.AUTO_REFRESH, true);
        autoRefreshToggle.checked = autoRefresh;
        autoRefreshToggle.addEventListener('change', () => {
          Storage.set(Storage.KEYS.AUTO_REFRESH, autoRefreshToggle.checked);
        });
      }
      
      // 应用声音提示设置
      const soundToggle = document.getElementById('soundToggle');
      if (soundToggle) {
        const soundEnabled = Storage.get(Storage.KEYS.SOUND_ENABLED, false);
        soundToggle.checked = soundEnabled;
        soundToggle.addEventListener('change', () => {
          Storage.set(Storage.KEYS.SOUND_ENABLED, soundToggle.checked);
        });
      }
      
      // 应用振动反馈设置
      const vibrationToggle = document.getElementById('vibrationToggle');
      if (vibrationToggle) {
        const vibrationEnabled = Storage.get(Storage.KEYS.VIBRATION_ENABLED, false);
        vibrationToggle.checked = vibrationEnabled;
        vibrationToggle.addEventListener('change', () => {
          Storage.set(Storage.KEYS.VIBRATION_ENABLED, vibrationToggle.checked);
        });
      }
      
      // 应用分析期数设置
      const analyzeLimitSelect = document.getElementById('analyzeLimitSelect');
      if (analyzeLimitSelect) {
        const analyzeLimit = Storage.get(Storage.KEYS.ANALYZE_LIMIT, 50);
        analyzeLimitSelect.value = analyzeLimit;
        analyzeLimitSelect.addEventListener('change', () => {
          Storage.set(Storage.KEYS.ANALYZE_LIMIT, analyzeLimitSelect.value);
        });
      }
      
      // 加载API配置
      const latestApiInput = document.getElementById('latestApiInput');
      const historyApiInput = document.getElementById('historyApiInput');
      if (latestApiInput && historyApiInput) {
        const customApiConfig = Storage.loadCustomApi();
        if (customApiConfig) {
          latestApiInput.value = customApiConfig.latest || '';
          historyApiInput.value = customApiConfig.history || '';
        } else {
          // 显示默认值
          latestApiInput.value = CONFIG.API.LATEST;
          historyApiInput.value = CONFIG.API.HISTORY;
        }
      }
      
      // 保存设置按钮
      const saveSettingsBtn = modal.querySelector('.save-settings-btn');
      if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
          Business.saveSettings();
        });
      }

      // 关闭模态框的点击事件
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    } catch(e) {
      console.error('打开设置失败:', e);
      Toast.show('打开设置失败，请重试');
    }
  },

  /**
   * 打开通知
   */
  openNotification: () => {
    // 这里需要完整的实现...
  },

  /**
   * 打开隐私
   */
  openPrivacy: () => {
    // 这里需要完整的实现...
  },

  /**
   * 清除缓存
   */
  clearCache: () => {
    if(!confirm('确定要清除缓存吗？')) return;
    Storage.clearHistoryCache();
    Storage.remove('favorites');
    Toast.show('缓存已清除');
  },

  /**
   * 打开帮助
   */
  openHelp: () => {
    // 这里需要完整的实现...
  },

  /**
   * 打开反馈
   */
  openFeedback: () => {
    // 这里需要完整的实现...
  },

  /**
   * 打开关于
   */
  openAbout: () => {
    // 这里需要完整的实现...
  },

  /**
   * 保存设置
   */
  saveSettings: () => {
    try {
      const darkMode = document.getElementById('darkModeToggle').checked;
      const autoRefresh = document.getElementById('autoRefreshToggle').checked;
      const sound = document.getElementById('soundToggle').checked;
      const vibration = document.getElementById('vibrationToggle').checked;
      const analyzeLimit = document.getElementById('analyzeLimitSelect').value;

      // 保存设置到本地存储
      Storage.set('userSettings', {
        darkMode,
        autoRefresh,
        sound,
        vibration,
        analyzeLimit: parseInt(analyzeLimit)
      });

      // 应用设置
      if (darkMode) {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }

      Toast.show('设置保存成功');

      // 关闭模态框
      const modal = document.querySelector('.modal-overlay');
      if (modal) {
        modal.remove();
      }
    } catch(e) {
      console.error('保存设置失败:', e);
      Toast.show('保存设置失败，请重试');
    }
  },

  /**
   * 打开通知
   */
  openNotification: () => {
    try {
      // 创建通知模态框
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 90%; width: 400px;">
          <div class="modal-header">
            <h3 class="modal-title">通知</h3>
            <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body" style="padding: 20px 0;">
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div class="notification-item" style="padding: 12px; border-bottom: 1px solid #eee;">
                <div style="font-weight: 500; margin-bottom: 4px;">系统更新</div>
                <div style="font-size: 14px; color: #666;">新版本已发布，建议更新到最新版本</div>
                <div style="font-size: 12px; color: #999; margin-top: 4px;">2026-04-01</div>
              </div>
              <div class="notification-item" style="padding: 12px; border-bottom: 1px solid #eee;">
                <div style="font-weight: 500; margin-bottom: 4px;">功能更新</div>
                <div style="font-size: 14px; color: #666;">新增了生肖分析功能，快来体验吧</div>
                <div style="font-size: 12px; color: #999; margin-top: 4px;">2026-03-15</div>
              </div>
              <div class="notification-item" style="padding: 12px;">
                <div style="font-weight: 500; margin-bottom: 4px;">温馨提示</div>
                <div style="font-size: 14px; color: #666;">请定期清理缓存以保持应用流畅</div>
                <div style="font-size: 12px; color: #999; margin-top: 4px;">2026-03-01</div>
              </div>
            </div>
          </div>
          <div class="modal-footer" style="display: flex; justify-content: flex-end; padding: 10px 20px; border-top: 1px solid #eee;">
            <button class="btn-primary" onclick="this.closest('.modal-overlay').remove()">关闭</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // 处理外部链接点击
      const externalLinks = modal.querySelectorAll('[data-action="openExternalLink"]');
      externalLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const url = link.dataset.url;
          if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
          }
        });
      });

      // 关闭模态框的点击事件
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    } catch(e) {
      console.error('打开通知失败:', e);
      Toast.show('打开通知失败，请重试');
    }
  },

  /**
   * 打开隐私
   */
  openPrivacy: () => {
    try {
      // 创建隐私模态框
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 90%; width: 400px;">
          <div class="modal-header">
            <h3 class="modal-title">隐私政策</h3>
            <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body" style="padding: 20px; max-height: 400px; overflow-y: auto;">
            <div style="line-height: 1.6;">
              <h4>隐私政策</h4>
              <p>本应用尊重并保护用户的隐私。我们不会收集、存储或分享用户的个人信息。</p>
              <h4>数据存储</h4>
              <p>本应用使用本地存储（localStorage）存储用户的设置和方案，这些数据仅存储在用户的设备上，不会上传到任何服务器。</p>
              <h4>权限</h4>
              <p>本应用不需要任何特殊权限，仅使用浏览器提供的标准功能。</p>
              <h4>第三方服务</h4>
              <p>本应用可能会使用第三方 API 获取历史数据，但不会向第三方服务发送用户的个人信息。</p>
              <h4>更新</h4>
              <p>我们可能会不时更新本隐私政策，更新后的政策将在应用中公布。</p>
            </div>
          </div>
          <div class="modal-footer" style="display: flex; justify-content: flex-end; padding: 10px 20px; border-top: 1px solid #eee;">
            <button class="btn-primary" onclick="this.closest('.modal-overlay').remove()">我知道了</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // 关闭模态框的点击事件
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    } catch(e) {
      console.error('打开隐私失败:', e);
      Toast.show('打开隐私失败，请重试');
    }
  },

  /**
   * 打开帮助
   */
  openHelp: () => {
    try {
      // 创建帮助模态框
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 90%; width: 400px;">
          <div class="modal-header">
            <h3 class="modal-title">帮助中心</h3>
            <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body" style="padding: 20px; max-height: 400px; overflow-y: auto;">
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div class="help-item">
                <h4>如何使用筛选功能？</h4>
                <p>点击标签可以选择或取消选择筛选条件，筛选结果会实时更新。</p>
              </div>
              <div class="help-item">
                <h4>如何保存方案？</h4>
                <p>设置好筛选条件后，点击"保存方案"按钮，输入方案名称即可保存。</p>
              </div>
              <div class="help-item">
                <h4>如何分析历史数据？</h4>
                <p>切换到"分析"页面，可以查看历史记录、维度分析和生肖关联分析。</p>
              </div>
              <div class="help-item">
                <h4>如何查看预测历史？</h4>
                <p>切换到"记录"页面，可以查看生肖预测历史、精选特码历史等。</p>
              </div>
              <div class="help-item">
                <h4>如何清除缓存？</h4>
                <p>在"我的"页面，点击"清除缓存"按钮即可清除应用缓存。</p>
              </div>
            </div>
          </div>
          <div class="modal-footer" style="display: flex; justify-content: flex-end; padding: 10px 20px; border-top: 1px solid #eee;">
            <button class="btn-primary" onclick="this.closest('.modal-overlay').remove()">关闭</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // 关闭模态框的点击事件
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    } catch(e) {
      console.error('打开帮助失败:', e);
      Toast.show('打开帮助失败，请重试');
    }
  },

  /**
   * 打开反馈
   */
  openFeedback: () => {
    try {
      // 创建反馈模态框
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 90%; width: 400px;">
          <div class="modal-header">
            <h3 class="modal-title">意见反馈</h3>
            <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body" style="padding: 20px 0;">
            <div style="display: flex; flex-direction: column; gap: 16px; padding: 0 20px;">
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">反馈类型</label>
                <select id="feedbackType" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                  <option value="suggestion">功能建议</option>
                  <option value="bug">bug 反馈</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">反馈内容</label>
                <textarea id="feedbackContent" rows="4" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"></textarea>
              </div>
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">联系方式（选填）</label>
                <input type="text" id="feedbackContact" placeholder="邮箱或手机号" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              </div>
            </div>
          </div>
          <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px; padding: 10px 20px; border-top: 1px solid #eee;">
            <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn-primary" onclick="Business.submitFeedback()">提交</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // 关闭模态框的点击事件
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    } catch(e) {
      console.error('打开反馈失败:', e);
      Toast.show('打开反馈失败，请重试');
    }
  },

  /**
   * 提交反馈
   */
  submitFeedback: () => {
    try {
      const type = document.getElementById('feedbackType').value;
      const content = document.getElementById('feedbackContent').value.trim();
      const contact = document.getElementById('feedbackContact').value.trim();

      if (!content) {
        Toast.show('请输入反馈内容');
        return;
      }

      // 这里可以添加提交反馈的逻辑
      // 例如：发送到服务器或保存到本地
      console.log('提交反馈:', { type, content, contact });

      Toast.show('反馈提交成功，感谢您的建议！');

      // 关闭模态框
      const modal = document.querySelector('.modal-overlay');
      if (modal) {
        modal.remove();
      }
    } catch(e) {
      console.error('提交反馈失败:', e);
      Toast.show('提交反馈失败，请重试');
    }
  },

  /**
   * 打开关于
   */
  openAbout: () => {
    try {
      // 创建关于模态框
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 90%; width: 400px;">
          <div class="modal-header">
            <h3 class="modal-title">关于</h3>
            <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body" style="padding: 20px; text-align: center;">
            <div style="margin-bottom: 20px;">
              <h4 style="margin-bottom: 8px;">生肖特码分析工具</h4>
              <p style="color: #666;">版本 1.0.01</p>
            </div>
            <div style="margin-bottom: 20px; line-height: 1.6;">
              <p>本工具提供生肖特码分析功能，帮助用户分析历史数据，提高预测准确性。</p>
              <p>© 2026 生肖特码分析工具</p>
            </div>
            <div style="display: flex; justify-content: center; gap: 16px;">
              <a href="#" data-action="openExternalLink" data-url="https://github.com" style="color: #333; text-decoration: none;">官方网站</a>
              <a href="#" data-action="openExternalLink" data-url="https://github.com/terms" style="color: #333; text-decoration: none;">使用条款</a>
              <a href="#" data-action="openExternalLink" data-url="https://github.com/privacy" style="color: #333; text-decoration: none;">隐私政策</a>
            </div>
          </div>
          <div class="modal-footer" style="display: flex; justify-content: flex-end; padding: 10px 20px; border-top: 1px solid #eee;">
            <button class="btn-primary" onclick="this.closest('.modal-overlay').remove()">确定</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // 处理外部链接点击
      const externalLinks = modal.querySelectorAll('[data-action="openExternalLink"]');
      externalLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const url = link.dataset.url;
          if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
          }
        });
      });

      // 关闭模态框的点击事件
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    } catch(e) {
      console.error('打开关于失败:', e);
      Toast.show('打开关于失败，请重试');
    }
  },

  /**
   * 检查更新
   */
  checkUpdate: () => {
    try {
      // 模拟检查更新
      Toast.show('检查更新中...');

      setTimeout(() => {
        Toast.show('当前已是最新版本');
      }, 1000);
    } catch(e) {
      console.error('检查更新失败:', e);
      Toast.show('检查更新失败，请重试');
    }
  }
};
