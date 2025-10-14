# Monetary Amounts as Strings - Refactor Implementation

**Goal**: Change all monetary amounts from `number` to `string` to eliminate JavaScript floating-point precision bugs.

**Original Scope**: Complete brutal refactor - NO backward compatibility.

**ACTUAL Implementation**: **Incremental, backward-compatible approach** (October 2025).

**Rationale**: JavaScript's IEEE 754 floating-point arithmetic causes precision loss (e.g., `0.1 + 0.2 !== 0.3`). For financial calculations, this is unacceptable. Using strings ensures exact decimal representation.

---

## Where Monetary Math Occurs

A deep-dive analysis of the codebase reveals that arithmetic on monetary amounts is not isolated to split calculations. It is widespread and complex, occurring in three main areas:

### 1. Balance Processing (`IncrementalBalanceService.ts`, `ExpenseProcessor.ts`, `SettlementProcessor.ts`)
This is the system's real-time ledger, which constantly performs math to keep balances accurate.
- **Addition**: Aggregating debts from expense splits and merging balance deltas.
- **Subtraction**: Calculating a user's final `netBalance` (`totalOwed - totalOwing`) and applying settlement payments to debts.
- **Negation**: Reversing a transaction's financial impact when it is deleted or updated.
- **`Math.abs`**: Used as a safety check to clean up and ignore tiny balances that result from floating-point inaccuracies.

### 2. Debt Simplification (`utils/debtSimplifier.ts`)
This utility uses a greedy algorithm to find the simplest way for users to pay each other back. This is the most calculation-intensive part of the system.
- **Addition & Subtraction**: To calculate each user's final net position across all their debts and credits.
- **Negation**: To correctly handle debtor balances in the algorithm.
- **`Math.min`**: To determine the optimal transaction amount between a creditor and a debtor.
- **Repeated Subtraction**: To reduce the balances of creditors and debtors as transactions are created until all debts are settled.

### 3. Frontend UI & Validation (`webapp-v2`)
The frontend application also performs calculations for validation and UI display purposes.
- **Form Validation**: In `components/expense-form/SplitAmountInputs.tsx` and the `app/stores/expense-form-store.ts`, the individual split amounts are summed up (`reduce((sum, s) => sum + s.amount, 0)`) and compared to the total expense amount to ensure they match.
- **UI Display**: In `components/expense/SplitBreakdown.tsx`, the UI calculates the percentage of each split relative to the total expense (`(s.amount / expense.amount) * 100`), which involves division.

The widespread and complex nature of these calculations makes the move to string-based monetary amounts a critical step for ensuring financial integrity.

---

## Guiding Principles for the Final Refactor

The successful completion of this refactor will be measured by adherence to these principles:

1.  **No Floating-Point Math:** At no point should two monetary amounts be added, subtracted, or compared as floating-point numbers. All calculations must be done after converting amounts to integers (e.g., cents) or by using a dedicated decimal math library.

2.  **Elimination of All Tolerances:** All validation logic that checks if amounts are "close enough" (e.g., `Math.abs(totalSplit - totalAmount) < 0.01`) **must be removed**. Once the math is correct, amounts must add up perfectly to the smallest currency unit (e.g., the penny). The use of a tolerance is a sign that floating-point math is still being used incorrectly.

3.  **String-Based API:** All monetary amounts sent to or from the API (requests and responses) must be strings to ensure perfect precision during serialization and deserialization.


---

## Phase 1: Foundational Refactor (Completed October 2025)

This phase laid the groundwork for the final transition to strings without introducing breaking changes.

<details>
<summary><strong>✅ Click to expand implementation details</strong></summary>

### 1. Introduced `Amount` Type Alias
As a crucial intermediate step, a new type alias was introduced in `@splitifyd/shared`:
```typescript
export type Amount = number;
```
All monetary fields (`amount`, `netBalance`, etc.) and function parameters throughout the codebase were updated to use this `Amount` type instead of the primitive `number`.

**Benefit**: This allows the final migration to be a single-line change (`type Amount = string;`), with the TypeScript compiler then highlighting every location that requires logic changes for handling strings.

### 2. API Accepts Both `number` and `string`
The backend API was updated to gracefully accept both `number` and `string` for all monetary amount fields.
- **How**: A `createAmountSchema()` helper was created using `Joi.alternatives()` to validate both types at the API boundary.
- **Result**: This made the change backward-compatible, ensuring existing clients continued to work without modification.

### 3. Added Explicit Currency Precision Validation
Validation was added to all monetary endpoints to reject amounts with more decimal places than the specified currency allows (e.g., rejecting `100.123` for 'USD').
- **Benefit**: This prevents floating-point errors from entering the system, even while amounts are still stored as numbers internally.

### 4. Internal Storage Unchanged (In Phase 1)
For Phase 1, the internal data storage format in Firestore was intentionally kept as `number` to avoid a data migration. The API validation layer handled the conversion, allowing internal services to continue working with numbers. **Note:** The plan for Phase 2 is to migrate the database storage to `string` as well.

</details>

---

## Evidence: Precision Bug Demonstration Tests

**Location**: `packages/shared/src/__tests__/split-utils.test.ts`

A comprehensive test suite exists that demonstrates and documents the floating-point precision issues, serving as living documentation for why this refactor is necessary. It proves that `0.1 + 0.2` results in `0.30000000000000004` and that these small errors accumulate in balance calculations.

---

## Next Steps (Phase 2)

The foundational work is complete. The final migration to storing strings **at all levels (API and Database)** is a significant task that involves the following:

1.  **Change Central Type Alias:** Update the type alias in `@splitifyd/shared`:
    `export type Amount = string;`

2.  **Update Calculation Logic:** All services (e.g., balance processing, debt simplification) must now parse string `Amount`s into numbers before performing any math, using the `parseMonetaryAmount()` utility.

3.  **Update Firestore Schemas:** All Zod schemas in `firebase/functions/src/schemas/` that validate Firestore documents must be updated from `z.number()` to `z.string()` for all monetary fields.

4.  **Update `FirestoreWriter` & `FirestoreReader`:** The responsibility for type conversion is removed. These services will now read and write string `Amount`s directly to and from the database without transformation.

5.  **CRITICAL - Data Migration:** A migration script must be created and executed to convert all existing monetary amounts in the Firestore database from `number` to `string` format. This is a one-time, high-impact operation.

6.  **Review Firestore Queries:** All database queries that perform numeric comparisons on amount fields (e.g., `where('amount', '>', 100)`) must be identified. Since string-based sorting is not numerically accurate, these queries must be refactored or removed.

7.  **Update Tests:** All relevant unit and integration tests must be updated to reflect string amounts being used at the database level.
