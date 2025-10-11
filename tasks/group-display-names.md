# Task: Implement Group-Specific Display Names

## Implementation Status 📝

**Last Updated**: 2025-01-11

**Current Phase**: Backend Foundation & Join Flow Complete

### Recent Changes (2025-01-11)

1. **Code Quality Fixes**:
   - Deleted duplicate test file `FirestoreWriter-groupMembers.test.ts`
   - Renamed remaining test to `FirestoreWriter.test.ts`
   - Fixed error code from `MEMBER_NOT_FOUND` to `GROUP_MEMBER_NOT_FOUND` for accuracy
   - Added empty display name validation in `updateGroupMemberDisplayName` (before transaction)

2. **Enhanced Test Coverage**:
   - Added 3 new test cases to `GroupShareService.test.ts`:
     - No conflict when display name is unique (`displayNameConflict: false`)
     - Conflict when display name matches existing member (`displayNameConflict: true`)
     - Case-insensitive conflict detection

3. **Files Modified**:
   - `firebase/functions/src/services/firestore/FirestoreWriter.ts` - Added validation, fixed error code
   - `firebase/functions/src/__tests__/unit/services/FirestoreWriter.test.ts` - Renamed from duplicate
   - `firebase/functions/src/__tests__/unit/services/GroupShareService.test.ts` - Added 3 conflict detection tests

### Next Steps

- **Priority 1**: Write unit tests for API endpoint validation (`groups/handlers.test.ts`)
- **Priority 2**: Update Firebase Security Rules to prevent unauthorized display name updates
- **Priority 3**: Implement client-side UI (modal, settings component, API integration)
- **Priority 4**: Write E2E tests for complete user flows

### Known Issues

- Firebase Security Rules not yet implemented
- API handler unit tests not yet written
- Client-side UI components not yet implemented

## Plan Completeness Review ✅

**Status**: Plan is now complete and ready for implementation.

**Critical additions made to original plan:**

1. **Firebase Security Rules** (Section added after "Handle Join Conflicts")
   - Defines rules to prevent unauthorized display name updates
   - Ensures only members can update their own `groupDisplayName`
   - Critical for security and data integrity

2. **API Response Types** (Section added in "Data Model Changes")
   - `JoinGroupResponse` interface with `displayNameConflict` flag
   - `MessageResponse` for standard API responses
   - Must be defined in `@splitifyd/shared` per project standards

3. **Real-Time Update Handling** (Section added before "Display Name Settings Component")
   - Explains how display name changes propagate automatically via existing Firebase listeners
   - No additional code needed - existing `onSnapshot` handles it
   - Includes testing considerations

4. **Conflict Modal Cancel Behavior** (Section added in "Handle Join Conflict Flow")
   - Specifies what happens when user cancels: they remain in group with `undefined` groupDisplayName
   - UI falls back to global `displayName` (creates temporary duplicate)
   - User can fix later via settings - acceptable UX compromise

5. **Integration Location Decision** (Section added before "Update UI to Use Group Display Names")
   - Provides options for where to add `GroupDisplayNameSettings` component
   - Recommends inline in group detail page for simplicity
   - Can be moved to dedicated settings page later if needed

6. **Validation & Schemas** (New major section before "Accessibility")
   - Zod schemas for request validation in shared package
   - Response validation schemas in API client
   - Follows project pattern of runtime validation

7. **Accessibility & Semantic Attributes** (New major section before "Testing Requirements")
   - Error messages with `role="alert"` and `data-testid`
   - Modal accessibility (ARIA labels, focus trap, keyboard navigation)
   - Follows project's semantic styling guidelines

8. **Multi-User Real-Time Testing** (Added to E2E tests section)
   - Test for real-time display name propagation between users
   - Verifies no page refresh needed to see changes
   - Critical for confirming real-time feature works correctly

**Updated sections:**
- Implementation Order: Now includes all new tasks (security rules, schemas, accessibility)
- Success Criteria: Reorganized into categories with specific acceptance criteria

## Overview

Allow users to have custom display names within each group that default to their global display name but can be changed to avoid conflicts or personalize their identity per group.

