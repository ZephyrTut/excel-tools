# COS Domestic Update Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken Gitee git-push sync with Tencent Cloud COS object storage for domestic update distribution, improving upload speed and reliability.

**Architecture:** GitHub Actions builds and uploads to GitHub Releases (unchanged), then uploads the 3 release artifacts (latest.yml, *.exe, *.exe.blockmap) to a public-read COS bucket via coscmd. The app's updater.js MIRROR_URL points to the COS bucket's public URL. Existing GitHub fallback logic remains intact.

**Tech Stack:** Tencent Cloud COS, coscmd (Python CLI), GitHub Actions (windows-latest), electron-updater generic provider

---

## Files to Modify

| File | Change |
|------|--------|
| `.github/workflows/release.yml` | Replace Gitee git-push step (lines 111-145) with COS upload step |
| `main/updater.js` | Change `MIRROR_URL` from Gitee to COS bucket URL |

## GitHub Secrets to Add

| Secret Name | Description | Source |
|-------------|-------------|--------|
| `COS_SECRET_ID` | Tencent Cloud API Secret ID | Tencent Cloud Console -> Access Management -> API Keys |
| `COS_SECRET_KEY` | Tencent Cloud API Secret Key | Tencent Cloud Console -> Access Management -> API Keys |
| `COS_BUCKET` | COS bucket name (e.g. `excel-tools-release`) | Created during COS setup |
| `COS_REGION` | COS region (e.g. `ap-guangzhou`) | Chosen during bucket creation |

Note: After migration, `GITEE_TOKEN` secret can be removed from GitHub (the Gitee step is deleted entirely, not just disabled).

---

### Task 1: Modify `main/updater.js` — Point MIRROR_URL to COS

**Files:**
- Modify: `main/updater.js:6`

- [ ] **Step 1: Change MIRROR_URL constant**

```diff
- const MIRROR_URL = "https://gitee.com/ZephyrTut/excel-tools/raw/release/";
+ // ── 国内更新镜像 — Tencent COS ──────────────────────────
+ const MIRROR_URL = "https://excel-tools-release.cos.ap-guangzhou.myqcloud.com/";
```

The COS URL format is: `https://<bucket-name>.cos.<region>.myqcloud.com/`

electron-updater's generic provider appends `latest.yml` to this URL when checking for updates, and artifact filenames when downloading. The trailing slash is required so that the provider constructs correct relative paths.

- [ ] **Step 2: Commit**

```bash
git add main/updater.js
git commit -m "feat: switch domestic mirror from Gitee to Tencent COS"
```

---

### Task 2: Modify `.github/workflows/release.yml` — Replace Gitee Sync with COS Upload

**Files:**
- Modify: `.github/workflows/release.yml` (lines 111-145, the entire Gitee sync step)

- [ ] **Step 1: Identify the block to remove**

Lines 111-145 contain the Gitee sync step bounded by comments:
```
      # ── 同步安装包到 Gitee（国内用户免 VPN 更新） ──────────────
```
through the closing `run: | ...` block ending with `git push gitee release --force --progress`.

Remove lines 111-145 entirely (the single `- name: Sync installers to Gitee mirror` step).

- [ ] **Step 2: Add the COS upload step in its place**

Append after the "Record release upload timing" step (line 109):

```yaml
      # ── 同步安装包到 Tencent COS（国内用户免 VPN 更新） ────────
      - name: Sync installers to Tencent COS mirror
        continue-on-error: true
        timeout-minutes: 15
        env:
          COS_SECRET_ID: ${{ secrets.COS_SECRET_ID }}
          COS_SECRET_KEY: ${{ secrets.COS_SECRET_KEY }}
          COS_BUCKET: ${{ secrets.COS_BUCKET }}
          COS_REGION: ${{ secrets.COS_REGION }}
        shell: pwsh
        run: |
          if (-not $env:COS_SECRET_ID) {
            Write-Host "COS_SECRET_ID is empty, skip COS sync."
            exit 0
          }

          Write-Host "Installing coscmd..."
          pip install coscmd -q

          Write-Host "Configuring coscmd..."
          coscmd config -a "$env:COS_SECRET_ID" -s "$env:COS_SECRET_KEY" -b "$env:COS_BUCKET" -r "$env:COS_REGION"

          Write-Host "Uploading latest.yml..."
          coscmd upload dist/installers/latest.yml /latest.yml

          Write-Host "Uploading installer and blockmap..."
          Get-ChildItem -Path dist/installers -Filter "*.exe" | ForEach-Object {
            coscmd upload $_.FullName /$($_.Name)
          }
          Get-ChildItem -Path dist/installers -Filter "*.exe.blockmap" | ForEach-Object {
            coscmd upload $_.FullName /$($_.Name)
          }

          Write-Host "COS sync complete."
```

