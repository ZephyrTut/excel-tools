function findOrCreateGroup(groups, fileName) {
  let group = groups.find((item) => item.fileName === fileName);
  if (!group) {
    group = { fileName, tags: [] };
    groups.push(group);
  }
  return group;
}

function hasStrippedTag(tags, channel) {
  return tags.some((tag) => tag.type === channel && tag.status === "stripped");
}

function normalizeTargetName(name) {
  if (typeof name === "object" && name !== null) {
    return name.address || name.name || "";
  }
  return name || "";
}

function emailListIncludes(rule, targetName) {
  const normalizedTarget = normalizeTargetName(targetName);
  return (rule?.emailTo || []).some((addr) => {
    const normalizedAddr = normalizeTargetName(addr);
    return normalizedAddr && normalizedTarget.includes(normalizedAddr);
  });
}

function wechatMatches(rule, targetName) {
  return rule?.wechatGroup && rule.wechatGroup === targetName;
}

function createDetailResolver(entry) {
  const details = entry.matchedDetails || [];
  let lastWechatMatchedIndex = -1;
  const usedForEmail = new Set();

  return (target) => {
    if (target._fileName) return target._fileName;
    if (target.type !== "wechat" && target.type !== "email") return "";

    // WeChat: 精确一对一匹配，记录索引供后续 email 优先归属
    if (target.type === "wechat") {
      const index = details.findIndex((d) => wechatMatches(d.rule, target.name));
      if (index >= 0) {
        lastWechatMatchedIndex = index;
        return details[index].originalName;
      }
      return "";
    }

    // Email: 优先归属到上一个 wechat 匹配的 detail（相同文件 email 紧邻 wechat）
    if (lastWechatMatchedIndex >= 0) {
      const preferred = details[lastWechatMatchedIndex];
      if (emailListIncludes(preferred.rule, target.name)) {
        usedForEmail.add(lastWechatMatchedIndex);
        lastWechatMatchedIndex = -1;
        return preferred.originalName;
      }
    }

    // 回退：未使用的 detail 中第一个匹配邮箱的
    const index = details.findIndex(
      (d, i) => !usedForEmail.has(i) && emailListIncludes(d.rule, target.name)
    );
    if (index >= 0) {
      usedForEmail.add(index);
      return details[index].originalName;
    }
    return "";
  };
}

export function buildHistoryGroupedRows(entry, getFileName = () => "") {
  if (!entry) return [];

  const groups = [];
  const resolveDetailFileName = createDetailResolver(entry);
  for (const target of entry.targets || []) {
    const fileName =
      target.type === "skip"
        ? target.name
        : resolveDetailFileName(target) || getFileName(entry, target, -1);
    findOrCreateGroup(groups, fileName).tags.push(target);
  }

  for (const detail of entry.matchedDetails || []) {
    const group = findOrCreateGroup(groups, detail.originalName);
    for (const channel of detail.strippedChannels || []) {
      if (hasStrippedTag(group.tags, channel)) continue;
      group.tags.push({
        type: channel,
        name:
          channel === "wechat" ? detail.rule?.wechatGroup || "微信" : "邮件",
        status: "stripped",
        error: null,
        _fileName: detail.originalName,
      });
    }
  }
  console.log(JSON.stringify(groups));
  return groups;
}
