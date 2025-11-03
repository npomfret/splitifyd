# Align ApiDriver, AppDriver, and apiClient to Common Interface

## Overview

Currently, we have three API client implementations (`ApiDriver`, `AppDriver`, `apiClient`) with inconsistent method names, parameter signatures, and type flexibility. This plan outlines the changes needed to align them to a common interface based on the canonical server API defined in `firebase/functions/src/routes/route-config.ts`.

## Phase 1: Define Common Interface (IApiClient)

### 1.1 Create IApiClient interface file
- **File**: `packages/shared-types/src/api/IApiClient.ts`
- **Action**: Create new interface with generic type parameters for ID types
- Use canonical method names from `route-config.ts`
- Generic params: `TGroupId`, `TExpenseId`, `TSettlementId`, `TPolicyId`

**Rationale**:
- Test drivers need `GroupId | string` for convenience (readable test strings)
- Production client needs strict `GroupId` for type safety
- Generic parameters solve both needs

```typescript
export interface IApiClient<
  TGroupId = GroupId,
  TExpenseId = ExpenseId,
  TSettlementId = SettlementId,
  TPolicyId = PolicyId
> {
  // Methods defined here...
}
```

## Phase 2: Rename Methods to Match Canonical API

### 2.1 ApiDriver Changes
**File**: `packages/test-support/src/ApiDriver.ts`

#### Method Renames:
| Current Name (Line) | New Name | Server Handler |
|---------------------|----------|----------------|
| `generateShareLink()` (220) | `generateShareableLink()` | `generateShareableLink` |
| `joinGroupViaShareLink()` (229) | `joinGroupByLink()` | `joinGroupByLink` |

#### Add Missing Methods:
- `previewGroupByLink(linkId: string, token: string): Promise<PreviewGroupResponse>`
- `archiveGroupForUser(groupId: GroupId | string, token: string): Promise<MessageResponse>`
- `unarchiveGroupForUser(groupId: GroupId | string, token: string): Promise<MessageResponse>`
- `getActivityFeed(token: string, options?: GetActivityFeedOptions): Promise<ActivityFeedResponse>`

#### Internal Helper Updates:
- `addMembersViaShareLink()` (line 253) → update to call `joinGroupByLink()` internally
- `createGroupWithMembers()` (line 248) → update to call `generateShareableLink()` internally

### 2.2 AppDriver Changes
**File**: `firebase/functions/src/__tests__/unit/AppDriver.ts`

**No method renames needed** - already aligned! ✅

**Verification checklist:**
- ✅ `generateShareableLink()` (line 386)
- ✅ `joinGroupByLink()` (line 397)
- ✅ `archiveGroupForUser()` (line 449)
- ✅ `unarchiveGroupForUser()` (line 455)
- ✅ `approveMember()` (line 485)
- ✅ `rejectMember()` (line 491)

### 2.3 apiClient Changes
**File**: `webapp-v2/src/app/apiClient.ts`

#### Method Renames:
| Current Name (Line) | New Name | Server Handler |
|---------------------|----------|----------------|
| `generateShareLink()` (881) | `generateShareableLink()` | `generateShareableLink` |
| `archiveGroup()` (777) | `archiveGroupForUser()` | `archiveGroupForUser` |
| `unarchiveGroup()` (785) | `unarchiveGroupForUser()` | `unarchiveGroupForUser` |
| `approvePendingMember()` (910) | `approveMember()` | `approveMember` |
| `rejectPendingMember()` (917) | `rejectMember()` | `rejectMember` |

## Phase 3: Standardize Parameter Names

### 3.1 Update Expense Methods Across All Clients

#### ApiDriver (line 185):
```typescript
// Current
async updateExpense(expenseId: ExpenseId | string, updateData: Partial<ExpenseDTO>, token: string)

// Change to
async updateExpense(expenseId: ExpenseId | string, data: Partial<CreateExpenseRequest>, token: string)
```

#### AppDriver (line 503):
```typescript
// Current
async updateExpense(userId: UserId, expenseId: ExpenseId | string, updateBody: any)

// Change to
async updateExpense(userId: UserId, expenseId: ExpenseId | string, data: Partial<CreateExpenseRequest>)
```

#### apiClient:
Already correct ✅

### 3.2 Standardize displayName Parameter