## Key Requirements

- **Default Behavior**: User's group display name defaults to their global `displayName`
- **Uniqueness**: Display names must be unique within each group (enforced server-side with transactions)
- **Conflict Detection**: UI prompts user to choose alternative if default name conflicts
- **Server Validation**: Transactional checks prevent race conditions in name assignment
- **UI Updates**: All group contexts show group display name, not global display name
- **No Migration**: This is a new feature - no existing data to migrate

## Architecture

### Data Model Changes

#### GroupMember Enhancement

**Location**: `packages/shared/src/shared-types.ts`

Add optional `groupDisplayName` field to `GroupMemberDTO`:

```typescript
export interface GroupMemberDTO {
    userId: string;
    email: string;
    displayName: string; // Global display name (unchanged)
    groupDisplayName?: string; // NEW: Group-specific display name
    joinedAt: string;
    role: 'admin' | 'member';
}
```

#### Firestore Schema

**Location**: `firebase/functions/src/schemas/group.ts`

Update `GroupMemberDocumentSchema`:

```typescript
export const GroupMemberDocumentSchema = z.object({
    userId: z.string(),
    email: z.string().email(),
    displayName: z.string(),
    groupDisplayName: z.string().optional(), // NEW
    joinedAt: Timestamp,
    role: z.enum(['admin', 'member']),
});
```

#### API Response Types

**Location**: `packages/shared/src/shared-types.ts`

Add response types for API endpoints:

```typescript
// Join group response with conflict detection
export interface JoinGroupResponse {
    groupId: string;
    displayNameConflict: boolean;
}

// Standard success response
export interface MessageResponse {
    message: string;
}
```

### Server-Side Implementation

#### 1. Add Transaction for Display Name Updates

**Location**: `firebase/functions/src/services/firestore/IFirestoreWriter.ts`

Add new method interface:

```typescript
/**
 * Update a member's group-specific display name with uniqueness validation
 * @throws ApiError if name is already taken in the group
 */
updateGroupMemberDisplayName(
    groupId: string,
    userId: string,
    newDisplayName: string
): Promise<void>;
```

#### 2. Implement Transactional Update

**Location**: `firebase/functions/src/services/firestore/FirestoreWriter.ts`

```typescript
async updateGroupMemberDisplayName(
    groupId: string,
    userId: string,
    newDisplayName: string
): Promise<void> {
    await this.db.runTransaction(async (transaction) => {
        const groupRef = this.db.collection('groups').doc(groupId);
        const groupDoc = await transaction.get(groupRef);

        if (!groupDoc.exists) {
            throw new ApiError(404, 'GROUP_NOT_FOUND', 'Group not found');
        }

        const groupData = groupDoc.data() as GroupDocument;
        const members = groupData.members || [];

        // Check if display name is already taken by another user
        const nameTaken = members.some(
            (m) =>
                m.userId !== userId &&
                (m.groupDisplayName || m.displayName) === newDisplayName
        );

        if (nameTaken) {
            throw new ApiError(
                409,
                'DISPLAY_NAME_TAKEN',
                `Display name "${newDisplayName}" is already in use in this group`
            );
        }

        // Update the member's groupDisplayName
        const updatedMembers = members.map((member) =>
            member.userId === userId
                ? { ...member, groupDisplayName: newDisplayName }
                : member
        );

        transaction.update(groupRef, {
            members: updatedMembers,
            updatedAt: FieldValue.serverTimestamp(),
        });
    });
}
```

#### 3. Add API Endpoint

**Location**: `firebase/functions/src/groups/handlers.ts`

