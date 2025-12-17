# Push Notifications (Webapp)

## Objective

Add push notifications for the `webapp-v2` browser client so users can be notified of relevant events (e.g., invites, new expenses, comments) **even when the tab is closed**.

This should complement (not replace) the existing real-time refresh mechanism (Activity Feed + Firestore subscriptions) which currently only updates the UI when the app is open.

## Research Summary (Do Push Notifications Work for Browser Apps?)

### Yes, but with constraints

Web push notifications are supported via:

- **Service Worker** (required; receives push events in the background)
- **Push API** (push subscription / browser token)
- **Notifications API** (displaying notifications)

Non-negotiables:

- **HTTPS** required (localhost allowed)
- **Explicit user permission** required (`Notification.requestPermission()`)
- OS/browser may **throttle** delivery; not guaranteed instant

### Practical browser support

- **Chrome / Edge / Firefox**: solid support for web push on desktop and Android
- **iOS Safari**: historically limited; modern iOS supports web push but behavior differs and is most reliable for **installed PWAs** (“Add to Home Screen”)
- Private browsing modes may block or not persist permissions/subscriptions

### UX considerations

- Do not prompt on first page load; browsers can downgrade/penalize permission prompts.
- Permission prompting should be tied to clear user intent (e.g., “Notify me about activity in my groups”).
- Always provide an in-app fallback (email, in-app badge) if denied/unavailable.

## Options Considered

### Option A: Firebase Cloud Messaging (FCM) for Web (Recommended)

Use Firebase Messaging on the client to acquire an FCM token (requires service worker), store tokens in Firestore, and send messages from Firebase Functions using Admin SDK.

**Pros**
- Fits existing Firebase stack (Functions + Auth + Firestore)
- Server-side sending is straightforward
- Uses established Google infrastructure for delivery

**Cons**
- Token lifecycle management required (refresh, invalidation, duplicates)
- Web-specific requirements still apply (SW, permission UX, iOS constraints)
- Requires a **Web Push certificate / VAPID key** configured for token acquisition

### Option B: Standard Web Push (VAPID) without FCM

Store `PushSubscription` objects and send using `web-push` with VAPID keys.

**Pros**
- Vendor-neutral; no FCM coupling

**Cons**
- More plumbing and less aligned with current Firebase tooling
- Still needs SW + subscription management

## Proposed Solution (FCM for Web)

### High-level design

1. `webapp-v2` initializes Firebase Messaging and registers a **service worker**.
2. On explicit user action, request notification permission and acquire an **FCM token**.
3. The client calls a new authenticated API endpoint to register/update that token.
4. Backend persists tokens per user in Firestore.
5. When a relevant domain event occurs, backend sends pushes to the intended recipients via an abstraction (testable, mockable).

### Key principle: keep external APIs behind an abstraction

Following `docs/guides/code.md`, all external delivery should be hidden behind a service interface so unit tests never require real FCM.

- Introduce something like `PushSender` / `NotificationSender` interface
- Provide `FcmPushSender` implementation (production)
- Provide `FakePushSender` / mock for unit tests

### Event sources (where to hook in)

The most natural place to trigger notifications is where we already model “something happened”:

- `services/ActivityFeedService.ts` (or where events are created) as a single consolidation point
- Alternatively: directly in mutation services (ExpenseService, SettlementService, GroupMemberService) but that risks drift

Recommendation: **centralize** notification emission adjacent to Activity Feed event creation so “real-time UI refresh” and “push notification” share the same event semantics.

### Delivery rules (initial)

Start conservative:

- Only notify when the recipient is not the actor (no “you did X”)
- Only notify for high-value events:
  - `member-invited` / `member-approved` / `member-joined`
  - `expense-created` (maybe only for large amounts or non-trivial groups later)
  - `comment-created` (optional)
- Avoid including sensitive content in the push payload; include only:
  - `groupId` (and maybe `activityId`)
  - a short title/body that does not leak private data on lock screens

### Data model (Firestore)

