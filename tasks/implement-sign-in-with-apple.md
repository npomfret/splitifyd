# Implement Sign In with Apple

## Overview

This task is to add "Sign in with Apple" as an authentication method for the webapp. This will provide users with a fast and secure way to sign up and log in to the application, which can improve user acquisition and satisfaction.

## Research & Key Findings

- **Apple Developer Account Required**: A paid Apple Developer account is necessary to configure "Sign in with Apple".
- **Configuration Steps**: The process involves creating an App ID, a Service ID, and a private key in the Apple Developer portal. These are then used to configure the Apple provider in the Firebase console.
- **Firebase Integration**: Firebase provides a straightforward integration with "Sign in with Apple" through its `firebase/auth` SDK. The `OAuthProvider('apple.com')` is used to initiate the sign-in flow.
- **Client-Side Implementation**: The sign-in process can be handled using `signInWithPopup` or `signInWithRedirect`. The popup method is generally preferred for desktop web apps.
- **User Data**: Apple only provides the user's full name on the _first_ sign-in. This information must be captured and stored in our database (e.g., in the `users` collection in Firestore) if we want to access it later.
- **Private Email Relay**: Users can choose to hide their real email address. Apple provides a private relay email address (`@privaterelay.appleid.com`) that forwards to their actual email. This requires no special handling on our part, but we should be aware that the email stored in Firebase Auth may not be the user's real email.

## Implementation Plan

### Phase 1: Configuration

1.  **Apple Developer Account**:
    - Create a new App ID for Splitifyd.
    - Enable the "Sign in with Apple" capability for the App ID.
    - Create a new Service ID. The identifier for this should be something like `com.splitifyd.web`.
    - Configure the Service ID with the domain of our webapp and the Firebase authentication handler URL (`https://<your-firebase-project-id>.firebaseapp.com/__/auth/handler`).
    - Create and download a private key, making sure to securely store the `.p8` file and note the Key ID and Team ID.

2.  **Firebase Console**:
    - Navigate to the "Authentication" section of the Firebase console.
    - Enable "Apple" as a new sign-in provider.
    - Provide the Service ID, Team ID, Key ID, and the contents of the `.p8` private key file.

### Phase 2: Backend Implementation

1.  **Create a Firestore User Document on New Auth User Creation**:
    - Create a new Firebase Cloud Function that triggers on user creation (`auth.user().onCreate()`).
    - This function will be responsible for creating a corresponding user document in the `users` collection in Firestore.
    - When a new user signs up with Apple, this function will capture the `displayName` and `email` from the Firebase Auth user record and save it to the new Firestore document, ensuring our user profiles are consistent.

### Phase 3: Client-Side Implementation (webapp-v2)

1.  **Add a "Sign in with Apple" Button**:
    - In the `LoginPage.tsx` and `RegisterPage.tsx` components, add a new button for "Sign in with Apple".
    - The button's design must adhere to **Apple's Human Interface Guidelines** to ensure compliance.

2.  **Update the Authentication Store**:
    - In `webapp-v2/src/app/stores/auth-store.ts`, create a new `signInWithApple` method within the `AuthStore`.
    - This function will use `signInWithPopup` with the `OAuthProvider('apple.com')`.
    - It should request the `email` and `name` scopes to capture user information on the first login.

3.  **Error Handling**:
    - Implement error handling for common scenarios, such as the user closing the popup or other authentication failures. Display appropriate feedback to the user.
    - Specifically handle the `auth/account-exists-with-different-credential` error. When this occurs, inform the user that an account with their email already exists and prompt them to sign in with their original method to link the accounts.

### Phase 4: Testing

1.  **Manual Testing**:
    - Thoroughly test the "Sign in with Apple" flow on a staging or development environment.
    - Test both new user registration and existing user login.
    - Verify that the user's name is correctly captured on the first sign-in and saved to Firestore via the `onCreate()` trigger.
    - Test the private email relay functionality.
    - Test the account linking flow when an email already exists.

2.  **Automated Testing**:
    - Due to the external dependency on Apple's authentication service, end-to-end testing of the full "Sign in with Apple" flow is complex.
    - Focus on unit tests for the `signInWithApple` method in the `AuthStore`, mocking the Firebase `signInWithPopup` call to simulate successful and failed authentication attempts.
    - Create a new E2E test that clicks the "Sign in with Apple" button. Use **Playwright's network interception (`page.route()`)** to mock the response from Apple's authentication service. This will allow for testing the application's handling of both successful and failed sign-in attempts without depending on the external service.
