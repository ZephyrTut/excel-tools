# Excel Tools — Quick Reference

## Stack

- **Language:** JavaScript (Node.js), CommonJS modules
- **Desktop:** Electron 31 (main process in `main/`, renderer in `renderer/`)
- **UI:** Vue 3 + Element Plus, built with Vite 5
- **Excel:** exceljs for reading, writing, style preservation
- **Package manager:** pnpm (see `pnpm-lock.yaml`)
- **Worker:** background threads via Node.js `Worker` for non-blocking split/merge tasks

## Layout

| Path | What lives there |
|------|------------------|
| `main/` | Electron main process, IPC bridge, preload, task/worker orchestration |
| `renderer/` | Vue 3 app — App.vue, 4 views (Home, Split, Merge, Optimize), components |
| `services/split/` | Excel split engine — reader, writer, split logic, style copier, rules |
| `services/merge/` | Excel merge engine — column mapping, vendor ordering, passthrough |
| `services/optimize/` | XLSX optimizer — ZIP-level template compression |
| `scripts/` | Standalone CLI scripts for split/merge generation & comparison |
| `samples/` | Sample source `.xlsx` data files |
| `templates/` | Style template `.xlsx` files |
| `config/` | Default split rule templates (`defaultRules.json`) |
| `docs/` | PRD, architecture, decisions, logic guides, optimization guide |
| `test/` | Test files directory (reserved for unit tests) |

## Commands

```bash
pnpm dev              # Start Vite dev server + Electron concurrently
pnpm build:renderer   # Vite build for renderer only
pnpm build            # Clean + build renderer + electron-builder --win
pnpm start            # Run production Electron app
pnpm test             # Vitest run
pnpm test:watch       # Vitest watch mode
pnpm clean            # Clean build artifacts
pnpm split:zhejiang   # Run split on samples/  (scripts/generate-split.js)
pnpm compare:zhejiang # Compare split output with source
pnpm merge            # Run merge (node --max-old-space-size=8192 scripts/generate-merge.js)
pnpm compare:merge    # Compare merge output with source
pnpm release          # Release new version (scripts/release.js)
```

## Key files

- `CLAUDE.md` — Project navigation index (auto-loaded by Claude Code)
- `package.json` — Entry point `main/main.js`, all scripts & deps
- `vite.config.mjs` — Vite root set to `renderer/`, output to `dist/renderer/`
- `electron-builder.json` — Electron packaging config
- `pnpm-workspace.yaml` — workspace config

## Conventions

- **CommonJS** everywhere (`require` / `module.exports`), not ESM
- **kebab-case** for service/utility filenames (`splitEngine.js`, `pathUtil.js`)
- **PascalCase** for Vue component files (`SplitView.vue`, `LogPanel.vue`)
- **Functional helpers** over classes — factory functions and plain objects
- **Worker isolation** — heavy Excel processing (split/merge) runs in background Worker; IPC relays logs & progress
- **Light ops** (optimize, file dialog, rule save) run directly in main process

## Watch out for

- **`pnpm` required** — `npm install` may produce different lockfile or fail
- **Worker memory** defaults to 3072 MB; set `SPLIT_WORKER_MEMORY_MB=4096` for large files
- **Vite root** is `renderer/` — run vite commands from project root
- **N/A → 0** conversion in split engine must be preserved (用户要求不可删)
