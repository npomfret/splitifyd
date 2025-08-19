# Task: Unified Avatar and Theme System

## Overview

This task is to refactor and implement a clear, predictable system for handling user avatars and color themes. The goal is to resolve the issue of avatars not appearing in the UI and to establish a consistent visual identity for users within groups.

## Problem Statement

1.  **Avatars Are Not Displayed:** The current `Avatar.tsx` component correctly requires a `userTheme` to be present before it will render an avatar. However, there is no backend or client-side logic to assign these themes to users, resulting in avatars never being shown.
2.  **Unused Code:** The codebase may contain remnants of a previous, simpler avatar system (e.g., functions that generated random colors). This legacy code is unused, creates confusion for developers, and should be removed.

## Proposed Solution

### 1. Clean Up Legacy Code

-   Perform a thorough audit of the codebase (`webapp-v2` and `firebase`) to identify and remove any old, unused functions or components related to the previous avatar color generation system.

### 2. Automatic Theme Assignment on Group Join

-   **Trigger:** When a user is added to a group's `members` list (either during group creation or by joining via a share link).
-   **Action:** The system will automatically assign a theme to the new member from a predefined palette.
-   **Logic:** The theme assignment should be deterministic. It can be based on the order in which users join the group. For example, the first member gets Theme 1, the second gets Theme 2, and so on, cycling through the palette.

### 3. Consistent Theme for Group Creator

-   To ensure visual consistency and a stable anchor for each group, the **group creator (owner) will always be assigned the first theme** from the predefined palette.

### 4. Predefined Theme Palette

-   A predefined list of 8-10 attractive and accessible color themes will be created. Each theme object will include:
    -   `name`: A descriptive name (e.g., "Ocean Blue").
    -   `light`: The hex code for light mode.
    -   `dark`: The hex code for dark mode.
    -   `pattern`: An accessibility pattern ('solid', 'dots', 'stripes', etc.).

## Implementation Details

-   **Backend Logic:** The theme assignment logic should reside in the Firebase Functions. The function that adds a member to a group (e.g., `joinGroupByLink` and the group creation logic) should be responsible for determining and saving the user's theme for that group.
-   **Data Model:** The chosen theme for a user within a specific group can be stored in the group's `members` map in Firestore.
    ```json
    "members": {
      "{userId}": {
        "role": "member",
        "joinedAt": "timestamp",
        "theme": { "name": "Ocean Blue", "light": "#0077b6", "dark": "#00b4d8", "pattern": "solid" }
      }
    }
    ```
-   **Client-Side:** The `Avatar.tsx` component will receive the theme object from the group data and render the avatar accordingly.

## Benefits

-   **Visible Avatars:** This change will fix the bug of avatars not appearing, significantly improving the UI and user experience.
-   **Clean Codebase:** Removing dead code makes the project easier to understand and maintain.
-   **Visual Consistency:** The deterministic theme assignment ensures that users always have the same color and avatar appearance within a group, creating a more stable and predictable interface.
