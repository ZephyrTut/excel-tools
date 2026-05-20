# Excel Tools — Reasonix project memory

## Stack

- **Language:** JavaScript (Node.js), CommonJS modules (`require`/`module.exports`)
- **Desktop:** Electron 31 — main process in `main/`, renderer in `renderer/`
- **UI:** Vue 3 + Element Plus, built with Vite 5
- **Excel:** exceljs 4 for read/write/style preservation
- **Package manager:** pnpm (pnpm-lock.yaml, pnpm-workspace.yaml)

## Layout

| Path | What lives there |
|------|------------------|
| `main/` | Electron main process — `main.js`, `ipc.js` (IPC handlers), `preload.js` (contextBridge), `window.js`, `workerRunner.js`, `taskWorker.js`, `updater.js` |
| `renderer/` | Vue 3 app — `App.vue`, 4 views (Home, Split, Merge, Optimize), composables, components |
| `services/split/` | Excel split engine — `splitEngine.js`, `splitService.js`, `excelReader.js`, `excelWriter.js`, `styleCopier.js`, `ruleManager.js`, `pathUtil.js`, `errors.js` |
| `services/merge/` | Excel merge engine — `mergeEngine.js`, `mergeService.js`, `mergeTypes.js` |
| `services/optimize/` | XLSX ZIP-level optimizer — `templateOptimizer.js`, `zipUtils.js` |
| `scripts/` | Standalone CLI scripts: split generation, merge generation, comparison, release |
| `samples/` | Sample `.xlsx` data files |
| `templates/` | Style template `.xlsx` files (split/ + merge/ subdirs) |
| `config/` | `defaultRules.json` — default split rule templates |
| `docs/` | PRD, ARCHITECTURE, DECISIONS, SPLIT_LOGIC, MERGE_LOGIC, XLSX_OPTIMIZATION_GUIDE |
| `test/` | Test files directory (`.xlsx` fixtures) — vitest scans `test/**/*.test.{js,mjs}` |

## Commands

```bash
pnpm dev              # Vite dev server + Electron concurrently
pnpm build            # Clean + build renderer + electron-builder --win
pnpm start            # Production Electron app
pnpm test             # Vitest run
pnpm test:watch       # Vitest watch
pnpm release          # Publish new version (scripts/release.js)
pnpm split:zhejiang   # Run split on samples/ (scripts/generate-split.js)
pnpm merge            # Run merge (node --max-old-space-size=8192 scripts/generate-merge.js)
```

## Conventions

- **CommonJS** throughout — no ESM `import`/`export` in any source file
- **kebab-case** for service/utility files (`splitEngine.js`, `pathUtil.js`)
- **PascalCase** for Vue component/View files (`SplitView.vue`, `LogPanel.vue`)
- **Functional style** — factory functions and plain objects, no classes
- **Worker isolation** — heavy Excel ops (split/merge) run in `Worker` threads; lightweight ops (optimize, file dialog, rules) run in main process
- **IPC data flow** — Renderer → `window.excelTools.xxx()` → preload.js (contextBridge) → ipc.js (ipcMain.handle) → Service

## Watch out for

- **`pnpm` only** — `npm install` may produce a different lockfile or fail
- **Worker memory** defaults to 3072 MB; set `SPLIT_WORKER_MEMORY_MB=4096` for large files
- **Vite root** is `renderer/` — `vite.config.mjs` sets root to that directory
- **vitest.config.mjs** inlines `exceljs` and `element-plus` for correct CJS/ESM handling in tests
- **cc-switch skills** path: `C:\Users\XXK\.cc-switch\skills\` — configured in Reasonix `pathAllowed`
