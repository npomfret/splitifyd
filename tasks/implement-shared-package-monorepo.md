# Task: Implement Shared Package for Monorepo

**Status:** To Do

## 1. Problem Statement

Currently, the project shares code between the `firebase` functions and the `webapp-v2` client using a TypeScript path alias (`@shared`) that points to `../firebase/functions/src/shared/*`. While this works, it has several limitations:

- **Complex Path Configuration:** Requires maintaining path aliases in multiple `tsconfig.json` files
- **Build Complexity:** Firebase deployment needs special handling for shared code
- **Test Support Issues:** The `@splitifyd/test-support` package already exists but may need better integration
- **Limited Scalability:** As shared code grows, the current approach becomes harder to maintain

## 2. Current State Analysis

The project already has:
- A monorepo structure with npm workspaces configured
- Existing workspaces: `firebase/functions`, `webapp-v2`, `test-support`, `e2e-tests`
- Shared types at `firebase/functions/src/shared/shared-types.ts`
- Path alias `@shared/*` configured in `webapp-v2/tsconfig.json`
- 44+ files in webapp-v2 importing from `@shared/shared-types`

## 3. Proposed Solution

Create a proper `@splitifyd/shared` package within the existing monorepo structure to house all shared code, ensuring clean imports and better tooling support.

## 4. Implementation Plan (Incremental Steps)

### Phase 1: Package Setup (Non-Breaking)
**Goal:** Create the shared package structure without breaking existing code

#### Step 1.1: Create Package Structure
```bash
packages/
└── shared/
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   └── index.ts
    └── dist/           # Built output
```

#### Step 1.2: Configure Package
Create `packages/shared/package.json`:
```json
{
  "name": "@splitifyd/shared",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.8.3",
    "firebase-admin": "^13.0.0"
  }
}
```

Create `packages/shared/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

#### Step 1.3: Update Root Workspace Configuration
Modify root `package.json` to include the new package:
```json
{
  "workspaces": [
    "firebase/functions",
    "webapp-v2",
    "test-support",
    "e2e-tests",
    "packages/shared"
  ]
}
```

### Phase 2: Code Migration (Parallel Structure)
**Goal:** Copy shared code to new package while maintaining existing structure

#### Step 2.1: Copy Shared Types
1. Copy `firebase/functions/src/shared/shared-types.ts` to `packages/shared/src/shared-types.ts`
2. Create `packages/shared/src/index.ts` that re-exports everything:
```typescript
export * from './shared-types';
```

#### Step 2.2: Handle Dependencies
1. Copy any imported constants/types that shared-types depends on
2. Ensure all imports within the shared package are self-contained

#### Step 2.3: Build the Package
```bash
cd packages/shared
npm run build
```

### Phase 3: Firebase Integration
**Goal:** Enable Firebase to use the shared package during deployment

#### Step 3.1: Create Pack Script
Create `firebase/scripts/pack-shared.js`:
```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '../..');
const sharedDir = path.join(rootDir, 'packages/shared');
const functionsDir = path.join(rootDir, 'firebase/functions');

// Build the shared package
console.log('Building @splitifyd/shared...');
execSync('npm run build', { cwd: sharedDir, stdio: 'inherit' });

// Pack the package
console.log('Packing @splitifyd/shared...');
execSync('npm pack', { cwd: sharedDir, stdio: 'inherit' });

// Move the tarball to functions directory
const tarballName = 'splitifyd-shared-1.0.0.tgz';
const sourcePath = path.join(sharedDir, tarballName);
const targetPath = path.join(functionsDir, tarballName);

if (fs.existsSync(sourcePath)) {
  fs.renameSync(sourcePath, targetPath);
  console.log(`Moved ${tarballName} to functions directory`);
}

