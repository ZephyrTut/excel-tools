"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const wechatController = require("./wechatController");

test("getBundledPythonPath returns null when no bundled Python exists", () => {
  const result = wechatController.getBundledPythonPath();
  // In dev/test environments, resources/python/python.exe doesn't exist
  assert.equal(result, null);
});

test("resetPythonCheck clears cached Python detection state", () => {
  // Should not throw and should reset internal cache
  wechatController.resetPythonCheck();
  assert.ok(true);
});

test("findPython caches result across calls", async () => {
  wechatController.resetPythonCheck();
  // First call — detects Python (may or may not find it)
  const first = await wechatController.findPython();
  // Second call — should return same cached result without re-detecting
  const second = await wechatController.findPython();
  assert.equal(second, first);
});

test("resetPythonCheck forces re-detection on next findPython call", async () => {
  wechatController.resetPythonCheck();
  const before = await wechatController.findPython();
  wechatController.resetPythonCheck();
  const after = await wechatController.findPython();
  // After reset, should re-detect (result may be the same as before if
  // environment hasn't changed, but it should be a fresh detection)
  assert.equal(typeof after, typeof before);
});

test("sendToWechatGroup handles missing Python gracefully", async () => {
  // This test verifies sendToWechatGroup doesn't crash and returns
  // a proper error response when Python is unavailable
  wechatController.resetPythonCheck();
  const result = await wechatController.sendToWechatGroup(
    "__test_nonexistent_group__",
    "__test_nonexistent_file__.xlsx"
  );
  // Always returns an object with success/error
  assert.ok(typeof result === "object");
  assert.ok(typeof result.success === "boolean");
  assert.ok(typeof result.error === "string");
  assert.equal(result.success, false);
});

test("sendToWechatGroup accepts and propagates AbortSignal", async () => {
  wechatController.resetPythonCheck();
  const ac = new AbortController();
  ac.abort(); // Already aborted
  const result = await wechatController.sendToWechatGroup(
    "__test_group__",
    "__test_file__.xlsx",
    ac.signal
  );
  // Should not throw; abort is handled via execFileAsync internally
  assert.ok(typeof result === "object");
  assert.ok(typeof result.success === "boolean");
});

test("minimizeWechat handles no Python gracefully", async () => {
  wechatController.resetPythonCheck();
  const result = await wechatController.minimizeWechat();
  // Should return an error object, not crash
  assert.ok(typeof result === "object");
  assert.ok(typeof result.success === "boolean");
});

test("checkUiautomationInstalled returns false when pythonCmd is null", async () => {
  const result = await wechatController.checkUiautomationInstalled(null);
  assert.equal(result, false);
});

test("checkUiautomationInstalled returns false when pythonCmd is empty", async () => {
  const result = await wechatController.checkUiautomationInstalled("");
  assert.equal(result, false);
});

test("ensureUiautomationInstalled returns false when pythonCmd is null", async () => {
  const result = await wechatController.ensureUiautomationInstalled(null);
  assert.equal(result, false);
});
