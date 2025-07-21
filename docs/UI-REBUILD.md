# Splitifyd Webapp – Rebuild Plan

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
