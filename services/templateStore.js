const fs = require("node:fs/promises");
const path = require("node:path");

function getTemplatesDir(userDataPath, scope) {
  const normalizedScope = String(scope || "").trim();
  if (!["split", "merge"].includes(normalizedScope)) {
    throw new Error(`Invalid template scope "${scope}"`);
  }
  return path.join(userDataPath, "templates", normalizedScope);
}

async function listTemplates(userDataPath, scope) {
  const templatesDir = getTemplatesDir(userDataPath, scope);
  let files;
  try {
    files = await fs.readdir(templatesDir);
  } catch {
    return [];
  }

  const items = [];
  for (const name of files) {
    if (!name.toLowerCase().endsWith(".xlsx")) continue;
    const fullPath = path.join(templatesDir, name);
    let stat;
    try {
      stat = await fs.stat(fullPath);
    } catch {
      continue;
    }
    items.push({
      name,
      path: fullPath,
      mtime: stat.mtime.toISOString(),
      size: stat.size,
    });
  }

  items.sort((a, b) => b.mtime.localeCompare(a.mtime));
  return items;
}

async function importTemplate(userDataPath, scope, sourcePath) {
  const templatesDir = getTemplatesDir(userDataPath, scope);
  await fs.mkdir(templatesDir, { recursive: true });
  const baseName = path.basename(sourcePath);
  const destPath = path.join(templatesDir, baseName);
  await fs.copyFile(sourcePath, destPath);
  return {
    name: baseName,
    path: destPath,
  };
}

async function deleteTemplate(userDataPath, scope, templateName) {
  const filePath = path.join(getTemplatesDir(userDataPath, scope), templateName);
  await fs.unlink(filePath);
  return { deleted: true };
}

module.exports = {
  getTemplatesDir,
  listTemplates,
  importTemplate,
  deleteTemplate,
};
