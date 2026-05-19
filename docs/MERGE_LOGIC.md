# 合并汇总逻辑说明

## 概要

本文件描述将**多个来源 Excel 文件**按配置规则**合并汇总为一个总表**（merge）流程的实现逻辑。合并功能与拆分功能共享同一套配置体系、样式复制基础设施和错误模型，设计上作为 `services/merge/` 模块独立接入。

核心目标：读取指定目录下所有 `.xlsx` 源文件，按供应商/拆分键分组汇总，输出一个与模板样式一致的合并工作簿。

## 高级流程

1. **读取请求**：包含 `inputDir`（来源文件目录）、`templateFile`（模板文件路径）、`outputDir`、`rules` 等配置。
2. **解析源文件**：扫描 `inputDir` 下所有 `.xlsx` 文件，排除模板文件路径和输出文件路径，过滤临时文件（`~$` 开头）。
3. **对每个启用的 `sheetRule`**：
   - 用模板 sheet 确定输出结构（表头样式、列顺序、列宽）。
   - 读取每个源文件中的对应 sheet。
   - 通过**列头文本匹配**建立源→目标列映射（支持别名映射和列排除）。
   - 按 `splitColumn` 的值（即供应商/拆分键）**分组收集数据行**。
4. **确定供应商排序**：从模板已有数据行中提取供应商顺序列表；未知供应商可追加到末尾。
5. **构建输出工作簿**：
   - 保留模板所有 sheet（含无数据的"直通 sheet"）。
   - 对有规则匹配的 sheet：复制表头（保留合并区域，样式来自模板）→ 按供应商排序写入数据行 → 重新编号 `序号` 列。
   - 对无规则匹配的 sheet：仅复制列宽。
6. **写入输出文件**并返回统计（源文件数、合并行数、供应商数）。

## 关键实现细节

### 列映射（Column Mapping）——智能列头匹配

合并引擎**不按固定列号复制**，而是通过**列头名匹配**来建立源文件↔模板之间的列对应关系。这样即使不同子表有多余列、缺少列或重名列，也能正确对齐。

#### 1. 表头解析（`resolveHeaderMap`）

对每个 sheet，从 `headerRows` 行数内**由下往上扫描**，提取第一个非空文本作为该列的规范化列头。

```javascript
for (let col = 1; col <= maxCol; col += 1) {
  let header = "";
  for (let row = headerRows; row >= 1; row -= 1) {
    const raw = textValue(sheet.getRow(row).getCell(col).value);
    const normalized = normalizeHeaderName(raw);
    if (normalized) { header = normalized; break; }
  }
  if (!header || headerMap.has(header)) continue;  // 重名列跳过
  headerMap.set(header, col);
}
```

- `normalizeHeaderName`：去除所有空白字符后 trim。例如 `"可 用 结 存"` → `"可用结存"`。
- 多行表头（如日报 3 行表头）：优先取最底层的非空行作为列标识。
- **重名跳过**：如果两列有相同的规范化列头（例如入库5/1 和出库5/1 的日期字串相同），只保留第一次出现的列号。这使得模板中同一日期在入库和出库出现时，两个子表中同一天的入库/出库列都能正确匹配到同一个目标列。

#### 2. 源→目标列映射（`mapSourceToTargetColumns`）

分别解析源 sheet 和模板 sheet 的 `{ 规范化列头 → 列号 }` 映射，然后按列头名匹配：

| 步骤 | 说明 |
|------|------|
| 遍历源表所有列 | 对每列提取规范化列头 |
| 排除检查 | 若列头在 `removeHeaderSet` 中（如 `"当前库存"`），跳过 |
| 别名替换 | 若 `aliasMap` 中有该列头的映射，用映射后的名称去模板中查找 |
| 目标匹配 | 用（原始或别名后的）列头名在模板映射中查找对应列号 |
| 映射生成 | `Map<源列号, 目标列号>` — 仅当源表和模板都有该列头时才建立映射 |

**列头排除**（`removeColumnsByHeader`）：  
在规则中指定不需要合并的列头名称列表。例如排除 `"当前库存"`，则子表中该列数据不会被复制到输出。

