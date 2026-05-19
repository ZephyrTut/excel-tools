# 合并功能修复 — 恢复文档

## 问题背景

合并功能的"预读取所有标题行"和"列头映射面板"在开发过程中因多次编辑导致了文件碎片化、代码丢失和结构损坏。以下是全部修复内容的汇总，用于在其他分支或新环境中恢复。

---

## 修复内容一览

### 1. 列头日期显示乱码

**文件**: `services/split/excelReader.js`

**改动**: `getHeadersFromWorksheet` 函数中，单元格值为 Date 或公式结果含 Date 时，格式化为 `MM-DD`（如 `05-01`）

```js
// 关键代码片段
if (value instanceof Date) {
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  header = `${m}-${d}`;
  break;
}
if (value && typeof value === 'object' && value.result instanceof Date) {
  const dt = value.result;
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  header = `${m}-${d}`;
  break;
}
```

**新增导出**: `getHeadersFromWorksheet`, `getMultipleSheetHeaders`, `getSheetHeadersWithPosition`

---

### 2. 合并引擎与面板读取表头不一致

**文件**: `services/merge/mergeEngine.js`

**改动**: 新增 `readHeaderFromCell` 函数，统一日期格式化为 MM-DD

在 `textValue` 函数之后添加：
```js
function readHeaderFromCell(cell) {
  const value = cell.value;
  if (value instanceof Date) {
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${m}-${d}`;
  }
  if (value && typeof value === 'object' && value.result instanceof Date) {
    const dt = value.result;
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${m}-${d}`;
  }
  return normalizeHeaderName(textValue(value));
}
```

**修改的函数**（使用 `readHeaderFromCell` 替换原来的 `textValue` + `normalizeHeaderName`）：
- `resolveHeaderMap`
- `mapSourceToTargetColumns` 中的源列头读取

---

### 3. 后端 IPC — 预读取 handler

**文件**: `main/ipc.js`

**import 添加**:
```js
const { getSheetNames, getSheetHeadersWithPosition } = require("../services/split/excelReader");
```

**新增 handler**（在 `task:cancel` 和 `Auto-update` 之间）：
```js
ipcMain.handle("merge:preload-headers", async (_, payload) => {
  const { inputDir, templateFile, rules } = payload || {};
  if (!inputDir || !templateFile || !Array.isArray(rules) || rules.length === 0) {
    return { rules: [] };
  }

  for (const rule of rules) {
    const key = rule.outputSheetName || rule.sheetName;
    if (!key) continue;

    // 读模板列头
    let templateHeaders = [];
    try {
      templateHeaders = await getSheetHeadersWithPosition(templateFile, key, rule.headerRows || 1);
    } catch {
      templateHeaders = [];
    }

    // 扫描子表目录
    let entries = [];
    try {
      entries = await fs.readdir(inputDir, { withFileTypes: true });
    } catch {
      entries = [];
    }
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(inputDir, entry.name))
      .filter((fp) => fp.toLowerCase().endsWith(".xlsx"))
      .filter((fp) => !path.basename(fp).startsWith("~$"))
      .filter((fp) => path.resolve(fp) !== path.resolve(templateFile));

    // 读每个子表该 sheet 的列头
    const sources = [];
    for (const filePath of files) {
      try {
        const headers = await getSheetHeadersWithPosition(filePath, rule.sheetName, rule.headerRows || 1);
        if (headers.some((h) => h !== null)) {
          sources.push({ file: path.basename(filePath), headers });
        }
      } catch {
        // 跳过无法读取的文件
      }
    }

    rule.preloadedHeaders = { templateHeaders, sources };
  }

  return { rules };
});
```

---

### 4. 前端 API 绑定

**文件**: `main/preload.js`

在 `api` 对象中添加：
```js
preloadMergeHeaders: (payload) => ipcRenderer.invoke("merge:preload-headers", payload),
```

---

### 5. 前端界面 — MergeView.vue

**文件**: `renderer/views/MergeView.vue`

完整重写。核心功能：

| 功能 | 说明 |
|------|------|
| 选择模板文件 | `pickTemplate()` → 调用 `selectTemplateFile()` API |
| 选择子表目录 | `pickInputDir()` |
| 选择输出目录 | `pickOutputDir()` |
| **预读取按钮** | `preloadAllHeaders()` → 从配置文件读 sheetRules → 调用 `preloadMergeHeaders` → 保存到配置 → 打开面板 |
| **列映射面板** | `<MergeColumnMappingPanel>` → 传入 `rule.preloadedHeaders` 作为 `preloaded-data` |
| 开始合并 | `startTask()` → 调用 `startMergeTask` |
| 配置持久化 | 预读取和面板确认后自动调用 `saveRules()` |

**关键数据流**：
```
preloadAllHeaders → backend reads headers → returns rules with preloadedHeaders
    → state.mergeSheetRules = returnedRules
    → saveRules(updatedConfig)
    → state.currentRule = returnedRules[0]
    → state.showColumnMappingPanel = true
```

---

### 6. 列映射面板

**文件**: `renderer/components/MergeColumnMappingPanel.vue`

已存在，无需额外修改。接收以下 props：
- `visible` / `rule` / `preloaded-data` / `initial-remove-columns` / `initial-column-alias-map`

**注意**: 面板的 `preloaded-data` 格式为 `{ templateHeaders: string[], sources: { file: string, headers: (string|null)[] }[] }`

---

## 恢复步骤（在新分支/环境）

```
1. excelReader.js    → 确认 getHeadersFromWorksheet / getMultipleSheetHeaders 存在且 Date→MM-DD
2. mergeEngine.js    → 确认 readHeaderFromCell 存在 + resolveHeaderMap/mapSourceToTargetColumns 使用它
3. ipc.js            → 添加 import getSheetHeadersWithPosition + merge:preload-headers handler
4. preload.js        → 添加 preloadMergeHeaders API
5. MergeView.vue     → 写入完整版本（含预读取按钮+面板集成+配置持久化）
6. MergeColumnMappingPanel.vue → 确认存在（若丢失需恢复）
```

**冲突标记**: `renderer/components/MergeHeaderMappingModal.vue` 已删除，由 `MergeColumnMappingPanel.vue` 替代。

---

## 测试验证

启动应用后：
1. 选择模板文件和子表目录
2. 点击「🔍 预读取所有标题行」
3. 面板应自动打开，显示 ABC 列对照表
4. 日期列应显示为 `05-01`, `05-02` 格式
5. 删除多余列后确认保存
6. 点击「开始合并」
