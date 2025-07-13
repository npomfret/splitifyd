# Missing `engines` field in webapp/package.json

## Problem
- **Location**: `webapp/package.json`
- **Description**: The `webapp/package.json` file does not specify the required Node.js version in an `engines` field. This can lead to inconsistencies and issues if developers use different Node.js versions.
- **Current vs Expected**: Currently, there is no `engines` field. It should be added to specify the compatible Node.js version.

## Solution
- **Approach**: Add an `engines` field to `webapp/package.json` to match the version specified in `firebase/functions/package.json`.
- **Code Sample**:
  In `webapp/package.json`, add:
  ```json
  "engines": {
    "node": "22"
  },
  ```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Medium impact (improves consistency and reduces the risk of environment-related issues)

## Implementation Notes
This change will help ensure that all developers are using the same version of Node.js, which can prevent hard-to-debug issues.