import { describe, it, expect } from 'vitest';
import {
  colLetterToNumber,
  normalizeHeaderName,
} from '../services/merge/mergeTypes.js';

describe('colLetterToNumber', () => {
  it('C → 3', () => {
    expect(colLetterToNumber('C')).toBe(3);
  });

  it('A → 1', () => {
    expect(colLetterToNumber('A')).toBe(1);
  });

  it('Z → 26', () => {
    expect(colLetterToNumber('Z')).toBe(26);
  });

  it('AA → 27', () => {
    expect(colLetterToNumber('AA')).toBe(27);
  });

  it('小写 c → 3', () => {
    expect(colLetterToNumber('c')).toBe(3);
  });

  it('非法输入抛出 AppError', () => {
    expect(() => colLetterToNumber('1')).toThrow();
    expect(() => colLetterToNumber('')).toThrow();
  });
});

describe('normalizeHeaderName (mergeTypes)', () => {
  it('应移除所有空白', () => {
    expect(normalizeHeaderName('上 月 结 存')).toBe('上月结存');
  });

  it('空字符串返回空字符串', () => {
    expect(normalizeHeaderName('')).toBe('');
  });
});
