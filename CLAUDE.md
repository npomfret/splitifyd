# Tech Stack
- Runtime: Node.js (latest)
- Language: TypeScript (latest)
- Framework: Firebase Functions
- Dev Environment: Firebase Emulator Suite

# Commands
- Start local services: `cd firebase && npm run dev`
- Build: `npm run build`
- Test: `npm test`
- Check git status: `git status --porcelain`
- Deploy to prod: `cd firebase && npm run deploy:prod`

# Firebase Local Development
- Typically, the emulator is already running, via `npm run dev`, so do not try to start it again.
- If needed, start emulator: `firebase emulators:start` (from `/firebase` directory) (but it's normally already running )
- Function logs: http://127.0.0.1:4000/logs?q=metadata.emulator.name%3D%22functions%22
- Console: http://127.0.0.1:4000
- If auth error: `firebase login --reauth`

# Code Style
- async/await over promises
- ES modules: `import { foo } from 'bar'`
- No try/catch/log as default error handling
- No comments - write self-documenting code
- No console.log - use structured logging/auditing
- Inline single-use private functions
- Minimize class state
- TypeScript strict mode

# Development Workflow
1. Verify correct directory before commands
2. After changes:
   - Run build
   - Run tests
   - Fix any errors
   - Check `git status` for untracked files
3. Add new files to git or .gitignore
4. Never run `git commit`

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