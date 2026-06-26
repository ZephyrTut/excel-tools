# Changelog

## [v1.2.10] - 2026-06-26

feat: 优化邮件发送 MIME 结构，增强邮件地址解析，调整发送顺序
fix: 修改全局中断快捷键为 Ctrl+Shift+X，更新相关提示信息

## [v1.2.9] - 2026-06-18

🚀 新增功能
发送渠道独立验证：微信/邮件任一配置不全时，不再丢弃整行，只跳过缺失渠道，黄色 tag 提示"配置不全"
历史记录按文件聚合：一条文件一行展示所有渠道 tag（含成功/失败/配置不全），回显时自动重新匹配而非使用过期快照
环境依赖自检：启动时自动检测 Python/wx4py，缺失项仅在有问题时显示，移除手动检测按钮
发布流程重构：pnpm release 展示提交边界，人工提炼更新日志写入 CHANGELOG.md，GitHub Release 和 Cloudflare Pages 均从 CHANGELOG.md 读取
下载空白规则模板：示例行数据匹配真实模板文件
自动安装 Python 环境：打包嵌入式 Python + 多源镜像 + 进度条
🐛 Bug 修复
修复邮箱地址在匹配列表显示为 [object Object] 的问题
修复发送历史中同邮箱多文件归属错乱（富程威邮件被归到力高）
修复 createSendPayload 丢弃 strippedChannels 导致历史缺警告 tag
修复回显历史时邮箱对象未转字符串
修复 downloadTemplate 示例数据与模板文件不一致
清空全部 按钮改用 Dialog 替代 popconfirm 弹窗
⚡ 优化
wx4py 替代 uiautomation：UIA 直接操控微信控件，删除冗余的截图/OCR 旧方案，发送后不再手动最小化
微信风控规避：open_chat 后 0.51.5s 随机停顿 + 不同群间 25s 随机间隔
邮件附件强制 .xlsx 扩展名 + 正确的 MIME 类型声明
微信发送 >100MB 文件自动跳过，建议走邮件
移除冗余的 generate-changelog.js 自动生成，改为人机协作
pnpm release 提交列表精简为最新/最旧两条 + 总数
PRD 更新为 README.md，移除 XLSX_OPTIMIZATION_GUIDE.md

## [v1.2.5] - 2026-06-09

### 🐛 Bug 修复
- resolve release workflow issues — changelog, wrangler, push, release cleanup (81f17fd)

### 🔹 其他
- release: v1.2.5 (6b26243)

## [v1.2.4] - 2026-06-09

### 🚀 新功能
- support single-file compress mode alongside folder mode (973a492)
- rewrite compression feature with Worker-based batch processing (c5cefca)
- add compress engine for ZIP/XML-level xlsx optimization (ce12d20)

### 🐛 Bug 修复
- walkDir excluding all files when outputDir equals inputDir (62f388e)
- correct compress button disabled state and polish compress UI (29cc154)
- resolve regex bugs and edge cases in compression engine (6bf3c8e)

### 🔧 杂项
- add gitignore for .claude, add compress tests, fix release.yml YAML (f4a685c)

### 🔹 其他
- release: v1.2.4 (c890419)
- release: v1.2.3 (f78aea4)
- perf: reduce split/merge startup latency across Worker and main process (3befe92)
- release: v1.2.2 (26117dd)

## [v1.2.1] - 2026-06-08

### 🚀 新功能
- add index.html for OSS static website hosting (45763bd)
- add tests for release workflow and package build script (bec8e15)
- switch domestic mirror from Tencent COS to Alibaba OSS (5f140a7)
- switch domestic mirror from Gitee git-push to Tencent COS (d097e17)
- 更新 Vite 配置，修复路径解析并添加测试用例 (dca93cd)
- 优化 GitHub Actions 工作流，添加时间记录和同步到 Gitee 的功能 (4d35580)
- add dual-source update check with Gitee mirror fallback (9f39b2e)
- rename template optimization to file compression and update related texts (483d194)
- update version display and enhance WeChat file sending functionality with group chat checks (21610dc)
- optimize SendView UX — rule help modal, folder-to-clipboard, history reuse (bc6ec68)
- simplify SMTP config UI with email provider selector and rule template helper (76b9764)
- add send tool IPC, preload, SendView, App.vue tab registration (7ae7067)
- add send backend services (ruleMatcher, emailSender, wechatController, sendHistory, sendService) (2eb3cc9)
- add parseRuleExcel — 解析发送规则 Excel (cef3b6e)

