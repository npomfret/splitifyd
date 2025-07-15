# API Documentation

This document provides a comprehensive overview of the client-server communication for the Splitifyd application. It details the API endpoints, their functionalities, and the differences between development (Firebase Emulator) and production environments.

## 1. Overview

The backend is a set of Firebase Functions written in TypeScript that expose a RESTful API. The frontend, a vanilla JavaScript application, communicates with this API to perform all its operations.

**Base URLs:**

-   **Development (Emulator):** `http://localhost:5001/{project-id}/us-central1/api`
-   **Production:** `https://us-central1-{project-id}.cloudfunctions.net/api`

The frontend dynamically determines the correct base URL by fetching a configuration object from the `/api/config` endpoint.

## 2. Authentication

All endpoints, except for the public-facing `/api/config`, `/api/health`, and `/api/status`, require authentication. Authentication is handled via Firebase Authentication ID tokens. The client is responsible for obtaining this token upon user login and including it in the `Authorization` header for all subsequent requests:

```
Authorization: Bearer <firebase-id-token>
```

The backend uses a middleware (`firebase/functions/src/auth/middleware.ts`) to verify the token before processing any protected endpoint.

## 3. API Endpoints

### 3.1. Configuration and System

-   **Endpoint:** `GET /config`
-   **Description:** Provides the client with the necessary Firebase configuration for initialization. This is the first call the web application makes.
-   **Authentication:** None
-   **Response:**
    ```json
    {
      "apiKey": "...",
      "authDomain": "...",
      "projectId": "...",
      "storageBucket": "...",
      "messagingSenderId": "...",
      "appId": "...",
      "measurementId": "..."
    }
    ```

-   **Endpoint:** `GET /env`
-   **Description:** Returns all environment variables for debugging purposes. Useful for verifying deployment configuration.
-   **Authentication:** None
-   **Response:**
    ```json
    {
      "env": {
        "NODE_ENV": "production",
        "PROJECT_ID": "splitifyd",
        "FOO": "BAR",
        ...
      }
    }
    ```
-   **Warning:** This endpoint exposes sensitive information and should only be used for debugging. Consider adding authentication or removing in production.

### 3.2. Documents (Groups)

These endpoints are used for managing groups, which are stored as documents in Firestore.

-   **Endpoint:** `POST /createDocument`
-   **Description:** Creates a new group.
-   **Authentication:** Required
-   **Request Body:**
    ```json
    {
      "data": {
        "name": "My New Group",
        "members": [
          { "uid": "user1", "name": "Alice", "email": "alice@example.com" }
        ]
      }
    }
    ```
-   **Response:**
    ```json
    {
      "id": "documentId123",
      "message": "Document created successfully"
    }
    ```

-   **Endpoint:** `GET /getDocument?id={documentId}`
-   **Description:** Retrieves a single group by its ID.
-   **Authentication:** Required
-   **Response:**
    ```json
    {
      "id": "documentId123",
      "data": { ... },
      "createdAt": "2023-10-27T10:00:00.000Z",
      "updatedAt": "2023-10-27T10:00:00.000Z"
    }
    ```

-   **Endpoint:** `PUT /updateDocument?id={documentId}`
-   **Description:** Updates an existing group.
-   **Authentication:** Required
-   **Request Body:**
    ```json
    {
      "data": {
        "name": "Updated Group Name"
      }
    }
    ```
-   **Response:**
    ```json
    {
      "message": "Document updated successfully"
    }
    ```

-   **Endpoint:** `DELETE /deleteDocument?id={documentId}`
-   **Description:** Deletes a group.
-   **Authentication:** Required
-   **Response:**
    ```json
    {
      "message": "Document deleted successfully"
    }
    ```

-   **Endpoint:** `GET /listDocuments`
-   **Description:** Lists all groups for the authenticated user.
-   **Authentication:** Required
-   **Response:**
    ```json
    {
      "documents": [ ... ],
      "count": 1,
      "hasMore": false
    }
    ```

### 3.3. Expenses

