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
