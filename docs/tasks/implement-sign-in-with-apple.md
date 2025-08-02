# Implement Sign In with Apple

## Overview

This task is to add "Sign in with Apple" as an authentication method for the webapp. This will provide users with a fast and secure way to sign up and log in to the application, which can improve user acquisition and satisfaction.

## Research & Key Findings

- **Apple Developer Account Required**: A paid Apple Developer account is necessary to configure "Sign in with Apple".
- **Configuration Steps**: The process involves creating an App ID, a Service ID, and a private key in the Apple Developer portal. These are then used to configure the Apple provider in the Firebase console.
- **Firebase Integration**: Firebase provides a straightforward integration with "Sign in with Apple" through its `firebase/auth` SDK. The `OAuthProvider('apple.com')` is used to initiate the sign-in flow.
- **Client-Side Implementation**: The sign-in process can be handled using `signInWithPopup` or `signInWithRedirect`. The popup method is generally preferred for desktop web apps.
- **User Data**: Apple only provides the user's full name on the *first* sign-in. This information must be captured and stored in our database (e.g., in the `users` collection in Firestore) if we want to access it later.
- **Private Email Relay**: Users can choose to hide their real email address. Apple provides a private relay email address (`@privaterelay.appleid.com`) that forwards to their actual email. This requires no special handling on our part, but we should be aware that the email stored in Firebase Auth may not be the user's real email.

## Implementation Plan

### Phase 1: Configuration

1.  **Apple Developer Account**:
    *   Create a new App ID for Splitifyd.
    *   Enable the "Sign in with Apple" capability for the App ID.
    *   Create a new Service ID. The identifier for this should be something like `com.splitifyd.web`.
    *   Configure the Service ID with the domain of our webapp and the Firebase authentication handler URL (`https://<your-firebase-project-id>.firebaseapp.com/__/auth/handler`).
    *   Create and download a private key, making sure to securely store the `.p8` file and note the Key ID and Team ID.

2.  **Firebase Console**:
    *   Navigate to the "Authentication" section of the Firebase console.
    *   Enable "Apple" as a new sign-in provider.
    *   Provide the Service ID, Team ID, Key ID, and the contents of the `.p8` private key file.

### Phase 2: Client-Side Implementation (webapp-v2)

1.  **Add a "Sign in with Apple" Button**:
    *   In the `LoginPage.tsx` and `RegisterPage.tsx` components, add a new button for "Sign in with Apple". This should be styled according to Apple's branding guidelines.

2.  **Create an Authentication Handler**:
    *   In `webapp-v2/src/api/auth.ts`, create a new function `signInWithApple`.
    *   This function will use `signInWithPopup` with the `OAuthProvider('apple.com')`.
    *   It should request the `email` and `name` scopes.

3.  **Handle User Data**:
    *   After a successful sign-in, check if this is a new user.
    *   If it is a new user, and the `displayName` is available from the Apple sign-in result, save it to the user's profile in Firestore.
    *   The user should be redirected to the dashboard upon successful login.

4.  **Error Handling**:
    *   Implement error handling for common scenarios, such as the user closing the popup or other authentication failures. Display appropriate feedback to the user.

### Phase 3: Testing

1.  **Manual Testing**:
    *   Thoroughly test the "Sign in with Apple" flow on a staging or development environment.
    *   Test both new user registration and existing user login.
    *   Verify that the user's name is correctly captured on the first sign-in.
    *   Test the private email relay functionality.

2.  **Automated Testing**:
    *   Due to the external dependency on Apple's authentication service, end-to-end testing of the full "Sign in with Apple" flow is complex.
    *   We should focus on unit tests for our `signInWithApple` function, mocking the Firebase `signInWithPopup` call to simulate successful and failed authentication attempts.
    *   We can create a new E2E test that clicks the "Sign in with Apple" button and verifies that the application attempts to open the Apple sign-in popup, but we will need to mock the response from Apple to proceed further.

