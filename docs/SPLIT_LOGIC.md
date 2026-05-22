# 拆分逻辑说明

## 1. 当前拆分链路

拆分功能的真实入口在：

- `services/split/splitService.js`
- `services/split/splitEngine.js`

高层流程：

1. 读取请求和规则。
2. 加载源工作簿。
3. 按 `splitSheetRules` 找到要拆分的 sheet。
4. 结合 `split.sheetNameAliases` 做 sheet 名解析。
5. 按 `splitColumn` 将数据行分组为多个 `splitKey`。
6. 为每个 `splitKey` 生成输出工作簿。
7. 写出文件后执行必要的 ZIP/XML 后处理。

## 2. 当前生效的配置名

拆分功能应认准以下字段：

- `split.templateFile`
- `split.sheetNameAliases`
- `split.skipEmptySplitKey`
- `split.trimSplitKey`
- `splitSheetRules`

不要再把 `sheetRules` 当作当前拆分主配置理解。

## 3. 规则解析

规则入口在：

- `services/split/splitService.js`
- `services/split/splitTypes.js`

关键行为：

- 仅处理启用的 `splitSheetRules`
- 按 `sheetNameAliases` 将规则中的业务名映射到实际 sheet 名
- 如果 `preserveSheetOrder = true`，输出顺序跟源工作簿一致

如果规则里的 `sheetName` 找不到真实 sheet，会抛出带建议项的错误。

## 4. sheet 名匹配

匹配逻辑在：

- `services/split/sheetNameMatcher.js`

推荐思路：

- 规则里写标准业务名
- 实际来源差异通过 `split.sheetNameAliases` 解决

例如：

- 规则使用 `合格品入库记录`
- 实际文件里出现 `合格品入货记录`
- 在别名中配置映射，而不是靠模糊猜测

## 5. 模板与源工作簿的关系

拆分支持独立模板：

- `split.templateFile`

当前链路中：

- 源工作簿负责数据内容
- 模板工作簿负责样式参考和结构参考
- 原始 OOXML 条件格式节点会单独保留，不能只依赖 ExcelJS round-trip

相关代码：

- `services/split/splitService.js`
- `services/split/styleCopier.js`
- `services/optimize/zipUtils.js`

## 6. 样式复制

样式复制主要在：

- `services/split/styleCopier.js`

负责内容：

- 表头行复制
- 数据行复制
- 列宽、行高
- 合并单元格
- 常规单元格样式

注意：

- 条件格式不是完全依靠 `worksheet.conditionalFormattings` 回写来保真
- `styleCopier.js` 当前会避免继续把条件格式当作安全的 ExcelJS round-trip 对象使用

## 7. 条件格式与 Office 兼容

这是拆分里最容易误判的一块。

过去容易认为：

- 样式丢失是因为普通 fill 没复制好

现在更常见的真实根因是：

- ExcelJS 回写后产生了空的 `<conditionalFormatting/>`
- 某些条件格式规则被写成空壳
- `sqref` 引用了输出中已经不存在的行

因此当前修复思路是：

1. 保存源 sheet 的原始条件格式 XML。
2. 生成输出后删除 ExcelJS 写出的空节点。
3. 按输出行映射重建 `sqref`。
4. 再把合法条件格式节点注入回去。

相关文件：

- `services/split/splitEngine.js`
- `services/optimize/zipUtils.js`

## 8. 视图归一化

拆分输出的日报如果打开后首屏偏到右边，通常不是数据错，而是继承了源文件历史视图状态。

当前策略：

- 不直接信任源 sheet 的 `selection`、`activeCell`、`topLeftCell`
- 输出后统一做 worksheet view 归一化
- 现在可按配置取消冻结窗格，或保留但重置到左上

相关文件：

- `services/optimize/zipUtils.js`

## 9. 尾部空行处理

用户实测“删除多余空行后 Office 可以打开”是有效线索，但当前不应做破坏性删行。

当前策略是：

- 仅安全裁剪真正无内容、无合并依赖、无条件格式依赖的尾部空行
- 这一步发生在 XML 后处理阶段

相关文件：

- `services/optimize/zipUtils.js`

## 10. 输出命名

输出目录与文件名受这些字段控制：

- `defaultOutputDir`
- `overwriteIfExists`
- `ifExistsStrategy`
- `fileName.source`
- `fileName.prefix`
- `fileName.suffix`
- `fileName.customName`

路径与命名工具：

- `services/split/pathUtil.js`

## 11. 常见排障入口

### 拆分结果 sheet 对不上

先看：

- `services/split/splitService.js`
- `services/split/sheetNameMatcher.js`

重点检查：

- `splitSheetRules`
- `split.sheetNameAliases`

### 拆分后 Office 修复弹窗

先看：

- `services/optimize/zipUtils.js`
- `docs/COMPATIBILITY_FIXES.md`

### 样式或合并异常

先看：

- `services/split/styleCopier.js`
- `services/split/splitEngine.js`

### 打开后首屏偏移

先看：

- `services/optimize/zipUtils.js`

## 12. 验证方式

常用命令：

```bash
npm run split:zhejiang
npm run compare:zhejiang
node --test .\services\split\ruleManager.test.js
node --test .\services\optimize\zipUtils.test.js
```
