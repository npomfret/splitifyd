# COMMAND-FIRST WORKFLOW

@docs/guides/building-and-testing.md
@docs/guides/code.md
@docs/guides/end-to-end_testing.md
@docs/guides/firebase.md
@docs/guides/general.md
@docs/guides/testnig.md
@docs/guides/types.md
@docs/guides/webapp-and-style-guide.md

## 🚀 Start EVERY Request with `/p`

The `/p` meta-prompt command automatically selects the best tools for your task:

```
/p analyze performance issues in my React app
/p fix the login bug in issue #123
/p refactor this code for better types
/p add dark mode to settings
```

## Why `/p`?

- **Zero Memory Load**: No need to remember tool names
- **Optimal Workflows**: Always uses the best combination of tools
- **Learning Aid**: Shows you which tools are selected and why
- **Can't Be Ignored**: Explicit command vs passive instructions

## Available Tools

**View all tools:**

- `/mcp-list` - See MCP servers (fast operations)
- `/agent-list` - See subagents (quality enforcement)

**Direct usage (optional):**

- MCP servers: `mcp__servername__method`
- Subagents: "Use the [agent-name] agent"

## The `/p` Advantage

Instead of:

- Remembering dozens of tool names
- Figuring out the right sequence
- Missing optimal approaches

Just use `/p` and get:

- Intelligent tool selection
- Proper sequencing
- Best practices enforced

## Examples of `/p` in Action

**Feature Development:**

```
/p add user authentication to the app
→ architect-advisor → MCP tools → quality agents → test-runner → auditor
```

**Bug Fixing:**

```
/p fix TypeError in user.service.ts line 45
→ architect-advisor → mcp__typescript-mcp__ → fix → test-runner → auditor
```

**Analysis:**

```
/p analyze bundle size and suggest optimizations
→ mcp__context-provider__ → mcp__typescript-mcp__ → analyst agent
```

## Remember

- **ALWAYS** start with `/p` for intelligent assistance
- The first `/p` in a session initializes MCP context
- Each `/p` returns an enhanced prompt with optimal tool usage
- Follow the enhanced prompt for best results

## PROJECT-SPECIFIC INSTRUCTIONS

**! IMPORTANT !**: read all the files in `docs/guides` immediately.

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
