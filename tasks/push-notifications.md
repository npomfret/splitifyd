# Push Notifications (Webapp)

## Objective

Add push notifications for the `webapp-v2` browser client so users can be notified of relevant events (e.g., invites, new expenses, comments) **even when the tab is closed**.

This should complement (not replace) the existing real-time refresh mechanism (Activity Feed + Firestore subscriptions) which currently only updates the UI when the app is open.

---

## User Requirements (Confirmed)

| Requirement | Decision |
|-------------|----------|
| **Platforms** | Desktop web (Chrome/Firefox/Edge/Safari), Android web. **iOS PWA NOT supported** (see Platform Limitations). |
| **Events** | All mutations (expenses, settlements, comments, members) |
| **Deep linking** | Yes - notification click navigates to specific group/expense |
| **Granularity** | Global on/off toggle only (no per-group/per-type controls) |

---

## Research Summary

### Platform Support

**Supported:**
- Chrome / Edge / Firefox (desktop and Android) - solid support
- Safari (desktop macOS) - supported via Web Push API
- Android Chrome PWA - works well

**NOT Supported (Critical Limitation):**
- **iOS Safari / iOS PWA** - iOS does NOT expose the Web Push API to PWAs. This is a hard platform limitation with no Firebase workaround. The only path to iOS push is wrapping in a native app shell (Capacitor/Cordova), which is out of scope.

**Constraints:**
- HTTPS required (localhost allowed for dev)
- Explicit user permission required (`Notification.requestPermission()`)
- Private browsing may block or not persist permissions

### Firebase Cloud Messaging (FCM) Requirements

From official Firebase docs:
- Service worker file must be at domain root: `firebase-messaging-sw.js`
- VAPID key required - generate via Firebase Console → Cloud Messaging → Web Push certificates
- FCM SDK supported only on pages served over HTTPS
- For SDK 6.7.0+, enable FCM Registration API in Google Cloud Console

### Token Lifecycle (from Firebase docs)

| Scenario | Action Required |
|----------|-----------------|
| Android tokens expire after **270 days** of inactivity | FCM rejects sends; delete from DB |
| `UNREGISTERED` (HTTP 404) response | Token invalid; delete immediately |
| `INVALID_ARGUMENT` (HTTP 400) response | Token invalid; delete immediately |
| User clears browser data / reinstalls | Token changes; client must re-register |
| No activity for **1 month** | Consider token stale; candidate for cleanup |

**Best practices:**
- Store tokens with timestamps
- Client should retrieve token on app startup and send to server
- Refresh tokens monthly (balances battery vs staleness)
- Run daily cleanup jobs for stale tokens

---

## The Expert's Recommendations

Consulted The Expert on architecture. Key findings:

### 1. Event Hook Location: Firestore Trigger vs ActivityFeedService

**Original idea:** Hook into `ActivityFeedService.recordActivityForUsers()` directly.

**The Expert's recommendation:** Use a **Firestore trigger** instead.

> "Directly sending FCM messages within this synchronous path can introduce latency and coupling. If FCM sending fails or takes too long, it could delay the core activity recording."

**Recommended pattern:**
1. `ActivityFeedService.recordActivityForUsers()` writes activity documents (as it does now)
2. A Firestore `onCreate` trigger on the activity feed collection fires
3. The trigger function calls `NotificationSender` to send push notifications

**Pros:** Decoupled, asynchronous, built-in retry mechanisms, doesn't block primary request flow.

### 2. Multi-Tenant: Single FCM Project with Data Messages

**The Expert confirms:** One FCM project with data messages is the right approach. Per-tenant FCM projects would be massive complexity for no real benefit.

- Pass `tenantId` with each token and in notification payload
- Service worker uses data message fields to customize notification display (appName, icon from tenant branding)

### 3. Service Worker Configuration

**Recommended:** Service worker can fetch config from `/api/config` directly, or receive via `postMessage` from main thread. The fetch approach is cleaner since `/api/config` already serves tenant-aware configuration.

### 4. Topic Messaging for Groups (Hybrid Approach)

**The Expert recommends a hybrid approach:**

| Use Case | Method |
|----------|--------|
| Group broadcasts ("New expense in Group X") | **Topic messaging** - subscribe users to `/topics/group_{groupId}` |
| Personalized notifications ("@User mentioned you") | **Device tokens** - direct to specific user |

**Benefits:** Topic messaging handles fan-out efficiently for groups; device tokens for personalized messages.

**Implementation:** Subscribe users to group topic on join, unsubscribe on leave.

---

