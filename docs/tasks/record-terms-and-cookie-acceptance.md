## Task: Add Mandatory Terms and Cookie Policy Acceptance to Registration

**Goal:**
Ensure that users explicitly agree to the Terms of Service and the Cookie Policy during the registration process.

**Requirements:**
1.  **Add Checkboxes:**
    *   Add two new checkboxes to the user registration form.
    *   One checkbox labeled "I accept the Terms of Service."
    *   One checkbox labeled "I accept the Cookie Policy."
    *   The labels should link to the respective policy pages.

2.  **Mandatory Acceptance:**
    *   Both checkboxes must be checked for the registration/submit button to be enabled.
    *   The form cannot be submitted unless both are checked.

3.  **Record Acceptance:**
    *   When the user successfully registers, record their acceptance in the database.
    *   Store a boolean `true` and a timestamp for both `termsAccepted` and `cookiePolicyAccepted` in the user's profile or a related record.

**Justification:**
This is a necessary step for legal compliance and to ensure we have a clear record of user consent.

---

## Detailed Implementation Plan

### Current State Analysis
- The registration form currently has a single checkbox that combines Terms of Service and Privacy Policy
- The backend doesn't store acceptance timestamps or version information
- No validation exists for separate cookie policy acceptance

### Phase 1: Backend Changes (45 minutes)

#### 1.1 Update User Registration Validation (15 min)
**File:** `firebase/functions/src/auth/validation.ts`

**Changes:**
```typescript
const registerSchema = Joi.object({
  email: Joi.string().pattern(EMAIL_REGEX).required(),
  password: Joi.string().pattern(PASSWORD_REGEX).required(),
  displayName: displayNameSchema,
  termsAccepted: Joi.boolean().valid(true).required()
    .messages({
      'any.only': 'You must accept the Terms of Service',
      'any.required': 'Terms acceptance is required'
    }),
  cookiePolicyAccepted: Joi.boolean().valid(true).required()
    .messages({
      'any.only': 'You must accept the Cookie Policy',
      'any.required': 'Cookie policy acceptance is required'
    })
});

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  termsAccepted: boolean;
  cookiePolicyAccepted: boolean;
}
```

#### 1.2 Update Registration Handler (15 min)
**File:** `firebase/functions/src/auth/handlers.ts`

**Changes to user document creation:**
```typescript
await firestore.collection('users').doc(userRecord.uid).set({
  email,
  displayName,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  termsAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
  cookiePolicyAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
  termsVersion: "1.0",
  cookiePolicyVersion: "1.0"
});
```

#### 1.3 Update User Type Definition (15 min)
**File:** `firebase/functions/src/types/webapp-shared-types.ts`

**Add to UserData interface:**
```typescript
export interface UserData {
  // existing fields...
  termsAcceptedAt?: admin.firestore.Timestamp;
  cookiePolicyAcceptedAt?: admin.firestore.Timestamp;
  termsVersion?: string;
  cookiePolicyVersion?: string;
}
```

### Phase 2: Frontend Changes (1 hour)

#### 2.1 Update Registration Page UI (30 min)
**File:** `webapp-v2/src/pages/RegisterPage.tsx`

**Key Changes:**
1. Add new signal for cookie policy:
   ```typescript
   const agreeToCookiesSignal = signal(false);
   ```

2. Replace single checkbox with two separate checkboxes:
   ```tsx
   <div class="space-y-3">
     <label class="flex items-start">
       <input
         type="checkbox"
         checked={agreeToTermsSignal.value}
         onChange={(e) => agreeToTermsSignal.value = e.target.checked}
         class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1 flex-shrink-0"
         disabled={isSubmitting}
         required
       />
       <span class="ml-2 block text-sm text-gray-700">
         I accept the{' '}
         <a href="/v2/terms" target="_blank" class="text-blue-600 hover:text-blue-500">
           Terms of Service
         </a>
       </span>
     </label>
     
     <label class="flex items-start">
       <input
         type="checkbox"
         checked={agreeToCookiesSignal.value}
         onChange={(e) => agreeToCookiesSignal.value = e.target.checked}
         class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1 flex-shrink-0"
         disabled={isSubmitting}
         required
       />
       <span class="ml-2 block text-sm text-gray-700">
         I accept the{' '}
         <a href="/v2/cookies" target="_blank" class="text-blue-600 hover:text-blue-500">
           Cookie Policy
         </a>
       </span>
     </label>
   </div>
   ```

3. Update validation logic:
   ```typescript
   if (!agreeToTermsSignal.value) {
     return 'You must accept the Terms of Service';
   }
   if (!agreeToCookiesSignal.value) {
     return 'You must accept the Cookie Policy';
   }
   ```

