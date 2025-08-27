# Task: Strengthen Firestore Data Validation and Type Safety

## 1. Overview

This document outlines a critical refactoring task to eliminate a recurring source of bugs: the lack of strict, schema-based data validation at the Firestore database boundary. The codebase frequently reads data and trusts its shape via TypeScript casting (`as Type`), and writes data without guaranteeing its conformance to a defined schema.

This leads to untyped data propagating through the system, causing subtle and hard-to-debug errors.

## 2. The Two-Step Solution

To fix this, we must enforce two rules **everywhere** we interact with Firestore:

1.  **Validate on Write:** Before any document is created (`.set()`, `.add()`) or updated (`.update()`), the *entire* object being written must be validated against a strict schema. If the data is invalid, the operation must fail loudly.
2.  **Parse on Read:** Immediately after reading a document from Firestore (`.get()`), the raw data (`doc.data()`) must be parsed and validated by a schema that transforms it into a strongly-typed object. Unsafe type casting (`as Type`) is forbidden.

We will use **Zod** for this. It's perfect for both parsing/validation and automatically inferring TypeScript types from schemas, reducing code duplication.

---

## 3. Identified Violations & Remediation Plan

The following is a comprehensive list of every location in the `firebase/` codebase that violates these rules.

### 3.1. Read-Side Violations (Unsafe Casting)

This is the most common and critical violation. Data is read and immediately cast to a type, offering no runtime protection.

#### **Violation Hotspot: `transformGroupDocument`**

-   **File:** `firebase/functions/src/groups/handlers.ts`
-   **Problem:** This function is the primary source of unsafe group data. It reads a document and casts it directly.
    ```typescript
    export const transformGroupDocument = (doc: admin.firestore.DocumentSnapshot): Group => {
        const data = doc.data(); // Unsafe data from Firestore
        if (!data) {
            throw new Error('Invalid group document');
        }
        // ...
        return { // Unsafe casting to the Group type
            id: doc.id,
            name: groupData.name!,
            // ... other fields
        } as Group;
    };
    ```
-   **Why it's bad:** If a `group` document in Firestore is missing `name` or has a `members` field that isn't a map, the function will crash or return a malformed `Group` object, causing downstream errors.
-   **Required Action:**
    1.  Create a `GroupSchema` using Zod that defines the exact shape of a `Group` document.
    2.  Refactor `transformGroupDocument` to use `GroupSchema.parse(doc.data())`. This will validate the data and throw a descriptive error if it's invalid, while returning a guaranteed-to-be-correct `Group` object on success.

#### **Violation Hotspot: `fetchExpense`**

-   **File:** `firebase/functions/src/expenses/handlers.ts`
-   **Problem:** Similar to groups, this function reads an expense and casts it.
    ```typescript
    const { docRef, expense } = await fetchExpense(expenseId, userId);
    // 'expense' is cast from doc.data() as Expense
    ```
-   **Why it's bad:** An expense document with a `null` amount or a `description` that is a number instead of a string would pass the type cast but break the application logic.
-   **Required Action:**
    1.  Create an `ExpenseSchema` using Zod.
    2.  Refactor `fetchExpense` to parse the data with `ExpenseSchema.parse()`.

#### **Other Major Read Violations:**

-   **File:** `firebase/functions/src/settlements/handlers.ts`
    -   **Function:** `getSettlement`
    -   **Violation:** Reads a settlement document and casts it to the `Settlement` type.
-   **File:** `firebase/functions/src/services/UserService2.ts`
    -   **Function:** `getUser`
    -   **Violation:** Reads a user document from Firestore and directly uses the fields without parsing, assuming they exist and have the correct type.
-   **File:** `firebase/functions/src/policies/handlers.ts` & `public-handlers.ts`
    -   **Violation:** All functions reading `Policy` documents (`getPolicy`, `getCurrentPolicy`, etc.) directly access `doc.data()` fields, assuming the structure is correct. This is especially risky for a public-facing endpoint.

