# Account Merging Feature

This document outlines a plan for implementing a feature that allows users to merge two of their accounts.

## 1. User Flow

1.  **Initiate Merge:** The user starts the merge process from the account they want to keep (the **primary account**). This will be done from a new section in the user's profile settings.
2.  **Enter Credentials:** The user will be prompted to enter the email and password for the account they want to merge and close (the **secondary account**).
3.  **Confirmation:** The user will be shown a confirmation dialog explaining that the merge is irreversible and that the secondary account will be deleted.
4.  **Merge Process:** After confirmation, the merge process will start in the background. The user will be notified once the merge is complete.

## 2. Technical Implementation

The account merging process will be implemented as a long-running background job using **Cloud Tasks** to avoid Cloud Function timeouts and to ensure the process is resilient.

### 2.1. High-Level Architecture

1.  **API Endpoint (HTTP Cloud Function):** A new `POST /user/merge` endpoint will be created. This function will be responsible for:
    *   Authenticating the user and confirming they are logged into the primary account.
    *   Validating the credentials of the secondary account.
    *   Creating a `merge-job` document in a new `accountMerges` collection in Firestore.
    *   Enqueuing a task in a new Cloud Tasks queue (`account-merge-queue`).

2.  **Task Handler (Cloud Function):** A new Cloud Function will be triggered by messages in the `account-merge-queue`. This function will be responsible for executing the actual data migration.

3.  **Firestore `accountMerges` Collection:** This collection will store the state of each merge job. A document in this collection will look like this:

    ```json
    {
      "primaryAccountId": "uid-of-primary-account",
      "secondaryAccountId": "uid-of-secondary-account",
      "status": "pending" | "in_progress" | "completed" | "failed",
      "progress": {
        "users": "pending" | "completed",
        "groupMemberships": "pending" | "in_progress" | "completed",
        "expenses": "pending" | "in_progress" | "completed",
        "settlements": "pending" | "in_progress" | "completed",
        "comments": "pending" | "in_progress" | "completed",
        "activityFeed": "pending" | "in_progress" | "completed",
        "authDeletion": "pending" | "completed"
      },
      "processedDocuments": {
        "collectionName": ["docId1", "docId2"]
      },
      "secondaryAccountLocked": false,
      "createdAt": "timestamp",
      "updatedAt": "timestamp",
      "error": "error message if the job failed"
    }
    ```

### 2.2. Detailed Merge Process

The task handler function will process the merge in a series of steps, updating the `merge-job` document as it progresses.

1.  **Lock Secondary Account:**
    *   Set custom claim `accountLocked: true` on the secondary Firebase Auth user
    *   Update `mergeJob.secondaryAccountLocked = true`
    *   Authentication middleware checks this claim and rejects authentication attempts

2.  **Merge Firestore `users` document:**
    *   Read the `users` documents for both the primary and secondary accounts.
    *   Merge the data. For most fields, the value from the primary account will be kept. For fields like `acceptedPolicies`, the two sets of policies will be merged (array union).
    *   Update the primary account's `users` document.

3.  **Migrate Group Memberships:**
    *   Find all groups the secondary account is a member of.
    *   For each group:
        *   If the primary account is already a member, delete the secondary account's membership (primary role always wins).
        *   If the primary account is not a member, create a new membership document with ID `{primaryId}_{groupId}` copying all data from the secondary membership but updating the `uid` field to primaryId.
        *   Delete the secondary membership document `{secondaryId}_{groupId}`.
    *   **Critical:** Cannot just update the `uid` field because document IDs are compound keys (`{userId}_{groupId}`). Must create new documents with correct IDs.

