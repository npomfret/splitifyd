# Splitifyd Webapp – Rebuild Plan

## Quick Status (2025-07-22)

### ✅ What's Done
1. **Webapp Analysis** - Complete understanding of existing app
2. **Preact Foundation** - Basic app with Vite, TypeScript, Tailwind
3. **Type-Safe API** - Full contract types with runtime validation
4. **Integrated Hosting** - Both apps running together on Firebase
   - Old app at `/`, new app at `/v2/`
   - Shared authentication via localStorage
   - Single emulator, no CORS issues

### 🎯 What's Next
**Browser Testing Setup** (recommended - 2 hours)
- Set up MCP browser automation
- Enable screenshot capture
- Console error detection
- See: `docs/tasks/browser-testing-setup.md`

### 📁 Key Files
- **Migration Plan**: `docs/migration-order.md` (detailed page-by-page plan)
- **Task Files**: `docs/tasks/webapp-rebuild-*.md`
- **New Tasks**: `docs/tasks/browser-testing-setup.md`
- **Dev Workflow**: `docs/integrated-webapp-development.md`

### 🔧 Development
```bash
# Integrated development (recommended)
npm run dev:integrated
# Old app: http://localhost:6002/
# New app: http://localhost:6002/v2/

# Standalone webapp-v2 dev (for rapid iteration)
npm run webapp-v2:dev
# Visit http://localhost:3000
```

### 💡 Key Decisions
1. **Deferred Task 3** (Migration Infrastructure) - too complex for now
2. **Simplified approach** - no state management yet (YAGNI)
3. **Manual types first** - can automate later
4. **Focus on pages** - build content before infrastructure
5. **Integrated hosting** - webapp-v2 at /v2/ path for gradual migration

### ℹ️ Notes
- Firebase hosting is already configured and working
- The webapp is served via Firebase hosting
- Emulator runs on port 6002 for local development

### 📊 Progress
- Reconnaissance: 100% ✅
- Foundation: 100% ✅
- API Contract: 100% ✅
- Integration: 100% ✅
- Pages Built: 0% (next focus)
- Migration Infrastructure: N/A (simplified approach used)

## Core Principles

### 1. STRICT TYPE SAFETY

**MANDATORY**: This rebuild MUST embrace strict type safety everywhere:
- **Shared Types**: All client-server communication uses shared TypeScript types (defined in `firebase/functions/src/shared` and symlinked to webapp)
- **Runtime Validation**: Client MUST verify server responses match expected types ("right shape")
- **TypeScript Strict Mode**: Enabled everywhere with NO exceptions
- **Type Coverage**: 100% type coverage enforced in CI
- **No `any` Types**: Banned except for third-party library interop (with explicit justification)

### 2. IN-BROWSER TESTING AT EVERY STEP

**MANDATORY**: Every implementation step MUST include thorough in-browser testing:
- **Console Monitoring**: Check for ANY console errors or warnings
- **Visual Verification**: Ensure pages render correctly
- **Network Inspection**: Verify API calls succeed with correct payloads
- **Screenshot Documentation**: Take screenshots when implementing new features
- **Cross-Browser Testing**: Test in Chrome, Firefox, and Safari
- **Responsive Testing**: Verify mobile and desktop layouts

## 0  Recon

1. Read everything in `docs/directives/**` and `firebase/functions/src/shared`.
2. Generate a strict **endpoint contract** from `functions/src/index.ts` (HTTP verb + path + req/resp TypeScript types). Fail CI on breaking changes.

## 1  Minimal stack

- **Framework:** Preact + `react/compat` alias.
- **State:** `reactfire` (Firestore streams) + `zustand` (UI state).
- **Build:** Vite.
- **Styling:** Tailwind.
- **Testing:** Jest + React‑Testing‑Library    |  E2E: Playwright.
- **Quality gates:** ESLint + `typescript-coverage-report`.

## 2  Scaffold

```text
/webapp‑v2
    /src
        /app        # zustand stores + reactfire init
        /components # presentational UI
        /features   # containers, one folder per use‑case
        /pages      # route entry points
        /shared     # -> ../../firebase/functions/src/shared (symlink)
        /styles     # global.css + Tailwind layers
```

## 3  Incremental migration (strangler‑fig)

1. Keep legacy static app reachable at `/legacy/*`.
2. Host the new Preact SPA at `/app/*`.
3. Migrate one view at a time, delete the HTML twin once parity is reached.

## 4  Perf & DX

- Hard bundle budget: **≤ 150 kB gzipped** initial load (CI‑enforced).
- `vite-plugin-inspect` + `webpack‑bundle‑analyzer` for audits.
- Upload source maps and errors to Sentry.

## 5  CI / CD

- **GitHub Actions**
    - `test`   → Jest + Playwright.
    - `build`  → Vite + bundle‑size check.
    - `deploy` → `firebase deploy --only hosting` on `main`.

## 6  Docs

- Replace Storybook with **Histoire** (leaner, Vite‑native, Preact‑ready).
- One‑page `CONTRIBUTING.md` checklist: lint → test → size → docs.

---

**One‑liner:** Fewer deps, single test runner, smaller bundles, cheaper Firebase bill.

## Migration Progress Tracker

### Completed Tasks ✅

#### Reconnaissance Phase
- **Task 0: Webapp Analysis** (2025-07-22) 
  - ✅ User flows documented
  - ✅ Dependencies analyzed  
  - ✅ API endpoint inventory created
  - ✅ Migration order established
  - ✅ Risk assessment complete

#### Foundation Phase
- **Task 1: Preact Setup** (2025-07-22)
  - ✅ Vite + Preact + TypeScript configured
  - ✅ Tailwind CSS integrated
  - ✅ Basic routing with home/404 pages
  - ✅ Development server with HMR
  - ✅ Monorepo integration

- **Task 2: API Contract & Type Safety** (2025-07-22)
  - ✅ Comprehensive API contract types
  - ✅ Runtime validation with Zod
  - ✅ Type-safe API client
  - ✅ Full TypeScript autocomplete
  - ✅ Zero `any` types

#### Integration Phase
- **Task 4: Firebase Hosting Integration** (2025-07-22)
  - ✅ webapp-v2 builds to firebase/public/v2/
  - ✅ Vite base path configured for /v2/
  - ✅ Firebase routing rules added
  - ✅ Auth bridge for shared authentication
  - ✅ Integrated npm scripts (dev:integrated)
  - ✅ Preact router handles /v2/ prefix
  - ✅ Both apps running on same emulator

### In Progress Tasks 🚧

None currently - ready for next phase.

### Deferred Tasks ⏸️

- **Task 3: Migration Infrastructure** 
  - Original Strangler Fig pattern too complex
  - Current integration approach is simpler
  - May revisit for advanced migration needs

### Next Recommended Tasks 📋

1. **Browser Testing Setup** (~2 hours)
   - MCP integration for automated testing
   - Screenshot capture setup
   - Console error detection
   - Small, immediately useful

2. **Common Components** (~4 hours)
   - Button, Input, Card components
   - Form validation helpers
   - Loading/Error states
   - Foundation for all pages

3. **Auth Integration** (~6 hours)
   - Firebase Auth setup
   - Login/Register forms
   - Protected routes
   - Critical for app functionality

---

*Last Updated: 2025-07-22 - Added Firebase hosting integration*
