# Lack of Input Validation in switch-instance.js

## Problem
- **Location**: `firebase/scripts/switch-instance.js`
- **Description**: The script accepts a command-line argument for the instance number but does not validate it. If a user provides a non-numeric or non-existent instance number, the script will fail with an unhelpful error message.
- **Current vs Expected**: Currently, the script attempts to use the provided argument directly. It should validate that the argument is a number and that a corresponding `.env.instance<number>` file exists.

## Solution
- **Approach**: Add validation to the beginning of the script to check if the provided instance number is a valid number and if the corresponding configuration file exists.
- **Code Sample**:
  ```javascript
  const instance = process.argv[2];

  if (!instance || !/^[1-9][0-9]*$/.test(instance)) {
    console.error('❌ Please provide a valid instance number.');
    process.exit(1);
  }

  const sourcePath = path.join(__dirname, `../functions/.env.instance${instance}`);

  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Instance ${instance} configuration not found: ${sourcePath}`);
    process.exit(1);
  }
  ```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Medium impact (improves usability and robustness of the script)

## Implementation Notes
This change will make the script more user-friendly by providing clear error messages for invalid input.
