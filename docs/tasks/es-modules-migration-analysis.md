# ES Modules Migration Guide

This document outlines the considerations and steps for migrating the project from CommonJS (CJS) to ES Modules (ESM).

## 1. Executive Summary

Migrating to ES Modules is a strategic move to modernize the codebase, improve performance, and align with the broader JavaScript ecosystem. While the migration is feasible for both the Firebase Functions and the web applications, it requires a careful, phased approach to mitigate risks.

### Benefits
- **Future-Proofing**: The Node.js ecosystem is increasingly ESM-only. Migrating ensures access to the latest packages and technologies.
- **Performance**: ESM's static structure allows for better optimization, including tree-shaking and more efficient loading.
- **Modern Syntax**: Enables the use of top-level `await` for cleaner asynchronous initialization code.
- **Standardization**: Aligns backend and frontend code with the official JavaScript module system.

### Risks & Challenges
- **Test Infrastructure**: Jest requires significant reconfiguration to work with ESM, which is often the most complex part of the migration.
- **Dependency Issues**: Not all dependencies may be fully ESM-compatible, requiring workarounds or updates.
- **Configuration Complexity**: `tsconfig.json` and other build tools need precise configuration to handle module resolution correctly.
- **"Dual Package" Hazards**: Some packages publish both CJS and ESM versions, which can lead to subtle bugs if both are loaded into the same application.

---

## 2. Migration Plan

This migration should be executed in distinct phases to ensure stability and allow for thorough testing at each step.

### Phase 0: Preparation & Setup

1.  **Create a Migration Branch**: All work should be done on a dedicated `feature/esm-migration` branch to avoid disrupting the main branch.
2.  **Verify Node.js Version**: Ensure the `engines` field in `firebase/functions/package.json` is set to `22`, as Firebase Functions for Node.js 22 has stable ESM support.

    ```json
    // firebase/functions/package.json
    "engines": {
      "node": "22"
    },
    ```

### Phase 1: Isolate and Update `firebase/functions`

1.  **Set Module Type**: In `firebase/functions/package.json`, add `"type": "module"`.

    ```json
    // firebase/functions/package.json
    {
      "name": "functions",
      "version": "1.0.0",
      "type": "module",
      // ...
    }
    ```

2.  **Update `tsconfig.json`**: Modify `firebase/functions/tsconfig.json` to use an ESM-compatible module target and resolution strategy.

    ```json
    // firebase/functions/tsconfig.json
    {
      "compilerOptions": {
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "target": "es2022",
        "lib": ["es2022"],
        "strict": true,
        "sourceMap": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true
      }
    }
    ```
    *   **Further Reading**: [TypeScript `module` options](https://www.typescriptlang.org/docs/handbook/modules/reference.html#module)

### Phase 2: Update Test Infrastructure (Jest)

This is the most critical phase. The goal is to get all tests passing in an ESM environment *before* migrating application code.

1.  **Install Jest ESM Dependencies**:
    ```bash
    npm install -D jest@latest ts-jest@latest @types/jest@latest
    ```

2.  **Configure Jest for ESM**: Create or update `firebase/functions/jest.config.js`.

    ```javascript
    // firebase/functions/jest.config.js
    export default {
      preset: 'ts-jest/presets/default-esm',
      testEnvironment: 'node',
      transform: {
        '^.+\.tsx?$': [
          'ts-jest',
          {
            useESM: true,
          },
        ],
      },
      moduleNameMapper: {
        '^(\.{1,2}/.*)\.js$': '$1',
      },
      extensionsToTreatAsEsm: ['.ts'],
    };
    ```
    *   **Further Reading**: [Jest Documentation on ES Modules](https://jestjs.io/docs/ecmascript-modules)

3.  **Fix Test Helpers and Mocks**:
    - Replace `require` with `import`.
    - Replace `module.exports` with `export`.
    - Update mocks to use `jest.unstable_mockModule` or `vi.mock` if switching to Vitest.
    - Replace `__dirname` and `__filename`, which are not available in ESM. Use `import.meta.url` instead.

    **Gotcha: `__dirname` Replacement**
    ```typescript
    // Old CJS way
    // const templatePath = path.join(__dirname, 'templates', 'email.html');

    // New ESM way
    import { fileURLToPath } from 'url';
    import { dirname, join } from 'path';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const templatePath = join(__dirname, 'templates', 'email.html');
    ```
    *   **Further Reading**: [Node.js Docs: `import.meta.url`](https://nodejs.org/api/esm.html#importmetaurl)

### Phase 3: Migrate Application Code

Once tests are passing, migrate the application source code in small, logical batches (e.g., one feature or module at a time).

1.  **Update `import` and `export` Syntax**:
    - Convert `const x = require('y')` to `import x from 'y'`.
    - Convert `module.exports = z` to `export default z`.

2.  **Add File Extensions to Relative Imports**: This is a key requirement of ESM in Node.js. All relative imports must include the file extension (`.js`).

    **Gotcha: TypeScript Import Paths**
    You must write imports in your `.ts` files as if they are already compiled to `.js`.
    ```typescript
    // Before (CJS)
    import { getUser } from './user';

    // After (ESM)
    import { getUser } from './user.js'; // Note the .js extension
    ```
    *   **Further Reading**: [TypeScript Handbook: ESM Support](https://www.typescriptlang.org/docs/handbook/esm-node.html)

3.  **Run Tests**: After each batch of changes, run the full test suite to ensure no regressions have been introduced.

### Phase 4: Final Verification

1.  **Full Build**: Run `npm run build` from the root and within each package to ensure the entire monorepo compiles correctly.
2.  **Emulator Testing**: Run the application in the Firebase Emulator (`npm run dev`) and manually test critical user flows. Check for runtime errors in the `firebase-debug.log`.
3.  **E2E Tests**: Run the end-to-end test suite to verify the integrated application works as expected.

---

## 3. Official Documentation & Resources

- **Firebase**: [Using ES Modules in Node.js](https://firebase.google.com/docs/functions/writing-functions#dependencies)
- **Node.js**: [ES Modules Documentation](https://nodejs.org/api/esm.html)
- **TypeScript**: [ESM in Node.js Handbook](https://www.typescriptlang.org/docs/handbook/esm-node.html)
- **Jest**: [ES Modules Guide](https://jestjs.io/docs/ecmascript-modules)
- **Migration Guide**: [Pure ESM package - A guide to converting to ESM](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)