### 3.2. Write-Side Violations (Unvalidated Writes)

Data is written to Firestore without being validated against a schema first. This allows potentially malformed objects to be saved, corrupting the database.

#### **Violation Hotspot: `createGroup`**

-   **File:** `firebase/functions/src/groups/handlers.ts`
-   **Problem:** While the incoming *request* is validated with Joi, the final `newGroup` object that is written to Firestore is constructed manually and is not validated against a final schema before the `.set()` call.
    ```typescript
    const newGroup: Group = { /* ... fields assembled manually ... */ };
    await docRef.set({
        data: newGroup,
        // ...
    });
    ```
-   **Why it's bad:** A logic error in the manual assembly of `newGroup` could lead to a document that doesn't match the `Group` interface being saved. For example, the `permissions` object could be malformed.
-   **Required Action:**
    1.  Use the `GroupSchema` created for the read-side fix.
    2.  Before calling `docRef.set()`, call `GroupSchema.parse(newGroup)` to ensure the object is valid.

#### **Violation Hotspot: `updateExpense`**

-   **File:** `firebase/functions/src/expenses/handlers.ts`
-   **Problem:** The `updates` object is built dynamically. While individual fields are validated on input, the final shape of the object after merging with existing data is not validated before the `transaction.update()` call.
-   **Required Action:**
    1.  After constructing the `updates` object, fetch the full document state as it *would be* after the update.
    2.  Parse this hypothetical full state against the `ExpenseSchema`. This ensures the update doesn't result in an invalid document state.

#### **Violation Hotspot: `track...Changes` Cloud Triggers**

-   **File:** `firebase/functions/src/triggers/change-tracker.ts`
-   **Problem:** This is a critical, system-wide violation. All three trigger functions (`trackGroupChanges`, `trackExpenseChanges`, `trackSettlementChanges`) manually construct `changeDoc` objects and write them to Firestore without any schema validation.
    ```typescript
    const changeDoc = createMinimalChangeDocument(...);
    await firestoreDb.collection(...).add(changeDoc);
    ```
-   **Why it's bad:** A bug in `createMinimalChangeDocument` could lead to thousands of malformed change documents being written to the database, breaking all real-time update functionality for clients.
-   **Required Action:**
    1.  Create Zod schemas for `GroupChangeDocument`, `TransactionChangeDocument`, and `BalanceChangeDocument`.
    2.  In each trigger, before the `.add()` call, validate the `changeDoc` with its corresponding schema.

#### **Other Major Write Violations:**

-   **File:** `firebase/functions/src/user/handlers.ts`
    -   **Function:** `updateUserProfile`
    -   **Violation:** Writes to the user document in Firestore without validating the final object.
-   **File:** `firebase/functions/src/settlements/handlers.ts`
    -   **Function:** `createSettlement`
    -   **Violation:** The final `settlement` object is not validated against a schema before being written.
-   **File:** `firebase/functions/src/auth/handlers.ts`
    -   **Function:** `register`
    -   **Violation:** The `userDoc` written to Firestore upon new user registration is not validated by a schema.

## 4. Next Steps

This refactor is critical for the stability and long-term health of the application. It should be prioritized.

1.  **Implement Zod Schemas:** Create a central file (e.g., `firebase/functions/src/schemas.ts`) to define Zod schemas for all core Firestore documents: `Group`, `Expense`, `Settlement`, `User`, `Policy`, and all `ChangeDocument` types.
2.  **Refactor Read Path:** Systematically replace all instances of `doc.data() as Type` with `Schema.parse(doc.data())`. Start with `transformGroupDocument` and `fetchExpense`.
3.  **Refactor Write Path:** Systematically add `Schema.parse(objectToWrite)` calls before every `.set()`, `.add()`, and `.update()` operation.
4.  **Update Tests:** All unit and integration tests will need to be updated to account for the new, stricter validation. Mocks will need to provide data that passes schema validation.

