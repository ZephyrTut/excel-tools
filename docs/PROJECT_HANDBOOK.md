# 总览排障手册

这份文档是这个项目的第一阅读入口，目标不是覆盖所有实现细节，而是帮助你在最短时间内回答 4 个问题：

1. 这是个什么项目，核心链路怎么走。
2. 某个问题应该先看哪一层。
3. 哪些配置名、规则名是当前真实生效的。
4. 出现常见故障时，应该从哪几个文件下手。

如果已经知道问题集中在拆分、合并或 Office 兼容性中的某一块，再继续看对应深度文档：

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [SPLIT_LOGIC.md](./SPLIT_LOGIC.md)
- [MERGE_LOGIC.md](./MERGE_LOGIC.md)
- [COMPATIBILITY_FIXES.md](./COMPATIBILITY_FIXES.md)
- [BUILD.md](./BUILD.md)

## 1. 项目是做什么的

这是一个基于 Electron 的桌面 Excel 工具，当前核心能力有三块：

- 拆分：按规则把一个总表拆成多个供应商或分组文件。
- 合并：按模板和映射关系，把多个来源文件汇总成一个结果文件。
- 优化：对 xlsx 做 ZIP/XML 级清理，解决 Office 打开报修复、外链、条件格式异常、视图偏移等兼容问题。

技术栈：

- 桌面容器：Electron
- 前端界面：Vue 3 + Element Plus
- Excel 处理：ExcelJS
- xlsx 后处理：`adm-zip` + OOXML 文本修复

## 2. 先记住的分层

遇到问题时，先判断卡在哪一层：

- `renderer/`
  负责页面、表单、日志面板、规则编辑、按钮触发。
- `main/`
  负责 Electron 主进程、IPC 桥接、Worker 调度、模板管理。
- `services/split/`
  负责拆分业务。
- `services/merge/`
  负责合并业务。
- `services/optimize/`
  负责 xlsx ZIP/XML 清理和 Office 兼容修复。

可以把真实调用链理解成：

```text
Renderer 页面
  -> window.excelTools.*
  -> main/preload.js
  -> main/ipc.js
  -> service
  -> split/merge worker 或 main 直接执行
```

## 3. 核心入口文件

先读这些文件，能最快建立全局认知：

- `main/main.js`
  Electron 应用入口。
- `main/window.js`
  创建主窗口，决定 preload 和页面加载方式。
- `main/preload.js`
  把 `window.excelTools` 暴露给前端，是前后端桥的起点。
- `main/ipc.js`
  所有 IPC 入口都在这里，排查“点按钮后到底调了什么”时优先看它。
- `main/workerRunner.js`
  拆分和合并这类重任务的 Worker 调度入口。
- `main/taskWorker.js`
  Worker 内实际执行任务。
- `renderer/views/SplitView.vue`
  拆分页。
- `renderer/views/MergeView.vue`
  合并页。
- `renderer/views/OptimizeView.vue`
  优化页。

## 4. 三条主线怎么工作

### 4.1 拆分

拆分链路的重点文件：

- `services/split/splitService.js`
  拆分任务入口，负责加载规则、读取源工作簿、加载拆分模板、准备后处理素材。
- `services/split/splitEngine.js`
  真正的拆分编排逻辑，按规则收集行、分组、生成输出工作簿。
- `services/split/excelReader.js`
  读取 workbook、sheet、表头。
- `services/split/excelWriter.js`
  把拆分结果写出为文件。
- `services/split/styleCopier.js`
  复制表头、行样式、合并单元格等。

当前值得记住的一点：

- 条件格式不再应该完全依赖 ExcelJS round-trip 保真。
- Office 兼容问题很多时候不是业务数据错，而是 `sheet.xml` 被 ExcelJS 写出了空条件格式节点，最终由 `services/optimize/zipUtils.js` 做后处理修复。

### 4.2 合并

合并链路的重点文件：

- `services/merge/mergeService.js`
  合并任务入口，负责加载规则、解析模板、扫描输入目录、排除模板和输出文件、写最终结果。
- `services/merge/mergeEngine.js`
  真正的合并编排逻辑，包括标题映射、供应商排序、写入模板 sheet、透传非合并 sheet 等。
- `services/merge/mergeTypes.js`
  合并请求和规则的校验、归一化。

当前值得记住的几件事：

- 合并功能现在使用独立模板，不应把模板文件再当作合并源文件。
- 合并规则来源是 `mergeSheetRules`，不要再回退到旧的混合字段。
- 来源 sheet 名如果不完全一致，应通过别名配置而不是模糊猜测来解决。

### 4.3 优化和兼容修复

最重要的文件：

- `services/optimize/zipUtils.js`
- `services/optimize/templateOptimizer.js`

这层负责的事情包括：

- 删除外部链接。
- 清理空的或损坏的条件格式节点。
- 重新注入保真的条件格式 XML。
- 归一化 worksheet 视图，避免打开后默认滚到很右边。
- 裁剪安全的尾部空行。
- 修复样式中的差异样式节点 `dxfs`。

