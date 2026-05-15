const fs = require('fs/promises');

async function loadRules(filePath) {
  const text = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(text);
}

module.exports = { loadRules };
