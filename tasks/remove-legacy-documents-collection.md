# Task: Remove Legacy `documents` Firestore Collection

## 1. Overview

A deep dive into the Firebase configuration identified that the application has two separate Firestore collections for storing group data: `groups` and `documents`. It has been confirmed that `documents` is a legacy collection and is no longer in use. 

This represents a significant piece of technical debt that creates security risks and developer confusion. This task outlines the plan to safely remove the legacy collection and all references to it.

## 2. Problem Statement

The existence of the `documents` collection alongside the canonical `groups` collection causes several issues:

-   **Security Risk**: The `firestore.rules` file contains a separate, more complex, and now-obsolete set of security rules for `match /documents/{documentId}`. Maintaining two different security models for the same entity is confusing and increases the risk of misconfiguration. The legacy rules could potentially be exploited if any code accidentally writes to the old collection.
-   **Developer Confusion**: A developer encountering the `documents` rules or code references for the first time will be confused about which collection is the correct one to use. This ambiguity slows down development and can lead to bugs.
-   **Code Bloat and Maintenance Overhead**: The presence of dead code and obsolete security rules clutters the codebase, making it harder to read, maintain, and reason about.

## 3. Action Plan

To resolve this, the `documents` collection and all its associated code and configuration must be completely removed.

1.  **Verify No Data Remains (Production Check)**
    -   Before any deletion, an administrator must run a query against the **production** Firestore database to confirm that the `documents` collection is truly empty. This is a critical safety check.

2.  **Data Migration (Contingency)**
    -   In the unlikely event that any data is found in the production `documents` collection, a one-time migration script must be written and executed to move that data to the `groups` collection. The application should not be modified until the data is unified.

3.  **Remove Security Rules**
    -   Edit the `firebase/firestore.rules` file.
    -   Delete the entire `match /documents/{documentId}` block. This is the most important step to cleaning up the security model.

4.  **Remove Code References**
    -   Perform a global, case-sensitive search across the entire codebase for the string `documents`.
    -   Remove any remaining import, constant, or function that may still reference the old collection.

5.  **Verification**
    -   After the rules and code have been cleaned up, run the full test suite (`npm test`) to ensure the removal has not caused any regressions.
    -   Manually test the core group functionality (creating, viewing, updating groups) in the emulator to provide a final confirmation.

## 4. Benefits

-   **Unified Data Model**: Establishes `groups` as the single source of truth for group data.
-   **Simplified Security**: Removes obsolete and confusing security rules, making the security posture easier to audit and maintain.
-   **Reduced Technical Debt**: Cleans up the codebase, improving readability and developer ergonomics.
