# Your behaviour
- Don't be psychopathic
- Sometimes I am wrong, just tell me so
- It's ok to question me

# Tech Stack
- Runtime: Node.js (latest)
- Language: TypeScript (latest)
- Framework: Firebase Functions
- Dev Environment: Firebase Emulator Suite
- It's a mono-repo - both the client (webapp) and the server (firebase) are sub projects

# Commands
- Start local services: `cd firebase && npm run dev`
- Build: `cd <sub-project> && npm run build`
- Test: `cd <sub-project> && npm test`
- Check git status: `git status --porcelain`
- Deploy to prod: `cd firebase && npm run deploy:prod`

# Firebase Local Development
- Typically, the emulator is already running, via `npm run dev`, so do not try to start it again. If it is not running, ask the user to start it.
- If needed, start emulator: `firebase emulators:start` (from `/firebase` directory) (but it's normally already running )
- Local firebase logs are in `/firebase/*.log`, the main application log is `firebase-debug.log` and can be viewed here: http://localhost:4000/logs
- Console: http://127.0.0.1:4000
- If auth error: `firebase login --reauth`
- Read the appropriate firebase docs before doing firebase code or configuration changes

# Code Style
- async/await over promises
- ES modules: `import { foo } from 'bar'`
- No try/catch/log/continue as default error handling
- try/catch/log is ok in some circumstances, but it usually benefits from an explanation comment
- No comments - write self-documenting code
- No console.log - use structured logging/auditing
- Inline single-use private functions
- Minimize class state
- TypeScript strict mode
- NO HACKS

# Development Workflow
1. Verify correct directory before commands
2. After changes:
   - Run build
   - Run tests
   - Fix any errors
   - Check `git status` for untracked files
3. Add new files to git or .gitignore
4. Never run `git commit`
5. Avoid environment variables, prefer configuration files

# Architecture Rules
- Fail fast: validate early, throw on invalid state
- Let exceptions bubble up - crash on broken state
- Prefer simple solutions over clever abstractions
- Every line of code is production-ready
- Avoid dependencies when simple code suffices
- Delete pointless/outdated tests
- Ignore theoretical edge cases that won't occur

# Critical Constraints
- Read the local `.md` files, they contain important information
- DO NOT BREAK CORS CONFIG
- App must run in both emulator and production Firebase
- Consider build-time and runtime impacts of structural changes

# Other guidance
- before doing any filesystem operations, **make sure** you are in the correct directory
- learn by your mistakes, if you break something, make a note of what you did wrong in a file called "common-mistakes.md"