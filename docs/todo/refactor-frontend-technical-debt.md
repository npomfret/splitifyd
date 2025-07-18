# Refactor Frontend Technical Debt

This document outlines several areas of technical debt identified in the webapp frontend. These issues contribute to code fragility, duplication, and maintenance overhead.

## 1. Redundant Dashboard Logic and Legacy Code

**Problem:** There is significant code duplication between `webapp/src/js/dashboard.ts` and `webapp/src/js/components/DashboardComponent.ts`. Both files contain nearly identical logic for initialization, data fetching, and error handling. The `dashboard.html` file loads `dashboard-init.js`, which correctly uses the component-based approach, making `dashboard.ts` legacy code.

**Impact:**
- **Increased Maintenance:** Changes need to be applied in two places.
- **Inconsistency Risk:** Logic can easily diverge, leading to subtle bugs.
- **Code Bloat:** Unnecessary code increases the bundle size and cognitive load for developers.

**Recommendation:**
1.  Consolidate all necessary logic into `DashboardComponent.ts`.
2.  Delete the legacy `dashboard.ts` file.
3.  Verify that `dashboard.html` and its initialization script (`dashboard-init.js`) exclusively use the `DashboardComponent`.

## 2. Inconsistent and Hardcoded Error Handling

**Problem:** The error handling in both `dashboard.ts` and `DashboardComponent.ts` uses a hardcoded HTML string with an inline `onclick` event. This is a poor practice that mixes concerns and is not reusable.

**Impact:**
- **Inconsistent UI:** Error messages may look and behave differently across the application.
- **Difficult to Maintain:** Changing the style or functionality of error messages requires finding and replacing raw HTML strings.
- **Violates Component Architecture:** This approach bypasses the component-based structure of the application.

**Recommendation:**
1.  Create a generic, reusable `ErrorComponent`.
2.  This component should accept parameters like `message` and an optional `onRetry` callback.
3.  Refactor `DashboardComponent` and other parts of the app to use this new `ErrorComponent` for displaying errors.

## 3. Fragile Development Configuration

**Problem:** The `RegisterComponent.ts` uses hardcoded fallback values if it fails to load development-mode form defaults from the configuration manager.

**Impact:**
- **Masks Configuration Issues:** The fallback can hide underlying problems with the configuration loading system.
- **Potential for Discrepancies:** The hardcoded values can become out of sync with the actual default configuration.

**Recommendation:**
- The configuration system should be robust enough that it doesn't require fallbacks in the code.
- Instead of a fallback, the system should fail fast during development if the configuration cannot be loaded, alerting the developer to the problem immediately.

## 4. Overly Complex DOM Manipulation

**Problem:** The `WarningBannerComponent.ts` uses a "temporary container" pattern to replace an existing global banner. This is a clever but unnecessarily complex workaround for managing a singleton UI element.

**Impact:**
- **Hard to Understand:** The logic is not straightforward and can be confusing for new developers.
- **Brittle:** This kind of direct DOM manipulation can break if the surrounding HTML structure changes.

**Recommendation:**
- Refactor the banner management logic. A better approach would be to have a dedicated manager or a singleton service that controls the lifecycle and rendering of the global banner, ensuring only one instance exists and is updated correctly without complex DOM replacement logic.
