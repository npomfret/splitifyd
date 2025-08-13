# Feature: Implement "Remember Me" Functionality

## Overview

To improve the login experience for returning users, this feature adds a "Remember Me" checkbox to the login page. When selected, the user's session will persist for an extended period, saving them from having to enter their credentials every time they visit the application.

## Key Concepts

-   **Session Persistence:** Firebase Auth provides different levels of session persistence. By default, it's set to `local`, which means the user stays signed in even after the browser is closed. This feature will make the persistence level configurable by the user.
-   **User Choice:** The user explicitly chooses whether they want their session to be remembered, which is a standard and expected feature for modern web applications.

## UI/UX Changes

### Login Page (`LoginPage.tsx`)

1.  **Add "Remember Me" Checkbox:**
    -   A new checkbox with the label "Remember Me" will be added to the login form.
    -   It should be placed between the password field and the "Sign In" button.

2.  **Layout:**
    -   The checkbox and its label should be aligned with the other form fields.

**Example Layout:**
```
Email:
[__________________]

Password:
[__________________]

[x] Remember Me

[   Sign In   ]
```

## Implementation Details

### Firebase Auth Persistence

Firebase's `setPersistence` method is the core of this feature. It allows you to control how the user's authentication state is saved.

-   **`local`:** (Default) The state persists even when the browser is closed. The user remains signed in until they explicitly sign out.
-   **`session`:** The state only persists for the current session or tab. The user is signed out when the browser is closed.
-   **`none`:** The state is not persisted at all. The user is signed out as soon as the page is reloaded.

### Logic in `auth-store.ts`

The `AuthStore` will be updated to handle the "Remember Me" choice.

1.  **Update `login` method:**
    -   The `login` method in `auth-store.ts` will be modified to accept a new boolean parameter, `rememberMe`.
    -   Before calling `signInWithEmailAndPassword`, the store will call `firebaseService.setPersistence()`.
    -   If `rememberMe` is `true`, it will set persistence to `local`.
    -   If `rememberMe` is `false`, it will set persistence to `session`.

**Example `auth-store.ts` modification:**
```typescript
// In webapp-v2/src/app/stores/auth-store.ts

class AuthStore {
  // ... existing code

  async login(email, password, rememberMe) {
    loadingSignal.value = true;
    errorSignal.value = null;

    try {
      // Set persistence based on user's choice
      const persistence = rememberMe
        ? firebase.auth.Auth.Persistence.LOCAL
        : firebase.auth.Auth.Persistence.SESSION;
      
      await firebaseService.setPersistence(persistence);

      // Proceed with sign-in
      await firebaseService.signInWithEmailAndPassword(email, password);
      
      // ... rest of the login logic
    } catch (error: any) {
      errorSignal.value = this.getAuthErrorMessage(error);
      throw error;
    } finally {
      loadingSignal.value = false;
    }
  }

  // ... rest of the store
}
```

### Connecting UI to Logic

-   In `LoginPage.tsx`, the state of the "Remember Me" checkbox will be managed using a local Preact signal (`useState` or `signal`).
-   When the login form is submitted, the value of this checkbox state will be passed to the `authStore.login()` method.

## Security Considerations

-   **Public Computers:** This feature is safe for general use. By setting persistence to `session` when "Remember Me" is unchecked, we enhance security for users on public or shared computers, as their session will be automatically cleared when the browser is closed.
-   **No Sensitive Data Stored:** This feature only controls the persistence of the Firebase authentication token. No passwords or other sensitive credentials are ever stored locally.

## Benefits

-   **Improved Convenience:** Users on trusted devices can avoid logging in repeatedly.
-   **Enhanced Security:** Users on public or shared devices can ensure their session is not persisted after they leave.
-   **Standard Feature:** Meets user expectations for a standard login flow.
