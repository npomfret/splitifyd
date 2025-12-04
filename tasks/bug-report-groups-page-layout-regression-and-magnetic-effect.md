# Bug Report: Groups Page Layout Regression and Incorrect Magnetic Effect

## Overview
On the main groups page (dashboard), the layout for displaying individual groups has regressed. Instead of appearing in a tiled, multi-column layout (previously observed in columns of 3 on desktop), groups are now displayed in a single-column list format. This change negatively impacts the visual presentation and scannability of groups.

Additionally, the individual group containers on this page now exhibit an unintended "magnetic" hover effect. According to the `docs/guides/webapp-and-style-guide.md` ("Motion System" and "Component Patterns"), this `useMagneticHover()` effect is primarily intended for interactive elements like classic buttons, not larger content blocks such as group containers.

## Steps to Reproduce
1. Log in to the application.
2. Navigate to the main groups page (dashboard) on a desktop browser.
3. Observe the layout of the group cards/containers.
4. Hover over individual group containers.

## Expected Behavior
1. **Groups Layout:** On desktop view, groups should be displayed in a tiled, multi-column layout (e.g., 3 columns) to efficiently utilize screen space and improve visual organization.
2. **Magnetic Effect:** The magnetic hover effect should be applied judiciously, primarily to interactive `Button` components, not to static content containers like individual group cards.

## Actual Behavior
1. **Groups Layout:** Groups are displayed in a single-column list, requiring more vertical scrolling and reducing desktop usability. This is a regression from a previously more optimized layout.
2. **Magnetic Effect:** The magnetic hover effect is applied to the entire group container, which is visually distracting and deviates from the intended use of this effect for smaller, more direct interactive elements.

## Impact
- **User Experience (Layout):** Decreased usability and aesthetic appeal on desktop, making it harder to quickly scan and select groups.
- **User Experience (Magnetic Effect):** Visual clutter and inconsistency with established UI/UX guidelines, potentially causing distraction rather than enhancing interaction.
- **Performance (Magnetic Effect):** Applying complex motion effects to larger, numerous elements can sometimes lead to minor performance overhead, though this would need to be verified.
- **Code Consistency:** Deviation from `webapp-and-style-guide.md` regarding motion system application.

## Possible Cause (Initial Thoughts)
1. **Layout Regression:**
    - Changes in CSS grid/flex properties on the container of the group list.
    - Accidental removal or modification of responsive breakpoints for the group cards.
    - Introduction of a new component wrapper that overrides the intended layout.
2. **Magnetic Effect:**
    - The `useMagneticHover()` hook or similar styling has been inadvertently applied to the `GroupCard` component or its parent, where it was not intended.
    - A global style or a default application of the effect to `Clickable` components (if `GroupCard` wraps one) that needs to be more granularly controlled.

## Priority
Medium - This is a UI regression and a styling inconsistency that affects the overall polish and usability of a core page. While not critical functionality-wise, it degrades the quality of the application.

---

## Additional Finding (2025-12-04)

The security preset buttons in the Group Settings Modal ("Security & Permissions" tab) also have the magnetic effect applied inappropriately. These are larger content containers with multi-line text (label + description), not small interactive buttons.

## Work Items

- [x] Remove magnetic effect from group card containers on the dashboard
- [x] Remove magnetic effect from security preset buttons in GroupSettingsModal
- [x] Review other large container elements that may have magnetic effect applied inappropriately

---

## Resolution (2025-12-04)

### Status: MAGNETIC EFFECT ISSUES RESOLVED

### Root Cause
1. **GroupCard**: Explicitly set `magnetic={true}` on Card component, overriding the Card's default of `magnetic={false}`
2. **Security Presets**: Button component defaults to `magnetic={true}` (line 44 of Button.tsx), so all buttons inherit magnetic effect unless explicitly disabled

### Fix Applied
1. **GroupCard.tsx** (line 106): Removed `magnetic={true}` prop - Card now uses its default `magnetic={false}`
2. **GroupSettingsModal.tsx** (line 794): Added `magnetic={false}` to preset buttons to override Button's default

### Files Changed
- `webapp-v2/src/components/dashboard/GroupCard.tsx`
- `webapp-v2/src/components/group/GroupSettingsModal.tsx`

### Testing
- Build passed with no errors
- Manual verification: Hover over group cards on dashboard and preset buttons in settings - magnetic effect no longer applied

### Note on Layout Regression
The single-column layout issue mentioned in this bug report is a separate concern and was not addressed in this fix. Only the magnetic effect work items were resolved.