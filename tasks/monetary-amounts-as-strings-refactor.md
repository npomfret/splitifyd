?# Monetary Amounts as Strings - Comprehensive Refactor Plan

**Goal**: Change all monetary amounts transmitted over the API from `number` to `string` to eliminate JavaScript floating-point precision bugs.

**Scope**: Complete brutal refactor - NO backward compatibility, NO migration scripts, NO half-measures.

**Rationale**: JavaScript's IEEE 754 floating-point arithmetic causes precision loss (e.g., `0.1 + 0.2 !== 0.3`). For financial calculations, this is unacceptable. Using strings ensures exact decimal representation across the wire, with conversion to numbers only when needed for calculation.

---

## Architecture Overview

### Current Flow (Numbers)
```
Client Form (number)
  → API Request (number)
  → Joi Validation (number)
  → Service Logic (number)
  → Firestore (number)
  → API Response (number)
  → Client Display (number)
```

### Target Flow (Strings over API)
```
Client Form (string input)
  → API Request (string)
  → Joi Validation (string → parse → validate → back to string)
  → Service Logic (parse string → number for calculation)
  → Firestore (number - internal storage unchanged)
  → API Response (number → string)
  → Client Parse (string → number for display/calculation)
```

---

## Phase 1: Shared Types (`packages/shared/src/shared-types.ts`)

### Changes Required

**1. Update all amount fields from `number` to `string`:**

```typescript
// BEFORE
export interface ExpenseSplit {
    uid: string;
    amount: number;          // ❌ number
    percentage?: number;
}

// AFTER
export interface ExpenseSplit {
    uid: string;
    amount: string;          // ✅ string
    percentage?: number;     // Keep as number - percentages don't have precision issues
}
```

**Files/Types to Change:**

| Type | Field | Current | New |
|------|-------|---------|-----|
| `ExpenseSplit` | `amount` | `number` | `string` |
| `Expense` (interface) | `amount` | `number` | `string` |
| `ExpenseDTO` | `amount` | `number` | `string` |
| `CreateExpenseRequest` | `amount` | `number` | `string` |
| `UpdateExpenseRequest` | `amount` | `number` | `string` |
| `Settlement` (interface) | `amount` | `number` | `string` |
| `SettlementDTO` | `amount` | `number` | `string` |
| `CreateSettlementRequest` | `amount` | `number` | `string` |
| `UpdateSettlementRequest` | `amount` | `number` | `string` |
| `SettlementWithMembers` | `amount` | `number` | `string` |
| `SimplifiedDebt` | `amount` | `number` | `string` |
| `UserBalance` | `owes` values | `number` | `string` |
| `UserBalance` | `owedBy` values | `number` | `string` |
| `UserBalance` | `netBalance` | `number` | `string` |
| `CurrencyBalance` | `netBalance` | `number` | `string` |
| `CurrencyBalance` | `totalOwed` | `number` | `string` |
| `CurrencyBalance` | `totalOwing` | `number` | `string` |

**Important Notes:**
- Keep `percentage` fields as `number` (no precision issues with percentages 0-100)
- All API request/response types MUST use strings
- Internal calculation utilities can convert string → number → string

---

## Phase 2: Shared Utilities (`packages/shared/src/split-utils.ts`)

### Changes Required

**1. Add string parsing/formatting utilities:**

```typescript
/**
 * Parse a monetary amount string to a number for calculation
 * @throws Error if string is not a valid decimal number
 */
export function parseMonetaryAmount(amountStr: string): number {
    if (typeof amountStr !== 'string') {
        throw new Error('Amount must be a string');
    }

    const trimmed = amountStr.trim();
    if (trimmed === '') {
        throw new Error('Amount cannot be empty');
    }

    // Validate format: optional minus, digits, optional decimal point, optional digits
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
        throw new Error(`Invalid monetary amount format: "${amountStr}"`);
    }

    const num = Number(trimmed);
    if (!isFinite(num)) {
        throw new Error(`Amount is not finite: "${amountStr}"`);
    }

    return num;
}

/**
 * Format a number to a string for API transmission
 * Uses fixed decimal places based on currency
 */
export function formatMonetaryAmount(amount: number, currencyCode: string): string {
    const decimals = getCurrencyDecimals(currencyCode);
    return amount.toFixed(decimals);
}
```

