# Common Mistakes

This document defines the rules, standards, and best practices for our demo project. Ensure the app runs locally, in the Firebase emulator, and in production without compromising security.

---

## 1. Backward Compatibility

* **No backward-compat code** unless explicitly requested. This is a demo—there’s no legacy data or systems.
* **Never** write migration scripts or multi-format handlers. If formats change, we’ll handle migrations separately.

## 2. Keep It Working

* The app must run:

    * Locally, in the Firebase emulator
    * In the deployed Firebase environment
* Account for config differences between these environments, especially CSP and CORS rules.

## 3. No Hacks or Fallbacks

* **No bodges**: don’t add quick fixes just to make it work.
* **No silent fallbacks** for unexpected data.
* Let errors bubble up; **avoid** unnecessary `try/catch` blocks.
* Always reference the latest API docs.

## 4. Type Safety

* Embrace the type system everywhere.
* After changes, run the build and fix all errors immediately.

## 5. Testing

* Write enough tests—**under-testing** is worse than over-testing.
* Remove redundant tests.
* Keep tests simpler than the code they validate.

## 6. Trust Model

* **Trust** data from our server.
* **Never trust** data from external sources or our users without validation.

## 7. Cleanliness

* Delete temporary files—**do not** ignore them in version control.
* Keep build artifacts separate from source files.
* Always run `pwd` before shell commands to confirm your working directory.

## 8. Content Security Policy

* **Never** use inline handlers (e.g., `onclick=…`).
* Attach all event listeners via `addEventListener()` in JS.

## 9. Dependencies

* **Do not** use Axios—use Node’s built-in `request` library.
* Minimize external dependencies; add libraries only when essential.

## 10. Web Build

* **Do not** bundle all JS into one file.
* **Do not** minify or obfuscate source code.

## 11. Firebase Configuration

* **Never** edit `firebase/firebase.json` directly—it’s auto-generated. Instead, modify `firebase/firebase.template.json`; the build process produces `firebase.json`.
