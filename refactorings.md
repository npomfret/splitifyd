# Suggested refactorings for backend

## Top 3 Refactoring Opportunities

### 1. **Simplify over-engineered rate limiting**
*Category: High Impact, Medium Complexity*

**Problem**: Firestore-based distributed rate limiting is overly complex for a simple document API, adds latency to every request.

**File affected**: `firebase/functions/src/auth/middleware.ts:21-96`

**Current issues**:
- Uses Firestore transactions for simple rate limiting (adds 50-100ms per request)
- Complex cleanup logic that runs periodically
- Stores arrays of timestamps instead of simple counters

**Solution**: Use Firebase Functions built-in rate limiting or simple in-memory rate limiting with periodic cleanup.

**Impact**: Reduces request latency, simplifies codebase, reduces Firestore read/write costs.

### 2. **Remove unnecessary abstraction layers**
*Category: Medium Impact, Easy Fix*

**Problem**: Over-abstraction creates unnecessary indirection without adding value.

**Examples**:
- `firebase/functions/src/documents/handlers.ts:18-20` - `getDocumentsCollection()` wrapper function
- `firebase/functions/src/documents/handlers.ts:22-27` - `validateUserAuth()` wrapper
- `firebase/functions/src/documents/handlers.ts:29-44` - `fetchUserDocument()` helper used only 3 times

**Solution**: Inline these simple helpers directly in the calling functions.

**Impact**: Reduces code complexity, improves readability, eliminates unnecessary abstractions.

## Additional Observations

- **Build Configuration**: TypeScript configuration is modern and appropriate
- **Dependencies**: Clean dependency list, no unnecessary packages
- **Security**: Good authentication patterns and input validation
- **Structure**: Well-organized modular structure
- **Testing**: Comprehensive test setup with Jest

The codebase is generally well-structured but suffers from over-engineering in some areas. Focus on simplifying and removing unnecessary complexity while maintaining the good security and validation patterns.