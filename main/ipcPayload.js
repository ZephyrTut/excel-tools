function sanitizeForIpc(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function normalizeSendRule(rule) {
  if (!rule) return null;
  const safeRule = sanitizeForIpc(rule) || {};
  return {
    originalName: safeRule.originalName || "",
    mappedName: safeRule.mappedName || "",
    channels: Array.isArray(safeRule.channels)
      ? safeRule.channels.map((item) => String(item))
      : [],
    wechatGroup: safeRule.wechatGroup || null,
    emailSubject: safeRule.emailSubject || null,
    emailTo: Array.isArray(safeRule.emailTo)
      ? safeRule.emailTo.map((item) => String(item))
      : [],
    emailCc: Array.isArray(safeRule.emailCc)
      ? safeRule.emailCc.map((item) => String(item))
      : [],
  };
}

function normalizeSendPayload(payload) {
  const safePayload = sanitizeForIpc(payload) || {};
  const matched = Array.isArray(safePayload.matched) ? safePayload.matched : [];

  return {
    matched: matched.map((item) => {
      const safeItem = sanitizeForIpc(item) || {};
      return {
        originalName: safeItem.originalName || "",
        mappedName: safeItem.mappedName || "",
        resolvedSubject: safeItem.resolvedSubject || "",
        channels: Array.isArray(safeItem.channels)
          ? safeItem.channels.map((channel) => String(channel))
          : [],
        filePath: safeItem.filePath || "",
        rule: normalizeSendRule(safeItem.rule),
      };
    }),
    wechatFirst: safePayload.wechatFirst !== false,
  };
}

module.exports = {
  sanitizeForIpc,
  normalizeSendPayload,
};
