# 项目关键决策

## 已确认的技术决策

1. 桌面容器使用 Electron。
2. 前端使用 Vue 3 + Element Plus。
3. Excel 读写主引擎使用 ExcelJS。
4. 重任务通过 Worker + IPC 执行。
5. xlsx 兼容修复采用 ZIP/XML 后处理，而不是只依赖 ExcelJS 对象层回写。

## 已确认的产品结构决策

1. 项目当前以拆分、合并、优化三条主线组织。
2. 拆分和合并使用各自独立模板。
3. 拆分和合并使用各自独立 sheet 别名映射。
4. 拆分和合并使用各自独立规则数组。

当前字段名：

- `split.templateFile`
- `merge.templateFile`
- `split.sheetNameAliases`
- `merge.sheetNameAliases`
- `splitSheetRules`
- `mergeSheetRules`

## 已确认的排障决策

1. `window.excelTools` 相关问题优先排查 preload 和 IPC，而不是先怀疑前端组件。
2. `An object could not be cloned` 优先怀疑 renderer 传了不可克隆对象到 IPC。
3. WPS 能打开但 Office 修复时，优先排查 worksheet XML、条件格式、`dxfs`、视图状态和尾部空行。
4. sheet 名不一致优先通过 `sheetNameAliases` 解决，而不是直接改业务代码做模糊匹配。

## 默认行为决策

- 默认输出目录使用 `defaultOutputDir`
- 规则未匹配到真实 sheet 时抛出明确错误
- 供应商排序优先以模板排序来源为准
- 模板文件不参与合并来源扫描
- 兼容修复优先保留原始合法条件格式，而不是粗暴清空条件格式

## 当前不再沿用的旧理解

- 不再把共享 `sheetRules` 当作当前规则模型
- 不再把一个模板概念同时用于拆分和合并
- 不再默认信任 ExcelJS 条件格式 round-trip
- 不再把 Office 修复问题主要归因为外链或普通单元格值
