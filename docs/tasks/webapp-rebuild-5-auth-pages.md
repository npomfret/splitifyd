# Webapp Rebuild Task 5: Migrate Authentication Pages

## Overview
Migrate all authentication pages (login, register, reset password) to Preact with proper form handling, validation, and Firebase Auth integration.

## Prerequisites
- [ ] Working Preact app with basic routing (already have this)
- [ ] Firebase Auth configured in Preact app
- [ ] API client ready for auth endpoints

## Current State
- Three separate HTML pages for auth
- Form validation in vanilla JS
- Direct Firebase Auth SDK usage
- Manual error message display
- No loading states management

## Target State
- Reusable auth components
- Reactive form validation
- Centralized auth state management
- Consistent error handling
- Smooth loading states

## Implementation Steps

### Phase 1: Auth State Management (2 hours)

1. **Auth store** (`webapp-v2/src/app/stores/auth-store.ts`)
   ```typescript
   interface AuthStore {
     user: User | null;
     loading: boolean;
     error: string | null;
     login: (email: string, password: string) => Promise<void>;
     register: (email: string, password: string, name: string) => Promise<void>;
     logout: () => Promise<void>;
     resetPassword: (email: string) => Promise<void>;
   }
   ```

2. **Firebase Auth integration**
   - [ ] Set up auth state listener
   - [ ] Handle token management
   - [ ] Persist auth state
   - [ ] Handle auth redirects

3. **Auth context provider**
   - [ ] Wrap app with auth provider
   - [ ] Provide auth state globally
   - [ ] Handle loading states
   - [ ] Implement auth guards

### Phase 2: Shared Auth Components (2 hours)

1. **Form components** (`components/auth/`)
   ```
   components/auth/
   ├── AuthLayout.tsx       # Shared layout for auth pages
   ├── AuthForm.tsx         # Base form component
   ├── EmailInput.tsx       # Email field with validation
   ├── PasswordInput.tsx    # Password with strength meter
   ├── SubmitButton.tsx     # Loading state button
   └── ErrorMessage.tsx     # Consistent error display
   ```

2. **Validation utilities**
   - [ ] Email validation
   - [ ] Password strength check
   - [ ] Confirm password match
   - [ ] Real-time validation
   - [ ] Error message mapping

3. **Loading states**
   - [ ] Button loading spinner
   - [ ] Form disable during submit
   - [ ] Skeleton screens
   - [ ] Progress indicators

### Phase 3: Login Page (2 hours)

1. **Login component** (`pages/LoginPage.tsx`)
   - [ ] Email/password form
   - [ ] Remember me checkbox
   - [ ] Forgot password link
   - [ ] Social login buttons (if used)
   - [ ] Register link

2. **Login functionality**
   - [ ] Form submission handler
   - [ ] Validation before submit
   - [ ] Error handling
   - [ ] Success redirect
   - [ ] Remember user preference

3. **UI/UX enhancements**
   - [ ] Auto-focus email field
   - [ ] Enter key submission
   - [ ] Clear error on retry
   - [ ] Show/hide password toggle

### Phase 4: Register Page (2 hours)

1. **Register component** (`pages/RegisterPage.tsx`)
   - [ ] Name, email, password fields
   - [ ] Password confirmation
   - [ ] Terms acceptance checkbox
   - [ ] Marketing opt-in
   - [ ] Login link

2. **Registration flow**
   - [ ] Multi-step if needed
   - [ ] Email verification setup
   - [ ] Profile creation
   - [ ] Welcome email trigger
   - [ ] Initial setup redirect

3. **Password requirements**
   - [ ] Minimum length check
   - [ ] Complexity requirements
   - [ ] Real-time feedback
   - [ ] Strength indicator
   - [ ] Clear requirements list

### Phase 5: Reset Password Page (1 hour)

1. **Reset password component** (`pages/ResetPasswordPage.tsx`)
   - [ ] Email input form
   - [ ] Success message display
   - [ ] Back to login link
   - [ ] Rate limiting notice

2. **Reset flow**
   - [ ] Send reset email
   - [ ] Handle success state
   - [ ] Error handling
   - [ ] Prevent spam
   - [ ] Clear instructions

### Phase 6: Protected Routes (1 hour)

1. **Route guards**
   - [ ] Require auth for protected pages
   - [ ] Redirect to login if needed
   - [ ] Remember intended destination
   - [ ] Handle auth loading state

2. **Post-auth redirects**
   - [ ] Return to intended page
   - [ ] Default to dashboard
   - [ ] Handle deep links
   - [ ] Clear redirect after use

## In-Browser Testing Checklist

### Form Validation Testing

1. **Email validation**
   - [ ] Invalid format shows error
   - [ ] Valid format accepted
   - [ ] Error clears on correction
   - [ ] Case insensitive

2. **Password validation**
   - [ ] Too short shows error
   - [ ] Weak password warning
   - [ ] Strong password indicated
   - [ ] Confirmation match required

3. **Form submission**
   - [ ] Cannot submit with errors
   - [ ] Loading state during submit
   - [ ] Errors display clearly
   - [ ] Success redirects properly

### Authentication Flow Testing

1. **Registration flow**
   - [ ] New user can register
   - [ ] Duplicate email prevented
   - [ ] Verification email sent
   - [ ] Auto-login after register
   - [ ] Profile created correctly

2. **Login flow**
   - [ ] Valid credentials work
   - [ ] Invalid password error
   - [ ] Unknown email error
   - [ ] Remember me works
   - [ ] Logout clears session

3. **Password reset**
   - [ ] Email sent successfully
   - [ ] Invalid email handled
   - [ ] Rate limiting works
   - [ ] Reset link works
   - [ ] Can login with new password

### Cross-Page Testing

1. **Navigation**
   - [ ] Login → Register works
   - [ ] Register → Login works
   - [ ] All → Forgot password works
   - [ ] Back navigation handled

2. **State persistence**
   - [ ] Auth state maintained
   - [ ] Refresh keeps login
   - [ ] Logout clears everywhere
   - [ ] No auth leaks

### Error Scenarios

1. **Network errors**
   - [ ] Offline handling
   - [ ] Timeout handling
   - [ ] Retry mechanism
   - [ ] Clear error messages

2. **Firebase errors**
   - [ ] Rate limiting
   - [ ] Service unavailable
   - [ ] Invalid configuration
   - [ ] Quota exceeded

### Mobile Testing

- [ ] Forms usable on small screens
- [ ] Keyboard doesn't cover inputs
- [ ] Touch-friendly buttons
- [ ] Auto-capitalize/correct appropriate
- [ ] Password managers work

## Deliverables

1. **Three auth pages** fully migrated
2. **Reusable auth components**
3. **Auth state management**
4. **Form validation system**
5. **Protected route system**

## Success Criteria

- [ ] All auth flows working
- [ ] Validation matches original
- [ ] Better UX than original
- [ ] Consistent error handling
- [ ] Mobile-friendly forms
- [ ] No security regressions

## Security Considerations

1. **Password handling**
   - Never log passwords
   - Clear on unmount
   - Use secure inputs
   - No autocomplete on sensitive fields

2. **Token management**
   - Secure storage only
   - Clear on logout
   - Refresh handling
   - XSS protection

3. **Rate limiting**
   - Implement locally
   - Show user feedback
   - Exponential backoff
   - Clear error messages

## Timeline

- Start Date: TBD
- End Date: TBD
- Duration: ~9 hours

## Notes

- Auth is critical - test thoroughly
- Consider adding MFA support
- Plan for social login future
- Monitor auth failures closely