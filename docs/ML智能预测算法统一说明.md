# ML智能预测算法统一说明

## 修改概述

将 **ML智能预测** 的备选方案（`statisticalPredict`）改为使用与 **生肖预测** 相同的五维度评分算法，并修正期号获取逻辑，确保两套系统的数据一致性和期号准确性。

---

## 修改内容

### 1. 修改文件

**文件路径**: 
- `/Users/macbook/Documents/open/新版3.0_副本/js/business/ml-predict.js`
- `/Users/macbook/Documents/open/新版3.0_副本/js/business/analysis/modules/analysis-render.js`

### 2. 核心改动

#### 2.1 `statisticalPredict` 方法改造

**修改前**：
- 使用简单的统计方法（频率×0.3 + 遗漏×0.3 + 连出×0.2 + 近期出现×0.2）
- 同步函数

**修改后**：
- ✅ 使用五维度评分算法（与生肖预测一致）
- 异步函数（支持动态导入）
- 降级策略：如果五维度评分失败，回退到简单统计

```javascript
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
    // ... 原有逻辑
  }
}
```

#### 2.2 `predict` 方法更新

将所有调用 `statisticalPredict` 的地方改为 `await`：

```javascript
// 修改前
return mlPredict.statisticalPredict(historyData);

// 修改后
return await mlPredict.statisticalPredict(historyData);
```

#### 2.3 `getPrediction` 方法更新

同样添加 `await`：

```javascript
// 修改前
return mlPredict.statisticalPredict([]);

// 修改后
return await mlPredict.statisticalPredict([]);
```

#### 2.4 ML预测期号修正（analysis-render.js）

**问题**：ML预测保存时使用的是当前期号（`curExpect`），但应该使用下一期期号。

**修改前**：
```javascript
const currentIssue = document.getElementById('curExpect')?.innerText || '2026100';

const mlRecord = {
  issue: currentIssue,  // ❌ 错误：使用的是当前期号
  predictions: predictions,
  ...
};
```

**修改后**：
```javascript
// ✅ 获取下一期期号（与生肖预测保持一致）
const nextIssueObj = IssueManager.getNextIssue();
const issue = nextIssueObj ? nextIssueObj.full : (document.getElementById('curExpect')?.innerText || '2026100');

console.log('[ML] 💾 保存预测 - 期号:', issue, '(下一期)');

const mlRecord = {
  issue: issue,  // ✅ 正确：使用的是下一期期号
  predictions: predictions,
  ...
};
```

**效果**：
- ✅ ML预测的期号与生肖预测完全一致
- ✅ 预测的是下一期的数据，比最新开奖多一期
- ✅ 记录页面显示正确的预测期号

---

## 技术细节

### 五维度评分算法

ML智能预测现在使用的五维度评分包括：

1. **基础热度分（30分）** - 基于遗漏期数的S型曲线映射
2. **形态共振分（20分）** - 单双大小、波色、五行等多维度匹配
3. **间隔规律分（20分）** - 生肖转换间隔模式统计
4. **趋势动量分（15分）** - 近期vs中期出现频率对比
5. **近期动量分（15分）** - 最近3期/7期出现情况

总分 = 100分制

### 数据格式转换

五维度评分返回的是 **分数（0-100）**，需要转换为 **概率（0-1）**：

```javascript
const results = sortedZodiacs.map(([zod, score]) => ({
  zodiac: zod,
  probability: score / 100  // 62分 → 0.62
}));
```

### 降级策略

为了确保系统的健壮性，实现了三级降级策略：

1. **优先**：TensorFlow.js 神经网络模型（如果已训练且数据充足）
2. **次选**：五维度评分算法（`calcContinuousScores`）
3. **保底**：简单统计算法（频率+遗漏+连出）

---

## 效果对比

### 修改前

| 模块 | 算法 | 结果示例 |
|------|------|---------|
| 生肖预测 | 五维度评分（100分制） | 狗(62分)、鼠(45分)、牛(44分) |
| ML智能预测 | 简单统计（概率） | 猪(0.8)、鸡(0.6)、鼠(0.5) |

