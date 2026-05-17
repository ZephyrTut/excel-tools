# Excel Tools — Reasonix Reference

## Stack

- **Language:** JavaScript (Node.js), CommonJS modules
- **Desktop:** Electron 31 (main process in `main/`, renderer in `renderer/`)
- **UI:** Vue 3 + Element Plus, built with Vite 5
- **Excel:** exceljs for reading, writing, style preservation
- **Package manager:** pnpm (see `pnpm-lock.yaml`)
- **Worker:** background threads via Node.js `Worker` for non-blocking split tasks

## Layout

| Path | What lives there |
|------|------------------|
| `main/` | Electron main process, IPC bridge, preload, task/worker orchestration |
| `renderer/` | Vue 3 app — App.vue, views (HomeView, SplitView), components, styles |
| `services/split/` | Excel split engine — reader, writer, split logic, style copier, errors, types, all utilities |
| `services/common/` | Shared utilities placeholder (empty, reserved for future extraction) |
| `services/merge/` | Merge module (placeholder — empty, reserved for future) |
| `scripts/` | Standalone CLI scripts — generate-split, compare-with-output, excel-compare-core |
| `samples/` | Sample source `.xlsx` data files for split testing |
| `templates/` | Style template `.xlsx` files for split output formatting |
| `config/` | Default split rule templates (`defaultRules.json`) |
| `docs/` | PRD, architecture, decisions, prompts, split logic, optimization guide |
| `output/` | Generated split output files (runtime, gitignored) |
| `temp-output/` | Temporary test output (runtime, gitignored) |
| `test/` | Test files directory (empty, reserved for actual unit tests) |

## Commands

```bash
pnpm dev            # Start Vite dev server + Electron concurrently
pnpm build:renderer # Vite build for renderer only
pnpm build          # Build renderer + package with electron-builder
pnpm start          # Run production Electron app
pnpm split:zhejiang # Run split on samples/华锐捷2.xlsx → output/ (node scripts/generate-split.js)
pnpm compare:zhejiang # Compare generated output with source (node scripts/compare-with-output.js)
```

## Key files

- `package.json` — entry point `main/main.js`, all scripts & deps
- `vite.config.mjs` — Vite root set to `renderer/`, output to `dist/renderer/`
- `electron-builder.json` — Electron packaging config
- `pnpm-workspace.yaml` — workspace config, allows `electron` & `esbuild` builds

## Conventions

- **CommonJS** everywhere (`require` / `module.exports`), not ESM
- **kebab-case** for service/utility filenames (`splitEngine.js`, `pathUtil.js`)
- **PascalCase** for Vue component files (`SplitView.vue`, `LogPanel.vue`)
- **Functional helpers** over classes — factory functions (`createLogger`) and plain objects
- **Error enums** as frozen objects (`TaskEventType`, `ErrorCodes` via `errors.js`)
- **Worker isolation** — heavy Excel processing runs in a background `Worker`; IPC relays logs & progress
- **No test runner or lint/formatter** configured

## Watch out for

- **`output/` and `temp-output/` are runtime directories** — files in them are generated, deleted by `.gitignore`.
- **`pnpm` required** — `npm install` may produce different lockfile or fail; use `pnpm install`.
- **Worker memory** defaults to 3072 MB; set `SPLIT_WORKER_MEMORY_MB=4096` for large files.
- **Vite root** is `renderer/` — run vite commands from the project root, not from `renderer/`.
