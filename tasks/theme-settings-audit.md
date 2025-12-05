# Tenant Branding & Theme Settings Audit

### Summary of Findings

Overall, the theme generation process is robust, and most settings defined in the `BrandingTokensSchema` are used to generate CSS variables for the frontend. The system relies on a powerful `flattenTokens` function that makes nearly every token available as a CSS variable. However, some tokens are used for specific, conditional features, and a few appear to be unused. A separate, older `BrandingConfigSchema` also exists, and its properties are largely deprecated for theme generation.

---

### **1. Core Tokens (`palette`, `typography`, `spacing`, `radii`, `shadows`)**

These foundational tokens are all processed and used. They are converted into CSS variables that `tailwind.config.js` then consumes to create the utility classes used throughout the frontend (e.g., `bg-primary`, `text-lg`, `p-4`, `rounded-md`).

*   **Status:** **All Used**

---

### **2. `assets`: URLs for Images and Fonts**

These tokens control the visual assets of the application.

| Setting | Usage | Effect | Status |
| :--- | :--- | :--- | :--- |
| `assets.logoUrl` | Flattened to `--assets-logo-url` variable. | Main application logo. | **Used** |
| `assets.wordmarkUrl`| Flattened to `--assets-wordmark-url`. | A text-based version of the logo. | **Used** |
| `assets.faviconUrl`| Flattened to `--assets-favicon-url`. | Used by frontend logic to set the browser favicon. | **Used** |
| `assets.heroIllustrationUrl`| Flattened to `--assets-hero-illustration-url`. | A large banner image, typically for landing pages. | **Used** |
| `assets.backgroundTextureUrl`| Flattened to `--assets-background-texture-url`. | A repeating background image or texture for the site. | **Used** |
| `assets.fonts.*` | Generates `@font-face` rules in the final CSS. | Allows for self-hosting custom font files. | **Used** |

---

### **3. `legal`: Legal and Support Information**

These tokens provide essential business and legal information, which are consumed by components in the application's footer and on legal pages.

| Setting | CSS Variable | Status |
| :--- | :--- | :--- |
| `legal.companyName` | `--legal-company-name` | **Used** |
| `legal.supportEmail` | `--legal-support-email` | **Used** |
| `legal.privacyPolicyUrl` | `--legal-privacy-policy-url` | **Used** |
| `legal.termsOfServiceUrl` | `--legal-terms-of-service-url` | **Used** |

---

### **4. `motion`: Animation and Transition Settings**

These tokens control the site's animations and interactivity.

| Setting | Usage | Effect | Status |
| :--- | :--- | :--- | :--- |
| `motion.duration.*` | Flattened to `--motion-duration-*` CSS variables. | Defines standard animation and transition durations. | **Used** |
| `motion.easing.*` | Flattened to `--motion-easing-*` CSS variables. | Defines standard `cubic-bezier` easing curves. | **Used** |
| `motion.enableParallax`| Enables the `aurora` background animation generation. | Controls the animated, multi-layered gradient background. | **Used** |
| `motion.enableMagneticHover`| Enables a JS `useMagneticHover` hook and CSS media query. | Adds a "magnetic" attraction effect to interactive UI elements. | **Used** |
| `motion.enableScrollReveal`| Enables a JS `useScrollReveal` hook and CSS media query. | Animates elements into view as the user scrolls. | **Used** |

---

### **5. `semantics`: The Semantic Design System**

This is the most critical layer, mapping raw tokens to their intended purpose.

#### **`colors`**
All semantic colors are converted to CSS variables (e.g., `--surface-base`) and also have an RGB variant generated for opacity utilities (e.g., `--surface-base-rgb`).

*   **Standard Colors (`surface`, `text`, `interactive`, `border`, `status`):** All settings are consumed and used extensively in the frontend.
*   **Special Surface Colors:**
    *   `glass`, `glassBorder`: **Used**. Generates CSS for the `.glass-panel` class, enabling a frosted glass effect on UI panels.
    *   `skeleton`, `skeletonShimmer`: **Used**. Generates keyframes and styles for the `.skeleton` class, used for content loading placeholders.
    *   `spotlight`: **Potentially Unused**. This token is converted to a CSS variable (`--surface-spotlight`), but no usage of this variable could be found in the frontend codebase. It may be intended for a future feature.
*   **Newer Text Colors:**
    *   `hero`, `eyebrow`, `code`: **Used**. These are flattened into CSS variables and consumed by the `Typography` component in the frontend for specialized text styles.
*   **Newer Interactive Colors:**
    *   `ghost`, `magnetic`, `glow`: **Used**. These are used for advanced UI components and hover/focus effects.
*   **`gradient` System:**
    *   All gradient settings (`primary`, `accent`, `text`, `aurora`) are **Used** to generate `--gradient-*` CSS variables and the special aurora background effect.

#### **`spacing` and `typography` (Semantic)**
These map concepts like "page padding" to specific values from the spacing/typography scales.

*   **Status:** **All Used**. They are converted to CSS variables and used in high-level layout components.

---

### **🔴 Unused and Deprecated Settings**

The following settings are defined in the project but are **not used** by the theme generation service (`ThemeArtifactService`) and should be considered for removal to simplify tenant configuration.

1.  **Legacy `BrandingConfigSchema` Properties:**
    The `BrandingConfigSchema` (found in `packages/shared/src/schemas/apiSchemas.ts`) defines a set of top-level properties that are now obsolete for theme generation. The CSS generation logic **exclusively** uses the `brandingTokens` object.

    *   `appName`: Handled by `legal.companyName` in tokens.
    *   `logoUrl`, `faviconUrl`: Handled by `assets` in tokens.
    *   `primaryColor`, `secondaryColor`, `accentColor`, `surfaceColor`, `textColor`: Handled by `palette` and `semantics.colors` in tokens.
    *   `themePalette`: This seems entirely replaced by the token system.
    *   `customCSS`: **Completely Unused**. There is no mechanism to inject this into the generated theme.
    *   `marketingFlags`: While used by frontend logic to show/hide pages, this is not a *theme/styling* setting and should be managed separately from branding.

These legacy properties are likely still in the schema for backward compatibility or are used by other parts of the application, but they have no effect on the CSS theme. The `customCSS` property, in particular, is a dead-end.

### Conclusion and Recommendations

The theme token system is comprehensive and well-utilized. I recommend:

1.  **Investigating and Removing `surface.spotlight`**: Since the `--surface-spotlight` variable is not used anywhere, the token should be removed from the schema unless a new feature requires it.
2.  **Deprecating the Legacy `BrandingConfigSchema`**: Create a plan to migrate any remaining usages of the legacy branding properties to the `BrandingTokensSchema` and remove the old schema fields. This will establish a single source of truth for all branding and theme configuration. The `customCSS` field can be removed immediately as it has no effect.
3.  **Separating `marketingFlags`**: Move `marketingFlags` out of the branding configuration. These are feature flags, not styling properties, and should be managed as part of the tenant's functional configuration.

This audit provides a clear path to simplifying the tenant settings and removing unused code.