```typescript
export const updateGroupMemberDisplayName = async (
    req: Request,
    res: Response
): Promise<void> => {
    const { groupId } = req.params;
    const { displayName } = req.body;
    const userId = req.user!.uid;

    // Validate request
    const schema = z.object({
        displayName: z
            .string()
            .min(1, 'Display name is required')
            .max(50, 'Display name must be 50 characters or less')
            .trim(),
    });

    const validation = schema.safeParse({ displayName });
    if (!validation.success) {
        throw new ApiError(
            400,
            'INVALID_REQUEST',
            validation.error.errors[0].message
        );
    }

    // Verify user is a member
    const group = await firestoreReader.getGroupById(groupId);
    const isMember = group.members.some((m) => m.userId === userId);

    if (!isMember) {
        throw new ApiError(403, 'FORBIDDEN', 'You are not a member of this group');
    }

    // Update display name transactionally
    await firestoreWriter.updateGroupMemberDisplayName(
        groupId,
        userId,
        validation.data.displayName
    );

    res.json({
        message: 'Display name updated successfully',
    });
};
```

**Location**: `firebase/functions/src/index.ts`

Add route:

```typescript
app.patch(
    '/groups/:groupId/members/me/display-name',
    authenticate,
    asyncHandler(updateGroupMemberDisplayName)
);
```

#### 4. Handle Join Conflicts

**Location**: `firebase/functions/src/groups/handlers.ts` (in `joinGroup` handler)

When user joins group, check if their default display name conflicts:

```typescript
// In joinGroup handler, after validating invite code
await this.db.runTransaction(async (transaction) => {
    // ... existing join logic ...

    // Check if default display name conflicts
    const members = groupData.members || [];
    const displayNameConflict = members.some(
        (m) => (m.groupDisplayName || m.displayName) === req.user!.displayName
    );

    const newMember: GroupMemberDocument = {
        userId: req.user!.uid,
        email: req.user!.email,
        displayName: req.user!.displayName,
        // If conflict, leave groupDisplayName undefined - UI will prompt
        groupDisplayName: displayNameConflict ? undefined : req.user!.displayName,
        joinedAt: FieldValue.serverTimestamp(),
        role: 'member',
    };

    // ... rest of join logic ...
});

// Return response with conflict flag
res.json({
    groupId,
    displayNameConflict, // NEW: Tell client if they need to choose new name
});
```

#### 5. Firebase Security Rules

**Location**: `firebase/firestore.rules`

Update security rules to allow members to update their own display name:

```javascript
match /groups/{groupId} {
    // Allow members to read groups they belong to
    allow read: if isMemberOfGroup(groupId);

    // Allow members to update their own groupDisplayName only
    allow update: if isMemberOfGroup(groupId) &&
                     onlyUpdatingOwnDisplayName(groupId);

    // Helper functions
    function isMemberOfGroup(groupId) {
        return exists(/databases/$(database)/documents/groups/$(groupId)) &&
               request.auth.uid in get(/databases/$(database)/documents/groups/$(groupId)).data.members.map(m => m.userId);
    }

    function onlyUpdatingOwnDisplayName(groupId) {
        let before = resource.data.members;
        let after = request.resource.data.members;

        // Members array must have same length (no adding/removing)
        return before.size() == after.size() &&
               // Only the requesting user's member object can change
               before.diff(after).affectedKeys().hasOnly([getUserMemberIndex(groupId)]) &&
               // Only groupDisplayName field can change in that member object
               onlyDisplayNameFieldChanged(groupId);
    }

    function getUserMemberIndex(groupId) {
        let members = get(/databases/$(database)/documents/groups/$(groupId)).data.members;
        return members.map((m, i) => m.userId == request.auth.uid ? i : -1).max();
    }

    function onlyDisplayNameFieldChanged(groupId) {
        let oldMember = resource.data.members[getUserMemberIndex(groupId)];
        let newMember = request.resource.data.members[getUserMemberIndex(groupId)];

        return oldMember.userId == newMember.userId &&
               oldMember.email == newMember.email &&
               oldMember.displayName == newMember.displayName &&
               oldMember.joinedAt == newMember.joinedAt &&
               oldMember.role == newMember.role &&
               // Only groupDisplayName can differ
               oldMember.keys().diff(newMember.keys()).hasOnly(['groupDisplayName']);
    }
}
```

**Note**: The above rules are complex due to Firestore's denormalized structure. In practice, the API endpoint enforces uniqueness via transactions, and these rules primarily prevent direct Firestore writes bypassing the API.