4.  **Migrate User-Owned Data:**
    *   This is the most critical and potentially time-consuming part. We need to identify all collections where the `userId` is used as a foreign key and update it to the primary account's `uid`.
    *   Based on the codebase audit, the following collections will need to be updated:
        *   `expenses` - 4 user reference fields: `createdBy`, `paidBy`, `participants[]`, `splits[].uid`
        *   `settlements` - 3 user reference fields: `payerId`, `payeeId`, `createdBy`
        *   `comments` - 1 user reference field: `authorId` (in subcollections under groups and expenses)
        *   `activity-feed` - 3 user reference fields: `userId`, `actorId`, `details.targetUserId` (in subcollections)
    *   The task handler will process these updates in batches of 500 documents to avoid timeouts.
    *   For each batch, it will query for a set of documents, update them, track processed document IDs for idempotency, and update the checkpoint.

5.  **Delete Secondary Account:**
    *   Once all data has been migrated, the final step is to delete the secondary account from Firebase Auth.
    *   The secondary account's `users` document in Firestore should also be deleted.

6.  **Update Job Status:**
    *   After the secondary account is deleted, the `merge-job` document is marked as `completed`.

### 2.3. Error Handling and Retries

*   Cloud Tasks provides automatic retries, which will make the process resilient to transient errors.
*   Every step must be idempotent and checkpointed because Cloud Tasks retries will re-run the function until it succeeds or the retry window expires.
*   Persist per-stage progress so retries resume at the next unfinished stage instead of reprocessing everything.
*   Keep operations idempotent (mutations must be safe to repeat) and guard each write by reading current state first or recording processed document IDs.
*   If a non-recoverable error occurs, the job will be marked as `failed` in the `accountMerges` collection, and the error will be logged. A manual intervention might be required to fix the state.

## 3. Security Considerations

*   **Ownership Verification:** The user must provide the password for the secondary account to prove ownership. This will be done using the existing `FirebaseAuthService.verifyPassword()` method located at `firebase/functions/src/services/auth/FirebaseAuthService.ts:429-505`.
*   **Irreversible Action:** The user must be clearly warned that the merge is irreversible and will result in the deletion of the secondary account.
*   **Rate Limiting:** The `POST /user/merge` endpoint should be rate-limited to prevent abuse (recommended: max 1 merge per user per hour).

## 4. Future Enhancements

*   **Firebase Account Linking:** Attempt Firebase account linking before falling back to the merge-by-ID-replacement workflow.
*   **Admin Tool:** An admin tool could be built to allow support staff to monitor the status of merge jobs and to manually intervene if a job fails.
*   **Undo Functionality:** While the merge is described as irreversible, it might be possible to implement a limited "undo" functionality by creating a backup of the secondary account's data before the merge. This would add significant complexity and is not recommended for the initial implementation.
*   **Dry Run Mode:** Preview what will be merged before committing.
*   **Selective Merge:** Choose which data to transfer.
*   **Progress Notifications:** Email/SMS when merge completes.

## 5. Codebase Analysis & Implementation Details

### 5.1 Complete Firestore Schema Audit ✅

**Collections Requiring User ID Migration (7 total):**

#### 5.1.1 `users` Collection
**Location:** `firebase/functions/src/schemas/user.ts`
**Document ID:** `{userId}`

**Merge Strategy:**
- Read both `users/{primaryId}` and `users/{secondaryId}`
- Union `acceptedPolicies[]` arrays
- Keep all other fields from primary account
- Update `users/{primaryId}` with merged data
- Delete `users/{secondaryId}`

**Conflict Resolution:** Primary account values win for all fields except `acceptedPolicies` which are merged (array union).

#### 5.1.2 `group-memberships` Collection ⚠️ CRITICAL
**Location:** `firebase/functions/src/schemas/group-membership.ts`
**Document ID:** `{userId}_{groupId}` (compound key)

**Schema Fields:**
```typescript
{
    uid: UserIdSchema,
    groupId: string,
    memberRole: 'ADMIN' | 'MEMBER',
    memberStatus: 'ACTIVE' | 'PENDING' | 'INVITED',
    joinedAt: Timestamp,
    theme: UserThemeColorSchema,
    invitedBy?: UserIdSchema,
    groupDisplayName: string,
    groupUpdatedAt: Timestamp,
    createdAt: Timestamp,
    updatedAt: Timestamp,
}
```

