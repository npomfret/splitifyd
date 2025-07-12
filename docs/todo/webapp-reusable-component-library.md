# Webapp Issue: Develop a Reusable Component Library

## Issue Description

Common UI elements are re-implemented in multiple places, leading to code duplication and visual inconsistencies.

## Recommendation

Identify and abstract reusable components, and establish a clear component API.

## Implementation Suggestions

1.  **Identify and Abstract Reusable Components:**
    *   **Action:** Go through the existing codebase and identify UI patterns that appear repeatedly. These are candidates for reusable components.
    *   **Examples (already existing or to be expanded):
        *   `AuthCardComponent` (`webapp/src/js/components/auth-card.ts`)
        *   `FormComponents` (`webapp/src/js/components/form-components.ts`)
        *   `HeaderComponent` (`webapp/src/js/components/header.ts`)
        *   `ListComponents` (`webapp/src/js/components/list-components.ts`)
        *   `ModalComponent` (`webapp/src/js/components/modal.ts`)
        *   `NavHeaderComponent` (`webapp/src/js/components/nav-header.ts`)
        *   `NavigationComponent` (`webapp/src/js/components/navigation.ts`)
    *   **New Candidates:** Buttons (with different styles/icons), input fields (with validation feedback), loading spinners, empty states, error messages, member avatars, etc.

2.  **Establish a Clear Component API:**
    *   **Action:** Each component should have a well-defined interface for passing in data and handling events, making them easy to use and compose.
    *   **Approach:**
        *   Use TypeScript interfaces to define the `props` or `config` object that each component expects.
        *   Ensure components are self-contained and manage their own DOM elements and event listeners (as per `webapp-consistent-component-pattern.md`).
        *   Provide clear methods for rendering (`render()`) and cleaning up (`cleanup()`).

## Comprehensive UI Audit Results

### ✅ Already Implemented Components
Based on analysis of `webapp/src/js/components/`:

1. **BaseComponent** (`base-component.ts`) - Abstract base class with lifecycle methods
2. **FormComponents** (`form-components.ts`) - Form fields, validation, submit buttons
3. **ListComponents** (`list-components.ts`) - Group cards, expense items, member items, pagination
4. **Modal** (`modal.ts`) - Reusable modal component (confirmed by test file)
5. **Navigation** (`navigation.ts`) - Navigation component (confirmed by test file)
6. **AuthCard** (`auth-card.ts`) - Authentication card component
7. **Header** (`header.ts`) - Header component

### 🔍 Identified UI Patterns (From HTML Analysis)

#### Repeated HTML Patterns Found:
1. **Standard HTML Head** - Identical across all pages:
   - CSP meta tag
   - Font preconnect/preload
   - CSS links (main.css, utility.css, font-awesome)
   - Common script includes

2. **Auth Form Structure** (login.html, register.html):
   - `.auth-container` wrapper
   - `.auth-card` with header/footer
   - `.form-group` with label/input/error pattern
   - `.button--primary` submit buttons
   - `.auth-nav` footer navigation

3. **Warning Banner** - Present on all pages:
   - `#warningBanner` with `.warning-banner.hidden` classes

4. **Common Scripts** - Loaded on most pages:
   - firebase-init.js, config.js, warning-banner.js, api.js, auth.js, logout-handler.js

### 🆕 Recommended New Reusable Components

#### High Priority:
1. **PageHeaderComponent** - Standardize HTML head with CSP, fonts, CSS
2. **WarningBannerComponent** - Reusable banner for alerts/notifications  
3. **ButtonComponent** - Various button styles (primary, secondary, large)
4. **LoadingSpinnerComponent** - Used in dashboard and other async operations
5. **ScriptLoaderComponent** - Manage common script loading patterns

#### Medium Priority:
6. **CheckboxComponent** - Form checkbox with label (seen in register.html)
7. **FormHelpTextComponent** - Help text patterns (password requirements)
8. **ErrorStateComponent** - Standardize error display patterns
9. **PageLayoutComponent** - Wrapper for main content structure

#### Low Priority:
10. **IconComponent** - FontAwesome icon wrapper
11. **LinkComponent** - Styled link variations (.auth-link, .auth-link--primary)

### 📋 Implementation Plan

**Next Steps:**
1. ✅ **COMPLETED**: Conduct comprehensive UI audit
2. **Phase 1** (High Priority): Implement PageHeader, WarningBanner, Button, LoadingSpinner components
3. **Phase 2** (Medium Priority): Add form-related components (Checkbox, FormHelp, ErrorState)
4. **Phase 3** (Low Priority): Create utility components (Icon, Link, PageLayout)
5. **Phase 4**: Refactor existing HTML pages to use new components
6. **Phase 5**: Establish component API documentation and usage guidelines
