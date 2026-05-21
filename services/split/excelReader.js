const ExcelJS = require("exceljs");

async function readWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook;
}

async function getSheetNames(filePath) {
  const workbook = await readWorkbook(filePath);
  return workbook.worksheets
    .filter((ws) => ws.state === "visible")
    .map((ws) => ws.name);
}

function textValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, "text")) {
      return String(value.text || "");
    }
    if (Object.prototype.hasOwnProperty.call(value, "result")) {
      return textValue(value.result);
    }
    if (Object.prototype.hasOwnProperty.call(value, "richText")) {
      const parts = Array.isArray(value.richText) ? value.richText : [];
      return parts.map((item) => item.text || "").join("");
    }
    if (Object.prototype.hasOwnProperty.call(value, "error")) {
      return String(value.error || "");
    }
  }
  return String(value);
}

function normalizeHeaderName(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

async function getSheetHeaders(filePath, sheetName, headerRows = 1) {
  const workbook = await readWorkbook(filePath);
  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) return [];
  const maxCol = worksheet.columnCount || 1;
  const headers = [];
  const seen = new Set();
  for (let col = 1; col <= maxCol; col += 1) {
    let header = "";
    for (let row = Number(headerRows || 1); row >= 1; row -= 1) {
      const raw = textValue(worksheet.getRow(row).getCell(col).value);
      const normalized = normalizeHeaderName(raw);
      if (normalized) {
        header = normalized;
        break;
      }
    }
    if (!header || seen.has(header)) continue;
    seen.add(header);
    headers.push(header);
  }
  return headers;
}

/**
 * 按位置获取列头列表（不跳过同名列，保留空位占位）
 * 返回：["序号", "供应商名称", "上月结存", "入库", "出库", "当前库存", null, "备注"]
 * 某一列如果无列头则返回 null 占位
 */
async function getSheetHeadersWithPosition(filePath, sheetName, headerRows = 1) {
  const workbook = await readWorkbook(filePath);
  return getHeadersFromWorksheet(workbook.getWorksheet(sheetName), headerRows);
}

function getHeadersFromWorksheet(worksheet, headerRows = 1) {
  if (!worksheet) return [];
  // 先用 row.cellCount 取实际有数据的列，避免 columnCount 虚高（某些模板 16384 列）
  const actualCol = Math.max(
    worksheet.getRow(headerRows).cellCount || 0,
    (headerRows > 1 ? worksheet.getRow(1).cellCount || 0 : 0)
  );
  const maxCol = Math.min(worksheet.columnCount || 1, actualCol > 0 ? actualCol : worksheet.columnCount || 1);
  const headers = [];
  for (let col = 1; col <= maxCol; col += 1) {
    let header = null;
    for (let row = Number(headerRows || 1); row >= 1; row -= 1) {
      const cell = worksheet.getRow(row).getCell(col);
      const value = cell.value;

      // 日期值一律格式化为 MM-DD（如 05-01, 05-13）
      if (value instanceof Date) {
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        header = `${m}-${d}`;
        break;
      }
      // 公式结果也是日期 —— 子表中日期行多为 {formula, result:Date}
      if (value && typeof value === 'object' && value.result instanceof Date) {
        const dt = value.result;
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        header = `${m}-${d}`;
        break;
      }

      const raw = textValue(value);
      const normalized = normalizeHeaderName(raw);
      if (normalized) {
        header = normalized;
        break;
      }
    }
    headers.push(header);
  }
  // 裁剪尾部 null，避免大列宽文件（如 2570 列）产生海量空占位
  let lastIndex = headers.length - 1;
  while (lastIndex >= 0 && headers[lastIndex] === null) lastIndex -= 1;
  headers.length = lastIndex + 1;
  // 确保每个值都是 string | null，杜绝不可 clone 的对象
  for (let i = 0; i < headers.length; i++) {
    if (headers[i] !== null && typeof headers[i] !== 'string') {
      headers[i] = String(headers[i]);
    }
  }
  return headers;
}

/**
 * 一次读取一个文件的多个 sheet 列头（比多次调用 getSheetHeadersWithPosition 快 N 倍）
 * sheetConfigs: [{ sheetName, headerRows }]
 * 返回: { "日报": [...], "入库记录": [...] }
 */
async function getMultipleSheetHeaders(filePath, sheetConfigs) {
  const workbook = await readWorkbook(filePath);
  const result = {};
  for (const { sheetName, headerRows } of sheetConfigs) {
    const headers = getHeadersFromWorksheet(workbook.getWorksheet(sheetName), headerRows);
    if (headers.length > 0) {
      result[sheetName] = headers;
    }
  }
  return result;
}

module.exports = {
  readWorkbook,
  getSheetNames,
  getSheetHeaders,
  getSheetHeadersWithPosition,
  getMultipleSheetHeaders,
  getHeadersFromWorksheet,
  textValue,
  normalizeHeaderName,
};
