# Task: Implement Group-Specific Display Names

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
```

#### 4. Display Name Settings Component

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

#### 5. Update UI to Use Group Display Names

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

1. **Backend Foundation** (Day 1)
   - [ ] Update shared types (`GroupMemberDTO`)
   - [ ] Update Firestore schema
   - [ ] Implement `updateGroupMemberDisplayName` in `FirestoreWriter`
   - [ ] Add API endpoint and route
   - [ ] Write unit tests

2. **Join Flow Conflict Detection** (Day 1)
   - [ ] Update `joinGroup` handler to detect conflicts
   - [ ] Update join response type
   - [ ] Write integration tests

3. **Client API Integration** (Day 2)
   - [ ] Add `updateGroupMemberDisplayName` to `apiClient`
   - [ ] Create `DisplayNameConflictModal` component
   - [ ] Update `JoinGroupPage` with conflict handling

4. **Settings UI** (Day 2)
   - [ ] Create `GroupDisplayNameSettings` component
   - [ ] Add to group settings page
   - [ ] Wire up update flow

5. **UI Updates** (Day 3)
   - [ ] Create `getGroupDisplayName` helper
   - [ ] Update all components to use group display names
   - [ ] Test visual consistency

6. **Testing & Polish** (Day 3)
   - [ ] Write E2E tests
   - [ ] Test multi-user scenarios
   - [ ] Test race conditions
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

- [ ] Users can set group-specific display names
- [ ] Display names are unique within each group (enforced server-side)
- [ ] Conflicts detected and handled gracefully during join flow
- [ ] All UI contexts show group display names correctly
- [ ] Race conditions prevented via transactions
- [ ] Comprehensive test coverage (unit, integration, E2E)
- [ ] Zero data migration required
- [ ] Performance impact negligible
