# Configuration Guide

This guide details the various configuration aspects of the Splitifyd project, covering both development and production environments, with a strong emphasis on security.

It's helpful to have the firebase cli installed. Use: `npm install -g firebase-tools`

## 1. Environment Variables

Environment variables are crucial for managing sensitive information and environment-specific settings. They are loaded from `.env` files in the `firebase/functions` directory.

**Important:** Never commit `.env` files to version control. Use `.env.example` as a template.

### `firebase/functions/.env.example`

This file serves as a template for all environment variables used by Firebase Functions. Copy it to `.env` and customize it for your specific environment.

### Webapp Environment Variables

The webapp loads its environment configuration at runtime from a `.env.development` or `.env.production` file. These files are not committed to the repository. The `webapp/src/js/utils/env-loader.ts` script is responsible for fetching and parsing these files.

#### General Configuration
- `NODE_ENV`: Defines the environment (e.g., `development`, `test`, `production`). This impacts logging, CORS, and security headers.
- `GCLOUD_PROJECT`: Your Firebase project ID. Required for production deployments.

#### CORS Configuration
- `CORS_ALLOWED_ORIGINS`: Comma-separated list of allowed origins for CORS.
  - **Development:** Typically `http://localhost:3000,http://localhost:5000` (or other local development servers).
  - **Production:** Should be restricted to your official Firebase Hosting domains (e.g., `https://your-project-id.web.app,https://your-project-id.firebaseapp.com`).

#### Logging Configuration
- `LOG_LEVEL`: Logging verbosity (`debug`, `info`, `warn`, `error`).
- `STRUCTURED_LOGGING`: Enable structured JSON logging (recommended for production).
- `INCLUDE_STACK_TRACE`: Include stack traces in error logs (disable in production for security).
- `VERBOSE_LOGGING`: Enable verbose logging.

#### Firebase Client Configuration
These variables are used to configure the Firebase SDK on the client-side. They are fetched dynamically by the web application.
- `FIREBASE_API_KEY` (or `API_KEY` in `firebase/functions/src/config.ts`): Your Firebase Web API Key.
- `FIREBASE_AUTH_DOMAIN`: Your Firebase Auth Domain.
- `FIREBASE_STORAGE_BUCKET`: Your Firebase Storage Bucket.
- `FIREBASE_MESSAGING_SENDER_ID`: Your Firebase Messaging Sender ID.
- `FIREBASE_APP_ID`: Your Firebase App ID.
- `FIREBASE_MEASUREMENT_ID`: Your Firebase Measurement ID (optional).

#### Security Configuration
- `RATE_LIMIT_WINDOW_MS`: Time window for rate limiting in milliseconds.
- `RATE_LIMIT_MAX_REQUESTS`: Maximum requests allowed within the window.
- `RATE_LIMIT_CLEANUP_MS`: Cleanup interval for rate limiting.
- `MAX_REQUEST_SIZE_BYTES`: Maximum allowed request body size.
- `MAX_OBJECT_DEPTH`: Maximum depth for nested JSON objects in requests.
- `MAX_STRING_LENGTH`: Maximum length for string values in requests.
- `MAX_PROPERTY_COUNT`: Maximum number of properties in an object in requests.

#### Monitoring Configuration
- `ENABLE_HEALTH_CHECKS`: Enable health check endpoints.
- `ENABLE_METRICS`: Enable performance metrics collection.
- `SLOW_REQUEST_THRESHOLD_MS`: Threshold for slow requests.
- `HEALTH_CHECK_TIMEOUT_MS`: Timeout for health checks.

#### Firebase Emulator Ports
- `FIREBASE_AUTH_EMULATOR_PORT`: Port for Firebase Auth Emulator (default: 9099).
- `FIRESTORE_EMULATOR_PORT`: Port for Firestore Emulator (default: 8080).
- `FIREBASE_FUNCTIONS_EMULATOR_PORT`: Port for Functions Emulator (default: 5001).

## 2. Firebase Project Configuration (`firebase.json`)

The `firebase/firebase.json` file defines the core structure and behavior of your Firebase project.

