const { app } = require("electron");
const { createMainWindow } = require("./window");
const { registerIpcHandlers } = require("./ipc");
const updater = require("./updater");

async function bootstrap() {
  registerIpcHandlers();
  createMainWindow();
  setTimeout(() => updater.checkForUpdates(), 3000);
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
