Read these first!

- [README.md](README.md)
- [Building and Testing](docs/guides/building-and-testing.md)
- [Code Guidelines](docs/guides/code.md)
- [End-to-End Testing](docs/guides/end-to-end_testing.md)
- [Firebase Guide](docs/guides/firebase.md)
- [General Development](docs/guides/general.md)
- [Testing](docs/guides/testing.md)
- [Type Guidelines](docs/guides/types.md)
- [Webapp & Style Guide](docs/guides/webapp-and-style-guide.md)

## Available Tools

**View all tools:**

- `/agent-list` - See subagents (quality enforcement)

Use agents freely, appropiately and liberally!

**Direct usage (optional):**

- Subagents: "Use the [agent-name] agent"

## PROJECT-SPECIFIC INSTRUCTIONS

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
