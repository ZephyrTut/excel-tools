const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");

const {
  listTemplates,
  importTemplate,
  deleteTemplate,
  getTemplatesDir,
} = require("./templateStore");

test("templateStore keeps split and merge templates in separate directories", async () => {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), "template-store-"));
  const splitDir = getTemplatesDir(userDataPath, "split");
  const mergeDir = getTemplatesDir(userDataPath, "merge");

  assert.equal(splitDir.endsWith(path.join("templates", "split")), true);
  assert.equal(mergeDir.endsWith(path.join("templates", "merge")), true);
  assert.notEqual(splitDir, mergeDir);
});

test("templateStore import/list/delete uses normal template permissions without default protection", async () => {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), "template-store-ops-"));
  const sourcePath = path.join(userDataPath, "sample.xlsx");
  await fs.writeFile(sourcePath, "fake-xlsx");

  const imported = await importTemplate(userDataPath, "split", sourcePath);
  assert.equal(imported.name, "sample.xlsx");

  const list = await listTemplates(userDataPath, "split");
  assert.equal(list.length, 1);
  assert.equal("isDefault" in list[0], false);

  const mergeList = await listTemplates(userDataPath, "merge");
  assert.equal(mergeList.length, 0);

  const deletion = await deleteTemplate(userDataPath, "split", "sample.xlsx");
  assert.equal(deletion.deleted, true);
  assert.deepEqual(await listTemplates(userDataPath, "split"), []);
});
