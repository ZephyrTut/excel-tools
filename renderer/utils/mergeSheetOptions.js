function buildMergeSourceSheetOptions(sourceSheetNames, templateSheetNames, rules) {
  const out = [];
  const seen = new Set();

  for (const name of sourceSheetNames || []) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }

  for (const rule of rules || []) {
    const name = rule?.sheetName;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }

  return out;
}

module.exports = {
  buildMergeSourceSheetOptions,
};