### 🐛 Bug 修复
- unify installer naming with v prefix; update download page to list all releases (7ce3fb8)
- use HEAD:main refspec for Gitee push in detached HEAD state (4cfc6cc)
- add Content-Disposition:inline for index.html OSS upload (2b1300e)
- set correct Content-Type for index.html in OSS upload (38bfea1)
- add --progress and timeout to Gitee push to avoid appearing stuck (ab081ac)
- exclude win-unpacked from Gitee sync by adding specific files only (4ed28ee)
- move Gitee sync into release.yml to fix GITHUB_TOKEN event limitation (1b7745e)
- commit missing build-renderer.mjs and fix app-builder-bin CI crash (7e03c2d)
- 修复 app-builder-bin 安装命令中的参数错误 (6b681fe)
- 重新安装 app-builder-bin 以避免 Windows 运行器上的 Go 二进制崩溃 (61a06a9)
- skip Electron binary download during pnpm install on CI (e2e3e98)
- use absolute path for askpass and disable GCM on Gitee (0042d46)
- rebuild app-builder-bin to prevent Go binary crash on CI (2151ade)
- use GIT_ASKPASS for Gitee auth to avoid token encoding issues (52bf492)
- use correct Gitee username format for git auth (f38b234)
- structuredClone error with deepCloneable + add drag-drop folder support (efc5a14)
- prevent structuredClone errors in send IPC by sanitizing return data (3f4f2b0)
- folder copy tool uses dedicated IPC, no longer requires rules (33b0a3d)
- remove duplicate try block in SendView onMounted (aff047d)

### ♻️ 重构
- improve code readability by formatting and restructuring function calls (215cfc9)

### 📝 文档
- document OSS domestic update mirror across all project files (7ae7645)
- add implementation plan for domestic update (2b41691)
- add domestic update design spec for China mainland users (7438560)

### 🔧 杂项
- add nodemailer dependency for email sending (ec51b9a)

### 🔹 其他
- release: v1.2.1 (36e3d74)
- release: v1.2.23 (33c063a)
- release: v1.2.22 (cbb28e0)
- 更新发布流程，改为使用 Cloudflare Pages 部署下载页面，移除对 Gitee 的支持；更新文档以反映新下载链接和流程；清理未使用的代码和依赖项。 (44b38a1)
- release: v1.2.21 (d5a43ce)
- release: v1.2.20 (d822155)
- ci: replace Gitee source sync with lightweight Pages deploy (9fa24d6)
- release: v1.2.19 (e044b4f)
- release: v1.2.18 (f58baa9)
- ci: replace static website with Gitee source sync for domestic distribution (5a20419)
- release: v1.2.17 (21a712d)
- release: v1.2.16 (07f664b)
- release: v1.2.15 (66983ae)
- release: v1.2.14 (0d4316d)
- release: v1.2.13 (66edf8f)
- release: v1.2.12 (1428fbc)
- release: v1.2.11 (a2d4cdb)
- release: v1.2.10 (3e29651)
- 优化 GitHub Actions 工作流，简化步骤并移除不必要的输入 (62fa75d)
- release: v1.2.9 (b7e31c1)
- release: v1.2.8 (f8d1125)
- 优化 GitHub Actions 工作流，清理注释并调整步骤名称以提高可读性 (223c1f7)
- release: v1.2.7 (3f69186)
- release: v1.2.6 (586cd00)
- release: v1.2.5 (fcb149d)
- release: v1.2.4 (4fbf38a)
- release: v1.2.3 (ed92769)
- ci: add tag input for manual workflow_dispatch trigger (a4f4a40)
- release: v1.2.2 (fd1e1d6)
- release: v1.2.1 (b8b688c)
- ci: sync installers to Gitee release branch for domestic updates (99bbf3c)
- release: v1.2.0 (ff19e19)
- Add tests for WeChat file sending functionality and implement group existence check (5d6848e)

## [v1.1.1] - 2026-05-23

### 🔹 其他
- release: v1.1.1 (ee3c091)
- update: v1.1.0版本更新 - 主要修复 Office 修复弹窗bug及其他相关小bug (38df8f4)

