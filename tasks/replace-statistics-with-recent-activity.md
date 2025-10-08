# Feature: Replace Dashboard Statistics with Recent Activity

## Overview

To enhance user engagement and provide more dynamic, relevant information, the current "Statistics" section on the dashboard will be replaced with a "Recent Activity" feed. This feed will give users a real-time overview of important events across all their groups.

## UI/UX Changes

### 1. Removal of Statistics Section

- The existing "Statistics" component and any associated data visualizations will be completely removed from the dashboard view.

### 2. Addition of Recent Activity Section

- A new "Recent Activity" component will be added to the dashboard, likely in the same position as the old statistics section.
- This component will display a chronological, scrollable list of recent events.

### 3. Activity Feed Item Design

Each item in the feed should be designed for clarity and quick scanning. It should include:

- **Actor:** The user who performed the action (e.g., "Alice").
- **Action:** A description of the event (e.g., "added a new expense", "joined the group").
- **Object:** The item that was affected (e.g., "'Groceries'").
- **Context:** The group where the event occurred (e.g., "in 'Weekend Trip'").
- **Timestamp:** A relative time indicating when the event happened (e.g., "5 minutes ago", "yesterday").

### 4. Interaction

- Clicking on an activity item will navigate the user directly to the relevant context. For example:
    - Clicking on a "new expense" activity will navigate to that specific expense's detail page within the group.
    - Clicking on a "user joined" activity will navigate to the group's main page.

## Types of Activities to Display

The feed should include, but is not limited to, the following events:

- A user adds a new expense.
- A user updates an existing expense.
- A user joins a group.
- A user leaves or is removed from a group.
- A settlement or payment is recorded between members.
- A new group is created.
- A group's name or description is updated.

## Backend & API Requirements

- A new Firestore-backed API endpoint will be required to fetch the recent activity feed for the currently authenticated user.
- The endpoint must aggregate activities from all groups the user is a member of.
- It must support pagination (e.g., fetching the last 20 items, with the ability to load more).
- The implementation should be optimized for performance, possibly by creating a top-level `user_activity` collection that duplicates key events, indexed by user ID and timestamp, to avoid complex, slow cross-collection queries.

---

## 📋 What's Missing - Quick Summary

### Backend Components

- [ ] **Activity Data Model** - `ActivityDTO` type definition in `@splitifyd/shared`
- [ ] **Actor Tracking** - `lastModifiedBy` field in `ExpenseDTO`, `SettlementDTO`, `GroupDTO`
- [ ] **Activity Collection** - `user_activity` Firestore collection with proper indexes
- [ ] **Activity Schemas** - Zod validation schemas in `firebase/functions/src/schemas/activity.ts`
- [ ] **ActivityService** - Service layer for activity creation and management
- [ ] **Firestore Methods** - `getActivitiesForUser()`, `createActivity()`, `batchCreateActivities()`
- [ ] **Trigger Updates** - Modify expense/settlement/group triggers to create activities
- [ ] **API Endpoint** - `GET /user/activity` with pagination support

### Frontend Components

- [ ] **Activity Store** - `webapp-v2/src/app/stores/activity-store.ts`
- [ ] **RecentActivity Component** - `webapp-v2/src/components/dashboard/RecentActivity.tsx`
- [ ] **ActivityItem Component** - `webapp-v2/src/components/dashboard/ActivityItem.tsx`
- [ ] **API Schema Validation** - Zod schemas in `webapp-v2/src/api/apiSchemas.ts`
- [ ] **API Client Methods** - `getActivities()` in `apiClient.ts`
- [ ] **Translations** - `recentActivity.*` keys in translation files
- [ ] **Dashboard Integration** - Replace `<DashboardStats />` with `<RecentActivity />`

### Infrastructure

- [ ] **Firestore Indexes** - Composite indexes for `(userId, timestamp DESC)` queries
- [ ] **Cleanup Strategy** - Scheduled function to prune old activities
- [ ] **Performance Monitoring** - Metrics for activity creation and query latency

---

## Implementation Analysis & Plan

### ✅ What's Already in Place (GOOD)

#### 1. **Robust Notification Infrastructure**

- **`user-notifications` collection** tracks change events per user
- **Firestore triggers** automatically create notifications for:
    - Group modifications (`group` type)
    - Expense changes (`transaction` + `balance` types)
    - Settlement changes (`transaction` + `balance` types)
    - Comment additions (`comment` type)
