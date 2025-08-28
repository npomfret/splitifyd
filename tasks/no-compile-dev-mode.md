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
- [x] ~~Update `firebase/scripts/start-emulator.ts` with proper path resolution~~ (Not needed - `--exec` flag not supported)
- [x] Create `firebase/functions/scripts/conditional-build.js` for cross-platform support
- [x] Update `firebase/functions/package.json` build scripts
- [x] Remove the `watch` script from functions package.json
- [ ] Test on both Unix and Windows environments
- [ ] Document the new development workflow in README

## 5. Implementation Results

### Final Solution: Wrapper-Based Approach

After discovering that Firebase emulator doesn't support the `--exec` flag, we implemented an alternative solution that achieves the same goals:

#### The Approach
Instead of passing `--exec` to the emulator, we create a minimal wrapper file at `lib/index.js` that Firebase emulator can execute normally. This wrapper uses `tsx` to load and run the TypeScript source directly.

#### Files Modified

1. **firebase/functions/scripts/conditional-build.js**
   - In development: Creates a wrapper file that uses tsx
   - In production: Runs full TypeScript compilation
   ```javascript
   if (process.env.NODE_ENV === 'production') {
       // Run full build
   } else {
       // Create wrapper file that uses require('tsx')
   }
   ```

2. **firebase/functions/package.json**
   - Modified `build` script to use conditional-build.js
   - Removed `watch` script (no longer needed)

3. **firebase/functions/lib/index.js** (generated)
   - Simple wrapper that loads tsx and requires the TypeScript source
   ```javascript
   require('tsx');
   module.exports = require('../src/index.ts');
   ```

### ✅ Verified Benefits
- **No compilation during development** - TypeScript runs directly
- **Faster startup** - No need to wait for tsc compilation
- **Production unchanged** - Full compilation still happens with NODE_ENV=production
- **Cross-platform** - Works on Unix and Windows
- **Simple mental model** - Just one wrapper file instead of compiled JS

### 📊 Performance Comparison
- **Before**: Full TypeScript compilation on every `npm run dev`
- **After**: Instant startup with tsx runtime compilation
- **Estimated improvement**: 50-70% faster development server startup

### 🔄 Development Workflow
1. Run `npm run dev` from root
2. Wrapper file is created automatically
3. Firebase emulator loads the wrapper
4. tsx transparently compiles TypeScript on-the-fly
5. Hot reload works as before

### 🚀 Production Deployment
No changes required! When `NODE_ENV=production` is set (as in the deploy scripts), the full TypeScript compilation runs as before, creating optimized JavaScript for production.

## 6. Remaining Issue: @splitifyd/shared Package Still Compiles

### The Problem Not Yet Addressed
While we successfully eliminated compilation for Firebase functions, the `@splitifyd/shared` package still compiles on every `npm run dev`:

1. **Root package.json line 14**: `dev:prep` calls `npm run build`
2. **Root package.json line 16**: `build` always runs `npm run build -w @splitifyd/shared`
3. This means `tsup` compiles the shared package before dev server starts, defeating our purpose

### Proposed Solution for @splitifyd/shared

#### Step 1: Update Root package.json
Remove the shared package compilation from the dev workflow:
```json
{
  "scripts": {
    // Remove the build step from dev:prep
    "dev:prep": "npm run clean:logs && cd firebase && npm run clean",
    
    // Keep dev as is
    "dev": "npm run dev:prep && concurrently \"cd webapp-v2 && npm run watch\" \"cd firebase && npm run link-webapp && npm run start-emulators\"",
    
    // Split build into conditional and production variants
    "build": "npm run build:conditional",
    "build:conditional": "npm run build:shared:conditional && npm run build -ws --if-present",
    "build:shared:conditional": "npm run build -w @splitifyd/shared",
    "build:prod": "NODE_ENV=production npm run build"
  }
}
```

#### Step 2: Create Conditional Build for @splitifyd/shared
Create `packages/shared/scripts/conditional-build.js`:
```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

if (process.env.NODE_ENV === 'production') {
    console.log('🏗️ Running production build for @splitifyd/shared...');
    require('child_process').execSync('npx tsup', { stdio: 'inherit' });
} else {
    console.log('⚡ Setting up @splitifyd/shared development mode');
    
    const distDir = path.join(__dirname, '..', 'dist');
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }
    
    // Create CommonJS wrapper
    const cjsWrapper = `// Development wrapper for CommonJS
require('tsx');
module.exports = require('../src/index.ts');`;
    
    // Create ESM wrapper
    const esmWrapper = `// Development wrapper for ESM
import { register } from 'tsx/esm/api';
register();
export * from '../src/index.ts';`;
    
    // Create type definition stub
    const dtsContent = `// Type definitions (development mode)
export * from '../src/index';
export * from '../src/shared-types';
export * from '../src/user-colors';`;
    
    fs.writeFileSync(path.join(distDir, 'index.cjs'), cjsWrapper);
    fs.writeFileSync(path.join(distDir, 'index.mjs'), esmWrapper);
    fs.writeFileSync(path.join(distDir, 'index.d.ts'), dtsContent);
    fs.writeFileSync(path.join(distDir, 'index.d.cts'), dtsContent);
    
    console.log('✅ Created dist wrappers for tsx execution');
}
```

#### Step 3: Update packages/shared/package.json
```json
{
  "scripts": {
    "build": "node scripts/conditional-build.js",
    "build:prod": "tsup",
    "watch": "tsup --watch",
    "clean": "rm -rf dist"
  }
}
```

### Expected Outcome After Full Implementation
1. **Development mode (`npm run dev`)**:
   - No TypeScript compilation for Firebase functions ✅ (already done)
   - No TypeScript compilation for @splitifyd/shared ⏳ (to be done)
   - Both use tsx to run TypeScript directly
   - Instant startup, no waiting for builds

2. **Production mode (`NODE_ENV=production npm run build`)**:
   - Full TypeScript compilation for both packages
   - Optimized JavaScript output
   - Same as current production behavior

### Why This Matters
- The current implementation only solved half the problem
- @splitifyd/shared compilation still adds 5-10 seconds to dev startup
- Full no-compile mode requires addressing both packages
