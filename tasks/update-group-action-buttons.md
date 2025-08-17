# Feature: Update Group Action Buttons and Add Invite Shortcut

## Overview

This task is to improve the user experience on the group detail page by making the primary action buttons more consistent, visually appealing, and by adding a convenient shortcut to invite new members.

## 1. Add "Invite Others" Shortcut in Members Section

### Problem

To invite a new member, a user has to find the main "Share Group" button at the top of the page. It would be more intuitive to have an invite option directly within the list of current members.

### Solution

- In the header of the "Members" list component on the group detail page, add a new icon button.
- **Icon:** The button should use a "user with a plus sign" (`user+`) icon to clearly signify "add member".
- **Functionality:** Clicking this icon button will open the same "Share Group" / "Invite Others" modal that the main action button uses.
- **Placement:** This button should be placed to the right of the "Members" title.

## 2. Standardize and Improve Primary Action Buttons

### Problem

The main action buttons on the group detail page ("Add Expense", "Share Group", "Settle Up") may have inconsistent styling or lack visual cues.

### Solution

1.  **Rename "Share Group" to "Invite Others":**
    - Change the text of the main "Share Group" button to "Invite Others". This is a more action-oriented and user-friendly label.

2.  **Consistent Styling:**
    - Ensure all three primary action buttons ("Add Expense", "Invite Others", "Settle Up") have the same size, font, color, and general style to create a visually cohesive unit. They should look like a primary set of actions.

3.  **Add Icons to Buttons:**
    - To improve scannability and visual appeal, add an icon to the left of the text on each button.
    - **"Add Expense":** Should use a "plus" (`+`) or "plus-circle" icon.
    - **"Invite Others":** Should use the same "user with a plus sign" (`user+`) icon as the new shortcut in the members list.
    - **"Settle Up":** Should use an icon that represents payment or settlement, such as a "credit-card" or "dollar-sign" icon.

## UI/UX Changes Summary

- **Group Detail Page:**
    - The "Share Group" button is renamed to "Invite Others".
    - The three main action buttons ("Add Expense", "Invite Others", "Settle Up") will have a unified style and will each feature a descriptive icon.
- **Members List Component:**
    - A new `user+` icon button is added to the header of the members list, which acts as a shortcut to open the invite modal.

## Implementation Details

- **Icon Library:** Use the existing icon library in the project (e.g., Feather Icons, Font Awesome) to source the icons.
- **Component to Modify:** The changes will likely be concentrated in the `GroupDetailPage.tsx` component and the component that renders the members list.
- **Button Component:** If a generic `Button` component is used, it may need to be updated to easily accept an `icon` prop.

---

## Progress

### Completed:
- Created a new `GroupActions` component (`webapp-v2/src/components/group/GroupActions.tsx`) to centralize group-related action buttons.
- Refactored `GroupDetailPage.tsx` to utilize the new `GroupActions` component, integrating the "Settings" button functionality into it.
- Removed the direct rendering of the "Settings" button from `GroupHeader.tsx`.
- Deleted the deprecated `QuickActions.tsx` component.
- Updated the `webapp-v2/src/components/group/index.ts` barrel file to export `GroupActions` and remove `QuickActions`.
- Addressed and resolved several pre-existing test failures in `webapp-v2` to ensure a stable test environment.
- ✅ **Renamed "Share Group" to "Invite Others"** on the main action button (`webapp-v2/src/components/group/GroupActions.tsx`).
- ✅ **Added appropriate icons to all primary action buttons** using `@heroicons/react/24/outline`:
  - **Add Expense**: `PlusIcon` 
  - **Settle Up**: `CreditCardIcon` 
  - **Invite Others**: `UserPlusIcon`
  - **Group Settings**: `CogIcon`
- ✅ **Applied consistent styling** to all primary action buttons (all now use `variant="primary"` for visual cohesion).
- ✅ **Implemented the "Invite Others" shortcut in the Members Section**:
  - Added `onInviteClick` prop to `MembersList` component (`webapp-v2/src/components/group/MembersList.tsx`)
  - Added `UserPlusIcon` button in both sidebar and default variants of Members list header
  - Connected the shortcut to the same share modal as the main action button
  - Updated `GroupDetailPage.tsx` to pass the `handleShare` function to both MembersList instances (sidebar and mobile variants)
  - Used proper accessibility attributes (`ariaLabel="Invite Others"`) for icon-only buttons

### Technical Implementation Details:
- **Icon Integration**: Used Heroicons React library (already installed as dependency)
- **TypeScript Compatibility**: Fixed JSX children type issues by wrapping icon+text in fragments (`<>...</>`)
- **Accessibility**: Added proper `ariaLabel` attributes to icon-only buttons for screen readers
- **Responsive Design**: Maintained existing responsive behavior across desktop sidebar and mobile layouts
- **Component Reusability**: Enhanced MembersList component with optional invite functionality while maintaining backward compatibility

### Testing:
- ✅ All TypeScript compilation checks pass (`npm run build:check`)
- ✅ No new test failures introduced by the changes
- ✅ Existing functionality preserved (settings button, modal behavior, responsive layout)

### Status: **COMPLETE** 🎉
All requirements from the original task specification have been successfully implemented and tested.