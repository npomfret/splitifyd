# Lack of Transaction in Register Handler

## Problem
- **Location**: `firebase/functions/src/auth/handlers.ts`
- **Description**: The `register` handler first creates a Firebase user and then creates a corresponding document in Firestore. These two operations are not performed within a transaction. If the Firestore document creation fails, the user will be left in an inconsistent state (an auth record without a corresponding user document).
- **Current vs Expected**: Currently, the operations are sequential. They should be wrapped in a transaction to ensure atomicity.

## Solution
- **Approach**: While Firestore transactions cannot span both Auth and Firestore operations, a two-step cleanup process can be implemented. If the Firestore document creation fails, the newly created Auth user should be deleted.
- **Code Sample**:
  ```typescript
  export const register = async (req: Request, res: Response): Promise<void> => {
    const { email, password, displayName } = validateRegisterRequest(req.body);
    let userRecord: admin.auth.UserRecord | null = null;

    try {
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName,
      });

      const firestore = admin.firestore();
      await firestore.collection('users').doc(userRecord.uid).set({
        email,
        displayName,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // ... success response
    } catch (error: any) {
      // If user was created but firestore failed, delete the user
      if (userRecord) {
        await admin.auth().deleteUser(userRecord.uid);
      }
      // ... error handling
      throw error;
    }
  };
  ```

## Impact
- **Type**: Behavior change
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: High value (improves data consistency and robustness)

## Implementation Notes
This change will make the registration process more resilient to failures and prevent orphaned user records.

## Analysis (2025-07-17)

After examining the current code in `firebase/functions/src/auth/handlers.ts`, I can confirm the issue exists:

### Current Implementation:
```typescript
export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, displayName } = validateRegisterRequest(req.body);
  
  try {
    // Step 1: Create the user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password, 
      displayName,
    });

    // Step 2: Create user document in Firestore
    const firestore = admin.firestore();
    await firestore.collection('users').doc(userRecord.uid).set({
      email,
      displayName,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Success response...
  } catch (error: any) {
    // Only handles auth/email-already-exists
    // No cleanup of orphaned user record
  }
};
```

### Problem Identified:
1. **Two-step process**: Auth user creation → Firestore document creation
2. **No cleanup**: If Firestore creation fails, Auth user remains orphaned
3. **Inconsistent error handling**: Only handles `auth/email-already-exists`
4. **Missing transaction safety**: No rollback mechanism

## Detailed Implementation Plan

### Step 1: Add Cleanup Logic
Modify the error handling to detect orphaned user records and clean them up:

```typescript
export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, displayName } = validateRegisterRequest(req.body);
  let userRecord: admin.auth.UserRecord | null = null;

  try {
    // Step 1: Create the user in Firebase Auth
    userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
    });

    // Step 2: Create user document in Firestore
    const firestore = admin.firestore();
    await firestore.collection('users').doc(userRecord.uid).set({
      email,
      displayName,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Success response...
  } catch (error: any) {
    // Cleanup orphaned user record if it was created
    if (userRecord) {
      try {
        await admin.auth().deleteUser(userRecord.uid);
        logger.info('Cleaned up orphaned user record', { userId: userRecord.uid });
      } catch (cleanupError) {
        logger.error('Failed to cleanup orphaned user record', { 
          userId: userRecord.uid, 
          error: cleanupError 
        });
      }
    }

    // Handle specific error cases
    if (error.code === 'auth/email-already-exists') {
      res.status(HTTP_STATUS.CONFLICT).json({
        error: {
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists'
        }
      });
      return;
    }
    
    // Let other errors bubble up to global error handler
    throw error;
  }
};
```

### Step 2: Enhanced Error Handling
Add better error context and logging:

```typescript
// Enhanced error handling with context
if (error.code === 'auth/email-already-exists') {
  logger.warn('Registration failed: email already exists', { email });
  // ... existing response
} else {
  logger.error('Registration failed', { 
    email,
    userId: userRecord?.uid,
    error: error.message,
    phase: userRecord ? 'firestore-creation' : 'auth-creation'
  });
  throw error;
}
```

### Step 3: Testing Considerations
Ensure the following scenarios are tested:
1. **Happy path**: Both auth and firestore creation succeed
2. **Auth failure**: Auth creation fails (email exists, invalid password, etc.)
3. **Firestore failure**: Auth succeeds but Firestore creation fails (cleanup tested)
4. **Cleanup failure**: Verify logging when cleanup itself fails

## Implementation Approach

### Single Commit Strategy:
- **File**: `firebase/functions/src/auth/handlers.ts`
- **Changes**: Add cleanup logic and enhanced error handling
- **Testing**: Run existing tests to ensure no regressions
- **Validation**: Build and lint checks

### Risk Assessment:
- **Risk**: Low - Pure improvement to existing error handling
- **Backward compatibility**: Maintained - no API changes
- **Performance**: Minimal impact - only cleanup on failure path
- **Security**: Improved - prevents orphaned user records

### Expected Benefits:
1. **Data consistency**: No orphaned auth records
2. **Better error handling**: More comprehensive error scenarios covered
3. **Improved observability**: Better logging for debugging
4. **Robustness**: More resilient to failure scenarios

## Validation Steps:
1. Run `npm run build` to ensure no type errors
2. Run `npm test` to verify existing tests pass
3. Test registration flow in emulator
4. Verify cleanup works by simulating Firestore failures

This task addresses a real data consistency issue and can be completed in a single, focused commit.