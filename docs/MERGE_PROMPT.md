# 合并汇总功能概览

## 用户操作流程

```
1. 选数据目录 ──→ 2. 选输出目录 ──→ 3. 选模板文件 ──→ 4. 配置 sheet 规则
                                                          │
                                                          ↓
                                        5. 🔍 预读取所有标题行
                                                          │
                                                          ↓
                                        6. 列头映射面板（调整删列/别名）
                                                          │
                                                          ↓
                                        7. 开始合并 → 任务完成
```

---

## UI 布局（MergeView.vue 主页面）

```
 ┌──────────────────────────────────────────────────────┐
 │ 合并汇总配置                          [⚙ 模板]       │
 ├──────────────────────────────────────────────────────┤
 │ 数据目录   [ 选择包含子表的目录 ........... ] [选择]  │
 │ 输出目录   [ 选择输出目录 ............... ] [选择]  │
 │ 排序依据   [ 日报          ▾                     ]  │
 │ 排序列     [ C  ]                                   │
 │ 未知供应商 [ ● 追加到末尾                     ]    │
 │ 输出文件名 [ 合并汇总.xlsx                    ]    │
 │ 任务状态   [ 空闲 ]  ████████████░░░░░░  50%        │
 ├──────────────────────────────────────────────────────┤
 │ [保存规则] [新增规则] [🔍 预读取所有标题行]          │
 │ [开始合并] [取消任务]                                │
 └──────────────────────────────────────────────────────┘

 ┌──────────────────────────────────────────────────────┐
 │ 合并规则（按 sheet）                                  │
 ├──┬──────┬──────────┬──────┬──────┬──────────┬──────┐ │
 │启│Sheet │标题行数   │供应商│目标  │Sheet 内  │操作  │ │
 │用│      │          │列    │模板  │排序      │      │ │
 ├──┼──────┼──────────┼──────┼──────┼──────────┼──────┤ │
 │● │日报  │    3     │  C   │ 日报 │[   ] [▾] │映射│删│ │
 │● │合格品│    1     │  C   │合格品│[   ] [▾] │映射│删│ │
 │● │出库记│    1     │  C   │出库  │[   ] [▾] │映射│删│ │
 │… │…     │    …     │  …   │ …    │…         │…   │  │
 └──┴──────┴──────────┴──────┴──────┴──────────┴──────┘

 ┌──────────────────────────────────────────────────────┐
 │ 运行日志                                              │
 │ ┌──────────────────────────────────────────────────┐ │
 │ │ [10:30:01] 进度 10% - 加载模板                   │ │
 │ │ [10:30:02] 进度 50% - 收集数据中...              │ │
 │ │ [10:30:05] 合并完成                              │ │
 │ └──────────────────────────────────────────────────┘ │
 └──────────────────────────────────────────────────────┘
```

---

## MergeColumnMappingPanel（列头对照弹窗，覆盖在主界面上方）

```
 ┌─────────────────────────────────────────────────────────────┐
 │ 列头对照 — 日报             日报 → 日报                 [×] │
 ├─────────────────────────────────────────────────────────────┤
 │ 📋 3 列已删    📄 8 个分表    🔗 2 个别名映射              │
 ├─────────────────────────────────────────────────────────────┤
 │     │  A   │  B   │  C   │  D   │  E   │  F   │  G   │ ... │
 ├─────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤     │
 │ 📌  │序号  │供应商 │上月  │入库  │出库  │当前  │备注  │     │
 │ 总表│      │名称  │结存  │      │      │库存  │      │     │
 ├─────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤     │
 │ 📄  │序号  │供应商 │上月  │入库  │出库  │ —    │备注  │     │  ← 无"当前库存"列
 │ a.xl│      │名称  │结存  │      │      │      │      │     │
 ├─────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤     │
 │ 📄  │序号  │供应商 │上月  │入库  │出库  │当前  │备注  │     │
 │ b.xl│      │名称  │结存  │      │      │库存  │      │     │
 ├─────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤     │
 │ 📄  │序号  │供应商 │上月  │入库  │出库  │当前  │备注  │     │
 │ c.xl│      │名称  │结存  │      │      │库存  │      │     │
 └─────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
   ▲           ▲                          ▲
   │           │                          └ 颜色标记差异
   │           └ 右键单击弹出操作菜单
   └ 总表行底色不同

 ┌──────────────────── 右键弹出菜单 ────────────────────┐
 │ 当前库存                                              │
 │ (a.xlsx)                                              │
 │ 总表对应：当前库存                                     │
 │ ┌────────────────────────────────────────────────┐    │
 │ │      ✕ 删除此列                                │    │
 │ └────────────────────────────────────────────────┘    │
 │ ┌────────────────────────────────────────────────┐    │
 │ │      ↔ 自动映射到对应总表列                     │    │
 │ └────────────────────────────────────────────────┘    │
 │                    [关闭]                              │
 └────────────────────────────────────────────────────────┘

 ┌─────────────────────────────────────────────────────────────┐
 │  [恢复全部]                             [取消]  [确认保存]   │
 └─────────────────────────────────────────────────────────────┘
```