// Update functions package.json to use the local tarball for production
const packageJsonPath = path.join(functionsDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Store the original dependency
if (!packageJson.dependencies['@splitifyd/shared-original']) {
  packageJson.dependencies['@splitifyd/shared-original'] = packageJson.dependencies['@splitifyd/shared'];
}

// Use tarball for deployment
packageJson.dependencies['@splitifyd/shared'] = `file:${tarballName}`;

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log('Updated functions/package.json for deployment');
```

#### Step 3.2: Add Firebase Hooks
Update `firebase/firebase.template.json`:
```json
{
  "functions": {
    "predeploy": [
      "npm --prefix \"$RESOURCE_DIR\" run build",
      "node ./scripts/pack-shared.js"
    ]
  }
}
```

### Phase 4: Gradual Migration
**Goal:** Update imports incrementally to minimize risk

#### Step 4.1: Update Firebase Functions
1. Add `@splitifyd/shared` as dependency in `firebase/functions/package.json`:
```json
{
  "dependencies": {
    "@splitifyd/shared": "workspace:*"
  }
}
```

Update imports in Firebase functions one file at a time:
```typescript
// Old: import from local file
import { Group } from './shared/shared-types';

// New: import from package
import { Group } from '@splitifyd/shared';
```

#### Step 4.2: Update Webapp
1. Add `@splitifyd/shared` as dependency in `webapp-v2/package.json`:
```json
{
  "dependencies": {
    "@splitifyd/shared": "workspace:*"
  }
}
```

Update imports in webapp files gradually:
```typescript
// Old: import via path alias
import { Group } from '@shared/shared-types';

// New: import from package
import { Group } from '@splitifyd/shared';
```

#### Step 4.3: Update Test Files
Update any test files that import shared types to use the new package.

### Phase 5: Cleanup
**Goal:** Remove old code and configurations

#### Step 5.1: Remove Path Aliases
Remove `@shared/*` path alias from:
- `webapp-v2/tsconfig.json`
- `webapp-v2/vite.config.ts`
- `webapp-v2/vitest.config.ts`
- `webapp-v2/jest.config.js`

#### Step 5.2: Remove Old Shared Directory
Once all imports are updated and tested:
```bash
rm -rf firebase/functions/src/shared
```

#### Step 5.3: Update Test Support
Ensure `@splitifyd/test-support` is properly configured as `devDependency` where used.

## 5. Testing Strategy

### After Each Phase:
1. Run all unit tests: `npm test`
2. Run integration tests: `npm run test:integration`
3. Start emulator and test locally: `npm run dev`
4. Verify webapp builds: `npm run build`

### Final Validation:
1. Clean install: `npm run super-clean && npm install`
2. Full test suite: `npm test`
3. Emulator test: Full app functionality
4. Production build test: `cd firebase && npm run deploy:prod --dry-run`

## 6. Rollback Plan

If issues arise at any phase:

### Phase 1-2 Rollback:
- Simply delete `packages/shared` directory
- Remove from workspaces in root `package.json`

### Phase 3 Rollback:
- Revert firebase.template.json changes
- Delete pack-shared.js script

### Phase 4 Rollback:
- Revert import changes (git revert commits)
- Keep both import styles working temporarily

### Phase 5 Rollback:
- Restore path aliases
- Restore `firebase/functions/src/shared` from git

## 7. Benefits

- **Clean Imports:** `import { Group } from '@splitifyd/shared'`
- **Better Tooling:** IDEs and test runners understand package imports
- **Clear Dependencies:** Explicit versioning and dependency management
- **Firebase Compatibility:** Works with Firebase's deployment constraints
- **Future-Proof:** Easy to add more shared packages

## 8. Timeline Estimate

- Phase 1: 30 minutes (setup)
- Phase 2: 1 hour (migration and testing)
- Phase 3: 1 hour (Firebase integration)
- Phase 4: 2-3 hours (gradual migration and testing)
- Phase 5: 30 minutes (cleanup)

**Total:** 5-6 hours with careful testing between phases

## 9. Success Criteria

- [ ] All tests pass
- [ ] Emulator runs without errors
- [ ] Webapp builds successfully
- [ ] Firebase functions deploy successfully
- [ ] No import resolution errors in IDE
- [ ] Clean npm install works