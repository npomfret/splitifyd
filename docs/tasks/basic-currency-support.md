# Task: Basic Multi-Currency Support

## Description

To better support users who travel or live in different countries, the application needs to handle expenses in multiple currencies. This task covers the initial implementation of multi-currency support, focusing on tracking and balancing expenses on a per-currency basis without automatic conversion.

## Implementation Plan

### Overview
Implementing multi-currency support with **per-currency separation** of balances and debts, smart currency defaults, and client-side data formatting layers. No automatic currency conversion.

### Key Requirements Analysis
- **Currency separation is crucial**: USD and GBP balances must be kept completely separate
- Current system stores amounts as numbers without currency info
- Need client-side data enrichment layer for formatting
- Must support 167 currencies from 1Forge API
- Balance calculations and debt simplification per currency
- **Backward compatibility**: Default existing expenses to USD

## Phase 1: Core Data Model Changes

### 1.1 Backend Schema Updates
- **Add `currency` field to ExpenseData interface** (firebase/functions/src/types/webapp-shared-types.ts)
  - Default value: 'USD' for backward compatibility
  - Required field for new expenses
- **Add `currency` to CreateExpenseRequest/UpdateExpenseRequest**
- **Update API schemas** (webapp-v2/src/api/apiSchemas.ts) with currency validation
- **Modify balance calculation** to be currency-aware:
  - UserBalance: Keep current structure but group calculations by currency
  - SimplifiedDebt gets `currency` field
  - Balance calculator groups by currency before calculations
  - Per-currency debt simplification

### 1.2 Database Migration Strategy
- **No schema migration needed** - new field will be added to new expenses
- **API handler updates** to default to 'USD' if currency not provided
- **Settlements already have currency field** - leverage existing pattern

## Phase 2: Client-Side Data Formatting Layer

### 2.1 Currency Utilities
Create `webapp-v2/src/utils/currency/`:
- **`currencyList.ts`**: Complete list of 167 supported currencies
- **`currencyFormatter.ts`**: Format amounts with proper symbols/decimals
- **`currencyParser.ts`**: Parse user input to standardized numbers
- **`currencyDefaults.ts`**: Smart defaults logic

### 2.2 Currency Service
Create `webapp-v2/src/app/services/currencyService.ts`:
- **Smart defaults logic**:
  1. Last used by user in current group (localStorage)
  2. Last used by anyone in group (from API)
  3. Browser locale detection (navigator.language)
  4. USD fallback
- **Currency metadata caching**
- **Validation helpers**

## Phase 3: UI Components Update

### 3.1 Expense Form Enhancement
- **Add currency selector** to AddExpensePage (dropdown with search)
- **Smart default** pre-selection using currency service
- **Update expense-form-store** to handle currency field
- **Real-time formatting** as user types amounts
- **Persistent currency selection** per group

### 3.2 Balance Display Updates
- **Multi-currency balance cards** showing separate lines per currency
- **BalanceSummary component**: group debts by currency with clear separation
- **ExpenseItem component**: show currency symbol with amounts
- **GroupCard component**: handle multi-currency balance display
- **Per-currency simplified debts** in UI

### 3.3 New Components
- **CurrencySelector**: Reusable dropdown with search and recent currencies
- **CurrencyAmount**: Display component with proper formatting
- **MultiCurrencyBalance**: Component to show balances grouped by currency

## Phase 4: Backend Logic Updates

### 4.1 Balance Calculator Refactor
- **Group expenses by currency** before calculation
- **Calculate balances per currency separately**
- **Independent debt simplification** per currency
- **Update balanceCalculator.ts** to handle currency grouping
- **New response structure**: `GroupBalances` with per-currency breakdown

### 4.2 API Endpoint Updates
- **Validate currency codes** in expense creation/updates
- **Default to USD** if currency not provided (backward compatibility)
- **Group balances response** includes per-currency breakdowns
- **Settlement validation** ensures currency matching where applicable

### 4.3 Database Updates
- **Add currency field** to expense documents (default 'USD')
- **Update Firestore queries** to handle currency filtering if needed
- **Index on currency** for potential future queries

## Phase 5: Comprehensive Testing

### 5.1 Unit Tests
- **Currency formatting edge cases** (zero decimals, negative amounts)
- **Balance calculation accuracy** per currency
- **Smart default selection logic** 
- **Data parsing/formatting roundtrips**
- **Currency validation functions**

