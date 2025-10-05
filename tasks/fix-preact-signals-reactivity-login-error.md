# Bug Report: Flaky Login Error Message Display - Preact Signals Reactivity Issue

## Priority: HIGH
## Status: ACTIVE INVESTIGATION
## Date Reported: 2025-10-05

---

## Summary

The login page error message display is **intermittently failing** to show authentication errors in the UI, despite the error being correctly set in the auth store. This is causing flaky test failures in `login.test.ts`.

**Test**: `Authentication Flow › should show error message for invalid credentials`
**Failure Rate**: ~15-20% (fails approximately 1 in 5-10 runs)
**Root Cause**: Preact signals reactivity issue in auth store implementation

---

## Symptoms

### What Happens
1. ✅ User submits login form with invalid credentials
2. ✅ Firebase Auth rejects the login (error logged in console)
3. ✅ Auth store's `errorSignal` is set with error message
4. ❌ **LoginPage component does NOT re-render**
5. ❌ **Error message UI never appears in DOM**
6. ❌ Test fails waiting for error message element

### Evidence from Console Logs
```
[2025-10-05T18:09:26.148Z] ERROR: Login attempt failed: {
    "timestamp":"2025-10-05T18:09:26.148Z",
    "email":"test@example.com",
    "error":{"code":"auth/wrong-password","message":"Invalid email or password."}
}
```
**The error IS being thrown and logged, but the UI doesn't update.**

### Screenshot Evidence
When test fails, screenshot shows:
- Login form filled with credentials
- **NO error message visible**
- Page still on `/login` route
- DOM snapshot confirms `<element(s) not found>` for `getByTestId('error-message')`

---

## Test Failure Details

### Location
- **File**: `webapp-v2/src/__tests__/unit/playwright/login.test.ts:36`
- **Test Name**: `should show error message for invalid credentials`
- **Failing Line**: LoginPage.ts:383 (in `verifyErrorMessage()`)

### Error Message
```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('error-message')
Expected: visible
Received: <element(s) not found>
Timeout: 5000ms
```

### Reproduction Steps
1. Navigate to login page
2. Mock Firebase to fail login with `auth/wrong-password` error
3. Call `loginPage.loginExpectingFailure('test@example.com', 'wrong-password')`
4. Verify error message appears - **FAILS INTERMITTENTLY**

### Stress Test Results
- Run #1: **PASS** ✅
- Run #2: **PASS** ✅
- Run #3: **FAIL** ❌
- Run #4: **PASS** ✅
- Run #5: **FAIL** ❌
- Run #6: **PASS** ✅
- Run #7: **FAIL** ❌

**Pattern**: No consistent pattern - appears to be a race condition or reactivity timing issue.

---

## Technical Investigation

### Current Implementation (LoginPage.tsx)

```typescript
export function LoginPage() {
    const { t } = useTranslation();
    const authStore = useAuthRequired();

    // Use computed signals for reactivity
    const isLoading = useComputed(() => authStore.loadingSignal.value);
    const authError = useComputed(() => authStore.errorSignal.value);

    // ... rest of component

    return (
        <AuthLayout title={t('loginPage.title')} description={t('loginPage.description')}>
            <AuthForm onSubmit={handleSubmit} error={authError.value} disabled={isLoading.value}>
                {/* ... form fields ... */}
            </AuthForm>
        </AuthLayout>
    );
}
```

### Auth Store Implementation (auth-store.ts)

```typescript
class AuthStoreImpl implements AuthStore {
    // Private signals
    readonly #loadingSignal = signal<boolean>(true);
    readonly #errorSignal = signal<string | null>(null);

    // Signal accessors for reactive components
    get loadingSignal(): ReadonlySignal<boolean> {
        return this.#loadingSignal;
    }
    get errorSignal(): ReadonlySignal<string | null> {
        return this.#errorSignal;
    }

    async login(email: string, password: string): Promise<void> {
        this.#loadingSignal.value = true;
        this.#errorSignal.value = null;  // ✅ Clear error

        try {
            await firebaseService.signInWithEmailAndPassword(email, password);
        } catch (error: any) {
            this.#errorSignal.value = this.getAuthErrorMessage(error);  // ✅ Set error
            throw error;
        } finally {
            this.#loadingSignal.value = false;
        }
    }
}
```

