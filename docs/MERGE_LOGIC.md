# 合并逻辑说明

## 1. 当前合并链路

合并功能的真实入口在：

- `services/merge/mergeService.js`
- `services/merge/mergeEngine.js`

高层流程：

1. 读取请求和规则。
2. 解析 `merge.templateFile`。
3. 扫描 `inputDir` 下的来源文件。
4. 自动排除模板文件和输出文件本身。
5. 按 `mergeSheetRules` 对来源 sheet 做列匹配和数据收集。
6. 以模板为基础写出一个合并后的工作簿。
7. 写出后做 ZIP/XML 后处理。

## 2. 当前生效的配置名

合并功能应认准以下字段：

- `merge.templateFile`
- `merge.sheetNameAliases`
- `merge.inputDir`
- `merge.outputName`
- `merge.orderSheetName`
- `merge.orderColumn`
- `merge.appendUnknownVendorsToEnd`
- `mergeSheetRules`

不要再把拆分规则、旧模板字段或共享 `sheetRules` 当作当前合并配置理解。

## 3. 模板与来源文件

当前合并逻辑里：

- 模板文件只负责结构、样式、排序参考
- 模板文件不应被当作来源数据文件再次参与合并

这点在：

- `services/merge/mergeService.js`

里通过扫描来源目录时排除模板路径和输出路径来保证。

## 4. sheet 名匹配

当前推荐策略：

- 规则层使用标准业务名
- 来源文件差异通过 `merge.sheetNameAliases` 解决

相关文件：

- `services/merge/mergeEngine.js`
- `renderer/views/MergeView.vue`

## 5. 列映射

核心逻辑在：

- `services/merge/mergeEngine.js`

合并不是按固定列号硬拷贝，而是按列头名称匹配。

典型过程：

1. 读取模板表头。
2. 读取来源 sheet 表头。
3. 对两边表头做规范化。
4. 根据 `columnAliasMap` 和排除列配置建立源列到目标列的映射。

这意味着：

- 来源文件列顺序不完全一致时仍可合并
- 但前提是表头文本或别名映射能对上

## 6. 供应商排序

供应商排序由这些字段决定：

- `merge.orderSheetName`
- `merge.orderColumn`
- `merge.appendUnknownVendorsToEnd`

逻辑大意：

- 先从模板指定 sheet 的指定列提取供应商顺序
- 合并时优先按模板已知顺序输出
- 模板里没有的新供应商，按配置决定是否追加到末尾

相关文件：

- `services/merge/mergeEngine.js`

## 7. 空供应商行处理

合并时，供应商列为空的行通常不应进入最终结果。

因此排障时如果看到：

- 汇总里多了空白行
- 行内容存在但供应商为空

先看：

- `services/merge/mergeEngine.js`

并优先检查按供应商分组和过滤空供应商行的逻辑。

## 8. 模板样式与数据样式

合并输出的表头和数据样式主要来自模板，而不是来源文件逐行样式。

相关文件：

- `services/merge/mergeEngine.js`
- `services/split/styleCopier.js`

注意：

- 合并功能更偏向“结果格式统一”
- 如果来源文件某列有特殊视觉效果，不能默认认为它会原样带到结果中

## 9. 条件格式与兼容修复

当前合并的 Office 兼容修复不应再理解成“简单复制模板条件格式”。

真实链路应理解为：

1. 模板或来源的原始条件格式 XML 被提取保留。
2. ExcelJS 写出后，空条件格式节点被清掉。
3. 需要保留的合法条件格式节点通过 OOXML 后处理重新注入。
4. `sqref` 会按最终输出行数裁剪。

相关文件：

- `services/merge/mergeEngine.js`
- `services/optimize/zipUtils.js`
- `docs/COMPATIBILITY_FIXES.md`

## 10. 视图与冻结窗格

合并结果打开后如果首屏偏到右侧，通常是继承了模板里保存过的滚动位置，而不是数据错位。

当前应从后处理层理解这个问题：

- worksheet 视图会在写出后被统一归一化
- 当前业务也可能直接取消冻结窗格

相关文件：

- `services/optimize/zipUtils.js`

## 11. 常见排障入口

### 来源 sheet 没合并进来

先看：

- `services/merge/mergeService.js`
- `services/merge/mergeEngine.js`

重点检查：

- `mergeSheetRules`
- `merge.sheetNameAliases`
- 来源目录里该文件是否被排除了

### 某列全空

先看：

- `services/merge/mergeEngine.js`

重点检查：

- 表头是否预读取正确
- `columnAliasMap` 是否正确
- 目标模板里是否真的存在该列头

### 供应商顺序不对

先看：

- `services/merge/mergeEngine.js`

重点检查：

- `merge.orderSheetName`
- `merge.orderColumn`
- 模板排序来源列本身的数据

### Office 打开修复弹窗

先看：

- `services/optimize/zipUtils.js`
- `docs/COMPATIBILITY_FIXES.md`

### 模板误被算作来源文件

先看：

- `services/merge/mergeService.js`

## 12. 验证方式

常用命令：

```bash
npm run merge
npm run compare:merge
node --test .\services\merge\mergeEngine.test.js
node --test .\services\optimize\zipUtils.test.js
```
