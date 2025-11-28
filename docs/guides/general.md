# General development guide

This document defines the rules, standards, and best practices.

---

## General

Only do EXACTLY what you were asked to do. No more, no less...

Unless you have been instructed to do so...

- Do no write documentation
- Do not comment code unless it explains something broken, weird or non-obvious
- Never write migration stripts or any "backward compatible" code unless explicitely told to do so - this is a NEW project, there is no existing data or users

IF IN DOUBT: ASK!!!

Also...

- If you have ideas, suggest them BUT DO NOT IMPLEMENT THEM
- Strive for elegance, not simplicity.
- Always run `pwd` before running any shell commands to confirm your working directory
- NEVER ever take over the system default browser. Always use chromium.

## No "test code" mixed in with prod code

When running the app, the code paths used MUST be identical to when it's running in a deployed environment. So...

- NO hard-coded port numbers or URLs, EVER. There is always a mechanism for getting the right one, USE IT (see `firebase-emulator-client-config.ts` for example)
- NO `if (dev) {...`

**note** We have multiple instances configured to run on a dev workstation - hard coding ports will NEVER work.

## Backward Compatibility

- No backward-compatible code, ever (**unless explicitly requested**)
- Never write migration scripts or multi-format handlers; If formats change, we’ll handle migrations separately

## Keep It Working

The app must run reliably in the firebase emulator AND in a deployed firebase environment with NO code changes.

Run `npm run build` every time you are done making changes.

**note** Always account for config differences between environments, especially CSP and CORS rules.

## No Hacks or Fallbacks

- No bodges: don’t add quick fixes just to make it work in the name of _"simplicity"_
- No silent fallbacks in case _"in case config isn't present"_ or _"in case the data might not be what we expect"_ - NO! the app must (and will) run perfectly every time
- In almost every situation: just errors bubble up and **avoid** adding any `try/catch` blocks - we **need** to know when things are broken
- Always reference the latest API docs (use mcp servers)

## Type Safety

- Embrace the type system **everywhere**
- After changes, run the build and test tests and fix all errors immediately

## Testing

- Write enough tests—**under-testing** is worse than over-testing
- Remove redundant tests
- Merge tests the test the same thing
- Keep tests simpler than the code they validate

- Always trust internal data (e.g. data we get from our own server)
- Never trust data from external sources (e.g. data we get from our users)

### Critical Test Suites

We have two high-value test suites that mock/stub Firebase but exercise the vast majority of application code. These are our primary defense against bugs and should be used exhaustively.

**`webapp-v2/src/__tests__/integration/playwright`** — Client-side integration tests
- Uses MSW (Mock Service Worker) to intercept API calls
- Runs real browser via Playwright against the actual webapp
- Exercises the full UI: routing, state management, form validation, API integration
- **Use for:** Exhaustively testing all user flows, edge cases, and error handling in the client
- Fast feedback loop (no emulator needed), ideal for TDD on frontend features
- Tests use builders to provide correctly structured firebase responses
- Tests can be slow to run, be accuracy is far more important than speed

**`firebase/functions/src/__tests__/unit/api`** — Server-side API tests
- Uses Firebase Simulator for in-memory Firestore (no emulator process)
- Calls handlers directly (bypasses HTTP layer)
- Exercises services, validation, business logic, and (simulated) database operations
- **Use for:** Exhaustively testing all API endpoints, authorization, and data transformations
- Extremely fast execution, should cover every API behavior including edge cases
- Can and must be used for very fine grained testing

### Emulator-Based Tests (Coarse-Grained)

These suites run against the full Firebase Emulator and are suited for end-to-end validation:

**`firebase/functions/src/__tests__/integration`** — Backend integration tests
- Requires running emulator
- Tests real HTTP requests against the API
- Use for verifying emulator behavior, Cloud Functions triggers, and cross-service interactions

**`e2e-tests/src/__tests__/integration`** — Full end-to-end tests
- Multi-browser tests with real users against the emulator
- Tests complete user journeys across client and server
- Use for smoke testing, multi-user scenarios, and validating the full stack works together
- Slower to run; rely on the playwright/API tests above for comprehensive coverage

## Cleanliness

- Use the `tmp` dir in the root of the project for temporary files
- Delete temporary files; never gitignore them
- Keep build artifacts separate from source files
- Never add files containing _sensitive_ data to git
- Never `import` (or require) inside a method

## Content Security Policy

- Never use inline handlers (e.g., `onclick=…`).
- Attach all event listeners via `addEventListener()` in JS

## Dependencies

- Avoid using external libraries if a tiny amount of custom code will do the job
- Do not use Axios; use Node’s built-in `request` library

## Web Build

- Do not minify or obfuscate source code; clear and accurate stack traces are vital for debugging

## Dates

- The client and server will ONLY communicate dates using UTC. It is non-ambiguous.
- However, new never show the client a UTC date string; we always covert to their local time.
- Use `Timestamp.now()` instead of `new Date()` (via `import { Timestamp } from 'firebase-admin/firestore';`)
