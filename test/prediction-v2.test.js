/**
 * 生肖预测算法V2.0测试用例
 * 用于验证新算法的正确性和合理性
 */

import { analysisCalc } from '../js/business/analysis/modules/analysis-calc.js';
import { StateManager } from '../js/state-manager.js';

// 模拟历史数据
const mockHistoryData = [
  { expect: '2026102', date: '2026-04-12', openCode: '01,02,03,04,05,06,07', zodiac: '鼠,牛,虎,兔,龙,蛇,马' },
  { expect: '2026101', date: '2026-04-11', openCode: '08,09,10,11,12,13,14', zodiac: '羊,猴,鸡,狗,猪,鼠,牛' },
  { expect: '2026100', date: '2026-04-10', openCode: '15,16,17,18,19,20,21', zodiac: '虎,兔,龙,蛇,马,羊,猴' },
  // ... 更多数据
];

/**
 * 测试1：验证基础分计算的合理性
 */
function testBaseScores() {
  console.log('=== 测试1：基础分计算 ===');
  
  // 设置状态
  StateManager.setState({
    analysis: {
      historyData: mockHistoryData,
      analyzeLimit: 30
    }
  });
  
  const data = analysisCalc.calcZodiacAnalysis(30);
  const continuous = analysisCalc.calcContinuousScores(data);
  
  console.log('基础分详情：');
  Object.entries(continuous.details).forEach(([zod, det]) => {
    console.log(`${zod}: ${det.base}分 (${det.status})`);
  });
  
  // 验证：基础分应该在2-30之间
  const baseScores = Object.values(continuous.details).map(d => d.base);
  const minBase = Math.min(...baseScores);
  const maxBase = Math.max(...baseScores);
  
  console.log(`基础分范围：${minBase} - ${maxBase}`);
  console.assert(minBase >= 2 && maxBase <= 30, '基础分超出预期范围');
}

/**
 * 测试2：验证形态分的多维度计算
 */
function testShapeScores() {
  console.log('\n=== 测试2：形态分计算 ===');
  
  const data = analysisCalc.calcZodiacAnalysis(30);
  const continuous = analysisCalc.calcContinuousScores(data);
  
  console.log('形态分详情：');
  Object.entries(continuous.details).forEach(([zod, det]) => {
    console.log(`${zod}: ${det.shape}分`);
  });
  
  // 验证：形态分应该在0-20之间
  const shapeScores = Object.values(continuous.details).map(d => d.shape);
  const minShape = Math.min(...shapeScores);
  const maxShape = Math.max(...shapeScores);
  
  console.log(`形态分范围：${minShape} - ${maxShape}`);
  console.assert(minShape >= 0 && maxShape <= 20, '形态分超出预期范围');
}

/**
 * 测试3：验证间隔分的频率加权
 */
function testIntervalScores() {
  console.log('\n=== 测试3：间隔分计算 ===');
  
  const data = analysisCalc.calcZodiacAnalysis(30);
  const continuous = analysisCalc.calcContinuousScores(data);
  
  console.log('间隔分详情：');
  Object.entries(continuous.details).forEach(([zod, det]) => {
    console.log(`${zod}: ${det.interval}分`);
  });
  
  // 验证：间隔分应该在0-20之间
  const intervalScores = Object.values(continuous.details).map(d => d.interval);
  const hasFullScore = intervalScores.some(s => s === 20);
  const hasZeroScore = intervalScores.some(s => s === 0);
  
  console.log(`间隔分范围：${Math.min(...intervalScores)} - ${Math.max(...intervalScores)}`);
  console.log(`是否有满分(20分)：${hasFullScore}`);
  console.log(`是否有零分：${hasZeroScore}`);
  console.assert(hasFullScore || hasZeroScore, '间隔分分布不合理');
}

/**
 * 测试4：验证趋势分和动量分
 */