**2. Update calculation functions to accept/return strings:**

```typescript
// BEFORE
export function calculateEqualSplits(
    totalAmount: number,
    currencyCode: string,
    participantIds: string[]
): ExpenseSplit[]

// AFTER - Accept string, return string amounts
export function calculateEqualSplits(
    totalAmount: string,           // ✅ Accept string
    currencyCode: string,
    participantIds: string[]
): ExpenseSplit[] {                // ✅ Return splits with string amounts
    const totalNum = parseMonetaryAmount(totalAmount);
    // ... existing calculation logic ...

    return splits.map(split => ({
        uid: split.uid,
        amount: formatMonetaryAmount(split.amount, currencyCode)  // ✅ Convert to string
    }));
}
```

**All functions to update:**
- `calculateEqualSplits()` - Input/output strings
- `calculateExactSplits()` - Input/output strings
- `calculatePercentageSplits()` - Input/output strings
- `roundToCurrencyPrecision()` - Keep as-is (internal utility)

---

## Phase 3: Backend Validation (`firebase/functions/src`)

### 3.1 Joi Schemas (`expenses/validation.ts`, `settlements/validation.ts`)

**Strategy**: Joi validates string format, converts to number for business logic validation, but keeps as string in the validated output.

```typescript
// BEFORE
const expenseSplitSchema = Joi.object({
    uid: Joi.string().required(),
    amount: Joi.number().positive().required(),  // ❌ number
    percentage: Joi.number().min(0).max(100).optional(),
});

// AFTER
const expenseSplitSchema = Joi.object({
    uid: Joi.string().required(),
    amount: Joi.string()
        .required()
        .pattern(/^-?\d+(\.\d+)?$/, 'decimal number')
        .custom((value, helpers) => {
            const num = parseFloat(value);
            if (isNaN(num) || !isFinite(num)) {
                return helpers.error('number.invalid');
            }
            if (num <= 0) {
                return helpers.error('number.positive');
            }
            return value;  // ✅ Return string, not number
        })
        .messages({
            'string.pattern.name': 'Amount must be a valid decimal number',
            'number.invalid': 'Amount must be a valid number',
            'number.positive': 'Amount must be greater than zero',
        }),
    percentage: Joi.number().min(0).max(100).optional(),
});
```

**Files to Update:**
- `expenses/validation.ts`:
  - `expenseSplitSchema` - amount field
  - `createExpenseSchema` - amount field
  - `updateExpenseSchema` - amount field
  - `validateCreateExpense()` - parse strings for `validateAmountPrecision()`
  - `validateUpdateExpense()` - parse strings for validation

- `settlements/validation.ts`:
  - `createSettlementSchema` - amount field
  - `updateSettlementSchema` - amount field
  - Update `createJoiAmountSchema()` helper to work with strings

**Key Pattern:**
```typescript
// Validation step: string → number → validate → string
const validatedAmount = Joi.string()
    .custom((value, helpers) => {
        const num = parseFloat(value);
        // validate num...
        return value;  // ✅ Keep as string
    });
```

### 3.2 Amount Validation Utilities (`utils/amount-validation.ts`)

**Update function signatures to accept strings:**

```typescript
// BEFORE
export function validateAmountPrecision(amount: number, currencyCode: string): void

// AFTER
export function validateAmountPrecision(amountStr: string, currencyCode: string): void {
    const amount = parseMonetaryAmount(amountStr);  // Parse first
    // ... existing validation logic ...
}
```

**Functions to Update:**
- `validateAmountPrecision()` - Accept string, parse internally
- `getCurrencyTolerance()` - Keep as-is (returns number)
- `getMaxDecimalPlaces()` - Keep as-is (returns number)

---

## Phase 4: Backend Services (`firebase/functions/src/services`)

### 4.1 Split Strategies

**Current State**: Strategies validate splits with numeric amounts.

**Change**: Strategies must parse string amounts for validation.

```typescript
// EqualSplitStrategy.ts, ExactSplitStrategy.ts, PercentageSplitStrategy.ts

// BEFORE
validateSplits(totalAmount: number, participants: string[], splits?: ExpenseSplit[], currencyCode?: string): void {
    const totalSplit = splits.reduce((sum, split) => sum + split.amount!, 0);
    // ...
}

// AFTER
validateSplits(totalAmount: string, participants: string[], splits?: ExpenseSplit[], currencyCode?: string): void {
    const totalNum = parseMonetaryAmount(totalAmount);
    const totalSplit = splits.reduce((sum, split) => {
        return sum + parseMonetaryAmount(split.amount);
    }, 0);
    // ... rest of validation with numbers ...
}
```

