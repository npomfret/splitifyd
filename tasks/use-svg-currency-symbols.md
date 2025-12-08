# Use SVG Currency Symbols Instead of ASCII Characters

**Status**: Complete

## Description

Updated all currency symbol rendering to use the `CurrencyIcon` component consistently throughout the app.

## Approach

After evaluating options:
- **Custom vector paths** - Created ~100 hand-drawn SVG paths, but quality was poor
- **Open source libraries** - [ccy-icons](https://github.com/dominictobias/ccy-icons) only has 11 fiat currencies (USD, EUR, GBP, JPY, CNY, INR, RUB, IDR, SAR, TRY, DKK)
- **Text-based rendering** - Chosen for consistency across all ~100+ currencies

## Changes Made

### 1. Added `formatCurrencyParts()` function
**File**: `webapp-v2/src/utils/currency/currencyFormatter.ts`

New function that returns currency formatting parts separately:
- `sign` - minus sign if negative
- `symbol` - currency symbol (e.g., "$", "€", "£")
- `formattedNumber` - the formatted numeric value
- `currencyCode` - the ISO currency code

### 2. Updated `CurrencyIcon` component
**File**: `webapp-v2/src/components/ui/icons/CurrencyIcon.tsx`

Text-based rendering with:
- Dynamic font sizing based on symbol length (1 char = 24px, 2 = 20px, 3 = 16px, 4+ = 12px at 24px icon size)
- Special handling for wide/complex symbols (Arabic scripts, etc.)
- `font-weight: 600` for better readability
- Fixed-width container for alignment
- Inherits color from parent via CSS

### 3. Updated `CurrencyAmount` component
**File**: `webapp-v2/src/components/ui/CurrencyAmount.tsx`

- Now uses `CurrencyIcon` to render the currency symbol
- Added optional `iconSize` prop (default: 16px)
- Uses `inline-flex items-center` for proper alignment
- Handles currencies where symbol matches code (e.g., CHF) by showing empty spacer for vertical alignment

### 4. Fixed RTL currency symbol rendering in tooltips
**File**: `webapp-v2/src/utils/currency/currencyFormatter.ts`

- Added LRM (Left-to-Right Mark) Unicode characters around RTL symbols (e.g., Arabic "د.إ" for AED)
- Prevents browser's Unicode bidirectional algorithm from repositioning RTL text in tooltips
- Fixes issue where "د.إ 100.00 AED" was rendering as "100.00 د.إ AED"

### 5. Centralized all currency symbol display

Updated all components that display currency symbols:

| Component | Change |
|-----------|--------|
| `CurrencyAmountInput.tsx` | Uses CurrencyIcon in selector button and dropdown |
| `GroupCurrencySettings.tsx` | Currency chips and dropdown use CurrencyIcon |
| `CreateGroupModal.tsx` | Currency chips and dropdown use CurrencyIcon |

### 6. Removed old assets
**Deleted**: `webapp-v2/src/assets/currency-icons/` directory (~100 text-based SVG files)

## Result

All currency symbols throughout the app now display consistently via `CurrencyIcon`:
- Dashboard (GroupCard balances)
- Balance Summary (debt amounts)
- Expense lists and details
- Settlement history and form
- Currency selectors and settings
- Quick settle buttons