### Client-Side Implementation

#### 1. Add API Client Method

**Location**: `webapp-v2/src/api/apiClient.ts`

```typescript
async updateGroupMemberDisplayName(
    groupId: string,
    displayName: string
): Promise<void> {
    await this.request(
        `/groups/${groupId}/members/me/display-name`,
        {
            method: 'PATCH',
            body: JSON.stringify({ displayName }),
        }
    );
}
```

#### 2. Display Name Conflict Modal

**Location**: `webapp-v2/src/components/DisplayNameConflictModal.tsx`

New component:

```tsx
interface DisplayNameConflictModalProps {
    isOpen: boolean;
    groupName: string;
    conflictingName: string;
    onSubmit: (newName: string) => void;
    onCancel: () => void;
}

export function DisplayNameConflictModal({
    isOpen,
    groupName,
    conflictingName,
    onSubmit,
    onCancel,
}: DisplayNameConflictModalProps) {
    const [displayName, setDisplayName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await onSubmit(displayName.trim());
        } catch (err) {
            if (err.code === 'DISPLAY_NAME_TAKEN') {
                setError(`"${displayName}" is already taken. Please choose another name.`);
            } else {
                setError('Failed to update display name. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onCancel} title="Choose Display Name">
            <form onSubmit={handleSubmit}>
                <p className="text-sm text-gray-600 mb-4">
                    The name "{conflictingName}" is already taken in {groupName}.
                    Please choose a different display name for this group.
                </p>

                <Input
                    id="displayName"
                    label="Display Name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your display name"
                    required
                    maxLength={50}
                    error={error}
                    data-testid="display-name-input"
                />

                {error && (
                    <p
                        className="text-sm text-red-600 mt-2"
                        role="alert"
                        data-testid="display-name-error"
                    >
                        {error}
                    </p>
                )}

                <div className="flex gap-3 mt-6">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={!displayName.trim() || loading}
                        loading={loading}
                    >
                        Set Display Name
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
```

#### 3. Handle Join Conflict Flow

**Location**: `webapp-v2/src/pages/JoinGroupPage.tsx`

Update join flow to detect and handle conflicts:

```typescript
const handleJoinGroup = async (inviteCode: string) => {
    try {
        const response = await apiClient.joinGroup(inviteCode);

        if (response.displayNameConflict) {
            // Show conflict modal
            setShowConflictModal(true);
            setJoinedGroupId(response.groupId);
        } else {
            // Success - navigate to group
            route(`/groups/${response.groupId}`);
        }
    } catch (error) {
        // Handle error
    }
};

const handleDisplayNameSubmit = async (newName: string) => {
    await apiClient.updateGroupMemberDisplayName(joinedGroupId!, newName);
    setShowConflictModal(false);
    route(`/groups/${joinedGroupId}`);
};

const handleConflictModalCancel = () => {
    // User cancels - they remain in group with undefined groupDisplayName
    // They can set it later via settings, or it will show their global displayName as fallback
    setShowConflictModal(false);
    route(`/groups/${joinedGroupId}`);
};
```

**Important**: When a user cancels the conflict modal, they remain in the group with `groupDisplayName: undefined`. The UI helper `getGroupDisplayName()` will fall back to their global `displayName`, which creates a temporary duplicate name situation. The user can fix this later via group settings. This is acceptable because:
- Server-side uniqueness validation prevents actual data conflicts
- The fallback ensures the UI always displays *something*
- Users can resolve the conflict at their convenience

#### 4. Real-Time Update Handling

**Location**: `webapp-v2/src/stores/groupsStore.ts` (or equivalent)

Display name changes automatically propagate to all users viewing the group via Firebase real-time listeners:

```typescript
// Existing onSnapshot listener already handles this
onSnapshot(groupRef, (snapshot) => {
    const groupData = snapshot.data();
    // members array contains updated groupDisplayName
    // UI automatically re-renders with new display names
});
```

**No additional code needed** - the existing group document listener handles display name updates automatically. When any member updates their `groupDisplayName`, all users viewing that group will see the change in real-time because:

