const { BrowserWindow, app } = require("electron");
const path = require("node:path");

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    const rendererEntry = path.join(app.getAppPath(), "dist", "renderer", "index.html");
    win.loadFile(rendererEntry);
  }

  win.once("ready-to-show", () => win.show());
  return win;
}

module.exports = {
  createMainWindow
};
