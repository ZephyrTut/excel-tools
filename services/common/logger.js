function createLogger(prefix = "app", sink = console) {
  const write = (level, message, context = {}) => {
    const payload = {
      ts: new Date().toISOString(),
      level,
      prefix,
      message,
      context
    };
    sink[level] ? sink[level](payload) : sink.log(payload);
  };

  return {
    info: (message, context) => write("info", message, context),
    warn: (message, context) => write("warn", message, context),
    error: (message, context) => write("error", message, context)
  };
}

module.exports = {
  createLogger
};
