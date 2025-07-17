# Remove Debug Console Logs

## Issue
Debug console.log statements exist in production code that should be removed.

## Locations
- `webapp/src/js/group-detail.ts` (lines 331-347)
  - Pagination debug logging
  - Load more container visibility logging

## Action Required
Remove all console.log debug statements from production code. Use proper logging utilities if logging is needed for production.

## Example
```javascript
// Remove these:
console.log('Pagination state:', { ... });
console.log('Load more container visibility:', ...);
```