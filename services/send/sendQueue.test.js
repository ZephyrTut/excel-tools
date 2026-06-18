const test = require("node:test");
const assert = require("node:assert/strict");

const { buildSendQueue } = require("./sendService");

test("buildSendQueue keeps an email-only item at its file position when wechat is stripped", () => {
  const queue = buildSendQueue(
    [
      {
        originalName: "A.xlsx",
        channels: ["wechat"],
        rule: { wechatGroup: "群A" },
      },
      {
        originalName: "B.xlsx",
        channels: ["email"],
        rule: { strippedChannels: ["wechat"], emailTo: ["b@example.com"] },
      },
      {
        originalName: "C.xlsx",
        channels: ["wechat"],
        rule: { wechatGroup: "群C" },
      },
    ],
    true
  );

  assert.deepEqual(
    queue.map((item) => `${item.originalName}:${item.channel}`),
    ["A.xlsx:wechat", "B.xlsx:email", "C.xlsx:wechat"]
  );
});

test("buildSendQueue applies channel priority within each file only", () => {
  const queue = buildSendQueue(
    [
      {
        originalName: "A.xlsx",
        channels: ["email", "wechat"],
        rule: { wechatGroup: "群A", emailTo: ["a@example.com"] },
      },
      {
        originalName: "B.xlsx",
        channels: ["email", "wechat"],
        rule: { wechatGroup: "群B", emailTo: ["b@example.com"] },
      },
    ],
    true
  );

  assert.deepEqual(
    queue.map((item) => `${item.originalName}:${item.channel}`),
    ["A.xlsx:wechat", "A.xlsx:email", "B.xlsx:wechat", "B.xlsx:email"]
  );
});