**列别名映射**（`columnAliasMap`）：  
当子表列头与模板列头不一致时，通过别名桥接。例如子表列头为 `"上月结存"` 而模板为 `"良品上月结存"`，可在脚本的 `analyzeColumnAlignment` 中自动检测并配置。

```
子表列头集          模板列头集          映射结果
供应商名称  ───────→ 供应商名称         Col 3 → Col 3 (直接匹配)
上月结存             良品上月结存       Col 9 → Col 9 (别名上月结存→良品上月结存)
当前库存             无此列头           跳过 (排除)
不良品上月结存 ─────→ 不良品上月结存     Col X → Col X
```

#### 3. 多余列检测与删除

有些子表会多出一些模板中没有的列（如"当前库存"出现在列 16 或列 18）。处理流程分为两步：

**第一步 — 脚本预检测（`analyzeColumnAlignment`）：**

```
算法：
  1. 读取模板 Row3 列头全集 → Set T
  2. 读取所有子表 Row3 列头合集 → Set S
  3. 多余列名 = S \ T（子表有而模板没有）
  4. 对每个多余列名，检查它在子表中的列位置：
     - 若模板同一位置的列恰是子表缺少的 → 判定为别名（不需删除）
     - 否则 → 真正多余 → 记录该列号
  5. 返回 removeColumnIndexes = [16, 18]
```

**第二步 — 引擎 per-file 二次校验（`buildPositionColMap`）：**

引擎在读取每个源文件时，对 `removeColumnIndexes` 中的列号做二次确认——读取该列的实际列头，只有**确实与模板不同**时才跳过该列。对于不含多余列的文件，列头与模板一致，不会误删。

```
效果：
  - 含"当前库存"的文件：跳过该列，后续列自动前移对齐
  - 不含"当前库存"的文件：不受影响，保持 1:1 映射
```

#### 4. 空供应商行处理

对每个数据行，若供应商列（`splitColumn`）为空，则该行直接跳过，不参与合并输出。

### 供应商排序（Vendor Ordering）

输出工作簿中各供应商的数据行按可配置的顺序排列：

#### 排序来源

1. **`merge.orderSheetName`**：指定从模板的哪个 sheet 提取供应商顺序（默认 `"日报"`）。
2. **`merge.orderColumn`**：指定读取顺序的列（默认 `"C"`，即供应商列）。
3. **`buildOrderList`**：从模板 sheet 的 `headerRows + 1` 行开始向下扫描，按首次出现的顺序记录所有非空供应商名称。去重。

#### 排序逻辑（`orderedVendorsForSheet`）

| 优先级 | 供应商来源 | 说明 |
|--------|-----------|------|
| 1 | 模板已有序号（`orderList`） | 模板中已有的供应商优先排在前面，保持模板原有顺序 |
| 2 | 未知供应商（`unknownOrder`） | 源文件中出现但模板中没有的供应商，按首次出现的顺序 |

- `appendUnknownVendorsToEnd`（默认 `true`）：控制未知供应商是否追加到末尾。如果设为 `false`，只输出模板中已有的供应商。

#### 跨 sheet 一致排序

所有配置了 `sheetRules` 的 sheet 共享同一个排序列表（以 `orderSheetName` 对应的 sheet 为准），确保不同 sheet 中同一供应商的数据行顺序一致。

若 sheet 本身未配置 `sortColumn/sortOrder` 且不是 `orderSheetName`，默认按 A 列升序写入该 sheet 的数据行。

### 数据收集（`collectSheetRowsByVendor`）

```
流程图：

inputDir/
├── 供应商A_1月.xlsx   ─┐
├── 供应商A_2月.xlsx   ─┤
├── 供应商B_1月.xlsx   ─┤  →  逐文件读取 →  按 sheetRule 匹配 sheet
├── 供应商B_2月.xlsx   ─┤                  →  按 splitColumn 分组
└── 供应商C_1月.xlsx   ─┘                  →  列映射 → 收集到 vendorRows Map
                                                   ↓
                                    Map<输出sheet名, {
                                      vendorRows: Map<供应商名, rows[]>,
                                      unknownOrder: string[]
                                    }>
```

