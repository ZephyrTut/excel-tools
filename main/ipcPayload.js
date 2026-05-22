function sanitizeForIpc(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  sanitizeForIpc,
};
