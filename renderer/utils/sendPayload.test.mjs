import test from "node:test";
import assert from "node:assert/strict";

import { createSendPayload } from "./sendPayload.mjs";

test("createSendPayload keeps only structured-cloneable send fields", () => {
  const circularUiState = {};
  circularUiState.self = circularUiState;

  const payload = createSendPayload(
    [
      {
        originalName: "日报.xlsx",
        mappedName: "2026-06-07日报.xlsx",
        resolvedSubject: "2026-06-07 日报",
        channels: ["wechat", "email"],
        filePath: "C:\\tmp\\日报.xlsx",
        selected: true,
        uiState: circularUiState,
        rule: {
          originalName: "日报.xlsx",
          mappedName: "{{date}}日报.xlsx",
          channels: ["wechat", "email"],
          wechatGroup: "测试群",
          emailSubject: "{{date}} 日报",
          emailTo: ["a@example.com"],
          emailCc: ["b@example.com"],
          extraUiOnlyValue: circularUiState,
        },
      },
    ],
    true
  );

  assert.deepEqual(payload, {
    matched: [
      {
        originalName: "日报.xlsx",
        mappedName: "2026-06-07日报.xlsx",
        resolvedSubject: "2026-06-07 日报",
        channels: ["wechat", "email"],
        filePath: "C:\\tmp\\日报.xlsx",
        rule: {
          originalName: "日报.xlsx",
          mappedName: "{{date}}日报.xlsx",
          channels: ["wechat", "email"],
          wechatGroup: "测试群",
          emailSubject: "{{date}} 日报",
          emailTo: ["a@example.com"],
          emailCc: ["b@example.com"],
        },
      },
    ],
    wechatFirst: true,
  });
  assert.doesNotThrow(() => structuredClone(payload));
});