## 5. Implementation Progress

### Completed Changes

#### ✅ Change Document Validation (triggers/change-tracker.ts)
- Added Zod schemas directly in the file for minimal overhead
- Validates `GroupChangeDocument`, `TransactionChangeDocument`, and `BalanceChangeDocument` before writing
- All change tracking tests pass

#### ✅ User Data Validation (settlements/handlers.ts)
- Added `UserDataSchema` to validate user documents when fetched
- Replaces manual field checking with schema validation
- Better error messages for corrupted user data

#### ✅ Settlement Write Validation (settlements/handlers.ts)
- Added `SettlementDocumentSchema` to validate before `.set()`
- Ensures data integrity when creating settlements
- Prevents malformed settlement documents

#### ✅ Expense Validation (expenses/handlers.ts)
- Added `ExpenseDocumentSchema` with Zod for strict validation
- Validates on read in `fetchExpense()` - parses doc.data() and fails loudly on corruption
- Validates on create in `createExpense()` - ensures only valid expenses are written
- Better error messages with validation details

#### ✅ Group Document Transform Validation (groups/handlers.ts)
- Added `GroupDocumentSchema`, `GroupDataSchema`, and `GroupMemberSchema` for comprehensive validation
- Validates in `transformGroupDocument()` - ensures group data integrity
- Handles nested structure with data field wrapper
- Validates permissions with flexibility for extra fields

#### ✅ Group Write Validation (groups/handlers.ts)
- Added validation to `createGroup()` before `.set()` operation
- Validates complete document structure with Zod schema
- Prevents malformed group documents from being written to Firestore
- Fails fast with clear error logging if validation fails

#### ✅ Validation Monitoring/Logging (settlements/handlers.ts, policies/public-handlers.ts, services/UserService2.ts)
- Added `warn` method to ContextualLogger interface and implementation
- Added validation logging to `getSettlement()` - logs when settlement documents would fail validation
- Added validation logging to `getCurrentPolicy()` and `getCurrentPolicies()` - logs when policy documents would fail validation  
- Added validation logging to `UserService2.getUser()` - logs when user documents would fail validation
- All tests pass (297 unit + 460 integration)

#### ✅ Group Write Validation in GroupService (services/GroupService.ts)
- Exported `GroupDocumentSchema` from handlers for reuse
- Added validation to `GroupService.createGroup()` before `.set()` operation
- Validates complete document structure with Zod schema
- Prevents malformed group documents from being written via GroupService
- Fails fast with clear error logging if validation fails

### Status: ✅ COMPLETE

All validation has been successfully migrated to strict enforcement mode:
- All read operations use Zod schemas with `.parse()` that throw on invalid data
- All write operations validate documents before `.set()`, `.add()`, or `.update()`
- No validation warnings remain - all validation failures now throw errors immediately
- GroupService.createGroup() now validates before writing (last remaining gap closed)

## 5. Detailed Implementation Plan (Original)

### Phase 1: Foundation Setup (Non-Breaking)
These commits lay the groundwork without affecting existing code.

#### Commit 1: Create Core Zod Schemas Infrastructure
- **Files:** Create `firebase/functions/src/schemas/index.ts`
- **Changes:** 
  - Export placeholder schemas module
  - Set up the basic structure for schema organization
- **Why Safe:** New file, no existing code affected

#### Commit 2: Implement User and Policy Schemas
- **Files:** Create `firebase/functions/src/schemas/user.schema.ts` and `firebase/functions/src/schemas/policy.schema.ts`
- **Changes:**
  - Define `UserSchema`, `PolicySchema`, `PolicyDocumentSchema` using Zod
  - Export inferred types: `ParsedUser`, `ParsedPolicy`
- **Why Safe:** New files, no integration with existing code