Key design decisions in this step:
- `continue-on-error: true` — COS upload failure does not fail the release (same as Gitee step)
- `timeout-minutes: 15` — conservative, accounts for cross-Pacific upload of ~100MB files
- Uses `pwsh` shell (native on windows-latest) instead of `bash` — avoids git bash overhead
- Pip install of coscmd is quick (~30s) on the windows-latest runner which has Python pre-installed
- Individual file uploads (not recursive directory) — explicit, avoids uploading anything unexpected
- Each file uploaded to root path `/` in the bucket
- Empty COS_SECRET_ID check skips the step gracefully (useful for PRs from forks)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: replace Gitee git-push sync with Tencent COS upload"
```

---

### Task 3: (Manual) Tencent Cloud COS Setup

This is a one-time manual setup by the user. No code changes.

- [ ] **Step 1: Create Tencent Cloud account and enable COS**
  1. Go to https://console.cloud.tencent.com/
  2. Register an account (if not already registered)
  3. Search for "对象存储 COS" (Object Storage)
  4. Activate the COS service (free tier available)

- [ ] **Step 2: Create a bucket with public-read access**
  1. Go to COS Console -> Bucket List -> Create Bucket
  2. Configuration:
     - **Name:** `excel-tools-release` (must match the bucket name used in CI and MIRROR_URL)
     - **Region:** `ap-guangzhou` (Guangzhou — good international bandwidth and fast for domestic users)
     - **Access Control:** Choose "公有读私有写" (public-read, private-write)
     - **Bucket Limits:** Default settings, no special limits needed
  3. Click "确定" (Confirm)

- [ ] **Step 3: Verify public read access**
  1. Upload a test file manually via the COS console
  2. Try accessing it via URL without authentication:
     ```
     curl https://excel-tools-release.cos.ap-guangzhou.myqcloud.com/test.txt
     ```
  3. Expected: file content returned (200 OK), no auth header needed

- [ ] **Step 4: Create API key (SecretId + SecretKey)**
  1. Go to https://console.cloud.tencent.com/cam/capi
  2. Click "新建密钥" (Create Key)
  3. A pair of `SecretId` and `SecretKey` will be generated
  4. Copy both values immediately — `SecretKey` will not be shown again after leaving the page

- [ ] **Step 5: Configure GitHub Secrets**
  1. Go to GitHub repo -> Settings -> Secrets and variables -> Actions
  2. Click "New repository secret"
  3. Add these 4 secrets:

  | Name | Value |
  |------|-------|
  | `COS_SECRET_ID` | The SecretId from Step 4 |
  | `COS_SECRET_KEY` | The SecretKey from Step 4 |
  | `COS_BUCKET` | `excel-tools-release` (must match Step 2) |
  | `COS_REGION` | `ap-guangzhou` (must match Step 2) |

  4. (Optional) Remove the old `GITEE_TOKEN` secret since it is no longer needed.

- [ ] **Step 6: Verify bucket exists**
  1. Access the COS console bucket list
  2. Confirm `excel-tools-release` appears with status "已创建" (created)
  3. Note the bucket domain shown in "域名管理" tab — should match:
     `excel-tools-release.cos.ap-guangzhou.myqcloud.com`

---

## COS URL Format Details for electron-updater Generic Provider

The generic provider in electron-updater constructs download URLs as follows:

- **Update metadata check:** `<MIRROR_URL>latest.yml`
  - Final URL: `https://excel-tools-release.cos.ap-guangzhou.myqcloud.com/latest.yml`
- **Artifact download:** `<MIRROR_URL><artifact-name-from-latest.yml>`
  - Example: `https://excel-tools-release.cos.ap-guangzhou.myqcloud.com/Excel-Tools-Setup-1.2.16.exe`
- The trailing `/` on MIRROR_URL is critical — without it, the generic provider builds incorrect paths

The bucket's static website endpoint (`<bucket>.cos.<region>.myqcloud.com`) serves files directly with Content-Type based on file extension. For `.exe` files, COS sets `application/octet-stream` and for `.yml` it sets `text/yaml` or `application/octet-stream` depending on configuration. electron-updater handles the binary download correctly regardless.

---

## Free Tier Budget

| Resource | Free Tier Limit | Expected Usage | Headroom |
|----------|----------------|----------------|----------|
| Storage | 50 GB | ~300 MB per release (exe + blockmap + yml), assuming 10 releases: ~3 GB | 47 GB |
| Monthly traffic | 10 GB outbound | ~100 MB per download, ~100 downloads = 10 GB | Breakeven at ~100 downloads/month |
| PUT requests | 1,000,000/month | ~3 per release | Ample |

If monthly traffic exceeds 10 GB, standard pricing applies (~0.09 CNY/GB for Chinese mainland, ~0.07 USD/GB for global). For a small desktop app, this is unlikely to be an issue.

---

## Verification Steps

| # | Check | Method |
|---|-------|--------|
| 1 | COS bucket public-read works | `curl https://excel-tools-release.cos.ap-guangzhou.myqcloud.com/latest.yml` (should return the file without auth) |
| 2 | CI upload works | Trigger a workflow_dispatch release on a test tag, check the COS sync step logs for "Upload complete" messages |
| 3 | Files appear in bucket | Visit COS console -> Bucket List -> excel-tools-release -> File List. Should see latest.yml + .exe + .blockmap |
| 4 | Generic provider resolves correctly | In a test build, set `MIRROR_URL` to COS URL, run `checkForUpdates()`, verify it reads `latest.yml` and returns update info |
| 5 | EXE download works | Download the .exe via browser at the COS URL, verify checksum matches the original |
| 6 | GitHub fallback still works | Temporarily set MIRROR_URL to an invalid URL, run `checkForUpdates()`, verify it falls back to GitHub (check console log for "镜像源检查失败，回退 GitHub") |
| 7 | CI failure is non-blocking | Intentionally set wrong COS_SECRET_ID, trigger a release, verify GitHub Release step still completes and the CI step shows "continue-on-error: true" skip |
| 8 | Compare upload speed | Check CI logs: note the duration of the COS upload step. Expect significantly faster than the old Gitee git-push (which took several minutes for 100MB) |

---

## Rollback Plan

If COS upload fails or is too slow, rollback is straightforward:

1. **Revert `main/updater.js`:** Change `MIRROR_URL` back to `https://gitee.com/ZephyrTut/excel-tools/raw/release/`
2. **Revert `.github/workflows/release.yml`:** Restore the Gitee git-push step (preserved in git history at commit `ab081ac`)
3. Both changes are simple atomic reverts — no data migration or coordination needed