## [v1.1.0] - 2026-05-23

### 🚀 新功能
- enhance split functionality with conditional formatting and style handling (9163088)
- 更新 .gitignore，添加 test/ 目录；在 components.d.ts 中添加 Element Plus 组件声明；新增兼容性修复方案文档 (d303793)
- 移除冗余函数和优化列处理逻辑 (0315c5a)
- 更新 REASONIX.md 文档，优化项目结构和命令说明 (7c70e9f)
- refactor views and enhance UI components (22379b0)
- 更新 REASONIX.md 文档，优化项目结构和命令说明 (b7cb107)
- 添加文件信息获取和优化进度反馈功能，改进用户体验 (9e87000)
- remove obsolete tests and add new optimization features (f14551b)
- 更新安装包名称格式，确保一致性 (fdcf87a)
- 优化数据处理逻辑，跳过无效公式单元格并增强列头映射条件 (7411741)
- 增强合并引擎，支持读取供应商数据并优化列头映射面板 (25cb8bd)
- enhance mergeEngine with vendor handling and debugging (bdd0426)
- add zero fill range functionality and enhance merge engine (40bb8e1)
- 添加模板选择功能，统一日期格式化，修复列头读取不一致问题 (486cec6)
- 添加 release 脚本（小/中/大版本一键发布） (9e48182)
- sheet名称改为下拉框——源sheet选源文件实际sheet，输出sheet选模板sheet (438a990)
- 集成 electron-updater 增量更新 (5b06810)
- add TypeScript definitions for auto-imported components and global variables from Element Plus (5f060ba)

### 🐛 Bug 修复
- 合并汇总 — 修复共享公式导致写入失败，增加内存上限防止OOM (884d72c)
- 更新提示改为用户点击下载，显示进度条，用户决定是否重启 (9b9aa98)
- 更新 logo 图片 (734d4ae)
- 更新输出 Sheet 名称为对应模板样式 Sheet 名称，移除自动保存功能 (9cc799f)
- 恢复 #N/A 转 0 的逻辑 (d735873)
- 零填充仅用于日报sheet + hasVisibleFill 支持 indexed 索引色 (fb7b2a9)
- 可用结存底色丢失 — 多层列号搜索 + 放宽fill判定 + 保留extLst + #N/A保留原文 (2387e79)
- remove root-level compression property (not supported in electron-builder 24.x) (f2721ec)
- compression 移到 electron-builder 根级，移除无效字段 (fa8d831)
- Vite base 设为 ./ 解决 Electron 白屏；Release 只上传 exe 和 blockmap (f971622)
- 传递 GITHUB_TOKEN 给 electron-builder 用于发布 (cc71422)
- 用 CSC_IDENTITY_AUTO_DISCOVERY=false 彻底禁用代码签名 (8aae519)
- 显式设置 WIN_CSC_LINK 为空以跳过 Windows 代码签名 (7ea446b)
- 锁定 pnpm 到 v9，兼容 Node.js 20 (e114712)
- 简化 release workflow，去除重复的 setup-node 调用，修复 cache path 错误 (f81185c)

### 🔧 杂项
- 添加 sandbox/ 到 gitignore，隔离测试文件 (c9b0ed6)

### 🔹 其他
- release: v1.1.0 (1e5d8b3)
- release: v1.0.0 (ce564bc)
- release: v0.3.2 (0d84cb3)
- update: v0.3.2稳定版本 (1de2732)
- release: v0.3.1 (5c872f9)
- release: v0.3.0 (2857642)
- Refactor code structure for improved readability and maintainability (2aad69d)
- Refactor code structure for improved readability and maintainability (acac34d)
- release: v0.2.1 (f155bc4)
- release: v0.2.0 (f2d49eb)
- release: v0.1.1 (f3da8c0)
- optim: Element Plus 按需引入 + Vite sourcemap 关闭 + 代码分割 + electron-builder 压缩最大化 (66b5220)
- Merge branch 'main' of github.com:ZephyrTut/excel-tools (68a4537)
- Delete .github/workflows/release222.yml (7f10601)
- Merge: 合并远程改动，使用简化的 release workflow（去掉 bash shell，使用 setup-node 内置缓存） (72a591d)
- Add commands for managing GitHub releases (c70851d)
- Add commands for managing GitHub releases (f1899f6)

