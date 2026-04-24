// 测试 utils.js 中的工具函数

// 加载测试工具
import './test-utils.js';

// 模拟 CONFIG 对象
const CONFIG = {
  NUMBER_GROUPS: ['head', 'tail', 'sum', 'bs', 'hot', 'sumOdd', 'sumBig', 'tailBig']
};

// 模拟 Utils 对象
import { Utils } from '../js/utils.js';

// 测试节流函数
describe('Utils.throttle', () => {
  it('应该限制函数的执行频率', () => {
    let count = 0;
    const fn = () => count++;
    const throttledFn = Utils.throttle(fn, 100);
    
    throttledFn();
    throttledFn();
    throttledFn();
    
    assert(count === 1, '函数应该只执行一次');
  });
});

// 测试防抖函数
describe('Utils.debounce', () => {
  it('应该在延迟后执行函数', (done) => {
    let count = 0;
    const fn = () => count++;
    const debouncedFn = Utils.debounce(fn, 100);
    
    debouncedFn();
    debouncedFn();
    debouncedFn();
    
    setTimeout(() => {
      assert(count === 1, '函数应该只执行一次');
      done();
    }, 150);
  });
});

// 测试深拷贝函数
describe('Utils.deepClone', () => {
  it('应该正确深拷贝对象', () => {
    const obj = { a: 1, b: { c: 2 } };
    const clonedObj = Utils.deepClone(obj);
    
    assert(clonedObj !== obj, '克隆对象应该与原对象不同');
    assert(clonedObj.a === obj.a, '克隆对象的属性应该与原对象相同');
    assert(clonedObj.b !== obj.b, '克隆对象的嵌套对象应该与原对象不同');
    assert(clonedObj.b.c === obj.b.c, '克隆对象的嵌套属性应该与原对象相同');
  });
  
  it('应该正确处理原始类型', () => {
    const num = 42;
    const clonedNum = Utils.deepClone(num);
    assert(clonedNum === num, '原始类型应该直接返回');
    
    const str = 'test';
    const clonedStr = Utils.deepClone(str);
    assert(clonedStr === str, '字符串应该直接返回');
    
    const bool = true;
    const clonedBool = Utils.deepClone(bool);
    assert(clonedBool === bool, '布尔值应该直接返回');
  });
});

// 测试标签值类型转换函数
describe('Utils.formatTagValue', () => {
  it('应该将数字组的字符串值转换为数字', () => {
    assert(Utils.formatTagValue('1', 'head') === 1, 'head 组的字符串应该转换为数字');
    assert(Utils.formatTagValue('2', 'tail') === 2, 'tail 组的字符串应该转换为数字');
  });
  
  it('应该保持非数字组的值不变', () => {
    assert(Utils.formatTagValue('鼠', 'zodiac') === '鼠', 'zodiac 组的值应该保持不变');
    assert(Utils.formatTagValue('红', 'color') === '红', 'color 组的值应该保持不变');
  });
});

// 测试安全区顶部高度函数
describe('Utils.getSafeTop', () => {
  it('应该返回有效的安全区高度', () => {
    const safeTop = Utils.getSafeTop();
    assert(typeof safeTop === 'number', '安全区高度应该是数字');
    assert(safeTop >= 0, '安全区高度应该大于等于0');
  });
});

// 测试筛选方案格式校验函数
describe('Utils.validateFilterItem', () => {
  it('应该验证有效的筛选方案', () => {
    const validItem = {
      name: '测试方案',
      selected: { zodiac: ['鼠'] },
      excluded: [1, 2, 3]
    };
    assert(Utils.validateFilterItem(validItem) === true, '有效的筛选方案应该返回 true');
  });
  
  it('应该验证无效的筛选方案', () => {
    const invalidItem1 = null;
    assert(Utils.validateFilterItem(invalidItem1) === false, 'null 应该返回 false');
    
    const invalidItem2 = { name: '测试方案' };
    assert(Utils.validateFilterItem(invalidItem2) === false, '缺少 selected 和 excluded 的方案应该返回 false');
  });
});

// 测试 HTML 转义函数
describe('Utils.escapeHtml', () => {
  it('应该正确转义 HTML 特殊字符', () => {
    const html = '<script>alert("XSS")</script>';
    const escapedHtml = Utils.escapeHtml(html);
    assert(escapedHtml !== html, 'HTML 应该被转义');
    assert(escapedHtml.includes('&lt;script&gt;'), 'script 标签应该被转义');
  });
  
  it('应该处理非字符串输入', () => {
    const num = 42;
    assert(Utils.escapeHtml(num) === num, '非字符串应该直接返回');
    
    const obj = { a: 1 };
    assert(Utils.escapeHtml(obj) === obj, '对象应该直接返回');
  });
});

// 测试生成分页 HTML 函数
describe('Utils.renderPagination', () => {
  it('应该生成分页 HTML', () => {
    const html = Utils.renderPagination(2, 5, 100, 'switchPage');
    assert(typeof html === 'string', '返回值应该是字符串');
    assert(html.includes('上一页'), '应该包含上一页按钮');
    assert(html.includes('下一页'), '应该包含下一页按钮');
    assert(html.includes('第 2 / 5 页'), '应该显示当前页码和总页数');
  });
  
  it('应该在只有一页时返回空字符串', () => {
    const html = Utils.renderPagination(1, 1, 10, 'switchPage');
    assert(html === '', '只有一页时应该返回空字符串');
  });
});

// 运行测试
testDone();
