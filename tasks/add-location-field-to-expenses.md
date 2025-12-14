# Add Optional "Location" Field to Expenses

## Status: ✅ COMPLETE

## Problem Description
Currently, expenses only track basic details like amount, description, and date. There is a need to allow users to optionally specify a location for an expense, which could be useful for tracking where spending occurred (e.g., "Starbucks", "Gas Station", "Paris").

## Implemented Approach

**Structured Location with Recent Locations Autocomplete + Google Maps URL Paste**

- Structured `ExpenseLocation` type with `name` (required) and `url` (optional)
- Text input with autocomplete from recent locations (derived from group expenses)
- "Find on Map" / "Open on Map" button - opens Google Maps in a new tab (uses stored URL if available)
- Paste detection: when user pastes a Google Maps URL, extracts place name and preserves the URL for later
- Always visible in the expense form (like labels field)

### Data Structure
```typescript
// ExpenseLocation interface
interface ExpenseLocation {
    name: string;    // The place name (e.g., "Starbucks", "Café de Flore")
    url?: string;    // Optional Google Maps URL for linking back
}

// On Expense interface
location?: ExpenseLocation;
```

### User Flow
1. User types location manually (e.g., "Starbucks") OR
2. User clicks map icon → opens Google Maps in new tab
3. User searches/navigates in Google Maps, copies the URL
4. User pastes URL into location field → app extracts place name and stores both name + URL
5. When expense has a stored URL, map button says "Open on map" and links directly to that location

## Implementation Summary

### Backend Changes

| File | Changes |
|------|---------|
| `packages/shared/src/shared-types.ts` | Added `ExpenseLocation` interface, added `location?: ExpenseLocation` to `Expense`, `CreateExpenseRequest`, `UpdateExpenseRequest`, `ExpenseDraft` |
| `packages/shared/src/schemas/apiRequests.ts` | Added `ExpenseLocationSchema`, added to create/update request schemas |
| `packages/shared/src/schemas/apiSchemas.ts` | Added location to `ExpenseDataSchema` |
| `firebase/functions/src/schemas/expense.ts` | Added location to `BaseExpenseSchema` |
| `firebase/functions/src/expenses/validation.ts` | Added location handling in create/update transforms |
| `firebase/functions/src/services/ExpenseService.ts` | Added location handling in create/update methods |

### Frontend Changes

| File | Changes |
|------|---------|
| `webapp-v2/src/app/utils/google-maps-parser.ts` | **NEW** - `parseMapsUrl()`, `isMapsUrl()` - supports 10 map services |
| `webapp-v2/src/components/expense-form/LocationInput.tsx` | **NEW** - Input component with autocomplete, paste detection, map button |
| `webapp-v2/src/app/stores/expense-form-store.ts` | Added `#locationSignal`, getters, updateField case, reset/load handling |
| `webapp-v2/src/app/hooks/useFormState.ts` | Added location to form state |
| `webapp-v2/src/app/hooks/useFormInitialization.ts` | Added location to expense loading |
| `webapp-v2/src/app/hooks/useExpenseForm.ts` | Added location to form state, added `deriveRecentLocationsFromExpenses()` to derive autocomplete suggestions from loaded expenses |
| `webapp-v2/src/components/expense-form/ExpenseBasicFields.tsx` | Added LocationInput component |
| `webapp-v2/src/components/expense-form/ExpenseFormModal.tsx` | Pass location prop |

### Test Support

| File | Changes |
|------|---------|
| `packages/test-support/src/builders/CreateExpenseRequestBuilder.ts` | Added `withLocation()`, `withLocationName()`, `withLocationNameAndUrl()` |
| `packages/test-support/src/builders/ExpenseUpdateBuilder.ts` | Added `withLocation()`, `withLocationName()`, `withLocationNameAndUrl()` |
| `packages/test-support/src/builders/ExpenseDTOBuilder.ts` | Added `withLocation()` |
| `packages/test-support/src/page-objects/ExpenseFormPage.ts` | Added location-related selectors and verification methods |

### Translations

Added 6 new translation keys to all 13 locales:
- `expenseBasicFields.locationLabel`
- `expenseBasicFields.locationPlaceholder`
- `expenseBasicFields.findOnMap`
- `expenseBasicFields.openOnMap`
- `expenseBasicFields.recentLocations`
- `expenseBasicFields.clearLocation`

### Tests

| File | Tests Added |
|------|-------------|
| `firebase/functions/src/__tests__/unit/api/expenses.test.ts` | 7 tests for location create/update/retrieve |
| `webapp-v2/src/__tests__/unit/vitest/utils/google-maps-parser.test.ts` | **NEW** - URL parsing tests |
| `webapp-v2/src/__tests__/integration/playwright/expense-form.test.ts` | 4 tests for location field UI |

## Design Decisions

1. **Structured type vs simple string**: Chose structured `ExpenseLocation` to preserve Google Maps URL when pasted, enabling "Open on map" functionality
2. **Recent locations from expenses**: Derived from loaded group expenses (no localStorage), limited to 10 unique location names for autocomplete suggestions
3. **No coordinates**: Only store place name and optional URL - no geocoding needed
4. **Max length**: 200 characters for location name (matches description field pattern)
5. **Always visible**: Location input shown by default in expense form (like labels)
6. **Supported map services** (10 total): Google Maps, Apple Maps, Waze, Bing Maps, OpenStreetMap, HERE Maps, Baidu Maps (China), Yandex Maps (Russia), Kakao Maps (South Korea), Naver Maps (South Korea)
