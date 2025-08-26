# merge

**Preflight**

* [ ] ensure on a non-detached HEAD with an upstream:  
  `git rev-parse --abbrev-ref --symbolic-full-name @{u}`
* [ ] fetch quietly:  
  `git fetch --prune --quiet`
* [ ] compute divergence:  
  `git rev-list --left-right --count HEAD...@{u}` → `(ahead, behind)`
* [ ] collect file sets:
    * local unstaged: `git diff --name-only`
    * local staged: `git diff --name-only --cached`
    * inbound: `git diff --name-only HEAD..@{u}`
    * intersection: _intersect(local, inbound)_
* [ ] define range env var for convenience:  
  `RANGE="HEAD...@{u}"`

---

## 0) **Intent Probe (diffs only, surfaced & machine-readable)**

**Goal:** infer “what the inbound changes are trying to accomplish” so conflicts can be resolved to **preserve intent** (outcome/behavior), even when the exact code cannot be retained.

1) **Collect raw diff artifacts (no commit messages):**
    - Unified patches (minimal context):  
      `git diff --unified=0 --no-color $RANGE > .git/inbound.patch`
    - File stats:  
      `git diff --name-status $RANGE > .git/inbound.name-status`  
      `git diff --numstat $RANGE > .git/inbound.numstat`  
      `git diff --dirstat=files,0 $RANGE > .git/inbound.dirstat`
    - Rename/copy detection snapshot (for refactor signal):  
      `git diff -M -C --summary $RANGE > .git/inbound.summary`

2) **Heuristic features (commit-message free):**
    - **Tests-only?** inbound touches `test/`, `__tests__/`, `*.spec.*`, `*.test.*`.
    - **Deps/lockfiles?** `package.json`, `pnpm-lock.yaml`, `yarn.lock`, `poetry.lock`, `go.mod/sum`, etc.
    - **Config/infra?** `.github/`, CI files, `Dockerfile`, `infra/`, `*.yml`, `*.yaml`, `*.tf`, `.eslintrc*`, `.prettierrc*`.
    - **Refactor signal:** many renames/moves (`-M`/`-C` summary), large same-function edit ratios without new behavior (mostly symbol/structure churn), widespread import path edits, large `% dirstat` in `src/` coupled with high `rename` lines.
    - **Bugfix signal:** small, localized patch sets with paired `-`/`+` around conditional logic, boundary checks, null guards, off-by-one loops; edits in files with recent failing tests or error-handling blocks.
    - **Feature signal:** new modules/routes/components, public API surface changes, new exported symbols, non-trivial additions across code + tests.
    - **Schema/data contract:** migrations, API schema files, type definition bumps.

3) **LLM classification step (Claude) over **diffs only**:  
   Feed `.git/inbound.patch` in chunks with a strict schema prompt. Produce one JSON file:

   **Schema (example) → `.git/merge-intent.json`**
   ```json
   {
     "summary": "Short natural-language summary of the inbound changes (from diffs only).",
     "categories": [
       { "type": "bugfix" | "refactor" | "feature" | "tests" | "deps" | "config" | "schema",
         "confidence": 0.0,
         "rationale": "Why the diff implies this",
         "files": ["path/a.ts", "path/b.ts"]
       }
     ],
     "signals": {
       "renamesDetected": true,
       "testsTouched": true,
       "lockfilesTouched": false,
       "schemaTouched": false
     },
     "recommendedResolutionBias": {
       "default": "theirs" | "ours" | "mixed",
       "overrides": [
         { "glob": "tests/**", "prefer": "theirs" },
         { "glob": "package-lock.json", "prefer": "theirs" },
         { "glob": "src/**", "prefer": "theirs-if-bugfix-else-mixed" }
       ]
     }
   }
   ```

4) **Surface the intent for humans & logs:**
    - Pretty-print a table in the console (category, confidence, primary files).
    - Store `.git/merge-intent.json` (for auditing).
    - Emit a brief plaintext TL;DR to `.git/merge-intent.txt`.

---

## 1) Decision tree (fastest safe first, **intent-aware**)

1. **Nothing to do**: if `behind == 0` → exit.

2. **Clean & fast-forward** (no local changes; only upstream ahead):  
   condition: `ahead == 0` AND local unstaged/staged empty  
   action: `git pull --ff-only --quiet`

