# Excel Tools 兼容性修复方案

## 背景

拆分/合并生成的 XLSX 文件在 Microsoft Office 中打开时报"文件损坏"，无法正常使用。经诊断，根因涉及 **5 个独立问题**，本文档逐一说明修复方案。

---

## 问题 1：模板外部链接导致 ExcelJS 写入损坏

### 症状

模板工作簿含有 70 个外部链接（`xl/externalLinks/externalLink1~70.xml`）。ExcelJS 读取模板后写入时：
- 丢弃全部外部链接文件
- 但保留 `xl/_rels/workbook.xml.rels` 中的外部链接关系引用
- 同时生成无效的 sheet 引用（如 `sheet18.xml`、`sheet20.xml` 等实际不存在的 sheet）
- Office 打开时根据关系引用找不到对应文件 → 报损坏

### 修复

在 ExcelJS 加载模板之前，用 ZIP 层预处理清除外部链接：

```
步骤：
  1. 复制模板到临时文件
  2. 删除 xl/externalLinks/ 下所有文件及对应 .rels
  3. 从 [Content_Types].xml 中删除外部链接的 Override 条目
  4. 从 xl/_rels/workbook.xml.rels 中删除外部链接的 Relationship 条目
  5. 将清理后的文件传给 ExcelJS 加载
```

### 涉及文件

- `services/optimize/zipUtils.js` — `stripExternalLinks()` 函数
- `services/merge/mergeService.js` — 模板加载前调用 `stripExternalLinks()`

### 注意事项

- 必须在外链清除 之后 才加载到 ExcelJS，不能先加载再清除
- 分裂引擎的 `splitService.js` 如果也用了带外链的模板，同理需要预清理
- `templateOptimizer.js` 中的大模板优化已经包含了外链清除逻辑

---

## 问题 2：2570 空列导致文件膨胀

### 症状

模板中的某些 sheet（如"合格品出库记录"）第一行有 2570 个空样式单元格（`<c r="CTV1" s="X"/>`）。合并引擎在 `writeMergedSheet` 中计算 `templateMaxCol` 时：

```javascript
const templateMaxCol = Math.max(
    dataMaxCol,
    context.sequenceColumnIndex || 0,
    context.templateSheet.columnCount || 1   // ← 2570！
);
```

导致每个数据行迭代 2570 列，创建约 274×2570 ≈ 70 万个空 XML 单元格元素。文件膨胀到 ~15MB（实际数据只需 ~50KB），Office 打开时报损坏。

### 修复

将 `templateMaxCol` 的计算改为**以实际数据列数为准**，但保留零填充范围和序号列：

```javascript
// 用模板表头的实际列数（非 styles 的空白列）
let templateHeaderMaxCol = 0;
for (let r = 1; r <= context.headerRows; r++) {
    context.templateSheet.getRow(r).eachCell({ includeEmpty: false }, (_c, col) => {
        if (col > templateHeaderMaxCol) templateHeaderMaxCol = col;
    });
}
const templateMaxCol = Math.max(
    dataMaxCol,
    context.sequenceColumnIndex || 0,
    templateHeaderMaxCol,
    context.zeroFillStartColumnIndex > 0 ? context.availableBalanceColumnIndex : 0
);
```

### 涉及文件

- `services/merge/mergeEngine.js` — `writeMergedSheet()` 中的 `templateMaxCol` 计算

### 注意事项

- 分裂引擎不用改（分裂的数据行来自 `copyRowAndCellsWithOptions`，列数由源文件决定）
- `templateSheet.columnCount` 返回的是 exceljs 统计的全部列数（含空白样式列），不应使用
- 表头的 `eachCell({ includeEmpty: false })` 只返回有内容的列，能准确反映模板的实际列宽

---

## 问题 3：条件格式引用越界行

### 症状

模板的条件格式引用了超出实际数据范围的行（如 `Q101:Q363`，但输出只有 118 行）。直接复制这些条件格式到输出文件后，Office 的 OOXML 解析器发现引用了不存在的单元格 → 报损坏。

### 修复

复制条件格式时将行号上限裁剪到实际数据行数：

```javascript
const maxDataRow = outputSheet.rowCount;
outputSheet.conditionalFormattings = (templateSheet.conditionalFormattings || [])
    .filter(cf => cf && cf.rules && cf.rules.length > 0)
    .map(cf => {
        if (!cf.ref) return cf;
        const ranges = String(cf.ref).split(/\s+/);
        const cappedRanges = ranges.map(range =>
            range.replace(/(\d+)/g, n => String(Math.min(Number(n), maxDataRow)))
        );
        return { ...cf, ref: cappedRanges.join(' ') };
    });
```