Store tokens per user (subcollection to avoid hot-spotting and to support multiple devices/browsers):

- Path: `users/{userId}/pushTokens/{tokenId}`
- Fields:
  - `token` (string)
  - `platform` (`'web'` initially)
  - `userAgent` (string, optional)
  - `createdAt` / `updatedAt` (ISO string DTO; Timestamp stored in Firestore via Writer boundary)
  - `lastSeenAt` (ISO string)
  - `permission` (`'granted' | 'denied' | 'default'`), optional

We should also support deletion:

- On logout, token refresh failure, or explicit “Disable notifications”, client calls delete endpoint.

### API contract (shared types)

Add request/response DTOs to `packages/shared/src/shared-types.ts` and schemas to `packages/shared/src/schemas/apiSchemas.ts` as needed.

Potential endpoints (names TBD; must follow existing route conventions):

- `POST /me/push-tokens` (register/update)
- `DELETE /me/push-tokens/:tokenId` (unregister)
- (Optional) `POST /me/push-test` for development-only testing (admin or self-only)

### Client implementation notes

- Vite + Firebase Messaging typically requires a service worker file at a stable path (commonly `/firebase-messaging-sw.js`).
- We should place the service worker in `webapp-v2/public/` so it’s served at the hosting root.
- The client needs a **VAPID key** to call `getToken(messaging, { vapidKey })`.
  - This key must be provided via the existing configuration mechanism (likely via `ClientAppConfiguration` served from the backend), not ad-hoc env usage.

### Security notes

- Client is zero-trust; token registration must require `authenticate`.
- Token registration must only mutate tokens for `req.user.uid`.
- When sending notifications, ensure recipients are derived from server-side group membership checks.
- Avoid including PII or sensitive content in notification payloads.

## Proposed Implementation Plan

### Phase 0: Clarify requirements (must answer before coding)

- Which platforms matter: desktop web only, Android web, iOS Safari, installed PWA?
- Which events are “must notify” vs “nice to have”?
- Should users be able to opt out per group / per event type?
- Do we need deep-linking into a group/expense from notification click?

### Phase 1: Plumbing (client token + server storage)

- Add shared DTOs + Zod schemas for token registration
- Add backend endpoints + Firestore storage for tokens
- Add webapp UI flow to request permission and register token
- Add ability to unregister token

### Phase 2: Sending (backend abstraction + event hooks)

- Create `NotificationSender` abstraction and FCM implementation
- Wire notification sending into Activity Feed event creation (or a single central place)
- Add minimal rate limiting / dedupe to avoid spam (e.g., don’t notify if multiple events in a few seconds)

### Phase 3: Preferences + UX polish

- Add “Notifications” settings screen:
  - enable/disable
  - per-event toggles (if required)
- Add “permission denied” guidance and fallback messaging

### Phase 4: iOS/PWA hardening (if required)

- Ensure PWA manifest + install flow if iOS web push is a requirement
- Validate behavior under iOS constraints (installed vs not installed)

## Testing Strategy (No Full Suites)

Server:

- Add unit tests in `firebase/functions/src/__tests__/unit/api`:
  - register token stores document for authenticated user
  - unregister token removes document
  - event hook calls `NotificationSender` with correct recipients/payload
- Mock `NotificationSender` (no real network calls)

Client:

- Add a Playwright integration test (if feasible) verifying:
  - settings UI triggers the registration call
  - app handles “denied” permission by showing guidance
- Do not attempt to test real push delivery in CI (flaky and environment-dependent)

## Open Questions / Risks

- iOS behavior may require “installed PWA” to be acceptable; clarify expectation early.
- Token lifecycle: FCM tokens can rotate; we need periodic refresh / update.
- Multi-tenant branding: notification icon/title should respect tenant; may require per-tenant icon asset strategy.

## Next Step

Before implementation, run the “Ask The Expert” script with the above plan, focusing on:

- where to hook into Activity Feed without double-sending
- best place to store token docs and how to model preferences
- how to thread VAPID key/config through existing `ClientAppConfiguration`