**Files to Update:**
- `services/splits/ISplitStrategy.ts` - Update interface signature
- `services/splits/EqualSplitStrategy.ts` - Parse strings in `validateSplits()`
- `services/splits/ExactSplitStrategy.ts` - Parse strings in `validateSplits()`
- `services/splits/PercentageSplitStrategy.ts` - Parse strings in `validateSplits()`

### 4.2 ExpenseService & SettlementService

**Key Insight**: Services receive validated data with string amounts. They parse for calculations but store/return strings.

```typescript
// ExpenseService.ts

// BEFORE
async createExpense(expenseData: Omit<ExpenseDTO, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Promise<ExpenseDTO> {
    const amount = expenseData.amount;  // number
    // ... calculations with amount ...
}

// AFTER
async createExpense(expenseData: Omit<ExpenseDTO, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Promise<ExpenseDTO> {
    const amountNum = parseMonetaryAmount(expenseData.amount);  // Parse string
    // ... calculations with amountNum ...
    // Store as number in Firestore (internal storage unchanged)
    // Return DTO with string amounts (converted by FirestoreReader)
}
```

**Files to Update:**
- `services/ExpenseService.ts` - Parse amounts in create/update methods
- `services/SettlementService.ts` - Parse amounts in create/update methods
- `services/balance/IncrementalBalanceService.ts` - Parse amounts for balance calculations
- `services/balance/ExpenseProcessor.ts` - Parse amounts when processing expenses
- `services/balance/SettlementProcessor.ts` - Parse amounts when processing settlements
- `services/balance/BalanceCalculationService.ts` - Parse amounts in calculations

**Important**: Firestore storage remains UNCHANGED (stores numbers). Only API boundary uses strings.

### 4.3 FirestoreReader & FirestoreWriter

**Current State**: Reader converts Firestore documents to DTOs. Writer converts DTOs to Firestore documents.

**Change**: Reader must format numeric amounts to strings. Writer must parse string amounts to numbers.

```typescript
// FirestoreReader.ts - Add amount conversion to convertTimestampsToISO()

private convertTimestampsToISO(obj: any): any {
    // ... existing timestamp conversion ...

    // NEW: Convert numeric amounts to strings
    if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
            if (key === 'amount' && typeof obj[key] === 'number') {
                // Determine currency from context (expense/settlement has currency field)
                const currency = obj.currency || 'USD';  // Fallback
                obj[key] = formatMonetaryAmount(obj[key], currency);
            } else if (key === 'owes' || key === 'owedBy') {
                // UserBalance object - convert all values to strings
                for (const uid in obj[key]) {
                    obj[key][uid] = obj[key][uid].toFixed(2);  // 2 decimals for balances
                }
            } else if (key === 'netBalance' || key === 'totalOwed' || key === 'totalOwing') {
                obj[key] = obj[key].toFixed(2);
            } else if (key === 'splits' && Array.isArray(obj[key])) {
                // ExpenseSplit array
                const currency = obj.currency || 'USD';
                obj[key].forEach((split: any) => {
                    if (typeof split.amount === 'number') {
                        split.amount = formatMonetaryAmount(split.amount, currency);
                    }
                });
            }
            // Recurse for nested objects/arrays
            else if (typeof obj[key] === 'object') {
                obj[key] = this.convertTimestampsToISO(obj[key]);
            }
        }
    }

    return obj;
}
```

```typescript
// FirestoreWriter.ts - Add amount parsing to convertISOToTimestamps()

private convertISOToTimestamps(obj: any): any {
    // ... existing timestamp conversion ...

    // NEW: Convert string amounts to numbers
    if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
            if (key === 'amount' && typeof obj[key] === 'string') {
                obj[key] = parseMonetaryAmount(obj[key]);
            } else if (key === 'splits' && Array.isArray(obj[key])) {
                obj[key].forEach((split: any) => {
                    if (typeof split.amount === 'string') {
                        split.amount = parseMonetaryAmount(split.amount);
                    }
                });
            } else if (key === 'owes' || key === 'owedBy') {
                // UserBalance strings → numbers
                for (const uid in obj[key]) {
                    if (typeof obj[key][uid] === 'string') {
                        obj[key][uid] = parseFloat(obj[key][uid]);
                    }
                }
            } else if ((key === 'netBalance' || key === 'totalOwed' || key === 'totalOwing') && typeof obj[key] === 'string') {
                obj[key] = parseFloat(obj[key]);
            }
            // Recurse
            else if (typeof obj[key] === 'object') {
                obj[key] = this.convertISOToTimestamps(obj[key]);
            }
        }
    }

    return obj;
}
```

