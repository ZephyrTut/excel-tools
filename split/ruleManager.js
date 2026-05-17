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

async function loadDefaultRules(projectRoot) {
  const configPath = path.join(projectRoot, "config", "defaultRules.json");
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    throw new AppError(
      ErrorCodes.INVALID_RULES,
      `Failed to load default rules from ${configPath}`,
      { error: err.message }
    );
  }
}

async function loadUserRules(userDataPath) {
  const userRulesPath = path.join(userDataPath, USER_RULE_FILE);
  try {
    const raw = await fs.readFile(userRulesPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function loadRules({ projectRoot, userDataPath }) {
  const defaults = await loadDefaultRules(projectRoot);
  const userRules = await loadUserRules(userDataPath);
  return userRules ? deepMerge(defaults, userRules) : defaults;
}

async function saveRules(rules, { userDataPath }) {
  const userRulesPath = path.join(userDataPath, USER_RULE_FILE);
  await fs.writeFile(userRulesPath, JSON.stringify(rules, null, 2), "utf-8");
}

module.exports = {
  loadRules,
  saveRules
};
