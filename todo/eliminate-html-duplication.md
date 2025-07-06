# Plan to Eliminate HTML Duplication in `webapp`

**Objective:** Refactor the `webapp` HTML files to eliminate duplication, improve maintainability, and leverage client-side rendering for dynamic content, aligning with the existing `js/templates` and `js/components` structure.

**Current State Analysis:**
*   Significant duplication found in `<head>` sections (meta tags, CSS links, Content Security Policy).
*   Repeated header (`<header class="dashboard-header">`) and warning banner (`<div id="warningBanner">`) across multiple pages.
*   Common JavaScript includes at the end of `<body>`.
*   Auth-related pages (`login.html`, `register.html`, `reset-password.html`) share a similar structural layout.
*   Dashboard/Group-related pages (`dashboard.html`, `add-expense.html`, `expense-detail.html`, `group-detail.html`) share a common `dashboard-header` and `dashboard-main` structure.
*   Existence of `dashboard-new.html` and `group-detail-new.html` with minimal HTML and module scripts suggests a move towards client-side rendering.
*   `js/templates/base-layout.js` and `js/templates/template-engine.js` indicate an existing templating strategy.
*   `js/components/` directory suggests a component-based approach is already being adopted.

**Proposed Solution: Client-Side Templating and Componentization**

Leverage the existing JavaScript templating and component infrastructure to dynamically build pages, reducing static HTML to minimal entry points.

**Detailed Plan:**

1.  **Create a `base-layout.html` Template:**
    *   **Purpose:** This file will serve as the single source of truth for the common HTML structure, including `<!DOCTYPE html>`, `<html>`, `<head>`, and the basic `<body>` structure (e.g., warning banner, main header, main content area, common script includes).
    *   **Content:**
        *   All common `<meta>` tags (charset, viewport, CSP).
        *   All common `<link>` tags for `main.css`, `utility.css`, `font-awesome`, etc.
        *   The `warningBanner` div.
        *   The `dashboard-header` (or a more generic app header) with the logout button.
        *   A main content area (e.g., `<main id="app-content"></main>`) where page-specific content will be injected.
        *   Common JavaScript includes (`firebase-config.js`, `config.js`, `warning-banner.js`, `api.js`, `auth.js`, `logout-handler.js`).
    *   **Action:** Create `webapp/templates/base-layout.html` and move common elements into it.

2.  **Refactor Existing HTML Pages to Use the Base Layout:**
    *   **Purpose:** Convert existing static HTML files into minimal entry points that load the `base-layout.html` and then dynamically inject their specific content.
    *   **Methodology:**
        *   For each page (e.g., `add-expense.html`, `dashboard.html`, `expense-detail.html`, `group-detail.html`, `login.html`, `register.html`, `reset-password.html`):
            *   Remove all duplicated `<head>` content.
            *   Remove the duplicated `warningBanner` div.
            *   Remove the duplicated `dashboard-header`.
            *   Remove common JavaScript includes.
            *   The page will primarily consist of a `<body>` with a root element (e.g., `<div id="root"></div>`) where the templating engine will render the entire page, or just the unique content.
            *   The `dashboard-new.html` and `group-detail-new.html` already follow this minimal pattern, providing a good example.
    *   **Action:** Modify each HTML file to be a lean entry point.

3.  **Enhance `js/templates/template-engine.js` and `js/templates/page-builder.js`:**
    *   **Purpose:** Develop the JavaScript logic to fetch `base-layout.html`, inject it into the DOM, and then dynamically load and inject page-specific content into the designated content area (`#app-content`).
    *   **Functionality:**
        *   A function to load the `base-layout.html` content.
        *   A mechanism to define page-specific content (e.g., a function that returns the HTML string for the `add-expense` form, or the `dashboard` sections).
        *   A routing mechanism (if not already present) to determine which page content to load based on the URL.
        *   Integration with `js/components/` to render reusable UI elements.
    *   **Action:** Update existing templating scripts or create new ones to handle this dynamic loading and rendering.

4.  **Componentize Repeated UI Elements:**
    *   **Purpose:** Extract common UI patterns (e.g., forms, lists, modals, navigation) into reusable JavaScript components that can be rendered by the templating engine.
    *   **Examples:**
        *   The `nav-header` with back button and page title.
        *   Form groups (`form-group`, `form-label`, `form-input`, `form-error`).
        *   Modal structures (`modal`, `modal-content`, `modal-header`, `modal-body`, `modal-footer`).
        *   The `auth-card` structure.
    *   **Action:** Create or enhance components in `js/components/` and integrate them into the page-specific rendering logic.

5.  **Update Page-Specific JavaScript:**
    *   **Purpose:** Adapt existing page-specific JavaScript files (e.g., `add-expense.js`, `dashboard-init.js`, `expense-detail.js`) to work with the new templating system. Instead of directly manipulating static HTML, they will interact with dynamically rendered content.
    *   **Action:** Modify JavaScript files to ensure they correctly select elements and attach event listeners after the content has been rendered by the templating engine.

6.  **Address `index.html`, `privacy-policy.html`, `terms-of-service.html`, `test-config.html`:**
    *   These pages have slightly different structures (e.g., `index.html` uses `landing.css`, `privacy-policy.html` and `terms-of-service.html` have very minimal headers/footers).
    *   **Recommendation:** For now, focus on the main application pages. Revisit these if time permits or if further duplication is identified. They might require separate, simpler base layouts if full templating is desired for them.

**Verification Steps:**

1.  **Manual Testing:** Navigate through all refactored pages to ensure they render correctly and all functionalities (forms, buttons, data display) work as expected.
2.  **Browser Developer Tools:** Inspect the DOM to confirm that content is being dynamically injected and that there are no duplicate IDs or other structural issues.
3.  **Linting/Type Checking:** Run `npm run lint` and `tsc` (if TypeScript is used for the frontend, which it appears to be in `firebase/functions/src`) to catch any syntax errors or type mismatches introduced during refactoring.
4.  **Performance Check:** Monitor page load times and rendering performance to ensure the dynamic approach doesn't introduce significant overhead.

**Rollback Plan:**
*   Maintain a Git branch for this refactoring effort. In case of issues, revert to the previous commit.
