function normalizeSheetName(value) {
  return String(value || "")
    .trim()
    .replace(/[（）]/g, (ch) => (ch === "（" ? "(" : ")"))
    .replace(/\s+/g, "");
}

function similarityScore(left, right) {
  const a = normalizeSheetName(left);
  const b = normalizeSheetName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;

  let common = 0;
  for (const ch of new Set(a)) {
    if (b.includes(ch)) common += 1;
  }
  return common / Math.max(a.length, b.length);
}

function buildSuggestions(targetName, actualSheetNames) {
  return [...new Set(actualSheetNames)]
    .map((name) => ({ name, score: similarityScore(targetName, name) }))
    .filter((item) => item.score >= 0.5)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "zh-CN"))
    .slice(0, 3)
    .map((item) => item.name);
}

function resolveSheetName(requestedSheetName, actualSheetNames, aliasMap = {}) {
  const requested = String(requestedSheetName || "");
  const actualNames = Array.isArray(actualSheetNames) ? actualSheetNames.filter(Boolean) : [];

  if (actualNames.includes(requested)) {
    return { matchedSheetName: requested, matchType: "exact", suggestions: [] };
  }

  const normalizedRequested = normalizeSheetName(requested);
  const normalizedMatch = actualNames.find((name) => normalizeSheetName(name) === normalizedRequested);
  if (normalizedMatch) {
    return { matchedSheetName: normalizedMatch, matchType: "normalized", suggestions: [] };
  }

  for (const [actualName, canonicalName] of Object.entries(aliasMap || {})) {
    if (canonicalName !== requested) continue;
    const matchedAlias = actualNames.find((name) => name === actualName);
    if (matchedAlias) {
      return { matchedSheetName: matchedAlias, matchType: "alias", suggestions: [] };
    }
  }

  return {
    matchedSheetName: null,
    matchType: "none",
    suggestions: buildSuggestions(requested, actualNames),
  };
}

module.exports = {
  normalizeSheetName,
  resolveSheetName,
};