- **Real-time sync system** with timestamps and change counters
- Location: `firebase/functions/src/triggers/change-tracker.ts`, `comment-tracker.ts`

#### 2. **UI Structure Ready**

- `DashboardPage.tsx:105` - Sidebar already has `<DashboardStats />` component
- Translation system (`i18n`) fully configured with `dashboardStats.*` keys
- Responsive layout with mobile/desktop variants

#### 3. **Clean API Architecture**

- REST API with authentication middleware
- ApplicationBuilder pattern for dependency injection
- Proper error handling with `ApiError` class

---

### ❌ What's MISSING (Critical Gaps)

#### 1. **No Activity Feed Data Model**

Current `UserNotificationDocument` only stores:

- ✅ Timestamps of changes
- ✅ Change counters
- ❌ **Actor information** (who performed the action)
- ❌ **Action details** (what specifically was done)
- ❌ **Object context** (which expense/settlement/etc.)
- ❌ **Human-readable descriptions**

#### 2. **No Activity Collection**

- Task suggests `user_activity` collection - **doesn't exist**
- Current approach: derive activities from existing data (expensive at scale)
- No indexes for efficient activity queries

#### 3. **No API Endpoints**

- ❌ `GET /user/activity` endpoint
- ❌ Activity pagination
- ❌ Activity filtering (by group, date range, etc.)

#### 4. **No Frontend Implementation**

- ❌ Activity store/state management
- ❌ `RecentActivity` component
- ❌ Activity item types in `@splitifyd/shared`
- ❌ Activity item UI components

---

### ⚠️ What's BAD (Architectural Issues)

#### 1. **Wrong Purpose for Existing System**

The current notification system is designed for **real-time sync**, not **activity history**:

- Optimized for "something changed, refetch data"
- Minimal storage (just counters + timestamps)
- **Not suitable** for human-readable activity feed

#### 2. **Performance Concerns**

To build activity feed from current data requires:

1. Query `user-notifications` → find which groups changed
2. Query `expenses`, `settlements`, `groups` → find what changed
3. Cross-reference users to get actor names
4. Sort and paginate combined results

This is **O(n) expensive** for users with lots of history.

#### 3. **Missing Actor Tracking**

Triggers know **what changed** but not **who changed it**. Need to:

- Extract `userId` from authenticated request context
- Store actor info with each activity

---

## Implementation Plan

### **Phase 1: Data Model & Backend** (Priority)

#### 1.1 Define Activity Types (`@splitifyd/shared`)

Location: `packages/shared/src/shared-types.ts`

```typescript
export interface ActivityDTO {
    id: string;
    userId: string; // Owner of the activity feed
    groupId: string;
    groupName: string;
    actorId: string;
    actorName: string;
    actorColor?: string;
    actionType: 'expense_created' | 'expense_updated' | 'expense_deleted' | 'settlement_created' | 'user_joined' | 'user_left' | 'user_removed' | 'group_created' | 'group_updated';
    targetType: 'expense' | 'settlement' | 'group' | 'member';
    targetId: string;
    targetName: string; // e.g., expense description, user name
    amount?: { value: number; currency: string };
    timestamp: string; // ISO 8601
    metadata?: Record<string, any>; // Flexible field for action-specific data
}
```

#### 1.2 Add Actor Tracking to Existing DTOs

**Critical Decision**: Add `lastModifiedBy: string` field to:

- `ExpenseDTO` (who created/updated the expense)
- `SettlementDTO` (who recorded the payment)
- `GroupDTO` (who modified group details)
- `GroupMembershipDTO` (who added/removed members)

This enables proper audit trail and activity attribution.

#### 1.3 Create `user_activity` Firestore Collection

- Structure: `/user_activity/{activityId}` (top-level, not subcollection)
- Indexes:
    - `(userId, timestamp DESC)` - primary query pattern
    - `(userId, groupId, timestamp DESC)` - filter by group
- Composite document ID: `{userId}_{timestamp}_{randomId}`

#### 1.4 Update Firestore Schemas

Files to modify:

- `firebase/functions/src/schemas/expense.ts` - add `lastModifiedBy`
- `firebase/functions/src/schemas/settlement.ts` - add `lastModifiedBy`
- `firebase/functions/src/schemas/group.ts` - add `lastModifiedBy`
- Create new `firebase/functions/src/schemas/activity.ts`