**Merge Strategy:**
1. Query all memberships where `uid == secondaryId`
2. For each secondary membership:
   - Check if `group-memberships/{primaryId}_{groupId}` exists
   - **If primary already member:** Delete secondary membership (primary role wins per user decision)
   - **If primary not member:** Create new document `{primaryId}_{groupId}` with:
     - Copy all fields from secondary membership
     - Update `uid` to primaryId
     - Keep original `joinedAt`, `invitedBy`, etc.
3. Delete all `group-memberships/{secondaryId}_{groupId}` documents

**⚠️ Critical Note:** Cannot just update the `uid` field! Document IDs are compound keys (`{userId}_{groupId}`), so we must:
- Create NEW documents with correct compound IDs
- Copy all data
- Delete old documents

**Security Rules Impact:** Rules use `group-memberships/{userId}_{groupId}` pattern for access control. After creating new membership documents, security rules automatically work with primary userId. No rule changes needed.

#### 5.1.3 `expenses` Collection
**Location:** `firebase/functions/src/schemas/expense.ts`

**Fields with User References (4 total):**
```typescript
{
    createdBy: UserIdSchema,           // Field 1
    paidBy: UserIdSchema,              // Field 2
    participants: z.array(UserIdSchema), // Field 3
    splits: z.array({                   // Field 4
        uid: UserIdSchema,
        amount: number,
        percentage: number
    })
}
```

**Merge Strategy:**
- Query all expenses where ANY of the 4 fields match secondaryId
- Process in batches of 500 documents
- For each expense, replace secondaryId with primaryId in all 4 locations
- Use Firestore batch writes for atomicity
- Track processed document IDs for idempotency

#### 5.1.4 `settlements` Collection
**Location:** `firebase/functions/src/schemas/settlement.ts`

**Fields with User References (3 total):**
```typescript
{
    payerId: UserIdSchema,    // Field 1
    payeeId: UserIdSchema,    // Field 2
    createdBy: UserIdSchema,  // Field 3
}
```

**Merge Strategy:**
- Query all settlements where ANY of the 3 fields match secondaryId
- Process in batches of 500 documents
- Replace secondaryId with primaryId in all 3 locations
- Track processed document IDs

#### 5.1.5 `comments` Collection (Subcollections)
**Location:** `firebase/functions/src/schemas/comment.ts`

**Structure:**
- `groups/{groupId}/comments/{commentId}`
- `expenses/{expenseId}/comments/{commentId}`

**Schema:**
```typescript
{
    authorId: z.string(),  // User reference
    content: string,
    createdAt: Timestamp,
    updatedAt: Timestamp,
}
```

**Merge Strategy:**
- Use Firestore collection group query to find all comments across all subcollections
- Query: `collectionGroup('comments').where('authorId', '==', secondaryId)`
- Process in batches of 500
- Update `authorId` field
- Track processed document IDs

#### 5.1.6 `activity-feed` Collection (Subcollections)
**Location:** `firebase/functions/src/schemas/activity-feed.ts`

**Structure:**
- `activity-feed/{userId}/items/{itemId}`

**Fields with User References (3 total):**
```typescript
{
    userId: z.string(),                    // Field 1
    actorId: z.string(),                   // Field 2
    details: {
        targetUserId?: z.string(),         // Field 3
        // ... other fields
    }
}
```

**Merge Strategy:**
1. **Migrate secondary user's activity feed:**
   - Query all documents: `activity-feed/{secondaryId}/items`
   - Create copies in: `activity-feed/{primaryId}/items`
   - Update `userId` to primaryId
   - Delete original documents

2. **Update activity where secondary is the actor:**
   - Collection group query: `collectionGroup('items').where('actorId', '==', secondaryId)`
   - Update `actorId` to primaryId

3. **Update activity where secondary is the target:**
   - Collection group query: `collectionGroup('items').where('details.targetUserId', '==', secondaryId)`
   - Update `details.targetUserId` to primaryId

