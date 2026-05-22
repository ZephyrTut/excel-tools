const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeSheetName,
  resolveSheetName,
} = require("./sheetNameMatcher");

test("normalizeSheetName removes whitespace and unifies common punctuation", () => {
  assert.equal(normalizeSheetName(" 合格品（入库）记录 "), "合格品(入库)记录");
});

test("resolveSheetName prefers exact match, then normalized match, then alias-map match", () => {
  const actualSheetNames = ["日报", "合格品入货记录", "不良品库存"];

  const exact = resolveSheetName("日报", actualSheetNames, {});
  assert.equal(exact.matchedSheetName, "日报");
  assert.equal(exact.matchType, "exact");

  const normalized = resolveSheetName(" 合格品入货记录 ", actualSheetNames, {});
  assert.equal(normalized.matchedSheetName, "合格品入货记录");
  assert.equal(normalized.matchType, "normalized");

  const alias = resolveSheetName("合格品入库记录", actualSheetNames, {
    合格品入货记录: "合格品入库记录",
  });
  assert.equal(alias.matchedSheetName, "合格品入货记录");
  assert.equal(alias.matchType, "alias");
});

test("resolveSheetName returns suggestions for close names without silently matching them", () => {
  const result = resolveSheetName("合格品入库记录", ["合格品入货记录", "日报"], {});

  assert.equal(result.matchedSheetName, null);
  assert.equal(Array.isArray(result.suggestions), true);
  assert.equal(result.suggestions.includes("合格品入货记录"), true);
});
