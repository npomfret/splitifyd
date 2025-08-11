# General development guide

This document defines the rules, standards, and best practices.

---

## General

* Always run `pwd` before running any shell commands to confirm your working directory

## No "test code" mixed in with prod code

When running the app, the code paths used MUST be identical to when it's running in a deployed environment. So...

- NO hard-coded ports or URLs
- NO `if (dev) {...`

**note** We have multiple instances configured to run on a dev workstation - hard coding ports will NEVER work.

## Backward Compatibility

* No backward-compatible code, ever (**unless explicitly requested**)
* Never write migration scripts or multi-format handlers; If formats change, we’ll handle migrations separately

## Keep It Working

The app must run reliably across all supported environments.

**note** Always account for config differences between environments, especially CSP and CORS rules.

## No Hacks or Fallbacks

* No bodges: don’t add quick fixes just to make it work in the name of _"simplicity"_
* No silent fallbacks in case _"in case config isn't present"_ or _"in case the data might not be what we expect"_ - NO! the app must (and will) run perfectly every time
* In almost every situation: just errors bubble up and **avoid** `try/catch` blocks - We **need** to know when things are broken
* Always reference the latest API docs (use mcp servers)

## Type Safety

* Embrace the type system **everywhere**
* After changes, run the build and test tests and fix all errors immediately

## Testing

* Write enough tests—**under-testing** is worse than over-testing
* Remove redundant tests
* Merge tests the test the same thing
* Keep tests simpler than the code they validate
* The most important tests are the integration and e2e tests.

* Always trust internal data (e.g. data we get from our own server)
* Never trust data from external sources (e.g. data we get from our users)

## Cleanliness

* Use the `tmp` dir in the root of the project for temporary files
* Delete temporary files; never gitignore them
* Keep build artifacts separate from source files
* Never add files containing _sensitive_ data to git 

## Content Security Policy

* Never use inline handlers (e.g., `onclick=…`).
* Attach all event listeners via `addEventListener()` in JS

## Dependencies

* Avoid using external libraries if a tiny amount of custom code will do the job
* Do not use Axios; use Node’s built-in `request` library

## Web Build

* Do not minify or obfuscate source code; clear and accurate stack traces are vital for debugging

## Dates

* The client and server will ONLY communicate dates using UTC. It is non-ambiguous.
* However, new never show the client a UTC date string; we always covert to their local time.
* Use `Timestamp.now()` instead of `new Date()` (via `import { Timestamp } from 'firebase-admin/firestore';`)