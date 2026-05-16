---
name: andrej-karpathy-skills
description: "Karpathy-inspired coding guidelines for safer LLM coding. Use when implementing, refactoring, debugging, or reviewing code to reduce wrong assumptions, overengineering, and unrelated edits."
---

# Andrej Karpathy Skills

Karpathy-inspired behavioral guidelines to reduce common LLM coding mistakes. Merge these with repo-specific requirements.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them and do not pick silently.
- If a simpler approach exists, say so.
- If something is unclear, stop and ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No configurability that was not requested.
- No error handling for impossible scenarios.
- If 200 lines could be 50, simplify.

Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Do not "improve" adjacent code, comments, or formatting.
- Do not refactor things that are unrelated.
- Match existing style.
- If you notice unrelated dead code, mention it but do not delete it.

When your changes create orphans:
- Remove imports, variables, or functions that your changes made unused.
- Do not remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" -> "Add tests for invalid input, then make them pass."
- "Fix the bug" -> "Reproduce in a test, then make it pass."
- "Refactor X" -> "Ensure behavior remains correct before and after."

For multi-step tasks, use a brief plan:

```text
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
```

These guidelines are working if you see fewer unnecessary diffs, fewer overengineered rewrites, and earlier clarifying questions.
