# Firebase v1 to v2 Functions Migration Report (Firestore Triggers & Node.js 22)

This report outlines the key considerations and steps for migrating Firebase Cloud Functions from v1 to v2, with a specific focus on Firestore trigger functions and leveraging Node.js 22.

## Key Changes and Benefits of v2 Functions

Firebase Cloud Functions v2 are built on Cloud Run, offering significant improvements over v1:

*   **Improved Performance and Scalability:** Faster cold starts and better concurrency due to Cloud Run's architecture.
*   **Modular Imports:** V2 functions utilize modular imports (e.g., `firebase-functions/v2/firestore`), allowing for more granular imports of specific triggers.
*   **Enhanced Event Object Structure:** The event object structure for Firestore triggers is updated, providing `event.data.after` and `event.data.before` for document snapshots.
*   **Direct Runtime Options:** Configuration options like memory and timeout are now set directly within the function definition using a configuration object.
*   **Node.js 22 Support:** V2 functions fully support Node.js 22, which is not available for v1 functions.

## Migration Steps for Firestore Triggers

### 1. Update Firebase CLI and SDKs

Ensure your development environment has the necessary updated tools:

*   **Firebase CLI:** Version 12.0.0 or higher.
*   **`firebase-functions` SDK:** Version 4.3.0 or higher in your project's `package.json`.

### 2. Update Node.js Runtime

Modify your `package.json` to specify Node.js 22 as the runtime engine:

```json
"engines": {
  "node": "22"
}
```

### 3. Update Imports

Change your function imports from the general `firebase-functions` to the new modular `firebase-functions/v2/` path. For Firestore triggers, this will look like:

**V1 Import Example:**

```javascript
const functions = require('firebase-functions');
```

**V2 Import Example:**

```javascript
const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted, onDocumentWritten } = require('firebase-functions/v2/firestore');
```

### 4. Update Trigger Definitions and Event Handling

The syntax for defining triggers and accessing event data changes significantly in v2. You'll need to adapt your function logic accordingly.

**V1 Firestore `onWrite` Trigger Example:**

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.myV1FirestoreTrigger = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    const newValue = change.after.data();
    const previousValue = change.before.data();
    const userId = context.params.userId;

    // ... logic using newValue, previousValue, userId
  });
```

**V2 Firestore `onDocumentWritten` Trigger Equivalent:**

For `onDocumentWritten`, the `event.data` object contains both `before` and `after` snapshots. You can also configure runtime options directly.

```javascript
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore(); // Initialize Firestore if needed

exports.myV2FirestoreTrigger = onDocumentWritten(
  {
    document: 'users/{userId}',
    // Optional runtime options
    // memory: '256MiB',
    // timeoutSeconds: 60,
  },
  async (event) => {
    const snapshot = event.data; // Contains both 'before' and 'after'
    const userId = event.params.userId;

    if (!snapshot) {
      console.log("No data associated with the event.");
      return;
    }

    const newValue = snapshot.after?.data();
    const previousValue = snapshot.before?.data();

    // ... logic using newValue, previousValue, userId
  }
);
```

**V2 Specific Triggers (e.g., `onDocumentCreated`):**

For more specific event handling (creation, update, deletion), use the dedicated v2 triggers:

```javascript
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore(); // Initialize Firestore if needed

exports.myV2FirestoreCreatedTrigger = onDocumentCreated('products/{productId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.log("No data associated with the event.");
    return;
  }
  const newProduct = snapshot.data();
  const productId = event.params.productId;
  console.log(`New product with ID ${productId} created:`, newProduct);
  // Perform operations for new product
});
```

### 5. Rename and Deploy

Directly upgrading a v1 function to v2 with the same name is not supported. You must rename your function in the code, deploy the new v2 function, and then delete the old v1 function.

**Deployment Workflow:**

1.  **Modify Code:** Update your function code with the new v2 syntax and assign a *new name* to the function (e.g., `myV2FirestoreTrigger`).
2.  **Deploy New Function:** Deploy the newly named v2 function using the Firebase CLI:
    `firebase deploy --only functions:myV2FirestoreTrigger`
3.  **Verify and Delete Old Function:** Once the new v2 function is successfully deployed and verified to be working as expected, delete the old v1 function:
    `firebase functions:delete myV1FirestoreTrigger`

By following these steps, you can effectively migrate your Firebase Cloud Functions with Firestore triggers to the v2 environment, taking advantage of Node.js 22 and the performance benefits of Cloud Run.