# Lack of Input Validation in switch-instance.ts

## Status: ANALYZED AND PLANNED

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

### Step 1: Add numeric validation (single commit)
1. Add the regex validation check after the initial instance check
2. Include support for 'prod' as a special case (since line 36 checks `instance === 'prod'`)
3. Provide clear error messages with examples

### Step 2: Test the changes
1. Test with valid numeric instances: 1, 2, 10
2. Test with 'prod' special case
3. Test with invalid inputs: 'abc', '1abc', '0', '-1', '' 
4. Verify error messages are helpful

### Notes
- The script already handles file existence validation well (line 20-23)
- The regex `/^[1-9][0-9]*$/` ensures positive integers (no leading zeros, no negative numbers)
- Special handling for 'prod' is needed since it's used in the script (line 36)
- This is a simple, low-risk improvement that makes the tool more user-friendly
