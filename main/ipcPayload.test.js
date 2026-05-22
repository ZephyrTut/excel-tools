const test = require("node:test");
const assert = require("node:assert/strict");

const { sanitizeForIpc } = require("./ipcPayload");

test("sanitizeForIpc converts nested proxy-like payloads into structured-cloneable plain data", () => {
  const source = { 日报: "日报" };
  const proxy = new Proxy(source, {
    get(target, prop, receiver) {
      return Reflect.get(target, prop, receiver);
    },
  });

  const payload = {
    inputDir: "C:\\input",
    templateFile: "C:\\template.xlsx",
    sheetNameAliases: proxy,
    rules: [
      {
        sheetName: "日报",
        outputSheetName: "日报",
        headerRows: 3,
      },
    ],
  };

  const sanitized = sanitizeForIpc(payload);

  assert.deepEqual(sanitized.sheetNameAliases, { 日报: "日报" });
  assert.deepEqual(sanitized.rules, payload.rules);
  assert.doesNotThrow(() => structuredClone(sanitized));
});

test("sanitizeForIpc keeps preload response data structured-cloneable", () => {
  const response = {
    rules: [
      {
        sheetName: "日报",
        outputSheetName: "日报",
        headerRows: 3,
        preloadedHeaders: {
          templateHeaders: ["序号", "供应商名称", "05-01"],
          sources: [
            {
              file: "供应商A",
              headers: ["序号", "供应商名称", "05-01"],
            },
          ],
        },
      },
    ],
  };

  const sanitized = sanitizeForIpc(response);

  assert.deepEqual(sanitized, response);
  assert.doesNotThrow(() => structuredClone(sanitized));
});