- **`functions`**: Configures Firebase Cloud Functions.
  - `source`: Directory containing function source code (`functions`).
  - `codebase`: Identifies the codebase (`default`).
  - `ignore`: Files/directories to ignore during deployment (e.g., `node_modules`).
  - `predeploy`: Scripts to run before deployment (e.g., `npm run build`).
- **`hosting`**: Configures Firebase Hosting.
  - `public`: Directory to deploy (`public`).
  - `ignore`: Files/directories to ignore.
  - `headers`: Custom HTTP headers for hosted content (e.g., `Cache-Control`).
  - `rewrites`: URL rewrites (e.g., `/api/**` to `api` function).
- **`firestore`**: Configures Firestore.
  - `rules`: Path to Firestore security rules (`firestore.rules`).
  - `indexes`: Path to Firestore indexes (`firestore.indexes.json`).
- **`emulators`**: Configures Firebase Emulators for local development.

## 3. Firestore Security Rules (`firestore.rules`)

Located at `firebase/firestore.rules`, these rules define who can access your Firestore data and under what conditions.

**Current Rules Summary:**
- Users can only access (read/write/create) their own documents in the `/documents` collection.
- For document creation, the `userId` in the request data must match the authenticated user's UID, and specific fields (`userId`, `data`, `createdAt`, `updatedAt`) must be present.
- Listing documents is also restricted to the authenticated user's own documents.

**Security Best Practice:** Regularly review and test your Firestore security rules to ensure they align with your application's access control requirements and prevent unauthorized data access.

## 4. Firestore Indexes (`firestore.indexes.json`)

Located at `firebase/firestore.indexes.json`, this file defines composite indexes for your Firestore database. These are essential for efficient querying, especially for queries involving multiple fields or ordering.

**Current Indexes Summary:**
- Indexes for `documents` collection group, ordered by `userId` and `createdAt` (descending).
- Indexes for `documents` collection group, ordered by `userId` and `updatedAt` (descending).

## 5. Firebase Functions Configuration (`firebase/functions/src/config.ts`)

This TypeScript file centralizes the configuration for Firebase Functions, reading values from environment variables and defining default/derived settings.

- **Environment Detection**: Automatically detects `production`, `development`, and `test` environments based on `NODE_ENV` and Firebase-specific environment variables.
- **Rate Limiting**: Configures rate limiting parameters, with different `maxRequests` for production and development.
- **Validation Limits**: Defines limits for request body size, object depth, string length, and property count to prevent abuse and ensure data integrity. These limits are stricter in production.
- **Emulator Ports**: Configures ports for Firebase emulators, allowing dynamic connection in development.
- **Firebase Client Config**: Gathers Firebase client configuration values, which are then exposed to the web application.

## 6. CORS Configuration (`firebase/functions/src/middleware/cors.ts`)

The CORS (Cross-Origin Resource Sharing) middleware ensures that your Firebase Functions API can only be accessed from authorized web origins.

- **Production Mode**:
  - `origin`: Strictly validates against `https://{projectId}.web.app` and `https://{projectId}.firebaseapp.com`.
  - `credentials`: `true` (allows cookies/auth headers).
  - `methods`: `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`.
  - `allowedHeaders`: `Content-Type`, `Authorization`, `X-Correlation-Id`.
  - `exposedHeaders`: `X-Correlation-Id`.
  - `maxAge`: 24 hours for preflight requests.
- **Development Mode**:
  - `origin`: `true` (allows all origins for local development ease).
  - Other settings are similar to production.

**Security Best Practice:** Always ensure that `CORS_ALLOWED_ORIGINS` in production is set to the absolute minimum required origins to prevent unauthorized access to your API.

## 7. Security Headers (`firebase/functions/src/middleware/security-headers.ts`)

This middleware applies various HTTP security headers to enhance the application's security posture against common web vulnerabilities.