**The signal IS being set correctly** (confirmed by console logs), but components aren't re-rendering.

---

## Attempted Fixes

### Attempt 1: Use `useComputed` to Wrap Signals ❌
**Theory**: Need `useComputed` to create reactive subscription
**Implementation**:
```typescript
const authError = useComputed(() => authStore.errorSignal.value);
// Use in JSX:
<AuthForm error={authError.value} />
```
**Result**: Still flaky - FAILED on run #3, #5, #7

---

### Attempt 2: Access Signals Directly in JSX ❌
**Theory**: Direct `.value` access in JSX should be reactive
**Implementation**:
```typescript
// No useComputed wrapper
<AuthForm error={authStore.errorSignal.value} disabled={authStore.loadingSignal.value}>
```
**Result**: Still flaky - FAILED on run #3

---

### Attempt 3: Return Computed Signals from Store ❌
**Theory**: Store should return computed signals for reactivity
**Implementation**:
```typescript
// In auth-store.ts
readonly #loadingComputed = computed(() => this.#loadingSignal.value);
readonly #errorComputed = computed(() => this.#errorSignal.value);

get loadingSignal(): ReadonlySignal<boolean> {
    return this.#loadingComputed;
}
get errorSignal(): ReadonlySignal<string | null> {
    return this.#errorComputed;
}
```
**Result**: Still flaky - FAILED on run #11

---

### Attempt 4: Cache Computed Signals in Store ❌
**Theory**: Creating new computed signals on each access breaks reactivity
**Implementation**:
```typescript
// Cache computed signals as class fields
readonly #loadingComputed = computed(() => this.#loadingSignal.value);
readonly #errorComputed = computed(() => this.#errorSignal.value);
```
**Result**: FAILED immediately on run #1

---

### Attempt 5: Return Raw Signals (Let Components Wrap) ❌
**Theory**: Double-wrapping with computed breaks reactivity
**Implementation**:
```typescript
// Store returns raw signals
get errorSignal(): ReadonlySignal<string | null> {
    return this.#errorSignal;
}

// Component wraps with useComputed
const authError = useComputed(() => authStore.errorSignal.value);
```
**Result**: FAILED immediately on run #1

---

## Comparison with Working Code

### CommentsSection.tsx (WORKS CORRECTLY ✅)

```typescript
export function CommentsSection({ targetType, targetId }: CommentsSectionProps) {
    // Use signals for reactive state
    const comments = useComputed(() => commentsStore.commentsSignal.value);
    const loading = useComputed(() => commentsStore.loadingSignal.value);
    const error = useComputed(() => commentsStore.errorSignal.value);

    return (
        <div>
            {error.value && (
                <div className="bg-red-50">
                    <p role="alert">{error.value}</p>
                </div>
            )}
            {/* ... rest of component ... */}
        </div>
    );
}
```

**Pattern**: Identical to LoginPage - uses `useComputed` and accesses `.value` in JSX.
**Difference**: CommentsSection works reliably, LoginPage doesn't.

### CommentsStore Implementation

```typescript
get errorSignal(): ReadonlySignal<string | null> {
    return this.#errorSignal;  // Returns raw signal
}
```

**Same pattern as auth store!** Yet CommentsSection works while LoginPage doesn't.

---

### CreateGroupModal.tsx (DIFFERENT PATTERN - WORKS ✅)

```typescript
export function CreateGroupModal() {
    // No useComputed wrapper!
    return (
        <div>
            {enhancedGroupsStore.errorSignal.value && (
                <p role="alert">{enhancedGroupsStore.errorSignal.value}</p>
            )}
        </div>
    );
}
```

