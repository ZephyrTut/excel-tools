# 拆分逻辑说明

## 概要
本文件列出当前 `日报` 表拆分（split）流程的实现逻辑，目的为保证数据与视觉样式（尤其是“可用结存”列的底色）在拆分输出中保持与源文件一致，并修复因模板不足导致的合并与零填充问题。

## 高级流程
1. 读取请求：包含 `inputFile`、`templateFile`（可选）、`outputDir`、`sheetRules` 等配置。
2. 对每个启用的 `sheetRule`（例如 `sheetName: "日报"`）按 `headerRows` 确定表头区，并按 `splitColumn` / `splitBy` 把数据行分组为多个输出文件键（splitKey）。
3. 为每个 splitKey 构建输出工作簿：
   - 复制表头（保留合并区域和行样式）；
   - 复制数据行并按规则应用样式复制选项（见“样式复制”）；
   - 写入并保存为配置的文件名格式。
4. 运行后验证（可选）：通过比较脚本对比源表与生成表中关键列（如 `可用结存`）的填充，确保一致。

## 关键实现细节
- 表头来源：优先使用**源文件（source sheet）**作为表头/元数据来源以保留源端的合并区域与零填充覆盖；仅在需要时使用模板。
- 拆分键（splitKey）：由 `sheetRules.splitColumn` 指定的列（例如列 `C`）按 `splitBy`（通常为 `cellValue`）提取并按配置 `trimSplitKey` / `skipEmptySplitKey` 处理。

### 可用结存（`可用结存`）列的样式保留
- 目标：`可用结存` 列每个数据单元格的底色（红/黄）必须与源文件完全一致。
- 检测列：优先在表头中查找与文本**完全等于** `可用结存` 的列；若未找到，使用硬编码回退列列表 `DAILY_REPORT_AVAILABLE_STOCK_FALLBACK_COLUMNS = [13]`（即第 13 列，基于历史模板约定）。
- 样式复制策略：对于被标记需要保留源端填色的列，`styleCopier` 会强制使用 `sourceCell.fill`（而非模板或默认样式）。
- 条件格式：若源表的颜色是由条件格式驱动（常见情形），拆分逻辑会把 `worksheet.conditionalFormattings` 整体从源表复制到目标表，以恢复基于规则的视觉效果。

### 合并与零填充
- 问题：模板可能缺少某些日期列的合并或零填充（例如 5-29 到 5-31 未与“入库”合并，下面数据未被填 0）。
- 解决：表头使用源表作为基线（包含合并区间），复制时保留源端合并（`copyHeaderRowsWithMerges`）。同时根据 `resolveZeroFillColumns` 识别需要零填充的日期列（基于表头包含关键字），并在数据区对缺失或模板未覆盖的列进行零填充。
- 零填充关键字示例：`["入库","出库","领跑良品退回","零跑退回良品"]`（若需要可扩展）。

### 标题/关键词匹配规则
- 为避免误匹配（例如表格顶部说明性文字包含关键字），用于判定 `可用结存` 的匹配是**精确相等**（`text === "可用结存"`），而非包含式匹配。

### 输出命名与覆盖策略
- 输出文件名依据请求中的 `fileName` 配置（如 `{ source: "splitKey", prefix: "", suffix: "日报表" }`）生成。
- 覆盖策略支持 `overwriteIfExists` 与 `ifExistsStrategy`（如 `timestamp`）等选项，由上层请求控制。

## 代码位置（关键文件）
- 核心拆分引擎: [services/split/splitEngine.js](services/split/splitEngine.js)
- 样式/单元格复制: [services/split/styleCopier.js](services/split/styleCopier.js)
- 拆分服务入口: [services/split/splitService.js](services/split/splitService.js)
- 读写工具: [services/split/excelReader.js](services/split/excelReader.js), [services/split/excelWriter.js](services/split/excelWriter.js)
- 生成脚本（测试/演示）: [generate-zhejiang-split.js](generate-zhejiang-split.js)
- 比较/验证工具: [excel-compare-core.js](excel-compare-core.js), [compare-with-output.js](compare-with-output.js)

## 验证与测试流程
- 使用 `generate-zhejiang-split.js` 在 `test/` 目录上跑一次拆分并触发内置的“可用结存”填色比较；脚本会在发现颜色差异时抛错以便回归检测。
- 同时可用 `compare-with-output.js` 对比更多项目（值/合并/样式/填充）。

## 可配置项与扩展点
- `DAILY_REPORT_AVAILABLE_STOCK_FALLBACK_COLUMNS`：回退列数组，可按需要调整。
- 表头关键字：`resolveZeroFillColumns` 的关键字数组可扩展以覆盖更多业务列。
- 是否复制条件格式：当前默认复制源表的 `conditionalFormattings`，若需限制到仅某些规则可在 `styleCopier` 中加入白名单。

## 常见问题与建议
- 如果打开生成的 xlsx 看不到颜色，先确保没有同时打开旧文件（Windows 文件锁可能阻止覆盖）；关闭 Excel 后重新打开生成文件检查。
- 若某些颜色仍然缺失，确认源文件中颜色是否由条件格式驱动（而非单元格静态 `fill`），必要时检查 `worksheet.conditionalFormattings` 是否存在并正确被复制。
- 模板并非始终权威：若模板缺合并/列，优先使用源表的表头以保证结构一致性。

---
如需我把这份文档转换为项目 README 的一部分、加入到 docs/ 的更详细版本，或将关键逻辑提取为可配置的参数表，请告诉我要做哪种扩展。
