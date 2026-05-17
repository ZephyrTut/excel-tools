📦 方案一：本地一键发布脚本
bash scripts/release.sh        # 自动 patch 版本 (0.1.0 → 0.1.1)
bash scripts/release.sh minor  # 小版本 (0.1.0 → 0.2.0)
bash scripts/release.sh major  # 大版本 (0.1.0 → 1.0.0)
bash scripts/release.sh 1.2.3  # 指定任意版本号
执行流程：

✅ 检查 git/gh/pnpm 是否就绪，工作区是否干净
✅ 自动升级 package.json 版本号
✅ 构建 Vite 渲染层 → electron-builder 打包
✅ 自动创建 git commit + tag (v0.1.1)
✅ git push 代码和 tag
✅ 用 gh release create 上传安装包到 GitHub Releases
前置条件： 安装 GitHub CLI 并运行 gh auth login 登录

🤖 方案二：GitHub Actions 自动发布
推送一个 tag 即可触发自动构建+发布：

git tag v0.2.0
git push origin v0.2.0
然后去 GitHub 仓库的 Actions 页面就能看到构建进度，完成后 Releases 页面自动出现安装包。

工作流配置在 .github/workflows/release.yml，策略：

使用 windows-latest runner，原生构建 Windows NSIS 安装包
跳过代码签名（开发工具不需要证书，安装时 Windows SmartScreen 会提示"不明发布者"，点"仍要运行"即可）
缓存 pnpm store 加速后续构建
🚀 推荐的工作流
日常开发提交代码 → 需要发布时：

# 1. 确保所有修改已提交
git add -A && git commit -m "完成 XX 功能"

# 2. 一键发布（自动 patch 版本并推送到 GitHub）
bash scripts/release.sh
或者嫌本地构建慢（Electron node-gyp 编译耗时），直接：

git tag v0.2.0
git push origin v0.2.0
让 GitHub Actions 在云端完成构建和发布。