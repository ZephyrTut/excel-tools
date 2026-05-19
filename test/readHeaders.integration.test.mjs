import { describe, it, expect, beforeAll } from 'vitest';
import {
  getSheetNames,
  getSheetHeadersWithPosition,
  getMultipleSheetHeaders,
} from '../services/split/excelReader.js';

const TEST_FILE = './test/湖州仓26年5月13日进销存报表.xlsx';

describe('读取真实 Excel 文件', () => {
  let sheetNames;

  beforeAll(async () => {
    sheetNames = await getSheetNames(TEST_FILE);
  });

  it('getSheetNames 应返回 visible sheets', () => {
    expect(sheetNames.length).toBeGreaterThan(0);
    expect(sheetNames).toContain('日报');
    expect(sheetNames).toContain('合格品入货记录');
  });

  it('getSheetHeadersWithPosition 应读取日报表头 (headerRows=3)', async () => {
    const headers = await getSheetHeadersWithPosition(TEST_FILE, '日报', 3);
    expect(headers.length).toBeGreaterThan(5);
    // 第一列通常是序号
    expect(headers[0]).toBe('序号');
  });

  it('getMultipleSheetHeaders 一次读取多个 sheet', async () => {
    const configs = [
      { sheetName: '日报', headerRows: 3 },
      { sheetName: '合格品入货记录', headerRows: 1 },
    ];
    const result = await getMultipleSheetHeaders(TEST_FILE, configs);
    expect(result).toHaveProperty('日报');
    expect(result).toHaveProperty('合格品入货记录');
    expect(result['日报'].length).toBeGreaterThan(3);
    expect(result['合格品入货记录'].length).toBeGreaterThan(0);
  });

  it('不存在的 sheet 返回空数组', async () => {
    const headers = await getSheetHeadersWithPosition(TEST_FILE, '不存在的Sheet', 1);
    expect(headers).toEqual([]);
  });
});