1. The `updateGroupMemberDisplayName` transaction updates the group document's `members` array
2. The group document's `onSnapshot` listener fires for all subscribers
3. UI components using `getGroupDisplayName()` automatically show the updated name

**Testing consideration**: E2E tests should verify multi-user real-time propagation (see testing section).

#### 5. Display Name Settings Component

**Location**: `webapp-v2/src/components/GroupDisplayNameSettings.tsx`

New component for changing display name after joining:

```tsx
interface GroupDisplayNameSettingsProps {
    groupId: string;
    currentDisplayName: string;
    onUpdate: () => void;
}

export function GroupDisplayNameSettings({
    groupId,
    currentDisplayName,
    onUpdate,
}: GroupDisplayNameSettingsProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [displayName, setDisplayName] = useState(currentDisplayName);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await apiClient.updateGroupMemberDisplayName(groupId, displayName.trim());
            setIsEditing(false);
            onUpdate();
        } catch (err) {
            if (err.code === 'DISPLAY_NAME_TAKEN') {
                setError(`"${displayName}" is already taken in this group.`);
            } else {
                setError('Failed to update display name.');
            }
        } finally {
            setLoading(false);
        }
    };

    if (!isEditing) {
        return (
            <div className="flex items-center justify-between">
                <div>
                    <label className="text-sm font-medium text-gray-700">
                        Group Display Name
                    </label>
                    <p className="text-sm text-gray-900">{currentDisplayName}</p>
                </div>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                >
                    Edit
                </Button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit}>
            <Input
                id="groupDisplayName"
                label="Group Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                error={error}
                data-testid="group-display-name-input"
            />
            <div className="flex gap-2 mt-3">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                        setIsEditing(false);
                        setDisplayName(currentDisplayName);
                        setError(null);
                    }}
                    disabled={loading}
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    variant="primary"
                    disabled={!displayName.trim() || loading}
                    loading={loading}
                >
                    Save
                </Button>
            </div>
        </form>
    );
}
```

#### 6. Integration with Group Settings

**Location**: To be determined during implementation

The `GroupDisplayNameSettings` component needs to be integrated into a group settings interface. Options:

1. **Create new Group Settings Page** (if none exists):
   - Route: `/groups/:groupId/settings`
   - Include display name settings along with other group member preferences
   - Accessible from group detail page menu

2. **Add to existing Group Detail Page** (simpler):
   - Add a "My Display Name" section to the group detail page
   - Shows current name and edit button
   - Inline editing without separate page

**Recommendation**: Add inline to group detail page initially for simplicity. Can move to dedicated settings page if more member-specific settings are added later.

#### 7. Update UI to Use Group Display Names

**Locations**: All components displaying member names

Create helper function:

```typescript
// webapp-v2/src/utils/displayName.ts
export function getGroupDisplayName(member: GroupMemberDTO): string {
    return member.groupDisplayName || member.displayName;
}
```

Update all components:

- `GroupDetailPage.tsx` - Member list
- `ExpenseForm.tsx` - Payer/split selection
- `ExpenseCard.tsx` - Expense display
- `SettlementCard.tsx` - Settlement display
- `BalanceSummary.tsx` - Balance display
- `CommentsList.tsx` - Comment authors

Example:

```tsx
// Before
<span>{member.displayName}</span>

// After
import { getGroupDisplayName } from '../utils/displayName';
<span>{getGroupDisplayName(member)}</span>
```

## Validation & Schemas

### Request Validation Schema

**Location**: `packages/shared/src/shared-types.ts`

Define Zod schema for request validation:

```typescript
import { z } from 'zod';

export const UpdateDisplayNameRequestSchema = z.object({
    displayName: z
        .string()
        .min(1, 'Display name is required')
        .max(50, 'Display name must be 50 characters or less')
        .trim(),
});

export type UpdateDisplayNameRequest = z.infer<typeof UpdateDisplayNameRequestSchema>;
```

**Usage in handler**:

```typescript
const validation = UpdateDisplayNameRequestSchema.safeParse({ displayName });
if (!validation.success) {
    throw new ApiError(400, 'INVALID_REQUEST', validation.error.errors[0].message);
}
```

### API Client Schema Validation

**Location**: `webapp-v2/src/api/apiSchemas.ts`

Add Zod schema for response validation:

```typescript
export const JoinGroupResponseSchema = z.object({
    groupId: z.string(),
    displayNameConflict: z.boolean(),
});

export const MessageResponseSchema = z.object({
    message: z.string(),
});
```

## Accessibility & Semantic Attributes

Following the project's semantic styling guidelines (see `docs/guides/webapp-and-style-guide.md`):

### Error Messages

All error displays must include proper semantic attributes:

```tsx
// Validation errors in forms
{error && (
    <p
        className="text-sm text-red-600 mt-2"
        role="alert"
        data-testid="display-name-error"
    >
        {error}
    </p>
)}

// Input error states
<input
    aria-invalid={!!error}
    aria-describedby={error ? `${id}-error` : undefined}
    // ... other props
/>
```

### Modal Accessibility

```tsx
<Modal
    isOpen={isOpen}
    onClose={onCancel}
    title="Choose Display Name"
    role="dialog"
    aria-labelledby="conflict-modal-title"
    aria-describedby="conflict-modal-description"
>
    <h2 id="conflict-modal-title" className="sr-only">
        Choose Display Name
    </h2>
    <p id="conflict-modal-description" className="text-sm text-gray-600">
        The name "{conflictingName}" is already taken...
    </p>
    {/* Form content */}
</Modal>
```

### Keyboard Navigation

- Modal should trap focus
- ESC key closes modal (calls onCancel)
- Enter key in input submits form
- Tab navigation cycles through modal elements

## Testing Requirements

### Unit Tests

#### Server-Side

**Location**: `firebase/functions/src/__tests__/unit/services/FirestoreWriter.test.ts`

```typescript
describe('updateGroupMemberDisplayName', () => {
    it('should update member display name successfully', async () => {
        // Test successful update
    });

    it('should throw error if name is already taken', async () => {
        // Test conflict detection
    });

    it('should throw error if group not found', async () => {
        // Test group validation
    });

    it('should allow same name for same user (idempotent)', async () => {
        // Test user can keep their current name
    });
});
```

**Location**: `firebase/functions/src/__tests__/unit/groups/handlers.test.ts`

```typescript
describe('PATCH /groups/:groupId/members/me/display-name', () => {
    it('should update display name for authenticated member', async () => {
        // Test successful API call
    });

    it('should return 409 if name is taken', async () => {
        // Test conflict response
    });

    it('should return 403 if user is not a member', async () => {
        // Test authorization
    });

    it('should validate display name length', async () => {
        // Test validation
    });
});
```

#### Client-Side

**Location**: `webapp-v2/src/__tests__/unit/playwright/display-name-conflict-modal.test.ts`

```typescript
test.describe('DisplayNameConflictModal', () => {
    test('should show conflict message', async ({ page }) => {
        // Test modal displays conflict info
    });

    test('should submit new display name', async ({ page }) => {
        // Test form submission
    });

    test('should show error if name still taken', async ({ page }) => {
        // Test retry with different name
    });

    test('should allow cancel', async ({ page }) => {
        // Test cancel flow
    });
});
```

### Integration Tests

**Location**: `firebase/functions/src/__tests__/integration/groups.test.ts`

```typescript
describe('Group Display Names Integration', () => {
    it('should detect conflict when joining with duplicate name', async () => {
        // Test join flow with conflict
    });

    it('should prevent race condition with concurrent name updates', async () => {
        // Test transaction isolation
    });

    it('should update display name in all group contexts', async () => {
        // Test name propagation
    });
});
```

### E2E Tests

**Location**: `e2e-tests/src/tests/normal-flow/group-display-names.e2e.test.ts`

