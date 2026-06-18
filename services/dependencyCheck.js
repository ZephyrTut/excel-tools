"use strict";

const {
  findPython,
  resetPythonCheck,
  checkWx4pyInstalled,
  ensureWx4pyInstalled,
  autoInstallPython,
} = require("./send/wechatController");

// ── 上下文（跨 check 传递数据） ──
const ctx = {};

// ── 依赖注册表 ──
// 每条记录定义：如何检查、影响哪个功能、能否自动修复
// 未来加新依赖只需在这里加一条
const DEPENDENCIES = [
  {
    id: "python",
    name: "Python 3",
    description: "运行微信自动化脚本的运行时环境",
    requiredBy: ["微信发送"],
    severity: "optional",
    check: async () => {
      const py = await findPython(ctx.userDataPath);
      if (py) ctx.pythonPath = py;
      return !!py;
    },
    autoFix: async () => {
      if (!ctx.userDataPath) return false;
      _emitProgress("正在自动下载并安装 Python 环境...");
      const ok = await autoInstallPython(ctx.userDataPath, (msg) => {
        _emitProgress(msg);
      });
      // 安装成功后重新检测，更新 ctx.pythonPath
      if (ok) {
        resetPythonCheck();
        const py = await findPython(ctx.userDataPath);
        if (py) ctx.pythonPath = py;
      }
      return ok;
    },
  },
  {
    id: "wx4py",
    name: "wx4py",
    description: "微信 PC 端自动化的 Python 库 (pip install wx4py)",
    requiredBy: ["微信发送"],
    severity: "optional",
    check: async () => {
      if (!ctx.pythonPath) return false;
      return checkWx4pyInstalled(ctx.pythonPath);
    },
    autoFix: async () => {
      if (!ctx.pythonPath) return false;
      return ensureWx4pyInstalled(ctx.pythonPath);
    },
  },
];

let _lastResults = null;

let _progressCallback = null;

/**
 * 运行全部依赖检查，返回结果数组
 * @param {function} [onProgress] - (entry) => void，每项状态变化时回调
 * @param {string} [userDataPath] - 用户数据目录，用于自动安装 Python
 * @returns {Promise<Array<{id, name, status, autoFixApplied, ...}>>}
 */
async function runDependencyCheck(onProgress, userDataPath) {
  _progressCallback = onProgress;
  _lastResults = [];
  // 重置缓存，确保检测结果是实时的
  resetPythonCheck();
  Object.keys(ctx).forEach((k) => delete ctx[k]);
  ctx.userDataPath = userDataPath;

  for (const dep of DEPENDENCIES) {
    const entry = {
      id: dep.id,
      name: dep.name,
      description: dep.description,
      requiredBy: dep.requiredBy,
      severity: dep.severity,
      status: "checking",
      autoFixApplied: false,
    };

    _emit({ ...entry });

    try {
      const passed = await dep.check();
      entry.status = passed ? "ok" : "missing";

      // 缺失且有自动修复 → 尝试修复
      if (!passed && typeof dep.autoFix === "function") {
        _emit({ ...entry, status: "fixing" });
        const fixed = await dep.autoFix();
        if (fixed) {
          entry.status = "ok";
          entry.autoFixApplied = true;
        }
      }
    } catch {
      entry.status = "error";
    }

    _lastResults.push(entry);
    _emit({ ...entry });
  }

  return _lastResults;
}

function _emit(data) {
  if (typeof _progressCallback === "function") _progressCallback(data);
}

function _emitProgress(msg) {
  if (typeof _progressCallback === "function") {
    _progressCallback({ type: "log", level: "info", message: msg });
  }
}

/** 获取最近一次检查结果 */
function getResults() {
  return _lastResults;
}

module.exports = { runDependencyCheck, getResults, DEPENDENCIES };