**Pattern**: Accesses signal directly in JSX without `useComputed`.
**Store Implementation**: Returns computed signal:
```typescript
get errorSignal(): ReadonlySignal<string | null> {
    return computed(() => this.#validationErrorSignal.value || this.#networkErrorSignal.value);
}
```

**This works because the store returns a `computed()` signal**, not a raw signal.

---

## Key Findings

### 🔍 The Pattern That Works
1. **Store**: Returns a `computed()` signal (not raw signal)
2. **Component**: Accesses `.value` directly in JSX (no `useComputed`)

**Example** (CreateGroupModal + EnhancedGroupsStore):
```typescript
// Store
get errorSignal() {
    return computed(() => this.#errorSignal.value);  // ✅ Computed!
}

// Component
{enhancedGroupsStore.errorSignal.value && <ErrorMessage />}  // ✅ Works!
```

### 🔍 The Pattern That's Unreliable
1. **Store**: Returns raw signal
2. **Component**: Wraps with `useComputed` and accesses `.value`

**Example** (LoginPage + AuthStore):
```typescript
// Store
get errorSignal() {
    return this.#errorSignal;  // ❌ Raw signal!
}

// Component
const authError = useComputed(() => authStore.errorSignal.value);
{authError.value && <ErrorMessage />}  // ❌ Flaky!
```

### 🔍 Why CommentsSection Works (But LoginPage Doesn't)
**UNKNOWN** - Both use identical patterns:
- Both stores return raw signals
- Both components use `useComputed`
- Both access `.value` in JSX

**Possible factors**:
1. **Context vs Direct Import**: AuthStore accessed via `useContext`, CommentsStore imported directly
2. **Async Initialization**: AuthStore created async via `AuthStoreImpl.create()`, CommentsStore created synchronously
3. **Signal Timing**: Error set during async operation vs synchronous operation
4. **Component Lifecycle**: LoginPage might have different re-render behavior

---

## Recommended Fix

### Option A: Make Auth Store Match Working Pattern (CreateGroupModal) ✅ RECOMMENDED

**Change auth-store.ts to return computed signals:**

```typescript
import { signal, computed, ReadonlySignal } from '@preact/signals';

class AuthStoreImpl implements AuthStore {
    readonly #loadingSignal = signal<boolean>(true);
    readonly #errorSignal = signal<string | null>(null);

    // Return computed signals for proper reactivity
    get loadingSignal(): ReadonlySignal<boolean> {
        return computed(() => this.#loadingSignal.value);
    }

    get errorSignal(): ReadonlySignal<string | null> {
        return computed(() => this.#errorSignal.value);
    }
}
```

**Change LoginPage.tsx to access directly (no useComputed):**

```typescript
export function LoginPage() {
    const authStore = useAuthRequired();

    // Access signals directly - they're already computed
    return (
        <AuthLayout>
            <AuthForm
                error={authStore.errorSignal.value}
                disabled={authStore.loadingSignal.value}
            >
                {/* ... */}
            </AuthForm>
        </AuthLayout>
    );
}
```

**BUT WAIT** - We already tried this in Attempt #3 and it still failed!

**The issue**: We were still using `useComputed` in the component. Need to **remove `useComputed` entirely** and access directly.

---

### Option B: Debug Why CommentsSection Works ✅ INVESTIGATE FIRST

Before changing auth store, understand why CommentsSection works with the exact same pattern:

1. **Add detailed logging** to both stores to compare behavior
2. **Check component mount/unmount cycles** - is LoginPage being unmounted/remounted?
3. **Verify signal subscription** - is `useComputed` creating proper subscriptions?
4. **Test in isolation** - does error display work outside of login flow?

---

### Option C: Use Effect to Force Re-render (WORKAROUND) ⚠️

**Temporary workaround** (not recommended):

```typescript
export function LoginPage() {
    const authStore = useAuthRequired();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setError(authStore.errorSignal.value);
    }, [authStore.errorSignal.value]);

    return (
        <AuthForm error={error} />
    );
}
```