**Critical Decision**:
- **Firestore storage format**: UNCHANGED (still stores `number`)
- **API wire format**: CHANGED (now uses `string`)
- **Conversion point**: FirestoreReader (number → string) and FirestoreWriter (string → number)

---

## Phase 5: Backend Zod Schemas (`firebase/functions/src/schemas`)

### Changes Required

**Update all schemas to expect/validate strings for amounts:**

```typescript
// schemas/expense.ts

// BEFORE
const ExpenseSplitSchema = z.object({
    uid: UserIdSchema,
    amount: z.number().positive('Split amount must be positive'),
    percentage: z.number().min(0).max(100).optional(),
});

const BaseExpenseSchema = z.object({
    // ...
    amount: z.number().positive('Expense amount must be positive'),
    // ...
});

// AFTER - Note: These validate FIRESTORE documents (numbers), not API DTOs
// Schema validation happens BEFORE FirestoreReader converts to strings
// So schemas should remain as `number` since they validate Firestore storage format
//
// NO CHANGE NEEDED - Schemas validate Firestore documents which still use numbers
```

**Key Insight**: Zod schemas validate Firestore document structure (internal storage), NOT API DTOs. Since we're keeping Firestore storage as numbers, schemas remain unchanged.

**Files Affected (NO CHANGES):**
- `schemas/expense.ts` - Keep `z.number()`
- `schemas/settlement.ts` - Keep `z.number()`
- `schemas/balance.ts` - Keep `z.number()`
- `schemas/common.ts` - No amount-specific schemas

---

## Phase 6: Backend Tests

### 6.1 Unit Tests

**Pattern**: Tests must use string amounts in API request/response assertions.

```typescript
// BEFORE
const expenseData = {
    amount: 100,              // ❌ number
    splits: [
        { uid: 'user1', amount: 50 },
        { uid: 'user2', amount: 50 }
    ]
};

// AFTER
const expenseData = {
    amount: '100.00',         // ✅ string
    splits: [
        { uid: 'user1', amount: '50.00' },
        { uid: 'user2', amount: '50.00' }
    ]
};
```

**Test Files to Update (Comprehensive List):**

1. **Validation Tests**:
   - `__tests__/unit/validation/currency-amount-validation.test.ts` - Update to test string parsing
   - `__tests__/unit/validation/InputValidation.test.ts` - Update amount assertions
   - `__tests__/unit/validation.test.ts` - Update expense/settlement validation tests

2. **Service Tests**:
   - `__tests__/unit/services/ExpenseService.test.ts` - All amount assertions
   - `__tests__/unit/services/SettlementService.test.ts` - All amount assertions
   - `__tests__/unit/services/IncrementalBalanceService.test.ts` - Balance calculation amounts
   - `__tests__/unit/services/balance/BalanceCalculationService.test.ts` - All balance amounts

3. **Split Strategy Tests**:
   - `__tests__/unit/services/splits/EqualSplitStrategy.test.ts` - All split amounts
   - `__tests__/unit/services/splits/ExactSplitStrategy.test.ts` - All split amounts
   - `__tests__/unit/services/splits/PercentageSplitStrategy.test.ts` - All split amounts

4. **Schema Validation Tests**:
   - `__tests__/unit/schema-validation.test.ts` - Keep as numbers (validates Firestore docs)

### 6.2 Integration Tests

**All integration tests must be updated** because they make API calls with request bodies and assert on response bodies.

```typescript
// BEFORE
const expense = await apiDriver.createExpense({
    amount: 100,
    splits: calculateEqualSplits(100, 'USD', participants)
}, token);

expect(expense.amount).toBe(100);

// AFTER
const expense = await apiDriver.createExpense({
    amount: '100.00',
    splits: calculateEqualSplits('100.00', 'USD', participants)
}, token);

expect(expense.amount).toBe('100.00');
```

