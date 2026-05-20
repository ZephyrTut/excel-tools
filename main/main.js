const { app } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { createMainWindow } = require("./window");
const { registerIpcHandlers } = require("./ipc");
const updater = require("./updater");

const DEFAULT_TEMPLATE_NAME = "_default.xlsx";

async function ensureDefaultTemplate() {
  const userDataTemplatesDir = path.join(app.getPath("userData"), "templates");
  const defaultDest = path.join(userDataTemplatesDir, DEFAULT_TEMPLATE_NAME);

  try {
    await fs.access(defaultDest);
    return; // already exists
  } catch {
    // doesn't exist — copy from bundled templates
  }

  // Look for the first .xlsx in the bundled templates directory
  const bundledTemplatesDir = path.join(app.getAppPath(), "templates");
  let bundledFiles;
  try {
    bundledFiles = await fs.readdir(bundledTemplatesDir);
  } catch {
    return; // no bundled templates dir, nothing to copy
  }

  const xlsxFile = bundledFiles.find((f) => f.endsWith(".xlsx"));
  if (!xlsxFile) return;

  await fs.mkdir(userDataTemplatesDir, { recursive: true });
  await fs.copyFile(
    path.join(bundledTemplatesDir, xlsxFile),
    defaultDest
  );
}

async function bootstrap() {
  registerIpcHandlers();
  createMainWindow();
  // Background init after window appears — don't block UI
  ensureDefaultTemplate().catch(() => {});
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
