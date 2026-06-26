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
    strippedChannels: asStringArray(rule.strippedChannels),
    wechatGroup: rule.wechatGroup || null,
    emailSubject: rule.emailSubject || null,
    emailTo: asStringArray(rule.emailTo),
    emailCc: asStringArray(rule.emailCc),
  };
}

export function createSendPayload(matchedItems, wechatFirst, unmatchedItems, channelFilter = null) {
  const matched = Array.isArray(matchedItems) ? matchedItems : [];
  const unmatched = Array.isArray(unmatchedItems) ? unmatchedItems.map(String) : [];
  return {
    matched: matched
      .map((item = {}) => {
        let channels = asStringArray(item.channels);
        // 渠道过滤：仅保留目标渠道
        if (channelFilter && (channelFilter === "wechat" || channelFilter === "email")) {
          channels = channels.filter((ch) => ch === channelFilter);
        }
        return {
          originalName: asString(item.originalName),
          mappedName: asString(item.mappedName),
          resolvedSubject: asString(item.resolvedSubject),
          channels,
          filePath: asString(item.filePath),
          rule: normalizeRule(item.rule || {}),
        };
      })
      // 过滤后渠道为空的项不进入发送队列
      .filter((item) => item.channels.length > 0),
    wechatFirst: wechatFirst !== false,
    unmatched,
  };
}
