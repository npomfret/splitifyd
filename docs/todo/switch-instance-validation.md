# Lack of Input Validation in switch-instance.ts

## Status: READY TO IMPLEMENT

## Problem
- **Location**: `firebase/scripts/switch-instance.ts` (Note: The file is TypeScript, not JavaScript)
- **Description**: The script accepts a command-line argument for the instance number but does not validate it. If a user provides a non-numeric instance number like "abc" or "1abc", the script will attempt to look for a file named `.env.instanceabc` which doesn't exist.
- **Current vs Expected**: Currently, the script checks if the file exists but doesn't validate that the input is a valid number. It should validate that the argument is a valid positive integer before constructing the file path.

## Solution
- **Approach**: Add numeric validation after the initial check for instance parameter but before constructing the file path. This ensures the script provides better error messages for invalid input.
- **Code Sample**:
  ```typescript
  const instance: string | undefined = process.argv[2];

  if (!instance) {
    console.log('Usage: ts-node scripts/switch-instance.ts <instance-number>');
    console.log('Example: ts-node scripts/switch-instance.ts 1');
    console.log('Example: ts-node scripts/switch-instance.ts 2');
    process.exit(1);
  }

  // NEW: Validate that instance is a positive integer
  if (!/^[1-9][0-9]*$/.test(instance) && instance !== 'prod') {
    console.error('❌ Please provide a valid instance number (positive integer) or "prod".');
    console.error('   Examples: 1, 2, 3, prod');
    process.exit(1);
  }

  const sourcePath: string = path.join(__dirname, `../functions/.env.instance${instance}`);
  // ... rest of the code remains the same
  ```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Medium impact (improves usability and robustness of the script)

## Implementation Plan

### Single Commit Implementation
1. Add input validation after line 15 in `switch-instance.ts`
2. Use regex `/^[1-9][0-9]*$/` to validate positive integers
3. Include special case for 'prod' (used in line 36)
4. Provide clear error messages with examples

### Testing Plan
- Valid inputs: `1`, `2`, `10`, `100`, `prod`
- Invalid inputs: `abc`, `1abc`, `0`, `-1`, `1.5`, `""`, `null`
- Verify helpful error messages appear for invalid inputs
- Confirm script still works correctly for valid inputs

### Code Location
Insert validation between lines 15-17 in the current file:
```typescript
// After the !instance check (line 15)
// Before const sourcePath (line 17)
if (!/^[1-9][0-9]*$/.test(instance) && instance !== 'prod') {
  console.error('❌ Please provide a valid instance number (positive integer) or "prod".');
  console.error('   Examples: 1, 2, 3, prod');
  process.exit(1);
}
```

### Notes
- Minimal change with maximum benefit
- No breaking changes to existing behavior
- Improves user experience with clear error messages
- Follows project standards: fail fast with clear messages
