# 国内更新方案设计

## 问题

当前 `electron-updater` 使用 GitHub Releases 作为唯一更新源。由于 GitHub 在中国大陆访问受限，用户需要 VPN 才能检查更新和下载安装包。

## 目标

- 国内用户无需 VPN 即可自动更新
- 国际 / VPN 用户不受影响
- 零额外成本
- 最小化维护负担

## 架构

```
GitHub Actions (release.yml)
  ├── 构建安装包（同现在）
  ├── 上传到 GitHub Releases（同现在）
  └── 同步到 Gitee release 分支（新增）
                                    ↓
         Gitee raw 文件:
         https://gitee.com/ZephyrTut/excel-tools/raw/release/
           ├── latest.yml
           ├── Excel-Tools-Setup-{version}.exe
           └── Excel-Tools-Setup-{version}.exe.blockmap
                                    ↓
App (updater.js):
  ① Gitee 镜像（国内直连）── 成功 → 从 Gitee 下载
  ② Gitee 失败 ──→ 回退 GitHub（需要 VPN）
```

## 改动清单

### 1. `main/updater.js` — 双源回退逻辑

- `checkForUpdates()` 先调用 `setFeedURL()` 切换到 `generic` provider 指向 Gitee
- 如果 Gitee 检查抛异常，回退到 GitHub provider
- `downloadUpdate()` / `installUpdate()` 无变化（`autoUpdater` 已配置好下载源）

### 2. `.github/workflows/release.yml` — CI 同步到 Gitee

- 在现有构建 + GitHub Release 步骤之后新增一步
- 用 `dist/installers/` 下的产出文件创建一个独立 git repo
- 以 `release` 分支 force-push 到 Gitee
- 该步骤失败不影响主流程（GitHub Release 已有完整产物）

### 3. 前置准备

| 步骤 | 说明 |
|------|------|
| 在 Gitee 创建空仓库 `excel-tools` | 不初始化，仅作为接收推送的目标 |
| 生成 Gitee Personal Access Token | 需要 `projects` 写入权限 |
| 配置 GitHub Secret `GITEE_TOKEN` | 供 Actions 推送使用 |

### 4. 不修改的文件

- `electron-builder.json` — 保留 GitHub provider 作为构建元数据
- `main/ipc.js` — 无需改动
- `main/preload.js` — 无需改动
- `renderer/` — 无需改动

## 更新流程

```
用户点击"检查更新"
  ↓
Renderer → ipcRenderer.invoke("update:check")
  ↓
updater.checkForUpdates()
  ├── setFeedURL(generic → Gitee)
  ├── checkForUpdates()
  │    ├── 成功 → 返回更新信息
  │    └── 失败（网络错误）→
  │         setFeedURL(github)
  │         checkForUpdates() → 返回 / 抛错
  ↓
Renderer 收到结果，显示更新对话框
```

## 回退 / 降级

- **Gitee 不可用**：自动回退 GitHub，有 VPN 的用户不受影响
- **GitHub 也不可用**：抛出完整错误，Renderer 展示失败信息
- **CI Gitee 同步失败**：不影响发布，仅当次版本国内用户无法通过镜像更新，下次发布会自动覆盖

## 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| Gitee raw 文件访问被限速 | 下载慢 | 回退到 GitHub |
| Gitee token 过期 | CI 同步失败 | GitHub Actions 运行告警；不影响核心发布流程 |
| Gitee raw URL 格式变更 | 更新检查失败 | 回退到 GitHub；调整 URL |