### 5.2 Integration Tests  
- **Multi-currency expense creation**
- **Balance calculation with mixed currencies**
- **Settlement creation with currency validation**
- **Default currency persistence and retrieval**
- **API backward compatibility** (expenses without currency field)

### 5.3 E2E Tests (Following Strict Guidelines)
Create `e2e-tests/src/tests/normal-flow/multi-currency-basic.e2e.test.ts`:

**Test Scenarios:**
1. **Single currency group workflow** (USD only - baseline)
2. **Multi-currency expense creation** (USD expense, then EUR expense)
3. **Balance verification per currency** (separate USD and EUR balances)
4. **Settlement in specific currency** (settle USD balance, EUR remains)
5. **Currency default behavior** (remembers last used currency)

**E2E Test Requirements:**
- **1-second action timeout** - fast, reliable selectors only
- **10-second test timeout** - complete quickly or fail
- **Parallel execution safe** - unique test data per test
- **Use authenticatedPageTest fixture**
- **Verify state before every action** (`await expect(page).toHaveURL(...)`)
- **No conditional logic** in tests (no if/else, try/catch)
- **Semantic selectors** preferred (getByRole, getByLabel)
- **Clean test data** - create fresh groups/expenses per test

**Sample E2E Test Structure:**
```typescript
authenticatedPageTest('should handle multi-currency expenses separately', async ({
  authenticatedPage,
  dashboardPage,
  createGroupModalPage
}) => {
  const { page, user } = authenticatedPage;
  
  // Verify starting state
  await expect(page).toHaveURL(/\/dashboard/);
  
  // Create fresh group for test
  const groupId = await dashboardPage.createGroupAndNavigate('Multi Currency Test');
  await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
  
  // Create USD expense
  await page.getByRole('button', { name: 'Add Expense' }).click();
  await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
  
  // Fill USD expense (currency selector should default to USD)
  await page.getByLabel('Description').fill('Lunch');
  await page.getByLabel('Amount').fill('25.00');
  // Currency should default to USD - verify default
  await expect(page.getByLabel('Currency')).toHaveValue('USD');
  await page.getByRole('button', { name: 'Save Expense' }).click();
  
  // Verify back on group page with USD expense
  await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
  await expect(page.getByText('$25.00')).toBeVisible();
  
  // Create EUR expense  
  await page.getByRole('button', { name: 'Add Expense' }).click();
  await page.getByLabel('Description').fill('Dinner');
  await page.getByLabel('Amount').fill('30.00');
  // Change currency to EUR
  await page.getByLabel('Currency').selectOption('EUR');
  await page.getByRole('button', { name: 'Save Expense' }).click();
  
  // Verify both expenses with separate currencies
  await expect(page.getByText('$25.00')).toBeVisible();
  await expect(page.getByText('€30.00')).toBeVisible();
  
  // Verify balances are separate per currency
  await expect(page.getByText(/USD.*\$12\.50/)).toBeVisible(); // Half of $25
  await expect(page.getByText(/EUR.*€15\.00/)).toBeVisible(); // Half of €30
});
```

## Phase 6: Performance & Polish

### 6.1 Client Optimization
- **Memoize currency formatting** functions with React.useMemo
- **Cache currency metadata** in localStorage with expiry
- **Lazy load currency lists** - only load when dropdown opened
- **Debounce currency selection** to avoid excessive API calls

### 6.2 UX Improvements
- **Currency symbol display** consistency across all components
- **Loading states** for currency operations
- **Error handling** for invalid currencies with clear messages
- **Accessibility**: Proper labels and keyboard navigation for currency selector
- **Visual separation** of different currencies in balance displays

### 6.3 Migration Support
- **Graceful degradation** for old expenses without currency
- **Migration notification** for users (optional)
- **Analytics** to track currency usage patterns

## Requirements

### 1. Expense Creation

