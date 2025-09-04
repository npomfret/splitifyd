---
description: intelligently chose tests to run
---

# /comment

> The full test suite is very slow.  Be smart: find and pick out the tests that need running based on your changes. The firebase integration tests are particularly useful.

Read @docs/guides/*.md

- [ ] does it compile? run `npm run build` from the project root
- [ ] you **MUST** read docs/guides/*.md
- [ ] inspect your changes and search for candidate test cases
- [ ] run appropriate **individual** tests (never the full suite)

Do they fail?  If so... why? 

* Is the code broken?
* Is the test correct?
* Can / should the test be deleted or re-written?
* Are there tests missing?
