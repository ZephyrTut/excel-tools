#!/usr/bin/env bash
#
# release.sh — 一键构建、打包并发布到 GitHub Releases
#
# 用法:
#   bash scripts/release.sh          # 自动 patch 版本 (0.1.0 → 0.1.1)
#   bash scripts/release.sh minor    # 小版本 (0.1.0 → 0.2.0)
#   bash scripts/release.sh major    # 大版本 (0.1.0 → 1.0.0)
#   bash scripts/release.sh 1.2.3    # 指定版本号
#
# 前置条件:
#   1. git 仓库已配置好远程 origin
#   2. gh (GitHub CLI) 已安装并登录 (gh auth login)
#   3. pnpm 已安装
#   4. 工作区干净 (无未提交修改)
#
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1" >&2; }

# ---- 检查前置条件 ----
check_prereqs() {
  local missing=0

  if ! command -v git &>/dev/null; then
    err "未安装 git"; missing=1
  fi
  if ! command -v pnpm &>/dev/null; then
    err "未安装 pnpm"; missing=1
  fi
  if ! command -v gh &>/dev/null; then
    err "未安装 gh (GitHub CLI)" 
    err "  安装: https://cli.github.com/"
    missing=1
  fi

  # 检查 gh 是否已登录
  if command -v gh &>/dev/null; then
    if ! gh auth status --show-token 2>/dev/null | grep -q "Logged in"; then
      err "gh 未登录，请先运行: gh auth login"
      missing=1
    fi
  fi

  if [ "$missing" -ne 0 ]; then
    exit 1
  fi

  # 检查工作区是否干净
  if ! git diff-index --quiet HEAD --; then
    err "工作区有未提交的修改，请先 commit 或 stash"
    exit 1
  fi

  # 检查是否在 main/master 分支
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD)
  if [ "$branch" != "main" ] && [ "$branch" != "master" ]; then
    warn "当前不在 main/master 分支 (当前: $branch)"
    read -rp "  是否继续? [y/N] " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
      echo "已取消"
      exit 1
    fi
  fi

  log "前置条件检查通过"
}

# ---- 版本号处理 ----
bump_version() {
  local bump_type="${1:-patch}"

  case "$bump_type" in
    patch|minor|major)
      log "自动升级 ${bump_type} 版本 ..."
      pnpm version "$bump_type" --no-git-tag-version
      ;;
    *)
      # 自定义版本号
      log "设置版本为 ${bump_type} ..."
      pnpm version "$bump_type" --no-git-tag-version
      ;;
  esac
}

# ---- 构建 ----
build_app() {
  # 清理旧构建产物，避免 Windows 文件锁冲突
  log "清理旧构建产物 ..."
  pnpm clean

  log "构建渲染层 (Vite) ..."
  pnpm build:renderer

  log "打包 Electron 应用 ..."
  pnpm exec electron-builder --config electron-builder.json
}

# ---- Git Tag & Commit ----
tag_release() {
  local version
  version=$(node -p "require('./package.json').version")
  local tag="v${version}"

  # 检查 tag 是否已存在
  if git rev-parse "$tag" &>/dev/null 2>&1; then
    err "Tag ${tag} 已存在，请检查版本号"
    exit 1
  fi

  log "创建 commit: release v${version}"
  git add package.json
  git commit -m "release: v${version}"

  log "创建 tag: ${tag}"
  git tag -a "$tag" -m "release: v${version}"
}

# ---- 发布到 GitHub Releases ----
publish_release() {
  local version
  version=$(node -p "require('./package.json').version")
  local tag="v${version}"

  # 查找构建产物
  local installer_dir="dist/installers"
  if [ ! -d "$installer_dir" ]; then
    err "未找到构建产物目录: ${installer_dir}"
    err "请检查 electron-builder 是否成功运行"
    exit 1
  fi

  # 收集所有要上传的产物 (.exe, .dmg, .AppImage, .zip, .deb, .rpm, .pacman, blockmap, yml)
  local assets=()
  while IFS= read -r -d '' f; do
    assets+=("$f")
  done < <(find "$installer_dir" -type f \( \
    -name "*.exe" -o -name "*.dmg" -o -name "*.AppImage" -o \
    -name "*.zip" -o -name "*.deb" -o -name "*.rpm" -o \
    -name "*.pacman" -o -name "*.blockmap" -o -name "*.yml" \
  \) -print0 2>/dev/null || true)

  if [ ${#assets[@]} -eq 0 ]; then
    err "未找到任何可发布的构建产物"
    err "检查目录 ${installer_dir} 下的文件:"
    ls -la "$installer_dir" 2>/dev/null || echo "(目录为空)"
    exit 1
  fi

  # 先 push commit 和 tag
  log "推送到远程 ..."
  git push origin HEAD
  git push origin "$tag"

  # 创建 Release 并上传产物
  log "创建 GitHub Release ${tag} ..."
  local title="v${version}"
  local notes="## Excel Tools v${version}\n\n请从下方 Assets 下载对应平台的安装包。"

  gh release create "$tag" \
    --title "$title" \
    --notes "$notes" \
    "${assets[@]}"

  log "发布成功! https://github.com/$(git remote get-url origin | sed 's/.*github.com[:\/]//;s/\.git$//')/releases/tag/${tag}"
}

# ---- 主流程 ----
main() {
  echo ""
  echo -e "${CYAN}══════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  Excel Tools — 一键发布到 GitHub Releases${NC}"
  echo -e "${CYAN}══════════════════════════════════════════════${NC}"
  echo ""

  # 项目根目录
  cd "$(git rev-parse --show-toplevel)"

  check_prereqs

  local version_before
  version_before=$(node -p "require('./package.json').version")
  echo ""
  echo -e "当前版本: ${YELLOW}${version_before}${NC}"
  echo ""

  # 版本处理
  local bump_type="${1:-patch}"
  bump_version "$bump_type"

  local version_after
  version_after=$(node -p "require('./package.json').version")
  echo ""
  echo -e "新版本:   ${GREEN}${version_after}${NC}"
  echo ""

  # 构建
  echo ""
  echo -e "${YELLOW}══════ 开始构建 ══════${NC}"
  build_app

  # Tag & Release
  echo ""
  echo -e "${YELLOW}══════ 发布到 GitHub ══════${NC}"
  tag_release
  publish_release

  echo ""
  echo -e "${GREEN}══════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  发布完成! 🚀${NC}"
  echo -e "${GREEN}  版本: ${version_after}${NC}"
  echo -e "${GREEN}══════════════════════════════════════════════${NC}"
  echo ""
}

main "$@"
