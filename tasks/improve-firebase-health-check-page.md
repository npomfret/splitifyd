# Feature: Improve Firebase Health Check Page

## Overview

To provide a more comprehensive and useful diagnostic tool, this task is to enhance the existing `healthCheck` page. It will be updated to perform a series of quick, non-destructive tests to verify the status and connectivity of all core Firebase services used by the application.

## The Problem

A basic health check might only confirm that the Firebase SDK has loaded. A more robust check is needed to diagnose potential issues with authentication, database connectivity, or cloud functions, which can help both users and developers identify problems quickly.

## Proposed Checks

The health check page will perform the following tests in sequence, displaying the status and latency of each.

### 1. Firebase SDK Initialization

- **Test:** Check if the Firebase app object (`firebase.app()`) is initialized.
- **Success:** "SDK Initialized"
- **Failure:** "SDK Failed to Initialize"

### 2. Authentication Status

- **Test:** Check the current authentication state.
    - Is there a `currentUser` object?
    - If so, attempt to get a fresh ID token (`currentUser.getIdToken()`).
- **Success:** "Authenticated as [User Email]" or "Not Authenticated" (which is a valid state).
- **Failure:** "Authentication Error" (if getting the token fails).

### 3. Firestore Read Test

- **Test:** Attempt to read a specific, public document from Firestore, such as `/health_check/status`. This document should be publicly readable and contain a simple field like `{ "status": "ok" }`.
- **Success:** "Firestore Read OK ([latency]ms)"
- **Failure:** "Firestore Read Failed"

### 4. Firestore Write/Delete Test

- **Test:** To verify full database access and security rules:
    1.  Write a new document with a random ID to a dedicated, user-specific collection like `/health_check_writes/{userId}`. The document can contain a simple timestamp.
    2.  Immediately delete that same document.
- **Success:** "Firestore Write/Delete OK ([latency]ms)"
- **Failure:** "Firestore Write/Delete Failed"
- **Security Rules:** This requires rules that allow users to create and delete documents only within their own sub-path of `health_check_writes`.

### 5. Cloud Functions Test

- **Test:** Call a dedicated, lightweight `healthCheck` HTTPS Cloud Function. This function should simply return a success status.
- **Success:** "Functions OK ([latency]ms)"
- **Failure:** "Functions Call Failed"

## UI/UX Changes

### Health Check Page

- The page will display a list of the checks being performed.
- Next to each item, it will show a status indicator:
    - **Pending:** A spinner or "Running..." text.
    - **Success:** A green checkmark and a success message (including latency).
    - **Failure:** A red "X" and a brief error message.
- An overall status summary will be displayed at the top of the page ("All systems operational" or "Some systems are experiencing issues").

**Example Layout:**

```
Health Check Status: All systems operational ✅

- Firebase SDK:         [✅] Initialized
- Authentication:       [✅] Authenticated as user@example.com
- Firestore Read:       [✅] OK (35ms)
- Firestore Write:      [✅] OK (89ms)
- Cloud Functions:      [✅] OK (120ms)
```

## Benefits

- **Rapid Diagnostics:** Allows developers and support staff to quickly determine if a user's issue is related to a specific backend service.
- **User Self-Service:** Empowered users can check the system status themselves before reporting a bug.
- **Performance Insight:** The latency measurements provide a quick look at the performance of different Firebase services from the user's perspective.
- **Comprehensive:** Covers all major aspects of the Firebase integration, providing a high degree of confidence in the system's health.
