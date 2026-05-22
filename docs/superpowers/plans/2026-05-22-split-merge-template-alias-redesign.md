# Split / Merge Template And Sheet Alias Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate split and merge templates plus split and merge sheet alias maps, rename split rules to `splitSheetRules`, and remove template-sheet pollution from merge source-sheet choices.

**Architecture:** Update the persisted rules schema first, then teach backend services and IPC to use split-vs-merge specific template and alias fields, and finally rewire the split/merge views so each flow only reads its own template catalog and rule set. Sheet matching is centralized so execution and UI warnings share the same normalization and alias behavior.

**Tech Stack:** Electron IPC, Vue 3, ExcelJS, Node `node:test`

---

### Task 1: Lock the new rule shape in tests

**Files:**
- Modify: `config/defaultRules.json`
- Create: `services/split/ruleManager.test.js`
- Test: `services/split/ruleManager.test.js`

- [ ] **Step 1: Write the failing test**

Add tests that assert loaded default rules expose:

- `split.templateFile`
- `merge.templateFile`
- `split.sheetNameAliases`
- `merge.sheetNameAliases`
- `splitSheetRules`
- no top-level `templateFile`
- no top-level `sheetRules`

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test .\services\split\ruleManager.test.js`
Expected: FAIL because the current default rules still use `templateFile` and `sheetRules`.

- [ ] **Step 3: Write minimal implementation**

Update `config/defaultRules.json` to the new format and add any minimal helpers needed in `services/split/ruleManager.js` so raw load/save continues to work with the new structure.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test .\services\split\ruleManager.test.js`
Expected: PASS

### Task 2: Split template IPC and remove default-template behavior

**Files:**
- Modify: `main/ipc.js`
- Test: `main/ipc` behavior via unit coverage where practical, otherwise service-level tests

- [ ] **Step 1: Write the failing test**

Add tests that expect template listing/import/delete logic to be feature-scoped and not emit `isDefault` or reject deletes based on a default-template rule.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test .\services\split\ruleManager.test.js .\services\optimize\zipUtils.test.js`
Expected: FAIL or missing coverage showing current IPC still assumes a shared default template directory and default-template protections.

- [ ] **Step 3: Write minimal implementation**

Refactor `main/ipc.js` so:

- split templates use a split-specific directory
- merge templates use a merge-specific directory
- list/import/delete operate on the requested scope
- no `_default.xlsx`
- no `isDefault`
- no “cannot overwrite/delete the default template” behavior

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test .\services\split\ruleManager.test.js .\services\optimize\zipUtils.test.js`
Expected: PASS for unchanged tests and any new IPC-facing helpers you added.

### Task 3: Move split and merge services to the new fields

**Files:**
- Modify: `services/split/splitService.js`
- Modify: `services/split/splitTypes.js`
- Modify: `services/merge/mergeService.js`
- Modify: `services/merge/mergeTypes.js`
- Modify: `scripts/generate-split.js`
- Modify: `scripts/generate-merge.js`
- Test: `services/merge/mergeEngine.test.js`

- [ ] **Step 1: Write the failing test**

Add or extend tests so split reads rules from `split.templateFile` plus `splitSheetRules`, and merge reads from `merge.templateFile` plus `mergeSheetRules`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test .\services\merge\mergeEngine.test.js`
Expected: FAIL because services still read shared `templateFile` / `sheetRules`.

- [ ] **Step 3: Write minimal implementation**

Update the split and merge service entry points and normalization helpers so:

- split consumes `splitSheetRules`
- merge consumes `mergeSheetRules`
- split resolves template from `split.templateFile`
- merge resolves template from `merge.templateFile`
- no code path reads the removed top-level `templateFile` or `sheetRules`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test .\services\merge\mergeEngine.test.js .\services\optimize\zipUtils.test.js`
Expected: PASS

### Task 4: Centralize sheet-name normalization, alias resolution, and suggestion helpers

**Files:**
- Modify: `services/split/excelReader.js`
- Create: `services/split/sheetNameMatcher.js`
- Create: `services/split/sheetNameMatcher.test.js`
- Modify: `services/split/splitService.js`
- Modify: `services/merge/mergeService.js`

- [ ] **Step 1: Write the failing test**

Add tests for:

- exact match
- normalized match
- alias-map match
- similarity suggestions for close names like `合格品入货记录` vs `合格品入库记录`
- no automatic remap when only a suggestion exists

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test .\services\split\sheetNameMatcher.test.js`
Expected: FAIL because the matcher helper does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add a focused matcher helper that returns:

- resolved sheet name or `null`
- resolution mode
- suggested alternatives

Wire split and merge validation paths to use the helper with their own alias maps.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test .\services\split\sheetNameMatcher.test.js`
Expected: PASS

### Task 5: Rewire split UI to the new split-only schema

**Files:**
- Modify: `renderer/views/SplitView.vue`
- Modify: `renderer/components/RuleTable.vue`
- Modify: `main/ipc.js`

- [ ] **Step 1: Write the failing test**

If there is no UI test harness, define the expected state shape and verify through a narrow helper or IPC-level assertion that split view no longer depends on top-level `templateFile` or `sheetRules`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL or uncovered behavior proving split view still reads the old fields.

- [ ] **Step 3: Write minimal implementation**

Update split view so it:

- reads/writes `split.templateFile`
- reads/writes `split.sheetNameAliases`
- reads/writes `splitSheetRules`
- lists only split templates
- surfaces unmatched-sheet suggestions using the matcher helper results

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

### Task 6: Rewire merge UI and remove template sheets from source-sheet choices

**Files:**
- Modify: `renderer/views/MergeView.vue`
- Modify: `renderer/components/MergeRuleTable.vue`
- Modify: `main/ipc.js`

- [ ] **Step 1: Write the failing test**

Add a narrow test or helper assertion for merge source-sheet option building that proves template sheet names are not mixed into source-sheet choices.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because merge currently folds template sheet names into source options.

- [ ] **Step 3: Write minimal implementation**

Update merge view so it:

- reads/writes `merge.templateFile`
- reads/writes `merge.sheetNameAliases`
- reads/writes `mergeSheetRules`
- lists only merge templates
- builds `sourceSheetNames` from scanned input-workbook sheets and current rules, not from template sheets
- shows template sheets only in the target template-sheet picker

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

### Task 7: Full regression verification

**Files:**
- Modify: any touched files from Tasks 1-6
- Test: `services/optimize/zipUtils.test.js`
- Test: `services/merge/mergeEngine.test.js`
- Test: `services/split/ruleManager.test.js`
- Test: `services/split/sheetNameMatcher.test.js`

- [ ] **Step 1: Run targeted backend tests**

Run: `node --test .\services\optimize\zipUtils.test.js .\services\merge\mergeEngine.test.js .\services\split\ruleManager.test.js .\services\split\sheetNameMatcher.test.js`
Expected: PASS

- [ ] **Step 2: Run app test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Regenerate sample split and merge outputs**

Run: `npm run split:zhejiang`
Expected: split output is generated successfully with the new split template path and rule shape

Run: `npm run merge`
Expected: merge output is generated successfully with the new merge template path and rule shape

- [ ] **Step 4: Spot-check key behavioral claims**

Verify:

- merge source-sheet candidates exclude template sheet names
- split and merge persist different template selections
- alias maps are stored separately for split and merge
- unmatched close names produce suggestions without silent remapping

