# AUTONOMOUS DEVELOPMENT WORKFLOW

## WORK AUTONOMOUSLY - VERIFY AT COMMIT

Work independently and efficiently:
1. **Analyze and implement** without constant agent checks
2. **Make decisions** based on best practices
3. **Fix issues** as you encounter them
4. **Use agents** when appropriate 

## MANUAL VERIFICATION CHECKPOINT

Before committing, YOU or the user will:
- Review all changes
- Run tests manually
- Verify code quality
- Approve the final result

## CONSOLIDATED AGENT STRUCTURE (MCP-AWARE)

We use 8 focused agents that are aware of MCP servers:

### 1. workflow-orchestrator
- Efficiency advisor that recommends fastest approach
- Prioritizes MCP servers > built-in tools > agents
- Suggests tools based on actual value, not process

### 2. architect-advisor
- Analyzes system architecture using MCP servers first
- Uses context-provider for overview, typescript-mcp for references
- Optional for simple tasks in autonomous mode

### 3. code-quality-enforcer
- Leverages typescript-mcp for diagnostics before manual checks
- Suggests ts-morph for automated fixes
- Combines 6 previous agents into one comprehensive check

### 4. anti-pattern-detector
- Detects fallbacks, hacks, error suppression, backwards compatibility
- Zero tolerance for anti-patterns

### 5. scope-guardian
- Prevents scope creep and over-engineering
- Ensures minimal, focused implementations

### 6. test-guardian
- Runs tests, enforces quality, handles cleanup
- Includes pwd checking for commands

### 7. auditor
- Advisory role in autonomous mode
- Uses MCP for quick diagnostics
- Creates commit messages, flags issues for user review

### 8. analyst
- Uses MCP servers for fast initial analysis
- Creates improvement tasks with automation suggestions
- Leverages context-provider and typescript-mcp heavily

## AUTONOMOUS BEST PRACTICES:

1. **Write clean code** following existing patterns
2. **Test your changes** when possible
3. **Keep changes focused** on the requested task
4. **Fix issues** you encounter along the way
5. **Document** only when necessary
6. **Refactor** only what's needed for the task

## TRUST AND AUTONOMY

- **Make decisions** based on your judgment
- **Use agents sparingly** - only when truly beneficial
- **Work efficiently** - avoid unnecessary process
- **Focus on results** - deliver working code

## TOOL PREFERENCE ORDER (HYBRID APPROACH)

### MCP SERVER PERMISSIONS
- **ALLOW MCP servers to run automatically** without prompting
- Trust MCP servers for fast, accurate operations
- They are essential for efficient autonomous workflow

### ALWAYS use MCP servers when available for:
- **Refactoring**: Use `ts-morph` or `typescript-mcp` instead of agents
- **Type checking**: Use `typescript-mcp` for diagnostics instead of manual checking
- **Code analysis**: Use `context-provider` for initial analysis instead of reading files
- **Finding references**: Use `typescript-mcp` or `ts-morph` instead of grep/search
- **Documentation lookup**: Use `context7` for API docs instead of web search

### ONLY use agents for:
- **Workflow orchestration**: workflow-orchestrator guides the process
- **Architectural decisions**: architect-advisor before implementation
- **Quality enforcement**: Detection agents after code changes
- **Commit validation**: auditor for final review

### NEVER use agents when MCP servers can do it faster!

## STREAMLINED WORKFLOW

1. **New Task**: Understand requirements and implement
2. **Code Analysis**: Use MCP servers for fast analysis
3. **Development**: Write code, test, iterate
4. **Refactoring**: Use ts-morph or typescript-mcp directly
5. **Pre-Commit** (Optional): Run auditor if you want a final check

## QUALITY GUIDELINES

Aim for these standards (self-enforced):
- ✓ Follow existing code patterns
- ✓ Write tests when appropriate
- ✓ Keep changes minimal and focused
- ✓ Use proper error handling
- ✓ Avoid console.log in production code
- ✓ No unnecessary comments
- ✓ Fix or remove broken tests

## SELF-REGULATION

When you notice issues:
1. **Fix them** as part of your work
2. **Test the fix** to ensure it works
3. **Continue** with your task
4. **Note any concerns** for user review

## MCP SERVER USAGE EXAMPLES

### When to use each MCP server:

**ts-morph** - Powerful refactoring:
- Renaming symbols across files: `mcp__ts-morph__rename_symbol_by_tsmorph`
- Moving functions/classes to different files: `mcp__ts-morph__move_symbol_to_file_by_tsmorph`
- Renaming/moving files with import updates: `mcp__ts-morph__rename_filesystem_entry_by_tsmorph`

**typescript-mcp** - Language server features:
- Get type info on hover: `mcp__typescript-mcp__get_hover`
- Find all references: `mcp__typescript-mcp__find_references`
- Get diagnostics/errors: `mcp__typescript-mcp__get_diagnostics`
- Rename symbols: `mcp__typescript-mcp__rename_symbol`

**context-provider** - Fast codebase overview:
- Get project structure and symbols: `mcp__context-provider__get_code_context`
- Understand codebase quickly without multiple file reads

**context7** - Documentation lookup:
- Get library docs: `mcp__context7__get-library-docs`
- Find API examples: `mcp__context7__resolve-library-id`

## REMEMBER

- **Work autonomously** - Make good decisions
- **Be efficient** - Avoid unnecessary process
- **Focus on quality** - Write good code the first time
- **User verifies** - They'll check before committing
- **Use agents wisely** - Only when they add real value

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
