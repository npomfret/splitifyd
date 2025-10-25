# White-label Brand Prep Notes

## Ideas
- Centralize tenant branding (name, palette, logos, marketing flags) in a dedicated descriptor that both web and functions read, so swapping tenants is a config change rather than a code edit.
- Gate marketing routes/components behind descriptor toggles and default `ROUTES.HOME` to login or dashboard when the landing page is disabled.
- Feed brand palettes into `themeStore` and `USER_COLORS` so avatars, buttons, and decorative accents stay on-theme without duplicating colour logic.
- Store legal copy (terms/privacy/cookies) per tenant and have static pages load the appropriate content at runtime for effortless reuse.

## Questions
- Where should tenant brand data live (Firebase Remote Config, Firestore document, build-time env, etc.) and who owns updates?
- Do white-label partners provide their own legal documents, or can they inherit defaults with minor tweaks?
- Are there constraints on acceptable colour palettes (contrast requirements, light/dark variants) that we must validate before applying runtime themes?
- Should each tenant expose a marketing landing page, or do some embed the app within an existing site and only need the authenticated views?

## Agent's Ideas (Based on App Analysis)

*   **Extend `AppConfiguration` in `@splitifyd/shared`:**
    *   Introduce a `BrandingConfig` interface to hold `appName`, `logoUrl`, `faviconUrl`, `primaryColor`, `secondaryColor`, and `marketingFlags` (e.g., `showLandingPage`, `showPricingPage`).
    *   Introduce a `LegalConfig` interface for URLs to tenant-specific legal documents (e.g., `termsOfServiceUrl`, `privacyPolicyUrl`).
    *   Introduce a `FeatureConfig` interface for toggling specific features per tenant (e.g., `enableAdvancedReporting`).
    *   Integrate these new configurations into the existing `AppConfiguration` interface.
*   **Backend Configuration Source (Recommendation: Firestore Document per Tenant):**
    *   Create a `tenants` Firestore collection where each document represents a tenant and stores their `BrandingConfig`, `LegalConfig`, and `FeatureConfig`.
    *   Modify the `getAppConfig()` function in `firebase/functions/src/client-config.ts` to fetch the relevant tenant document based on the identified tenant ID.
*   **Frontend Implementation:**
    *   **Dynamic Theming:** Use CSS variables for colors, dynamically applying them based on `branding.primaryColor` etc., from the fetched `AppConfiguration`. Tailwind CSS can consume these variables.
    *   **Conditional Rendering & Routing:** Use `branding.marketingFlags` to conditionally render marketing components or redirect routes using `preact-router`.
    *   **Dynamic Legal Pages:** Fetch legal content dynamically using the URLs provided in `legal` from `AppConfiguration`.

## Agent's Questions (Based on App Analysis)

1.  **Tenant Identification:** How will the application identify the current tenant? (e.g., subdomain, custom domain, query parameter, user's organization ID after login). This is the most crucial decision for the architecture.
2.  **Configuration Storage:** What is the preferred approach for storing tenant-specific branding and configuration? (Firestore document per tenant, Firebase Remote Config, or a combination?)
3.  **Deployment Strategy:** Will each white-label instance be a separate Firebase project, or will multiple tenants share a single Firebase project? This impacts how tenant data and configurations are isolated and managed.
4.  **Admin Interface for Tenants:** Will there be an admin interface for white-label partners to manage their branding and configurations, or will this be a manual process (e.g., updating Firestore documents directly)?
5.  **Color Palette Constraints:** Are there any specific constraints on acceptable color palettes (e.g., contrast requirements, light/dark variants) that we must validate before applying runtime themes?
6.  **Marketing Landing Pages:** Should each tenant expose a marketing landing page, or do some embed the app within an existing site and only need the authenticated views?