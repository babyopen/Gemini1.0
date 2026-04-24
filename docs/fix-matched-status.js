/**
 * 修复历史记录中错误的 matched 状态
 * 在浏览器控制台中运行此脚本
 * 
 * 使用方法：
 * 1. 打开浏览器开发者工具 (F12 或 Cmd+Option+I)
 * 2. 切换到 Console 标签
 * 3. 复制粘贴下面的代码并回车执行
 */

console.log('🔧 开始修复历史记录核对状态...\n');

// 修复精选特码历史
function fixSpecialRecords() {
  const records = JSON.parse(localStorage.getItem('numberRecords') || '[]');
  let fixedCount = 0;
  
  records.forEach((rec, index) => {
    if (rec.checked && rec.actualNumbers && Array.isArray(rec.actualNumbers) && rec.actualNumbers.length > 0) {
      // 提取特码（最后一个号码）
      const specialNumber = rec.actualNumbers[rec.actualNumbers.length - 1];
      // 重新计算是否命中：特码是否在预测号码中
      const correctMatched = Array.isArray(rec.numbers) && rec.numbers.includes(specialNumber);
      
      // 如果状态不一致，修复它
      if (rec.matched !== correctMatched) {
        console.log(`📝 修复第${rec.issue}期: 原状态=${rec.matched ? '命中' : '未中'}, 正确状态=${correctMatched ? '命中' : '未中'}`);
        records[index].matched = correctMatched;
        fixedCount++;
      }
    }
  });
  
  localStorage.setItem('numberRecords', JSON.stringify(records));
  console.log(`✅ 精选特码历史修复完成：共修复 ${fixedCount} 条记录\n`);
}

// 修复特码热门TOP5历史
function fixHotNumbersRecords() {
  const records = JSON.parse(localStorage.getItem('hotNumbersRecords') || '[]');
  let fixedCount = 0;
  
  records.forEach((rec, index) => {
    if (rec.checked && rec.actualNumbers && Array.isArray(rec.actualNumbers) && rec.actualNumbers.length > 0) {
      // 提取特码（最后一个号码）
      const specialNumber = rec.actualNumbers[rec.actualNumbers.length - 1];
      // 重新计算是否命中：特码是否在预测号码中
      const correctMatched = Array.isArray(rec.numbers) && rec.numbers.includes(specialNumber);
      
      // 如果状态不一致，修复它
      if (rec.matched !== correctMatched) {
        console.log(`📝 修复第${rec.issue}期 TOP5: 原状态=${rec.matched ? '命中' : '未中'}, 正确状态=${correctMatched ? '命中' : '未中'}`);
        records[index].matched = correctMatched;
        fixedCount++;
      }
    }
  });
  
  localStorage.setItem('hotNumbersRecords', JSON.stringify(records));
  console.log(`✅ 特码热门TOP5历史修复完成：共修复 ${fixedCount} 条记录\n`);
}

// 执行修复
try {
  fixSpecialRecords();
  fixHotNumbersRecords();
  console.log('🎉 所有修复完成！请刷新页面查看效果。');
} catch (error) {
  console.error('❌ 修复失败:', error);
}