**Integration Test Files (ALL must be updated):**
- `__tests__/integration/expenses-consolidated.test.ts` - ~30+ amount assertions
- `__tests__/integration/groups-management-consolidated.test.ts` - ~15+ amount assertions
- `__tests__/integration/balance-settlement-consolidated.test.ts` - ~50+ amount assertions
- `__tests__/integration/notifications-consolidated.test.ts` - ~10+ amount assertions
- `__tests__/integration/test-expense-locking.test.ts` - ~5+ amount assertions
- `__tests__/integration/concurrent-operations.integration.test.ts` - ~8+ amount assertions
- `__tests__/integration/security-rules.test.ts` - Any amount assertions

**Automation Opportunity**: Write a test helper that converts test data:
```typescript
// test-support helper
export function stringifyAmounts<T>(obj: T): T {
    // Recursively convert all amount/splits/balances to strings
}
```

---

## Phase 7: Test Utilities (`packages/test-support`)

### Changes Required

**1. Test Builders** - Output string amounts:

```typescript
// CreateExpenseRequestBuilder.ts

// BEFORE
withAmount(amount: number): this {
    this.expense.amount = amount;
    return this;
}

// AFTER
withAmount(amount: string | number): this {
    this.expense.amount = typeof amount === 'string' ? amount : formatMonetaryAmount(amount, this.expense.currency);
    return this;
}

// Alternative: Always require strings
withAmount(amount: string): this {
    this.expense.amount = amount;
    return this;
}
```

**Files to Update:**
- `builders/CreateExpenseRequestBuilder.ts`:
  - `withAmount()` - Accept/store string
  - Constructor - Generate string amounts
  - `withSplits()` - Accept splits with string amounts

- `builders/ExpenseUpdateBuilder.ts`:
  - `withAmount()` - Accept/store string
  - Constructor defaults - Generate string amounts
  - `withSplits()` - Accept splits with string amounts

**2. Test Helpers** - Generate string amounts:

```typescript
// test-helpers.ts

// BEFORE
export function randomValidCurrencyAmountPair(min: number, max: number): { currency: string; amount: number } {
    const currency = randomCurrency();
    const amount = randomAmount(min, max, getCurrencyDecimals(currency));
    return { currency, amount };
}

// AFTER
export function randomValidCurrencyAmountPair(min: number, max: number): { currency: string; amount: string } {
    const currency = randomCurrency();
    const amountNum = randomAmount(min, max, getCurrencyDecimals(currency));
    const amount = formatMonetaryAmount(amountNum, currency);
    return { currency, amount };
}
```

**Files to Update:**
- `test-helpers.ts`:
  - `randomValidCurrencyAmountPair()` - Return string amount
  - Any other amount-generating helpers

**3. API Driver** - No changes needed (passes through request/response as-is)

---

## Phase 8: Frontend - Webapp (`webapp-v2/src`)

### 8.1 API Client (`app/apiClient.ts`)

**No changes needed** - API client passes through JSON request/response as-is. Type safety enforced by TypeScript.

### 8.2 Zod Validation Schemas (`api/apiSchemas.ts`)

**Update all schemas to expect string amounts:**

```typescript
// BEFORE
const ExpenseSplitSchema = z.object({
    uid: z.string().min(1),
    amount: z.number(),              // ❌ number
    percentage: z.number().optional(),
});

const ExpenseDataSchema = z.object({
    // ...
    amount: z.number(),              // ❌ number
    splits: z.array(ExpenseSplitSchema),
});

// AFTER
const ExpenseSplitSchema = z.object({
    uid: z.string().min(1),
    amount: z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a valid decimal number'),  // ✅ string
    percentage: z.number().optional(),
});

const ExpenseDataSchema = z.object({
    // ...
    amount: z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a valid decimal number'),  // ✅ string
    splits: z.array(ExpenseSplitSchema),
});
```

**All Schemas to Update:**
- `ExpenseSplitSchema` - amount field
- `ExpenseDataSchema` - amount field
- `SettlementSchema` - amount field
- `SettlementListItemSchema` - amount field
- `SimplifiedDebtSchema` - amount field
- `GroupBalancesSchema` - All balance/debt amounts (recursive)
- `GroupSchema` - balance.balancesByCurrency amounts