关键行为：
- **列映射在收集时应用**：每个数据源单元格通过 `colMap.get(sourceCol)` 定位到输出列，存为 `Map<目标列号, 值>`。
- **纯值提取**：`normalizeCellValue` 对每个单元格做"值粘贴"语义转换，只保留最终值，不保留任何公式对象。
- **空供应商行剔除**：供应商列为空的行不会进入收集流程。
- **可用结存前补 0**：从"上月结存"开始到"可用结存"（含），空白值统一补 `0`。
- **合并数据不做去重**：同一供应商来自不同源文件的所有行都会保留（一一追加）；如需去重，由上层应用在合并后处理。

### 数据行写入（`writeMergedSheet`）

写入顺序严格遵循供应商排序列表：

```
对于每个供应商（按排序）：
  对于该供应商的每一行数据：
    创建新行
    从第 1 列到最大数据列：
      若该列有收集到的值 → 写入值
      若该列为 序号 列 → 递增序号
      若该列为零填充范围（上月结存~可用结存）内且为空 → 写 0
    从模板样式的第一数据行复制单元格样式（字体、对齐、填充、边框等）
```

**序号重新编号**（`sequenceColumnIndex`）：自动检测模板中列头为 `"序号"` 的列，在写入时从 1 开始递增编号，不保留源文件的原始序号。

**零填充范围**（`zeroFillStartColumnIndex ~ availableBalanceColumnIndex`）：从"上月结存"所在列开始到"可用结存"列（含），所有空白值统一填 `0`。

**重复零件编号标红**：所有数据写完后，扫描零跑零件编号列（Col E），将出现次数 > 1 的单元格字体颜色设为 `FF9C0006`（暗红色），模拟模板中的 `duplicateValues` 条件格式效果。

**最大列计算**：实际数据最大列 + 序号列 + 模板列数三者取最大值，确保不会截断数据也不会超出模板列数。

### 样式复制

合并模块直接复用拆分引擎的 `styleCopier.js`：

| 复制函数 | 用途 |
|---------|------|
| `copyWorksheetMeta` | 复制 sheet 级别属性（包括列宽，以模板为优先） |
| `copyHeaderRowsWithMerges` | 复制表头行及其合并单元格（以模板为样式源） |
| `copyCellStyle` | 对每个数据单元格，从模板第一数据行复制样式（`font`、`alignment`、`numFmt`、`fill`、`border`、`protection`） |

样式优先规则与拆分一致：**模板优先，源文件 fallback**。数据行的样式统一来自模板，不保留源文件中各行原有的独立样式——这是设计选择，以保证输出格式一致。

### 公式剥离策略

合并过程中采用"输入 Excel（含公式）→ merge 只取最终值 → 输出纯数据 Excel"策略：

| 单元格值类型 | 处理方式 |
|-------------|---------|
| 纯值（string / number / boolean / Date） | 直接克隆保留 |
| `{ sharedFormula, result }` | 优先保留 `result`；若 `result` 为空，先用显示文本；仍为空时尝试按同一行简单四则公式求值 |
| `{ formula, result, ref, shareType }` | 优先保留 `result`；若 `result` 为空，先用显示文本；仍为空时尝试按同一行简单四则公式求值 |
| `{ richText: [...] }` | 拼接为纯文本 |
| `{ error: "..." }` | 转为字符串 |
| `{ text: "...", hyperlink: "..." }` | 提取文本（不保留链接对象） |

这确保合并输出中不会包含对源文件路径或不存在文件的公式引用。

### 直通 Sheet（Passthrough Sheet）

对于模板中存在但配置规则中没有匹配的 sheet，合并引擎不会忽略它——而是创建一个**仅含列宽**的空 sheet（`createPassthroughSheet`）。原因：
- 模板可能包含不参与合并的辅助 sheet（如配置说明、统计页）。
- 保留这些 sheet 可以保持输出工作簿的结构完整性。
- 不复制行数据或合并单元格，避免因公式引用导致的错误。

### 配置结构

#### `merge` 段（`defaultRules.json` 中的顶级字段）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | boolean | `false` | 启用合并模式 |
| `inputDir` | string | `".\\test"` | 源文件目录（可以绝对或相对路径） |
| `outputName` | string | `"合并汇总.xlsx"` | 输出文件名 |
| `orderSheetName` | string | `"日报"` | 用于提取供应商顺序的模板 sheet 名 |
| `orderColumn` | string | `"C"` | 供应商列（Excel 列字母） |
| `appendUnknownVendorsToEnd` | boolean | `true` | 未知供应商是否追加到末尾 |

