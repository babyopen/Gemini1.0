// ====================== ML 神经网络预测模块 ======================
import { Storage } from '../storage.js';
import { StateManager } from '../state-manager.js';
import { DataQuery } from '../data-query.js';
import { Toast } from '../toast.js';

const ZODIACS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

export const mlPredict = {
  model: null,
  isTraining: false,
  modelReady: false,

  /**
   * 初始化 ML 预测模块
   */
  init: async () => {
    console.log('ML预测模块初始化...');
    try {
      if (typeof tf === 'undefined') {
        console.error('TensorFlow.js 未加载');
        return;
      }
      await mlPredict.buildModel();
      console.log('ML预测模块初始化完成');
    } catch (error) {
      console.error('ML预测模块初始化失败:', error);
    }
  },

  /**
   * 从历史数据中提取特征
   * @param {Array} historyData - 历史开奖数据
   * @returns {Object} 特征数据
   */
  extractFeatures: (historyData) => {
    if (!historyData || historyData.length === 0) {
      return mlPredict.getDefaultFeatures();
    }

    const features = {
      zodiacFrequency: {},
      zodiacMiss: {},
      zodiacStreak: {},
      zodiacPairs: {},
      recentZodiacs: []
    };

    ZODIACS.forEach(z => {
      features.zodiacFrequency[z] = 0;
      features.zodiacMiss[z] = 0;
      features.zodiacStreak[z] = 0;
    });

    let currentMiss = {};
    ZODIACS.forEach(z => currentMiss[z] = 0);
    let currentStreak = {};
    ZODIACS.forEach(z => currentStreak[z] = 0);

    historyData.forEach((record, index) => {
      const openCode = record.openCode || record.code || '';
      const codeArr = openCode.split(',').map(n => parseInt(n.trim()));
      const zodiacs = codeArr.map(n => DataQuery._getZodiacByNum(n)).filter(Boolean);

      zodiacs.forEach(z => {
        if (features.zodiacFrequency[z] !== undefined) {
          features.zodiacFrequency[z]++;
          currentMiss[z] = 0;
          currentStreak[z]++;
          if (currentStreak[z] > features.zodiacStreak[z]) {
            features.zodiacStreak[z] = currentStreak[z];
          }
        }
      });

      ZODIACS.forEach(z => {
        if (!zodiacs.includes(z)) {
          currentMiss[z]++;
          if (currentMiss[z] > features.zodiacMiss[z]) {
            features.zodiacMiss[z] = currentMiss[z];
          }
          currentStreak[z] = 0;
        }
      });

      if (index < 10) {
        features.recentZodiacs = [...new Set([...features.recentZodiacs, ...zodiacs])];
      }
    });

    return features;
  },

  /**
   * 获取默认特征（当无历史数据时）
   */
  getDefaultFeatures: () => {
    const features = {
      zodiacFrequency: {},
      zodiacMiss: {},
      zodiacStreak: {},
      zodiacPairs: {},
      recentZodiacs: []
    };
    ZODIACS.forEach(z => {
      features.zodiacFrequency[z] = 0;
      features.zodiacMiss[z] = 0;
      features.zodiacStreak[z] = 0;
    });
    return features;
  },

  /**
   * 将特征转换为模型输入向量
   * @param {Object} features - 特征数据
   * @returns {Array} 输入向量
   */
  featuresToInput: (features) => {
    const input = [];
    const maxFreq = Math.max(...Object.values(features.zodiacFrequency), 1);
    const maxMiss = Math.max(...Object.values(features.zodiacMiss), 1);
    const maxStreak = Math.max(...Object.values(features.zodiacStreak), 1);

    ZODIACS.forEach(z => {
      input.push(features.zodiacFrequency[z] / maxFreq);
      input.push(features.zodiacMiss[z] / maxMiss);
      input.push(features.zodiacStreak[z] / maxStreak);
    });

    ZODIACS.forEach(z => {
      input.push(features.recentZodiacs.includes(z) ? 1 : 0);
    });

    return input;
  },

  /**
   * 构建神经网络模型
   */
  buildModel: async () => {
    mlPredict.model = tf.sequential();
    
    mlPredict.model.add(tf.layers.dense({
      units: 64,
      activation: 'relu',
      inputShape: [48]
    }));
    
    mlPredict.model.add(tf.layers.dropout({ rate: 0.2 }));
    
    mlPredict.model.add(tf.layers.dense({
      units: 32,
      activation: 'relu'
    }));
    
    mlPredict.model.add(tf.layers.dense({
      units: 12,
      activation: 'softmax'
    }));

    mlPredict.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    console.log('ML模型构建完成');
    mlPredict.modelReady = true;
  },

  /**
   * 准备训练数据
   */
  prepareTrainingData: (historyData) => {
    const sequences = [];
    const labels = [];

    for (let i = 10; i < historyData.length; i++) {
      const pastData = historyData.slice(i - 10, i);
      const currentData = historyData[i];

      const features = mlPredict.extractFeatures(pastData);
      const input = mlPredict.featuresToInput(features);

      const openCode = currentData.openCode || currentData.code || '';
      const codeArr = openCode.split(',').map(n => parseInt(n.trim()));
      const currentZodiacs = [...new Set(codeArr.map(n => DataQuery._getZodiacByNum(n)).filter(Boolean))];

      const label = new Array(12).fill(0);
      currentZodiacs.forEach(z => {
        const idx = ZODIACS.indexOf(z);
        if (idx >= 0) label[idx] = 1;
      });

      sequences.push(input);
      labels.push(label);
    }

    return {
      xs: tf.tensor2d(sequences),
      ys: tf.tensor2d(labels)
    };
  },

  /**
   * 训练模型
   * @param {Array} historyData - 历史数据
   */
  train: async (historyData) => {
    if (mlPredict.isTraining) {
      console.log('模型正在训练中...');
      return;
    }

    if (!historyData || historyData.length < 20) {
      console.log('历史数据不足，无法训练');
      return;
    }

    mlPredict.isTraining = true;
    Toast.show('ML模型训练中...');

    try {
      const { xs, ys } = mlPredict.prepareTrainingData(historyData);
      
      await mlPredict.model.fit(xs, ys, {
        epochs: 50,
        batchSize: 16,
        validationSplit: 0.2,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              console.log(`Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.acc.toFixed(4)}`);
            }
          }
        }
      });

      xs.dispose();
      ys.dispose();

      mlPredict.modelReady = true;
      Toast.show('ML模型训练完成');
      console.log('ML模型训练完成');
    } catch (error) {
      console.error('模型训练失败:', error);
      Toast.show('ML模型训练失败');
    } finally {
      mlPredict.isTraining = false;
    }
  },

  /**
   * 使用 ML 模型预测
   * @param {Array} historyData - 历史数据
   * @returns {Array} 预测的生肖（按概率排序）
   */
  predict: async (historyData) => {
    if (!mlPredict.modelReady || !historyData || historyData.length < 10) {
      console.log('模型未就绪或数据不足，使用统计预测');
      return await mlPredict.statisticalPredict(historyData);
    }

    try {
      const features = mlPredict.extractFeatures(historyData.slice(-10));
      const input = mlPredict.featuresToInput(features);
      const inputTensor = tf.tensor2d([input]);

      const prediction = mlPredict.model.predict(inputTensor);
      const probabilities = await prediction.data();

      inputTensor.dispose();
      prediction.dispose();

      const results = ZODIACS.map((zodiac, index) => ({
        zodiac,
        probability: probabilities[index]
      }));

      results.sort((a, b) => b.probability - a.probability);

      console.log('ML预测结果:', results.slice(0, 6));
      return results.slice(0, 6);
    } catch (error) {
      console.error('ML预测失败:', error);
      return await mlPredict.statisticalPredict(historyData);
    }
  },

  /**
   * 统计预测（备选方案）- 使用五维度评分算法
   * @param {Array} historyData - 历史数据
   * @returns {Array} 预测的生肖
   */
  statisticalPredict: async (historyData) => {
    if (!historyData || historyData.length === 0) {
      return ZODIACS.slice(0, 6).map(z => ({ zodiac: z, probability: 0.5 }));
    }

    try {
      // ✅ 动态导入 analysisCalc 模块
      const { analysisCalc } = await import('./analysis/modules/analysis-calc.js');
      
      // 使用10期数据进行五维度评分
      const periodData = analysisCalc.calcZodiacAnalysis(10);
      
      if (!periodData || !periodData.sortedZodiacs) {
        // 如果分析失败，返回默认结果
        return ZODIACS.slice(0, 6).map(z => ({ zodiac: z, probability: 0.5 }));
      }
      
      // ✅ 使用五维度评分算法（与生肖预测一致）
      const continuous = analysisCalc.calcContinuousScores(periodData);
      const sortedZodiacs = Object.entries(continuous.scores).sort((a, b) => b[1] - a[1]);
      
      // 转换为概率格式（分数/100）
      const results = sortedZodiacs.map(([zod, score]) => ({
        zodiac: zod,
        probability: score / 100
      }));
      
      console.log('[ML] 使用五维度评分算法:', results.slice(0, 6));
      return results.slice(0, 6);
    } catch (error) {
      console.error('[ML] 五维度评分失败，使用默认统计:', error);
      // 降级到简单统计
      const features = mlPredict.extractFeatures(historyData);
      const results = ZODIACS.map(zodiac => {
        const frequency = features.zodiacFrequency[zodiac] || 0;
        const miss = features.zodiacMiss[zodiac] || 0;
        const streak = features.zodiacStreak[zodiac] || 0;
        
        let score = frequency * 0.3 + miss * 0.3 + streak * 0.2;
        if (features.recentZodiacs.includes(zodiac)) {
          score += 0.2;
        }

        return { zodiac, probability: score };
      });

      results.sort((a, b) => b.probability - a.probability);
      return results.slice(0, 6);
    }
  },

  /**
   * 加载历史数据并训练模型
   */
  loadAndTrain: async () => {
    try {
      const historyData = Storage.get('historyCache', []);
      if (historyData.length > 0) {
        await mlPredict.train(historyData);
      }
    } catch (error) {
      console.error('加载历史数据失败:', error);
    }
  },

  /**
   * 获取预测结果（主入口）
   * @returns {Promise<Array>} 预测的生肖列表
   */
  getPrediction: async () => {
    try {
      const historyData = Storage.get('historyCache', []);
      return await mlPredict.predict(historyData);
    } catch (error) {
      console.error('获取预测失败:', error);
      return await mlPredict.statisticalPredict([]);
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  mlPredict.init();
});