3. **Clean but diverged (no local changes, both sides have commits)**:  
   action (prefer linear history):  
   `git pull --rebase=merges --rebase-conflict=diff3 --quiet -X theirs`  
   _Intent note:_ Still record/surface `.git/merge-intent.json` and include TL;DR in commit message trailer.

4. **Local changes present, paths don’t overlap inbound** (intersection empty):  
   action (skip manual stash):  
   `git pull --ff-only --autostash --quiet`  
   if FF not possible →  
   `git pull --rebase=merges --autostash --rebase-conflict=diff3 --quiet -X theirs`  
   _Intent note:_ If categories include **deps/tests/schema**, schedule post-pull tasks (install, test, migrate).

5. **Local changes overlap inbound** (intersection non-empty):  
   **Intent-guided plan:**
    - Enable conflict learning: `git config rerere.enabled true`
    - **Dry-run conflict probe** (Git ≥2.38):  
      `git merge-tree $(git merge-base HEAD @{u}) HEAD @{u} > .git/merge-tree.txt`  
      Parse to map conflicted paths ↔ intent categories.
    - **Choose initial strategy by intent:**
        - If **bugfix** or **security** dominates in a conflicted file → bias **theirs**.  
          `git pull --rebase=merges --autostash --rebase-conflict=diff3 --quiet -X theirs`
        - If **tests** or **deps/lockfiles** dominate → **theirs** for those paths.
        - If **refactor** conflicts with local **feature** work → preserve **ours** for behavior, then re-apply refactor semantics post-merge.  
          Use mixed or manual path-level resolution.
        - If **feature** inbound conflicts with small local tweaks → favor **theirs** then reapply local tweaks as fixups.
    - Fallback if rebase fails or policy prefers merge commits:  
      `git merge --no-ff --no-edit -X theirs @{u}`

6. **After resolve**: run tests/checks as configured (install deps/migrate if needed).

---

## 2) **Conflict policy (intent-aware)**

**Default bias:** `-X theirs`, but **override per intent**:

- **bugfix/security:** prefer **theirs**; if code cannot be kept verbatim, **reimplement the fix** after merge.
- **tests-only:** prefer **theirs** for test files.
- **deps/lockfiles:** prefer **theirs**; run install; verify build.
- **schema/contracts:** prefer **theirs**; ensure local code adapts.
- **refactor vs local feature:** preserve **local behavior** while adopting upstream refactor semantics where possible.
- **feature inbound vs local tweaks:** prefer **theirs**; re-layer local tweaks.

**Preserving intent when exact code can’t be kept**

When a conflict prevents direct adoption of upstream code:

1) **Minimal semantic diff synthesis (Claude over diffs):**
    - Provide Claude with pre-merge local content, inbound patch hunks, and intent slice for that file.
    - Ask Claude to produce a targeted patch that **achieves the intent** against the **current local file**.

2) **Apply with 3-way tolerance:**
    - `git apply -3 .git/intent-fixups/<file>.patch || true`

3) **Tests first for bugfixes:**
    - If the intent indicates a fix, synthesize/update a failing test before applying the patch.

4) **Record what happened:**
    - Keep `.git/intent-fixups/` artifacts.
    - Include trailers in the merge/rebase commit message.

---

## 3) **Safety & observability**

* [ ] Abort on dirty merges.
* [ ] Never drop work.
* [ ] Log summary: ahead/behind, chosen path, conflicted files, **intent categories**.
* [ ] Store artifacts: `.git/inbound.patch`, `.git/inbound.*`, `.git/merge-intent.*`, `.git/intent-fixups/…`

---

## 4) **Optional micro-optimizations**

* [ ] Shallow fetch:  
  `git fetch --filter=blob:none --prune --quiet`
* [ ] Use dry-run conflict probe.
* [ ] Auto-fix trivial whitespace conflicts.
* [ ] Chunk Intent Probe per directory if diffs are large.

---

### Claude prompt stub (for the **Intent Probe**; diffs only)

> **System**: You are analyzing an inbound Git diff. Do not use commit messages. Infer purpose strictly from code changes. Output strict JSON per the provided schema.  
> **User content**:
> - `.git/inbound.patch` chunk N (with file paths)
> - `.git/inbound.summary`, `.git/inbound.numstat`, `.git/inbound.dirstat`

**Rules:**
- Classify into: `bugfix`, `refactor`, `feature`, `tests`, `deps`, `config`, `schema`.
- Provide `confidence` (0–1).
- `rationale` must cite concrete diff cues.
- Fill `recommendedResolutionBias` with pragmatic defaults.