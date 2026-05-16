const fs = require("node:fs/promises");
const path = require("node:path");
const { AppError, ErrorCodes } = require("./errors");

const USER_RULE_FILE = "rules.json";

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(base, override) {
  if (!isObject(base) || !isObject(override)) return override ?? base;
  const merged = { ...base };
  for (const key of Object.keys(override)) {
    const baseValue = base[key];
    const overrideValue = override[key];
    merged[key] = isObject(baseValue)
      ? deepMerge(baseValue, overrideValue)
      : overrideValue;
  }
  return merged;
}

function validateRules(rules) {
  if (!rules || !Array.isArray(rules.sheetRules)) {
    throw new AppError(
      ErrorCodes.INVALID_RULES,
      "Rules must contain sheetRules array."
    );
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function readOptionalJson(filePath) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function loadRules({ projectRoot, userDataPath }) {
  const defaultPath = path.join(projectRoot, "config", "defaultRules.json");
  const userPath = path.join(userDataPath, USER_RULE_FILE);
  const base = await readJson(defaultPath);
  const user = await readOptionalJson(userPath);
  const merged = user ? deepMerge(base, user) : base;
  validateRules(merged);
  return merged;
}

async function saveRules(rules, { userDataPath }) {
  validateRules(rules);
  await fs.mkdir(userDataPath, { recursive: true });
  const userPath = path.join(userDataPath, USER_RULE_FILE);
  await fs.writeFile(userPath, JSON.stringify(rules, null, 2), "utf8");
  return { ok: true, path: userPath };
}

module.exports = {
  loadRules,
  saveRules,
  validateRules
};
