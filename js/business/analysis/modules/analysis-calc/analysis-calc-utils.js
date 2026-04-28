// ====================== 分析计算工具模块 ======================

import { CONFIG } from '../../../../config.js';

// 缓存
const _colorCache = new Map();
const _elementCache = new Map();

/**
 * 获取号码对应的颜色信息（带缓存）
 * @param {number} number - 号码
 * @returns {Object} { cls: 颜色类名, name: 颜色名称 }
 */
export function getColor(number) {
  if (_colorCache.has(number)) return _colorCache.get(number);
  const color = Object.keys(CONFIG.COLOR_MAP).find(c => CONFIG.COLOR_MAP[c].includes(number));
  const result = color 
    ? { cls: { '红': 'red', '蓝': 'blue', '绿': 'green' }[color] || 'red', name: color || '红' } 
    : { cls: 'red', name: '红' };
  _colorCache.set(number, result);
  return result;
}

/**
 * 获取号码对应的五行（带缓存）
 * @param {number} number - 号码
 * @returns {string} 五行名称
 */
export function getElement(number) {
  if (_elementCache.has(number)) return _elementCache.get(number);
  const element = Object.keys(CONFIG.ELEMENT_MAP).find(e => CONFIG.ELEMENT_MAP[e].includes(number));
  _elementCache.set(number, element || '金');
  return element || '金';
}

/**
 * 获取热门条目
 * @param {Object} obj - 统计对象
 * @param {number} count - 获取数量
 * @returns {Array} 排序后的条目
 */
export function getTopEntry(obj, count = 1) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, count);
}

/**
 * 生肖对应的号码列表
 */
export const ZODIAC_NUMBERS = {
  '鼠': [10, 22, 34, 46],
  '牛': [9, 21, 33, 45],
  '虎': [8, 20, 32, 44],
  '兔': [7, 19, 31, 43],
  '龙': [6, 18, 30, 42],
  '蛇': [5, 17, 29, 41],
  '马': [4, 16, 28, 40],
  '羊': [3, 15, 27, 39],
  '猴': [2, 14, 26, 38],
  '鸡': [1, 13, 25, 37, 49],
  '狗': [12, 24, 36, 48],
  '猪': [11, 23, 35, 47]
};

/**
 * 生肖五行映射
 */
export const ZODIAC_ELEMENT = {
  '鼠': '水', '牛': '土', '虎': '木', '兔': '木',
  '龙': '土', '蛇': '火', '马': '火', '羊': '土',
  '猴': '金', '鸡': '金', '狗': '土', '猪': '水'
};

/**
 * 五行相生关系
 */
export const ELEMENT_GENERATE = {
  '金': ['水'],
  '水': ['木'],
  '木': ['火'],
  '火': ['土'],
  '土': ['金']
};

/**
 * 五行相克关系
 */
export const ELEMENT_OVERCOME = {
  '金': ['木'],
  '木': ['土'],
  '土': ['水'],
  '水': ['火'],
  '火': ['金']
};

/**
 * 尾数对应生肖映射
 */
export const TAIL_TO_ZODIAC = {
  0: ['鼠', '猪'], 1: ['牛', '狗'], 2: ['虎', '鸡'], 3: ['兔', '猴'],
  4: ['龙', '羊'], 5: ['蛇', '马'], 6: ['马', '蛇'], 7: ['羊', '龙'],
  8: ['猴', '兔'], 9: ['鸡', '虎']
};

/**
 * 生肖顺序
 */
export const ZODIAC_ORDER = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

/**
 * 获取指定生肖对应的号码列表
 * @param {string} zodiac - 生肖名称
 * @returns {Array} 号码数组
 */
export function getZodiacNumbers(zodiac) {
  return ZODIAC_NUMBERS[zodiac] || [];
}

export default {
  getColor,
  getElement,
  getTopEntry,
  ZODIAC_NUMBERS,
  ZODIAC_ELEMENT,
  ELEMENT_GENERATE,
  ELEMENT_OVERCOME,
  TAIL_TO_ZODIAC,
  ZODIAC_ORDER,
  getZodiacNumbers
};
