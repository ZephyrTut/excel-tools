import { describe, it, expect } from 'vitest';
import {
  normalizeHeaderName,
  textValue,
} from '../services/split/excelReader.js';

describe('normalizeHeaderName', () => {
  it('应移除所有空白字符', () => {
    expect(normalizeHeaderName('可 用 结 存')).toBe('可用结存');
  });

  it('应 trim 首尾空白', () => {
    expect(normalizeHeaderName('  序号  ')).toBe('序号');
  });

  it('空字符串返回空字符串', () => {
    expect(normalizeHeaderName('')).toBe('');
  });
});

describe('textValue', () => {
  it('null 返回空字符串', () => {
    expect(textValue(null)).toBe('');
  });

  it('undefined 返回空字符串', () => {
    expect(textValue(undefined)).toBe('');
  });

  it('字符串原样返回', () => {
    expect(textValue('供应商')).toBe('供应商');
  });

  it('数字转字符串', () => {
    const result = textValue(42);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('{ text } 对象提取 text', () => {
    expect(textValue({ text: 'hello' })).toBe('hello');
  });

  it('{ result } 对象递归提取 result', () => {
    expect(textValue({ result: 'world' })).toBe('world');
  });

  it('{ richText } 拼接所有片段', () => {
    expect(textValue({ richText: [{ text: 'A' }, { text: 'B' }] })).toBe('AB');
  });

  it('{ error } 转为字符串', () => {
    expect(textValue({ error: '#REF!' })).toBe('#REF!');
  });
});