Process in batches of 500 documents per operation.

#### 5.1.7 Summary - No Other Collections
**Verified clean:**
- `groups/{groupId}` - No direct user references
- `policies/{policyId}` - Policy definitions, no user data
- `tenants/{tenantId}` - Tenant configuration, no user data
- `share-link-tokens/{tokenId}` - Tokens for group invites, no user references

### 5.2 Existing Authentication Infrastructure ✅

**Password Verification (READY TO USE):**
- **Location:** `firebase/functions/src/services/auth/FirebaseAuthService.ts:429-505`
- **Method:** `verifyPassword(email: Email, password: string): Promise<boolean>`
- Uses Firebase Identity Toolkit API: `/v1/accounts:signInWithPassword`
- Already implemented and tested - perfect for secondary account ownership verification

**Authentication Middleware:**
- **Location:** `firebase/functions/src/auth/middleware.ts`
- **Method:** `authenticate()` - attaches `req.user` with Firebase Auth user
- Pattern to follow: Add to merge endpoint route config

**User Management Operations:**
- `deleteUser(uid)` - available for deleting secondary account
- Comprehensive error handling via `mapFirebaseError()`
- Logging with correlation IDs

**Decision: Skip Firebase Account Linking ✅**
- No existing `linkWithCredential` patterns in codebase
- User preference: "delete one firebase account and keep the other, then merge the data in firestore"
- Direct merge-by-ID-replacement is simpler and more predictable
- Can be added as future enhancement if needed

### 5.3 Cloud Tasks - New Pattern for Codebase ⚠️

**Current State:** No Cloud Tasks usage found in codebase - this will establish a new pattern

**Implementation Required:**
```typescript
// firebase/functions/src/merge/MergeTaskHandler.ts
import { onTaskDispatched } from 'firebase-functions/v2/tasks';

export const accountMergeTaskHandler = onTaskDispatched(
    {
        retryConfig: {
            maxAttempts: 5,
            maxBackoffSeconds: 3600,
        },
        rateLimits: {
            maxConcurrentDispatches: 1,
        },
        region: 'us-central1',
        memory: '1GiB',
        timeoutSeconds: 540, // 9 minutes
    },
    async (req) => {
        // Task handling logic with checkpointing
    }
);
```

### 5.4 HTTP Endpoint Patterns to Follow ✅

**Route Configuration:**
- **Location:** `firebase/functions/src/routes/route-config.ts`
- Pattern: Centralized route definitions with middleware

```typescript
{
    method: 'POST',
    path: '/user/merge',
    handlerName: 'initiateMerge',
    category: 'user',
    middleware: ['authenticate'],
},
{
    method: 'GET',
    path: '/user/merge/:jobId',
    handlerName: 'getMergeStatus',
    category: 'user',
    middleware: ['authenticate'],
}
```

**Handler Pattern:**
- **Location:** `firebase/functions/src/user/UserHandlers.ts` (reference example)
- Create: `firebase/functions/src/merge/MergeHandlers.ts`
- Class-based with dependency injection
- Authenticated requests get `req.user.uid` for primary account

**Error Handling:**
- **Location:** `firebase/functions/src/utils/errors.ts`
- Use `ApiError` class with appropriate status codes

### 5.5 UI Integration Points ✅

**Settings Page:**
- **Location:** `webapp-v2/src/pages/SettingsPage.tsx`
- Current features: Display name, password change, email change
- Pattern: Collapsible forms for sensitive operations
- Add new section after email change (line ~248)

**Existing UI Pattern to Follow:**
- Collapsible form with show/hide state
- Requires confirmation for destructive actions
- Success/error messages with auto-clear (5 seconds)
- Form validation before API calls

**API Client:**
- **Location:** `webapp-v2/src/app/apiClient.ts`
- Add methods: `mergeAccount()` and `getMergeStatus()`

### 5.6 Testing Infrastructure ✅

