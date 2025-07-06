# Common Mistakes

## Backward Compatibility Code
When asked to update or refactor code, avoid adding code for backward compatibility reasons. The codebase philosophy is to move forward and not maintain legacy support.

### What was removed:
1. **Legacy CSS button classes** (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-icon`, `.btn-small`) from `/webapp/css/main.css`
   - Replaced all usage with modern `.button` classes (`.button`, `.button--primary`, `.button--secondary`, `.button--danger`, `.button--icon`, `.button--small`)
   - Added missing `.button--danger` variant to match legacy functionality

2. **Firebase compat libraries** from `/webapp/js/templates/base-layout.js`
   - Removed unused `firebase-app-compat.js` and `firebase-auth-compat.js` script tags
   - The app already uses modern modular Firebase SDK via dynamic imports in `firebase-config.js`

### Key lesson:
Always prefer modern approaches and remove legacy code when refactoring. The codebase explicitly states "do not code for _backward compatibility_" in README.md.