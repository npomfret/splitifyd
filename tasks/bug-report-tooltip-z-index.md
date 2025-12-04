# Bug Report: Tooltip Z-Index Issues Causing Clipping

## Overview
Tooltips across the application are sometimes partially or fully obscured by other UI elements. This indicates a problem with the `z-index` stacking order, where the tooltips are rendered underneath other components that have a higher `z-index` or are in a different stacking context.

## Steps to Reproduce
1. Log in to the application.
2. Navigate to various pages where tooltips are used. Some examples might include:
    - Hovering over action icons (e.g., Edit, Delete) in a list.
    - Hovering over truncated text or information icons.
    - Hovering over disabled buttons.
3. Trigger a tooltip in a situation where it is near other components, especially within modals, cards, or complex layouts.
4. Observe whether the tooltip is fully visible or if it gets "clipped" or hidden behind an adjacent element.

## Expected Behavior
Tooltips should always appear on top of all other page content, ensuring they are fully visible and readable to the user regardless of their position on the screen.

## Actual Behavior
Tooltips are sometimes clipped by parent containers or appear behind other elements, making them difficult or impossible to read. This is a classic `z-index` issue.

## Impact
- **User Experience:** This makes the application feel buggy and unprofessional. Users cannot read the helpful information provided by the tooltips, which can lead to confusion.
- **Usability:** If a tooltip contains critical information (e.g., explaining why a button is disabled), this bug can prevent the user from understanding the state of the UI.

## Possible Cause (Initial Thoughts)
This problem is almost certainly related to CSS stacking contexts. The tooltip component likely has a `z-index` that is not high enough to overcome the `z-index` of other components. The issue might be exacerbated by:
- Parent containers with `overflow: hidden`, `transform`, `opacity < 1`, or other properties that create a new stacking context, "trapping" the tooltip's `z-index` within that context.
- The `z-index` of other components (like modals, headers, or sidebars) being set to an excessively high value.
- The tooltip component not being rendered at the root of the DOM (e.g., via a Preact portal), which would free it from the `z-index` constraints of its parent elements.

A common solution is to ensure the tooltip component uses a portal to render at the top level of the document body and has a very high `z-index` (e.g., `z-50` or higher in Tailwind CSS).

## Priority
Low to Medium - This is a UI polish issue. It doesn't break functionality but significantly degrades the user experience and can hide important contextual information.