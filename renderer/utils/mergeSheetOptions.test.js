const test = require("node:test");
const assert = require("node:assert/strict");

const { buildMergeSourceSheetOptions } = require("./mergeSheetOptions");

test("buildMergeSourceSheetOptions excludes template sheet names and keeps discovered source sheet names", () => {
  const options = buildMergeSourceSheetOptions(
    ["日报", "合格品入货记录", "零跑退回"],
    ["日报", "合格品入库记录", "合格品出库记录"],
    [{ sheetName: "库内不良" }]
  );

  assert.deepEqual(options, ["日报", "合格品入货记录", "零跑退回", "库内不良"]);
  assert.equal(options.includes("合格品入库记录"), false);
  assert.equal(options.includes("合格品出库记录"), false);
});
