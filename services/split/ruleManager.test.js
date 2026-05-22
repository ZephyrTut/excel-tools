const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");

const { loadRules, saveRules } = require("./ruleManager");

test("loadRules exposes the new split/merge rule structure", async () => {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), "rules-shape-"));
  const rules = await loadRules({
    projectRoot: path.resolve(__dirname, "..", ".."),
    userDataPath,
  });

  assert.equal(typeof rules.split, "object");
  assert.equal(typeof rules.merge, "object");
  assert.equal(Array.isArray(rules.splitSheetRules), true);
  assert.equal(Array.isArray(rules.mergeSheetRules), true);
  assert.equal("templateFile" in rules, false);
  assert.equal("sheetRules" in rules, false);
  assert.equal(typeof rules.split.sheetNameAliases, "object");
  assert.equal(typeof rules.merge.sheetNameAliases, "object");
});

test("saveRules persists splitSheetRules without reintroducing removed legacy fields", async () => {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), "rules-save-"));
  const rules = {
    split: {
      templateFile: "split-template.xlsx",
      sheetNameAliases: { A: "B" },
      skipEmptySplitKey: true,
      trimSplitKey: true,
    },
    merge: {
      templateFile: "merge-template.xlsx",
      sheetNameAliases: { C: "D" },
      inputDir: ".\\input",
      orderSheetName: "日报",
      orderColumn: "C",
      appendUnknownVendorsToEnd: true,
      outputName: "合并汇总.xlsx",
    },
    splitSheetRules: [{ sheetName: "日报", splitColumn: "C", headerRows: 3 }],
    mergeSheetRules: [{ sheetName: "日报", outputSheetName: "日报", splitColumn: "C", headerRows: 3 }],
  };

  await saveRules(rules, { userDataPath });
  const raw = JSON.parse(await fs.readFile(path.join(userDataPath, "rules.json"), "utf8"));

  assert.equal(Array.isArray(raw.splitSheetRules), true);
  assert.equal(Array.isArray(raw.mergeSheetRules), true);
  assert.equal("templateFile" in raw, false);
  assert.equal("sheetRules" in raw, false);
});
