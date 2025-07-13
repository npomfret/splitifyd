# User Document Initialization on First Login

## Problem Statement

Currently, the authentication system has a gap between Firebase Auth and Firestore user documents. When users register or log in for the first time, a user document in Firestore is not automatically created, which can cause issues when the dashboard tries to load user-specific data.

### Current Issues
- Dashboard assumes user documents exist in Firestore without verification
- Groups API calls may fail if user document doesn't exist 
- No automatic user document creation on first login/registration
- Authentication state inconsistency between Firebase Auth and localStorage

## Root Cause Analysis

The authentication flow in `webapp/src/js/auth.ts` contains a comment "Skip user document creation for now - can be done on first dashboard load" but this functionality was never implemented. This creates a scenario where:

1. User successfully authenticates with Firebase Auth
2. User gets redirected to dashboard with valid auth token
3. Dashboard tries to make API calls that require user document in Firestore
4. API calls fail because user document doesn't exist

## Proposed Solution

### Phase 1: Dashboard-Level User Document Creation
Implement automatic user document creation in the dashboard initialization process.

**Files to modify:**
- `webapp/src/js/dashboard.ts` - Add user document verification and creation
- `firebase/src/api/users.ts` - Add endpoint for user document creation
- `firebase/src/utils/auth.ts` - Add helper functions for user document management

**Implementation steps:**

1. **Add user document verification to dashboard initialization:**
   ```typescript
   // In dashboard.ts initializeDashboard function
   await ensureUserDocumentExists();
   ```

2. **Create user document verification function:**
   ```typescript
   async function ensureUserDocumentExists(): Promise<void> {
     try {
       const response = await api.get('/user/profile');
       // User document exists, continue
     } catch (error) {
       if (error.code === 'USER_NOT_FOUND') {
         await createUserDocument();
       } else {
         throw error; // Re-throw other errors
       }
     }
   }
   ```

3. **Implement user document creation:**
   ```typescript
   async function createUserDocument(): Promise<void> {
     const firebaseUser = authManager.getCurrentUser();
     if (!firebaseUser) {
       throw new Error('No authenticated user found');
     }
     
     await api.post('/user/create', {
       uid: firebaseUser.uid,
       email: firebaseUser.email,
       displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
       createdAt: new Date().toISOString()
     });
   }
   ```

4. **Add backend endpoint for user creation:**
   ```typescript
   // In firebase/src/api/users.ts
   export const createUser = onCall(async (request) => {
     const { uid, email, displayName } = request.data;
     
     const userDoc = {
       uid,
       email,
       displayName,
       createdAt: admin.firestore.FieldValue.serverTimestamp(),
       groups: [],
       preferences: {
         currency: 'USD',
         notifications: true
       }
     };
     
     await admin.firestore().collection('users').doc(uid).set(userDoc);
     return { success: true };
   });
   ```

### Phase 2: Authentication-Level Integration (Future Enhancement)
Move user document creation to the authentication process itself for better user experience.

**Files to modify:**
- `webapp/src/js/auth.ts` - Implement user document creation in auth flow
- `firebase/src/api/auth.ts` - Add user document creation to registration/login

### Testing Requirements

1. **Manual Testing:**
   - Delete user document from Firestore
   - Log in and verify dashboard loads correctly
   - Verify user document is created automatically
   - Verify subsequent logins work without re-creating document

2. **Automated Testing:**
   - Unit tests for user document creation functions
   - Integration tests for dashboard initialization with missing user document
   - API tests for user creation endpoint

### Error Handling

- Graceful degradation when user document creation fails
- Proper error messages for users when initialization fails
- Retry logic for network failures during user document creation
- Logging for debugging user document creation issues

### Security Considerations

- Ensure user can only create/access their own document
- Validate user data before creating document
- Use Firebase security rules to protect user documents
- Implement rate limiting for user creation endpoint

## Success Criteria

1. New users can log in and access dashboard without manual intervention
2. User documents are automatically created on first dashboard load
3. No API failures due to missing user documents
4. Existing users are not affected by the changes
5. Proper error handling for edge cases

## Estimated Effort

- **Development:** 4-6 hours
- **Testing:** 2-3 hours  
- **Documentation:** 1 hour

## Priority

**Medium** - This fixes a significant user experience issue but has a workaround (manual user document creation).

## Dependencies

- Existing authentication system must be working
- Firestore security rules should allow user document creation
- API endpoints must be properly secured

## Notes

This task addresses the remaining issue identified during the dashboard empty page investigation. While the dashboard now loads correctly, implementing proper user document creation will prevent potential API errors and improve the overall user experience.