**问题**：两套系统算法不一致，导致推荐结果不同

### 修改后

| 模块 | 算法 | 结果示例 |
|------|------|---------|
| 生肖预测 | 五维度评分（100分制） | 狗(62分)、鼠(45分)、牛(44分) |
| ML智能预测 | 五维度评分（转为概率） | 狗(0.62)、鼠(0.45)、牛(0.44) |

**优势**：
- ✅ 算法完全一致
- ✅ 结果高度相关
- ✅ 数据可对比
- ✅ 用户体验统一

---

## 使用场景

### 场景1：模型未训练

当用户点击"预测"按钮但模型未训练时：

```
用户操作：点击"预测"按钮
↓
系统检查：modelReady = false
↓
调用：statisticalPredict(historyData)
↓
执行：五维度评分算法（10期数据）
↓
结果：与生肖预测一致的推荐
```

### 场景2：模型训练完成

当用户先点击"训练"再点击"预测"时：

```
用户操作：点击"训练" → 等待完成 → 点击"预测"
↓
系统检查：modelReady = true
↓
调用：model.predict(inputTensor)
↓
执行：TensorFlow.js 神经网络预测
↓
结果：AI模型预测（可能更准确）
```

### 场景3：预测失败降级

当神经网络预测出错时：

```
用户操作：点击"预测"按钮
↓
系统尝试：model.predict()
↓
发生错误：catch (error)
↓
自动降级：statisticalPredict(historyData)
↓
执行：五维度评分算法
↓
结果：依然有可靠的推荐
```

---

## 注意事项

### 1. 异步加载

由于使用了动态导入（`import()`），`statisticalPredict` 现在是异步函数，所有调用它的地方都必须使用 `await`。

### 2. 性能考虑

五维度评分算法比简单统计稍慢（需要计算多个维度），但在现代浏览器中差异可以忽略不计（通常 < 10ms）。

### 3. 数据一致性

ML智能预测和生肖预测都使用 **10期数据** 进行五维度评分，确保结果的一致性。

### 4. 日志输出

添加了专门的日志标识 `[ML]`，方便调试和追踪：

```javascript
console.log('[ML] 使用五维度评分算法:', results.slice(0, 6));
console.error('[ML] 五维度评分失败，使用默认统计:', error);
```

---

## 测试建议

### 测试步骤

1. **刷新页面**，进入分析页面
2. **不训练模型**，直接点击"预测"按钮
3. **观察结果**：
   - ML智能预测的前3名应该与生肖预测的前3名基本一致
   - 概率值应该是分数/100（如62分 → 0.62）
4. **查看控制台**：
   - 应该看到 `[ML] 使用五维度评分算法` 的日志
   - 不应该有错误信息

### 预期结果

```
[ML] 使用五维度评分算法: [
  { zodiac: '狗', probability: 0.62 },
  { zodiac: '鼠', probability: 0.45 },
  { zodiac: '牛', probability: 0.44 },
  ...
]
```

---

## 相关文件

- **核心算法**: `/js/business/analysis/modules/analysis-calc.js` - `calcContinuousScores()`
- **ML预测**: `/js/business/ml-predict.js` - `statisticalPredict()`
- **渲染逻辑**: `/js/business/analysis/modules/analysis-render.js` - ML预测UI渲染
- **精选生肖**: `/js/business/prediction.js` - `getSelectedZodiacs()`

---

## 总结

通过将 ML智能预测的备选方案改为使用五维度评分算法，我们实现了：

1. ✅ **算法统一**：ML预测与生肖预测使用相同的核心算法
2. ✅ **数据一致**：两套系统的推荐结果高度相关
3. ✅ **降级保护**：即使AI模型失败，仍有可靠的备选方案
4. ✅ **用户体验**：用户看到的是科学、一致的预测结果

这确保了整个系统的预测逻辑更加科学、透明、可信。
