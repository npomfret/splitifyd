# Development Workflow
- do the task you've been asked to do **and nothing else**
- small commits are preferred
- if there is obviously more to do, suggest next steps
- After changes, run the appropriate build and tests

# Your behaviour
- Don't be sycophantic
- Sometimes I am wrong, just tell me so
- It's ok to question me
- Don't tell me "i'm right" before you've even checked

# Tech Stack
- Runtime: Node.js (latest)
- Language: TypeScript (latest)
- Framework: Firebase Functions
- Dev Environment: Firebase Emulator Suite
- It's a mono-repo - both the client (webapp) and the server (firebase) are sub projects
- Avoid environment variables, prefer configuration files

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
- Run specific test file: `npm test -- path/to/test.ts`
- Run tests in watch mode: `npm run test:watch`

# Firebase Local Development
- Typically, the emulator is already running, via `npm run dev`, so do not try to start it again. If it is not running, ask the user to start it.
- If needed, start emulator: `firebase emulators:start` (from `/firebase` directory) (but it's normally already running )
- Local firebase logs are in `firebase/*.log`, the main application log is `firebase-debug.log` and can be viewed here: http://localhost:4000/logs
- Console: http://127.0.0.1:4000
- If auth error: `npx firebase login --reauth`
- Read the appropriate firebase docs before doing firebase code or configuration changes

# Code Style
- do not duplicate code or write _hacks_ for reasons of backward compatibility
- do not duplicate code or write _hacks_ for reasons of "the data might not be in the format we expect"
- async/await over promises
- ES modules: `import { foo } from 'bar'`
- No try/catch/log/continue as default error handling
- try/catch/log is ok in some circumstances, but it usually benefits from an explanation comment
- No comments - write self-documenting code
- No console.log - read [loggin-guide.md](docs/loggin-guide.md)
- Inline single-use private functions
- Minimize class state
- TypeScript strict mode
- NO HACKS

# Testing
- automated testing is valuable - do it, lots. But...
- Tests should be easy to read and maintain
- Tests should be less complex than the code they are testing
- Avoid complex DOM mocking setups (consider using the builder pattern instead of mocks)
- Avoid high maintenance tests with low benefit
- Avoid testing implementation details rather than behavior

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
- Aggressively tidy, delete, refactor the code.
- before doing any filesystem operations, **make sure** you are in the correct directory
- learn by your mistakes, if you break something, make a note of what you did wrong in a file called "common-mistakes.md"