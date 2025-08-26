# merge

**Preflight**

* [ ] ensure on a non-detached HEAD with an upstream: `git rev-parse --abbrev-ref --symbolic-full-name @{u}`
* [ ] fetch quietly: `git fetch --prune --quiet`
* [ ] compute divergence: `git rev-list --left-right --count HEAD...@{u}` → `(ahead, behind)`
* [ ] collect file sets:

    * local unstaged: `git diff --name-only`
    * local staged: `git diff --name-only --cached`
    * inbound: `git diff --name-only HEAD..@{u}`
    * intersection: `intersect(local, inbound)`

**Decision tree (fastest safe first)**

1. **Nothing to do**: if `behind == 0` → exit.
2. **Clean & fast-forward** (no local changes and no divergence besides upstream ahead):

    * condition: `ahead == 0` AND local unstaged/staged empty
    * action: `git pull --ff-only --quiet`
3. **Clean but diverged (no local changes, both sides have commits)**:

    * action (prefer linear history):
      `git pull --rebase=merges --rebase-conflict=diff3 --quiet -X theirs`
4. **Local changes present, but paths don’t overlap inbound** (`intersection` empty):

    * action (skip manual stash):
      `git pull --ff-only --autostash --quiet`

        * if FF not possible →
          `git pull --rebase=merges --autostash --rebase-conflict=diff3 --quiet -X theirs`
5. **Local changes overlap inbound** (`intersection` non-empty):

    * action (authoritative upstream, keep local only when non-conflicting):

        * enable conflict learning: `git config rerere.enabled true`
        * rebase fast path:
          `git pull --rebase=merges --autostash --rebase-conflict=diff3 --quiet -X theirs`
        * if rebase fails or policy prefers merge commits:
          `git merge --no-ff --no-edit -X theirs @{u}`
    * after resolve, run tests/checks as configured.

**Conflict policy**

* [ ] Default: **prefer upstream** (`-X theirs`) on conflicting hunks.
* [ ] Preserve local modifications only when they don’t override upstream intent (i.e., apply after successful rebase/merge as additional fixup if needed).
* [ ] If an automatic resolution is applied, append a trailer to the commit msg, e.g.:
  `Resolved-by: merge-bot (prefer-upstream)` and list conflicted paths.

**Safety & observability**

* [ ] abort on dirty merges: if merge in progress and user cancels → `git merge --abort` / `git rebase --abort`
* [ ] never drop work: if `--autostash` was used, verify stash is empty or popped; otherwise `git stash list` and warn.
* [ ] log summary: ahead/behind counts, chosen path, conflicted files (if any).

**Optional micro-optimizations**

* [ ] shallow fetch for speed on CI: `git fetch --filter=blob:none --prune --quiet`
* [ ] use a dry-run conflict probe for large updates before touching the index (Git ≥2.38):
  `git merge-tree $(git merge-base HEAD @{u}) HEAD @{u}` and parse conflicts → choose rebase vs merge accordingly.
* [ ] auto-fix trivial whitespace conflicts: `-Xignore-space-change` (only if repo policy allows).

