#!/usr/bin/env node
"use strict";

const path = require("node:path");
const fs = require("node:fs/promises");
const { spawn } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const testRoots = ["main", "services", path.join("renderer", "utils")];

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      if ((code ?? 1) === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? 1}`));
    });
  });
}

async function collectTestFiles(rootDir) {
  const discovered = [];

  async function walk(currentDir) {
    let entries = [];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".test.js") && !entry.name.endsWith(".test.mjs")) {
        continue;
      }
      discovered.push(fullPath);
    }
  }

  await walk(path.join(projectRoot, rootDir));
  return discovered;
}

async function main() {
  const files = (
    await Promise.all(testRoots.map((rootDir) => collectTestFiles(rootDir)))
  )
    .flat()
    .sort();

  if (files.length === 0) {
    console.error("No local test files were found under main/ or services/.");
    process.exit(1);
  }

  await runCommand(process.execPath, ["--test", ...files]);
  await runCommand("python", [
    "-m",
    "unittest",
    "discover",
    "-s",
    "services/send",
    "-p",
    "test_*.py",
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
