import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = process.cwd();
const configUrl = pathToFileURL(path.join(projectRoot, "vite.config.mjs")).href;

test("vite config resolves renderer paths from config file location instead of cwd", async () => {
  const originalCwd = process.cwd();
  const parentDir = path.dirname(projectRoot);

  try {
    process.chdir(parentDir);
    const mod = await import(`${configUrl}?cwd-test=${Date.now()}`);
    const config = mod.default;

    assert.equal(config.root, path.join(projectRoot, "renderer"));
    assert.equal(config.build.outDir, path.join(projectRoot, "dist", "renderer"));
  } finally {
    process.chdir(originalCwd);
  }
});