如果 WPS 能开、Office 会修复，优先怀疑这里，而不是先怀疑 UI。

## 5. 当前真实规则模型

这是后续排障最容易搞混的一块。当前要认准这些字段名：

- `split.templateFile`
  拆分模板路径。
- `merge.templateFile`
  合并模板路径。
- `split.sheetNameAliases`
  拆分页的 sheet 别名映射。
- `merge.sheetNameAliases`
  合并页的 sheet 别名映射。
- `splitSheetRules`
  拆分规则数组。
- `mergeSheetRules`
  合并规则数组。

默认配置模板在：

- `config/defaultRules.json`

真正运行时加载与持久化由这里负责：

- `services/split/ruleManager.js`

结论：

- 以后看到 `sheetRules` 这种旧命名，默认把它当作历史概念，不应再作为当前主路径理解。
- 拆分和合并的模板、别名、规则数组都已经分离，排障时不要混看。

## 6. 模板模型

模板管理在：

- `services/templateStore.js`
- `main/ipc.js` 中的 `template:list`、`template:import`、`template:delete`

当前模板存储按作用域分目录：

- `templates/split`
- `templates/merge`

或者对应用户数据目录中的同结构目录。

排障时记住两点：

- 模板文件本身不是合并源数据。
- 模板功能现在按拆分和合并各自一份处理，不再共享一个旧模板概念。

## 7. UI 到主进程的桥

如果页面报下面这类错：

- `window.excelTools 不存在`
- `预读取失败`
- `An object could not be cloned`
- 按钮点击无反应

先看这三处：

- `main/preload.js`
- `main/ipc.js`
- `main/ipcPayload.js`

当前桥接的关键点：

- `main/preload.js` 用 `contextBridge.exposeInMainWorld("excelTools", api)` 暴露 API。
- 进入 IPC 前会先做 `sanitizeForIpc`。
- `sanitizeForIpc` 目前本质上是 `JSON.parse(JSON.stringify(value))`，用来剥离 Vue 响应式对象、代理对象、不可克隆对象。

这意味着：

- Renderer 往主进程传的 payload，必须是普通 JSON 风格对象。
- 如果把响应式对象、函数、复杂类实例直接塞进请求，容易触发 structured clone 错误。

## 8. 症状到文件的排障地图

### 8.1 页面打不开、桥接不存在、预读取直接失败

先看：

- `main/preload.js`
- `main/window.js`
- `main/ipc.js`
- `renderer/views/MergeView.vue`
- `renderer/views/SplitView.vue`

重点排查：

- preload 路径是否正确。
- `window.excelTools` 是否成功注入。
- renderer 是否直接在浏览器页面里跑，而不是 Electron 窗口里跑。
- 传给 IPC 的参数是否可被克隆。

### 8.2 Office 打开提示“发现内容有问题，已修复”

先看：

- `services/optimize/zipUtils.js`
- `services/split/splitEngine.js`
- `services/merge/mergeEngine.js`
- `docs/COMPATIBILITY_FIXES.md`

重点排查：

- 目标 `sheet.xml` 中是否存在空的 `<conditionalFormatting .../>`。
- 条件格式 `sqref` 是否指向了被裁掉的行。
- 差异样式 `dxfs` 是否和条件格式规则匹配。
- 视图、冻结窗格、尾部空行是否引入了额外损坏。

### 8.3 WPS 能开，Office 不能开

优先怀疑：

- 条件格式 XML 被写坏。
- ExcelJS round-trip 破坏了某些规则。
- 需要走 ZIP/XML 后处理，而不是继续在 ExcelJS 对象层面修修补补。

重点文件：

- `services/optimize/zipUtils.js`
- `services/optimize/templateOptimizer.js`

### 8.4 拆分结果数据不对、少行、多行、sheet 对不上

先看：

- `services/split/splitService.js`
- `services/split/splitEngine.js`
- `services/split/excelReader.js`
- `services/split/sheetNameMatcher.js`

重点排查：

- `splitSheetRules` 是否真的启用。
- `splitColumn`、`headerRows` 是否配置正确。
- `split.sheetNameAliases` 是否补齐了实际 sheet 名差异。
- 源工作簿实际 sheet 名和规则中的 sheet 名是否对上。

### 8.5 合并结果列映射不对、供应商排序不对、某列全空

先看：

- `services/merge/mergeService.js`
- `services/merge/mergeEngine.js`
- `renderer/components/MergeColumnMappingPanel.vue`

重点排查：

- 预读取的表头是否正确。
- 列映射是否按目标模板标题匹配。
- 供应商排序来源 `orderSheetName` / `orderColumn` 是否配置正确。
- 某个来源 sheet 是否因为别名未配置导致根本没匹配上。

### 8.6 样式不对、合并单元格不对、日报首屏偏到右边

先看：

- `services/split/styleCopier.js`
- `services/optimize/zipUtils.js`
- `services/merge/mergeEngine.js`

重点排查：

- 是 ExcelJS 复制阶段的问题，还是 XML 后处理问题。
- 是否保留了不该保留的 sheet view 偏移。
- 是否需要在后处理阶段统一重置视图状态。