4. Update form validity check:
   ```typescript
   const isFormValid = nameSignal.value.trim() && 
                      emailSignal.value.trim() && 
                      passwordSignal.value && 
                      confirmPasswordSignal.value &&
                      agreeToTermsSignal.value &&
                      agreeToCookiesSignal.value;
   ```

#### 2.2 Update Auth Store (15 min)
**File:** `webapp-v2/src/app/stores/auth-store.ts`

**Update register method signature:**
```typescript
async register(
  email: string, 
  password: string, 
  displayName: string,
  termsAccepted: boolean = true,
  cookiePolicyAccepted: boolean = true
): Promise<void>
```

**Update API call:**
```typescript
const response = await apiClient.register({
  email,
  password,
  displayName,
  termsAccepted,
  cookiePolicyAccepted
});
```

#### 2.3 Update API Client (15 min)
**File:** `webapp-v2/src/api/apiClient.ts`

**Update register request type:**
```typescript
interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  termsAccepted: boolean;
  cookiePolicyAccepted: boolean;
}
```

### Phase 3: Testing (45 minutes)

#### 3.1 E2E Test Updates (30 min)
**File:** Create new test file `e2e-tests/src/tests/normal-flow/terms-acceptance.e2e.test.ts`

**Test Cases:**
1. Should display both terms and cookie policy checkboxes
2. Should disable submit button when terms not accepted
3. Should disable submit button when cookie policy not accepted
4. Should enable submit button when both are accepted
5. Should successfully register when both policies accepted
6. Should show appropriate error messages for unchecked boxes

#### 3.2 Integration Test Updates (15 min)
**File:** `firebase/functions/__tests__/integration/user-management.test.ts`

**New Test Cases:**
```typescript
describe('Terms and Cookie Policy Acceptance', () => {
  it('should reject registration without terms acceptance', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'Test123!@#',
        displayName: 'Test User',
        termsAccepted: false,
        cookiePolicyAccepted: true
      });
    
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('Terms of Service');
  });

  it('should store acceptance timestamps in Firestore', async () => {
    // Register user
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'Test123!@#',
        displayName: 'Test User',
        termsAccepted: true,
        cookiePolicyAccepted: true
      });
    
    // Verify Firestore document
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(response.body.user.uid)
      .get();
    
    const userData = userDoc.data();
    expect(userData.termsAcceptedAt).toBeDefined();
    expect(userData.cookiePolicyAcceptedAt).toBeDefined();
    expect(userData.termsVersion).toBe('1.0');
    expect(userData.cookiePolicyVersion).toBe('1.0');
  });
});
```

### Phase 4: Documentation (15 minutes)

#### 4.1 Update Cookie Policy Page
**File:** Create `webapp-v2/public/v2/cookies.html` if it doesn't exist
- Add basic cookie policy content
- Ensure the page is accessible at `/v2/cookies`

### Implementation Order

1. **Backend first** - Implement validation and storage
2. **Frontend second** - Update UI and integrate with backend
3. **Testing third** - Verify everything works
4. **Documentation last** - Update any remaining docs

### Migration Strategy

#### Existing Users
- No immediate action required
- Existing users continue to use the app normally
- Consider future task: Prompt existing users to accept updated terms

#### Future Enhancements
1. **Versioned Terms Acceptance** (separate task)
   - Track policy versions
   - Prompt re-acceptance when policies update
   - Maintain acceptance history

2. **Admin UI** (separate task)
   - Interface to update policy links
   - View acceptance statistics
   - Export compliance reports

### Security Considerations

1. **Server-side Timestamps**
   - Use `admin.firestore.FieldValue.serverTimestamp()` to prevent client manipulation
   - Ensures accurate acceptance time for legal compliance

2. **Validation at Multiple Levels**
   - Client-side: Immediate user feedback
   - API level: Joi validation
   - Database level: Required fields

3. **Audit Trail**
   - Permanent record of acceptance
   - Timestamps cannot be modified
   - Version tracking for future policy updates

### Testing Checklist

- [ ] Manual testing of registration flow
- [ ] Both checkboxes required for submission
- [ ] Links to policies work correctly
- [ ] Error messages display appropriately
- [ ] Data correctly stored in Firestore
- [ ] E2E tests pass
- [ ] Integration tests pass
- [ ] No regression in existing registration flow

### Rollback Plan

If issues arise:
1. Revert frontend changes (single checkbox)
2. Keep backend changes (backwards compatible)
3. Fix issues in staging
4. Re-deploy when ready

### Success Metrics

- Zero registration failures due to the change
- 100% of new users have acceptance timestamps
- Compliance team approval of implementation
- No increase in registration abandonment rate
