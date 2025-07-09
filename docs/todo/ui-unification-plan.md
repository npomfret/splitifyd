# UI Unification Plan

This document outlines a plan to address UI inconsistencies and create a more unified, maintainable, and professional user experience for the Splitifyd web application.

## 1. Standardize on a Programmatic, Component-Based Architecture

*   **Problem:** The application is built with a mix of static HTML pages and newer, programmatically generated pages. This leads to inconsistent development patterns and a fragmented user experience.
*   **Solution:**
    1.  **Migrate All Pages to Programmatic Rendering:** Convert all remaining static HTML pages (e.g., `dashboard.html`, `add-expense.html`, authentication pages) to the new architecture, where a minimal HTML file loads a JavaScript module responsible for rendering the entire page content.
    2.  **Unify on a Single Modal Implementation:** Deprecate all hardcoded HTML modals and refactor them to use the reusable `ModalComponent` class. This will centralize modal logic, styling, and behavior.
    3.  **Standardize Form Handling:** Refactor all forms to be generated programmatically, ensuring consistent validation, submission, and error handling logic across the application.

## 2. Create a Consistent Visual Identity

*   **Problem:** The static pages (Terms of Service, Privacy Policy) have a completely different and unprofessional visual style compared to the main application.
*   **Solution:**
    1.  **Use a Single Stylesheet:** Remove the `static-pages.css` file and have all pages use the main `main.css` stylesheet.
    2.  **Create a Consistent Layout:** Wrap the content of static pages in a standard container element that reuses the styling (e.g., background, padding, box-shadow) from the main application, ensuring a seamless look and feel.

## 3. Develop a Reusable Component Library

*   **Problem:** Common UI elements are re-implemented in multiple places, leading to code duplication and visual inconsistencies.
*   **Solution:**
    1.  **Identify and Abstract Reusable Components:** Identify common UI patterns (e.g., buttons, cards, input fields) and abstract them into a library of reusable components.
    2.  **Establish a Clear Component API:** Each component should have a well-defined interface for passing in data and handling events, making them easy to use and compose.

By implementing this plan, Splitifyd will have a more cohesive and professional UI, a more efficient development workflow, and a more solid foundation for future growth.