#### 1.5 Update FirestoreWriter

Modify `FirestoreWriter` to automatically set `lastModifiedBy` on:

- `createExpense()`, `updateExpense()`
- `createSettlement()`, `updateSettlement()`
- `updateGroup()`

Requires passing `userId` context through service layer.

#### 1.6 Create ActivityService

New file: `firebase/functions/src/services/ActivityService.ts`

Responsibilities:

- Create activity records
- Format human-readable descriptions
- Determine affected users (who should see this activity)
- Batch create activities for multiple users

#### 1.7 Update Triggers to Create Activities

Modify:

- `trackExpenseChanges` → create expense activities
- `trackSettlementChanges` → create settlement activities
- `trackGroupChanges` → create group update activities
- Add new membership change triggers

Extract actor from document's `lastModifiedBy` field.

#### 1.8 Add Firestore Reader/Writer Methods

```typescript
// IFirestoreReader.ts
getActivitiesForUser(
  userId: string,
  options: {
    limit: number;
    cursor?: string;
    groupId?: string
  }
): Promise<PaginatedResult<ActivityDTO[]>>

// IFirestoreWriter.ts
createActivity(
  activity: Omit<ActivityDTO, 'id'>
): Promise<WriteResult>

batchCreateActivities(
  activities: Omit<ActivityDTO, 'id'>[]
): Promise<BatchWriteResult>
```

#### 1.9 Create Activity API Endpoint

New file: `firebase/functions/src/user/activity-handlers.ts`

```typescript
GET /user/activity?limit=20&cursor=xxx&groupId=xxx
```

Response:

```json
{
  "activities": [...],
  "hasMore": true,
  "nextCursor": "abc123"
}
```

---

### **Phase 2: Frontend Implementation**

#### 2.1 Create Activity Store

File: `webapp-v2/src/app/stores/activity-store.ts`

```typescript
class ActivityStoreImpl {
  #activities = signal<ActivityDTO[]>([]);
  #loading = signal(false);
  #error = signal<string | null>(null);
  #hasMore = signal(true);
  #cursor = signal<string | null>(null);

  async fetchActivities(limit = 20) { ... }
  async loadMore() { ... }
  clearActivities() { ... }
}
```

#### 2.2 Create RecentActivity Component

File: `webapp-v2/src/components/dashboard/RecentActivity.tsx`

Features:

- Shows last 10-20 activities
- Loading states (skeleton UI)
- Empty state ("No recent activity")
- Error handling
- Infinite scroll or "Load More" button

#### 2.3 Create ActivityItem Component

File: `webapp-v2/src/components/dashboard/ActivityItem.tsx`

Display:

- Actor avatar with theme color
- Action description (e.g., "Alice added expense 'Groceries'")
- Group context badge
- Relative timestamp ("5 minutes ago")
- Amount display (if applicable)
- Clickable → navigates to relevant page

#### 2.4 Update DashboardPage

```diff
// webapp-v2/src/pages/DashboardPage.tsx
- import { DashboardStats } from '../components/dashboard/DashboardStats';
+ import { RecentActivity } from '../components/dashboard/RecentActivity';

  <div class="space-y-4">
    <div class="hidden lg:block">
      <QuickActionsCard onCreateGroup={() => setIsCreateModalOpen(true)} />
    </div>
-   <DashboardStats />
+   <RecentActivity />
  </div>
```

#### 2.5 Add API Schema Validation

File: `webapp-v2/src/api/apiSchemas.ts`

```typescript
const ActivitySchema = z.object({
  id: z.string(),
  userId: z.string(),
  groupId: z.string(),
  groupName: z.string(),
  actorId: z.string(),
  actorName: z.string(),
  actorColor: z.string().optional(),
  actionType: z.enum([...]),
  targetType: z.enum([...]),
  targetId: z.string(),
  targetName: z.string(),
  amount: z.object({
    value: z.number(),
    currency: z.string()
  }).optional(),
  timestamp: z.string(),
  metadata: z.record(z.any()).optional()
});

export const ActivityListResponseSchema = z.object({
  activities: z.array(ActivitySchema),
  hasMore: z.boolean(),
  nextCursor: z.string().optional()
});
```

#### 2.6 Add Translations

File: `webapp-v2/src/locales/en/translation.json`

