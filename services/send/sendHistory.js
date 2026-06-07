"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");

const HISTORY_FILE = "send-history.json";
const MAX_ENTRIES = 100;

/**
 * 加载发送历史
 * @param {string} userDataPath
 * @returns {Promise<Array>}
 */
async function loadHistory(userDataPath) {
  const filePath = path.join(userDataPath, HISTORY_FILE);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * 保存发送记录
 * @param {string} userDataPath
 * @param {object} entry - { date, files, targets }
 * @returns {Promise<void>}
 */
async function saveHistoryEntry(userDataPath, entry) {
  const history = await loadHistory(userDataPath);
  history.unshift(entry);
  if (history.length > MAX_ENTRIES) {
    history.length = MAX_ENTRIES;
  }
  const filePath = path.join(userDataPath, HISTORY_FILE);
  await fs.writeFile(filePath, JSON.stringify(history, null, 2), "utf-8");
}

/**
 * 清空全部发送历史
 * @param {string} userDataPath
 * @returns {Promise<void>}
 */
async function clearHistory(userDataPath) {
  const filePath = path.join(userDataPath, HISTORY_FILE);
  await fs.writeFile(filePath, JSON.stringify([], null, 2), "utf-8");
}

module.exports = { loadHistory, saveHistoryEntry, clearHistory };
