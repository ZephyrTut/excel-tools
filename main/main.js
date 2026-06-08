const { app } = require("electron");
const { createMainWindow } = require("./window");
const { registerIpcHandlers } = require("./ipc");
const updater = require("./updater");

async function bootstrap() {
  registerIpcHandlers();
  createMainWindow();
  setTimeout(() => updater.checkForUpdates(), 3000);

  // Warm up ExcelJS module in background so first split/merge tab
  // open doesn't block on the 820ms require.
  setImmediate(() => require("exceljs"));
}

app.whenReady().then(bootstrap);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (app.getAllWindows().length === 0) {
    createMainWindow();
  }
});
