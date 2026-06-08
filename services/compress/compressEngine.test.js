const test = require("node:test");
const assert = require("node:assert/strict");
const { optimizeWorksheetXml } = require("./compressEngine");

test("optimizeWorksheetXml keeps sparse formula rows inside worksheet dimension", () => {
  const xml = [
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '<dimension ref="A1:C120"/>',
    "<sheetData>",
    '<row r="1"><c r="A1"><v>1</v></c></row>',
    '<row r="120"><c r="C120"><f>SUM(A1:A119)</f><v>1</v></c></row>',
    "</sheetData>",
    "</worksheet>",
  ].join("");

  const optimized = optimizeWorksheetXml(xml);

  assert.match(optimized, /<dimension ref="A1:C120"\/>/);
  assert.match(optimized, /<row r="120">/);
  assert.match(optimized, /<f>SUM\(A1:A119\)<\/f>/);
});
