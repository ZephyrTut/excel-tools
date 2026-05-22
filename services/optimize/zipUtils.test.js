const test = require("node:test");
const assert = require("node:assert/strict");

const {
  cleanupXlsxEntries,
  extractWorkbookSheetEntries,
  extractDifferentialStylesNode,
  findWorksheetDeclaredMaxRow,
  stripExternalLinksFromEntries,
} = require("./zipUtils");

test("stripExternalLinksFromEntries removes external link parts and workbook references", () => {
  const entries = new Map([
    [
      "[Content_Types].xml",
      [
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/xl/externalLinks/externalLink1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.externalLink+xml"/>',
        "</Types>",
      ].join(""),
    ],
    [
      "xl/_rels/workbook.xml.rels",
      [
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLink" Target="externalLinks/externalLink1.xml"/>',
        "</Relationships>",
      ].join(""),
    ],
    ["xl/externalLinks/externalLink1.xml", "<externalLink/>"],
    ["xl/externalLinks/_rels/externalLink1.xml.rels", "<Relationships/>"],
    ["xl/workbook.xml", "<workbook/>"],
  ]);

  const cleaned = stripExternalLinksFromEntries(entries);

  assert.equal(cleaned.has("xl/externalLinks/externalLink1.xml"), false);
  assert.equal(cleaned.has("xl/externalLinks/_rels/externalLink1.xml.rels"), false);
  assert.equal(cleaned.get("[Content_Types].xml").includes("externalLinks/externalLink1.xml"), false);
  assert.equal(cleaned.get("xl/_rels/workbook.xml.rels").includes("relationships/externalLink"), false);
});

test("extractWorkbookSheetEntries maps workbook sheet names to worksheet xml entries", () => {
  const entries = new Map([
    [
      "xl/workbook.xml",
      [
        '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
        "<sheets>",
        '<sheet name="日报" sheetId="1" r:id="rId1"/>',
        '<sheet name="入库" sheetId="2" r:id="rId2"/>',
        "</sheets>",
        "</workbook>",
      ].join(""),
    ],
    [
      "xl/_rels/workbook.xml.rels",
      [
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet2.xml"/>',
        "</Relationships>",
      ].join(""),
    ],
    ["xl/worksheets/sheet1.xml", "<worksheet><sheetData/></worksheet>"],
    ["xl/worksheets/sheet2.xml", "<worksheet><sheetData/></worksheet>"],
  ]);

  const sheetMap = extractWorkbookSheetEntries(entries);

  assert.equal(sheetMap.get("日报")?.path, "xl/worksheets/sheet1.xml");
  assert.equal(sheetMap.get("日报")?.xml.includes("<sheetData/>"), true);
  assert.equal(sheetMap.get("入库")?.path, "xl/worksheets/sheet2.xml");
});

