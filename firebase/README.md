# Firebase JSON Backend

A complete Firebase backend system with Cloud Functions for document storage, built with TypeScript, Express, and comprehensive testing. Features secure authentication, rate limiting, and a modern test interface.

## Features

- **🔐 Authentication**: Firebase Auth with email/password and Google sign-in support
- **📄 Document Storage**: Full CRUD operations for JSON documents in Firestore
- **🛡️ Security**: JWT token authentication, rate limiting, and input validation with Joi
- **🧪 Testing Interface**: Modern responsive web interface for API testing
- **⚡ TypeScript**: Fully typed backend with strict type checking
- **🔍 Testing**: Comprehensive unit tests with Jest and 90%+ coverage
- **🚀 Development**: Local emulator support with hot reloading
- **📊 Monitoring**: Request logging and error tracking

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

- **Express API**: TypeScript-based REST API with middleware for auth and CORS
- **Firebase Auth**: JWT token-based authentication with emulator support
- **Firestore**: NoSQL document database with security rules
- **Test Interface**: HTML/CSS/JS frontend for manual API testing

## Setup Instructions

### Prerequisites

- Node.js 20 or higher
- Firebase CLI installed globally (`npm install -g firebase-tools`)
- A Firebase project created in the [Firebase Console](https://console.firebase.google.com)

### 1. Clone and Install Dependencies

```bash
# Navigate to the Firebase project directory
cd firebase

# Install root dependencies
npm install

# Install function dependencies
cd functions
npm install
cd ..
```

### 2. Configure Firebase

1. Update `.firebaserc` with your project ID:
```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

2. Update `public/app.js` with your Firebase configuration:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

3. Enable Authentication providers in Firebase Console:
   - Go to Authentication > Sign-in method
   - Enable Email/Password
   - Enable Google sign-in

### 3. Local Development

```bash
# Start the Firebase emulators
npm run serve

# In a separate terminal, watch for TypeScript changes
cd functions
npm run build:watch
```

The emulators will start:
- **Hosting (Test Interface)**: http://localhost:5002
- **Functions API**: http://localhost:5001
- **Firestore Database**: http://localhost:8080
- **Firebase Auth**: http://localhost:9099
- **Emulator UI Dashboard**: http://localhost:4000

### 4. Running Tests

```bash
cd functions
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### 5. Deployment

```bash
# Deploy everything
npm run deploy

# Deploy only functions
npm run deploy:functions

# Deploy only hosting
npm run deploy:hosting

# Deploy only Firestore rules
npm run deploy:rules
```

## API Documentation

Base URL: `http://localhost:5001/{project-id}/us-central1/api` (local) or `https://us-central1-{project-id}.cloudfunctions.net/api` (production)

All endpoints require authentication via Firebase Auth token in the Authorization header:
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

### Create Document
```
POST /createDocument
Content-Type: application/json

{
  "data": {
    "any": "json",
    "structure": true,
    "nested": {
      "values": "allowed"
    }
  }
}

Response:
{
  "id": "generated-document-id",
  "message": "Document created successfully"
}
```

### Get Document
```
GET /getDocument?id=<document-id>

Response:
{
  "id": "document-id",
  "data": { ... },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Update Document
```
PUT /updateDocument?id=<document-id>
Content-Type: application/json

{
  "data": {
    "updated": "content"
  }
}

Response:
{
  "message": "Document updated successfully"
}
```

### Delete Document
```
DELETE /deleteDocument?id=<document-id>

Response:
{
  "message": "Document deleted successfully"
}
```

### List Documents
```
GET /listDocuments

Response:
{
  "documents": [
    {
      "id": "document-id",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "preview": "{\"first\":\"100 characters of JSON...\"}"
    }
  ],
  "count": 10
}
```

## Security Measures

### Authentication
- All endpoints require valid Firebase Auth tokens
- Token verification on every request
- User isolation - users can only access their own documents

### Rate Limiting
- 10 requests per minute per user
- In-memory storage (resets on function cold start)
- Returns 429 status when exceeded

### Input Validation
- JSON schema validation using Joi
- Document size limit: 1MB
- Sanitization of potentially dangerous properties

### Firestore Security Rules
- Users can only read/write their own documents
- Document must include required fields (userId, data, timestamps)
- No access to other users' data

## Error Handling

All errors follow a consistent format:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {} // Optional additional information
  }
}
```

Common error codes:
- `UNAUTHORIZED` - No authentication token provided
- `INVALID_TOKEN` - Authentication token is invalid
- `INVALID_INPUT` - Request body validation failed
- `DOCUMENT_TOO_LARGE` - Document exceeds 1MB limit
- `NOT_FOUND` - Document not found
- `RATE_LIMIT_EXCEEDED` - Too many requests

## Testing Guide

### Unit Tests
Tests are located in `functions/__tests__/` and cover:
- Authentication middleware
- Document validation
- CRUD operations
- Error handling

### Manual Testing
1. Open http://localhost:5002 in your browser
2. Check the debug panel to verify emulator connections
3. Create an account or sign in with Google
4. Use the JSON editor to create documents
5. Test all CRUD operations with the provided buttons
6. Verify rate limiting by making rapid requests
7. Check the browser console for detailed logs

### Integration Testing with Emulators
The Firebase emulators provide a complete local environment:
- Test authentication flows
- Verify Firestore security rules
- Test Cloud Functions locally
- No risk to production data

## Performance Considerations

- **Cold Starts**: First request may be slower as functions initialize
- **Document Size**: Keep documents under 1MB for optimal performance
- **Rate Limiting**: Prevents abuse but resets on cold starts
- **Indexes**: Composite indexes configured for userId + timestamp queries

## Troubleshooting

### Common Issues

1. **401 Unauthorized errors**
   - Frontend and backend must use same auth emulator
   - Check if `connectAuthEmulator` is called in frontend
   - Verify bearer token format: `Bearer <token>`
   - Auth emulator starts with empty user database

2. **400 Bad Request on login**
   - Create a new account first (auth emulator has no users initially)
   - Check Firebase configuration in `public/app.js`
   - Verify auth emulator is running on port 9099

3. **CORS errors**
   - Verify allowed origins in CORS configuration
   - Check authentication headers are properly set
   - Use proper Content-Type headers for JSON requests

4. **Function deployment issues**
   - Run `npm run build` in functions directory first
   - Check function names match exports in `index.ts`
   - Verify project ID is correct in `.firebaserc`

5. **Emulator connection issues**
   - Check ports aren't in use by other services
   - Restart emulators with `firebase emulators:start`
   - Clear browser cache if auth persists between sessions

### Debugging

```bash
# View function logs
npm run logs

# Check Firebase CLI version
firebase --version

# Validate firebase.json configuration
firebase use --add

# Test functions locally
cd functions && npm test
```

- **Emulator UI**: http://localhost:4000 for visual debugging
- **Browser Console**: Check for client-side JavaScript errors
- **Function Logs**: Real-time logs visible in terminal during emulator run
- **Network Tab**: Inspect HTTP requests/responses in browser dev tools

## Production Considerations

1. **Environment Variables**: Use Firebase functions config for sensitive data
2. **CORS Origins**: Restrict to specific domains in production
3. **Rate Limiting**: Consider Redis-based rate limiting for persistence across cold starts
4. **Monitoring**: Set up Firebase Performance Monitoring and Error Reporting
5. **Backup**: Regular Firestore backups for data recovery
6. **Security Rules**: Review and test Firestore security rules thoroughly
7. **Performance**: Consider caching strategies for frequently accessed documents
8. **Cost Optimization**: Monitor function execution time and optimize for cold starts

## Project Structure

```
firebase/
├── functions/                 # Cloud Functions source code
│   ├── src/
│   │   ├── auth/             # Authentication middleware
│   │   ├── documents/        # Document CRUD handlers
│   │   ├── utils/            # Utility functions and error handling
│   │   └── index.ts          # Main function exports
│   ├── __tests__/            # Unit tests
│   ├── package.json          # Function dependencies
│   └── tsconfig.json         # TypeScript configuration
├── public/                   # Static hosting files
│   ├── index.html           # Test interface
│   ├── app.js               # Frontend JavaScript
│   └── style.css            # Styling
├── firebase.json            # Firebase configuration
├── firestore.rules          # Firestore security rules
├── firestore.indexes.json   # Database indexes
└── package.json            # Root dependencies
```

## License

MIT