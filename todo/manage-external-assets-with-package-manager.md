
# Manage External Assets with a Package Manager and Bundler

**Problem**: The `baseLayout.head` method in `webapp/js/templates/base-layout.js` includes external script and stylesheet URLs (e.g., Font Awesome, Google Fonts) directly from CDNs with hardcoded paths. This approach has several drawbacks:
1. **Dependency Management**: Hardcoded URLs make it difficult to manage and update versions of these assets.
2. **Performance**: While CDNs can be fast, relying on multiple external requests can introduce latency. Bundling these assets can reduce HTTP requests.
3. **Reliability**: Dependency on external CDNs introduces a single point of failure. If a CDN is down, the application's styling or functionality might break.
4. **Offline Support**: Hardcoded external assets hinder the ability to provide robust offline support.

**File**: `webapp/js/templates/base-layout.js`

**Suggested Solution**:
1. **Introduce a Package Manager**: Use a package manager like npm or Yarn to install these external assets as project dependencies (e.g., `npm install @fortawesome/fontawesome-free`).
2. **Implement a Bundler**: Integrate a JavaScript bundler (e.g., Webpack, Rollup, Parcel) into the frontend build process. This bundler can process CSS and font files, include them in the final build, and optimize them.
3. **Update References**: Change the references in `base-layout.js` to point to the bundled assets (e.g., `import '@fortawesome/fontawesome-free/css/all.min.css';` in a main JS file, letting the bundler handle it).

**Behavior Change**: This is a build-time change. The application's functionality will remain the same, but the way external assets are managed, bundled, and served will change.

**Risk**: Medium. This change requires setting up a build process with a package manager and a bundler for frontend assets, which can be complex.

**Complexity**: High. This change requires a significant overhaul of the frontend's asset management and build strategy.

**Benefit**: High. This change will significantly improve dependency management, enable bundling optimizations (leading to faster load times), improve reliability (by reducing external dependencies), and facilitate offline support.