test("cleanupXlsxEntries rebuilds conditional formatting, normalizes sheet view, and trims trailing empty rows", () => {
  const entries = new Map([
    [
      "xl/workbook.xml",
      [
        '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
        "<sheets>",
        '<sheet name="日报" sheetId="1" r:id="rId1"/>',
        "</sheets>",
        "</workbook>",
      ].join(""),
    ],
    [
      "xl/_rels/workbook.xml.rels",
      [
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
        "</Relationships>",
      ].join(""),
    ],
    [
      "xl/worksheets/sheet1.xml",
      [
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        '<dimension ref="A1:C6"/>',
        '<sheetViews><sheetView topLeftCell="BQ4" workbookViewId="0"><pane ySplit="3" topLeftCell="BQ4" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="CA10" sqref="CA10"/></sheetView></sheetViews>',
        "<sheetData>",
        '<row r="1"><c r="A1"><v>1</v></c></row>',
        '<row r="4"><c r="A4"><v>10</v></c></row>',
        '<row r="5"><c r="A5"><v>20</v></c></row>',
        '<row r="6"><c r="A6"/></row>',
        "</sheetData>",
        '<conditionalFormatting sqref="E4"/>',
        '<mergeCells count="1"><mergeCell ref="A1:C1"/></mergeCells>',
        '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>',
        "</worksheet>",
      ].join(""),
    ],
  ]);

  const cleaned = cleanupXlsxEntries(entries, {
    sheetTransforms: {
      日报: {
        conditionalFormatting: {
          mode: "remap",
          nodes: [
            '<conditionalFormatting sqref="E4:E6"><cfRule type="duplicateValues" dxfId="0" priority="1"/></conditionalFormatting>',
          ],
          rowMap: [
            [1, 1],
            [4, 4],
            [6, 5],
          ],
        },
        normalizeView: true,
        trimTrailingRows: true,
      },
    },
  });

  const sheetXml = cleaned.get("xl/worksheets/sheet1.xml");

  assert.equal(sheetXml.includes('<conditionalFormatting sqref="E4"/>'), false);
  assert.equal(sheetXml.includes('sqref="E4:E5"'), true);
  assert.equal(sheetXml.includes('topLeftCell="A4"'), true);
  assert.equal(
    sheetXml.includes('<selection pane="bottomLeft" activeCell="A4" sqref="A4"/>'),
    true
  );
  assert.equal(sheetXml.includes('r="6"'), false);
  assert.equal(sheetXml.includes('<dimension ref="A1:C5"/>'), true);
});

test("cleanupXlsxEntries clips merge-side conditional formatting to the final worksheet row count", () => {
  const entries = new Map([
    [
      "xl/workbook.xml",
      [
        '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
        "<sheets>",
        '<sheet name="日报" sheetId="1" r:id="rId1"/>',
        "</sheets>",
        "</workbook>",
      ].join(""),
    ],
    [
      "xl/_rels/workbook.xml.rels",
      [
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
        "</Relationships>",
      ].join(""),
    ],
    [
      "xl/worksheets/sheet1.xml",
      [
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        '<dimension ref="A1:B5"/>',
        '<sheetViews><sheetView topLeftCell="CN1" workbookViewId="0"><selection activeCell="DD15" sqref="DD15"/></sheetView></sheetViews>',
        "<sheetData>",
        '<row r="1"><c r="A1"><v>1</v></c></row>',
        '<row r="5"><c r="A5"><v>5</v></c></row>',
        "</sheetData>",
        '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>',
        "</worksheet>",
      ].join(""),
    ],
  ]);

  const cleaned = cleanupXlsxEntries(entries, {
    sheetTransforms: {
      日报: {
        conditionalFormatting: {
          mode: "clip",
          nodes: [
            '<conditionalFormatting sqref="D2:D65527"><cfRule type="duplicateValues" dxfId="2" priority="15"/></conditionalFormatting>',
          ],
        },
        normalizeView: true,
        trimTrailingRows: true,
      },
    },
  });

  const sheetXml = cleaned.get("xl/worksheets/sheet1.xml");

  assert.equal(sheetXml.includes('sqref="D2:D5"'), true);
  assert.equal(sheetXml.includes('<selection activeCell="A1" sqref="A1"/>'), true);
  assert.equal(sheetXml.includes('topLeftCell="CN1"'), false);
});

