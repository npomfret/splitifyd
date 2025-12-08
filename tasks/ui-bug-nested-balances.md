# UI Bug: Balances are nested inside collapsible containers

## Status: COMPLETE

## Problem Description

There was a significant UI/UX issue where the user and group balance information was rendered inside multiple, **nested** collapsible containers. To see who owes what, a user had to click to expand multiple UI elements (double-clicking to expand).

This made critical information difficult to access and created a confusing and frustrating user experience.

## Root Cause

The issue was caused by double-wrapping of the balance component:

1. **GroupDetailPage.tsx** wrapped `BalanceSummary` in a `SidebarCard` with `collapsible` prop (lines 408-422 mobile, 530-543 desktop)
2. **BalanceSummary.tsx** (when `variant='sidebar'`) ALSO wrapped its content in another `SidebarCard` with `collapsible` prop (lines 200-224)

This created nested collapsible containers - two layers of expandable sections when only one was needed.

## Solution Implemented

Removed the inner collapsible wrapper from `BalanceSummary.tsx` while keeping the outer collapsible wrapper in `GroupDetailPage.tsx`. Now there's a **single** collapsible layer (as intended) rather than double nesting.

1. **BalanceSummary.tsx**: Changed the `variant='sidebar'` rendering to return just the content in a plain `<div>` instead of wrapping in another `SidebarCard`
2. **GroupDetailPage.tsx**: Added proper `collapseToggleTestId` and `collapseToggleLabel` props to both mobile and desktop balance sections for proper test coverage
3. **Removed unused imports** from `BalanceSummary.tsx` (SidebarCard, ScaleIcon no longer needed in sidebar variant)

## Files Modified

| File | Changes |
|------|---------|
| `webapp-v2/src/components/group/BalanceSummary.tsx` | Simplified sidebar variant to render plain div instead of nested SidebarCard; removed unused imports |
| `webapp-v2/src/pages/GroupDetailPage.tsx` | Added `collapseToggleTestId` and `collapseToggleLabel` props to balance SidebarCards |

## Result

- Balance section is now **single-layer collapsible** (one click to expand/collapse)
- No double-nesting - the page provides the SidebarCard wrapper, BalanceSummary just provides content
- "Show All" toggle still available within the balance section
- Works on both mobile and desktop views
- Tests continue to work with the existing page object methods
