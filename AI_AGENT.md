# 🛑 MANDATORY: READ THIS FIRST - DO NOT SKIP

Before making **ANY** code changes, you MUST read these files:

- directives/engineering.md
- directives/code-style.md
- directives/logging.md
- directives/testing.md

Summarise what you have learned from them.

# Tech Stack
- Runtime: Node.js (latest)
- Language: TypeScript (latest)
- Framework: Firebase Functions
- Dev Environment: Firebase Emulator Suite
- It's a mono-repo - both the client (webapp) and the server (firebase) are sub projects
- Avoid environment variables, prefer configuration files
- App must run in both the Firebase emulator and production Firebase

# Commands
- IMPORTANT! run `pwd` before you run ANY shell commands.
- Start local dev server (with auto-reload): `npm run dev`
- Build: `npm run build`
- Test: `npm test`
- Super clean (removes all node_modules): `npm run super-clean`
- Check git status: `git status --porcelain`
- Deploy to prod: `cd firebase && npm run deploy:prod`

# Build Verification
- **NEVER truncate build output** - Always run `npm run build` without piping to head/tail
- **ALWAYS check exit code** - Run `npm run build && echo "✅ BUILD SUCCESSFUL" || echo "❌ BUILD FAILED"`
- **For long outputs** - Redirect to a file: `npm run build > build.log 2>&1 && echo "✅ BUILD SUCCESSFUL" || (echo "❌ BUILD FAILED" && tail -50 build.log)`
- **Verify ALL packages in monorepo**:
  - webapp-v2: `cd webapp-v2 && npm run build`
  - firebase/functions: `cd firebase/functions && npm run build`
  - Root: `npm run build` (if exists)
- **Build means FULL compilation** - The build command now runs `build:check` first which compiles ALL TypeScript files including tests
- **Build commands**:
  - `npm run build` - Compiles everything (src + tests) then builds for production
  - `npm run build:check` - Type checks all TypeScript files without emitting
  - `npm run build:prod` - Legacy build that only compiles src (use sparingly)

# Testing Commands
- Run all tests: `npm test` (from root or any package)
- Run unit tests only: `npm run test:unit` (from root)
- Run integration tests only: `npm run test:integration` (from root, requires emulator running)
- Run performance tests only: `npm run test:performance` (from root, requires emulator running)
- Run specific test file: `npm test -- path/to/test.ts`
- Run tests in watch mode: `npm run test:watch`
- Run single test case: `TEST_NAME="<test description>" TEST_PATH="<test file path>" npm run test:single`
  Example: `TEST_NAME="should efficiently calculate balances in complex debt graphs" TEST_PATH="firebase/functions/__tests__/performance/performance-load.test.ts" npm run test:single`

Note: assume the emulator is running and changes are automatically built and reflected in the running app.
Note: NEVER assume a port number.  There are several environments.  You need to get the port numbers from firebase.json

# Firebase Local Development
- Firebase is configured to run on a set of ports (via the `switch-instance.sh` script and the .env files in `firebase/functions/.env.<envname>`)
- To determine which port(s) to use, examine `firebase/firebase.json`
- Do not edit `firebase/firebase.json`, it is tempated during the build process - only edit the template
- If there are changes to  `firebase/firebase.json` (via the template), stop and ask the user to restart the emulator 
- To get the webapp base url, run `npm run get-webapp-url`
- Always assume emulator is already running (via `npm run dev`). If it is not running, ask the user to start it
- Local firebase logs are in `firebase/*.log`, the main application log is `firebase/firebase-debug.log`
- After making ANY change, firebase will pick it up, but you need to refresh the browser to see it

Note: We are currently in the process of building a new webapp.  It is also hosted in the firebase emulator side-by-side with the original. The nex pages all have some marker text on the page "v2 app".
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
- The MCP tests are in `scripts/mcp-test-webapp-v2.ts`

IMPORTANT: never commit any code. When you are ready to commit, stop, write a commit message and wait for instructions.