### 交互要点

| 元素 | 行为 |
|------|------|
| 总表行（📌） | 固定第一行，显示模板列头 |
| 分表行（📄） | 每个源文件一行，显示该文件的实际列头 |
| 空单元格（—） | 该文件在该列无对应列头 |
| 红色底色单元格 | 该文件的列头与模板列头不一致 |
| 蓝色底色单元格 | 该列已建立别名映射 |
| 右键单击任意分表单元格 | 弹出操作菜单 |
| 删除此列 | 从 `removeColumnsByHeader` 中增删，分表独立维护 |
| 别名映射 | 写入 `columnAliasMap`，所有分表共享 |
| 日期列（05-01格式） | 自动隐藏，不显示在对照表中 |
| 恢复全部 | 清空所有删除和映射，回到初始状态 |
| 确认保存 | 将删除列和别名映射写回规则配置并持久化 |

---

## 模板选择对话框（MergeView.vue 弹窗）

```
 ┌────────────────────────────────────────────────────┐
 │ 模板文件设置                                   [×] │
 │ 合并模板用于提供样式与排序基准。                      │
 ├────────────────────────────────────────────────────┤
 │ ○  浙江华锐捷技术有限公司日报表(2).xlsx  1.2MB  [删除]│
 │ ○  湖州仓模板.xlsx                    856KB   [删除]│
 │ ●  默认模板（_default.xlsx）           120KB   🔒   │
 └────────────────────────────────────────────────────┤
 │   [📂 导入模板] [恢复默认] [不使用模板]              │
 │              [确定]       [取消]                     │
 └────────────────────────────────────────────────────┘
```

---

## 组件通信关系

```
MergeView.vue（持有全部 state）
  │
  ├── props: { rules, sourceSheetNames, templateSheetNames }
  │   └──→ MergeRuleTable.vue
  │         ├── @remove(index)  → 删除规则行
  │         ├── @select(index)  → 打开列头映射面板
  │         └── @update         → 规则内容变化（无固定 emit，直接修改 props 引用）
  │
  ├── props: {
  │     visible, rule, preloadedData,
  │     initialRemoveColumns, initialColumnAliasMap
  │   }
  │   └──→ MergeColumnMappingPanel.vue
  │         ├── @confirm({ removeColumnsByHeader, columnAliasMap })
  │         └── @cancel()
  │
  └── props: { lines }
      └──→ LogPanel.vue
            └── @clear()

---

## 后端模块关系

```
MergeView.vue（用户操作）
       │
       ▼
window.excelTools（preload 桥接）
       │
       ▼
main/ipc.js
├── merge:preload-headers  ← 预读取标题行（file-by-file + 8路并发）
│   └── 调用 excelReader.getMultipleSheetHeaders()
│
└── task:start-merge  ← 启动合并任务
       │
       ▼
main/workerRunner.js
  └── Worker 线程 → taskWorker.js → mergeService.runMergeTask()
                                           │
                                           ▼
                                    mergeService.js
                                    ├── 解析规则、路径、模板
                                    ├── 扫描源文件列表
                                    └── 调用 mergeEngine
                                           │
                                           ▼
                                    mergeEngine.js
                                    ├── resolveHeaderMap()     列头解析（由下往上）
                                    ├── mapSourceToTargetColumns()  源→目标列映射
                                    ├── buildOrderList()        供应商顺序提取
                                    ├── collectSheetRowsByVendor()  数据收集（按供应商分组）
                                    ├── orderedVendorsForSheet()  排序
                                    └── writeMergedSheet()      写入输出 sheet
                                           │
                                           ▼
                                    excelReader.js（公用）
                                    ├── readWorkbook()
                                    ├── getSheetNames()
                                    ├── getSheetHeadersWithPosition()
                                    └── getMultipleSheetHeaders()