**Integration Test Pattern:**
- **Location:** `firebase/functions/src/__tests__/integration/`
- Uses Firebase emulator suite
- Pattern: `ApiDriver` for HTTP calls, `TestUserBuilder` for test data
- **Command:** `./run-test.sh firebase/merge "should merge accounts"`

**Test Requirements:**
- Builder pattern mandatory for all test data
- No flaky tests - poll for conditions, never timeouts
- Test isolation - no dependencies between tests

## 6. Implementation Plan

### Phase 1: Backend Core (Priority: HIGH)

#### Step 1.1: Create Schemas & Types
**File:** `firebase/functions/src/schemas/merge.ts` (NEW)

Define Zod schemas for:
- `MergeAccountRequestSchema` - request payload validation
- `MergeJobProgressSchema` - per-stage progress tracking
- `MergeJobDocumentSchema` - merge job state in Firestore

#### Step 1.2: Update Firestore Constants
**File:** `firebase/functions/src/constants.ts`

Add `ACCOUNT_MERGES: 'accountMerges'` to `FirestoreCollections`.

#### Step 1.3: Implement Merge Service
**File:** `firebase/functions/src/merge/MergeService.ts` (NEW)

**Key Methods:**
- `initiateMerge(primaryUserId, secondaryEmail, secondaryPassword): Promise<string>` - Validates credentials, creates job document, enqueues Cloud Tasks job, returns jobId
- `getMergeStatus(jobId, requestingUserId): Promise<MergeJobDocument>` - Retrieves job status with access control

#### Step 1.4: Create HTTP Handlers
**File:** `firebase/functions/src/merge/MergeHandlers.ts` (NEW)

Class-based handlers following existing pattern in `UserHandlers.ts`.

#### Step 1.5: Update Route Configuration
**File:** `firebase/functions/src/routes/route-config.ts`

Add POST /user/merge and GET /user/merge/:jobId routes.

#### Step 1.6: Implement Cloud Tasks Handler ⭐ CORE LOGIC
**File:** `firebase/functions/src/merge/MergeTaskHandler.ts` (NEW)

**Processing Stages (Idempotent & Checkpointed):**

1. **Lock Secondary Account** - Set custom claim `accountLocked: true`
2. **Merge Users Documents** - Union `acceptedPolicies`, keep primary values for other fields
3. **Process Group Memberships** - Create new docs with correct compound IDs, delete secondary memberships
4. **Update Expenses Collection** - Batch update 4 user reference fields (500/batch)
5. **Update Settlements Collection** - Batch update 3 user reference fields (500/batch)
6. **Update Comments Subcollections** - Collection group query, batch update (500/batch)
7. **Migrate Activity Feed** - Move items, update user references (500/batch)
8. **Delete Secondary Account** - Delete Firebase Auth user and Firestore document
9. **Complete Job** - Set status = 'completed'

**Idempotency Pattern:** Each stage checks if already completed before executing. Track processed document IDs to avoid duplicate processing on retry.

#### Step 1.7: Export New Cloud Function
**File:** `firebase/functions/src/index.ts`

```typescript
export { accountMergeTaskHandler } from './merge/MergeTaskHandler';
```

### Phase 2: Frontend Integration (Priority: MEDIUM)

#### Step 2.1: Add API Client Methods
**File:** `webapp-v2/src/app/apiClient.ts`

```typescript
async mergeAccount(secondaryEmail: string, secondaryPassword: string): Promise<{ jobId: string }>
async getMergeStatus(jobId: string): Promise<MergeJobDocument>
```

#### Step 2.2: Create Merge Progress Component
**File:** `webapp-v2/src/components/MergeProgressDisplay.tsx` (NEW)

- Poll `getMergeStatus` every 2 seconds
- Display progress bar based on completed stages
- Show success/error messages
- Handle completion/failure states

#### Step 2.3: Update Settings Page
**File:** `webapp-v2/src/pages/SettingsPage.tsx`