## Proposed Solution (FCM for Web)

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Mutation Services (Expense, Settlement, Comment, Member)       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  ActivityFeedService.recordActivityForUsers()                   │
│  → Writes to: activity-feed/{userId}/items/{itemId}             │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Firestore write
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Firestore onCreate Trigger (Cloud Function)                    │
│  → Calls NotificationSender.sendForActivityEvent()              │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  INotificationSender (abstraction)                              │
│  └── FcmNotificationSender (prod) / MockNotificationSender (test)│
│  → Sends via FCM Admin SDK                                       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  FCM → Service Worker → System Notification                     │
│  Click → Deep link to /groups/{groupId}/expenses/{expenseId}    │
└─────────────────────────────────────────────────────────────────┘
```

### Data Model (Firestore)

**Path:** `users/{userId}/pushTokens/{tokenId}`

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Auto-generated doc ID |
| `token` | string | FCM registration token |
| `tenantId` | TenantId | For multi-tenant branding |
| `platform` | `'web'` | Platform identifier |
| `userAgent` | string? | Browser identification |
| `createdAt` | Timestamp | When registered |
| `updatedAt` | Timestamp | Last update |
| `lastSeenAt` | Timestamp | Last activity (for staleness detection) |

**Firestore Security Rules:** Only authenticated user can read/write their own `pushTokens` subcollection.

### Topic Subscriptions (for group broadcasts)

When user joins group → subscribe to `/topics/group_{groupId}`
When user leaves group → unsubscribe from `/topics/group_{groupId}`

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/me/push-tokens` | POST | Register/update FCM token |
| `/me/push-tokens/:tokenId` | DELETE | Unregister token |

### Notification Payload Structure

```typescript
interface NotificationPayload {
    title: string;           // Tenant appName or group name
    body: string;            // "Alice added an expense: Lunch"
    icon?: string;           // Tenant logoUrl
    data: {
        type: 'activity';
        groupId: GroupId;
        expenseId?: ExpenseId;
        settlementId?: SettlementId;
        commentId?: CommentId;
        deepLink: string;    // "/groups/abc/expenses/xyz"
        tenantId: TenantId;  // For branding in SW
    };
}
```

### Deep Link Construction

| Event Type | Deep Link |
|------------|-----------|
| expense-created/updated/deleted | `/groups/{groupId}/expenses/{expenseId}` |
| settlement-created/updated/deleted | `/groups/{groupId}?tab=settlements` |
| comment-added | `/groups/{groupId}?tab=activity` |
| member-joined/left | `/groups/{groupId}?tab=members` |
| group-updated | `/groups/{groupId}` |

---

## Implementation Plan

**Testing approach:** Tests are written alongside code in each phase, not as a separate final step.

### Phase 1: Backend Token Storage + API

**Create:**
- `firebase/functions/src/schemas/push-token.ts` - Zod schema
- `firebase/functions/src/services/PushTokenService.ts` - Token CRUD
- `firebase/functions/src/push-notifications/PushTokenHandlers.ts` - API handlers
- `firebase/functions/src/push-notifications/validation.ts` - Request validation

**Modify:**
- `packages/shared/src/shared-types.ts` - Add DTOs
- `packages/shared/src/api.ts` - Add API methods
- `packages/shared/src/schemas/apiSchemas.ts` - Add response schema
- `firebase/functions/src/routes/route-config.ts` - Add routes
- `firebase/functions/src/services/ComponentBuilder.ts` - Wire up service
- `firebase/functions/src/ApplicationFactory.ts` - Register handlers
- `firebase/firestore.rules` - Add rules for pushTokens subcollection

**Tests (written with the code):**
- `firebase/functions/src/__tests__/unit/api/push-token.test.ts`
  - Register token stores document for authenticated user
  - Duplicate token upserts (not duplicates)
  - Unregister deletes document
  - Unauthorized returns 401

### Phase 2: Notification Sending Infrastructure

**Create:**
- `firebase/functions/src/services/notifications/INotificationSender.ts` - Interface
- `firebase/functions/src/services/notifications/FcmNotificationSender.ts` - FCM implementation
- `firebase/functions/src/services/notifications/MockNotificationSender.ts` - Test mock
- `firebase/functions/src/services/notifications/notification-payload-builder.ts` - Payload construction

**Tests (written with the code):**
- `firebase/functions/src/__tests__/unit/services/notification-sender.test.ts`
  - Sends to correct users
  - Excludes actor from notifications
  - Groups tokens by tenant for branding
  - Handles empty user list gracefully
  - Handles FCM failures without throwing
  - Removes stale tokens on FCM error

### Phase 3: Firestore Trigger for Notifications

**Create:**
- `firebase/functions/src/triggers/activity-feed-notification-trigger.ts` - onCreate trigger

**Modify:**
- `firebase/functions/src/index.ts` - Export trigger

