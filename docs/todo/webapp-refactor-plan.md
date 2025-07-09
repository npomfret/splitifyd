# WebApp Refactoring and TypeScript Migration Plan

This document outlines the plan to refactor the webapp's directory structure and then migrate the JavaScript codebase to TypeScript.

## Phase 1: Directory Structure Refactoring

The current structure of the `webapp` directory mixes source files (HTML, JS, CSS) with configuration files at the root level. The goal of this phase is to create a cleaner separation between source code and project configuration.

### Proposed Directory Structure

The proposed new structure will introduce a `src` directory to house all source files.

```
webapp/
├── src/
│   ├── add-expense.html
│   ├── dashboard.html
│   ├── ... (all other .html files)
│   ├── css/
│   │   ├── main.css
│   │   └── ...
│   ├── js/
│   │   ├── api.js
│   │   └── ...
│   └── public/
│       └── icons/
│           └── ...
├── .babelrc
├── jest.config.js
├── package.json
├── package-lock.json
└── node_modules/
```

### Refactoring Steps

1.  **Create `webapp/src` directory:** A new directory named `src` will be created inside the `webapp` folder.

2.  **Move HTML files:** All `.html` files from the `webapp` root will be moved into `webapp/src/`.

3.  **Move `js` directory:** The `webapp/js` directory will be moved to `webapp/src/js`.

4.  **Move `css` directory:** The `webapp/css` directory will be moved to `webapp/src/css`.

5.  **Move `public` directory:** The `webapp/public` directory (containing assets like icons) will be moved to `webapp/src/public`.

6.  **Update paths (if necessary):** Since the relative structure between HTML, CSS, and JS files is maintained, no path changes within the files should be necessary. However, a verification step will be performed. We will also need to update any configuration files that point to old paths (e.g. `jest.config.js` or any build scripts).

## Phase 2: TypeScript Migration

Once the directory structure is refactored, we will begin the migration from JavaScript to TypeScript. This will be a gradual process.

*(Details for Phase 2 will be added later.)*