-   When creating or editing an expense, the user must be able to select a currency for the amount.
-   The application will support the following currencies, which are provided by the 1Forge API:
    -   AED - United Arab Emirates dirham
    -   AFN - Afghan afghani
    -   ALL - Albanian lek
    -   AMD - Armenian dram
    -   ANG - Netherlands Antillean guilder
    -   AOA - Angolan kwanza
    -   ARS - Argentine peso
    -   AUD - Australian dollar
    -   AWG - Aruban florin
    -   BAM - Bosnia and Herzegovina convertible mark
    -   BBD - Barbados dollar
    -   BDT - Bangladeshi taka
    -   BGN - Bulgarian lev
    -   BHD - Bahraini dinar
    -   BIF - Burundian franc
    -   BMD - Bermudian dollar
    -   BND - Brunei dollar
    -   BOB - Boliviano
    -   BRL - Brazilian real
    -   BSD - Bahamian dollar
    -   BTN - Bhutanese ngultrum
    -   BWP - Botswana pula
    -   BYN - Belarusian ruble
    -   BZD - Belize dollar
    -   CAD - Canadian dollar
    -   CDF - Congolese franc
    -   CHF - Swiss franc
    -   CLP - Chilean peso
    -   CNY - Chinese yuan
    -   COP - Colombian peso
    -   CRC - Costa Rican colon
    -   CUP - Cuban peso
    -   CVE - Cape Verde escudo
    -   CZK - Czech koruna
    -   DJF - Djiboutian franc
    -   DKK - Danish krone
    -   DOP - Dominican peso
    -   DZD - Algerian dinar
    -   EGP - Egyptian pound
    -   ETB - Ethiopian birr
    -   EUR - Euro
    -   FJD - Fiji dollar
    -   GBP - Pound sterling
    -   GEL - Georgian lari
    -   GHS - Ghanaian cedi
    -   GMD - Gambian dalasi
    -   GNF - Guinean franc
    -   GTQ - Guatemalan quetzal
    -   GYD - Guyanese dollar
    -   HKD - Hong Kong dollar
    -   HNL - Honduran lempira
    -   HRK - Croatian kuna
    -   HTG - Haitian gourde
    -   HUF - Hungarian forint
    -   IDR - Indonesian rupiah
    -   ILS - Israeli new shekel
    -   INR - Indian rupee
    -   IQD - Iraqi dinar
    -   IRR - Iranian rial
    -   ISK - Icelandic króna
    -   JMD - Jamaican dollar
    -   JOD - Jordanian dinar
    -   JPY - Japanese yen
    -   KES - Kenyan shilling
    -   KHR - Cambodian riel
    -   KMF - Comoro franc
    -   KRW - South Korean won
    -   KWD - Kuwaiti dinar
    -   KYD - Cayman Islands dollar
    -   KZT - Kazakhstani tenge
    -   LAK - Lao kip
    -   LBP - Lebanese pound
    -   LKR - Sri Lankan rupee
    -   LRD - Liberian dollar
    -   LSL - Lesotho loti
    -   LYD - Libyan dinar
    -   MAD - Moroccan dirham
    -   MDL - Moldovan leu
    -   MGA - Malagasy ariary
    -   MKD - Macedonian denar
    -   MMK - Myanma kyat
    -   MOP - Macanese pataca
    -   MRU - Mauritanian Ouguiya
    -   MUR - Mauritian rupee
    -   MVR - Maldivian rufiyaa
    -   MWK - Malawian kwacha
    -   MXN - Mexican peso
    -   MYR - Malaysian ringgit
    -   MZN - Mozambican metical
    -   NAD - Namibian dollar
    -   NGN - Nigerian naira
    -   NIO - Nicaraguan córdoba
    -   NOK - Norwegian krone
    -   NPR - Nepalese rupee
    -   NZD - New Zealand dollar
    -   OMR - Omani rial
    -   PAB - Panamanian balboa
    -   PEN - Peruvian nuevo sol
    -   PGK - Papua New Guinean kina
    -   PHP - Philippine peso
    -   PKR - Pakistani rupee
    -   PLN - Polish złoty
    -   PYG - Paraguayan guaraní
    -   QAR - Qatari riyal
    -   RON - Romanian new leu
    -   RSD - Serbian dinar
    -   RUB - Russian rouble
    -   RWF - Rwandan franc
    -   SAR - Saudi riyal
    -   SBD - Solomon Islands dollar
    -   SCR - Seychelles rupee
    -   SDG - Sudanese pound
    -   SEK - Swedish krona
    -   SGD - Singapore dollar
    -   SHP - Saint Helena pound
    -   SLL - Sierra Leonean leone
    -   SOS - Somali shilling
    -   SRD - Surinamese dollar
    -   STN - Sao Tomean Dobra
    -   SVC - Salvadoran colón
    -   SZL - Swazi lilangeni
    -   THB - Thai baht
    -   TJS - Tajikistani somoni
    -   TMT - Turkmenistani manat
    -   TND - Tunisian dinar
    -   TOP - Tongan paʻanga
    -   TRY - Turkish lira
    -   TTD - Trinidad and Tobago dollar
    -   TWD - New Taiwan dollar
    -   TZS - Tanzanian shilling
    -   UAH - Ukrainian hryvnia
    -   UGX - Ugandan shilling
    -   USD - United States dollar
    -   UYU - Uruguayan peso
    -   UZS - Uzbekistan som
    -   VES - Venezuelan Bolivar Soberano
    -   VND - Vietnamese dong
    -   XCD - East Caribbean dollar
    -   XOF - CFA Franc BCEAO
    -   XPF - CFP franc
    -   YER - Yemeni rial
    -   ZAR - South African Rand
    -   ZMW - Zambian kwacha

