# Inconsistent Logging

## Problem
- **Location**: Throughout the project, particularly in `firebase/functions/src/config.ts` and `firebase/scripts/start-with-data.js`.
- **Description**: The project uses both `console.log` and a custom `logger` module (`firebase/functions/src/logger.ts`). This inconsistency makes it difficult to manage and search logs, and it can lead to important information being missed.
- **Current vs Expected**: Currently, logs are written using a mix of `console.log` and the `logger`. All logging should be standardized to use the `logger` module.

## Solution
- **Approach**: Replace all instances of `console.log`, `console.error`, `console.warn`, and `console.info` with the corresponding methods from the `logger` module. This will ensure that all logs are structured and can be easily filtered and searched.
- **Code Sample**:
  Replace:
  ```javascript
  console.log('This is a log message');
  ```
  with:
  ```javascript
  import { logger } from './logger';
  logger.info('This is a log message');
  ```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Moderate (requires changes in multiple files)
- **Benefit**: Medium impact (improves maintainability and observability)

## Implementation Notes
This change will require updating multiple files to import and use the `logger` module. It's a good opportunity to review the log levels and ensure that messages are logged at the appropriate level (e.g., `debug`, `info`, `warn`, `error`).

## Analysis (2025-07-17)

After analyzing the codebase, I found 202 total occurrences of console.log/warn/error/info across 27 files. However, upon closer inspection:

1. Many occurrences are in documentation files (LOCAL_DEBUGGING.md, todo files, etc.) - these should NOT be changed
2. Some are in test files where console.log might be acceptable for debugging purposes
3. Some are in scripts that run outside the Firebase functions context

The task description mentions `firebase/scripts/start-with-data.js`, but this file doesn't exist. Instead, there's `firebase/scripts/start-with-data.ts` which contains several console.log statements.

## Refined Implementation Plan

This task needs to be broken down into smaller, focused commits:

### Phase 1: Create webapp logger (if not exists)
- Check if `webapp/src/js/utils/logger.ts` provides a suitable logger for browser context
- If not, create or enhance it to match the server logger interface

### Phase 2: Firebase scripts
Replace console usage in Firebase build/deployment scripts:
- `firebase/scripts/start-with-data.ts` (20 occurrences)
- `firebase/scripts/switch-instance.ts` (18 occurrences)  
- `firebase/scripts/generate-firebase-config.ts` (10 occurrences)
- `firebase/scripts/kill-emulators.ts` (8 occurrences)

### Phase 3: Firebase functions scripts
Replace console usage in Firebase function utility scripts:
- `firebase/functions/scripts/generate-test-data.ts` (42 occurrences)
- `firebase/functions/scripts/debug-group-membership.js` (29 occurrences)
- `firebase/functions/scripts/delete-firebase-data.js` (12 occurrences)
- `firebase/functions/scripts/list-collections.js` (12 occurrences)

### Phase 4: Test files (if appropriate)
Review and selectively update test files where structured logging would be beneficial

### Phase 5: Validation scripts
Update build validation scripts to use structured logging

## Considerations

1. **Scripts vs Functions**: Scripts that run in Node.js context outside Firebase Functions may need a different logger implementation or a way to use the Firebase logger in standalone mode
2. **Browser context**: The webapp needs its own logger that works in the browser environment
3. **Test files**: Some console.log usage in tests might be intentional for debugging - need careful review
4. **Build scripts**: These run at build time and may have different logging requirements

## Recommendation

This task is more complex than initially described. The "easy" approach would be to:
1. Start with Phase 2 (Firebase scripts) as these are clearly application code
2. Each script file can be a separate commit
3. Focus on files that are actively used in the development workflow

The task should be marked as "partially complete" after each phase, allowing for incremental progress.

## Progress (2025-07-17)

### Completed:
- ✅ **Phase 2**: Firebase scripts (4 files)
  - firebase/scripts/start-with-data.ts
  - firebase/scripts/switch-instance.ts
  - firebase/scripts/generate-firebase-config.ts
  - firebase/scripts/kill-emulators.ts
  
- ✅ **Phase 3**: Firebase functions scripts (4 files)
  - firebase/functions/scripts/generate-test-data.ts
  - firebase/functions/scripts/debug-group-membership.js (skipped - diagnostic script)
  - firebase/functions/scripts/delete-firebase-data.js
  - firebase/functions/scripts/list-collections.js

### Approach taken:
- Created simple loggers for scripts (firebase/scripts/logger.ts and firebase/functions/scripts/logger.js)
- Focused on removing repetitive progress logging while keeping important state changes
- Preserved diagnostic output in debug scripts
- Used structured logging with context objects for better searchability

### Remaining phases:
- Phase 1: Create/enhance webapp logger
- Phase 4: Review test files
- Phase 5: Update validation scripts

## Phase 5 Implementation Plan (2025-07-17)

### Scope
Update the validation script `/scripts/validate-app-config.js` to use structured logging instead of console methods.

### Analysis
- The script currently uses:
  - `console.log('✓ app-config.json is valid');` on success
  - `console.error('✗ app-config.json validation failed:', error.message);` on failure
- This is a root-level script (not in firebase/ or webapp/) so it needs its own logger

### Implementation approach:
1. **Create a simple logger for root scripts** (`/scripts/logger.js`):
   - Similar to the Firebase scripts logger but for the root scripts directory
   - Should support info() and error() methods
   - Use the same structured format as other loggers for consistency
   - Keep it simple since this is just for build/validation scripts

2. **Update validate-app-config.js**:
   - Import the new logger
   - Replace console.log with logger.info
   - Replace console.error with logger.error
   - Maintain the same user-friendly output with checkmarks

3. **Testing**:
   - Run the validation script to ensure it still works
   - Verify both success and failure cases produce appropriate output

### Benefits:
- Consistent logging across all build/validation scripts
- Easier to grep/search logs in CI/CD pipelines
- Maintains the visual feedback (✓/✗) that developers expect

### Risk:
- Low risk - this is a simple refactoring of 2 log statements
- The script runs at build time, not in production

This is a perfect small, isolated task that can be completed and committed independently.
