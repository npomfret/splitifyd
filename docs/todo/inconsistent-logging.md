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