#### ApiDriver (line 321):
```typescript
// Current
async updateGroupMemberDisplayName(groupId: GroupId | string, newDisplayName: DisplayName, token: string)

// Change to
async updateGroupMemberDisplayName(groupId: GroupId | string, displayName: DisplayName, token: string)
```

## Phase 4: Implement Interface in Each Client

### 4.1 ApiDriver
```typescript
export class ApiDriver implements IApiClient<
  GroupId | string,
  ExpenseId | string,
  SettlementId | string,
  PolicyId | string
> {
  // ... existing implementation
}
```

### 4.2 AppDriver
```typescript
export class AppDriver implements IApiClient<
  GroupId | string,
  ExpenseId | string,
  SettlementId | string,
  PolicyId | string
> {
  // ... existing implementation
}
```

**Note**: AppDriver has a different auth pattern (userId first parameter). The interface will need to accommodate this, or we create adapter wrapper methods.

### 4.3 apiClient
```typescript
class ApiClient implements IApiClient<
  GroupId,
  ExpenseId,
  SettlementId,
  PolicyId
> {
  // ... existing implementation
}
```

## Phase 5: Update Call Sites

### 5.1 Search for Method Calls to Renamed Methods

Search patterns (using ripgrep):
```bash
# ApiDriver/apiClient renames
rg "\.generateShareLink\("
rg "\.joinGroupViaShareLink\("
rg "\.archiveGroup\("
rg "\.unarchiveGroup\("
rg "\.approvePendingMember\("
rg "\.rejectPendingMember\("
```

### 5.2 Update Test Files
- Search in `**/*.test.ts`, `**/*.spec.ts`
- Update all references to renamed methods
- Verify tests still pass

### 5.3 Update Application Code
- Search in `webapp-v2/src/**/*.ts`, `webapp-v2/src/**/*.tsx`
- Update all references to renamed methods
- Pay special attention to:
  - Group archive/unarchive UI
  - Share link generation UI
  - Member approval flows

## Phase 6: Build and Test

### 6.1 Run TypeScript Compilation
```bash
npm run build
```
Fix any type errors that arise from the interface implementation.

### 6.2 Run Test Suites
```bash
npm test
```
Ensure all tests pass after method renames.

### 6.3 Manual Testing Checklist
- [ ] Share link generation
- [ ] Join group via link
- [ ] Archive/unarchive group
- [ ] Approve/reject pending members
- [ ] Update expense

## Important Notes

### Auth Pattern Differences
The three clients have fundamentally different auth patterns:

1. **ApiDriver**: `method(data, token: string)` - token as last parameter
2. **AppDriver**: `method(userId: UserId, data)` - userId as first parameter
3. **apiClient**: `method(data)` - token managed internally via `setAuthToken()`

**Solution**: The common interface defines core data parameters. Each implementation adds its auth mechanism as additional parameter(s). This is acceptable because:
- The interface captures the "what" (operation and data)
- The implementation handles the "how" (authentication)

### Test vs Production Type Safety

- **Test drivers** (`ApiDriver`, `AppDriver`): Accept `GroupId | string` for convenience
  - Allows readable test code: `driver.updateGroup("test-group-123", ...)`
  - Makes tests easier to write and understand

- **Production client** (`apiClient`): Enforces strict `GroupId` type
  - Prevents bugs from passing arbitrary strings
  - Provides compile-time safety in the webapp

This is achieved cleanly via the generic type parameters in the interface.

### Canonical Source of Truth

The **server route configuration** (`firebase/functions/src/routes/route-config.ts`) is the canonical source of truth for:
- Method names (via `handlerName` field)
- URL paths
- HTTP methods
- Required middleware

All client method names should align with the `handlerName` values in that file.

## Success Criteria

- [ ] All three clients implement `IApiClient` with appropriate generic parameters
- [ ] All method names match canonical server handler names
- [ ] Parameter names are consistent across implementations
- [ ] All tests pass
- [ ] TypeScript compilation succeeds with no errors
- [ ] No runtime errors in manual testing
- [ ] Documentation updated to reflect new interface

## Future Enhancements

After this alignment is complete, consider:
1. Auto-generating the interface from the route configuration
2. Adding runtime validation that client methods match server handlers
3. Creating a shared test suite that validates all three implementations