Add collapsible merge form section after email change (line ~248):
- Secondary email/password inputs
- Strong warning about irreversibility
- Confirmation checkbox required
- Submit triggers merge, shows progress polling

#### Step 2.4: Add Translations
**Files:** `webapp-v2/src/locales/*/translation.json`

Add translation keys for all merge UI strings.

### Phase 3: Testing (Priority: HIGH)

#### Step 3.1: Unit Tests
**File:** `firebase/functions/src/__tests__/unit/merge/MergeService.test.ts` (NEW)

Test cases:
- Request validation (email format, password length)
- Same account rejection
- Existing merge job detection
- Conflict resolution (acceptedPolicies union)
- Idempotency of each stage

#### Step 3.2: Integration Tests
**File:** `firebase/functions/src/__tests__/integration/account-merge.test.ts` (NEW)

Test cases:
1. Successful merge with no overlaps - verify all 7 collections updated
2. Merge with duplicate group memberships - verify primary role preserved
3. Merge with complex expense data - verify all 4 fields updated correctly
4. Activity feed migration - verify items moved and user references updated
5. Secondary account locked during merge - verify authentication fails
6. Partial failure recovery - verify idempotent retry from checkpoint

**Test Execution:**
```bash
./run-test.sh firebase/merge "should merge accounts successfully"
./run-test.sh firebase/merge "should handle duplicate memberships"
./run-test.sh firebase/merge "should recover from partial failure"
```

### Phase 4: Deployment & Configuration (Priority: MEDIUM)

#### Step 4.1: Create Cloud Tasks Queue

```bash
gcloud tasks queues create account-merge-queue \
    --location=us-central1 \
    --max-dispatches-per-second=1 \
    --max-concurrent-dispatches=1 \
    --max-attempts=5 \
    --max-retry-duration=3600s \
    --min-backoff=60s \
    --max-backoff=3600s \
    --project=YOUR_PROJECT_ID
```

#### Step 4.2: Deploy Cloud Functions

```bash
cd firebase/functions
npm run build
firebase deploy --only functions:accountMergeTaskHandler
firebase deploy --only functions:api
```

#### Step 4.3: Add Rate Limiting (Optional but Recommended)

Consider adding rate limit:
- Max 1 merge per user per hour
- Implement using Firestore query in `MergeService.initiateMerge()`
- Check for recent merge jobs before creating new one

#### Step 4.4: Set Up Monitoring & Alerts

**Cloud Logging Queries:**
- Failed merge jobs: `resource.type="cloud_function" resource.labels.function_name="accountMergeTaskHandler" severity="ERROR"`
- Long-running merges: `jsonPayload.duration>1800000`

**Alerting Policies:**
1. Alert when merge job fails (status = 'failed')
2. Alert when merge takes >30 minutes
3. Alert when >10 merge requests in 1 hour (possible abuse)

#### Step 4.5: Documentation

**Create:** `docs/features/account-merging.md` with:
- Feature overview
- User guide for initiating merges
- Technical implementation details
- Troubleshooting guide
- Manual intervention procedures for failed merges

**Create:** `docs/runbooks/account-merge-recovery.md` with:
- Steps for investigating failed merges
- How to identify which stage failed
- Manual recovery procedures
- Common failure scenarios and solutions

## 7. Key Implementation Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Account Linking** | Skip, use direct merge | User preference ("delete one firebase account and keep the other"), simpler implementation |
| **Duplicate Memberships** | Primary role wins | User preference, predictable behavior |
| **Batch Size** | 500 documents | Max Firestore batch write size |
| **Account Locking** | Lock secondary only | Balance safety and usability, primary user continues normal operation |
| **Retry Strategy** | 5 attempts, exponential backoff | Standard Cloud Tasks pattern, handles transient failures |
| **Checkpointing** | Per-stage tracking | Enables idempotent retries, avoids reprocessing completed stages |
| **Rollback** | None (manual only) | Too complex for v1, failed merges require manual intervention |

## 8. Files to Create/Modify

### Files to Create (NEW)

