# TSX Inconsistencies Report

## Overview
This report summarizes inconsistencies found during an audit of all `.tsx` files in the project. The codebase is generally well-structured and adheres to established patterns, but minor deviations were identified.

## Identified Inconsistencies

### 1. HTML Attribute Naming
There is inconsistent use of standard HTML attributes vs. JSX-specific attributes.

*   **`class` vs `className`**: Several components use `class` for CSS classes instead of the JSX-standard `className`.
    *   `webapp-v2/src/components/auth/ErrorMessage.tsx`: Uses `class`
    *   `webapp-v2/src/components/auth/FloatingPasswordInput.tsx`: Uses `class`
    *   `webapp-v2/src/pages/AdminPage.tsx`: Uses `class` in several button elements.
*   **`for` vs `htmlFor`**: Some `<label>` elements use the HTML `for` attribute instead of the JSX `htmlFor` attribute.
    *   `webapp-v2/src/components/ui/ColorInput.tsx`: Uses `for`
    *   `webapp-v2/src/components/auth/FloatingPasswordInput.tsx`: Uses `for`
*   **SVG Attribute Naming**: In `webapp-v2/src/pages/AdminPage.tsx`, SVG path attributes like `stroke-linecap`, `stroke-linejoin`, `stroke-width` are used instead of their camelCase JSX equivalents (`strokeLinecap`, `strokeLinejoin`, `strokeWidth`).

### 2. Hardcoded Strings (Internationalization)
Some user-facing strings are hardcoded directly within components, bypassing the `react-i18next` internationalization framework.

*   `webapp-v2/src/components/auth/DefaultLoginButton.tsx`: The button text "Quick Login" is hardcoded.
*   `webapp-v2/src/pages/TenantBrandingPage.tsx`: Various strings like "Branding Configuration", "Tenant Settings", "Live Preview", "App Name", "Logo URL", "Favicon URL", "Primary Color", "Secondary Color", "Marketing Features", "Marketing Content", "Pricing Page", "Saving...", "Save Changes" are hardcoded.

### 3. Icon Library Inconsistency
Icons are sourced from different sub-packages of `@heroicons/react`, leading to potential inconsistencies in visual style (e.g., solid vs. outline) or bundle size if not managed carefully.

*   `webapp-v2/src/components/ui/MultiLabelInput.tsx`: Imports `XMarkIcon` from `@heroicons/react/20/solid`.
*   Other components primarily import from `@heroicons/react/24/outline`.

### 4. Deprecated Components/Routes
Components and routes explicitly marked as deprecated are still present in the codebase.

*   `webapp-v2/src/App.tsx`: Routes `/admin/tenants` and `/admin/diagnostics` are marked `@deprecated`.
*   `webapp-v2/src/pages/AdminTenantsPage.tsx`: This page is present despite the route being deprecated.
*   `webapp-v2/src/pages/AdminDiagnosticsPage.tsx`: This page is present despite the route being deprecated.

## Recommendations
Addressing these inconsistencies would improve code quality, maintainability, and ensure better adherence to JSX and internationalization best practices. The attribute naming issues can lead to subtle bugs or warnings in development. The hardcoded strings should be moved to translation files to support multi-language capabilities. Reviewing and standardizing icon imports would simplify the dependency tree. Finally, deprecated components and routes should be removed if no longer in use to reduce codebase clutter.
