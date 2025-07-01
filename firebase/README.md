# Firebase Backend

A complete Firebase backend system with Cloud Functions for storing and retrieving JSON documents, including authentication and a test interface.

## Features

- **Authentication**: Firebase Auth with email/password and Google sign-in
- **Document Storage**: Cloud Functions for CRUD operations on JSON documents in Firestore
- **Security**: Authenticated endpoints with rate limiting and input validation
- **Testing Interface**: Modern HTML/CSS/JS interface for testing the API
- **TypeScript**: Fully typed backend code
- **Testing**: Comprehensive unit tests with Jest

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│  Web Interface  │────▶│  Cloud Functions │────▶│    Firestore    │
│   (Firebase     │     │   (Express +     │     │   (Document     │
│    Hosting)     │◀────│    Firebase)     │◀────│    Storage)     │
│                 │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │             │
              │  Firebase   │
              │    Auth     │
              │             │
              └─────────────┘
```

## Setup Instructions

### Prerequisites

- Node.js 20 or higher
- Firebase CLI installed globally (`npm install -g firebase-tools`)
- A Firebase project created in the [Firebase Console](https://console.firebase.google.com)

### 1. Clone and Install Dependencies

```bash
cd backend

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
- Functions: http://localhost:5001
- Firestore: http://localhost:8080
- Auth: http://localhost:9099
- Hosting: http://localhost:5000
- Emulator UI: http://localhost:4000

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

All endpoints require authentication via Firebase Auth token in the Authorization header:
```
Authorization: Bearer <firebase-id-token>
```

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
1. Open http://localhost:5000 in your browser
2. Create an account or sign in with Google
3. Use the JSON editor to create documents
4. Test all CRUD operations
5. Verify rate limiting by making rapid requests

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

1. **"Permission denied" errors**
   - Check Firestore security rules
   - Verify authentication token is valid
   - Ensure document has correct userId

2. **"Function not found" errors**
   - Verify functions are deployed
   - Check function names in firebase.json
   - Ensure project ID is correct

3. **CORS errors**
   - Verify allowed origins in CORS configuration
   - Check authentication headers
   - Use proper Content-Type headers

### Debugging

- View function logs: `npm run logs`
- Use Firebase Emulator UI at http://localhost:4000
- Check browser console for client-side errors
- Enable verbose logging in functions for debugging

## Production Considerations

1. **Environment Variables**: Use Firebase functions config for sensitive data
2. **CORS Origins**: Restrict to specific domains in production
3. **Rate Limiting**: Consider using Firebase Extensions for persistent rate limiting
4. **Monitoring**: Set up Firebase Performance Monitoring and Error Reporting
5. **Backup**: Regular Firestore backups for data recovery

## License

MIT