test("cleanupXlsxEntries removes frozen pane metadata when clearFrozenPane is enabled", () => {
  const entries = new Map([
    [
      "xl/workbook.xml",
      [
        '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
        "<sheets>",
        '<sheet name="鏃ユ姤" sheetId="1" r:id="rId1"/>',
        "</sheets>",
        "</workbook>",
      ].join(""),
    ],
    [
      "xl/_rels/workbook.xml.rels",
      [
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
        "</Relationships>",
      ].join(""),
    ],
    [
      "xl/worksheets/sheet1.xml",
      [
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        '<dimension ref="A1:C5"/>',
        '<sheetViews><sheetView topLeftCell="BQ4" workbookViewId="0"><pane ySplit="3" xSplit="2" topLeftCell="BQ4" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="CA10" sqref="CA10"/></sheetView></sheetViews>',
        "<sheetData>",
        '<row r="1"><c r="A1"><v>1</v></c></row>',
        '<row r="5"><c r="A5"><v>5</v></c></row>',
        "</sheetData>",
        "</worksheet>",
      ].join(""),
    ],
  ]);

  const cleaned = cleanupXlsxEntries(entries, {
    sheetTransforms: {
      鏃ユ姤: {
        normalizeView: { clearFrozenPane: true },
      },
    },
  });

  const sheetXml = cleaned.get("xl/worksheets/sheet1.xml");

  assert.equal(sheetXml.includes("<pane"), false);
  assert.equal(sheetXml.includes('state="frozen"'), false);
  assert.equal(sheetXml.includes('<selection activeCell="A1" sqref="A1"/>'), true);
  assert.equal(sheetXml.includes('topLeftCell="A1"'), true);
});

test("cleanupXlsxEntries does not trim trailing rows that are still referenced by conditional formatting", () => {
  const entries = new Map([
    [
      "xl/workbook.xml",
      [
        '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
        "<sheets>",
        '<sheet name="日报" sheetId="1" r:id="rId1"/>',
        "</sheets>",
        "</workbook>",
      ].join(""),
    ],
    [
      "xl/_rels/workbook.xml.rels",
      [
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
        "</Relationships>",
      ].join(""),
    ],
    [
      "xl/worksheets/sheet1.xml",
      [
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        '<dimension ref="A1:D6"/>',
        '<sheetViews><sheetView workbookViewId="0"><selection activeCell="A1" sqref="A1"/></sheetView></sheetViews>',
        "<sheetData>",
        '<row r="1"><c r="A1"><v>1</v></c></row>',
        '<row r="5"><c r="A5"><v>5</v></c></row>',
        '<row r="6"><c r="A6"/></row>',
        "</sheetData>",
        '<conditionalFormatting sqref="D1:D6"><cfRule type="duplicateValues" dxfId="1" priority="1"/></conditionalFormatting>',
        '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>',
        "</worksheet>",
      ].join(""),
    ],
  ]);

  const cleaned = cleanupXlsxEntries(entries, {
    sheetTransforms: {
      日报: {
        conditionalFormatting: {
          mode: "clip",
          nodes: [
            '<conditionalFormatting sqref="D1:D6"><cfRule type="duplicateValues" dxfId="1" priority="1"/></conditionalFormatting>',
          ],
        },
        trimTrailingRows: true,
      },
    },
  });

  const sheetXml = cleaned.get("xl/worksheets/sheet1.xml");

  assert.equal(sheetXml.includes('r="6"'), true);
  assert.equal(sheetXml.includes('sqref="D1:D6"'), true);
  assert.equal(sheetXml.includes('<dimension ref="A1:D6"/>'), true);
});

test("findWorksheetDeclaredMaxRow prefers worksheet dimension over sparse row records", () => {
  const xml = [
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '<dimension ref="A1:D109"/>',
    "<sheetData>",
    '<row r="1"><c r="A1"><v>1</v></c></row>',
    '<row r="108"><c r="A108"><v>1</v></c></row>',
    "</sheetData>",
    "</worksheet>",
  ].join("");

  assert.equal(findWorksheetDeclaredMaxRow(xml), 109);
});

