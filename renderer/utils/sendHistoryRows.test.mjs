import test from "node:test";
import assert from "node:assert/strict";

import { buildHistoryGroupedRows } from "./sendHistoryRows.mjs";

test("buildHistoryGroupedRows adds stripped channel tags from matched details", () => {
  const rows = buildHistoryGroupedRows(
    {
      targets: [
        {
          type: "wechat",
          name: "测试群5",
          status: "success",
          _fileName: "月报.xlsx",
        },
      ],
      matchedDetails: [
        {
          originalName: "月报.xlsx",
          strippedChannels: ["email"],
          rule: { wechatGroup: "测试群5" },
        },
      ],
    },
    () => ""
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].fileName, "月报.xlsx");
  assert.deepEqual(
    rows[0].tags.map((tag) => ({ type: tag.type, status: tag.status })),
    [
      { type: "wechat", status: "success" },
      { type: "email", status: "stripped" },
    ]
  );
});

test("buildHistoryGroupedRows does not duplicate existing stripped target tags", () => {
  const rows = buildHistoryGroupedRows(
    {
      targets: [
        {
          type: "email",
          name: "邮件",
          status: "stripped",
          _fileName: "月报.xlsx",
        },
      ],
      matchedDetails: [
        {
          originalName: "月报.xlsx",
          strippedChannels: ["email"],
        },
      ],
    },
    () => ""
  );

  assert.equal(rows[0].tags.length, 1);
});