**Pattern:**
```typescript
export const onActivityFeedItemCreated = onDocumentCreated(
    'activity-feed/{userId}/items/{itemId}',
    async (event) => {
        const item = event.data?.data();
        if (!item || item.actorId === event.params.userId) return; // Don't notify actor

        await notificationSender.sendForActivityEvent(
            event.params.userId,
            item,
        );
    }
);
```

**Tests (written with the code):**
- `firebase/functions/src/__tests__/unit/triggers/activity-feed-notification.test.ts`
  - Trigger fires on activity feed document creation
  - Skips notification when actor === recipient
  - Builds correct deep link for each event type

### Phase 4: Topic Subscription Management

**Modify:**
- `firebase/functions/src/services/GroupMemberService.ts` - Subscribe on join, unsubscribe on leave

**Tests (add to existing):**
- Add cases to `firebase/functions/src/__tests__/unit/api/group-member.test.ts`
  - Subscribes user to topic on group join
  - Unsubscribes user from topic on group leave

### Phase 5: Configuration (VAPID Key)

**Generate VAPID key:**
```bash
# In Firebase Console: Project Settings → Cloud Messaging → Web Push certificates
# Or generate locally: npx web-push generate-vapid-keys
```

**Modify:**
- `firebase/functions/.env.instance*` - Add `__CLIENT_VAPID_KEY`
- `firebase/functions/src/app-config.ts` - Read VAPID key
- `packages/shared/src/shared-types.ts` - Add `vapidKey` to `FirebaseConfig`

### Phase 6: Frontend Service Worker + Client

**Create:**
- `webapp-v2/public/firebase-messaging-sw.js` - Service worker
- `webapp-v2/public/manifest.json` - PWA manifest (for Android PWA)
- `webapp-v2/src/app/services/push-notification-service.ts` - Client-side FCM wrapper

**Modify:**
- `webapp-v2/index.html` - Link manifest
- `webapp-v2/src/pages/SettingsPage.tsx` - Add notifications toggle
- `webapp-v2/src/app/apiClient.ts` - Add token registration methods
- `webapp-v2/locales/en/translation.json` - Add i18n strings

**Tests (written with the code):**
- `webapp-v2/src/__tests__/integration/playwright/notification-settings.test.ts`
  - Toggle visible when browser supports push
  - Toggle hidden when not supported
  - Permission denied shows warning with guidance
  - iOS shows "not supported" message

---

## Testing Strategy

**Principle:** Tests are written alongside code in each phase, not as a separate final step.

### Server-Side (Unit Tests)

- Use `MockNotificationSender` - no real FCM calls in tests
- Tests live in `firebase/functions/src/__tests__/unit/`
- Each phase includes its test file(s)

### Client-Side (Playwright)

- Test settings UI behavior, not real push delivery
- Mock API responses for token registration
- Do NOT test real push delivery - environment-dependent and flaky

---

## Edge Cases to Handle

| Case | Solution |
|------|----------|
| Stale FCM tokens | Delete on `UNREGISTERED` / `INVALID_ARGUMENT` from FCM |
| Multiple devices | Store all tokens per user, send to all |
| Token refresh | Client checks token on startup, re-registers if changed |
| User logout | Delete all tokens for user |
| Notification fails | Fire-and-forget, log warning, don't throw |
| Actor notification | Skip - never notify the person who did the action |
| Tab already open | Real-time sync handles it; push is redundant but harmless |
| iOS users | Show "not supported" message in settings UI |

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| iOS PWA support | **Not supported** - hard platform limitation |
| Hook location | **Firestore trigger** - decoupled from ActivityFeedService |
| Multi-tenant FCM | **Single project** with data messages |
| Service worker config | **Fetch from `/api/config`** or postMessage |
| Topic vs tokens | **Hybrid** - topics for groups, tokens for personalized |

---

## References

- [Firebase Cloud Messaging Web Client Setup](https://firebase.google.com/docs/cloud-messaging/js/client)
- [FCM Token Management Best Practices](https://firebase.google.com/docs/cloud-messaging/manage-tokens)
- [Firestore Triggers for Cloud Functions](https://firebase.google.com/docs/functions/firestore-events)
- [FCM Topic Messaging](https://firebase.google.com/docs/cloud-messaging/manage-topics)

---

## Status

- [x] Initial research
- [x] User requirements clarified
- [x] The Expert consulted
- [x] Firebase docs reviewed
- [ ] Implementation Phase 1: Token Storage + API
- [ ] Implementation Phase 2: Notification Sender
- [ ] Implementation Phase 3: Firestore Trigger
- [ ] Implementation Phase 4: Topic Subscriptions
- [ ] Implementation Phase 5: VAPID Configuration
- [ ] Implementation Phase 6: Frontend Service Worker
- [ ] Implementation Phase 7: Testing
