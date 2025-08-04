# COMMAND-FIRST WORKFLOW

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

# Tech Stack
- Runtime: Node.js (latest)
- Language: TypeScript (latest)
- Framework: Firebase Functions
- Dev Environment: Firebase Emulator Suite
- It's a mono-repo - both the client (webapp-v2) and the server (firebase) are subprojects
- Avoid environment variables, prefer configuration files
- App must run in both the Firebase emulator and production Firebase
- Use the firebase emulator to test against.  Do not use the Vite dev server

# Commands
- Start local dev server (with auto-reload): `npm run dev`
- Build: `npm run build`
- Test: `npm test`
- Super clean (removes all node_modules): `npm run super-clean`
- Check git status: `git status --porcelain`
- Deploy to prod: `cd firebase && npm run deploy:prod`

Note: assume the emulator is running and changes are automatically built and reflected in the running app.
Note: never assume a port number, never hard code ports, servers etc.  There are several environments.  You need to get the port numbers from firebase.json
Note: if the emulator isn't running, STOP and ask the user to start it
Note: never use the system browser, always use Chromium

# Firebase Local Development
- Firebase is configured to run on a set of ports (via the `switch-instance.sh` script and the .env files in `firebase/functions/.env.<envname>`)
- To determine which port(s) to use, examine `firebase/firebase.json`
- Do not edit `firebase/firebase.json`, it is tempated during the build process - only edit the template
- If there are changes to  `firebase/firebase.json` (via the template), stop and ask the user to restart the emulator
- To get the webapp base url, run `npm run get-webapp-url`
- Always assume emulator is already running (via `npm run dev`). If it is not running, ask the user to start it
- Local firebase logs are in `firebase/*.log`, the main application log is `firebase/firebase-debug.log`
- After making ANY change, firebase will pick it up, but you need to refresh the browser to see it

Note: The webapp is now a modern Preact SPA (webapp-v2) served directly from the Firebase emulator. All pages have been migrated from the legacy multi-page application.

# TypeScript
- Only use the latest syntax
- ❌ **DO NOT use `ts-node`** - it always causes ERR_UNKNOWN_FILE_EXTENSION problems
- ✅ **Always use `tsx` instead** for TypeScript execution
- ✅ Use `npx tsx script.ts` in npm scripts and bash commands

# Directives
Read these
- docs/directives/type-safety.md
- docs/directives/browser-testing.md

# MCP Browser Automation
Claude Code CLI now supports automated browser testing via MCP (Model Context Protocol).
- Configuration is set up in `~/Library/Application Support/Claude/claude_desktop_config.json`
- See `docs/mcp-browser-testing-guide.md` for usage instructions
- Use MCP tools to automatically check console errors and take screenshots
- The MCP tests are in `mcp-browser-tests/mcp-test-webapp-v2.ts`
- For dev purposes, the login and register forms are pre-filled in with test data - CLEAR them if you need to
  IMPORTANT: never commit any code. When you are ready to commit, stop, write a commit message and wait for instructions.