## [v1.0.0] - 2026-05-18

无显著变更

## [v0.3.2] - 2026-05-21

### 🚀 新功能
- 移除冗余函数和优化列处理逻辑 (0315c5a)
- 更新 REASONIX.md 文档，优化项目结构和命令说明 (7c70e9f)
- refactor views and enhance UI components (22379b0)
- 更新 REASONIX.md 文档，优化项目结构和命令说明 (b7cb107)
- 添加文件信息获取和优化进度反馈功能，改进用户体验 (9e87000)
- remove obsolete tests and add new optimization features (f14551b)
- 更新安装包名称格式，确保一致性 (fdcf87a)
- 优化数据处理逻辑，跳过无效公式单元格并增强列头映射条件 (7411741)
- 增强合并引擎，支持读取供应商数据并优化列头映射面板 (25cb8bd)
- enhance mergeEngine with vendor handling and debugging (bdd0426)
- add zero fill range functionality and enhance merge engine (40bb8e1)
- 添加模板选择功能，统一日期格式化，修复列头读取不一致问题 (486cec6)
- 添加 release 脚本（小/中/大版本一键发布） (9e48182)
- sheet名称改为下拉框——源sheet选源文件实际sheet，输出sheet选模板sheet (438a990)
- 集成 electron-updater 增量更新 (5b06810)
- add TypeScript definitions for auto-imported components and global variables from Element Plus (5f060ba)

### 🐛 Bug 修复
- 合并汇总 — 修复共享公式导致写入失败，增加内存上限防止OOM (884d72c)
- 更新提示改为用户点击下载，显示进度条，用户决定是否重启 (9b9aa98)
- 更新 logo 图片 (734d4ae)
- 更新输出 Sheet 名称为对应模板样式 Sheet 名称，移除自动保存功能 (9cc799f)
- 恢复 #N/A 转 0 的逻辑 (d735873)
- 零填充仅用于日报sheet + hasVisibleFill 支持 indexed 索引色 (fb7b2a9)
- 可用结存底色丢失 — 多层列号搜索 + 放宽fill判定 + 保留extLst + #N/A保留原文 (2387e79)

### 🔹 其他
- release: v0.3.2 (0d84cb3)
- update: v0.3.2稳定版本 (1de2732)
- release: v0.3.1 (5c872f9)
- release: v0.3.0 (2857642)
- Refactor code structure for improved readability and maintainability (2aad69d)
- Refactor code structure for improved readability and maintainability (acac34d)
- release: v0.2.1 (f155bc4)
- release: v0.2.0 (f2d49eb)
- release: v0.1.1 (f3da8c0)

## [v0.0.1] - 2026-05-18