### 2. Default Currency Logic

To make creating expenses faster, the currency field should have a smart default based on the following priority:

1.  **Last Used by User:** Default to the currency that the current user last used for an expense *within the current group*.
2.  **Last Used in Group:** If the current user has not created an expense in this group before, default to the currency that was last used by *any* member in the group.
3.  **Locale-Based Guess:** If it's the very first expense in a group, attempt to guess the user's local currency based on their browser's locale settings (e.g., `navigator.language`). USD should be the ultimate fallback.

### 3. Balance and Debt Calculation

-   All financial calculations must be currency-aware.
-   **No Automatic Conversion:** The application will not perform any foreign exchange (FX) conversions. All balances and debts will be maintained in their original currency.
-   **Per-Currency Balances:** The group balance summary and user balances on the dashboard must be displayed on a per-currency basis. For example, a user's balance might show "Owes $50 USD and is owed €20 EUR".
-   **Per-Currency Debt Simplification:** The "simplify debts" algorithm must operate independently for each currency. A user might owe another user in one currency and be owed by the same user in a different currency.

### 4. UI/UX Considerations

-   Clearly display the currency symbol or code next to all amounts throughout the application (expense lists, detail views, balance summaries).
-   The UI should be able to handle displaying multiple balance lines if a user has debts in more than one currency.
-   **Currency Formatting Rules:** The application must handle currency-specific formatting rules, such as the number of decimal places (e.g., 2 for USD, 0 for JPY), symbol placement, and decimal/thousands separators. A comprehensive JSON configuration file named `currency-formatting.json` must be created in `webapp-v2/src/utils/currency/`. This file will store the formatting rules for all supported currencies and will be used by the client-side formatting layer.

## Implementation Strategy

### Phase Order & Dependencies
1. **Phase 1**: Data model changes (backend types, API validation)
2. **Phase 2**: Client utilities and services (formatting, defaults)
3. **Phase 3**: UI updates (forms, displays, components) 
4. **Phase 4**: Backend logic (balance calculator, API handlers)
5. **Phase 5**: Testing (unit, integration, E2E)
6. **Phase 6**: Polish and optimization

### Parallel Work Possible
- Phase 2 can start while Phase 1 is being completed
- UI mockups and component design (Phase 3) can happen alongside Phase 1-2
- Test planning can happen early, implementation after Phase 3-4

## Risk Mitigation

### Technical Risks
- **Backward compatibility**: Thorough testing of existing data
- **Data integrity**: Strict validation at API boundaries
- **Performance impact**: Client-side formatting only, minimal server changes
- **Testing complexity**: Comprehensive E2E suite following strict guidelines

### User Experience Risks  
- **Confusion with multiple currencies**: Clear visual separation
- **Accidental currency selection**: Smart defaults and confirmation for large amounts
- **Loss of data context**: Preserve existing balances during migration

## Success Criteria

✅ **USD and GBP balances completely separate** (primary requirement)
✅ **167 currencies supported** with proper formatting
✅ **Smart currency defaults** working reliably  
✅ **Client-side formatting layer** handles all display cases
✅ **E2E tests passing** with 1s timeouts and parallel execution
✅ **No automatic conversion** implemented
✅ **All existing functionality preserved** 
✅ **Backward compatibility** maintained for existing expenses
✅ **Performance impact minimal** (< 100ms additional load time)

## Future Enhancements (Separate Tasks)

### Advanced Multi-Currency Features  
`docs/tasks/advanced-currency-features.md`:
- Real-time exchange rates integration
- Currency conversion between balances  
- Multi-currency reporting and insights
- Historical rate tracking and charts

### Enhanced Localization
`docs/tasks/enhanced-localization.md`:
- Full i18n implementation with translations
- Regional date/time formatting preferences  
- Number formatting by locale
- Regional currency defaults by country