#### `sheetRules[].` 合并专用字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `removeColumnsByHeader` | string[] | `[]` | 需要排除的列头名列表（合并时不复制这些列） |
| `columnAliasMap` | object | `{}` | 列别名映射 `{ "源列头": "目标列头" }` |
| `sortColumn` | string | `""` | 排序依据的列头名（如"可用结存"） |
| `sortOrder` | string | `""` | `"asc"` 升序 / `"desc"` 降序 |

其余字段（`sheetName`、`headerRows`、`splitColumn`、`skipEmpty`、`outputSheetName`）与拆分共用。

### 输出命名与覆盖策略

- 输出文件名：由 `merge.outputName` 指定，默认 `"合并汇总.xlsx"`。
- 覆盖策略：遵循 `overwriteIfExists` 和 `ifExistsStrategy` 配置。默认关闭覆盖；若文件已存在，自动追加时间戳。

## 代码位置（关键文件）

| 文件 | 职责 |
|------|------|
| [services/merge/mergeEngine.js](services/merge/mergeEngine.js) | **核心引擎**：列映射、数据收集、供应商排序、Sheet 写入 |
| [services/merge/mergeService.js](services/merge/mergeService.js) | **服务编排**：参数校验、路径解析、源文件列表、调用引擎、输出写入 |
| [services/merge/mergeTypes.js](services/merge/mergeTypes.js) | **类型工具**：列号转换、列头规范化、别名映射、规则归一化、请求校验 |
| [services/split/styleCopier.js](services/split/styleCopier.js) | **样式复制**（公用）：表头/元数据/合并单元格/单元格样式复制 |
| [services/split/excelReader.js](services/split/excelReader.js) | **文件读取**（公用）：读取 `.xlsx` 工作簿 |
| [services/split/ruleManager.js](services/split/ruleManager.js) | **规则管理**（公用）：加载/合并规则 JSON |
| [services/split/errors.js](services/split/errors.js) | **错误模型**（公用）：统一错误码和 AppError 类 |
| [services/split/pathUtil.js](services/split/pathUtil.js) | **路径工具**（公用）：目录创建、文件名清洗 |

## 与拆分的对比

| 维度 | 拆分（Split） | 合并汇总（Merge） |
|------|-------------|-----------------|
| 输入 | 1 个工作簿 | N 个工作簿（目录下全部 `.xlsx`） |
| 输出 | N 个工作簿（按拆分键分组） | 1 个工作簿（按拆分键分组汇总） |
| 表头来源 | 源文件（优先）或模板 | **模板**（强制，保证输出一致性） |
| 数据行样式 | 源文件对应行样式 | **模板第一数据行样式**（统一） |
| 列映射 | 无（直接复制源结构） | 有（头匹配 + 别名 + 排除） |
| 序号 | 保留源序号 | **从 1 重新编号** |
| 公式 | 保留（复制公式引用） | **剥离**（仅保留结果值） |
| 供应商排序 | 按文件分组，无交叉排序 | 从模板提取顺序，追加未知供应商 |

## 常见问题与建议

- **源文件格式不一致怎么办？** 使用 `columnAliasMap` 做列头别名映射。对于差异较大的文件，建议先统一源文件格式或分多组规则处理。
- **输出文件公式丢失？** 这是设计行为——合并汇总的输出不应包含对源文件路径的公式引用。如需保留公式，应在拆分阶段处理。
- **某些列在输出中缺失？** 检查目标的模板中是否有该列。合并的列映射依赖于模板中存在的列头；不存在对应列的列头不会被写入。
- **数据行样式（底色/字体）与预期不符？** 合并统一使用模板第一数据行的样式。如需特定列特殊样式（如类似拆分中 `preserveSourceFillColumns`），需扩展 `writeMergedSheet` 中的样式逻辑。
- **日期列出现错位？** 检查模板与子表的日期格式是否一致。列头匹配是基于 `normalizeHeaderName` 后的字符串相等比较，如果日期格式不同（如操作系统时区差异），可能导致匹配失败。
- **处理大型文件（大量行/大量源文件）？** 合并目前是单线程内存操作。若有超大文件，建议先用拆分将数据按需分组，再对分组结果执行合并。