### 🚀 新功能
- group history rows by file with multi-tag display; hide dependency successes (7301aa1)
- show stripped channel yellow tags in send history match status (739c86c)
- add 2-5s random delay between different group sends to avoid risk control (89a2c32)
- add random delay after open_chat (0.5-1.5s) to reduce risk control detection (8dd8c7b)
- yellow warning tags for stripped channels + remove minimize_wechat dead code (a9492e8)
- display stripped channel warnings in match, send log, and history (0099c0d)
- add warnings from strippedChannels to matchFolderFiles and history (5786e74)
- decouple wechat/email channel validation with strippedChannels (6c103ed)
- auto-install Python with multi-source mirror, progress bar, and OSS sync (617d101)
- 添加自动生成 CHANGELOG.md 的功能，并在发布时更新 (334930f)
- add dependency check functionality and UI integration (27b41d6)
- Enhance send tool with history table, unmatched items logging, echo functionality, and abort signal handling (87b6e52)
- add cancel send functionality and improve email handling (b5556ca)
- support single-file compress mode alongside folder mode (973a492)
- rewrite compression feature with Worker-based batch processing (c5cefca)
- add compress engine for ZIP/XML-level xlsx optimization (ce12d20)
- add index.html for OSS static website hosting (45763bd)
- add tests for release workflow and package build script (bec8e15)
- switch domestic mirror from Tencent COS to Alibaba OSS (5f140a7)
- switch domestic mirror from Gitee git-push to Tencent COS (d097e17)
- 更新 Vite 配置，修复路径解析并添加测试用例 (dca93cd)
- 优化 GitHub Actions 工作流，添加时间记录和同步到 Gitee 的功能 (4d35580)
- add dual-source update check with Gitee mirror fallback (9f39b2e)
- rename template optimization to file compression and update related texts (483d194)
- update version display and enhance WeChat file sending functionality with group chat checks (21610dc)
- optimize SendView UX — rule help modal, folder-to-clipboard, history reuse (bc6ec68)
- simplify SMTP config UI with email provider selector and rule template helper (76b9764)
- add send tool IPC, preload, SendView, App.vue tab registration (7ae7067)
- add send backend services (ruleMatcher, emailSender, wechatController, sendHistory, sendService) (2eb3cc9)
- add parseRuleExcel — 解析发送规则 Excel (cef3b6e)
- enhance split functionality with conditional formatting and style handling (9163088)
- 更新 .gitignore，添加 test/ 目录；在 components.d.ts 中添加 Element Plus 组件声明；新增兼容性修复方案文档 (d303793)
- 移除冗余函数和优化列处理逻辑 (0315c5a)
- 更新 REASONIX.md 文档，优化项目结构和命令说明 (7c70e9f)
- refactor views and enhance UI components (22379b0)
- 更新 REASONIX.md 文档，优化项目结构和命令说明 (b7cb107)
- 添加文件信息获取和优化进度反馈功能，改进用户体验 (9e87000)
- remove obsolete tests and add new optimization features (f14551b)
- 更新安装包名称格式，确保一致性 (fdcf87a)
- 优化数据处理逻辑，跳过无效公式单元格并增强列头映射条件 (7411741)
- 增强合并引擎，支持读取供应商数据并优化列头映射面板 (25cb8bd)
- enhance mergeEngine with vendor handling and debugging (bdd0426)
- add zero fill range functionality and enhance merge engine (40bb8e1)
- 添加模板选择功能，统一日期格式化，修复列头读取不一致问题 (486cec6)
- 添加 release 脚本（小/中/大版本一键发布） (9e48182)
- sheet名称改为下拉框——源sheet选源文件实际sheet，输出sheet选模板sheet (438a990)
- 集成 electron-updater 增量更新 (5b06810)
- add TypeScript definitions for auto-imported components and global variables from Element Plus (5f060ba)
- 更新构建脚本以支持 Windows 平台，并添加 .npmrc 配置以解决符号链接问题 (bbe6e5c)
- 添加获取工作表名称功能并更新拆分规则验证逻辑 (bd30421)
- Implement split functionality for Excel reports (80c42d6)
- 添加获取默认规则和模板文件选择对话框功能 (3225e18)
- 添加模板文件选择功能并更新相关配置 (1ad9e5a)
- add verification scripts for Excel Tools (5f19219)

