# White-Label Developer Guide

Date: 2025-11-13  
Audience: Frontend + backend engineers

## Tokens & Schemas
- Source of truth lives in `@billsplit/shared/src/types/branding.ts`.
- Fixtures for local testing: `@billsplit/shared/src/fixtures/branding-tokens.ts` (`default`, `localhost`, `loopback`).
- Firestore tenants will store `brandingTokens: TenantBranding` alongside legacy `branding` fields until migration completes.

## Backend Flow
1. Tenant updates stored under `tenants/{tenantId}`.
2. Admin console calls `POST /api/admin/publishTenantTheme`.
3. `ThemeArtifactService` renders CSS + JSON, stores `gs://billsplit-themes/{tenant}/{hash}.css`.
4. `/api/theme.css?v=<hash>` resolves tenant via hostname and streams CSS.

## Frontend Consumption
- `webapp-v2/index.html` loads `/api/theme.css` as render-blocking link.
- Tailwind config maps semantic utilities to CSS variables.
- Components must not use raw hex colors or inline `style=` attributes (enforced by ESLint + Stylelint).
- Use `ThemeDiagnosticsPanel` (dev-only) to inspect current hash, token snapshot, and computed vars.

## Local Testing Checklist
- Run `npm run build:packages` after editing tokens.
- Start emulators via `./dev1.sh` or `npm run dev`.
- Seed tenants via `POST /api/admin/tenants` (localhost + loopback payloads) while the emulator is running.
- Hit `http://localhost:6005` (hosting emulator) and verify theme per domain requirement.

## Guardrails
- ESLint rule `no-inline-styles/no-inline-styles` blocks inline `style` usage.
- Stylelint `stylelint.config.mjs` enforces custom property hygiene and `!important` bans.
- `scripts/theme-storage/setup.sh` provisions bucket once per env; backend uses signed URLs.

## Useful Paths
| File | Purpose |
| --- | --- |
| `firebase/scripts/seed-demo-tenants.ts` | Seeds default/localhost/loopback tenants + branding tokens. |
| `scripts/theme-storage/setup.sh` | Creates Cloud Storage bucket + CORS policy. |
| `eslint.config.mjs` | Enforces `no-inline-styles` plugin in `webapp-v2`. |
| `stylelint.config.mjs` | Style guardrails for CSS assets. |
| `docs/guides/white-label-debug-runbook.md` | Troubleshooting flow. |