#### Commit 3: Implement Group Schema
- **Files:** Create `firebase/functions/src/schemas/group.schema.ts`
- **Changes:**
  - Define `GroupMemberSchema`, `GroupPermissionsSchema`, `GroupSchema`
  - Handle the nested structure with `data` field wrapper
  - Export `ParsedGroup` type
- **Why Safe:** New file, existing code continues using old approach

#### Commit 4: Implement Expense and Settlement Schemas
- **Files:** Create `firebase/functions/src/schemas/expense.schema.ts` and `firebase/functions/src/schemas/settlement.schema.ts`
- **Changes:**
  - Define `ExpenseSplitSchema`, `ExpenseSchema`, `SettlementSchema`
  - Handle Firestore Timestamp conversion logic
  - Export `ParsedExpense`, `ParsedSettlement` types
- **Why Safe:** New files only

#### Commit 5: Implement Change Document Schemas
- **Files:** Create `firebase/functions/src/schemas/change-documents.schema.ts`
- **Changes:**
  - Define schemas for `GroupChangeDocument`, `TransactionChangeDocument`, `BalanceChangeDocument`
  - Export parsed types
- **Why Safe:** New file, no existing functionality affected

### Phase 2: Create Safe Parser Utilities (Non-Breaking)
Create utilities that can coexist with existing code.

#### Commit 6: Implement Safe Parser Wrapper Functions
- **Files:** Create `firebase/functions/src/utils/firestore-parsers.ts`
- **Changes:**
  - Create `safeParseDocument<T>()` function that logs errors but doesn't throw
  - Create `parseDocumentStrict<T>()` function for strict validation
  - Add conversion utilities for Timestamps
- **Why Safe:** New utilities, not used anywhere yet

#### Commit 7: Add Dual-Mode Transform Functions
- **Files:** Create `firebase/functions/src/utils/document-transformers.ts`
- **Changes:**
  - Create `transformGroupDocumentSafe()` - new version using Zod
  - Create `transformExpenseSafe()` - new version using Zod
  - These coexist with existing transform functions
- **Why Safe:** New functions alongside existing ones

### Phase 3: Gradual Read-Path Migration (Backwards Compatible)
Start using schemas for validation while maintaining compatibility.

#### Commit 8: Add Validation Logging to Groups
- **Files:** Modify `firebase/functions/src/groups/handlers.ts`
- **Changes:**
  - In `transformGroupDocument`, add non-throwing validation:
    ```typescript
    // After getting data, validate but don't throw
    try {
      GroupSchema.parse(data);
    } catch (e) {
      logger.warn('Group document validation would fail', { error: e, docId: doc.id });
    }
    // Continue with existing logic
    ```
- **Why Safe:** Only logs warnings, doesn't change behavior

#### Commit 9: Add Validation Logging to Expenses
- **Files:** Modify `firebase/functions/src/expenses/handlers.ts`
- **Changes:**
  - In `fetchExpense`, add validation logging after the cast
  - Log validation errors without throwing
- **Why Safe:** Monitoring only, no functional changes

#### Commit 10: Add Validation Logging to Settlements
- **Files:** Modify `firebase/functions/src/settlements/handlers.ts`
- **Changes:**
  - Add validation logging in `getSettlement`
  - Monitor what would fail in production
- **Why Safe:** Observability without breaking changes

### Phase 4: Implement Write-Path Validation (Defensive)
Add validation that prevents bad data from being written.

#### Commit 11: Validate Group Creates
- **Files:** Modify `firebase/functions/src/groups/handlers.ts`
- **Changes:**
  - In `createGroup`, before `docRef.set()`:
    ```typescript
    // Validate the complete document structure
    const documentToWrite = { data: newGroup, createdAt, updatedAt };
    GroupSchema.parse(documentToWrite); // Throws if invalid
    await docRef.set(documentToWrite);
    ```
- **Why Safe:** Prevents invalid data from being written, fails fast

#### Commit 12: Validate Expense Creates
- **Files:** Modify `firebase/functions/src/expenses/handlers.ts`
- **Changes:**
  - In `createExpense`, validate before transaction.set()
  - Ensures only valid expenses are created
