const { autoUpdater } = require("electron-updater");
const { BrowserWindow } = require("electron");

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

/** Check for updates from the configured publish server. */
async function checkForUpdates() {
  return autoUpdater.checkForUpdates();
}

/** Start downloading the available update. */
function downloadUpdate() {
  autoUpdater.downloadUpdate();
}

/** Quit and install the downloaded update. */
function installUpdate() {
  autoUpdater.quitAndInstall();
}

module.exports = {
  checkForUpdates,
  downloadUpdate,
  installUpdate
};
