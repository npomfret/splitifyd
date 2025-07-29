# Streaming vs. REST API Analysis

## 1. Introduction

This document analyzes the current REST-based API architecture of the Splitifyd application and explores the potential benefits of migrating to a real-time, streaming-based architecture using Firestore's `onSnapshot` listeners.

## 2. Current Architecture (REST API)

### 2.1. Client-side (`webapp-v2`)

*   **State Management:** The new web application (`webapp-v2`) uses a modern state management library (`preact/signals`) with dedicated stores for different data domains (e.g., `groups-store`, `group-detail-store`).
*   **Data Fetching:** All data is fetched from the backend via standard RESTful API calls. This is typically done within `useEffect` hooks in the page components, which trigger data-fetching methods in the stores.
*   **Data Validation:** API responses are validated at runtime using Zod schemas, which ensures type safety and helps to catch contract violations between the client and server.

### 2.2. Server-side (`firebase/functions`)

*   **Backend:** The backend is an Express.js application running as a single Firebase Function (`api`).
*   **API:** It exposes a comprehensive RESTful API for all application resources, including groups, expenses, users, and configuration.
*   **Business Logic:** Core business logic, such as balance calculation, is implemented in services (`balanceCalculator.ts`).
*   **Asynchronous Operations:** The system already utilizes Firebase triggers for some asynchronous operations, such as updating aggregated balances when an expense is written (`onExpenseWriteV6`).

## 3. Analysis: Streaming vs. REST

The current REST-based architecture is simple and well-understood, but it has several limitations for a collaborative application like Splitifyd.

| Feature | REST API (Current) | Streaming (Proposed) |
| :--- | :--- | :--- |
| **Data Freshness** | Data is only as fresh as the last manual refresh or poll. | Data is updated in real-time as it changes on the server. |
| **User Experience** | Can feel static. Users don't see changes made by others without a page reload. | Highly dynamic and collaborative. Changes appear instantly. |
| **Performance** | Can be slow for frequently changing data, as it requires re-fetching and re-calculating entire datasets (e.g., group balances). | More performant for dynamic data. Clients receive incremental updates and can perform calculations locally. |
| **Backend Load** | High number of requests for polling data, leading to increased function invocations and potentially higher costs. | Fewer requests, as a persistent connection is established. Reduces load on backend functions. |
| **Complexity** | Simpler to implement for basic CRUD operations. | More complex initial setup for managing listeners and real-time state. |

## 4. Recommendations

I recommend a **hybrid approach**, gradually migrating key parts of the application to a streaming architecture while retaining the REST API for actions and less dynamic data.

### 4.1. Phase 1: Real-time Group Details

The most impactful initial change would be to stream the data that is most visible and collaborative.

*   **Group and Expense Data:** Stream the list of groups on the dashboard and the details of a specific group (including its members and expenses) using `onSnapshot`. This will ensure that users always see the most up-to-date information without needing to refresh.
*   **Balance Calculation:**
    *   **For small to medium groups:** Stream all expenses for a group to the client and perform the balance calculation directly in the browser. This will provide instantaneous balance updates as expenses are added or changed.
    *   **For large groups:** To avoid sending excessive data to the client, continue to use the server-side aggregated balances in the `group-balances` collection. The client can then listen for real-time updates on the specific group's balance document.

### 4.2. Implementation Strategy

*   **Data Stores:** The `onSnapshot` listeners should be implemented within the existing data stores (`groups-store.ts`, `group-detail-store.ts`). The stores will be responsible for managing the real-time connection, handling incoming data, and updating the application state.
*   **REST for Actions:** Continue to use the existing REST endpoints for user actions such as creating, updating, and deleting groups and expenses. These are one-off operations that do not require a persistent connection.
*   **Security Rules:** A thorough review and update of Firestore security rules is **critical** before implementing a streaming solution. The rules must ensure that users can only read the data they are authorized to access.

### 4.3. Long-term Vision

Over time, other parts of the application could be migrated to a streaming model where it makes sense. For example:

*   **User presence:** Show which users are currently online or viewing a group.
*   **Real-time notifications:** Instantly notify users of important events.

## 5. Conclusion

Migrating to a streaming architecture for key features will significantly improve the user experience of Splitifyd, making it a more dynamic and collaborative application. By taking a phased, hybrid approach, we can manage the complexity of the migration while delivering value to users quickly. The existing codebase, with its well-defined stores and separation of concerns, is well-suited for this transition.