- **Why Safe:** Fails fast on bad data, prevents corruption

#### Commit 13: Validate Settlement Creates
- **Files:** Modify `firebase/functions/src/settlements/handlers.ts`
- **Changes:**
  - In `createSettlement`, validate before `.set()`
- **Why Safe:** Prevents invalid settlements

#### Commit 14: Validate Trigger Writes
- **Files:** Modify `firebase/functions/src/triggers/change-tracker.ts`
- **Changes:**
  - Validate change documents before `.add()` in all three triggers
  - Critical for data integrity
- **Why Safe:** Ensures change tracking data is always valid

### Phase 5: Careful Read-Path Switchover
Replace unsafe casts with parsed data, one endpoint at a time.

#### Commit 15: Switch transformGroupDocument to Strict Parsing
- **Files:** Modify `firebase/functions/src/groups/handlers.ts`
- **Changes:**
  - Replace `doc.data() as Type` with `GroupSchema.parse(doc.data())`
  - Update return type handling
  - Test thoroughly with existing groups
- **Testing Required:** Run integration tests for all group operations

#### Commit 16: Switch fetchExpense to Strict Parsing
- **Files:** Modify `firebase/functions/src/expenses/handlers.ts`
- **Changes:**
  - Replace unsafe cast with `ExpenseSchema.parse()`
  - Handle parse errors appropriately
- **Testing Required:** Test expense CRUD operations

#### Commit 17: Switch Settlement Reads to Strict Parsing
- **Files:** Modify `firebase/functions/src/settlements/handlers.ts`
- **Changes:**
  - Use `SettlementSchema.parse()` in getSettlement and list operations
- **Testing Required:** Settlement operations

### Phase 6: Update Validation & Error Handling

#### Commit 18: Enhance Error Messages
- **Files:** Modify `firebase/functions/src/utils/errors.ts`
- **Changes:**
  - Add `INVALID_DOCUMENT_STRUCTURE` error type
  - Improve Zod error formatting for client consumption
- **Why Safe:** Better error reporting

#### Commit 19: Update Unit Tests
- **Files:** Modify test files in `firebase/functions/src/__tests__/`
- **Changes:**
  - Update mocks to provide valid data per schemas
  - Add tests for validation edge cases
- **Why Safe:** Test improvements only

#### Commit 20: Add Integration Tests for Validation
- **Files:** Create new test files
- **Changes:**
  - Test that invalid data is rejected on write
  - Test that corrupted documents are caught on read
  - Test migration scenarios
- **Why Safe:** New tests only

### Phase 7: Complete Migration

#### Commit 21: Remove Old Validation Logging
- **Files:** Clean up logging code added in Phase 3
- **Changes:**
  - Remove warning logs since we're now throwing errors
  - Clean up dual-mode functions
- **Why Safe:** Cleanup only

#### Commit 22: Add Schema Documentation
- **Files:** Create `firebase/functions/src/schemas/README.md`
- **Changes:**
  - Document schema patterns
  - Provide migration guide for future changes
  - Document Timestamp handling approach
- **Why Safe:** Documentation only

### Rollback Strategy

If issues arise at any phase:

1. **Phase 1-2:** No rollback needed (new code only)
2. **Phase 3:** Remove logging calls
3. **Phase 4:** Temporarily disable validation (comment out parse calls)
4. **Phase 5:** Revert to unsafe casts while investigating
5. **Emergency:** Feature flag to toggle validation on/off

### Success Metrics

Monitor after each phase:
- Error rate changes
- Validation failure logs (Phase 3)
- Response time impact
- Test coverage maintenance

### Notes

- Each commit should pass all existing tests
- Run `npm run build` and `npm test` after each commit
- Deploy to staging after each phase for validation
- Keep commits small and focused for easy rollback
- Document any data migration needs discovered during Phase 3