### 涉及文件

- `services/merge/mergeEngine.js` — `writeMergedSheet()` 中数据行写入后执行

### 注意事项

- 裁剪必须在数据行全部写完 之后 执行（此时 `outputSheet.rowCount` 才是最终行数）
- 不要直接删除所有条件格式（如 `outputSheet.conditionalFormattings = []`），会丢失模板的单元格标红等规则
- 分裂引擎的 `copyWorksheetMeta` 本身不裁剪行号，暂不处理

---

## 问题 4：NaN 值写入 XML

### 症状

源文件中的公式单元格（`SUMIFS` 等）计算结果为 `NaN`，缓存结果为 `undefined`。ExcelJS 序列化时写入 `<v>NaN</v>`，但 OOXML 规范不允许 `NaN` 作为数值 → Office 报"单元格信息错误"。

### 修复

在 ZIP 层后处理阶段，将所有 `<v>NaN</v>` 替换为 `<v>0</v>`：

```javascript
// 在 cleanupXlsxXml 中
xml = xml.replace(/<v>NaN<\/v>/g, '<v>0</v>');
```

### 涉及文件

- `services/optimize/zipUtils.js` — `cleanupXlsxXml()` 函数

### 注意事项

- 替换为 0 而不是空值，避免单元格消失导致合并列错位
- 同时在合并引擎的 `normalizeCellValue` 中对无缓存结果的公式返回 `""` 而非 `null`，保持列结构
- 分裂引擎的 `cloneCellValue` 对无结果的公式返回 `null`，由零填充逻辑补充

---

## 问题 5：x14ac 命名空间属性

### 症状

ExcelJS 在每个 `<row>` 元素上硬编码 `x14ac:dyDescent="0.25"`，在 `<fonts>` 上硬编码 `x14ac:knownFonts="1"`。Office 2007/2010 解析这些属性时可能崩溃。Office 2016+ 正常。

### 修复

在 ZIP 层后处理中清除这些属性：

```javascript
xml = xml.replace(/\s+x14ac:dyDescent\s*=\s*"[^"]*"/g, '');
xml = xml.replace(/\s+x14ac:knownFonts\s*=\s*"[^"]*"/g, '');
```

**不要清除命名空间声明**（`xmlns:x14ac`、`xmlns:x15` 等）。如果清除声明但仍有元素使用该前缀（如 `x15:timelineStyles`），XML 会变成无效 → 报损坏。

### 涉及文件

- `services/optimize/zipUtils.js` — `cleanupXlsxXml()` 函数

### 注意事项

- 只清除属性，不清除声明
- `mc:Ignorable` 中的 `x14ac`、`x15` 等内容保留不动
- 这条规则主要是为了兼容 Office 2007/2010，Office 2016+ 本身支持这些属性

---

## 综合处理流程

```
模板文件
    │
    ▼
stripExternalLinks()      ← 问题 1：清除外部链接
    │
    ▼
ExcelJS 加载模板          ← 问题 2/3：此时确定列数和行数
    │
    ▼
合并引擎处理数据          ← 问题 3：裁剪条件格式行号
    │
    ▼
workbook.xlsx.writeFile()
    │
    ▼
cleanupAndOverwriteXlsx() ← 问题 4/5：替换 NaN，清理 x14ac
    │
    ▼
输出文件（Office 可打开）
```

### 调用点

| 修复 | 调用位置 |
|------|---------|
| `stripExternalLinks()` | `mergeService.js` / `splitService.js` 加载模板前 |
| `templateMaxCol` 修正 | `mergeEngine.js` writeMergedSheet |
| 条件格式裁剪 | `mergeEngine.js` writeMergedSheet（数据写入后） |
| `cleanupAndOverwriteXlsx()` | `mergeService.js` writeMergeOutput / `excelWriter.js` writeSplitOutput |

### ZIP 库替换

原方案使用 `adm-zip`，但其 `writeZip()` 方法重写 ZIP 时会改变文件条目顺序，导致 `[Content_Types].xml` 不再是第一个条目。OOXML 规范要求 `[Content_Types].xml` 必须是 ZIP 第一个条目。改用了 `yauzl`（读取，保持原始顺序）+ `yazl`（写入，按追加顺序）。注意 `archiver` v8+ 是 ESM-only，在 Electron 中 `require()` 会报错，不应使用。
