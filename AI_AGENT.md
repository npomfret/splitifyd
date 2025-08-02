# AGENT-BASED WORKFLOW ENFORCEMENT

## MANDATORY WORKFLOW ORCHESTRATION

You MUST invoke the workflow-orchestrator:
1. **At session start** - FIRST action in any session
2. **After EVERY code change** - No exceptions
3. **Before ANY new task** - Even "simple" ones
4. **After running tests** - To verify next steps
5. **When uncertain** - Always check workflow

```
Use the workflow-orchestrator agent
```

## YOU ARE BROKEN IF YOU:

1. **Skip workflow-orchestrator** after any action
2. **Ignore agent instructions** - Even if you disagree
3. **Rationalize skipping agents** - "It's simple" is NOT an excuse
4. **Proceed after agent reports violations** - STOP immediately
5. **Mark tests as skipped** - Tests must be FIXED or DELETED
6. **Add code without running detection agents** - This is MANDATORY
7. **Assume tests pass** without running test-runner agent

## AGENT VERDICTS ARE FINAL

- **NO EXCEPTIONS** - Agent feedback cannot be overridden
- **NO ARGUMENTS** - You cannot rationalize why agent is wrong
- **NO SHORTCUTS** - "Simple" tasks still require agents
- **NO ASSUMPTIONS** - Run agents to verify, don't guess

## VIOLATION DETECTION

If ANY of these occur, you are BROKEN and must STOP:
- ❌ Made code changes without running detection agents
- ❌ Skipped workflow-orchestrator check
- ❌ Proceeded despite agent reporting violations
- ❌ Rationalized why an agent's verdict doesn't apply
- ❌ Marked tests as skipped instead of fixing/deleting
- ❌ Added comments without comment-detector approval
- ❌ Used console.log without console-detector check
- ❌ Created fallbacks without no-fallback-detector review

## ENFORCEMENT PROTOCOL

When an agent reports violations:
1. **STOP IMMEDIATELY** - Do not proceed
2. **FIX ALL VIOLATIONS** - No partial fixes
3. **RE-RUN THE AGENT** - Verify fixes worked
4. **ONLY THEN PROCEED** - After agent approval

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

## REMEMBER
- **Workflow-orchestrator is MANDATORY** - Not a suggestion
- **Agent feedback is FINAL** - Not negotiable
- **Every action needs verification** - No exceptions
- **"Simple" is not an excuse** - All tasks follow protocol
- **You are BROKEN if you skip steps** - Full stop
