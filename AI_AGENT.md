Read these first!

- [README.md](README.md)
- [Building](docs/guides/building.md)
- [Code Guidelines](docs/guides/code.md)
- [Firebase Guide](docs/guides/firebase.md)
- [General Development](docs/guides/general.md)
- [Testing](docs/guides/testing.md)
- [Type Guidelines](docs/guides/types.md)
- [Webapp & Style Guide](docs/guides/webapp-and-style-guide.md)

## Available Tools

| Tool | What it is | Typical command(s) | Why it’s an upgrade |
|---|---|---|---|
| **fd** | Fast, user-friendly file finder | `fd src`, `fd -e ts foo` | Simpler than `find`, respects `.gitignore`, very fast |
| **ripgrep (rg)** | Recursive code searcher | `rg "TODO"`, `rg -n --glob '!dist'` | Much faster than `grep`/`ack`/`ag`; great defaults |
| **ast-grep (sg)** | AST-aware search & refactor | `sg -p 'if ($A) { $B }'` | Searches syntax, not text; precise refactors |
| **jq** | JSON processor | `jq '.items[].id' < resp.json` | Structured JSON queries, filters, transforms |
| **fzf** | Fuzzy finder (any list ➜ filtered) | `fzf`, ``history | fzf`` | Interactively filters lists; fewer long paths |
| **bat** | `cat` with syntax, paging, git | `bat file.ts`, `bat -p README.md` | Syntax highlighting, line numbers, Git integration |
| **eza** | Modern `ls` | `eza -l --git`, `eza -T` | Better defaults, icons/trees/git info |
| **zoxide** | Smart `cd` (learns paths) | `z foo`, `zi my/project` | Jumps to dirs by frecency; fewer long paths |
| **httpie (http)** | Human-friendly HTTP client | `http GET api/foo`, `http POST api bar=1` | Cleaner than `curl` for JSON; shows colors/headers |
| **git-delta** | Better `git diff`/pager | `git -c core.pager=delta diff` | Side-by-side, syntax-colored diffs in terminal |
| **timeout** | Limits command execution time | `timeout 10s my_script.sh`, `timeout /t 30 /nobreak` | Prevents indefinite execution; useful for scripting and automation |

If you are "Claude Code", there are agents defined in `.claude/agents`. Use agents freely, appropiately and liberally!

**Direct usage (optional):**

- Subagents: "Use the [agent-name] agent"

## PROJECT-SPECIFIC INSTRUCTIONS

# Tech Stack

- Runtime: Node.js (latest)
- Language: TypeScript (latest)
- Framework: Firebase Functions
- Dev Environment: Firebase Emulator Suite
- It's a mono-repo - both the client (webapp-v2) and the server (firebase) are subprojects

# Commands

- Start local dev server (with auto-reload): `npm run dev`
- Build: `npm run build`
- Test: `npm test`
- Super clean (removes all node_modules): `npm run super-clean`

Note: never use the system browser, always use Chromium