```typescript
authenticatedPageTest.describe('Group Display Names', () => {
    authenticatedPageTest(
        'should handle display name conflict on join',
        async ({ authenticatedPage, dashboardPage }) => {
            // Create group with user A
            // User B joins with same name
            // Verify conflict modal appears
            // User B chooses new name
            // Verify success
        }
    );

    authenticatedPageTest(
        'should allow changing display name in settings',
        async ({ authenticatedPage, groupDetailPage }) => {
            // Navigate to group settings
            // Change display name
            // Verify update in UI
        }
    );

    authenticatedPageTest(
        'should show error when choosing taken name',
        async ({ authenticatedPage, groupDetailPage }) => {
            // Try to change to existing member's name
            // Verify error message
            // Change to unique name
            // Verify success
        }
    );
});
```

**Location**: `e2e-tests/src/tests/edge-cases/group-display-names-race.e2e.test.ts`

```typescript
multiUserTest(
    'should prevent duplicate names with concurrent updates',
    async ({ authenticatedPage, secondUser }) => {
        // Both users try to change to same name simultaneously
        // Verify only one succeeds
        // Other gets conflict error
    }
);

multiUserTest(
    'should propagate display name changes in real-time',
    async ({ authenticatedPage, secondUser }) => {
        const { page: alicePage, user: alice } = authenticatedPage;
        const { page: bobPage, user: bob } = secondUser;

        // Alice creates group
        const groupId = await alicePage.dashboardPage.createGroupAndNavigate('Test Group');

        // Bob joins group
        const inviteCode = await alicePage.groupDetailPage.getInviteCode();
        await bobPage.goto(`/join?code=${inviteCode}`);
        await bobPage.joinGroupPage.joinGroup(inviteCode);

        // Alice changes her display name
        await alicePage.groupDetailPage.updateDisplayName('Alice Updated');

        // Bob should see Alice's new name in real-time (no page refresh)
        await expect(bobPage.getByText('Alice Updated')).toBeVisible({ timeout: 3000 });

        // Verify old name is no longer visible
        await expect(bobPage.getByText(alice.displayName)).not.toBeVisible();
    }
);
```

## Validation Rules

### Display Name Requirements

- **Length**: 1-50 characters
- **Uniqueness**: Must be unique within group (case-sensitive)
- **Trimming**: Leading/trailing whitespace removed
- **Required**: Cannot be empty or whitespace-only

### Error Codes

- `DISPLAY_NAME_TAKEN` (409): Name already in use in this group
- `GROUP_NOT_FOUND` (404): Group does not exist
- `INVALID_REQUEST` (400): Validation failed
- `FORBIDDEN` (403): User is not a member

## Implementation Order

1. **Backend Foundation** (Day 1) ✅ COMPLETED
   - [x] Update shared types (`GroupMemberDTO`, `JoinGroupResponse`, `UpdateDisplayNameRequest`)
   - [x] Add validation schemas to shared package (`UpdateDisplayNameRequestSchema`)
   - [x] Update Firestore schema (`GroupMemberDocumentSchema`)
   - [x] Implement `updateGroupMemberDisplayName` in `FirestoreWriter`
   - [x] Add API endpoint handler in `groups/handlers.ts`
   - [x] Add API route in `index.ts`
   - [ ] Update Firebase Security Rules
   - [x] Write unit tests for FirestoreWriter
   - [ ] Write unit tests for API handler

2. **Join Flow Conflict Detection** (Day 1-2) ✅ COMPLETED
   - [x] Update `joinGroup` handler to detect conflicts
   - [x] Update join response to include `displayNameConflict` flag
   - [x] Write unit tests for join flow (3 tests added to GroupShareService.test.ts)
   - [x] Test conflict detection logic

3. **Client API Integration** (Day 2)
   - [ ] Add response schemas to `apiSchemas.ts` (`JoinGroupResponseSchema`, `MessageResponseSchema`)
   - [ ] Add `updateGroupMemberDisplayName` method to `apiClient`
   - [ ] Create `DisplayNameConflictModal` component with accessibility attributes
   - [ ] Update `JoinGroupPage` with conflict handling
   - [ ] Implement cancel behavior (allow navigation with undefined groupDisplayName)
   - [ ] Write Playwright unit tests for modal

