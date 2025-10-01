# Refactor: Real-time Notifications with Pub/Sub and WebSockets

## 1. Overview

This document outlines a plan to completely refactor the real-time notification system. The goal is to replace the current architecture, which relies on Firestore triggers and writing to a `user-notifications` collection, with a more scalable, performant, and cost-effective solution using Google Cloud Pub/Sub and a dedicated WebSocket server hosted on Cloud Run.

## 2. Current Architecture & Its Limitations

- **Mechanism:** The current system uses Firestore triggers (`trackGroupChanges`, `trackExpenseChanges`) to detect database modifications.
- **Data Flow:** When a change occurs, a Cloud Function is executed, which then writes an update to the `user-notifications` document for *every single member* of the affected group.
- **Client-Side:** Each client listens for changes on their own unique document in the `user-notifications` collection to receive updates.

### Limitations:

- **Cost & Performance:** This "fan-out" write approach is expensive. A single change in a group of 20 people results in 20 separate document writes. This scales linearly and becomes a significant performance and cost bottleneck.
- **Latency:** The round trip (DB Write → Trigger → Function → DB Write → Client Listener) introduces noticeable latency, making the UI feel less responsive.
- **Complexity:** The logic is indirect. The service making the change is decoupled from the notification, which can make debugging and reasoning about the system difficult. Race conditions between triggers can also be a concern.

## 3. Proposed Architecture: A Push-Based Model

The new architecture will be a true "push" system composed of three components:

1.  **Publisher (Firebase Functions):** The core backend services (`ExpenseService`, `GroupService`) will become publishers. After successfully writing to the database, they will publish a specific event to a Google Cloud Pub/Sub topic.
2.  **WebSocket Server (New Cloud Run Service):** A new, stateful Node.js service responsible for managing persistent WebSocket connections with all active clients. This service subscribes to messages from Pub/Sub and forwards them to the relevant clients.
3.  **Subscriber (React Frontend):** The frontend client will maintain a single WebSocket connection to the new server. It will subscribe to topics for the specific groups it is interested in and react to events as they are pushed from the server.

---

## 4. Implementation Plan

### Part 1: Backend Publisher Changes (`firebase/functions`)

**Objective:** Replace Firestore trigger writes with direct Pub/Sub event publishing.

1.  **Create `RealtimeEventService`:**
    - **File:** `firebase/functions/src/services/RealtimeEventService.ts`
    - **Logic:** This new service will encapsulate the Google Cloud Pub/Sub client.
    - **Method:** It will expose a simple method: `publish(topic: string, payload: object)`. The `topic` will be the `groupId`, and the `payload` will be a specific event object (e.g., `{ type: 'EXPENSE_CREATED', expenseId: '...' }`).

2.  **Integrate Publisher into Core Services:**
    - I will inject the `RealtimeEventService` into services like `ExpenseService`, `GroupService`, and `CommentService`.
    - At the end of successful database write operations (create, update, delete), these services will now call `realtimeEventService.publish(...)` instead of relying on triggers.

3.  **Decommission Old Trigger System:**
    - **Delete:** The trigger files `change-tracker.ts` and `comment-tracker.ts`.
    - **Remove:** The now-unused logic related to the `user-notifications` collection from `NotificationService.ts`.

### Part 2: New WebSocket Server (on Cloud Run)

**Objective:** Create a new stateful service to manage WebSocket connections and message routing.

1.  **New Project Directory:**
    - I will create a new directory in the monorepo root: `websocket-server/`.
    - This will contain its own `package.json` (with dependencies like `ws`, `@google-cloud/pubsub`, and `firebase-admin`), a `Dockerfile` for containerization, and the `src/` directory for its source code.

2.  **Implement WebSocket Server Logic (`websocket-server/src/index.ts`):**
    - **Connection:** Create an HTTP server and attach a `ws` WebSocket server.
    - **Authentication:** Upon a new client connection, the server will expect a Firebase Auth ID token. It will use the Firebase Admin SDK to verify this token and authenticate the user, associating the `userId` with the connection.
    - **Subscription Management:** The server will listen for `subscribe` messages from clients (e.g., `{ action: 'subscribe', topic: 'some-group-id' }`). Before creating a subscription, it **must** authorize the action by checking if the authenticated user is a member of that group (by calling the existing `GroupMemberService`). It will maintain an in-memory map of `topic -> Set<WebSocket>` to track subscriptions.

3.  **Implement Pub/Sub Subscriber Logic:**
    - The server will create a single Google Cloud Pub/Sub subscription to receive all events.
    - When a message arrives, it will parse the payload, identify the topic (from the `groupId`), look up all the subscribed WebSocket clients for that topic, and forward the message to them.

### Part 3: Frontend Client Changes (`webapp-v2`)

**Objective:** Connect to the WebSocket server and update the UI in response to pushed events.

1.  **Create `RealtimeService`:**
    - **File:** `webapp-v2/src/services/realtimeService.ts`
    - **Logic:** This new singleton service will manage the WebSocket connection lifecycle.
    - **Methods:** It will provide `subscribe(topic, callback)` and `unsubscribe(topic)` methods. It will handle sending the auth token on connect and manage message dispatching internally using an event emitter pattern.

2.  **Integrate with React Components:**
    - Components that need real-time data, like `GroupDetailPage.tsx`, will be updated.
    - In a `useEffect` hook, the component will call `realtimeService.subscribe(groupId, handleGroupEvent)`.
    - The `handleGroupEvent` callback will receive the specific event (e.g., `EXPENSE_UPDATED`) and trigger a targeted data refetch in the relevant data store (e.g., `expensesStore.fetchExpenses(groupId)`).
    - The `useEffect` cleanup function will call `realtimeService.unsubscribe(groupId)` to prevent memory leaks.

### Part 4: Infrastructure & Deployment

1.  **Google Cloud Pub/Sub:** A new Pub/Sub topic will be created to handle the events.
2.  **Google Cloud Run:** The new `websocket-server` will be deployed as a containerized service on Cloud Run.
3.  **IAM Permissions:**
    - The Firebase Functions service account will need permissions to publish to the new Pub/Sub topic.
    - The new Cloud Run service will need a service account with permissions to subscribe to the Pub/Sub topic and perform necessary Firestore reads for authorization.

## 5. Benefits of This Approach

-   **Scalability & Cost:** Reduces Firestore writes from O(N) to O(1) for group-wide events, dramatically lowering costs and improving performance.
-   **Reduced Latency:** A direct push model is significantly faster than the multi-step trigger-based system.
-   **Simplicity & Maintainability:** The event flow becomes explicit and easier to trace. Business logic and notification logic are co-located.
-   **Flexibility:** Pushing specific event types enables more intelligent, granular updates on the client-side, leading to a more responsive UI.
