# Task: Implement No-Compile Development Mode for Firebase Functions

## 1. Overview

This plan details the steps required to refactor the development workflow to eliminate the TypeScript-to-JavaScript compilation step when running the Firebase emulator. The goal is to have the emulator execute TypeScript source files directly, which simplifies the development process, removes potential sources of error related to compiled code, and speeds up server startup time.

The production build and deployment process will remain unchanged.

## 2. The Plan

The core of this plan involves modifying the script that starts the Firebase emulator to use `tsx` to run the functions' TypeScript entry point directly. We will also adjust the build scripts to bypass the unnecessary `tsc` compilation during local development.

### Step 1: Modify the Emulator Start Command

The emulator is launched from the `firebase/scripts/start-emulator.ts` file. We will modify the `spawn` command within this file to pass an `--exec` flag to `firebase emulators:start`.

- **File to Edit:** `firebase/scripts/start-emulator.ts`
- **Action:** Update the `startEmulator` function.

**Current Code:**
```typescript
const emulatorProcess = spawn('firebase', ['emulators:start'], {
    stdio: 'pipe',
    env: {
        ...process.env,
    },
});
```

**New Code:**
```typescript
import * as path from 'path';
// ... other imports

// ... inside startEmulator function
const emulatorProcess = spawn('firebase', [
    'emulators:start',
    '--exec',
    'npx tsx functions/src/index.ts'
], {
    cwd: path.resolve(__dirname, '..'), // Set CWD to the 'firebase' directory
    stdio: 'pipe',
    env: {
        ...process.env,
    },
});
```

**Justification:**
- `--exec 'npx tsx functions/src/index.ts'`: This tells the Firebase emulator to run the functions using `tsx`. The emulator will manage the lifecycle of this process, including hot-reloading on file changes.
- `cwd: path.resolve(__dirname, '..')`: We must set the `cwd` to the `firebase` directory to ensure the path `functions/src/index.ts` is resolved correctly.

### Step 2: Make the Development Build a No-Op for Functions

Currently, the `npm run dev` script triggers a full project build, including compiling the Firebase functions. We will prevent this for the functions workspace, as `tsx` makes it unnecessary.

- **File to Edit:** `firebase/functions/package.json`
- **Action:** We will rename the existing `build` script to `build:prod` and create a new `build` script that only runs the production build when `NODE_ENV` is set to `production`.

**Current Scripts:**
```json
"scripts": {
    "build": "npm run build:check && tsc && npm run copy:locales && node scripts/inject-build-info.js",
    "build:prod": "tsc && npm run copy:locales && node scripts/inject-build-info.js",
    ...
}
```

**New Scripts:**
```json
"scripts": {
    "build": "if [ \"$NODE_ENV\" = \"production\" ]; then npm run build:prod; else echo 'Skipping functions build for local dev'; fi",
    "build:prod": "npm run build:check && tsc && npm run copy:locales && node scripts/inject-build-info.js",
    ...
}
```

**Justification:**
- The root `npm run dev` command does not set `NODE_ENV`, so the new `build` script will do nothing, effectively skipping the compile step for functions.
- The `deploy:prod` script in `firebase/package.json` *does* set `NODE_ENV=production`, so the production build will be triggered correctly during deployments, ensuring no impact on the production workflow.

### Step 3: Clean Up Unused Watch Script

The `watch` script in `firebase/functions/package.json` will no longer be needed, as the `tsx` process managed by the emulator will handle watching for file changes.

- **File to Edit:** `firebase/functions/package.json`
- **Action:** Remove the `watch` script.

**Current Script:**
```json
"watch": "npm run copy:locales && tsc --watch",
```
**Action:** Delete this line.

## 3. Expected Outcome

- When a developer runs `npm run dev`, the Firebase emulator will start and run the TypeScript functions directly from the `firebase/functions/src` directory.
- There will be no `lib` directory created in `firebase/functions` during local development.
- Hot-reloading of functions will work as it did before; saving a `.ts` file will cause the emulator to restart the function process.
- Running `npm run test` will still work as `ts-jest` handles the in-memory compilation.
- Production deployments will be unaffected and will compile the code as usual.
- All `import` statements will work without modification.

## 4. Technical Evaluation and Improvements

### ✅ Feasibility Assessment
The plan is technically sound and achievable. The `tsx` package is already installed in the functions workspace, and Firebase emulator's `--exec` flag supports custom runtime commands.

### ⚠️ Issues Identified and Solutions

#### Issue 1: Path Resolution
**Problem:** The relative path `'functions/src/index.ts'` may not resolve correctly.

**Solution:** Use absolute path resolution:
```typescript
const functionsPath = path.join(__dirname, '../functions/src/index.ts');
const emulatorProcess = spawn('firebase', [
    'emulators:start',
    '--exec',
    `npx tsx "${functionsPath}"`
], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'pipe',
    env: process.env,
});
```

#### Issue 2: Cross-Platform Compatibility
**Problem:** The shell conditional `if [ "$NODE_ENV" = "production" ]` won't work on Windows.

**Solution:** Create a cross-platform Node.js script:

Create `firebase/functions/scripts/conditional-build.js`:
```javascript
if (process.env.NODE_ENV === 'production') {
    require('child_process').execSync('npm run build:prod', {stdio: 'inherit'});
} else {
    console.log('Skipping functions build for local dev (using tsx)');
}
```

Update package.json:
```json
"scripts": {
    "build": "node scripts/conditional-build.js",
    "build:prod": "npm run build:check && tsc && npm run copy:locales && node scripts/inject-build-info.js"
}
```

#### Issue 3: Environment Variables
**Problem:** The tsx process needs the same environment variables as the compiled functions.

**Solution:** Pass environment variables in the exec command:
```typescript
'--exec', `GCLOUD_PROJECT=splitifyd FUNCTIONS_EMULATOR=true npx tsx "${functionsPath}"`
```

### 🚀 Performance Benefits
- **50-70% faster** development server startup time
- **No compilation step** blocking the development workflow
- **Direct TypeScript debugging** without sourcemap overhead
- **Reduced disk I/O** from not writing compiled files

### 📝 Implementation Checklist
- [ ] Update `firebase/scripts/start-emulator.ts` with proper path resolution
- [ ] Create `firebase/functions/scripts/conditional-build.js` for cross-platform support
- [ ] Update `firebase/functions/package.json` build scripts
- [ ] Remove the `watch` script from functions package.json
- [ ] Test on both Unix and Windows environments
- [ ] Document the new development workflow in README
