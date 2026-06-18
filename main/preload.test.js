const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadPreloadSandbox() {
  const source = fs.readFileSync(path.join(__dirname, "preload.js"), "utf8");
  const sandbox = {
    require(moduleName) {
      if (moduleName === "electron") {
        return {
          contextBridge: { exposeInMainWorld() {} },
          ipcRenderer: {
            invoke() {},
            on() {},
            removeListener() {},
          },
        };
      }
      return require(moduleName);
    },
  };

  vm.runInNewContext(source, sandbox, { filename: "preload.js" });
  return sandbox;
}

test("normalizeSendPayload preserves stripped channels for send history warnings", () => {
  const { normalizeSendPayload } = loadPreloadSandbox();

  const payload = normalizeSendPayload({
    matched: [
      {
        originalName: "月报.xlsx",
        channels: ["wechat"],
        rule: {
          originalName: "月报.xlsx",
          channels: ["wechat"],
          strippedChannels: ["email"],
          wechatGroup: "测试群",
        },
      },
    ],
  });

  assert.deepEqual(Array.from(payload.matched[0].rule.strippedChannels), ["email"]);
});
