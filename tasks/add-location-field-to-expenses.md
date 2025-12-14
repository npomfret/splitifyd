# Add Optional "Location" Field to Expenses

## Problem Description
Currently, expenses only track basic details like amount, description, and date. There is a need to allow users to optionally specify a location for an expense, which could be useful for tracking where spending occurred (e.g., "Starbucks", "Gas Station", "Paris").

## Chosen Approach

**Simple String with Recent Locations Autocomplete + Google Maps URL Paste**

A simplified approach that provides good UX with zero API costs:

- Simple `location?: string` field (no coordinates or structured data)
- Text input with autocomplete from recent locations (localStorage)
- "Find on Map" button opens Google Maps in a new tab
- Paste detection: when user pastes a Google Maps URL, extract and display the place name
- Always visible in the expense form (like labels field)

### User Flow
1. User types location manually (e.g., "Starbucks") OR
2. User clicks map icon → opens Google Maps in new tab
3. User searches/navigates in Google Maps, copies the URL
4. User pastes URL into location field → app extracts place name automatically

### Data Structure
```typescript
// Simple optional string on Expense interface
location?: string;  // e.g., "Starbucks", "Paris", "Gas Station"
```

## Implementation Plan

### Phase 1: Backend Types & Schemas

1. **Shared Types** (`packages/shared/src/shared-types.ts`)
   - Add `location?: string` to `Expense` interface (around line 870)

2. **Request Schemas** (`packages/shared/src/schemas/apiRequests.ts`)
   - Add location to `CreateExpenseRequestSchema`:
     ```typescript
     location: z.string().trim().max(200, 'Location cannot exceed 200 characters').optional(),
     ```
   - Add location to `UpdateExpenseRequestSchema`
   - Update the "no valid fields" superRefine check

3. **Response Schemas** (`packages/shared/src/schemas/apiSchemas.ts`)
   - Add `location: z.string().optional()` to `ExpenseDataSchema`

4. **Firestore Schema** (`firebase/functions/src/schemas/expense.ts`)
   - Add `location: z.string().max(200).optional()` to `BaseExpenseSchema`

5. **Validation** (`firebase/functions/src/expenses/validation.ts`)
   - Add `location` to error mapper if needed
   - Location flows through existing expense creation/update paths automatically

### Phase 2: Frontend Utilities

6. **Google Maps URL Parser** (NEW: `webapp-v2/src/app/utils/google-maps-parser.ts`)
   ```typescript
   export function parseGoogleMapsUrl(input: string): string | null;
   export function isGoogleMapsUrl(input: string): boolean;
   ```
   - Parse place name from Google Maps URLs
   - Handle formats: `/maps/place/NAME/` and `?q=NAME`
   - Return just the extracted name string (no coordinates)

7. **Recent Locations Storage** (NEW: `webapp-v2/src/app/utils/recent-locations.ts`)
   ```typescript
   export function getRecentLocations(): string[];
   export function addRecentLocation(location: string): void;
   ```
   - Store in localStorage under key like `billsplit-recent-locations`
   - Keep max 10 unique locations, most recent first

### Phase 3: Form Store & Component

8. **Form Store** (`webapp-v2/src/app/stores/expense-form-store.ts`)
   - Add `readonly #locationSignal = signal<string>('');`
   - Add getter: `get location() { return this.#locationSignal.value; }`
   - Add `locationSignal` getter for ReadonlySignal
   - Add case in `updateField()` for `'location'`
   - Add to `resetForm()` to clear location
   - Add to `loadExpense()` to populate from existing expense
   - Save location to recent locations in `saveExpense()`

9. **Location Input Component** (NEW: `webapp-v2/src/components/expense-form/LocationInput.tsx`)
   - Text input with autocomplete dropdown
   - Props: `value`, `onChange`, `error`, `recentLocations`
   - Paste handler that detects Google Maps URLs and extracts name
   - "Find on Map" icon button that opens Google Maps in new tab
   - Autocomplete from recent locations on focus/type
   - Clear button when value present

10. **Basic Fields Integration** (`webapp-v2/src/components/expense-form/ExpenseBasicFields.tsx`)
    - Add `LocationInput` component after description field (always visible)
    - Pass `location`, `validationErrors.location`, `updateField`
    - Get recent locations from utility

### Phase 4: Translations

11. **Translations** (`webapp-v2/locales/en/translation.json`)
    Add to `expenseBasicFields`:
    ```json
    "locationLabel": "Location",
    "locationPlaceholder": "Where was this expense?",
    "findOnMap": "Find on map",
    "recentLocations": "Recent locations",
    "clearLocation": "Clear location"
    ```

### Phase 5: Tests

12. **URL Parser Tests** (NEW: `webapp-v2/src/app/utils/__tests__/google-maps-parser.test.ts`)
    - Test URL formats: `/maps/place/NAME/`, `?q=NAME`, plus sign encoding
    - Test non-URL strings return null
    - Test edge cases

13. **API Tests** (`firebase/functions/src/__tests__/unit/api/expenses.test.ts`)
    - Add test for creating expense with location
    - Add test for updating expense location
    - Add test for location validation (max 200 chars)

14. **E2E Tests** (`webapp-v2/src/__tests__/integration/playwright/expense-*.test.ts`)
    - Add location field tests to existing expense form tests
    - Test autocomplete behavior
    - Test Google Maps URL paste

## Files to Modify/Create

| File | Action |
|------|--------|
| `packages/shared/src/shared-types.ts` | Add `location?: string` to Expense |
| `packages/shared/src/schemas/apiRequests.ts` | Add location to request schemas |
| `packages/shared/src/schemas/apiSchemas.ts` | Add location to response schema |
| `firebase/functions/src/schemas/expense.ts` | Add location to document schema |
| `firebase/functions/src/expenses/validation.ts` | Add error mapping if needed |
| `webapp-v2/src/app/utils/google-maps-parser.ts` | **CREATE** |
| `webapp-v2/src/app/utils/recent-locations.ts` | **CREATE** |
| `webapp-v2/src/components/expense-form/LocationInput.tsx` | **CREATE** |
| `webapp-v2/src/app/stores/expense-form-store.ts` | Add location signal/handlers |
| `webapp-v2/src/components/expense-form/ExpenseBasicFields.tsx` | Add LocationInput |
| `webapp-v2/locales/en/translation.json` | Add translations |

## Implementation Notes

1. **Paste detection**: When user pastes a Google Maps URL, extract place name and show it (not the URL)
2. **Recent locations**: Save location to localStorage when expense is saved (in store's `saveExpense()`)
3. **Always visible**: Location input is always shown in form (like labels field)
4. **No coordinates**: Store just the string name, not structured location data
5. **Max length**: 200 characters matches description field pattern

## Research Notes

### Options Considered

| Option | Effort | Cost | Decision |
|--------|--------|------|----------|
| Simple text input | Low | Free | Too basic (no autocomplete) |
| Text + recent locations | Medium | Free | **Chosen approach** |
| Google Places API | High | ~$3/1k requests | Overkill for this use case |
| Structured ExpenseLocation | Medium | Free | Unnecessary complexity |

### Google Maps URL Formats
```
# Standard place URL
/maps/place/Starbucks/@40.748,-73.985,17z/...

# Query URL
maps.google.com?q=Empire+State+Building&ll=40.748,-73.985
```

Parsing extracts place name only (coordinates ignored).

### Codebase Considerations
- Security headers disable geolocation: `Permissions-Policy: geolocation=()`
- CSP only allows Firebase domains (no external API needed for this approach)
- No existing external API patterns beyond Firebase