### 🐛 Bug 修复
- email target should prefer same-file wechat-matched detail, not consume all matches (a5c370c)
- add strippedChannels to normalizeRule in sendPayload to preserve warning data in history (bc45e22)
- convert emailTo/emailCc objects to strings in refreshMatch to prevent [object Object] display (ebfb623)
- echoHistory re-runs refreshMatch instead of using stale snapshot; fix email object display (2001e65)
- force .xlsx extension on email attachments; skip wx4py for files >100MB (418788d)
- convert email objects to strings in echoHistory to prevent [object Object] display (bdd0d0b)
- use const arrow functions for tagName/tagType/tagLabel; fix dep check button layout (0892dc0)
- replace v-if chain with tag helpers to fix [object Object] and stripped tag; keep dep check button always visible (7cde66b)
- deep-clone email objects in plainRules to prevent IPC structuredClone error (3427f2b)
- remove redundant minimizeWechat after send (wx4py auto-minimizes) (b8b8905)
- remove redundant open_chat before send_file_to to avoid double group search (89abe74)
- unpack Python scripts from asar so Python can access them at runtime (f9c4cc8)
- upgrade Node.js to v22 in CI for wrangler v4 compatibility (d92161f)
- restore Cloudflare as single job step, add wrangler as devDep (819c60f)
- switch wrangler install back to npm from pnpm (2907879)
- resolve release workflow issues — changelog, wrangler, push, release cleanup (81f17fd)
- walkDir excluding all files when outputDir equals inputDir (62f388e)
- correct compress button disabled state and polish compress UI (29cc154)
- resolve regex bugs and edge cases in compression engine (6bf3c8e)
- unify installer naming with v prefix; update download page to list all releases (7ce3fb8)
- use HEAD:main refspec for Gitee push in detached HEAD state (4cfc6cc)
- add Content-Disposition:inline for index.html OSS upload (2b1300e)
- set correct Content-Type for index.html in OSS upload (38bfea1)
- add --progress and timeout to Gitee push to avoid appearing stuck (ab081ac)
- exclude win-unpacked from Gitee sync by adding specific files only (4ed28ee)
- move Gitee sync into release.yml to fix GITHUB_TOKEN event limitation (1b7745e)
- commit missing build-renderer.mjs and fix app-builder-bin CI crash (7e03c2d)
- 修复 app-builder-bin 安装命令中的参数错误 (6b681fe)
- 重新安装 app-builder-bin 以避免 Windows 运行器上的 Go 二进制崩溃 (61a06a9)
- skip Electron binary download during pnpm install on CI (e2e3e98)
- use absolute path for askpass and disable GCM on Gitee (0042d46)
- rebuild app-builder-bin to prevent Go binary crash on CI (2151ade)
- use GIT_ASKPASS for Gitee auth to avoid token encoding issues (52bf492)
- use correct Gitee username format for git auth (f38b234)
- structuredClone error with deepCloneable + add drag-drop folder support (efc5a14)
- prevent structuredClone errors in send IPC by sanitizing return data (3f4f2b0)
- folder copy tool uses dedicated IPC, no longer requires rules (33b0a3d)
- remove duplicate try block in SendView onMounted (aff047d)
- 合并汇总 — 修复共享公式导致写入失败，增加内存上限防止OOM (884d72c)
- 更新提示改为用户点击下载，显示进度条，用户决定是否重启 (9b9aa98)
- 更新 logo 图片 (734d4ae)
- 更新输出 Sheet 名称为对应模板样式 Sheet 名称，移除自动保存功能 (9cc799f)
- 恢复 #N/A 转 0 的逻辑 (d735873)
- 零填充仅用于日报sheet + hasVisibleFill 支持 indexed 索引色 (fb7b2a9)
- 可用结存底色丢失 — 多层列号搜索 + 放宽fill判定 + 保留extLst + #N/A保留原文 (2387e79)
- remove root-level compression property (not supported in electron-builder 24.x) (f2721ec)
- compression 移到 electron-builder 根级，移除无效字段 (fa8d831)
- Vite base 设为 ./ 解决 Electron 白屏；Release 只上传 exe 和 blockmap (f971622)
- 传递 GITHUB_TOKEN 给 electron-builder 用于发布 (cc71422)
- 用 CSC_IDENTITY_AUTO_DISCOVERY=false 彻底禁用代码签名 (8aae519)
- 显式设置 WIN_CSC_LINK 为空以跳过 Windows 代码签名 (7ea446b)
- 锁定 pnpm 到 v9，兼容 Node.js 20 (e114712)
- 简化 release workflow，去除重复的 setup-node 调用，修复 cache path 错误 (f81185c)

### ♻️ 重构
- format wechatMatches index finding for improved readability (d2e5ffc)
- remove unnecessary dependency check button, auto-check on mount is sufficient (8355caf)
- separate displayChannels/missingChannels from channels/strippedChannels for UI clarity (899068c)
- rename uiautomation to wx4py across all send-related code (fe44f3e)
- improve code readability by formatting and restructuring function calls (215cfc9)

### 📝 文档
- add send history per-file aggregation design spec (4daec7c)
- document OSS domestic update mirror across all project files (7ae7645)
- add implementation plan for domestic update (2b41691)
- add domestic update design spec for China mainland users (7438560)

### ✅ 测试
- add strippedChannels to sendPayload test expectation (0ddbce6)

### 📦 构建
- disable asar to avoid file access restrictions at runtime (49433d7)

### 🔧 杂项
- add gitignore for .claude, add compress tests, fix release.yml YAML (f4a685c)
- add nodemailer dependency for email sending (ec51b9a)
- 添加 sandbox/ 到 gitignore，隔离测试文件 (c9b0ed6)
- 准备发布流程 - 添加 .gitignore 排除 .history/，新增 release.sh 脚本、clean.js、BUILD.md 及 GitHub Actions 工作流 (49170e5)

