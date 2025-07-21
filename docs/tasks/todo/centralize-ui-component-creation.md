# Task: Centralize UI Component Creation

**Objective:** To centralize the creation of UI elements into a single `ui-kit.ts` module. This will eliminate inconsistent, imperative UI code and establish a single source of truth for common components.

**Status:** Not Started

**Dependencies:** None

---

## Detailed Steps

### Step 1: Create the `ui-kit.ts` Module

1.  **Create a new file:** `webapp/src/js/ui-kit.ts`.
2.  **Purpose:** This file will house all the functions for creating standardized UI elements. It will become the foundation of our component library.

### Step 2: Migrate and Enhance `ui-builders.ts`

1.  **Move all functions** from `webapp/src/js/ui-builders.ts` to the new `webapp/src/js/ui-kit.ts` file.
2.  **Delete the old file:** `webapp/src/js/ui-builders.ts`.
3.  **Review and enhance the migrated functions:**
    *   **`createButton`:** Ensure it can produce all button variations found in the app (primary, secondary, danger, icon-only, etc.). Check `webapp/src/css/main.css` for all `.button--*` classes and ensure they can be generated.
    *   **`createFormField`:** This function should be robust enough to handle all input types (`text`, `password`, `email`, `number`) and their states (error, disabled, etc.).
    *   **`createCard`:** Generalize this to be the standard container for all card-like elements.

### Step 3: Refactor the Login Page

**Target Files:**
*   `webapp/login.html`
*   `webapp/src/js/login-init.ts`
*   `webapp/src/js/auth.ts`

**Actions:**

1.  **Analyze `login.html`:** Identify all static UI elements that can be generated dynamically. This includes:
    *   The main auth card container.
    *   The email and password form fields.
    *   The "Sign In" button.
    *   The "Forgot password?" link.
    *   The general error message container.

2.  **Modify `login-init.ts`:**
    *   Import the necessary functions from `ui-kit.ts`.
    *   Use these functions to dynamically generate the entire login form and its elements. The `login.html` file should be left with only a single root element (e.g., `<div id="login-container"></div>`).

3.  **Update `auth.ts`:**
    *   The `handleLogin` function will no longer need to find elements in the DOM with `document.getElementById`. Instead, the elements will be created in `login-init.ts` and the event listeners will be attached there.
    *   The logic for showing and hiding error messages will now use the dynamically created error message container.

### Step 4: Refactor the Registration Page

**Target Files:**
*   `webapp/register.html`
*   `webapp/src/js/register-init.ts`
*   `webapp/src/js/auth.ts`

**Actions:**

1.  **Analyze `register.html`:** Similar to the login page, identify all UI elements to be generated dynamically:
    *   The auth card.
    *   Display name, email, password, and confirm password fields.
    *   The "Create Account" button.
    *   The general error message container.

2.  **Modify `register-init.ts`:**
    *   Import and use the `ui-kit.ts` functions to build the registration form dynamically, leaving `register.html` with a single root element.

3.  **Update `auth.ts`:**
    *   Refactor the `handleRegister` function to work with the dynamically generated form elements, similar to the login process.

---

## Acceptance Criteria

*   The `webapp/src/js/ui-builders.ts` file is deleted.
*   The `webapp/src/js/ui-kit.ts` file exists and contains the UI creation functions.
*   The login and registration pages are rendered dynamically using the `ui-kit.ts` module.
*   There is no visual or functional regression on the login and registration pages.
*   The `login.html` and `register.html` files contain minimal HTML (i.e., a single container element).