```

---

## 核心数据流

### 配置数据（rules）

```js
{
  templateFile: "模板.xlsx",
  merge: {
    orderSheetName: "日报",
    orderColumn: "C",
    appendUnknownVendorsToEnd: true,
    outputName: "合并汇总.xlsx"
  },
  mergeSheetRules: [
    {
      enabled: true,
      sheetName: "日报",
      headerRows: 3,
      splitColumn: "C",
      outputSheetName: "日报",
      skipEmpty: true,
      removeColumnsByHeader: [],     // 用户从面板配置
      columnAliasMap: {},            // 用户从面板配置
      preloadedHeaders: {...}        // 预读取结果
    }
  ]
}
```

### 预读取数据流

```
MergeView.vue
  click "🔍 预读取所有标题行"
    → ipcMain.handle("merge:preload-headers")
      → getMultipleSheetHeaders(模板文件, [所有规则])
      → 并发读取每个源文件:
          getMultipleSheetHeaders(文件, [所有规则])
      → 按规则维度重组:
          { rules: [{
              sheetName, outputSheetName, headerRows,
              preloadedHeaders: {
                templateHeaders: [...],
                sources: [{ file, headers }]
              }
            }]
          }
    → 写入配置持久化
    → 打开 MergeColumnMappingPanel
```

### 合并任务数据流

```
MergeView.vue
  click "开始合并"
    → ipcMain.handle("task:start-merge")
      → WorkerRunner → Worker(taskWorker.js)
        → mergeService.runMergeTask(request, { logger, reportProgress })
          1. 解析规则、模板路径、源文件目录
          2. 读取模板 workbook
          3. 扫描源文件列表（排除模板和输出文件）
          4. 调用 mergeEngine.runMergeEngine({sourceFiles, templateWorkbook, rules})
             a. 对每个规则，从模板取对应 sheet
             b. resolveOrderRule() → 确定供应商排序基准 sheet
             c. collectSheetRowsByVendor() → 逐文件收集数据
                - 对每个文件、每个 sheet：
                  resolveHeaderMap(源) + resolveHeaderMap(模板)
                  → mapSourceToTargetColumns() 建立列映射
                  → 读取数据行，按 splitColumn 分组
             d. writeMergedSheet() → 写入输出 workbook
                - copyHeaderRowsWithMerges（模板样式）
                - 按供应商排序写入数据行
                - 重新编号"序号"列
                - 零填充（上月结存~可用结存）
          5. 写入输出文件
    → 通过 task:event 广播进度/完成/错误
```

---

## 关键交互细节

### 列头映射面板（MergeColumnMappingPanel）

- 展示方式：横轴是模板列，纵轴是每个源文件一行
- 每个单元格显示该文件在该列的列头名，颜色标记差异
- 右键弹出菜单：
  - **删除此列**：从 `removeColumnsByHeader` 中增删
  - **自动映射**：当源列头与模板列头不一致时，写入 `columnAliasMap`
- 数据按 per-file 独立维护删除位置（`perFileRemoved: Map<fileId, Set<origPos>>`），但保存时转为列头名去重合并
- 日期列（`MM-DD` 格式）自动隐藏

### 样式策略

- 表头样式：完全复制模板（合并单元格、字体、对齐、填充、边框）
- 数据行样式：统一使用模板第一数据行样式
- 列宽：以模板为准
- 直通 Sheet：仅复制列宽，不复制任何行数据

### 公式处理

- 所有公式剥离，只保留最终值
- 含 `{ formula, result }` 的对象提取 `result`
- 含 `{ sharedFormula, result }` 的对象提取 `result`
- `{ richText }` 拼接为纯文本

### 供应商排序

1. 从 `orderSheetName` 指定的模板 sheet 中，从 `headerRows+1` 行开始扫描 `orderColumn` 列
2. 按首次出现顺序记录供应商名（去重）
3. 所有 sheet 共享同一个排序列表
4. `appendUnknownVendorsToEnd` 控制未知供应商是否追加

### N/A 变为 0

在数据写入阶段，从"上月结存"列到"可用结存"列范围内的空白值统一填 `0`。此功能不可删除（用户明确要求保留）。

---

## 配置持久化

- 所有规则、目录选择、列头映射通过 `rules:load` / `rules:save` IPC 读写
- 存储位置：Electron `userData` 目录下的规则 JSON
- 预读取结果随 `saveRules()` 一并保存
