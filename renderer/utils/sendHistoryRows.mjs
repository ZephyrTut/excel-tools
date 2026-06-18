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

export function buildHistoryGroupedRows(entry, getFileName) {
  if (!entry) return [];

  const groups = [];
  for (const target of entry.targets || []) {
    const fileName =
      target.type === "skip"
        ? target.name
        : target._fileName || getFileName(entry, target, -1);
    findOrCreateGroup(groups, fileName).tags.push(target);
  }

  for (const detail of entry.matchedDetails || []) {
    const group = findOrCreateGroup(groups, detail.originalName);
    for (const channel of detail.strippedChannels || []) {
      if (hasStrippedTag(group.tags, channel)) continue;
      group.tags.push({
        type: channel,
        name: channel === "wechat" ? detail.rule?.wechatGroup || "微信" : "邮件",
        status: "stripped",
        error: null,
        _fileName: detail.originalName,
      });
    }
  }

  return groups;
}
