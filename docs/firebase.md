# Firebase Backend

A complete Firebase backend system with Cloud Functions for document storage, built with TypeScript, Express, and comprehensive testing.

## Features

- **🔐 Authentication**: Firebase Auth with email/password and Google sign-in support.
- **📄 Document Storage**: Full CRUD operations for JSON documents in Firestore.
- **🛡️ Security**: JWT token authentication, rate limiting, input validation, and robust security headers.
- **🧪 Testing Interface**: Modern responsive web interface for API testing.
- **⚡ TypeScript**: Fully typed backend with strict type checking.
- **🔍 Testing**: Comprehensive unit tests with Jest and high code coverage.
- **🚀 Development**: Local emulator support with hot reloading.
- **📊 Monitoring**: Request logging and error tracking.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│  Web Interface  │────▶│  Cloud Functions │────▶│    Firestore    │
│   (Port 5002)   │     │   (Express API)  │     │   (Port 8080)   │
│                 │◀────│   (Port 5001)    │◀────│                 │
│                 │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │             │
              │ Firebase    │
              │ Auth        │
              │ (Port 9099) │
              │             │
              └─────────────┘
```

### Key Components

- **Express API**: TypeScript-based REST API with middleware for authentication, CORS, and security headers.
- **Firebase Auth**: JWT token-based authentication with emulator support.
- **Firestore**: NoSQL document database with security rules and indexes.
- **Test Interface**: HTML/CSS/JS frontend for manual API testing.

## Setup and Configuration

For detailed instructions on setting up your development environment, configuring Firebase, environment variables, security rules, and deployment, please refer to the main [CONFIGURATION_GUIDE.md](../CONFIGURATION_GUIDE.md).

## API Documentation

Base URL: `http://localhost:5001/{project-id}/us-central1/api` (local) or `https://us-central1-{project-id}.cloudfunctions.net/api` (production)

All endpoints require authentication via a Firebase Auth ID token in the `Authorization` header:

```
Authorization: Bearer <firebase-id-token>
```

### Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check (no auth required) |
| POST | `/createDocument` | Create a new document |
| GET | `/getDocument?id={id}` | Retrieve a document by ID |
| PUT | `/updateDocument?id={id}` | Update an existing document |
| DELETE | `/deleteDocument?id={id}` | Delete a document |
| GET | `/listDocuments` | List all user's documents |

### Example Requests

**Create Document**

```http
POST /createDocument
Content-Type: application/json
Authorization: Bearer <firebase-id-token>

{
  "data": {
    "any": "json",
    "structure": true
  }
}
```

**Get Document**

```http
GET /getDocument?id=<document-id>
Authorization: Bearer <firebase-id-token>
```

## Running Tests

Navigate to the `firebase/functions` directory to run tests:

```bash
cd firebase/functions
npm test
# With coverage
npm run test:coverage
# Watch mode
npm run test:watch
# Run API endpoint tests (local)
npm run test:endpoints:local
# Run API endpoint tests (production - update URL in script first)
npm run test:endpoints:prod
```

## Troubleshooting and Debugging

For common issues, debugging tips, and how to interpret logs, please refer to [LOCAL_DEBUGGING.md](LOCAL_DEBUGGING.md).

## Project Structure

```
firebase/
├── functions/                 # Cloud Functions source code
│   ├── src/                   # TypeScript source files
│   │   ├── auth/              # Authentication handlers and middleware
│   │   ├── documents/         # Document CRUD operations
│   │   ├── utils/             # Utility functions (e.g., security, logging)
│   │   └── index.ts           # Main function entry point
│   ├── __tests__/             # Unit and integration tests
│   ├── package.json           # Functions dependencies and scripts
│   └── tsconfig.json          # TypeScript configuration for functions
├── public/                    # Static hosting files (web app)
│   ├── index.html             # Main HTML file for the test interface
│   ├── js/                    # JavaScript files for the web app
│   └── css/                   # CSS files for styling
├── firebase.json              # Firebase project configuration
├── firestore.rules            # Firestore security rules
├── firestore.indexes.json     # Firestore database indexes
├── package.json               # Root Firebase project dependencies and scripts
└── LOCAL_DEBUGGING.md         # Guide for local debugging
```

## License

MIT