```json
{
    "recentActivity": {
        "title": "Recent Activity",
        "noActivity": "No recent activity",
        "loadMore": "Load more",
        "loading": "Loading activities...",
        "loadingMore": "Loading more...",
        "errorLoading": "Failed to load activities",
        "actions": {
            "expense_created": "{{actor}} added expense {{target}}",
            "expense_updated": "{{actor}} updated expense {{target}}",
            "expense_deleted": "{{actor}} deleted expense {{target}}",
            "settlement_created": "{{actor}} recorded payment of {{amount}}",
            "user_joined": "{{actor}} joined the group",
            "user_left": "{{actor}} left the group",
            "user_removed": "{{actor}} was removed from the group",
            "group_created": "{{actor}} created the group",
            "group_updated": "{{actor}} updated group settings"
        },
        "inGroup": "in {{groupName}}"
    }
}
```

---

### **Phase 3: Optimization & Polish**

#### 3.1 Activity Cleanup Strategy

- Keep last 100 activities per user (configurable constant)
- Add scheduled Cloud Function to prune old activities weekly
- Archive to BigQuery for analytics (optional future enhancement)

File: `firebase/functions/src/scheduled/activity-cleanup.ts`

#### 3.2 Performance Monitoring

- Add metrics for activity creation latency
- Monitor activity query performance
- Track activity collection growth rate

#### 3.3 Real-time Updates (Optional Enhancement)

- Subscribe to `user_activity` collection changes
- Update activity feed in real-time as new activities arrive
- Use Firestore `onSnapshot` in activity store

#### 3.4 Activity Deduplication

- Prevent duplicate activities for same event
- Use deterministic IDs: `{userId}_{targetType}_{targetId}_{timestamp}`
- Handle race conditions in triggers

---

## Testing Strategy

### Unit Tests

- **ActivityService**: Activity creation, formatting, user determination
- **Activity handlers**: Request validation, pagination logic
- **Activity store**: State management, loading states

### Integration Tests

- **Activity API endpoint**: CRUD operations, pagination, filtering
- **Activity triggers**: Verify activities created on document changes
- **Multi-user scenarios**: Correct activity distribution

### E2E Tests

- **Dashboard flow**: View activities, click to navigate
- **Activity updates**: Real-time feed updates (if implemented)
- **Pagination**: Load more functionality

---

## Rollout Strategy

### Phase 1: Backend Foundation (Week 1)

- [ ] Add `lastModifiedBy` fields to DTOs and schemas
- [ ] Create ActivityService and activity collection
- [ ] Update triggers to create activities
- [ ] Add API endpoint with tests

### Phase 2: Frontend Implementation (Week 2)

- [ ] Create activity store and components
- [ ] Replace DashboardStats with RecentActivity
- [ ] Add translations
- [ ] E2E tests

### Phase 3: Monitoring & Optimization (Week 3)

- [ ] Activity cleanup scheduled function
- [ ] Performance monitoring
- [ ] Real-time updates (optional)
- [ ] Documentation

---

## Success Metrics

- Dashboard engagement: Time spent on dashboard increases
- Click-through rate: Users navigate from activities to detailed views
- Performance: Activity queries < 100ms p95
- User satisfaction: Positive feedback on activity feed utility

---

## Estimated Effort

- **Phase 1 (Backend)**: 12-16 hours
    - Data model & schemas: 2h
    - Actor tracking implementation: 4h
    - ActivityService: 2h
    - Trigger updates: 3h
    - API endpoint: 2h
    - Tests: 3h

- **Phase 2 (Frontend)**: 8-10 hours
    - Activity store: 2h
    - Components: 4h
    - Integration: 1h
    - Translations: 1h
    - Tests: 2h

- **Phase 3 (Polish)**: 4-6 hours
    - Cleanup strategy: 2h
    - Monitoring: 1h
    - Documentation: 1h
    - E2E tests: 2h

**Total**: 24-32 hours

---

## Open Questions & Decisions

1. **Activity Retention**: How long should we keep activities? (Recommendation: 30 days)
2. **Activity Granularity**: Should we track expense field changes individually? (Recommendation: No, just create/update/delete)
3. **Real-time Updates**: Priority for Phase 3? (Recommendation: Nice-to-have, not critical)
4. **Amount Display**: Show amounts in user's preferred currency or original? (Recommendation: Original currency)

---

## Dependencies & Blockers

- None - all required infrastructure exists
- Requires schema migrations for `lastModifiedBy` fields
- Existing triggers need updates, but no breaking changes
