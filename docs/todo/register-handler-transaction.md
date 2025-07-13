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