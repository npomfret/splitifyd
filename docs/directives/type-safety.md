# Type Safety Directive

## Core Principle

**STRICT TYPE SAFETY IS MANDATORY** - This is not optional or negotiable.

## Requirements

### 1. TypeScript Configuration
- **Strict mode**: Always enabled (`"strict": true` in tsconfig.json)
- **No implicit any**: Banned (`"noImplicitAny": true`)
- **Strict null checks**: Required (`"strictNullChecks": true`)
- **Type coverage**: 100% enforced in CI

### 2. Shared Types
- All client-server communication MUST use shared TypeScript types
- Types are defined in `firebase/functions/src/shared`
- Webapp accesses via symlink: `webapp/src/shared` → `../../firebase/functions/src/shared`
- Never duplicate type definitions between client and server

### 3. Runtime Validation
- **MANDATORY**: Client MUST validate all server responses at runtime
- Verify data matches expected "shape" before using
- Use type guards or validation libraries (e.g., zod)
- Fail fast with clear errors when validation fails

### 4. API Contracts
- Generate TypeScript contracts from Firebase function definitions
- Include request and response types for every endpoint
- CI must fail on breaking changes to contracts
- No `any` types in API interfaces

### 5. Type Safety Patterns

#### Good Examples
```typescript
// Shared type definition
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

// Runtime validation
function isUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as any).id === 'string' &&
    typeof (data as any).email === 'string' &&
    typeof (data as any).name === 'string' &&
    (data as any).createdAt instanceof Date
  );
}

// API call with validation
async function getUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const data = await response.json();
  
  if (!isUser(data)) {
    throw new Error('Invalid user data from server');
  }
  
  return data;
}
```

#### Bad Examples
```typescript
// NEVER: Using any
async function getUser(id: string): Promise<any> {
  return fetch(`/api/users/${id}`).then(r => r.json());
}

// NEVER: No validation
async function getUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  return response.json() as User; // Dangerous cast!
}

// NEVER: Duplicating types
// In server: interface User { ... }
// In client: interface User { ... } // Don't duplicate!
```

## Enforcement

1. **Code Review**: Reject PRs that violate type safety
2. **CI Checks**: 
   - TypeScript strict mode compilation
   - Type coverage reports
   - API contract validation
3. **Runtime Monitoring**: Log validation failures in production

## Benefits

- Catch errors at compile time, not runtime
- Refactor with confidence
- Better IDE support and autocomplete
- Self-documenting code
- Prevents client-server contract mismatches

## Remember

> "Any use of `any` is a bug waiting to happen. Runtime validation is not optional - it's insurance against production failures."