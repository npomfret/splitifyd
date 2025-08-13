# Feature: Automatic User Theme Colors

## Overview

To make it easier to visually distinguish between users in lists, expenses, and settlements, this feature will automatically assign a unique, persistent color to each user. This color will be used to style UI elements associated with that user, providing at-a-glance recognition.

## Key Concepts

-   **Automatic Assignment:** When a new user signs up, a color will be automatically assigned to them from a predefined palette.
-   **Persistence:** The assigned color will be stored in the user's profile document in Firestore so it remains consistent across all sessions and devices.
-   **Visual Association:** This color will be used as a visual tag for the user throughout the application.

## Implementation Details

### 1. Predefined Color Palette

-   A predefined palette of attractive, accessible, and visually distinct colors should be created.
-   The palette should contain a reasonable number of colors (e.g., 12-20) to ensure variety but also consistency.
-   The colors should be stored in a configuration file (e.g., `webapp-v2/src/constants/user-colors.ts`).

**Example Palette:**
```typescript
// webapp-v2/src/constants/user-colors.ts
export const USER_COLORS = [
  '#3498db', // Blue
  '#2ecc71', // Green
  '#e74c3c', // Red
  '#9b59b6', // Purple
  '#f1c40f', // Yellow
  '#1abc9c', // Teal
  '#e67e22', // Orange
  // ... more colors
];
```

### 2. Color Assignment Logic

-   **On User Creation:** A new Firebase Cloud Function that triggers on user creation (`auth.user().onCreate()`) will be responsible for assigning a color.
-   **Assignment Strategy:**
    1.  The function will maintain a counter or a pointer to the last used color index in the `USER_COLORS` array.
    2.  When a new user is created, the function will assign the next color in the palette.
    3.  The index will loop back to the beginning when it reaches the end of the array.
    4.  This logic ensures a relatively even distribution of colors.

### 3. Data Model Changes

-   The `users` collection in Firestore will be updated to include the assigned color.

**User Document Structure:**
```json
// /users/{userId}
{
  "displayName": "string",
  "email": "string",
  "createdAt": "timestamp",
  "themeColor": "string" // e.g., "#3498db"
}
```

### 4. UI/UX Application

The `themeColor` will be used to style various UI elements associated with the user:

-   **Avatars:** If a user has not uploaded a profile picture, their avatar can be a circle filled with their `themeColor`, containing their initials.
-   **Member Lists:** A small colored dot can be placed next to each user's name in the member list.
-   **Expense Lists:** The user's color can be used as a border-left color or a background highlight on expenses they have paid for.
-   **Settlements:** The color can be used to highlight transactions involving that user in the settlement view.

**Example CSS Usage:**
```css
.expense-item {
  border-left: 4px solid var(--user-theme-color);
}

.avatar {
  background-color: var(--user-theme-color);
  color: white; /* Or a contrasting color */
}
```
The `--user-theme-color` CSS variable would be dynamically set based on the user's color from their profile.

## Benefits

-   **Improved Scannability:** Makes it much faster to identify who paid for what in a long list of expenses.
-   **Enhanced UX:** Adds a layer of visual polish and personality to the application.
-   **Better Organization:** Helps to visually group and categorize information related to specific users.
-   **No User Effort:** The automatic assignment means users get this benefit without any configuration.