### 🔹 其他
- modified:   renderer/views/SendView.vue (560b8aa)
- ci: fix gh release list — body not valid for list command, use view per release (314b091)
- ci: fix Cloudflare Pages deploy — use env var directly, add gh error handling (44f3248)
- release: v1.2.7 (2a57f1c)
- release: v1.2.6 (17d3b85)
- perf: split Cloudflare deploy to ubuntu job, fix workflow_dispatch tag error (cdc98c1)
- release: v1.2.5 (6b26243)
- release: v1.2.4 (c890419)
- release: v1.2.3 (f78aea4)
- perf: reduce split/merge startup latency across Worker and main process (3befe92)
- release: v1.2.2 (26117dd)
- release: v1.2.1 (36e3d74)
- release: v1.2.23 (33c063a)
- release: v1.2.22 (cbb28e0)
- 更新发布流程，改为使用 Cloudflare Pages 部署下载页面，移除对 Gitee 的支持；更新文档以反映新下载链接和流程；清理未使用的代码和依赖项。 (44b38a1)
- release: v1.2.21 (d5a43ce)
- release: v1.2.20 (d822155)
- ci: replace Gitee source sync with lightweight Pages deploy (9fa24d6)
- release: v1.2.19 (e044b4f)
- release: v1.2.18 (f58baa9)
- ci: replace static website with Gitee source sync for domestic distribution (5a20419)
- release: v1.2.17 (21a712d)
- release: v1.2.16 (07f664b)
- release: v1.2.15 (66983ae)
- release: v1.2.14 (0d4316d)
- release: v1.2.13 (66edf8f)
- release: v1.2.12 (1428fbc)
- release: v1.2.11 (a2d4cdb)
- release: v1.2.10 (3e29651)
- 优化 GitHub Actions 工作流，简化步骤并移除不必要的输入 (62fa75d)
- release: v1.2.9 (b7e31c1)
- release: v1.2.8 (f8d1125)
- 优化 GitHub Actions 工作流，清理注释并调整步骤名称以提高可读性 (223c1f7)
- release: v1.2.7 (3f69186)
- release: v1.2.6 (586cd00)
- release: v1.2.5 (fcb149d)
- release: v1.2.4 (4fbf38a)
- release: v1.2.3 (ed92769)
- ci: add tag input for manual workflow_dispatch trigger (a4f4a40)
- release: v1.2.2 (fd1e1d6)
- release: v1.2.1 (b8b688c)
- ci: sync installers to Gitee release branch for domestic updates (99bbf3c)
- release: v1.2.0 (ff19e19)
- Add tests for WeChat file sending functionality and implement group existence check (5d6848e)
- release: v1.1.1 (ee3c091)
- update: v1.1.0版本更新 - 主要修复 Office 修复弹窗bug及其他相关小bug (38df8f4)
- release: v1.1.0 (1e5d8b3)
- release: v1.0.0 (ce564bc)
- release: v0.3.2 (0d84cb3)
- update: v0.3.2稳定版本 (1de2732)
- release: v0.3.1 (5c872f9)
- release: v0.3.0 (2857642)
- Refactor code structure for improved readability and maintainability (2aad69d)
- Refactor code structure for improved readability and maintainability (acac34d)
- release: v0.2.1 (f155bc4)
- release: v0.2.0 (f2d49eb)
- release: v0.1.1 (f3da8c0)
- optim: Element Plus 按需引入 + Vite sourcemap 关闭 + 代码分割 + electron-builder 压缩最大化 (66b5220)
- Merge branch 'main' of github.com:ZephyrTut/excel-tools (68a4537)
- Delete .github/workflows/release222.yml (7f10601)
- Merge: 合并远程改动，使用简化的 release workflow（去掉 bash shell，使用 setup-node 内置缓存） (72a591d)
- Add commands for managing GitHub releases (c70851d)
- Add commands for managing GitHub releases (f1899f6)
- Refactor split functionality: Implement split engine, excel reader/writer, and error handling (4beeea2)
- modify generate-zhejiang-split (e8c5078)
- delete: remove unnecessary Excel file from test directory (1e42234)
- Refactor code structure for improved readability and maintainability (626d818)
- Initial commit (112695b)