### 8.3 Stores (`app/stores`)

**ExpenseFormStore** - Keep form state as numbers for calculations, convert to strings for API:

```typescript
// expense-form-store.ts

// BEFORE
interface ExpenseFormStore {
    amount: number;         // Internal state
    splits: ExpenseSplit[];
}

async saveExpense(groupId: string): Promise<ExpenseDTO> {
    const request: CreateExpenseRequest = {
        amount: this.amount,  // Send number
        splits: this.splits,
    };
    return apiClient.createExpense(request);
}

// AFTER
interface ExpenseFormStore {
    amount: number;         // ✅ Keep as number for form calculations
    splits: ExpenseSplit[]; // ✅ Internal splits use numbers
}

async saveExpense(groupId: string): Promise<ExpenseDTO> {
    const request: CreateExpenseRequest = {
        amount: formatMonetaryAmount(this.amount, this.currency),  // ✅ Convert to string
        splits: this.splits.map(s => ({
            uid: s.uid,
            amount: formatMonetaryAmount(s.amount, this.currency),  // ✅ Convert to string
            percentage: s.percentage
        })),
    };
    return apiClient.createExpense(request);
}
```

**Pattern**: Stores maintain numeric amounts for UI/calculations, convert to strings only at API boundary.

**Files to Update:**
- `app/stores/expense-form-store.ts`:
  - `saveExpense()` - Convert amounts to strings before API call
  - `updateExpense()` - Convert amounts to strings before API call
  - Keep internal `amount` and `splits[].amount` as numbers

- `app/stores/group-detail-store-enhanced.ts`:
  - When receiving expense/settlement DTOs with string amounts, parse to numbers for display
  - Balance calculations receive string amounts, parse as needed

### 8.4 Form Components (`components`)

**Components receive string amounts from API, display as strings, parse for calculations:**

```typescript
// components/expense-form/ExpenseBasicFields.tsx

// BEFORE
const onAmountChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    updateField('amount', numValue);  // Store as number
};

// AFTER - Store as number internally, but aware API uses strings
const onAmountChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    updateField('amount', numValue);  // ✅ Still store as number internally
};
// Conversion to string happens in store's saveExpense()
```

**Minimal changes needed** - Components continue to work with numbers internally, stores handle conversion.

**Files to Review (minimal changes):**
- `components/expense-form/ExpenseBasicFields.tsx` - May need updates for parseFloat handling
- `components/expense-form/SplitAmountInputs.tsx` - Parse string amounts for display
- `components/settlements/SettlementForm.tsx` - Line 47: `amount.toFixed(2)` becomes just `amount` if already string
- `components/ui/CurrencyAmountInput.tsx` - Input value handling (likely no change)

### 8.5 Utility Functions

**Add parsing/formatting utilities:**

```typescript
// utils/currency-validation.ts

// NEW: Add string parsing
export function parseMonetaryAmount(amountStr: string): number {
    // Same implementation as backend
}

export function formatMonetaryAmount(amount: number, currencyCode: string): string {
    // Same implementation as backend
}
```

**Files to Update:**
- `utils/currency-validation.ts` - Add parsing/formatting functions
- `utils/currency/currencyFormatter.ts` - Update `formatCurrency()` to handle string inputs

---

## Phase 9: Firestore Storage (NO CHANGES)

**CRITICAL**: Firestore document structure remains UNCHANGED. All stored amounts are still `number` type.

**Rationale**:
1. Firestore has no precision issues with stored numbers
2. No data migration required
3. Firestore queries on amounts still work (e.g., `where('amount', '>', 100)`)
4. Conversion happens at API boundary (FirestoreReader/Writer)

**Confirmed**:
- `groups/{groupId}/expenses/{expenseId}` - amount: number
- `groups/{groupId}/settlements/{settlementId}` - amount: number
- `groups/{groupId}/balances/{groupId}` - all amounts: number

---

## Phase 10: Migration Strategy

### NO MIGRATION REQUIRED ✅

**Reason**: We're changing API wire format, NOT database storage format.

**Deployment Flow**:
1. Deploy backend changes (readers/writers convert at boundary)
2. Deploy frontend changes (sends/receives strings)
3. Old frontend continues to work (backend converts incoming numbers to strings transparently)
4. New frontend works immediately (backend already converts to strings)

