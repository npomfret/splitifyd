# Add Optional "Location" Field to Expenses

## Problem Description
Currently, expenses only track basic details like amount, description, and date. There is a need to allow users to optionally specify a location for an expense, which could be useful for tracking where spending occurred (e.g., "Starbucks", "Gas Station", "Paris").

## Chosen Approach

**Hybrid Google Maps Link + Recent Locations Autocomplete**

After researching various options (simple text, Places API, interactive map picker), we chose a hybrid approach that provides good UX with zero API costs:

- Text input with autocomplete from recent locations (localStorage)
- "Find on Map" button opens Google Maps in a new tab
- User can paste a Google Maps URL → app parses and extracts place name + coordinates
- Structured data storage for future-proofing

### User Flow
1. User types location manually (e.g., "Starbucks") → works like simple text
2. OR clicks map icon → opens Google Maps in new tab
3. User searches/navigates in Google Maps
4. User copies the URL from browser
5. User pastes URL into location field
6. App parses URL, extracts place name, displays it cleanly

### Data Structure
```typescript
export interface ExpenseLocation {
    name: string;                    // "Starbucks", "Paris", etc.
    coordinates?: {
        lat: number;
        lng: number;
    };
    googleMapsUrl?: string;          // Original URL for "View on Map" link
}

// Added to ExpenseDTO and CreateExpenseRequest:
location?: ExpenseLocation;
```

## Implementation Plan

### Backend

1. **Shared Types** (`packages/shared/src/shared-types.ts`)
   - Add `ExpenseLocation` interface
   - Add `location?: ExpenseLocation` to `ExpenseDTO` and `CreateExpenseRequest`

2. **Firestore Schema** (`firebase/functions/src/schemas/expense.ts`)
   - Add `ExpenseLocationSchema` with Zod validation

3. **API Validation** (`firebase/functions/src/expenses/validation.ts`)
   - Add location to request validation schema

4. **API Schemas** (`packages/shared/src/schemas/apiSchemas.ts`)
   - Add location to expense response schema validation

### Frontend

5. **Location Input Component** (NEW: `webapp-v2/src/components/expense-form/LocationInput.tsx`)
   - Text input showing location name
   - Autocomplete dropdown with recent locations
   - Map icon button → opens Google Maps
   - Paste handler that detects Google Maps URLs
   - Parse URL → extract name + coordinates
   - Clear button

6. **Google Maps URL Parser** (NEW: `webapp-v2/src/app/utils/google-maps-parser.ts`)
   - `parseGoogleMapsUrl(input)` - extracts place name and coordinates from URLs
   - `isGoogleMapsUrl(input)` - checks if string is a Google Maps URL

7. **Recent Locations Storage** (NEW: `webapp-v2/src/app/utils/recent-locations.ts`)
   - `getRecentLocations()` - retrieve from localStorage
   - `addRecentLocation(location)` - store to localStorage (max 10)

8. **Form Store** (`webapp-v2/src/app/stores/expense-form-store.ts`)
   - Add `#locationSignal = signal<ExpenseLocation | null>(null)`
   - Add `#recentLocationsSignal` for autocomplete
   - Add `updateLocation()` method

9. **Basic Fields Integration** (`webapp-v2/src/components/expense-form/ExpenseBasicFields.tsx`)
   - Add `LocationInput` component after description field

10. **Translations** (`webapp-v2/locales/*/translation.json`)
    - Add `expenseBasicFields.locationLabel`, `locationPlaceholder`, `findOnMap`, `recentLocations`, `clearLocation`

### Tests

11. **Unit tests** for Google Maps URL parser
12. **API tests** for location field CRUD
13. **Playwright tests** for location input component

## Files to Modify/Create

| File | Action |
|------|--------|
| `packages/shared/src/shared-types.ts` | Add `ExpenseLocation` type, update DTOs |
| `firebase/functions/src/schemas/expense.ts` | Add location schema |
| `firebase/functions/src/expenses/validation.ts` | Add to request validation |
| `packages/shared/src/schemas/apiSchemas.ts` | Add to response schema |
| `webapp-v2/src/components/expense-form/LocationInput.tsx` | **CREATE** |
| `webapp-v2/src/components/expense-form/ExpenseBasicFields.tsx` | Add LocationInput |
| `webapp-v2/src/app/stores/expense-form-store.ts` | Add location state |
| `webapp-v2/src/app/hooks/useFormState.ts` | Expose location |
| `webapp-v2/src/app/utils/google-maps-parser.ts` | **CREATE** |
| `webapp-v2/src/app/utils/recent-locations.ts` | **CREATE** |
| `webapp-v2/locales/en/translation.json` | Add translations |

## Research Notes

### Options Considered

| Option | Effort | Cost | Decision |
|--------|--------|------|----------|
| Simple text input | Low | Free | Too basic |
| Text + recent locations | Medium | Free | Part of chosen approach |
| Google Places API | High | ~$3/1k requests | Overkill for this use case |
| Mapbox Search API | High | Free tier 100k/mo | Overkill |
| Interactive map picker | Very High | Map tiles + API | Overkill |
| **Hybrid (chosen)** | Medium | Free | Best balance |

### Google Maps URL Formats
```
# Standard place URL
/maps/place/Starbucks/@40.748,-73.985,17z/...

# Query URL
maps.google.com?q=Empire+State+Building&ll=40.748,-73.985
```

Parsing extracts:
- Place name from `/place/NAME/` path
- Coordinates from `@lat,lng` portion

### Codebase Considerations
- Security headers disable geolocation: `Permissions-Policy: geolocation=()`
- CSP only allows Firebase domains (no external API needed for this approach)
- No existing external API patterns beyond Firebase