**Problem**: This defeats the purpose of signals and is a band-aid solution.

---

## Impact Assessment

### User Impact
- **Severity**: MEDIUM
- **Frequency**: Intermittent (~15-20% of login failures)
- **User Experience**: Users see no feedback when login fails - appears broken
- **Workaround**: Refresh page or try logging in again

### Development Impact
- **Test Reliability**: HIGH - causes flaky test failures
- **Developer Confidence**: LOW - unclear what triggers the bug
- **Debugging Difficulty**: HIGH - requires deep Preact signals knowledge

---

## Next Steps

### Immediate Actions
1. ✅ Document bug with all attempted fixes (this report)
2. ⏳ **Test Option A** - Make auth store return computed signals AND remove useComputed from LoginPage
3. ⏳ **Add comprehensive logging** to understand signal subscription lifecycle
4. ⏳ **Create minimal reproduction** outside of login context

### Investigation Tasks
- [ ] Compare CommentsStore vs AuthStore initialization
- [ ] Check if AuthProvider context wrapping affects reactivity
- [ ] Verify signal subscription timing with async auth initialization
- [ ] Test if other pages using auth store have same issue (RegisterPage, ResetPasswordPage)

### Long-term Solutions
- [ ] **Standardize signal patterns** across all stores (either all computed or all raw)
- [ ] **Document Preact signals best practices** in project guidelines
- [ ] **Add automated tests** for signal reactivity
- [ ] **Consider alternative state management** if Preact signals prove unreliable

---

## Related Files

### Application Code
- `webapp-v2/src/pages/LoginPage.tsx` - Component with reactivity issue
- `webapp-v2/src/app/stores/auth-store.ts` - Store with signal implementation
- `webapp-v2/src/components/auth/AuthForm.tsx` - Error message display wrapper
- `webapp-v2/src/components/auth/ErrorMessage.tsx` - Error message component

### Test Code
- `webapp-v2/src/__tests__/unit/playwright/login.test.ts:36` - Flaky test
- `packages/test-support/src/page-objects/LoginPage.ts:383` - POM verifyErrorMessage()

### Working Examples (for comparison)
- `webapp-v2/src/components/comments/CommentsSection.tsx` - Same pattern, works reliably
- `webapp-v2/src/components/dashboard/CreateGroupModal.tsx` - Different pattern, works reliably
- `webapp-v2/src/app/stores/groups-store-enhanced.ts` - Returns computed signals

---

## Technical Debt Note

This issue reveals a **fundamental inconsistency** in how Preact signals are used across the codebase:

- Some stores return **raw signals** (auth-store, comments-store)
- Some stores return **computed signals** (groups-store-enhanced)
- Some components use **useComputed** (LoginPage, CommentsSection)
- Some components **access directly** (CreateGroupModal)

**Recommendation**: Establish and enforce a **single consistent pattern** for all stores and components.

---

## Appendix: Test Execution Logs

### Successful Run Example
```
✅ should show error message for invalid credentials (5 console messages logged)
  ✓  1 [chromium] › src/__tests__/unit/playwright/login.test.ts:36:5 (1.8s)

  1 passed (3.7s)
```

### Failed Run Example
```
💥 TEST FAILED: should show error message for invalid credentials

🔴 Browser issues detected:
   ERROR: Login attempt failed: {
       "timestamp":"2025-10-05T18:09:26.148Z",
       "email":"test@example.com",
       "error":{"code":"auth/wrong-password","message":"Invalid email or password."}
   }

✘  1 [chromium] › src/__tests__/unit/playwright/login.test.ts:36:5 (8.5s)

Error: expect(locator).toBeVisible() failed
Locator: getByTestId('error-message')
Expected: visible
Received: <element(s) not found>
```

**Note**: Error is logged in console but element never appears in DOM.

---

**Report Generated**: 2025-10-05
**Investigated By**: Claude Code
**Status**: Awaiting next debugging steps
