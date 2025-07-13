# Redundant firebase.json and firebase.template.json

## Problem
- **Location**: `firebase/firebase.json`, `firebase/firebase.template.json`
- **Description**: The `firebase.json` file is generated from `firebase.template.json` by the `firebase/scripts/generate-firebase-config.js` script. However, both files are committed to the repository. This is redundant and can lead to confusion, as developers might edit `firebase.json` directly, only to have their changes overwritten.
- **Current vs Expected**: Currently, both the template and the generated file are in version control. Only the template should be committed, and the generated file should be added to `.gitignore`.

## Solution
- **Approach**: 
  1. Add `firebase/firebase.json` to the root `.gitignore` file.
  2. Remove `firebase/firebase.json` from the git index (`git rm --cached firebase/firebase.json`).
  3. Ensure that the `npm run dev` script (and any other relevant scripts) always runs `generate-firebase-config.js` before starting the emulators.

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Medium impact (improves clarity and reduces the risk of configuration errors)

## Implementation Notes
This change will ensure that the `firebase.json` file is always up-to-date with the configuration in the `.env` file and prevent accidental check-ins of generated configuration.