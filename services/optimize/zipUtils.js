/**
 * ZIP utilities using adm-zip library for reliable xlsx handling.
 */
const AdmZip = require("adm-zip");
const fs = require("fs");

/**
 * Read an xlsx file and return a Map of entry paths to their content.
 * XML/rels files are returned as strings; others as Buffers.
 */
async function readXlsxEntries(xlsxPath) {
  const zip = new AdmZip(xlsxPath);
  const entries = zip.getEntries();
  const map = new Map();

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const data = entry.getData();
    const fullName = entry.entryName;
    const ext = fullName.split(".").pop().toLowerCase();
    if (["xml", "rels"].includes(ext)) {
      map.set(fullName, data.toString("utf8"));
    } else {
      map.set(fullName, data);
    }
  }
  return map;
}

/**
 * Write a Map of entries to an xlsx file.
 * entriesMap: { fileName → string | Buffer | Uint8Array }
 */
async function writeXlsxFile(xlsxPath, entriesMap) {
  const zip = new AdmZip();

  // Sort entries: [Content_Types].xml first, then alphabetical
  const sorted = [...entriesMap.entries()].sort((a, b) => {
    if (a[0] === "[Content_Types].xml") return -1;
    if (b[0] === "[Content_Types].xml") return 1;
    return a[0].localeCompare(b[0]);
  });

  for (const [fileName, data] of sorted) {
    const buf = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
    zip.addFile(fileName, buf);
  }

  zip.writeZip(xlsxPath);
}

module.exports = {
  readXlsxEntries,
  writeXlsxFile,
};