**Graceful Handling (Optional Safety)**:

```typescript
// Joi validation can accept BOTH for transition period
const amountSchema = Joi.alternatives().try(
    Joi.string().pattern(/^-?\d+(\.\d+)?$/),  // New: string
    Joi.number().positive()                    // Old: number (convert to string)
).custom((value, helpers) => {
    if (typeof value === 'number') {
        return value.toFixed(2);  // Convert to string
    }
    return value;  // Already string
});
```

---

## Phase 11: Testing Strategy

### 11.1 Unit Test Coverage

**String Parsing Tests** (New):
```typescript
describe('parseMonetaryAmount', () => {
    it('should parse valid decimal strings', () => {
        expect(parseMonetaryAmount('100.00')).toBe(100);
        expect(parseMonetaryAmount('0.01')).toBe(0.01);
        expect(parseMonetaryAmount('12345.67')).toBe(12345.67);
    });

    it('should reject invalid formats', () => {
        expect(() => parseMonetaryAmount('abc')).toThrow();
        expect(() => parseMonetaryAmount('12.34.56')).toThrow();
        expect(() => parseMonetaryAmount('')).toThrow();
    });

    it('should handle edge cases', () => {
        expect(parseMonetaryAmount('0')).toBe(0);
        expect(parseMonetaryAmount('0.0')).toBe(0);
        expect(parseMonetaryAmount('999999.99')).toBe(999999.99);
    });
});
```

### 11.2 Integration Test Updates

**Update ALL integration tests** - Pattern:
1. Change request body amounts from numbers to strings
2. Change response assertions from numbers to strings
3. Update test builders to generate strings

**Estimate**: ~150+ assertions across 6 integration test files.

### 11.3 E2E Tests

**Minimal changes expected** - E2E tests use UI forms which already work with strings.

**Files to review:**
- `e2e-tests/src/tests/normal-flow/expense-creation.e2e.test.ts`
- `e2e-tests/src/tests/normal-flow/settlement-flow.e2e.test.ts`

---

## Phase 12: Documentation Updates

### Code Comments

**Update JSDoc comments** to reflect string types:

```typescript
/**
 * Create a new expense
 * @param amount - Expense amount as decimal string (e.g., "123.45")
 * @param currency - 3-letter currency code
 */
```

### README / Guides

**Update docs** in `/docs/guides/`:
- `code.md` - Update type examples
- `types.md` - Update DTO examples
- `building-and-testing.md` - Update test examples

---

## Summary of Files to Change

### Shared Packages (3 files)
- `packages/shared/src/shared-types.ts` - ~15 type definitions
- `packages/shared/src/split-utils.ts` - 3 function signatures + 2 new utilities
- `packages/test-support/src/builders/*.ts` - 2 builder classes

### Backend Functions (~30 files)
**Core Logic**:
- `firebase/functions/src/expenses/validation.ts` - Joi schemas
- `firebase/functions/src/settlements/validation.ts` - Joi schemas
- `firebase/functions/src/utils/amount-validation.ts` - Parsing utilities
- `firebase/functions/src/services/ExpenseService.ts` - Parse amounts
- `firebase/functions/src/services/SettlementService.ts` - Parse amounts
- `firebase/functions/src/services/firestore/FirestoreReader.ts` - Convert to strings
- `firebase/functions/src/services/firestore/FirestoreWriter.ts` - Parse to numbers
- `firebase/functions/src/services/splits/*.ts` - 4 files (interface + 3 strategies)
- `firebase/functions/src/services/balance/*.ts` - 4 balance service files

**Tests** (~20 files):
- Unit tests: 8 files (validation, services, splits)
- Integration tests: 6 files (all expenses/settlements/balances)
- Test utilities: 2 files (builders)

### Frontend Webapp (~12 files)
- `webapp-v2/src/api/apiSchemas.ts` - Zod schemas
- `webapp-v2/src/app/stores/expense-form-store.ts` - Conversion logic
- `webapp-v2/src/app/stores/group-detail-store-enhanced.ts` - Parse amounts
- `webapp-v2/src/utils/currency-validation.ts` - Add parsing utilities
- `webapp-v2/src/components/expense-form/*.tsx` - 2 components (review)
- `webapp-v2/src/components/settlements/SettlementForm.tsx` - Parse amounts
- `webapp-v2/src/utils/currency/currencyFormatter.ts` - Handle strings