**Backend:**
1. `firebase/functions/src/schemas/merge.ts` - Schemas & types
2. `firebase/functions/src/merge/MergeService.ts` - Service layer
3. `firebase/functions/src/merge/MergeHandlers.ts` - HTTP handlers
4. `firebase/functions/src/merge/MergeTaskHandler.ts` - Cloud Tasks handler

**Frontend:**
5. `webapp-v2/src/components/MergeProgressDisplay.tsx` - Progress UI
6. `webapp-v2/src/types/merge.ts` - TypeScript types (optional, can use generated types)

**Tests:**
7. `firebase/functions/src/__tests__/unit/merge/MergeService.test.ts`
8. `firebase/functions/src/__tests__/integration/account-merge.test.ts`

**Documentation:**
9. `docs/features/account-merging.md` - Feature documentation
10. `docs/runbooks/account-merge-recovery.md` - Recovery procedures

### Files to Modify (EXISTING)

1. `firebase/functions/src/constants.ts` - Add ACCOUNT_MERGES collection constant
2. `firebase/functions/src/routes/route-config.ts` - Add merge routes
3. `firebase/functions/src/index.ts` - Export task handler function
4. `webapp-v2/src/app/apiClient.ts` - Add API client methods
5. `webapp-v2/src/pages/SettingsPage.tsx` - Add merge UI section
6. `webapp-v2/src/locales/*/translation.json` - Add translation strings

## 9. Testing Checklist

### Unit Tests
- [ ] Request validation (email format, password length)
- [ ] Same account rejection
- [ ] Duplicate merge detection
- [ ] acceptedPolicies merging logic (array union)
- [ ] Stage idempotency (skip already completed stages)

### Integration Tests
- [ ] Full merge with no overlaps - both users have separate groups
- [ ] Duplicate membership handling - both users in same group, primary role preserved
- [ ] All 7 collections updated correctly
- [ ] Expense field updates (all 4 fields: createdBy, paidBy, participants, splits)
- [ ] Settlement field updates (all 3 fields: payerId, payeeId, createdBy)
- [ ] Comment author updates (subcollections under groups and expenses)
- [ ] Activity feed migration (items moved, user references updated)
- [ ] Secondary account deletion (Firebase Auth and Firestore)
- [ ] Partial failure recovery (retry resumes from checkpoint)
- [ ] Account locking during merge (secondary account auth fails)

### Manual Testing
- [ ] UI flow end-to-end (initiate merge from settings page)
- [ ] Progress display updates correctly (poll status, show percentage)
- [ ] Error handling works (invalid credentials, same account, etc.)
- [ ] Rate limiting prevents abuse (second merge attempt blocked)
- [ ] Security rules work after merge (group access, expense visibility)
- [ ] Group access preserved (primary can see merged groups)
- [ ] Expense visibility correct (primary sees all merged expenses)

## 10. Deployment Checklist

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Cloud Tasks queue created in GCP
- [ ] Cloud Functions deployed (accountMergeTaskHandler and api)
- [ ] Frontend deployed (webapp-v2)
- [ ] Translations complete (all locales)
- [ ] Monitoring alerts configured (failed jobs, long-running jobs)
- [ ] Documentation written (feature guide and runbook)
- [ ] Manual test completed successfully
- [ ] Security review passed (credential verification, access control)
- [ ] Performance test passed (large account merge with 1000+ expenses)

## 11. Future Enhancements

1. **Firebase Account Linking** - Attempt Firebase `linkWithCredential()` before merge fallback
2. **Undo Functionality** - Limited-time backup & restore capability (complex, requires snapshot storage)
3. **Admin Tools** - Support dashboard for monitoring merge jobs and manual intervention
4. **Progress Notifications** - Email/SMS notification when merge completes
5. **Dry Run Mode** - Preview what will be merged before committing (read-only simulation)
6. **Selective Merge** - Choose which data to transfer (groups, expenses, etc.)
7. **Merge Preview** - Show conflicts and data summary before starting merge
