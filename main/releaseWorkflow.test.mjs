import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

test("release workflow pins electron mirror and fetch retries", () => {
  const workflowPath = path.join(repoRoot, ".github", "workflows", "release.yml");
  const workflow = fs.readFileSync(workflowPath, "utf8");

  assert.match(
    workflow,
    /ELECTRON_MIRROR:\s*https:\/\/npmmirror\.com\/mirrors\/electron\//,
  );
  assert.match(workflow, /pnpm config set fetch-retries 5/);
  assert.match(workflow, /pnpm config set fetch-retry-maxtimeout 120000/);
  assert.match(workflow, /pnpm install --frozen-lockfile/);
});

test("package build script uses pnpm end-to-end", () => {
  const packageJsonPath = path.join(repoRoot, "package.json");
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  assert.equal(pkg.scripts["build:renderer"], "node scripts/build-renderer.mjs");
  assert.equal(
    pkg.scripts.build,
    "pnpm clean && pnpm build:renderer && pnpm exec electron-builder --win",
  );
});
