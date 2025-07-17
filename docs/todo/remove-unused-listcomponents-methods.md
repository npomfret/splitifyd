# Remove Unused Methods in ListComponents

## Issue
Several static methods are defined in ListComponents but never used anywhere in the codebase.

## Unused Methods
- `renderPaginationControls()` (line 131)
- `attachPaginationListeners()` (line 151)
- `renderLoadingState()` (line 112)
- `renderErrorState()` (line 121)
- `renderEmptyState()` (line 99)

## Location
`/webapp/src/js/components/list-components.ts`

## Action Required
Either:
1. Remove these unused methods entirely, OR
2. Implement their usage if they were intended to be used

## Recommendation
Remove them unless there's a clear plan to use them soon. Dead code adds maintenance burden without value.