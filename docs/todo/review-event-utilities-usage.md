# Review Event Utilities Usage

## Issue
Complex event utility functions have very limited usage in the codebase.

## Current Usage
### `debounce` function
- Used in: globe.ts, auth.ts, add-expense.ts
- Total uses: ~3 places

### `throttle` function  
- Used in: globe.ts only
- Total uses: 1 place

## Location
`/webapp/src/js/utils/event-utils.ts`

## Action Required
1. Evaluate if these utilities justify their complexity for such limited use
2. Consider:
   - Removing them and using simpler inline solutions
   - Moving them closer to where they're used
   - Using a lightweight utility library if more utilities are needed

## Questions
- Are there plans to use these utilities more extensively?
- Could the use cases be solved with simpler approaches?
- Is maintaining custom implementations worth it vs using lodash/similar?