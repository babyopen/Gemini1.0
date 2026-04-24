// 测试工具函数

// 测试结果对象
const TestResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// 测试断言函数
function assert(condition, message) {
  if (condition) {
    TestResults.passed++;
    TestResults.tests.push({ status: 'PASS', message });
    console.log(`✅ PASS: ${message}`);
  } else {
    TestResults.failed++;
    TestResults.tests.push({ status: 'FAIL', message });
    console.error(`❌ FAIL: ${message}`);
  }
}

// 测试描述函数
function describe(description, testFn) {
  console.log(`\n📋 ${description}`);
  testFn();
}

// 测试用例函数
function it(description, testFn) {
  console.log(`\n  ${description}`);
  try {
    testFn();
  } catch (error) {
    TestResults.failed++;
    TestResults.tests.push({ status: 'ERROR', message: description, error: error.message });
    console.error(`❌ ERROR: ${description} - ${error.message}`);
  }
}

// 测试完成函数
function testDone() {
  console.log('\n====================================');
  console.log('测试结果');
  console.log('====================================');
  console.log(`通过: ${TestResults.passed}`);
  console.log(`失败: ${TestResults.failed}`);
  console.log(`总计: ${TestResults.passed + TestResults.failed}`);
  console.log('====================================');
  
  if (TestResults.failed === 0) {
    console.log('🎉 所有测试通过！');
  } else {
    console.log('⚠️  有测试失败，需要修复。');
  }
}

// 导出测试工具
window.TestUtils = {
  assert,
  describe,
  it,
  testDone,
  results: TestResults
};
