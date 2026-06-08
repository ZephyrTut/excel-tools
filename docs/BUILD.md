# 构建与发布流程

## 环境要求

- Node.js 20+
- pnpm 9
- Windows（构建目标为 Windows 安装包）

## 开发构建

```bash
pnpm dev
```

启动 Vite dev server + Electron 开发模式。

## 生产构建

```bash
pnpm build
```

等价于：

```bash
pnpm clean               # 清理 dist/ 和 output/
pnpm build:renderer      # Vite 构建前端
pnpm exec electron-builder --win  # NSIS 打包
```

输出目录：`dist/installers/`

| 文件 | 说明 |
|------|------|
| `Excel-Tools-Setup-{version}.exe` | NSIS 安装包 |
| `Excel-Tools-Setup-{version}.exe.blockmap` | 增量更新映射 |
| `latest.yml` | electron-updater 元数据 |

## 发布流程

发布通过 GitHub Actions 自动完成。

### 步骤

```bash
# bump 版本号、打 tag、推送到 GitHub
pnpm release patch    # 小版本
pnpm release minor    # 中版本
pnpm release major    # 大版本
```

或手动：

```bash
git tag v1.2.x && git push origin v1.2.x
```

### CI 流程（release.yml）

```
触发条件：git push v* tag 或 workflow_dispatch
  ├── Setup pnpm + Node.js
  ├── pnpm install
  ├── pnpm build:renderer
  ├── electron-builder 打包
  ├── 上传 GitHub Release（softprops/action-gh-release）
  ├── ossutil 同步到阿里云 OSS（国内镜像）
  └── git push 源码到 Gitee（国内用户查看下载说明）
```

### OSS 镜像同步

构建产物自动同步到阿里云 OSS，供国内用户免 VPN 更新：

- **Bucket：** `excel-tools-release`
- **区域：** `oss-cn-hangzhou`
- **latest.yml：** https://excel-tools-release.oss-cn-hangzhou.aliyuncs.com/latest.yml
- **安装包：** `https://excel-tools-release.oss-cn-hangzhou.aliyuncs.com/Excel-Tools-Setup-{version}.exe`

### Gitee 源码同步

每次发布自动同步源码到 Gitee（仅源码，不含 dist/ 二进制），国内用户访问 Gitee 仓库查看 README 获取下载链接：

- **Gitee 仓库：** https://gitee.com/ZephyrTut/excel-tools

OSS 和 Gitee 同步步骤均为 `continue-on-error: true`，失败不影响 GitHub Release。

## electron-builder 配置

配置在 `electron-builder.json`，关键项：

- `appId`: `com.excel-tools.app`
- `win.target`: `nsis`
- `publish`: GitHub（作为 metadata，CI 中通过 `--publish never` 禁用自动上传，改用 action-gh-release）

## 自动更新机制

详见 [main/updater.js](../main/updater.js)：

1. **国内用户：** 从阿里云 OSS 镜像检查更新（generic provider），无需 VPN
2. **海外用户：** 镜像失败后回退 GitHub（github provider）

## 调试构建

```bash
# 跳过代码签名（本地开发用）
cross-env CSC_IDENTITY_AUTO_DISCOVERY=false pnpm build
```
