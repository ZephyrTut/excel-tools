# Split / Merge Template And Sheet Alias Redesign

## Goal

Replace the old shared template and shared split rule structure with a clean split-vs-merge separation:

- `sheetRules` is renamed to `splitSheetRules`
- split and merge each keep their own template file
- split and merge each keep their own sheet-name alias map
- template management no longer has a protected default template or special lock behavior
- merge source-sheet choices must no longer include template sheets

## Approved Decisions

### Rule structure

The new persisted rules shape is:

```json
{
  "split": {
    "templateFile": "",
    "sheetNameAliases": {},
    "skipEmptySplitKey": true,
    "trimSplitKey": true
  },
  "merge": {
    "templateFile": "",
    "sheetNameAliases": {},
    "inputDir": "",
    "orderSheetName": "日报",
    "orderColumn": "C",
    "appendUnknownVendorsToEnd": true,
    "outputName": "合并汇总.xlsx"
  },
  "splitSheetRules": [],
  "mergeSheetRules": []
}
```

The old top-level `templateFile` and old `sheetRules` name are removed. No compatibility migration is required. The project should now treat this as a fresh format.

### Template management

Template storage is split by feature:

- split templates live under a split-only template directory
- merge templates live under a merge-only template directory

There is no protected default template anymore:

- no `_default.xlsx`
- no `isDefault`
- no delete restrictions
- no overwrite restrictions beyond normal file replacement behavior

Templates are normal user-managed files.

### Sheet-name resolution

Split and merge use separate alias maps:

- `split.sheetNameAliases`
- `merge.sheetNameAliases`

Runtime sheet lookup follows this order:

1. exact match
2. normalized match
3. alias-map match
4. similarity suggestion only

Similarity suggestion must not silently auto-rewrite rules. It is advisory UX only.

### Merge source-sheet picker

In merge rule editing:

- source-sheet options come from scanned input workbooks only
- target-sheet options come from the selected merge template only

Template sheets must not appear as source-sheet candidates.

## Scope

### Backend

- default rules shape changes
- rule loading/saving works with the new structure only
- split services read `split.templateFile` and `splitSheetRules`
- merge services read `merge.templateFile` and `mergeSheetRules`
- template IPC is split into split vs merge template operations
- sheet-name matching helpers support aliases and similarity suggestions

### Frontend

- split view reads/writes `split.templateFile`, `split.sheetNameAliases`, and `splitSheetRules`
- merge view reads/writes `merge.templateFile`, `merge.sheetNameAliases`, and `mergeSheetRules`
- template dialogs operate on per-feature template lists
- merge source-sheet picker is rebuilt to stop mixing template sheets into source options
- unmatched sheet warnings can include suggested matches

## Non-goals

- no migration from old saved user rules
- no auto-fixing rules in the background
- no fuzzy auto-match during execution
- no redesign of column alias mapping beyond what current workflows need

## Risks And Mitigations

### Risk: old saved user rules become unusable

This is accepted by request. The implementation should fail clearly rather than attempt hidden migration.

### Risk: similarity suggestions recommend the wrong sheet

Suggestions are advisory only. The actual execution path only uses exact, normalized, and explicit alias-map matches.

### Risk: UI and backend drift on naming

All split-specific fields should consistently use `split.*` plus `splitSheetRules`; all merge-specific fields should consistently use `merge.*` plus `mergeSheetRules`.

## Validation

The implementation is complete when:

- the old shared template field is gone from the app flow
- split and merge can each select and persist different templates
- merge source-sheet dropdown no longer shows template sheets
- split and merge each persist and use their own sheet alias map
- unmatched sheet names surface suggestions without silently remapping
- automated tests cover the new rule shape and key resolution behavior
