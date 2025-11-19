
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
        "groups": "pending" | "in_progress" | "completed",
        "expenses": "pending" | "in_progress" | "completed",
        "comments": "pending" | "in_progress" | "completed"
      },
      "createdAt": "timestamp",
      "updatedAt": "timestamp",
      "error": "error message if the job failed"
    }
    ```

### 2.2. Detailed Merge Process

The task handler function will process the merge in a series of steps, updating the `merge-job` document as it progresses.

1.  **Merge Firestore `users` document:**
    *   Read the `users` documents for both the primary and secondary accounts.
    *   Merge the data. A conflict resolution strategy will be needed. For most fields, the value from the primary account will be kept. For fields like `acceptedPolicies`, the two sets of policies will be merged.
    *   Update the primary account's `users` document.

2.  **Migrate Group Memberships:**
    *   Find all groups the secondary account is a member of.
    *   For each group:
        *   If the primary account is already a member, the secondary account's membership is simply removed.
        *   If the primary account is not a member, update the membership record to change the `uid` to the primary account's `uid`.
        *   If the secondary membership has metadata (role overrides, pending status, etc.) that differs from the primary, capture or merge those values before deleting the duplicate so we do not lose important intent.

3.  **Migrate User-Owned Data:**
    *   This is the most critical and potentially time-consuming part. We need to identify all collections where the `userId` is used as a foreign key and update it to the primary account's `uid`.
    *   Based on the current codebase, the following collections will need to be updated:
        *   `expenses`
        *   `comments`
        *   `activity`
        *   Potentially others. A thorough audit of the Firestore database schema is required.
    *   The task handler will process these updates in batches to avoid timeouts. For each batch, it will query for a set of documents, update them, and then re-enqueue itself to process the next batch.

4.  **Delete Secondary Account:**
    *   Once all data has been migrated, the final step is to delete the secondary account from Firebase Auth.
    *   The secondary account's `users` document in Firestore should also be deleted.

5.  **Update Job Status:**
    *   After the secondary account is deleted, the `merge-job` document is marked as `completed`.

### 2.3. Error Handling and Retries

*   Cloud Tasks provides automatic retries, which will make the process resilient to transient errors.
*   If a non-recoverable error occurs, the job will be marked as `failed` in the `accountMerges` collection, and the error will be logged. A manual intervention might be required to fix the state.

## 3. Security Considerations

*   **Ownership Verification:** The user must provide the password for the secondary account to prove ownership. This will be done by calling the `signInWithEmailAndPassword` method from the Firebase Auth SDK.
*   **Irreversible Action:** The user must be clearly warned that the merge is irreversible and will result in the deletion of the secondary account.
*   **Rate Limiting:** The `POST /user/merge` endpoint should be rate-limited to prevent abuse.

## 4. Future Enhancements

*   **Admin Tool:** An admin tool could be built to allow support staff to monitor the status of merge jobs and to manually intervene if a job fails.
*   **Undo Functionality:** While the merge is described as irreversible, it might be possible to implement a limited "undo" functionality by creating a backup of the secondary account's data before the merge. This would add significant complexity and is not recommended for the initial implementation.

## 5. Open Questions

*   A complete audit of the Firestore database is needed to identify all collections that store user-specific data.
*   The conflict resolution strategy for merging the `users` documents needs to be defined in more detail.
*   The UI/UX for the merge process needs to be designed.

## Research Findings & Planning Gaps

### Account Linking First
Firebase already offers account linking as a way to consolidate credentials under one `uid`, so the best experience is to walk the user through `linkWithCredential` before ever triggering the merge job. When linking fails because the credential is already attached to another account, we can fall back to the Cloud Tasks workflow, but desktop/web/mobile flows should attempt linking first so that data stays under the same user ID whenever possible. citeturn0search0

### Cloud Tasks / Cloud Functions Hardening
Every step of the merge must be idempotent and checkpointed because Cloud Tasks retries will re-run the function until it succeeds or the retry window expires. We should:

1.  Persist per-stage progress (users, groups, expenses, comments, etc.) so retries resume at the next unfinished stage instead of reprocessing everything; Cloud Run Jobs documentation explicitly calls out checkpointing to avoid rework after restarts. citeturn1search0
2.  Treat failures as retries for transient issues, configure Cloud Functions retry policies (with `--retry`) and a dead-letter queue for fatal cases, and always advance a merge job to `completed` once all work is done so future retries exit quickly. citeturn2search0
3.  Keep operations idempotent (mutations must be safe to repeat) and guard each write by reading current state first or recording processed document IDs so duplicate deliveries produce the same result. citeturn2search0turn2search4

These steps make the system resilient and keep Cloud Task retries from creating inconsistent data.

### Duplicate Group Memberships
If both the primary and secondary accounts are members of the same group, treat the secondary membership as redundant. Before deleting it, preserve any unique metadata (for example, a pending status or special role) and merge or log those values so we can reason about them later. Only remove the redundant membership after confirming the primary remains active in the group, and avoid creating a new membership entry for the primary to prevent duplicate records.

## Testing Considerations

*   **Unit tests** for the merge job should verify conflict resolution logic: merging `acceptedPolicies`, deduplicating group memberships, and updating `uid` references across user-owned collections while maintaining idempotency.
*   **Integration tests** (Firebase emulator) should simulate merging accounts with overlapping groups/expenses/comments and ensure Cloud Tasks retries re-run safely, the secondary account is deleted, and the `accountMerges` document transitions through expected statuses.
*   **End-to-end flows** should cover the linking-first experience versus the merge-job fallback, ensuring the UI routes the user through linking when possible and surfaces merge job progress/errors when the task runs.
