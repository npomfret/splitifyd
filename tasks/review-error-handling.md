# Firebase Error Handling Review & Refactoring Plan

## 1. Overview

A deep-dive review of the `firebase/functions` codebase was conducted to assess adherence to the project's error handling philosophy, which emphasizes a centralized "let it break" approach.

The review found that while many areas demonstrate robust and specific error handling, there are several key areas where `try/catch` blocks are used in ways that are either redundant, overly broad, or potentially hide bugs.

This document outlines the findings and provides a clear set of recommendations for refactoring.

## 2. Guiding Principle

The core principle for this refactor is from `docs/guides/code.md`:

> **Let It Break**: The primary error handling strategy is to let exceptions bubble up. A final error-handling middleware in `index.ts` catches all uncaught exceptions. Avoid `try/catch` blocks within individual route handlers unless you are handling a specific, expected error case that requires a unique response.

---

## 3. Key Findings & Recommendations

### Finding 1: Redundant `ApiError` Handling in Route Handlers

- **Locations:**
  - `auth/handlers.ts`
  - `policies/user-handlers.ts`
  - `settlements/handlers.ts`

- **Problem:** Several route handlers implement their own `try/catch` blocks specifically to check `instanceof ApiError` and format the response. This is redundant because the main error handling middleware in `index.ts` already performs this exact function for the entire application. This adds unnecessary boilerplate to the handlers.

- **Example (`settlements/handlers.ts`):**
  ```typescript
  // ...
  } catch (error) {
      logger.error('Error creating settlement', error, { ... });
      if (error instanceof ApiError) {
          res.status(error.statusCode).json({
              success: false,
              error: {
                  code: error.code,
                  message: error.message,
              },
          });
      } else {
          res.status(HTTP_STATUS.INTERNAL_ERROR).json({
              success: false,
              error: {
                  code: 'INTERNAL_ERROR',
                  message: 'Failed to create settlement',
              },
          });
      }
  }
  ```

- **Recommendation:**
  Remove these `try/catch` blocks from the route handlers entirely. The existing `asyncHandler` wrapper will automatically catch any thrown `ApiError` (or any other error) and pipe it to the centralized error middleware in `index.ts`, which will format the response correctly. The handlers will become much cleaner.

  **Refactored Example:**
  ```typescript
  export const createSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = validateUserAuth(req);
      const { error, value } = createSettlementSchema.validate(req.body);
      if (error) {
          throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR', error.details[0].message);
      }
      const settlementData: CreateSettlementRequest = value;
      const settlementService = new SettlementService();
      const responseData = await settlementService.createSettlement(settlementData, userId);

      // ... logging ...
      const response: CreateSettlementResponse = { ... };
      res.status(HTTP_STATUS.CREATED).json(response);
  };
  ```
  *(Note: The contextual logging inside the `catch` blocks will be lost, but the global error handler in `index.ts` already provides comprehensive logging.)*

### Finding 2: Potentially Swallowed Errors in Group Member Removal

- **Locations:**
  - `services/GroupMemberService.ts` (in `leaveGroup` and `removeGroupMember`)
  - `groups/memberHandlers.ts` (legacy code with the same pattern)

- **Problem:** The logic to prevent a user with a balance from leaving/being removed is wrapped in a `try/catch` block that is too broad. It specifically looks for an error message containing "outstanding balance" and re-throws it, but it may silently swallow any other unexpected error from the `calculateGroupBalances` function (e.g., a database connectivity issue, a data corruption error). This could lead to a user with a balance being successfully removed if the balance check fails for a reason other than the one being checked for.

- **Example (`services/GroupMemberService.ts`):**
  ```typescript
  try {
      const groupBalance = await calculateGroupBalances(groupId);
      // ... balance checking logic ...
  } catch (balanceError: unknown) {
      const errorMessage = balanceError instanceof Error ? balanceError.message : String(balanceError);
      // ...
      // THIS IS THE PROBLEM: Only re-throws if the message matches.
      if (errorMessage.includes('Cannot leave group with outstanding balance') || apiErrorDetails.includes('Cannot leave group with outstanding balance')) {
          throw balanceError;
      }
      // Other errors from calculateGroupBalances are swallowed here.
  }
  ```

- **Recommendation:**
  Refactor the `catch` block to ensure any unexpected errors from the balance calculation are re-thrown, preserving the "let it break" principle.

  **Refactored Example:**
  ```typescript
  try {
      const groupBalance = await calculateGroupBalances(groupId);
      // ... balance checking logic that throws a specific ApiError on failure ...
  } catch (error: unknown) {
      // If it's the specific "outstanding balance" error, re-throw it.
      if (error instanceof ApiError && error.code === 'OUTSTANDING_BALANCE') {
          throw error;
      }
      // If it's any other error from the balance check, it's unexpected.
      // Log it for debugging but throw a generic error to the user.
      logger.error('Unexpected error during balance check on member removal', error as Error, { groupId, userId });
      throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'BALANCE_CHECK_FAILED', 'Could not verify user balance.');
  }
  ```
  *(This requires `calculateGroupBalances` to throw a specific `ApiError` with code `OUTSTANDING_BALANCE`)*

### Finding 3: Unnecessary `try/catch` in Middleware

- **Location:** `auth/middleware.ts`
- **Function:** `authenticateAdmin`
- **Problem:** This function wraps its logic in a `try/catch` that simply calls `next(error)`. The `asyncHandler` utility used in `index.ts` for all routes already provides this functionality.
- **Recommendation:** Remove the `try/catch` block from `authenticateAdmin` for cleaner code.

---

## 4. Positive Findings (Examples of Good Practices)

The review also highlighted several areas where error handling is implemented correctly and robustly, serving as a model for the rest of the codebase:

- **Specific Error Handling:** `services/UserService2.ts` correctly catches the specific `auth/user-not-found` error code and translates it into a user-friendly `404 Not Found` response.
- **Graceful Degradation:** `expenses/handlers.ts` (`_getGroupExpensesData`) uses `try/catch` within a `.map()` operation to parse documents. If a single document is corrupted and fails validation, it is logged and skipped without failing the entire API request.
- **Cleanup Logic:** `services/UserService2.ts` (`registerUser`) correctly uses a `try/catch` block to perform cleanup. If the Firestore document creation fails after the Auth user is created, it catches the error and attempts to delete the orphaned Auth user, preventing inconsistent states.
- **Intentional Error Swallowing:** `scheduled/cleanup.ts` (`logCleanupMetrics`) intentionally swallows errors inside its `catch` block, with a comment explaining that metrics logging is non-critical and should not stop the main cleanup task.