4. **Settings UI** (Day 2-3)
   - [ ] Create `GroupDisplayNameSettings` component with accessibility
   - [ ] Decide on integration location (inline vs. separate settings page)
   - [ ] Add to group detail page or create settings page
   - [ ] Wire up update flow with proper error handling
   - [ ] Add loading states

5. **UI Updates** (Day 3)
   - [ ] Create `getGroupDisplayName` helper in `utils/displayName.ts`
   - [ ] Update `GroupDetailPage.tsx` - member list
   - [ ] Update `ExpenseForm.tsx` - payer/split selection
   - [ ] Update `ExpenseCard.tsx` - expense display
   - [ ] Update `SettlementCard.tsx` - settlement display
   - [ ] Update `BalanceSummary.tsx` - balance display
   - [ ] Update `CommentsList.tsx` - comment authors
   - [ ] Test visual consistency across all pages

6. **Testing & Polish** (Day 3-4)
   - [ ] Write E2E tests for join conflict flow
   - [ ] Write E2E tests for settings update flow
   - [ ] Write E2E test for real-time propagation (multi-user)
   - [ ] Write E2E test for race condition prevention
   - [ ] Test keyboard navigation in modals
   - [ ] Test error states and validation
   - [ ] Verify accessibility attributes with screen reader
   - [ ] Final QA pass

## Migration Notes

**NO DATA MIGRATION REQUIRED** - This is a new feature on a new app.

- Existing users will have `groupDisplayName` as `undefined`
- UI helper function (`getGroupDisplayName`) falls back to global `displayName`
- Gradual adoption: users can update display names as needed
- No breaking changes to existing functionality

## Performance Considerations

- **Transaction Cost**: Display name updates use transactions - acceptable for infrequent operation
- **Read Optimization**: Group display names stored denormalized in `members` array for fast reads
- **No Additional Queries**: All data available in existing group document reads

## Future Enhancements (Out of Scope)

- Display name history/audit log
- Custom avatars per group
- Display name suggestions on conflict
- Bulk rename notifications
- Display name validation against profanity list

## Success Criteria

### Core Functionality
- [x] Users can set group-specific display names (backend implemented)
- [x] Display names are unique within each group (enforced server-side with transactions)
- [x] Conflicts detected and handled gracefully during join flow (server-side logic complete)
- [ ] Cancel behavior allows users to defer naming (fallback to global displayName) - UI not yet implemented
- [ ] All UI contexts show group display names correctly via `getGroupDisplayName()` helper - UI not yet implemented

### Security & Validation
- [ ] Firebase Security Rules prevent unauthorized display name updates - NOT YET IMPLEMENTED
- [x] Request validation using Zod schemas from shared package
- [ ] Response validation in API client - API client not yet updated
- [x] Race conditions prevented via transactions

### Real-Time & UX
- [ ] Display name changes propagate in real-time to all group members - Ready (existing onSnapshot listeners will handle)
- [ ] Loading states shown during updates - UI not yet implemented
- [ ] Error messages use proper semantic attributes (`role="alert"`) - UI not yet implemented
- [ ] Modals meet accessibility standards (ARIA labels, keyboard navigation) - UI not yet implemented

### Testing
- [x] Unit tests for FirestoreWriter transaction logic (FirestoreWriter.test.ts)
- [ ] Unit tests for API endpoint validation - NOT YET WRITTEN
- [x] Unit tests for conflict detection (GroupShareService.test.ts - 3 test cases added)
- [ ] Integration tests for race conditions - NOT YET WRITTEN
- [ ] E2E tests for join flow, settings flow, and multi-user real-time propagation - NOT YET WRITTEN
- [ ] Accessibility testing with keyboard navigation - NOT YET WRITTEN

### Technical Quality
- [x] Zero data migration required (new feature, uses optional field)
- [x] Performance impact negligible (transactions acceptable for infrequent operation)
- [x] No breaking changes to existing functionality (optional field added)
- [x] Code follows project patterns (DTOs, shared types, semantic styling)
