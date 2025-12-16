# Type Definition Guidelines

## Implementation Status: ✅ COMPLETED (January 2025)

This document was created following a comprehensive firebase types audit that successfully eliminated duplicate type definitions and established a clean type hierarchy. **Updated January 2025** to reflect the completed DTO-everywhere migration.

## Architecture Overview: DTOs as Application Types

The codebase follows a **DTO-everywhere** architecture where:

- **DTOs (Data Transfer Objects)** from `@billsplit-wl/shared` are the single source of truth for application logic
- **Firestore Timestamp ↔ ISO string conversion** happens exclusively at the FirestoreReader/Writer boundary
- **Services work only with DTOs** containing ISO 8601 date strings
- **Firestore Document schemas** are internal implementation details for I/O validation

```
┌─────────────────────────────────────────────────────────────┐
│ Application Layer (Services, Handlers, Business Logic)     │
│ ✅ Use: ExpenseDTO, GroupDTO, SettlementDTO, etc.         │
│ ✅ Import from: @billsplit-wl/shared                          │
│ ✅ Date format: ISO 8601 strings (e.g., "2025-01-15T...")  │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│ Firestore I/O Boundary (FirestoreReader/Writer)            │
│ 🔄 Converts: Timestamp ↔ ISO string                        │
│ ✅ Validates: Document schemas (ExpenseDocumentSchema)     │
│ ❌ Never expose: Document types to services                │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│ Firestore Database                                          │
│ 📦 Stores: Timestamp objects                               │
└─────────────────────────────────────────────────────────────┘
```

## Single Source of Truth Principle

To maintain consistency and prevent duplication, follow these guidelines when defining types:

### 1. DTOs - Application Layer Types

**Location**: `packages/shared/src/shared-types.ts`

- **ALL application code** uses DTOs from the shared package
- DTOs use **ISO 8601 string dates** (e.g., `createdAt: string`, `date: string`)
- Examples: `ExpenseDTO`, `GroupDTO`, `SettlementDTO`, `PolicyDTO`, `CommentDTO`
- Services, handlers, and business logic import these types
- **Rule**: If a service uses a type, it must be a DTO from `@billsplit-wl/shared`

### 2. Firestore Document Schemas - Internal I/O Validation

**Location**: `firebase/functions/src/schemas/`

- **INTERNAL USE ONLY** by FirestoreReader and FirestoreWriter
- Zod schemas validate data during Firestore read/write operations
- Schemas expect Firestore `Timestamp` objects (before/after conversion)
- Examples: `ExpenseDocumentSchema`, `GroupDocumentSchema` (schemas, not types)
- **Document types are NOT exported** from schemas/index.ts
- **Rule**: Never import Document types in services - use DTOs instead

### 3. Request/Response Types - API Contracts

**Location**: `packages/shared/src/shared-types.ts` (same as DTOs)

- **CRITICAL RULE**: ALL request and response types **MUST** be defined in the shared package
- This includes:
    - ALL API request types (e.g., `CreateGroupRequest`, `UpdateGroupRequest`, `CreateExpenseRequest`)
    - ALL API response types (e.g., `SettlementDTO`, `GroupDTO`, `UserProfileResponse`)
    - Even if only the server uses them today, the client should be able to import them
- Examples: `RegisteredUser`, `GroupMemberDTO`, `UserBalance`, `SimplifiedDebt`, `UpdateGroupRequest`
- Import these types in both client and server code
- **No exceptions** - request/response types always go in shared
- **Note**: Update/delete operations return HTTP 204 No Content (void) - no response type needed

### 4. Service-Internal Types

**Location**: Within the service file itself or dedicated interface files

- Types used only within a single service should be co-located with that service
- Example: Pagination interfaces in `IFirestoreReader.ts`
- Avoid creating separate `types/` directories for simple types

## Critical Decision Flow

**When creating a new type, ask:**

1. **Is this data returned from FirestoreReader or sent to an API?** → Use existing DTO from `@billsplit-wl/shared`
2. **Is this a request or response type for an API endpoint?** → `packages/shared/src/shared-types.ts` (**ALWAYS**)
3. **Is this ONLY used within FirestoreReader/Writer for validation?** → Create Zod schema in `firebase/functions/src/schemas/` (but do NOT export the inferred type)
4. **Is this only used within a single service?** → Co-locate with the service

**Rule of thumb:** If you're writing service logic, you should ONLY import DTOs from `@billsplit-wl/shared`. Document types should never appear in your imports.

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Importing Document Types in Services

```typescript
// BAD: Never import Document types in services
import type { ExpenseDocument } from '../../schemas';

function processExpenses(expenses: ExpenseDocument[]) {
    // ❌ Wrong! Services should NOT use Document types
    const timestamp = expenses[0].createdAt; // Timestamp object - wrong layer!
}
```

✅ **Correct Pattern: Use DTOs**

```typescript
// GOOD: Import DTOs from shared package
import type { ExpenseDTO } from '@billsplit-wl/shared';

function processExpenses(expenses: ExpenseDTO[]) {
    // ✅ Correct! Services work with DTOs containing ISO strings
    const isoString = expenses[0].createdAt; // ISO string - right layer!
    const date = new Date(isoString); // Easy conversion when needed
}
```

### ❌ Anti-Pattern 2: Manual Timestamp Conversion in Services

```typescript
// BAD: Manual timestamp conversion
import { Timestamp } from 'firebase-admin/firestore';

function createExpense(data: CreateExpenseRequest) {
    const expenseData = {
        ...data,
        date: Timestamp.fromDate(new Date(data.date)), // ❌ Wrong layer!
        createdAt: Timestamp.now(), // ❌ Wrong layer!
    };
    await firestoreWriter.createExpense(expenseData);
}
```

✅ **Correct Pattern: Let FirestoreWriter Handle Conversion**

```typescript
// GOOD: Services work only with ISO strings, Writer handles conversion
function createExpense(data: CreateExpenseRequest) {
    const expenseData: Omit<ExpenseDTO, 'id' | 'createdAt' | 'updatedAt'> = {
        ...data,
        date: data.date, // ISO string, stays as-is
        // createdAt/updatedAt added by FirestoreWriter automatically
    };
    await firestoreWriter.createExpense(expenseData);
    // FirestoreWriter converts ISO → Timestamp internally
}
```

### ❌ Anti-Pattern 3: Creating Duplicate Type Definitions

```typescript
// BAD: Duplicating existing DTO types
interface Expense {
    id: string;
    amount: number;
    date: string;
    // ... duplicating ExpenseDTO
}
```

✅ **Correct Pattern: Reuse DTOs**

```typescript
// GOOD: Import existing DTOs
import type { ExpenseDTO } from '@billsplit-wl/shared';

function processExpense(expense: ExpenseDTO) {
    // Use the canonical type
}
```

## Benefits

- **Improved Maintainability**: Changes only need to be made in one place
- **Enhanced Type Safety**: Validated types throughout the application
- **Reduced Complexity**: Clearer, more consistent type system
- **Guaranteed Data Integrity**: Zod schema validation at every stage

## Enforcement

- Use TypeScript compilation to catch inconsistencies
- Code reviews should check for type duplication
- Prefer imports from canonical sources over local definitions
- **Zero-tolerance for `z.any()` in schemas** - every field must have explicit validation

