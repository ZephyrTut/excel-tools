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

test("buildHistoryGroupedRows assigns repeated email targets to matching files in order", () => {
  const rows = buildHistoryGroupedRows(
    {
      targets: [
        {
          type: "email",
          name: "tuwanwan666@gmail.com",
          status: "success",
        },
        {
          type: "email",
          name: "tuwanwan666@gmail.com",
          status: "success",
        },
      ],
      matchedDetails: [
        {
          originalName: "力高.xlsx",
          rule: { emailTo: ["tuwanwan666@gmail.com"] },
        },
        {
          originalName: "富程威.xlsx",
          rule: { emailTo: ["tuwanwan666@gmail.com"] },
        },
      ],
    },
    () => ""
  );

  assert.deepEqual(
    rows.map((row) => ({
      fileName: row.fileName,
      tagCount: row.tags.length,
    })),
    [
      { fileName: "力高.xlsx", tagCount: 1 },
      { fileName: "富程威.xlsx", tagCount: 1 },
    ]
  );
});

test("buildHistoryGroupedRows allows one file to receive both wechat and email tags", () => {
  const rows = buildHistoryGroupedRows(
    {
      targets: [
        {
          type: "email",
          name: "tuwanwan666@gmail.com",
          status: "success",
        },
        {
          type: "wechat",
          name: "测试群8",
          status: "success",
        },
        {
          type: "email",
          name: "tuwanwan666@gmail.com",
          status: "success",
        },
      ],
      matchedDetails: [
        {
          originalName: "力高.xlsx",
          rule: { emailTo: ["tuwanwan666@gmail.com"] },
        },
        {
          originalName: "富程威.xlsx",
          rule: {
            wechatGroup: "测试群8",
            emailTo: ["tuwanwan666@gmail.com"],
          },
        },
      ],
    },
    (entry, target) => {
      if (target.type === "email") return "力高.xlsx";
      return "";
    }
  );

  assert.deepEqual(
    rows.map((row) => ({
      fileName: row.fileName,
      tags: row.tags.map((tag) => tag.type),
    })),
    [
      { fileName: "力高.xlsx", tags: ["email"] },
      { fileName: "富程威.xlsx", tags: ["wechat", "email"] },
    ]
  );
});
