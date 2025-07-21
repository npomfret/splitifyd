# Task: Consolidate CSS into a Component-Based Structure

**Objective:** To reorganize the monolithic `main.css` file into a component-based structure. This will make the CSS more modular, easier to maintain, and will help in identifying and removing unused styles.

**Status:** Not Started

**Dependencies:**
*   `create-a-basecomponent-class.md`: As components are created, they should have their own dedicated CSS files.

---

## Detailed Steps

### Step 1: Create a Component CSS Directory

1.  **Create a new directory:** `webapp/src/css/components`.
2.  **Purpose:** This directory will contain the CSS files for individual components, mirroring the structure of the JavaScript components.

### Step 2: Create Component-Specific CSS Files

**Target File:**
*   `webapp/src/css/main.css`

**Actions:**

1.  **Start with the button component:**
    *   Create a new file: `webapp/src/css/components/button.css`.
    *   Move all button-related styles from `main.css` into this new file. This includes `.button`, `.button--primary`, `.button--secondary`, etc.

2.  **Continue with other components:**
    *   Create CSS files for other components like `card.css`, `form-field.css`, `modal.css`, etc.
    *   Systematically move the corresponding styles from `main.css` to the new component-specific files.

### Step 3: Update the Build Process

**Target File:**
*   `esbuild.config.js` (or your project's build configuration file)

**Actions:**

1.  **Modify the build configuration:**
    *   Update the build script to find and process all CSS files within the `webapp/src/css` directory, including the new `components` subdirectory.
    *   Ensure that the build process correctly bundles all the individual CSS files into a single stylesheet for production.

---

## Acceptance Criteria

*   The `webapp/src/css/components` directory is created.
*   CSS for individual components is moved from `main.css` to their own files within the new directory.
*   The build process is updated to handle the new CSS structure.
*   There is no visual regression in the application.
*   The `main.css` file is significantly smaller and contains only global styles.