## 9. sheet 名相似时怎么处理

这是业务里很常见的一类坑，比如：

- `合格品入库记录`
- `合格品入货记录`

当前推荐做法不是依赖模糊匹配，而是两层防护：

1. 在规则里明确写标准业务名。
2. 在 `sheetNameAliases` 里维护来源别名到标准名的映射。

这样做的好处：

- 规则层保持稳定，不随某个客户文件命名波动。
- 排障时可以明确知道是“规则错了”还是“别名缺了”。

相关文件：

- `services/split/sheetNameMatcher.js`
- `renderer/views/SplitView.vue`
- `renderer/views/MergeView.vue`

## 10. 常用命令

开发和运行：

```bash
npm run dev
npm start
```

打包：

```bash
npm run build
```

脚本验证：

```bash
npm run split:zhejiang
npm run compare:zhejiang
npm run merge
npm run compare:merge
```

测试：

```bash
npm test
node --test .\main\ipcPayload.test.js
node --test .\services\merge\mergeEngine.test.js
node --test .\services\optimize\zipUtils.test.js
node --test .\services\split\ruleManager.test.js
```

## 11. 自动更新机制

### 整体架构

国内用户免 VPN 更新的关键：**阿里云 OSS 镜像 + GitHub 回退**。

```
应用启动 → updater.js checkForUpdates()
             │
             ├─① OSS mirror（generic provider）
             │  https://excel-tools-release.oss-cn-hangzhou.aliyuncs.com/
             │  ├─ 成功 → 下载安装包
             │  └─ 失败 → ② GitHub 回退
             │              └─ https://github.com/ZephyrTut/excel-tools/releases
             │                 ├─ 成功 → 下载安装包
             │                 └─ 失败 → 报错
```

### 关键文件

- [main/updater.js](./main/updater.js) — 更新逻辑核心
- [.github/workflows/release.yml](../.github/workflows/release.yml) — CI 自动同步到 OSS 和部署下载页到 Cloudflare Pages

### OSS 资源

- 版本信息：https://excel-tools-release.oss-cn-hangzhou.aliyuncs.com/latest.yml
- 安装包：`https://excel-tools-release.oss-cn-hangzhou.aliyuncs.com/Excel-Tools-Setup-v{version}.exe`

### Cloudflare Pages 下载页

国内用户访问 Cloudflare Pages 下载页面获取下载链接（无需 VPN）：

- https://excel-tools.pages.dev/

### 发布流程

```
git tag v1.2.x && git push origin v1.2.x
  → GitHub Actions（release.yml）
      ├── 构建安装包（electron-builder）
      ├── 上传 GitHub Release
      ├── ossutil 同步到 OSS ✓
      └── wrangler 部署下载页到 Cloudflare Pages ✓
```

> OSS 和 Cloudflare Pages 部署步骤均为 `continue-on-error: true`，失败不影响 GitHub 发布。

### 新增发行版注意事项

如果需要在 CI 中新增需同步的文件类型（如 `.zip`），同步修改以下位置：

1. `.github/workflows/release.yml` — 添加对应的 `ossutil cp` 命令
2. 如果需 Cloudflare Pages 部署页新增内容，同步修改 `release.yml` 中的 HTML 模板

## 12. 推荐排障顺序

拿到一个问题时，建议按这个顺序走：

1. 先确认问题属于拆分、合并、优化、还是 UI/IPC。
2. 再确认是“数据错了”还是“Excel 文件结构坏了”。
3. 先读对应 service 入口文件，再进 engine。
4. 涉及 Office 修复弹窗时，直接同时看 `zipUtils.js`。
5. 涉及预读取或按钮触发异常时，直接同时看 `preload.js`、`ipc.js`、`ipcPayload.js`。
6. 涉及 sheet 名不一致时，先检查 `sheetNameAliases`，不要先改业务代码。

## 13. 最近最值得记住的坑

后续排障时，优先记住这些经验：

- Office 修复弹窗很多时候根因在条件格式 XML，而不是单元格值。
- ExcelJS 对某些条件格式类型的 round-trip 不可靠，必要时要走 OOXML 保真恢复。
- WPS 能打开不代表 Office 也能接受，Office 更容易暴露结构问题。
- `An object could not be cloned` 大概率是 renderer 传了不可克隆对象到 IPC。
- 拆分模板和合并模板已经拆开，不要再用一个模板概念理解两条链路。
- 规则数组现在分成 `splitSheetRules` 和 `mergeSheetRules`，排障时先确认看的就是这两个字段。

## 14. 阅读建议

如果你是第一次接手这个项目，建议阅读顺序：

1. 本文。
2. `main/preload.js` 和 `main/ipc.js`。
3. `renderer/views/SplitView.vue`、`renderer/views/MergeView.vue`。
4. `services/split/splitService.js`、`services/merge/mergeService.js`。
5. `services/optimize/zipUtils.js`。
6. 再根据具体问题深入看 `SPLIT_LOGIC.md`、`MERGE_LOGIC.md`、`COMPATIBILITY_FIXES.md`。