-   **Endpoint:** `POST /expenses`
-   **Description:** Creates a new expense.
-   **Authentication:** Required
-   **Request Body:**
    ```json
    {
      "groupId": "groupId123",
      "amount": 100,
      "description": "Dinner",
      "category": "food",
      "date": "2023-10-27T10:00:00.000Z",
      "splitType": "equal",
      "participants": ["user1", "user2"],
      "paidBy": "user1"
    }
    ```
-   **Response:**
    ```json
    {
      "id": "expenseId123",
      "message": "Expense created successfully"
    }
    ```

-   **Endpoint:** `GET /expenses?id={expenseId}`
-   **Description:** Retrieves a single expense.
-   **Authentication:** Required
-   **Response:** An expense object.

-   **Endpoint:** `PUT /expenses?id={expenseId}`
-   **Description:** Updates an expense.
-   **Authentication:** Required
-   **Request Body:** Partial expense object with fields to update.
-   **Response:**
    ```json
    {
      "message": "Expense updated successfully"
    }
    ```

-   **Endpoint:** `DELETE /expenses?id={expenseId}`
-   **Description:** Deletes an expense.
-   **Authentication:** Required
-   **Response:**
    ```json
    {
      "message": "Expense deleted successfully"
    }
    ```

-   **Endpoint:** `GET /expenses/group?groupId={groupId}`
-   **Description:** Lists all expenses for a specific group.
-   **Authentication:** Required
-   **Response:** A list of expense objects.

### 3.4. Users

-   **Endpoint:** `POST /register`
-   **Description:** Registers a new user.
-   **Authentication:** None
-   **Request Body:**
    ```json
    {
      "email": "test@example.com",
      "password": "password123",
      "displayName": "Test User"
    }
    ```
-   **Response:**
    ```json
    {
      "success": true,
      "message": "Account created successfully",
      "user": { ... }
    }
    ```

-   **Endpoint:** `POST /login`
-   **Description:** Logs in a user.
-   **Authentication:** None
-   **Request Body:**
    ```json
    {
      "email": "test@example.com",
      "password": "password123"
    }
    ```
-   **Response:**
    ```json
    {
      "success": true,
      "message": "Login successful",
      "user": { ... },
      "idToken": "..."
    }
    ```

## 4. Development vs. Production Differences

### 4.1. Configuration

-   **Development:** The frontend fetches its configuration from `http://localhost:5001/{project-id}/us-central1/api/config`. The Firebase SDK is configured to connect to the local emulators for Auth, Firestore, and Functions.
-   **Production:** The frontend fetches its configuration from `/api/config` (a relative path that resolves to the production Cloud Function URL). The Firebase SDK connects to the live Firebase services.

This is managed by `webapp/js/firebase-config.js`, which checks `window.location.hostname` to determine the environment.

### 4.2. CORS

-   **Development:** The CORS configuration is more permissive, allowing requests from `http://localhost:5000` and `http://localhost:5002` to facilitate local development.
-   **Production:** CORS is restricted to the Firebase Hosting domains (`https://{project-id}.web.app` and `https://{project-id}.firebaseapp.com`).

This is configured in `firebase/functions/src/middleware/cors.ts`.

### 4.3. Logging

-   **Development:** Logging is more verbose and outputs to the console.
-   **Production:** Logging is less verbose and is integrated with Google Cloud Logging for monitoring and analysis.

### 4.4. Test Data

-   The `firebase/functions/scripts/generate-test-data.js` script is used to populate the local emulator with test data. This script should **never** be run against a production environment.

## 5. Client-Side API Interaction

The `webapp/js/api.js` file provides a convenient wrapper around the `fetch` API for making requests to the backend. It handles:

-   Dynamically resolving the base URL.
-   Attaching the `Authorization` header with the user's ID token.
-   Parsing JSON responses.
-   Basic error handling.

All frontend services (e.g., `groups.js`, `expenses.js`) use this `api` object to communicate with the backend, ensuring a consistent approach to client-server communication.
