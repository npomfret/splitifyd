# Important

Before making **any** code changes, carefully read and analyse the guidance in:
- [engineering.md](directives/engineering.md)
- [code-style.md](directives/code-style.md)
- [logging.md](directives/logging.md)
- [testing.md](directives/testing.md)

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

# Firebase Local Development
- Typically, the emulator is already running, via `npm run dev`, so do not try to start it again. If it is not running, ask the user to start it.
- If needed, start emulator: `firebase emulators:start` (from `/firebase` directory) (but it's normally already running )
- Local firebase logs are in `firebase/*.log`, the main application log is `firebase-debug.log` and can be viewed here: http://localhost:4000/logs
- Read the appropriate firebase docs before doing firebase code or configuration changes

# Code Style
- async/await over promises
- ES modules: `import { foo } from 'bar'`
- TypeScript strict mode
