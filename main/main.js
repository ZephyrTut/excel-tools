const { app } = require("electron");
const { createMainWindow } = require("./window");
const { registerIpcHandlers } = require("./ipc");

function bootstrap() {
  registerIpcHandlers();
  createMainWindow();
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
