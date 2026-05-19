// @vitest-environment node
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';

import {
  normalizeCellValue,
  cloneValue,
  resolveSequenceColumn,
  resolveHeaderMap,
  buildOrderList,
  orderedVendorsForSheet,
  resolveOrderRule,
} from '../services/merge/mergeEngine.js';

// ─── 辅助：内存创建 worksheet ─────────────────
function createSheet(name, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(name);
  rows.forEach((rowData, i) => {
    const row = ws.getRow(i + 1);
    rowData.forEach((val, j) => {
      row.getCell(j + 1).value = val;
    });
  });
  return ws;
}

// ─── normalizeCellValue ─────────────────────────
describe('normalizeCellValue', () => {
  it('纯值原样返回', () => {
    expect(normalizeCellValue('hello')).toBe('hello');
    expect(normalizeCellValue(42)).toBe(42);
    expect(normalizeCellValue(true)).toBe(true);
    expect(normalizeCellValue(null)).toBeNull();
  });

  it('Date 对象原样返回', () => {
    const d = new Date('2025-01-01');
    expect(normalizeCellValue(d)).toEqual(d);
  });

  it('含 formula 的对象提取 result', () => {
    expect(normalizeCellValue({ formula: 'A1+B1', result: 10, ref: 'C1', shareType: '' })).toBe(10);
  });

  it('含 formula 但 result 为 null 返回 null', () => {
    expect(normalizeCellValue({ formula: 'A1+B1', result: null, ref: 'C1', shareType: '' })).toBeNull();
  });

  it('含 sharedFormula 的对象提取 result', () => {
    expect(normalizeCellValue({ sharedFormula: 'A1', result: 'hello' })).toBe('hello');
  });
});

// ─── resolveSequenceColumn ──────────────────────
describe('resolveSequenceColumn', () => {
  it('在表头中找到"序号"列', () => {
    const ws = createSheet('t', [['序号', '供应商', '金额']]);
    expect(resolveSequenceColumn(ws, 1)).toBe(1);
  });

  it('无序号列返回 -1', () => {
    const ws = createSheet('t', [['供应商', '金额']]);
    expect(resolveSequenceColumn(ws, 1)).toBe(-1);
  });

  it('多行表头也能找到"序号"', () => {
    const ws = createSheet('t', [
      ['报表头', '报表头', '报表头'],
      ['序号', '供应商', '金额'],
    ]);
    expect(resolveSequenceColumn(ws, 2)).toBe(1);
  });
});

// ─── resolveHeaderMap ───────────────────────────
describe('resolveHeaderMap', () => {
  it('将列头映射到列号', () => {
    const ws = createSheet('t', [['序号', '供应商', '入库', '出库']]);
    const map = resolveHeaderMap(ws, 1);
    expect(map.get('序号')).toBe(1);
    expect(map.get('供应商')).toBe(2);
    expect(map.get('入库')).toBe(3);
    expect(map.get('出库')).toBe(4);
  });

  it('头行数=3 时从下往上扫描', () => {
    const ws = createSheet('t', [
      ['报表头', '报表头', '报表头'],
      ['A', 'B', 'C'],
      ['序号', '供应商', '金额'],
    ]);
    const map = resolveHeaderMap(ws, 3);
    expect(map.get('序号')).toBe(1);
    expect(map.get('供应商')).toBe(2);
    expect(map.get('金额')).toBe(3);
  });

  it('跳过重复列头（保留首次出现的）', () => {
    const ws = createSheet('t', [['日期', '入库', '出库', '日期']]);
    const map = resolveHeaderMap(ws, 1);
    expect(map.get('日期')).toBe(1);
    expect(map.size).toBe(3);
  });
});

// ─── buildOrderList ─────────────────────────────
describe('buildOrderList', () => {
  it('从模板中提取供应商顺序（去重）', () => {
    const ws = createSheet('t', [
      ['序号', '供应商'],
      ['', '供应商A'],
      ['', '供应商B'],
      ['', '供应商A'],  // 重复
      ['', '供应商C'],
    ]);
    expect(buildOrderList(ws, 1, 2)).toEqual(['供应商A', '供应商B', '供应商C']);
  });

  it('跳过空值行', () => {
    const ws = createSheet('t', [
      ['序号', '供应商'],
      ['', '供应商A'],
      ['', ''],
      ['', '供应商B'],
    ]);
    expect(buildOrderList(ws, 1, 2)).toEqual(['供应商A', '供应商B']);
  });
});

// ─── orderedVendorsForSheet ─────────────────────
describe('orderedVendorsForSheet', () => {
  function makeRows(vendors) {
    const m = new Map();
    for (const v of vendors) m.set(v, []);
    return m;
  }

  it('按 orderList 排序', () => {
    const result = orderedVendorsForSheet(
      makeRows(['供应商B', '供应商A', '供应商C']),
      ['供应商A', '供应商B', '供应商C'],
      [],
      true
    );
    expect(result).toEqual(['供应商A', '供应商B', '供应商C']);
  });

  it('未知供应商追加到末尾', () => {
    const result = orderedVendorsForSheet(
      makeRows(['供应商A', '供应商D', '供应商B']),
      ['供应商A', '供应商B'],
      ['供应商D'],
      true
    );
    expect(result).toEqual(['供应商A', '供应商B', '供应商D']);
  });

  it('appendUnknown=false 时排除未知供应商', () => {
    const result = orderedVendorsForSheet(
      makeRows(['供应商A', '供应商D']),
      ['供应商A', '供应商B'],
      ['供应商D'],
      false
    );
    expect(result).toEqual(['供应商A']);
  });

  it('orderList 中有的但 vendorRows 没有的跳过', () => {
    const result = orderedVendorsForSheet(
      makeRows(['供应商A']),
      ['供应商A', '供应商B', '供应商C'],
      [],
      true
    );
    expect(result).toEqual(['供应商A']);
  });
});

// ─── resolveOrderRule ───────────────────────────
describe('resolveOrderRule', () => {
  it('按 orderSheetName 找到对应的 rule', () => {
    const rules = [
      { sheetName: '日报', outputSheetName: '日报' },
      { sheetName: '入库', outputSheetName: '入库' },
    ];
    const result = resolveOrderRule(rules, { orderSheetName: '日报' });
    expect(result.outputSheetName).toBe('日报');
  });

  it('找不到时抛异常', () => {
    const rules = [{ sheetName: '日报', outputSheetName: '日报' }];
    expect(() => resolveOrderRule(rules, { orderSheetName: '不存在的Sheet' })).toThrow();
  });
});
