# Webapp Issue: Identify and Remove Unused Files

## Issue Description

The `webapp` directory may contain unused JavaScript and CSS files, leading to code clutter and potentially increasing bundle size.

## Recommendation

Systematically identify and remove unused files within the `webapp/js/` and `webapp/css/` directories.

## Implementation Suggestions

1.  **Examine `webapp/js/`:**
    *   **Action:** Identify any `.js` files that are not imported or referenced by HTML files.
    *   **Approach:**
        *   **Manual Tracing:** Go through each HTML file in `webapp/` and list all `<script src="...">` tags. Then, for each JavaScript file, trace its `import` statements to see which other `.js` files it depends on.
        *   **Tooling (if available):** If a build system or dependency analysis tool (like `depcheck` or `madge` if configured for the project) is introduced, use it to identify unreferenced modules.
        *   **TypeScript Conversion:** Since the webapp is now TypeScript, ensure all `.ts` files are part of the build process and are imported/used. Any `.js` files that remain and are not explicitly referenced are strong candidates for removal.

2.  **Review `webapp/css/`:**
    *   **Action:** Ensure all CSS files are linked in HTML or imported by other CSS/JS files.
    *   **Approach:**
        *   **Manual Tracing:** Check all HTML files for `<link rel="stylesheet" href="...">` tags. Also, check `.ts` or `.js` files for dynamic CSS loading or imports.
        *   **Developer Tools:** In a browser, inspect the network tab to see which CSS files are actually loaded when the application runs.

**General Process for Removing Suspected Unused Files:**
1.  **Backup:** Before deleting, make a backup or commit your current changes.
2.  **Move to Quarantine:** Temporarily move suspected unused files to a `_unused` or `_quarantine` directory within `webapp/`.
3.  **Test Thoroughly:** Run all tests (unit, integration, E2E) and perform manual testing of all application features to ensure no functionality is broken.
4.  **Observe:** If possible, deploy the changes to a staging environment and monitor for any errors or missing styles/scripts.
5.  **Delete:** After a period of observation and confirmation that no issues arise, permanently delete the files.
