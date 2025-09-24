# Mocking Firebase Real-time Updates in Playwright

This document outlines how to test components that use Firebase real-time updates within the Playwright testing framework, as used in this project.

## The Problem

`page.route()` is used for mocking HTTP request/response cycles, but this doesn't work for Firebase's real-time updates which use a persistent connection (WebSockets). The existing tests work around this by directly manipulating the DOM, which doesn't test the application's actual real-time update logic.

## The Solution: Mocking the Firebase SDK

The recommended approach is to mock the Firebase SDK's listener function (`onValue` for Realtime Database or `onSnapshot` for Firestore) directly within the browser context using Playwright's `page.addInitScript()`.

### How it Works

1.  **`page.addInitScript()`**: This injects a script into the page _before_ any of your application code runs. This is the perfect place to replace the real Firebase functions with a mock.
2.  **Expose a "trigger" function**: The init script will also create a function on the `window` object that your test can call to simulate an update from Firebase.

## Example Implementation

```typescript
// In your Playwright test file (e.g., real-time-component.test.ts)
import { test, expect } from '@playwright/test';

test.describe('RealTimeComponent', () => {
    test.beforeEach(async ({ page }) => {
        // This script runs before your app code
        await page.addInitScript(() => {
            // 1. Create a mock onValue function
            const mockOnValue = (ref, callback) => {
                // 2. Store the callback so we can trigger it later
                window.__firebaseOnValueCallback = callback;

                // You can immediately call it with initial data if you want
                const initialSnapshot = { val: () => ({ message: 'initial data' }) };
                callback(initialSnapshot);

                // Return an empty unsubscribe function
                return () => {};
            };

            // 3. Expose a function to trigger updates from the test
            window.__triggerFirebaseUpdate = (data) => {
                if (window.__firebaseOnValueCallback) {
                    const snapshot = { val: () => data };
                    window.__firebaseOnValueCallback(snapshot);
                }
            };

            // 4. Replace the real onValue function
            // This assumes firebase/database is available on the window.
            // A more robust solution might involve mocking the module.
            // For now, we can try to intercept it.
            // NOTE: This part is tricky and depends on how your app imports firebase.
            // A more advanced approach would be to use a service worker to intercept
            // the firebase module loading.
            // For now, let's assume we can patch it on the window for this example.
            window.firebase = {
                database: () => ({
                    ref: () => ({
                        onValue: mockOnValue,
                    }),
                }),
            };
        });
    });

    test('should display initial data and update in real-time', async ({ page }) => {
        await page.goto('/your-page-with-real-time-component');

        // 1. Check for initial data
        await expect(page.locator('#message-display')).toHaveText('initial data');

        // 2. Simulate a real-time update from Firebase
        await page.evaluate(() => {
            window.__triggerFirebaseUpdate({ message: 'new real-time message' });
        });

        // 3. Assert that the UI has updated
        await expect(page.locator('#message-display')).toHaveText('new real-time message');

        // 4. Simulate another update
        await page.evaluate(() => {
            window.__triggerFirebaseUpdate({ message: 'another update' });
        });

        await expect(page.locator('#message-display')).toHaveText('another update');
    });
});
```

### Explanation

- `page.addInitScript()` sets up our mock environment before your React app loads.
- We replace the `onValue` function with a mock that saves the callback function your component provides.
- `window.__triggerFirebaseUpdate` is a helper function that we can call from our test to push new data to that saved callback, perfectly simulating a server-pushed update.
- In the test itself, we use `page.evaluate()` to call `__triggerFirebaseUpdate` and then assert that the component's UI has reacted correctly.

This approach allows you to test your component's real-time behavior in isolation, without any network dependencies, and in a way that is much more robust and realistic than manually changing the DOM.
