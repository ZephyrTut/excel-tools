function asString(value) {
  return value === null || value === undefined ? "" : String(value);
}

function asStringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function normalizeRule(rule = {}) {
  return {
    originalName: asString(rule.originalName),
    mappedName: asString(rule.mappedName),
    channels: asStringArray(rule.channels),
    wechatGroup: rule.wechatGroup || null,
    emailSubject: rule.emailSubject || null,
    emailTo: asStringArray(rule.emailTo),
    emailCc: asStringArray(rule.emailCc),
  };
}

export function createSendPayload(matchedItems, wechatFirst, unmatchedItems) {
  const matched = Array.isArray(matchedItems) ? matchedItems : [];
  const unmatched = Array.isArray(unmatchedItems) ? unmatchedItems.map(String) : [];
  return {
    matched: matched.map((item = {}) => ({
      originalName: asString(item.originalName),
      mappedName: asString(item.mappedName),
      resolvedSubject: asString(item.resolvedSubject),
      channels: asStringArray(item.channels),
      filePath: asString(item.filePath),
      rule: normalizeRule(item.rule || {}),
    })),
    wechatFirst: wechatFirst !== false,
    unmatched,
  };
}
