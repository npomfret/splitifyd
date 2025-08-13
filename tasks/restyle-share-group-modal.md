# Feature: Restyle "Invite Others" Modal

## Overview

This task is to modernize and improve the user experience of the "Invite Others" (formerly "Share Group") modal. The current design is functional but could be more visually appealing and space-efficient.

## 1. Improve Link Sharing UI

### Problem
The current modal has a large "Copy" button positioned underneath the share link input field. This layout uses more vertical space than necessary and can be visually clunky.

### Solution
-   **Redesign the input field:** The share link will be displayed in a read-only text input.
-   **Replace the button with an icon:** Instead of a full-width button below the input, place a "copy" icon button *inside* the input field, aligned to the right.
-   **Functionality:**
    -   Clicking the "copy" icon will copy the link to the clipboard.
    -   After a successful copy, the icon should briefly change to a "check" icon and then revert back to the "copy" icon. This provides clear visual feedback to the user.
    -   A toast notification saying "Link copied to clipboard" should also appear.

## 2. Enhance Modal Aesthetics

### Problem
The modal is currently plain and lacks visual appeal. A touch of color and better styling can make it feel more polished and integrated with the application's design.

### Solution
-   **Add a Header with Subtle Color:**
    -   The modal header (containing the title "Invite Others") will be given a subtle background color. A good choice would be a light, soft shade of the application's primary brand color (e.g., a light blue or green). This helps to visually frame the modal's content.
-   **Improve Typography and Spacing:**
    -   Review the font sizes, weights, and spacing within the modal to ensure a clean and balanced layout.
    -   Add a short, friendly instructional text below the header, such as: "Share this link with anyone you want to join this group."
-   **QR Code Integration:**
    -   The QR code (from the `display-qr-code-for-share-links.md` task) should be centered below the share link input, with clear padding and a simple label like "Or scan this code".

## New Modal Layout Sketch

```
+-----------------------------------------+
| [Icon] Invite Others                    |  <-- Header with subtle background color
+-----------------------------------------+
|                                         |
| Share this link with anyone you want    |
| to join this group.                     |
|                                         |
| +-------------------------------------+ |
| | [https://app.com/join/xyz123]  [📋] | |  <-- Input with copy icon button
| +-------------------------------------+ |
|                                         |
|           +-----------------+           |
|           | ############### |           |
|           | ############### |           |
|           | ############### |           |
|           +-----------------+           |  <-- QR Code
|             Or scan this code           |
|                                         |
|   [Expiration: 1 day] [Generate New]    |  <-- Link expiration options
|                                         |
+-----------------------------------------+
```

## Benefits

-   **Modern UI:** The redesigned modal will look more contemporary and professional.
-   **Improved UX:** The inline copy icon is a more common and space-efficient design pattern.
-   **Better Visual Hierarchy:** The use of color and spacing will guide the user's eye and make the modal easier to understand.
-   **Enhanced Feedback:** The icon change on copy provides immediate confirmation of the action.
