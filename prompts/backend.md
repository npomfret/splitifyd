# Firebase Backend with Cloud Functions - Development Prompt

Create a complete Firebase backend system with Cloud Functions for storing and retrieving JSON documents, including authentication and a test interface.

## Project Requirements

### Core Functionality
- **Authentication**: Firebase Auth with email/password and Google sign-in
- **Document Storage**: Cloud Functions for CRUD operations on JSON documents in Firestore
- **Security**: Authenticated endpoints with rate limiting and input validation
- **Testing Interface**: Simple HTML page for manual testing

### Technical Specifications
- **Runtime**: Node.js 20 (latest LTS supported by Cloud Functions)
- **Language**: TypeScript throughout
- **Database**: Firestore for document storage
- **Authentication**: Firebase Auth
- **API**: RESTful Cloud Functions (HTTP triggers)

## Project Structure
Create the following structure:
```
firebase-json-backend/
├── functions/
│   ├── src/
│   │   ├── index.ts
│   │   ├── auth/
│   │   │   └── middleware.ts
│   │   ├── documents/
│   │   │   ├── handlers.ts
│   │   │   └── validation.ts
│   │   └── utils/
│   │       └── errors.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── __tests__/
│       ├── documents.test.ts
│       └── auth.test.ts
├── public/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── firebase.json
├── .firebaserc
├── firestore.rules
├── firestore.indexes.json
└── README.md
```

## Implementation Details

### 1. Cloud Functions (functions/src/)

**index.ts** - Main entry point:
- Export HTTP cloud functions for document operations
- Include CORS handling
- Set up error handling middleware

**auth/middleware.ts**:
- Firebase Auth token verification middleware
- Rate limiting using memory store (simple implementation)
- User ID extraction from tokens

**documents/handlers.ts**:
- `createDocument(req, res)` - POST /documents
- `getDocument(req, res)` - GET /documents/{id}
- `updateDocument(req, res)` - PUT /documents/{id}
- `deleteDocument(req, res)` - DELETE /documents/{id}
- `listUserDocuments(req, res)` - GET /documents (user's documents only)

**documents/validation.ts**:
- JSON schema validation for incoming documents
- Size limits (max 1MB per document)
- Sanitization helpers

**utils/errors.ts**:
- Standardized error responses
- HTTP status code helpers

### 2. Security Rules (firestore.rules)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /documents/{documentId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && 
        request.auth.uid == request.resource.data.userId;
    }
  }
}
```

### 3. Frontend Test Interface (public/)

**index.html**:
- Clean, modern UI using CSS Grid/Flexbox
- Login/logout section with email/password and Google sign-in
- Document management interface:
    - JSON editor (textarea with syntax highlighting via highlight.js CDN)
    - Create/Read/Update/Delete buttons
    - Document list with click-to-load
- Error/success message display
- Responsive design

**app.js**:
- Firebase SDK v9+ modular syntax
- Authentication state management
- API calls to Cloud Functions
- JSON validation before sending
- Local storage for draft documents

### 4. Configuration Files

**firebase.json**:
- Functions configuration (Node.js 20, TypeScript)
- Hosting configuration for public folder
- Firestore rules and indexes

**functions/package.json**:
- Dependencies: firebase-admin, firebase-functions, express, cors, joi (validation)
- Dev dependencies: typescript, @types/*, jest, supertest
- Scripts for build, deploy, test, serve

**functions/tsconfig.json**:
- Target ES2020
- Strict mode enabled
- Include proper paths

### 5. Testing

**Unit Tests**:
- Test authentication middleware
- Test document validation
- Test CRUD operations with mocked Firestore
- Test error handling

**Integration Tests**:
- Test complete request flows
- Use Firebase emulator suite

## API Endpoints Design

```
POST /createDocument
- Body: { "data": {...} }
- Returns: { "id": "doc_id", "message": "Created" }

GET /getDocument?id={document_id}
- Returns: { "id": "doc_id", "data": {...}, "createdAt": "...", "updatedAt": "..." }

PUT /updateDocument?id={document_id}
- Body: { "data": {...} }
- Returns: { "message": "Updated" }

DELETE /deleteDocument?id={document_id}
- Returns: { "message": "Deleted" }

GET /listDocuments
- Returns: { "documents": [{"id": "...", "createdAt": "...", "preview": "..."}] }
```

## Deployment Instructions

Include detailed deployment steps:

1. **Setup**:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init
   ```

2. **Local Development**:
   ```bash
   cd functions && npm install
   firebase emulators:start
   ```

3. **Testing**:
   ```bash
   cd functions && npm test
   ```

4. **Deployment**:
   ```bash
   firebase deploy
   ```

## Additional Features

- **Rate Limiting**: Implement simple memory-based rate limiting (10 requests/minute per user)
- **Input Validation**: JSON schema validation with size limits
- **Error Handling**: Consistent error responses with proper HTTP status codes
- **Logging**: Structured logging for debugging
- **CORS**: Proper CORS configuration for web access

## Security Considerations

- All endpoints require authentication except OPTIONS requests
- Firestore rules enforce user isolation
- Input validation and sanitization
- Size limits on documents
- Rate limiting to prevent abuse

## Documentation

Create comprehensive README.md with:
- Setup instructions
- API documentation
- Testing guide
- Deployment steps
- Architecture overview
- Security notes

Generate all files with production-ready code, proper error handling, comprehensive TypeScript types, and detailed comments explaining the architecture and security measures.