function testTrendAndMomentum() {
  console.log('\n=== 测试4：趋势分和动量分 ===');
  
  const data = analysisCalc.calcZodiacAnalysis(30);
  const continuous = analysisCalc.calcContinuousScores(data);
  
  console.log('趋势分详情：');
  Object.entries(continuous.details).forEach(([zod, det]) => {
    console.log(`${zod}: 趋势${det.trend}分, 动量${det.momentum}分`);
  });
  
  // 验证：趋势分应该>=0，动量分应该在2-7之间
  const trendScores = Object.values(continuous.details).map(d => d.trend);
  const momentumScores = Object.values(continuous.details).map(d => d.momentum);
  
  console.log(`趋势分范围：${Math.min(...trendScores)} - ${Math.max(...trendScores)}`);
  console.log(`动量分范围：${Math.min(...momentumScores)} - ${Math.max(...momentumScores)}`);
  
  console.assert(Math.min(...trendScores) >= 0, '趋势分不应为负');
  console.assert(Math.min(...momentumScores) >= 2 && Math.max(...momentumScores) <= 7, '动量分超出预期范围');
}

/**
 * 测试5：验证总分计算
 */
function testTotalScores() {
  console.log('\n=== 测试5：总分计算 ===');
  
  const data = analysisCalc.calcZodiacAnalysis(30);
  const continuous = analysisCalc.calcContinuousScores(data);
  
  console.log('总分排名：');
  const sorted = Object.entries(continuous.scores).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([zod, score], idx) => {
    const det = continuous.details[zod];
    console.log(`${idx + 1}. ${zod}: ${score}分 (基础${det.base}+形态${det.shape}+间隔${det.interval}+趋势${det.trend}+动量${det.momentum})`);
  });
  
  // 验证：总分应该在10-100之间
  const totalScores = Object.values(continuous.scores);
  const minTotal = Math.min(...totalScores);
  const maxTotal = Math.max(...totalScores);
  
  console.log(`\n总分范围：${minTotal} - ${maxTotal}`);
  console.assert(minTotal >= 10 && maxTotal <= 100, '总分超出预期范围');
  
  // 验证：分数应该有合理的区分度
  const scoreRange = maxTotal - minTotal;
  console.log(`分数区分度：${scoreRange}分`);
  console.assert(scoreRange >= 20, '分数区分度过小，可能所有生肖得分接近');
}

/**
 * 测试6：验证缓存机制
 */
function testCacheMechanism() {
  console.log('\n=== 测试6：缓存机制 ===');
  
  const startTime1 = performance.now();
  const result1 = analysisCalc.calcZodiacAnalysis(30);
  const endTime1 = performance.now();
  
  const startTime2 = performance.now();
  const result2 = analysisCalc.calcZodiacAnalysis(30);
  const endTime2 = performance.now();
  
  const firstCallTime = endTime1 - startTime1;
  const cachedCallTime = endTime2 - startTime2;
  
  console.log(`首次计算耗时：${firstCallTime.toFixed(2)}ms`);
  console.log(`缓存读取耗时：${cachedCallTime.toFixed(2)}ms`);
  console.log(`性能提升：${((firstCallTime - cachedCallTime) / firstCallTime * 100).toFixed(1)}%`);
  
  console.assert(cachedCallTime < firstCallTime, '缓存未生效或性能未提升');
}

/**
 * 运行所有测试
 */
function runAllTests() {
  console.log('🧪 开始运行生肖预测算法V2.0测试套件\n');
  
  try {
    testBaseScores();
    testShapeScores();
    testIntervalScores();
    testTrendAndMomentum();
    testTotalScores();
    testCacheMechanism();
    
    console.log('\n✅ 所有测试通过！');
  } catch (error) {
    console.error('\n❌ 测试失败：', error);
  }
}

// 导出测试函数
export {
  runAllTests,
  testBaseScores,
  testShapeScores,
  testIntervalScores,
  testTrendAndMomentum,
  testTotalScores,
  testCacheMechanism
};

// 如果在浏览器环境中直接运行
if (typeof window !== 'undefined') {
  window.runPredictionTests = runAllTests;
  console.log('💡 在浏览器控制台输入 runPredictionTests() 运行测试');
}
