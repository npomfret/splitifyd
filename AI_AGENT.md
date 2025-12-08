Read these first!

- @README.md
- @docs/guides/api.md
- @docs/guides/ask.md
- @docs/guides/building.md
- @docs/guides/code.md
- @docs/guides/firebase.md
- @docs/guides/general.md
- @docs/guides/roles-and-authorization.md
- @docs/guides/testing.md
- @docs/guides/types.md
- @docs/guides/validation.md
- @docs/guides/webapp-and-style-guide.md

Remember:

* failing tests, or compile errors are not permitted. You are not finished if you have left the project in a broken state.
* do not run full test suites (they are too slow), instead: pick and choose isolated test(s) to run (assume the user will run the full suite)
* you will run individual tests and wait until they pass or fail
* claude stuff will fix failing tests and after the fix you will re-run them and ensure they pass
* you will NEVER lie and say a test has passed if you have not run it to completion

## Tasks

- the @tasks/ dir stores `.md` files which we use to track pending and in-progress work items
- task can contain problem descriptions, research, suggested solutions, implemtation plans etc
- most work is tracked by a task file, but some minor tasks do not need one
- after reading a task file, decided if or not more research and/or verficication is needed before you make a plan 
- after planning a task, write that plan back to the task file and update it as you go
- it's ok for plans to change during implementation, they are often non-optimal or sometimes just wrong
- you can create a task file on-the-fly if one does not exist for the task you are working on
- task files are for tracking new features, bugs, pending research etc
- task files should be kept up to date with progress, problems encountered etc - they are a living document
- task files should not contain dates or time estimates, at most add high/medium/low markers for effort / complexity etc
- task files are stored in version control, so no need to store detailed history
- task files get committed with the code as it's developed
- task files can be rewritten (or renamed) entierly if they need to radically change
- do not delete tasks files unless told to do so, but task files are evenutally deleted

## Available Tools

| Tool              | What it is                         | Typical command(s)                                   | Why it’s an upgrade                                                |
|-------------------|------------------------------------|------------------------------------------------------|--------------------------------------------------------------------|
| **fd**            | Fast, user-friendly file finder    | `fd src`, `fd -e ts foo`                             | Simpler than `find`, respects `.gitignore`, very fast              |
| **ripgrep (rg)**  | Recursive code searcher            | `rg "TODO"`, `rg -n --glob '!dist'`                  | Much faster than `grep`/`ack`/`ag`; great defaults                 |
| **ast-grep (sg)** | AST-aware search & refactor        | `sg -p 'if ($A) { $B }'`                             | Searches syntax, not text; precise refactors                       |
| **jq**            | JSON processor                     | `jq '.items[].id' < resp.json`                       | Structured JSON queries, filters, transforms                       |
| **fzf**           | Fuzzy finder (any list ➜ filtered) | `fzf`, ``history                                     | fzf``                                                              | Interactively filters lists; fewer long paths |
| **bat**           | `cat` with syntax, paging, git     | `bat file.ts`, `bat -p README.md`                    | Syntax highlighting, line numbers, Git integration                 |
| **eza**           | Modern `ls`                        | `eza -l --git`, `eza -T`                             | Better defaults, icons/trees/git info                              |
| **zoxide**        | Smart `cd` (learns paths)          | `z foo`, `zi my/project`                             | Jumps to dirs by frecency; fewer long paths                        |
| **httpie (http)** | Human-friendly HTTP client         | `http GET api/foo`, `http POST api bar=1`            | Cleaner than `curl` for JSON; shows colors/headers                 |
| **git-delta**     | Better `git diff`/pager            | `git -c core.pager=delta diff`                       | Side-by-side, syntax-colored diffs in terminal                     |
| **timeout**       | Limits command execution time      | `timeout 10s my_script.sh`, `timeout /t 30 /nobreak` | Prevents indefinite execution; useful for scripting and automation |

If you are "Claude Code", there are agents defined in `@.claude/agents`. Use agents freely, appropiately and liberally!

**Direct usage (optional):**

- Subagents: "Use the [agent-name] agent"

## PROJECT-SPECIFIC INSTRUCTIONS

# Tech Stack

- Runtime: Node.js (latest)
- Language: TypeScript (latest)
- Framework: Firebase Functions
- Dev Environment: Firebase Emulator Suite
- It's a mono-repo - both the client (webapp-v2) and the server (firebase) are subprojects
