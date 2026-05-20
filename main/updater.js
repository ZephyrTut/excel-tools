const { BrowserWindow } = require("electron");

let _autoUpdater = null;

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

/** Check for updates from the configured publish server. */
async function checkForUpdates() {
  return getAutoUpdater().checkForUpdates();
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
