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

## Detailed Implementation Plan

### Current State Analysis
- `firebase.json` is already listed in `firebase/.gitignore` (line 14)
- However, the file is still tracked in the repository (exists at `/Users/nickpomfret/projects/splitifyd-2/firebase/firebase.json`)
- The generation script is `firebase/scripts/generate-firebase-config.ts` (not .js as mentioned above)
- The npm dev script already runs the generation automatically via `start-emulators` script
- Multiple scripts depend on the generated file (kill-emulators, generate-test-data, start-with-data, ApiDriver tests)

### Implementation Steps
1. **Remove firebase.json from git tracking**
   - Run `git rm --cached firebase/firebase.json`
   - This will remove it from the repository but keep the local file
   
2. **Verify .gitignore is correct**
   - Check that `firebase/.gitignore` properly excludes `firebase.json`
   - The entry is already there, so no changes needed
   
3. **Verify generation works**
   - The npm scripts already handle generation properly:
     - `npm run dev` → runs `start-emulators` → runs `generate-firebase-config.ts`
   - No script changes needed

4. **Test the changes**
   - Run `npm run build` to ensure builds still work
   - Run `npm test` to ensure tests pass
   - Verify firebase.json is regenerated when needed

### Why This Is Valid
- The task correctly identifies a real issue: having both template and generated file in version control
- The common-mistakes.md file (item #11) explicitly states: "Never edit firebase/firebase.json directly—it's auto-generated"
- This confirms the generated file should not be in version control

### Risk Assessment
- **Low Risk**: The file is already gitignored, we're just removing it from tracking
- **No Breaking Changes**: All scripts already generate the file when needed
- **Clear Benefit**: Prevents accidental edits to generated file and confusion about which file to edit