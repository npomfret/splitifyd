# Architectural Review and Recommendations

This document provides a high-level architectural review of the monorepo, focusing on the frontend webapp and its interaction with the Firebase backend. It identifies several areas where the current architecture is showing signs of strain and offers recommendations for modernization and improvement.

## 1. Monorepo with Fragmented Tooling

**Observation:** The project is structured as a monorepo, but it lacks a unified tooling strategy. The `firebase` and `webapp` packages have separate and inconsistent build, test, and dependency management setups.

**Impact:**
- **Increased Complexity:** Developers need to learn and manage multiple sets of tools and scripts.
- **Inconsistent Environments:** Differences in tooling can lead to subtle inconsistencies between development and production environments.
- **Maintenance Overhead:** Maintaining multiple build and test configurations is time-consuming.

**Recommendations:**
- **Unified Build System:** Adopt a single, modern build tool like **Vite** or **esbuild** for the entire monorepo. This will simplify the configuration and provide a consistent build process.
- **Unified Testing:** Consolidate all tests under a single framework (e.g., Jest or Vitest) with a shared configuration. This will enable running all tests with a single command and provide a unified view of code coverage.
- **Monorepo Management:** Consider using a tool like **Turborepo** or **Nx** to manage the monorepo's scripts, dependencies, and build pipeline. This will streamline the development workflow and improve performance.

## 2. Vanilla JS/TS Frontend at its Limits

**Observation:** The `webapp` is built with vanilla TypeScript and a custom `BaseComponent` model. While functional, this approach is showing its limitations as the application grows.

**Impact:**
- **Boilerplate and Ceremony:** The custom component model requires a significant amount of boilerplate for creating components, managing their lifecycle, and handling state.
- **Manual DOM Manipulation:** The codebase is filled with manual DOM manipulation, which is error-prone, inefficient, and hard to debug.
- **Lack of a Centralized State Management:** The absence of a dedicated state management solution makes it difficult to manage and synchronize application state.

**Recommendation:**
- **Adopt a Modern Frontend Framework:** Migrating to a modern, component-based framework is the most impactful change that can be made to the frontend architecture. 
  - **SvelteKit** or **Vue** are excellent choices that would align well with the existing component-based efforts, offering a gentle learning curve and significant improvements in developer experience and performance.
  - **React (with Next.js)** is another powerful option, providing a vast ecosystem and a robust, mature platform for building complex applications.

## 3. Anemic API Layer

**Observation:** The current `apiCall` function is a thin wrapper around `fetch` and lacks many of the features required for a modern, data-driven application.

**Impact:**
- **Duplicated Logic:** Components are likely to implement their own logic for caching, retries, and error handling.
- **Poor User Experience:** The lack of caching and background data synchronization can lead to a slow and unresponsive user experience.

**Recommendation:**
- **Introduce a Data-Fetching Library:** Adopt a modern data-fetching and caching library like **TanStack Query** (which is framework-agnostic). This will provide a robust, declarative way to manage API interactions, with features like caching, automatic retries, and background data synchronization out of the box.

## Conclusion

The current architecture has served its purpose, but it is now holding the project back. The "dirty hacks" and inconsistencies identified at the file level are symptoms of these larger architectural issues. 

By investing in a more modern, unified, and framework-driven architecture, the project can significantly improve its maintainability, scalability, and developer experience. This will enable the team to build new features faster, with higher quality, and with less technical debt.