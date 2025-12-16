# General development guide

This document defines the rules, standards, and best practices.

---

## General

- Only do EXACTLY what you were asked to do. No more, no less
- If in doubt, stop and ask the user
- Never make assumptions, always check with the user
- Never create default data or values without checking
- Never write documentation unless told to do so
- Do not comment code unless it explains something broken, weird or non-obvious
- If you have ideas, suggest them BUT DO NOT IMPLEMENT THEM
- Strive for elegance over simplicity
- Always run `pwd` before running any shell commands to confirm your working directory
- Never take over the system default browser (always use chromium)
- Always trust internal data (e.g. data we get from our own server)
- Never trust data from external sources (e.g. data we get from our users)

## No "test code" mixed in with prod code

When running the app, the code paths used MUST be identical to when it's running in a deployed environment. So...

- NO hard-coded port numbers or URLs, EVER. There is always a mechanism for getting the right one, USE IT (see `firebase-emulator-client-config.ts` for example)
- NO `if (dev) {...`

**note** We have multiple instances configured to run on a dev workstation - hard coding ports will NEVER work.

## Schema Changes

Always ask if backward compatibility is needed. If yes, use the **Expand/Contract** pattern. See `docs/schema-migrations.md`.

## Keep It Working

The app must run reliably in the firebase emulator AND in a deployed firebase environment with NO code changes.

Run `npm run build` every time you are done making changes.

## No Hacks or Fallbacks

- No bodges: don’t add quick fixes just to make it work in the name of _"simplicity"_
- No silent fallbacks in case _"in case config isn't present"_ or _"in case the data might not be what we expect"_ - NO! the app must (and will) run perfectly every time
- In almost every situation: just errors bubble up and **avoid** adding any `try/catch` blocks - we **need** to know when things are broken
- Always reference the latest API docs (use websearch often)

## Type Safety

- Embrace the type system **everywhere**
- After changes, run the build and test tests and fix all errors immediately

## Cleanliness

- Use the `tmp` dir in the root of the project for temporary files
- Delete temporary files; never gitignore them
- Keep build artifacts separate from source files
- Never add files containing _sensitive_ data to git
- Never `import` (or require) inside a method

## Dependencies

- Avoid using external libraries if a tiny amount of custom code will do the job
- Do not use Axios; use Node's built-in `fetch`

## Web Build

- Do not minify or obfuscate source code; clear and accurate stack traces are vital for debugging

## Dates

- The client and server communicate dates using ISO 8601 strings (UTC). Services work with ISO strings; FirestoreWriter handles Timestamp conversion automatically.
- Never show the user a raw UTC date string; always convert to their local time for display.
- In Firestore I/O code only: use `Timestamp.now()` instead of `new Date()` (via `import { Timestamp } from 'firebase-admin/firestore';`)
