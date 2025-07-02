# Suggested refactorings for splitifyd

## Top 5 Refactoring Priorities

## Additional Easy Wins

- **Remove unused constants** in `firebase/functions/src/constants.ts`
- **Remove debug token info** from `firebase/public/app.js:79-80` 
- **Replace magic numbers** with named constants throughout
- **Rename `InMemoryRateLimiter`** to `UserRateLimiter` for clarity
- **Remove emulator config** from production code