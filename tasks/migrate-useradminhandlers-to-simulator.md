# Task: Migrate UserAdminHandlers.test.ts to Use Simulator Classes

## Context

The file `firebase/functions/src/__tests__/unit/admin/UserAdminHandlers.test.ts` currently uses Vitest's `vi.fn()` mocks for testing. This is a code smell because:

1. **Mocking anti-pattern**: We're mocking implementation details rather than testing actual behavior
2. **Inconsistency**: Other unit tests in the codebase use the simulator pattern (e.g., `StubAuthService`, `TenantFirestoreTestDatabase`)
3. **Brittle tests**: Mock-based tests verify call counts and arguments, not actual state changes
4. **Low confidence**: These tests don't catch real bugs because they're testing mock interactions, not real logic

## Current State

The test file has:
- `vi.fn()` mocks for FirestoreReader and FirestoreWriter
- Mock verification assertions like `expect(mockWriter.updateUser).toHaveBeenCalledWith(...)`
- Custom stub classes created inline in the test file

## Goal

Replace the Vitest mocks with the proper simulator infrastructure that already exists in the codebase:

### Use Existing Infrastructure
- **`TenantFirestoreTestDatabase`** from `@billsplit-wl/test-support` - the in-memory Firestore simulator
- **`FirestoreReader`** (real implementation) - instantiated with the test database
- **`FirestoreWriter`** (real implementation) - instantiated with the test database
- **`StubAuthService`** (already in use) - the existing Auth simulator

### Pattern to Follow

```typescript
import { TenantFirestoreTestDatabase } from '@billsplit-wl/test-support';
import { FirestoreReader, FirestoreWriter } from '../../../services/firestore';

describe('UserAdminHandlers', () => {
    let db: TenantFirestoreTestDatabase;
    let firestoreReader: FirestoreReader;
    let firestoreWriter: FirestoreWriter;
    let authService: StubAuthService;

    beforeEach(() => {
        db = new TenantFirestoreTestDatabase();
        firestoreReader = new FirestoreReader(db);
        firestoreWriter = new FirestoreWriter(db);
        authService = new StubAuthService();

        handlers = new UserAdminHandlers(authService, firestoreWriter, firestoreReader);
    });

    it('should update user role', async () => {
        // Seed test data using the simulator
        db.seedUser('user1', { role: SystemUserRoles.SYSTEM_USER });
        authService.setUser('user1', { /* auth data */ });

        // Execute the handler
        await handlers.updateUserRole(req, res);

        // Verify actual state changes
        const updatedUser = await firestoreReader.getUser('user1');
        expect(updatedUser?.role).toBe(SystemUserRoles.SYSTEM_ADMIN);
    });
});
```

## Benefits

1. **Tests real code paths**: Uses actual `FirestoreReader` and `FirestoreWriter` implementations
2. **Catches real bugs**: Tests verify actual state changes in the database
3. **Consistency**: Follows the same pattern as other unit tests in the codebase
4. **No type hacks**: No `as unknown as` or `as any` casting needed
5. **Better refactoring safety**: Tests will catch breaking changes to Firestore interfaces

## Key Differences from Mock-Based Tests

### Before (Mock-based)
```typescript
const mockWriter = vi.fn();
await handlers.updateUserRole(req, res);
expect(mockWriter.updateUser).toHaveBeenCalledWith('user1', { role: 'system_admin' });
```

### After (Simulator-based)
```typescript
db.seedUser('user1', { role: SystemUserRoles.SYSTEM_USER });
await handlers.updateUserRole(req, res);
const updated = await firestoreReader.getUser('user1');
expect(updated?.role).toBe(SystemUserRoles.SYSTEM_ADMIN);
```

## Type Safety Notes

### `UserDocument.id` Field Type
During this refactoring, we discovered that `UserDocument.id` should be strongly typed as `UserId` (branded type) instead of plain `string`. This is because:

1. The `id` field holds the Firebase Auth UID
2. All other user-related IDs in the codebase use the `UserId` branded type
3. Type safety prevents accidentally mixing different ID types

**Fix required**: Create a user-specific document ID schema in `firebase/functions/src/schemas/user.ts`:
```typescript
const UserDocumentIdSchema = z.object({
    id: UserIdSchema, // Instead of z.string().min(1)
});
```

### Simulator Seeding
When using `db.seedUser()`, the data needs to match Firestore format (ISO strings for dates, not JavaScript Date objects):

```typescript
db.seedUser('user1', {
    role: SystemUserRoles.SYSTEM_USER,
    createdAt: new Date().toISOString(), // ISO string, not Date
});
```

## Potential Pitfalls to Avoid

1. **Don't create custom stub classes inline** - Use the existing simulator infrastructure
2. **Don't use `as any` or `as unknown as` casts** - The real classes implement the interfaces correctly
3. **Don't verify mock calls** - Verify actual database state instead
4. **Don't mix Firestore Timestamps with ISO strings** - Use `db.seedUser()` which handles conversion

## References

- Example of simulator pattern: `firebase/functions/src/__tests__/unit/firestore-reader-pagination.test.ts`
- Simulator infrastructure: `packages/test-support/src/firebase/TenantFirestoreTestDatabase.ts`
- StubAuthService pattern: `firebase/functions/src/__tests__/unit/mocks/StubAuthService.ts`
