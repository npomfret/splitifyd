# Review Event Utilities Usage

## Issue
Complex event utility functions have very limited usage in the codebase.

## Current Usage Analysis
### `debounce` function
- Used in: auth.ts, add-expense.ts 
- Total uses: 3 places
- Use cases: Form input validation (300ms delay), expense amount updates (300ms delay)

### `throttle` function  
- Used in: globe.ts only
- Total uses: 1 place
- Use case: Window resize events

## Location
`/webapp/src/js/utils/event-utils.ts` (60 lines of complex TypeScript)

## Assessment
**The utilities DO NOT justify their complexity**:
- 60 lines of sophisticated code with advanced generics
- Only 4 total usages across entire webapp
- Simple use cases that can be solved with basic `setTimeout`/`clearTimeout`
- Complex context handling and typing features are unused

## Implementation Plan
**Approach**: Replace with simple inline solutions

### Steps:
1. **Replace debounce in add-expense.ts**:
   - Replace 2 instances with simple `setTimeout`/`clearTimeout` 
   - Inline since only used in this file

2. **Replace debounce in auth.ts**:
   - Replace 1 instance with simple `setTimeout`/`clearTimeout`
   - Inline since only used once

3. **Replace throttle in globe.ts**:
   - Replace with simple timestamp-based throttling
   - Inline since only used once

4. **Delete event-utils.ts**:
   - Remove entire file after replacements
   - Clean up any type imports

### Benefits:
- Reduces codebase complexity by 60 lines
- Eliminates unused sophistication
- Makes usage patterns clearer
- Easier to maintain and understand

## Implementation Details
This task can be completed in a single commit by:
1. Replacing the 4 utility calls with inline implementations
2. Removing the utilities file
3. Updating imports

**Risk**: Low - simple refactoring with no behavior changes
**Complexity**: Low - straightforward replacements
**Benefit**: Medium - improves maintainability and reduces complexity