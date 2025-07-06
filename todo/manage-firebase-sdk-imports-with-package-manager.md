# Manage Firebase SDK Imports with a Package Manager

**Problem**: The `firebase-config.js` file directly imports Firebase SDKs using hardcoded URLs with specific version numbers (e.g., `https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js`). This approach has several significant drawbacks:
1. **Version Management**: Updating Firebase SDK versions requires manual changes to these URLs across the codebase, which is tedious and error-prone.
2. **Dependency on CDN**: It creates a direct dependency on Google's CDN, which might not be ideal for all deployment scenarios (e.g., offline support, custom CDN setups).
3. **Lack of Bundling Optimizations**: It prevents the use of modern JavaScript bundling techniques (like tree-shaking to remove unused code, code splitting for smaller initial loads, minification, and transpilation) that can significantly optimize application size and performance.
4. **Development Workflow**: It complicates the development workflow, as there's no centralized way to manage frontend dependencies.

**File**: `webapp/js/firebase-config.js`

**Suggested Solution**:
1. **Introduce a Package Manager**: Use a package manager like npm or Yarn to install Firebase SDKs as project dependencies (e.g., `npm install firebase`). This centralizes dependency management in `package.json`.
2. **Implement a Bundler**: Integrate a JavaScript bundler (e.g., Webpack, Rollup, Parcel, or esbuild) into the frontend build process. This bundler will resolve the `node_modules` imports, transpile modern JavaScript/TypeScript, and create optimized bundles for deployment.
3. **Update Imports**: Change the import statements in `firebase-config.js` (and other relevant frontend files) to use standard module imports (e.g., `import { initializeApp } from 'firebase/app'; import { getAuth } from 'firebase/auth';`).
4. **Configure Build Script**: Add a build script to `package.json` (e.g., `"build:webapp": "webpack --mode production"`) to automate the bundling process.

**Behavior Change**: This is a build-time change. The application's functionality will remain the same, but the way Firebase SDKs are managed, bundled, and deployed will fundamentally change. This will require setting up a new build pipeline for the `webapp`.

**Risk**: Medium. This change requires setting up a build process with a package manager and a bundler, which can be complex and requires knowledge of these tools. Incorrect configuration could lead to broken builds or larger bundle sizes.

**Complexity**: High. This change requires a significant overhaul of the frontend's dependency management and build strategy. It's a foundational change that impacts the entire `webapp` project.

**Benefit**: High. This change will significantly improve dependency management, enable modern bundling optimizations (leading to smaller, faster applications), make it easier to update Firebase SDK versions, and streamline the frontend development workflow.