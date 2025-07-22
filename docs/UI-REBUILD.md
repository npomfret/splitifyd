# Splitifyd Webapp – Rebuild Plan

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
