const test = require("node:test");
const assert = require("node:assert/strict");
const { reactive, ref } = require("vue");

const { sanitizeForIpc, normalizeSendPayload } = require("./ipcPayload");

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

test("normalizeSendPayload strips Vue reactive UI state and keeps only send-safe fields", () => {
  const state = ref({
    matched: [
      reactive({
        originalName: "月报.xlsx",
        mappedName: "2026-06-07月报.xlsx",
        resolvedSubject: "2026-06-07 月报",
        channels: ["wechat", "email"],
        filePath: "C:\\tmp\\月报.xlsx",
        selected: true,
        rule: reactive({
          originalName: "月报.xlsx",
          mappedName: "{{date}}月报.xlsx",
          channels: ["wechat", "email"],
          wechatGroup: "管理群",
          emailSubject: "{{date}} 月报",
          emailTo: ["boss@a.com"],
          emailCc: ["cto@a.com"],
        }),
        uiOnlyPreview: { status: "selected" },
      }),
    ],
  });

  const selected = state.value.matched.filter((item) => item.selected !== false);
  const payload = normalizeSendPayload({
    matched: selected,
    wechatFirst: true,
  });

  assert.deepEqual(payload, {
    matched: [
      {
        originalName: "月报.xlsx",
        mappedName: "2026-06-07月报.xlsx",
        resolvedSubject: "2026-06-07 月报",
        channels: ["wechat", "email"],
        filePath: "C:\\tmp\\月报.xlsx",
        rule: {
          originalName: "月报.xlsx",
          mappedName: "{{date}}月报.xlsx",
          channels: ["wechat", "email"],
          wechatGroup: "管理群",
          emailSubject: "{{date}} 月报",
          emailTo: ["boss@a.com"],
          emailCc: ["cto@a.com"],
        },
      },
    ],
    wechatFirst: true,
  });
  assert.doesNotThrow(() => structuredClone(payload));
});