**Always Applied Headers:**
- `X-Content-Type-Options: nosniff`: Prevents browsers from MIME-sniffing a response away from the declared content-type.
- `X-Frame-Options: DENY`: Prevents clickjacking by disallowing the page from being rendered in an iframe.
- `X-XSS-Protection: 1; mode=block`: Enables the browser's XSS filter.
- `Referrer-Policy: strict-origin-when-cross-origin`: Controls how much referrer information is sent with requests.
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`: Disables access to sensitive browser features.

**Production Only Headers:**
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`: Enforces HTTPS for a specified duration, preventing downgrade attacks.
- `Content-Security-Policy`: Restricts resource loading to trusted sources, mitigating XSS and data injection attacks.
  - **Current CSP (Server-side):**
    - `default-src 'self'`
    - `script-src 'self' https://apis.google.com https://www.gstatic.com`
    - `style-src 'self' https://fonts.googleapis.com`
    - `font-src 'self' https://fonts.gstatic.com`
    - `img-src 'self' data: https:`
    - `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com`
    - `frame-ancestors 'none'`
    - `report-uri /csp-violation-report`

**Security Best Practice:** The server-side CSP is robust. However, there's a known issue with client-side CSP.

### Client-Side Content Security Policy (CSP) Issue

**Problem:** The client-side CSP, as noted in `todo/insecure-client-side-csp.md`, uses `'unsafe-inline'` for `script-src` and `style-src`, and `'unsafe-eval'` for `script-src`. These directives significantly weaken XSS protection.

**Solution (Recommended):** Implement a nonce-based CSP.
1.  Generate a unique, cryptographically strong nonce for each page load on the server-side.
2.  Include this nonce in the `Content-Security-Policy` header (e.g., `script-src 'nonce-YOUR_NONCE_HERE'`).
3.  Add the same nonce as an attribute to all inline `<script>` and `<style>` tags (e.g., `<script nonce="YOUR_NONCE_HERE">`).
This allows only scripts/styles with the correct nonce to execute, effectively mitigating inline script/style injection.

## 8. Client-Side Configuration (`webapp/js/firebase-config.js`, `webapp/js/config.js`)

The web application dynamically fetches its Firebase configuration from the backend.

- `webapp/js/firebase-config.js`:
  - Manages Firebase initialization on the client.
  - Fetches Firebase configuration from the `/api/config` endpoint exposed by Firebase Functions.
  - Connects to Firebase Auth emulator if in a local environment.
  - Exposes Firebase Auth functions globally (`window.firebaseAuth`).
- `webapp/js/config.js`:
  - Provides methods to get the API URL and other configuration details, relying on `firebaseConfigManager`.

**Security Note:** While Firebase client configuration values are generally safe to be public (as they are protected by Firebase Security Rules), it's good practice to fetch them dynamically from a trusted source (like your own Firebase Function) rather than hardcoding them directly into the client-side code.

## 9. Input Validation and Sanitization (`firebase/functions/src/utils/security.ts`)

The `security.ts` utility file provides functions to check for and sanitize dangerous patterns in user input.

- `checkForDangerousPatterns`: Identifies common XSS and prototype pollution patterns.
- `sanitizeString`: Removes script tags and JavaScript URI schemes.
- `isDangerousProperty`: Checks for properties that could lead to prototype pollution.

**Security Best Practice:** While these utilities are helpful, comprehensive input validation and sanitization should be applied at all API entry points to prevent various injection attacks. The `todo/incomplete-input-sanitization.md` suggests this is an area for further improvement.

## 10. Deployment Configuration

The `package.json` file in the root of the project contains scripts for building and deploying the application.

- **`npm run build`**: Builds all the packages in the monorepo.
- **`npm run dev`**: Starts the Firebase emulators and the webapp in development mode.
- **`npm run deploy:prod`**: Deploys the entire project to production (requires `firebase use splitifyd`).

## 11. Local Development Setup

To run the project locally using Firebase Emulators:

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Start the emulators:**
    ```bash
    npm run dev
    ```
    This will start the Firebase emulators for Auth, Firestore, Functions, and Hosting. The web application will be served from `http://localhost:5002` (or the port specified in `firebase.json`).

This comprehensive guide should help in understanding and managing the configuration and security of the Splitifyd project.
