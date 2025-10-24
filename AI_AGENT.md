Read these first!

@README.md
@docs/guides/building-and-testing.md
@docs/guides/code.md
@docs/guides/end-to-end_testing.md
@docs/guides/firebase.md
@docs/guides/firebase-config.md
@docs/guides/general.md
@docs/guides/testing.md
@docs/guides/types.md
@docs/guides/webapp-and-style-guide.md

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
