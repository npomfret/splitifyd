# Bug Report: Tooltip Z-Index Issues Causing Clipping

**Status: RESOLVED**

## Overview
Tooltips across the application are sometimes partially or fully obscured by other UI elements. This indicates a problem with the `z-index` stacking order, where the tooltips are rendered underneath other components that have a higher `z-index` or are in a different stacking context.

## Root Cause
The Tooltip component (`webapp-v2/src/components/ui/Tooltip.tsx`) was rendering inline with `position: absolute` and no explicit z-index. When tooltips appeared inside containers with `overflow: hidden`, `transform`, or other properties that create new stacking contexts, they got clipped or appeared behind other elements.

## Solution
Refactored the Tooltip component to:
1. **Render via `createPortal` to `document.body`** - escapes parent stacking contexts entirely
2. **Use `position: fixed` with `z-50`** - ensures tooltips appear above most content (same level as modals)
3. **Calculate position dynamically** - uses `getBoundingClientRect()` to position relative to trigger element
4. **Auto-flip when near viewport edges** - if `placement='top'` but no room above, flips to bottom (and vice versa)
5. **Clamp horizontal position** - prevents tooltip from overflowing left/right viewport edges
6. **Recalculate on scroll/resize** - position updates dynamically as the page scrolls or window resizes

## Files Modified
- `webapp-v2/src/components/ui/Tooltip.tsx`

## Testing
- Build passes (`npm run build`)
- Existing component tests pass (GroupCard, Clickable)