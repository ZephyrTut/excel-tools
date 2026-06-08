const { BrowserWindow } = require("electron");

let _autoUpdater = null;

// ── 国内更新镜像 ──────────────────────────────────────────
const MIRROR_URL = "https://excel-tools-release.oss-cn-hangzhou.aliyuncs.com/";

/** Lazy-init autoUpdater — electron-updater is 1.3MB and blocks startup. */
function getAutoUpdater() {
  if (_autoUpdater) return _autoUpdater;
  const { autoUpdater } = require("electron-updater");
  _autoUpdater = autoUpdater;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  /** Forward an update event to all renderer windows. */
  function broadcast(event) {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("update:event", event);
    }
  }

  autoUpdater.on("checking-for-update", () => {
    broadcast({ type: "checking" });
  });

  autoUpdater.on("update-available", (info) => {
    broadcast({ type: "update-available", info });
  });

  autoUpdater.on("update-not-available", (info) => {
    broadcast({ type: "update-not-available", info });
  });

  autoUpdater.on("download-progress", (progress) => {
    broadcast({
      type: "download-progress",
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    broadcast({ type: "update-downloaded", info });
  });

  autoUpdater.on("error", (err) => {
    broadcast({ type: "error", message: err.message });
  });

  return _autoUpdater;
}

/** Check for updates: try domestic mirror first, fall back to GitHub. */
async function checkForUpdates() {
  const updater = getAutoUpdater();
  let lastError = null;

  // ① 尝试 OSS 镜像（国内直连，无需 VPN）
  try {
    updater.setFeedURL({
      provider: "generic",
      url: MIRROR_URL,
    });
    return await updater.checkForUpdates();
  } catch (err) {
    lastError = err;
    console.warn("[updater] 镜像源检查失败，回退 GitHub:", err.message);
  }

  // ② 回退 GitHub（需要 VPN）
  try {
    updater.setFeedURL({
      provider: "github",
      owner: "ZephyrTut",
      repo: "excel-tools",
    });
    return await updater.checkForUpdates();
  } catch (err) {
    console.warn("[updater] GitHub 检查也失败:", err.message);
    lastError = err;
  }

  throw lastError;
}

/** Start downloading the available update. */
function downloadUpdate() {
  getAutoUpdater().downloadUpdate();
}

/** Quit and install the downloaded update. */
function installUpdate() {
  getAutoUpdater().quitAndInstall();
}

module.exports = {
  checkForUpdates,
  downloadUpdate,
  installUpdate
};