test("cleanupXlsxEntries preserves declared max row for split conditional formatting remap", () => {
  const denseRowMap = Array.from({ length: 108 }, (_item, index) => [index + 1, index + 1]);
  const entries = new Map([
    [
      "xl/workbook.xml",
      [
        '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
        "<sheets>",
        '<sheet name="日报" sheetId="1" r:id="rId1"/>',
        "</sheets>",
        "</workbook>",
      ].join(""),
    ],
    [
      "xl/_rels/workbook.xml.rels",
      [
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
        "</Relationships>",
      ].join(""),
    ],
    [
      "xl/worksheets/sheet1.xml",
      [
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        '<dimension ref="A1:D108"/>',
        '<sheetViews><sheetView workbookViewId="0"><selection activeCell="A1" sqref="A1"/></sheetView></sheetViews>',
        "<sheetData>",
        '<row r="1"><c r="A1"><v>1</v></c></row>',
        '<row r="108"><c r="A108"><v>1</v></c></row>',
        "</sheetData>",
        "</worksheet>",
      ].join(""),
    ],
  ]);

  const cleaned = cleanupXlsxEntries(entries, {
    sheetTransforms: {
      日报: {
        conditionalFormatting: {
          mode: "remap",
          nodes: [
            '<conditionalFormatting sqref="D1:D109"><cfRule type="duplicateValues" dxfId="1" priority="1"/></conditionalFormatting>',
          ],
          rowMap: denseRowMap,
          sourceMaxRow: 109,
          trailingRowPadding: 1,
        },
        preserveMaxRow: 109,
      },
    },
  });

  const sheetXml = cleaned.get("xl/worksheets/sheet1.xml");

  assert.equal(sheetXml.includes('sqref="D1:D109"'), true);
  assert.equal(sheetXml.includes('<dimension ref="A1:D109"/>'), true);
});

test("extractDifferentialStylesNode returns the dxfs section from styles.xml", () => {
  const stylesXml = [
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '<fonts count="1"><font/></fonts>',
    '<dxfs count="2"><dxf><font><b/></font></dxf><dxf><fill/></dxf></dxfs>',
    '<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>',
    "</styleSheet>",
  ].join("");

  const dxfNode = extractDifferentialStylesNode(stylesXml);

  assert.equal(
    dxfNode,
    '<dxfs count="2"><dxf><font><b/></font></dxf><dxf><fill/></dxf></dxfs>'
  );
});

test("cleanupXlsxEntries restores differential styles for conditional formatting dxfId references", () => {
  const entries = new Map([
    [
      "xl/workbook.xml",
      [
        '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
        "<sheets>",
        '<sheet name="日报" sheetId="1" r:id="rId1"/>',
        "</sheets>",
        "</workbook>",
      ].join(""),
    ],
    [
      "xl/_rels/workbook.xml.rels",
      [
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
        "</Relationships>",
      ].join(""),
    ],
    [
      "xl/worksheets/sheet1.xml",
      [
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        '<dimension ref="A1:B2"/>',
        "<sheetViews><sheetView workbookViewId=\"0\"><selection activeCell=\"A1\" sqref=\"A1\"/></sheetView></sheetViews>",
        "<sheetData>",
        '<row r="1"><c r="A1"><v>1</v></c></row>',
        '<row r="2"><c r="A2"><v>2</v></c></row>',
        "</sheetData>",
        "</worksheet>",
      ].join(""),
    ],
    [
      "xl/styles.xml",
      [
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        '<fonts count="1"><font/></fonts>',
        '<dxfs count="0"/>',
        '<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>',
        "</styleSheet>",
      ].join(""),
    ],
  ]);

  const cleaned = cleanupXlsxEntries(entries, {
    sheetTransforms: {
      日报: {
        conditionalFormatting: {
          mode: "clip",
          nodes: [
            '<conditionalFormatting sqref="B2"><cfRule type="duplicateValues" dxfId="3" priority="1"/></conditionalFormatting>',
          ],
        },
      },
    },
    stylesTransform: {
      differentialStylesNode:
        '<dxfs count="4"><dxf/><dxf/><dxf/><dxf><font><color rgb="FFFF0000"/></font></dxf></dxfs>',
    },
  });

  assert.equal(
    cleaned.get("xl/styles.xml").includes('<dxfs count="4"><dxf/><dxf/><dxf/><dxf><font><color rgb="FFFF0000"/></font></dxf></dxfs>'),
    true
  );
  assert.equal(cleaned.get("xl/styles.xml").includes('<dxfs count="0"/>'), false);
});