### Total: ~45 files

---

## Implementation Phases (Recommended Order)

### Phase 1: Foundation (Day 1)
1. ✅ Add parsing/formatting utilities to `@splitifyd/shared`
2. ✅ Update shared type definitions
3. ✅ Update split calculation utilities
4. ✅ Add utility tests

### Phase 2: Backend API Boundary (Day 2)
1. ✅ Update Joi validation schemas
2. ✅ Update amount validation utilities
3. ✅ Update FirestoreReader/Writer conversion logic
4. ✅ Update split strategies
5. ✅ Update backend unit tests

### Phase 3: Backend Services (Day 3)
1. ✅ Update ExpenseService
2. ✅ Update SettlementService
3. ✅ Update balance services
4. ✅ Update integration tests

### Phase 4: Frontend (Day 4)
1. ✅ Update Zod schemas
2. ✅ Update stores
3. ✅ Update form components
4. ✅ Add frontend utilities

### Phase 5: Testing & Validation (Day 5)
1. ✅ Run full test suite
2. ✅ Manual testing in emulator
3. ✅ Fix any edge cases
4. ✅ Performance validation

---

## Risk Assessment

### High Risk Areas

1. **Balance Calculations** - Complex recursive structures with many amount fields
   - Mitigation: Comprehensive unit tests for all balance calculation scenarios

2. **FirestoreReader/Writer Conversion** - Central conversion point
   - Mitigation: Add extensive logging during conversion

3. **Test Suite Updates** - ~150+ assertions to change
   - Mitigation: Automated search/replace for common patterns

### Low Risk Areas

1. **Firestore Storage** - Unchanged (no migration)
2. **API Client** - Pass-through (no logic)
3. **UI Components** - Minimal changes (already use string inputs)

---

## Testing Checklist

- [ ] Unit tests: String parsing utilities
- [ ] Unit tests: Split strategies with string amounts
- [ ] Unit tests: Joi validation with strings
- [ ] Unit tests: Service layer amount parsing
- [ ] Integration tests: Expense CRUD with string amounts
- [ ] Integration tests: Settlement CRUD with string amounts
- [ ] Integration tests: Balance calculations with strings
- [ ] Manual: Create expense via UI
- [ ] Manual: Edit expense via UI
- [ ] Manual: Create settlement via UI
- [ ] Manual: View balances
- [ ] Performance: Compare calculation speed (string vs number)

---

## Open Questions

1. **Percentage fields** - Keep as number or convert to string?
   - **Decision**: Keep as number (no precision issues 0-100)

2. **Balance comparison tolerances** - How to handle with strings?
   - **Decision**: Parse to numbers for comparison, keep tolerance logic unchanged

3. **Frontend display** - Show 2 decimals always or respect currency?
   - **Decision**: Respect currency decimals (use `formatMonetaryAmount()`)

4. **API versioning** - Should we version the API?
   - **Decision**: No - graceful handling of both types during transition

---

## Success Criteria

- [ ] All unit tests pass (699 tests)
- [ ] All integration tests pass (6 test files)
- [ ] Manual testing: Create/edit/delete expenses works
- [ ] Manual testing: Create/edit/delete settlements works
- [ ] Manual testing: Balance calculations are correct
- [ ] No floating-point precision bugs in calculations
- [ ] TypeScript compilation succeeds (zero errors)
- [ ] API responses validated with Zod (no runtime errors)
- [ ] Performance: No degradation in calculation speed

---

## Rollback Plan

**If deployment fails:**

1. Revert backend deployment (API still accepts/returns numbers)
2. Frontend continues to work (types still compatible)
3. No data loss (Firestore unchanged)
4. No migration cleanup required

**Rollback Trigger Conditions:**
- More than 5% of API requests fail validation
- Balance calculations show incorrect values
- Test suite failure rate > 10%

---

## Post-Deployment Monitoring

**Metrics to Track:**
1. API validation error rate (expect spike, then normalize)
2. Balance calculation accuracy (manual spot checks)
3. Response time for split calculations
4. Error logs for `parseMonetaryAmount()` failures

**Alerts:**
- Validation error rate > 5%
- Any `NaN` or `Infinity` in balances
- Parse errors for amounts

---

**END OF REPORT**