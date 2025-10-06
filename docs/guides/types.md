# Type Definition Guidelines

## Implementation Status: ✅ COMPLETED (January 2025)

This document was created following a comprehensive firebase types audit that successfully eliminated duplicate type definitions and established a clean type hierarchy. **Updated January 2025** to reflect the completed DTO-everywhere migration.

## Architecture Overview: DTOs as Application Types

The codebase follows a **DTO-everywhere** architecture where:

- **DTOs (Data Transfer Objects)** from `@splitifyd/shared` are the single source of truth for application logic
- **Firestore Timestamp ↔ ISO string conversion** happens exclusively at the FirestoreReader/Writer boundary
- **Services work only with DTOs** containing ISO 8601 date strings
- **Firestore Document schemas** are internal implementation details for I/O validation

```
┌─────────────────────────────────────────────────────────────┐
│ Application Layer (Services, Handlers, Business Logic)     │
│ ✅ Use: ExpenseDTO, GroupDTO, SettlementDTO, etc.         │
│ ✅ Import from: @splitifyd/shared                          │
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
- **Rule**: If a service uses a type, it must be a DTO from `@splitifyd/shared`

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
    - ALL API response types (e.g., `MessageResponse`, `CreateSettlementResponse`, `UpdatePolicyResponse`)
    - Even if only the server uses them today, the client should be able to import them
- Examples: `RegisteredUser`, `GroupMemberDTO`, `UserBalance`, `SimplifiedDebt`, `MessageResponse`, `UpdateGroupRequest`
- Import these types in both client and server code
- **No exceptions** - request/response types always go in shared

### 4. Service-Internal Types

**Location**: Within the service file itself or dedicated interface files

- Types used only within a single service should be co-located with that service
- Example: Pagination interfaces in `IFirestoreReader.ts`
- Avoid creating separate `types/` directories for simple types

## Critical Decision Flow

**When creating a new type, ask:**

1. **Is this data returned from FirestoreReader or sent to an API?** → Use existing DTO from `@splitifyd/shared`
2. **Is this a request or response type for an API endpoint?** → `packages/shared/src/shared-types.ts` (**ALWAYS**)
3. **Is this ONLY used within FirestoreReader/Writer for validation?** → Create Zod schema in `firebase/functions/src/schemas/` (but do NOT export the inferred type)
4. **Is this only used within a single service?** → Co-locate with the service

**Rule of thumb:** If you're writing service logic, you should ONLY import DTOs from `@splitifyd/shared`. Document types should never appear in your imports.

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
import type { ExpenseDTO } from '@splitifyd/shared';

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
import type { ExpenseDTO } from '@splitifyd/shared';

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

---

## DTO Migration (January 2025)

### Overview

A comprehensive refactoring was completed to establish DTOs as the single source of truth for application logic, with Firestore Document schemas relegated to internal I/O validation only.

### Goals Achieved

1. ✅ **Eliminated Document types from application layer** - Services now import only from `@splitifyd/shared`
2. ✅ **Centralized timestamp conversion** - All Timestamp ↔ ISO string conversion happens at FirestoreReader/Writer boundary
3. ✅ **Zero `z.any()` types** - Every schema field has explicit type validation
4. ✅ **Simplified type system** - One type per entity (DTOs), not multiple parallel hierarchies
5. ✅ **Clear architectural boundaries** - Services/I/O separation is enforced by types

### Key Changes

- **FirestoreReader**: Added `convertTimestampsToISO()` - recursively converts all Timestamp objects to ISO strings when reading from Firestore
- **FirestoreWriter**: Added `convertISOToTimestamps()` - recursively converts all ISO strings to Timestamps when writing to Firestore
- **Services**: Removed all `ExpenseDocument`, `GroupDocument`, `SettlementDocument` imports; replaced with DTOs
- **Schemas**: Document types removed from public exports; schemas used only for internal validation
- **Tests**: Updated to use ISO strings instead of Timestamp objects

### Architectural Principles

1. **DTOs are application types** - All service logic works with DTOs containing ISO strings
2. **Schemas are validators** - Zod schemas validate at I/O boundary, types not exposed
3. **Conversion is automatic** - Reader/Writer handle all timestamp conversion transparently
4. **Timestamps stay in Firestore** - Database layer unaffected, still uses Timestamp objects
5. **FirestoreWriter manages meta fields** - Services never set `createdAt`/`updatedAt`, Writer adds them automatically

### Benefits Realized

- **~300+ lines of code eliminated** - Removed duplicate type definitions and conversion logic
- **Clearer boundaries** - Services can't accidentally work with wrong type format
- **Simpler service code** - No manual date conversion, no Timestamp imports
- **Type-safe dates** - ISO strings validated with `z.string().datetime()`
- **Consistent patterns** - One way to work with dates throughout application

### Migration Documentation

For detailed migration history, see `tasks/simplify-type-system-use-dtos-everywhere.md`

---

## Earlier Type System Cleanup (January 2025)

### Implementation History

### ✅ Phase 1: Eliminated services/balance/types.ts duplicates (January 2025)

**Problem**: Balance calculation services used local `Expense`, `Settlement`, and `ExpenseSplit` interfaces that duplicated canonical schema types and used `string` dates instead of `Timestamp`.

**Solution**:

- Removed duplicate interfaces from `services/balance/types.ts`
- Updated `BalanceCalculationService`, `ExpenseProcessor`, and `SettlementProcessor` to use `ExpenseDocument` and `SettlementDocument` directly
- Fixed `BalanceCalculationInputSchema` to use canonical document schemas instead of local balance schemas
- Eliminated unnecessary string-to-Timestamp conversions

**Files Updated**:

- `services/balance/BalanceCalculationService.ts`
- `services/balance/ExpenseProcessor.ts`
- `services/balance/SettlementProcessor.ts`
- `services/balance/types.ts`
- `schemas/balance.ts`

### ✅ Phase 2: Cleaned up types/ directory (January 2025)

**Problem**: Legacy type files in `types/` directory created unnecessary indirection and contained redundant definitions.

**Solution**:

- Deleted `types/group-types.ts` (was just re-exporting shared types)
- Deleted `types/firestore-reader-types.ts` (moved pagination types to `IFirestoreReader.ts`)
- Updated all imports to use direct references
- Kept `types/server-types.ts` for legitimate server-only types

**Files Deleted**:

- `types/group-types.ts`
- `types/firestore-reader-types.ts`

**Files Updated**:

- `services/firestore/IFirestoreReader.ts` (added pagination types)
- `services/firestore/FirestoreReader.ts`
- `services/GroupService.ts`
- `groups/validation.ts`
- `__tests__/test-utils/MockFirestoreReader.ts`

### ✅ Phase 3: Simplified auth-types.ts (January 2025)

**Problem**: `UserProfile` interface in auth-types duplicated `RegisteredUser` from shared package.

**Solution**:

- Removed unused `UserProfile` interface
- Updated export in `services/auth/index.ts`
- Added comment directing developers to use `RegisteredUser` for app data or Firebase `UserRecord` for auth data

**Files Updated**:

- `services/auth/auth-types.ts`
- `services/auth/index.ts`

### ✅ Phase 4: Established guidelines (January 2025)

**Solution**: Created this documentation file with:

- Clear type definition hierarchy
- Anti-patterns to avoid
- Examples of correct usage
- Enforcement guidelines

### ✅ Phase 2 Cleanup: Final duplicate elimination (January 2025)

**Problem**: Re-analysis identified remaining minor duplications:

1. `GroupData` and `GroupMember` interfaces in `services/balance/types.ts` duplicated canonical schema types
2. Internal auth result types (`CreateUserResult`, `UpdateUserResult`, etc.) unnecessarily exposed in public API

**Solution**:

- **Balance types cleanup**: Updated `BalanceCalculationService` to use `GroupDocument` and `GroupMemberDocument` directly from canonical sources, eliminating intermediate transformation layer
- **Auth types consolidation**: Moved internal result/request interfaces (`CreateUserResult`, `ValidatedCreateUserRequest`, etc.) into `FirebaseAuthService.ts` as private implementation details
- **Public API simplification**: Kept only truly shared types in `auth-types.ts` module exports

**Files Updated**:

- `services/balance/BalanceCalculationService.ts` - Uses canonical `GroupDocument` and `GroupMemberDocument[]` directly
- `services/balance/types.ts` - Removed duplicate `GroupData` and `GroupMember` interfaces
- `schemas/balance.ts` - Updated `BalanceCalculationInputSchema` for new structure
- `services/auth/FirebaseAuthService.ts` - Added internal validated types as private interfaces
- `services/auth/auth-types.ts` - Removed internal result and request types
- `services/auth/index.ts` - Cleaned up public exports
- `__tests__/unit/services/BalanceCalculationService.test.ts` - Updated to use new `groupDoc` structure

**Benefits**:

- **Eliminated ~30 lines** of remaining duplicate type definitions
- **Completed type consolidation** - no remaining duplicates identified
- **Simplified public APIs** - internal types no longer exposed
- **Improved maintainability** - clearer separation between public and private types

### Impact Summary

- **~230+ lines of duplicate code eliminated** (original ~200 + Phase 2 cleanup ~30)
- **Zero TypeScript compilation errors**
- **Improved type safety** with canonical Zod schema usage
- **Eliminated date conversion bugs** in balance calculations
- **Cleaner import structure** throughout codebase
- **Established maintainable patterns** for future development

### Key Achievements

1. **100% elimination** of duplicate type definitions for core entities
2. **Direct Timestamp usage** in balance calculations (no more string conversions)
3. **Co-located pagination types** with their usage in FirestoreReader
4. **Clean type hierarchy**: Schemas → Shared → Service-local → Server-only
5. **Comprehensive documentation** to prevent future regressions
