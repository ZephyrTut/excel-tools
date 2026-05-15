function createLogger(onLog) {
  return {
    info: (msg) => onLog?.(`[INFO] ${msg}`),
    warn: (msg) => onLog?.(`[WARN] ${msg}`),
    error: (msg) => onLog?.(`[ERROR] ${msg}`)
  };
}

module.exports = { createLogger };
