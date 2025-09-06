# Notification System Scalability Analysis

## 1. Overview

A deep dive into the client notification system reveals that its current architecture does not scale well and is the likely cause of performance degradation, particularly in the test suite. The system generates a high volume of temporary documents, leading to excessive write and delete operations that overwhelm Firestore, especially under load.

This document analyzes the current implementation, details the scaling issues, and proposes a more robust and scalable architecture.

## 2. Current Architecture: High-Churn Change Documents

The current system is designed to provide real-time updates to clients by creating temporary "change documents."

1.  **Trigger & Create**: When a core data entity (like an expense or group) is created, updated, or deleted, a Cloud Function trigger fires. This trigger creates a new, small document in a dedicated collection (e.g., `transaction-changes`, `group-changes`). This document acts as a signal to clients.
2.  **Client-Side Listening**: The web application listens for the creation of new documents in these change collections. When a new document appears, the client knows that something has changed and triggers a data refresh.
3.  **Scheduled Cleanup**: A scheduled function (`cleanupChanges`) runs every 5 minutes to delete all change documents older than 5 minutes. This is necessary to prevent the collections from growing indefinitely.

## 3. The Scaling Problem

While this event-based system is functional for low-traffic scenarios, it has fundamental scaling problems that become apparent under heavy load, such as during automated testing.

*   **Extreme Document Churn**: Every logical change results in multiple Firestore operations. For example, creating a single expense triggers **at least two writes** (the expense document itself and a `transaction-changes` document) followed by a **delete** operation a few minutes later.
*   **Write Amplification**: In a test scenario that creates 100 expenses, the system is actually performing over 300 write operations and then 200 delete operations in a very short window. This "write amplification" effect is a significant performance bottleneck.
*   **Inefficient Queries**: Clients must query entire collections and filter for changes relevant to them. While the collections are kept small by the cleanup job, this is still less efficient than listening to a single, targeted document.
*   **Test Suite Instability**: The high volume of writes and deletes during tests can easily overwhelm the Firebase Emulator, causing timeouts, race conditions, and slow test execution. This is the likely cause of the observed performance issues.

## 4. Proposed Solution: Per-User Notification Document

The recommended solution is to move from a high-churn, multi-document system to a model that uses a **single, long-lived notification document for each user**.

This approach is a standard, highly-scalable pattern for real-time notifications in Firestore.

### 4.1. How It Works

1.  **Schema**: A new collection, `user-notifications`, would be created. Each user would have a single document in this collection, keyed by their user ID (e.g., `/user-notifications/{userId}`).
2.  **Update, Don't Create**: Instead of creating new documents, the Cloud Function triggers would be modified to perform a single, fast `update` operation on the relevant users' notification documents. For example, when an expense is added to a group, the function would update the notification document for every member of that group.
3.  **Client-Side Listening**: The client application would open a single, persistent listener on the current user's notification document (`/user-notifications/{auth.currentUser.uid}`). This is the most efficient type of listener in Firestore.
4.  **No Cleanup Needed**: Because documents are updated in-place, the entire scheduled cleanup process becomes obsolete, completely eliminating the delete operations and the associated database load.

### 4.2. Proposed Schema

```typescript
// /user-notifications/{userId}
interface UserNotificationDocument {
    // A counter that increments on every change.
    // The client can watch this to know when to refresh data.
    changeVersion: number;

    // A map of group IDs to their last change timestamp.
    // This allows for more granular updates.
    groups: {
        [groupId: string]: {
            lastTransactionChange: Timestamp;
            lastBalanceChange: Timestamp;
            lastGroupDetailsChange: Timestamp;
        };
    };

    // Timestamp of the last update to this document.
    lastModified: Timestamp;
}
```

## 5. Benefits of the Proposed Architecture

*   **Drastically Reduced Operations**: This model reduces the operation count by an order of magnitude. Creating 100 expenses would result in ~100 document updates instead of 300+ writes and 200+ deletes.
*   **Eliminates Churn**: By updating existing documents, the create/delete churn is eliminated entirely, leading to a more stable and predictable load on Firestore.
*   **Simplified Client Logic**: The client's responsibility is reduced to listening to a single, predictable document. This removes the need for collection queries and complex client-side filtering.
*   **Improved Performance & Scalability**: This architecture is significantly more performant and will scale linearly with the number of users, resolving the current bottlenecks and improving the speed and reliability of both the application and the test suite.

## 6. High-Level Implementation Plan

1.  **Schema**: Create the `UserNotificationDocument` interface and add the new `user-notifications` collection to Firestore.
2.  **Backend (Cloud Functions)**:
    *   Modify the triggers in `change-tracker.ts` to update the `UserNotificationDocument` for all affected users instead of creating new documents in the `*-changes` collections. This will likely involve batching Firestore writes for efficiency.
    *   Delete the `cleanup.ts` scheduled function and its configuration.
3.  **Frontend (Web App)**:
    *   Update the real-time stores (e.g., `groups-store-enhanced.ts`) to listen for changes on the user's notification document.
    *   Based on the information in the notification document, trigger the appropriate data refreshes.
4.  **Testing**:
    *   Update integration tests to verify that the new notification system correctly triggers updates.
    *   The overall performance of the test suite is expected to improve significantly.
