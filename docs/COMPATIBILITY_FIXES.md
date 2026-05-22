# Excel 兼容性修复说明

## 1. 文档目的

这份文档只解释当前项目里真正还在使用的 Office 兼容修复思路，重点覆盖：

- WPS 可以打开，但 Office 会提示修复
- 修复日志指向 `/xl/worksheets/sheet*.xml`
- 条件格式丢失、空壳、越界
- 打开后视图偏到右边
- 尾部空行引发的结构问题

核心代码入口：

- `services/optimize/zipUtils.js`
- `services/optimize/templateOptimizer.js`

## 2. 现在的核心判断

如果出现下面这种现象：

- WPS 正常
- Office 报“发现内容有问题，已修复”
- 修复日志指向 `sheet1.xml`、`sheet3.xml` 之类的 worksheet XML

当前应优先怀疑：

- 条件格式 XML
- worksheet 视图状态
- 尾部空行和引用范围

而不是优先怀疑：

- 普通单元格值
- UI 层
- 单纯的模板路径问题

## 3. 条件格式是主修复路径

这是当前最重要的结论。

项目里曾经遇到的真实根因是：

- ExcelJS 对某些条件格式类型 round-trip 不可靠
- 写出后会产生空的 `<conditionalFormatting .../>`
- 某些节点虽然存在，但内部没有合法 `cfRule`
- `sqref` 可能仍引用被删掉或不存在的行

因此现在的修复思路不是“继续信任 ExcelJS 回写条件格式”，而是：

1. 从源工作簿或模板工作簿提取原始条件格式 XML。
2. 输出后删除 ExcelJS 生成的空条件格式节点。
3. 删除无规则的损坏条件格式节点。
4. 按最终输出行数或行映射重建 `sqref`。
5. 再将合法的原始条件格式节点注入回 worksheet XML。

相关函数集中在：

- `extractConditionalFormattingNodes`
- `removeConditionalFormattingNodes`
- `rebuildConditionalFormattingNodes`
- `insertConditionalFormattingNodes`
- `applyWorksheetTransform`

都位于：

- `services/optimize/zipUtils.js`

## 4. 拆分和合并对条件格式的处理差异

### 拆分

拆分不能直接照搬原始条件格式引用，因为输出只保留部分数据行。

因此需要：

- 建立 `sourceRow -> targetRow` 映射
- 用映射去重建 `sqref`
- 删除已不存在源行的引用

### 合并

合并更偏向保留模板语义。

因此通常：

- 先保留模板条件格式结构
- 再按最终输出的最大行做裁剪
- 不去重新推导更复杂的业务规则

## 5. 差异样式 `dxfs`

条件格式不仅要看 worksheet XML，也要看 `xl/styles.xml` 中的差异样式节点。

如果只恢复了 `<conditionalFormatting>`，但没有同步保住 `dxfs`，Office 仍可能修复或显示异常。

当前项目会提取并恢复差异样式节点：

- `extractDifferentialStylesNode`
- `applyStylesTransform`

相关文件：

- `services/optimize/zipUtils.js`

## 6. 视图偏移问题

如果日报打开后第一眼看不到左侧数据，需要拖回去，根因通常不是数据列错位，而是工作表保存了历史滚动位置。

典型表现：

- `topLeftCell` 很偏右
- `activeCell` 落在右侧远处
- 冻结窗格与 selection 不一致

当前修复策略：

- 不直接复制源或模板里的旧 `selection`
- 写出后统一归一化 worksheet view
- 可按需要保留或清除冻结窗格
- 让首屏回到左上可见区域

关键函数：

- `normalizeWorksheetView`

相关文件：

- `services/optimize/zipUtils.js`

## 7. 尾部空行处理

用户实测“用 WPS 删除多余空行后，Office 不再报错”说明空尾行确实可能参与触发问题。

但当前实现不应直接模拟人工删行，而是做更安全的 XML 裁剪：

- 仅裁掉真正位于尾部的空行
- 不动仍被合并区域引用的行
- 不动仍被条件格式引用的行
- 不动仍有真实值、公式、内联字符串的行

关键函数：

- `trimTrailingEmptyRows`
- `collectProtectedRowRanges`

相关文件：

- `services/optimize/zipUtils.js`

## 8. 外部链接清理

如果模板带有 `externalLinks`，ExcelJS 加载和回写后容易留下不一致关系。

因此模板在进入 ExcelJS 之前会先做外链清理。

相关函数：

- `stripExternalLinks`
- `stripExternalLinksFromEntries`

相关文件：

- `services/optimize/zipUtils.js`
- `services/split/splitService.js`
- `services/merge/mergeService.js`

## 9. `NaN` 与兼容性属性

这是辅助修复项，不是现在最核心的主线，但依然保留：

- 将 `<v>NaN</v>` 替换为合法值
- 清理部分 `x14ac:*` 属性

相关函数：

- `cleanupXmlText`

注意：

- 这些修复不能替代条件格式修复
- 如果 Office 修复日志明确指向条件格式，优先排查条件格式节点和 `dxfs`

## 10. 当前排障顺序

当用户反馈“WPS 可以，Office 不行”时，建议顺序：

1. 解压或读取目标 xlsx 的 worksheet XML。
2. 看是否存在空的 `<conditionalFormatting/>`。
3. 看条件格式 `sqref` 是否越界。
4. 看 `styles.xml` 里的 `dxfs` 是否仍在。
5. 看 `sheetViews` 里的 `topLeftCell`、`activeCell` 是否偏右。
6. 看尾部是否有无意义空行但仍被结构引用。

## 11. 当前不应再沿用的旧理解

以下理解现在都不够准确：

- “只要把 `worksheet.conditionalFormattings` 复制过去就行”
- “Office 修复主要是外链导致的”
- “删掉所有条件格式最省事”
- “只要去掉冻结窗格就一定能修好首屏问题”

更准确的理解是：

- 主问题在 OOXML 层
- 需要保住原始合法条件格式，而不是粗暴清空
- 视图、尾部空行、`dxfs` 都要一起考虑

## 12. 相关验证

建议优先跑：

```bash
node --test .\services\optimize\zipUtils.test.js
```

如果是拆分问题，再配合：

```bash
npm run split:zhejiang
npm run compare:zhejiang
```

如果是合并问题，再配合：

```bash
npm run merge
npm run compare:merge
```
