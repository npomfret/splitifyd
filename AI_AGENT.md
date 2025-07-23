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

# Firebase Local Development
- Firebase is configured to run on a set of ports (via the `switch-instance.sh` script and the .env files in `firebase/functions/.env.<envname>`)
- To determine which port(s) to use, examine `firebase/firebase.json`
- To get the webapp base url, run `npm run get-webapp-url`
- Always assume emulator is already running (via `npm run dev`). If it is not running, ask the user to start it
- Local firebase logs are in `firebase/*.log`, the main application log is `firebase/firebase-debug.log`

# Code Style
- async/await over promises
- ES modules: `import { foo } from 'bar'`
- TypeScript strict mode

# TypeScript Execution
- ❌ **DO NOT use `ts-node`** - it always causes ERR_UNKNOWN_FILE_EXTENSION problems
- ✅ **Always use `tsx` instead** for TypeScript execution
- ✅ Use `npx tsx script.ts` in npm scripts and bash commands
- ✅ tsx is the reliable TypeScript runner for this project

# Directives
Read these
- docs/directives/type-safety.md
- docs/directives/browser-testing.md

# MCP Browser Automation
Claude Code CLI now supports automated browser testing via MCP (Model Context Protocol).
- Configuration is set up in `~/Library/Application Support/Claude/claude_desktop_config.json`
- See `docs/mcp-browser-testing-guide.md` for usage instructions
- Use MCP tools to automatically check console errors and take screenshots

IMPORTANT: never commit any code. When you are ready to commit, stop, write a commit message and wait for instructions.