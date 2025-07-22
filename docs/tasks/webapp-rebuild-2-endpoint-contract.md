# Webapp Rebuild Task 2: Generate and Enforce Endpoint Contracts

## Overview
Extract TypeScript types from Firebase functions to create a strict contract between frontend and backend, with CI enforcement to prevent breaking changes.

## Prerequisites
- [ ] Complete webapp-rebuild-0-recon.md
- [ ] Understand current API structure from `webapp/src/js/api.ts`

## Current State
- API endpoints defined in `firebase/functions/src/index.ts`
- Frontend makes untyped fetch calls through `api.ts`
- No compile-time validation of API contracts
- Easy to break API compatibility accidentally

## Target State
- Auto-generated TypeScript contract from function definitions
- Shared types between frontend and backend (via symlink to `firebase/functions/src/shared`)
- Build-time validation of API compatibility
- CI fails on breaking changes
- Full type safety for all API calls
- **MANDATORY**: Runtime validation that server responses match expected types
- **MANDATORY**: TypeScript strict mode with 100% type coverage
- **MANDATORY**: No `any` types in API contracts

## Implementation Steps

### Phase 1: Analyze Current Endpoints (2 hours)

1. **Extract endpoint inventory**
   - [ ] Parse `firebase/functions/src/index.ts`
   - [ ] List all HTTP endpoints (onRequest functions)
   - [ ] Document HTTP methods (GET, POST, etc.)
   - [ ] Map URL patterns to function names

2. **Identify request/response types**
   - [ ] Find TypeScript interfaces for each endpoint
   - [ ] Note any endpoints missing types
   - [ ] Document query parameters and headers
   - [ ] Identify shared types between endpoints

3. **Current endpoint list** (from initial analysis):
   ```
   Auth:
   - POST /auth/register
   - POST /auth/login
   - POST /auth/logout
   - POST /auth/reset-password

   Groups:
   - GET /groups
   - POST /groups
   - GET /groups/:id
   - PUT /groups/:id
   - DELETE /groups/:id
   - POST /groups/:id/join

   Expenses:
   - GET /groups/:groupId/expenses
   - POST /groups/:groupId/expenses
   - GET /expenses/:id
   - PUT /expenses/:id
   - DELETE /expenses/:id

   Balances:
   - GET /groups/:groupId/balances
   - GET /groups/:groupId/simplified-debts
   ```

### Phase 2: Create Contract Generator (3 hours)

1. **Set up extraction script** (`scripts/generate-api-contract.ts`)
   - [ ] Use TypeScript compiler API to parse functions
   - [ ] Extract function signatures and types
   - [ ] Generate contract interface for each endpoint
   - [ ] Output to `shared/api-contract.ts`

2. **Contract structure**
   ```typescript
   export interface ApiContract {
     '/auth/register': {
       method: 'POST';
       request: RegisterRequest;
       response: RegisterResponse;
     };
     '/groups': {
       method: 'GET';
       request: never;
       response: Group[];
     } | {
       method: 'POST';
       request: CreateGroupRequest;
       response: Group;
     };
     // ... etc
   }
   ```

3. **Handle edge cases**
   - [ ] URL parameters (`:id`, `:groupId`)
   - [ ] Query parameters
   - [ ] Optional fields
   - [ ] Union types for multiple methods
   - [ ] Error response types

### Phase 3: Type-Safe API Client with Runtime Validation (3 hours)

1. **Create new typed API client** (`webapp-v2/src/app/api-client.ts`)
   - [ ] Generic fetch wrapper using contract types
   - [ ] Automatic URL parameter substitution
   - [ ] Request/response type inference
   - [ ] Error handling with typed errors
   - [ ] **MANDATORY**: Runtime validation of all server responses
   - [ ] **MANDATORY**: Type guards to verify response shape matches expected type

2. **Example implementation with runtime validation**
   ```typescript
   class ApiClient {
     async request<T extends keyof ApiContract>(
       endpoint: T,
       options: ApiRequestOptions<T>
     ): Promise<ApiContract[T]['response']> {
       const response = await fetch(endpoint, options);
       const data = await response.json();
       
       // MANDATORY: Runtime validation
       const validator = getValidator(endpoint, options.method);
       if (!validator(data)) {
         throw new ApiValidationError(
           `Response from ${endpoint} does not match expected type`,
           validator.errors
         );
       }
       
       return data as ApiContract[T]['response'];
     }
   }

   // Usage - fully typed AND runtime validated!
   const groups = await api.request('/groups', { method: 'GET' });
   ```

3. **Runtime validation tools**
   - [ ] Use `zod` or similar for runtime type checking
   - [ ] Generate validators from TypeScript types
   - [ ] Provide detailed error messages for validation failures
   - [ ] Log validation errors for debugging

4. **Migration compatibility**
   - [ ] Create adapter for old `api.ts` format
   - [ ] Ensure both can coexist during migration
   - [ ] Add deprecation warnings for old API

### Phase 4: Validation and CI (2 hours)

1. **Build-time validation**
   - [ ] Script to compare current vs previous contract
   - [ ] Detect breaking changes (removed fields, type changes)
   - [ ] Allow non-breaking changes (new optional fields)
   - [ ] Generate change report

2. **CI integration** (`.github/workflows/api-contract.yml`)
   - [ ] Run contract generation on PR
   - [ ] Compare against main branch contract
   - [ ] Fail if breaking changes detected
   - [ ] Post comment with API changes

3. **Developer workflow**
   - [ ] Add npm script: `npm run api:generate`
   - [ ] Add pre-commit hook for contract updates
   - [ ] Document process in README

### Phase 5: Missing Types and Cleanup (2 hours)

1. **Add missing types**
   - [ ] Review untyped endpoints
   - [ ] Add request/response interfaces
   - [ ] Validate against actual usage
   - [ ] Test with real data

2. **Improve existing types**
   - [ ] Replace `any` with specific types
   - [ ] Add JSDoc comments for clarity
   - [ ] Ensure consistent naming conventions
   - [ ] Add validation schemas where needed

## In-Browser Testing Checklist

**MANDATORY**: Follow the browser testing directive for ALL testing.

1. **Test contract generation**
   - [ ] Run generation script
   - [ ] Verify output matches actual endpoints
   - [ ] Check types compile without errors
   - [ ] Test with TypeScript strict mode
   - [ ] **NO console errors or warnings**

2. **Test new API client - IN BROWSER**
   - [ ] Open DevTools Console and Network tabs
   - [ ] Make request to each endpoint type
   - [ ] Verify type inference works
   - [ ] Check error handling shows proper messages
   - [ ] Test parameter substitution
   - [ ] Verify in Network tab:
     - [ ] Correct request URLs
     - [ ] Proper request headers
     - [ ] Expected response status codes
     - [ ] Response payloads match types
   - [ ] **Screenshot successful API calls**
   - [ ] **Screenshot error states**

3. **Test runtime validation - IN BROWSER**
   - [ ] Intentionally break server response shape
   - [ ] Verify validation catches the error
   - [ ] Check console shows clear validation error
   - [ ] Ensure app doesn't crash on invalid data
   - [ ] Test validation for each endpoint type
   - [ ] **Screenshot validation error messages**

4. **Cross-browser integration test**
   - [ ] Chrome: Full test suite
   - [ ] Firefox: Full test suite  
   - [ ] Safari: Full test suite
   - [ ] Mobile viewport: Test responsive behavior
   - [ ] Use new client in sample Preact component
   - [ ] Verify autocomplete works in IDE
   - [ ] Check runtime behavior matches types
   - [ ] Test error scenarios:
     - [ ] Network offline
     - [ ] 500 server errors
     - [ ] Malformed responses
     - [ ] Timeout scenarios

## Deliverables

1. **`shared/api-contract.ts`** - Generated contract file
2. **`scripts/generate-api-contract.ts`** - Generation script
3. **`webapp-v2/src/app/api-client.ts`** - Type-safe client
4. **`.github/workflows/api-contract.yml`** - CI workflow
5. **Documentation** - How to update contracts

## Success Criteria

- [ ] All endpoints have TypeScript types
- [ ] Contract generation is automated
- [ ] New API client provides full type safety
- [ ] CI catches breaking changes
- [ ] Zero runtime overhead
- [ ] Autocomplete works for all API calls

## Common Issues & Solutions

1. **Complex Firebase function signatures**
   - May need custom parser for Firebase-specific patterns
   - Consider generating from OpenAPI spec instead

2. **Dynamic routes**
   - Use template literal types for parameters
   - Generate helper functions for URL building

3. **Backwards compatibility**
   - Keep old and new contracts during migration
   - Use feature flags to switch between them

4. **Type complexity**
   - Keep generated types simple
   - Move complex logic to runtime validation

## Timeline

- Start Date: TBD
- End Date: TBD
- Duration: ~9 hours

## Detailed Implementation Plan (2025-07-22)

### Task Analysis
After reviewing the codebase:
- API endpoints are well-defined in `firebase/functions/src/index.ts`
- Client API calls exist in `webapp/src/js/api.ts` with some types
- Shared types already exist via symlink structure
- Strong foundation for generating contracts

### Simplified Approach
Based on the "minimalist" and "YAGNI" principles from directives:

1. **Phase 1: Manual Contract Definition (2 hours)**
   - Manually create initial API contract types
   - Use existing types from `webapp/src/js/types/api.ts`
   - Focus on critical endpoints first
   - Skip complex code generation initially

2. **Phase 2: Runtime Validation (3 hours)**
   - Implement zod schemas for API responses
   - Create validation wrapper for fetch calls
   - Add clear error messages for validation failures
   - Test validation in browser with real API calls

3. **Phase 3: Type-Safe Client (2 hours)**
   - Build simple typed fetch wrapper
   - Use contract types for full type safety
   - Ensure autocomplete works in IDE
   - Keep it minimal - no fancy abstractions

4. **Phase 4: Integration & Testing (2 hours)**
   - Test with real Firebase emulator
   - Verify all endpoints work
   - Document usage patterns
   - Create migration guide from old api.ts

### Small Commits Strategy
1. **Commit 1**: Define core API contract types
2. **Commit 2**: Add zod schemas and validation
3. **Commit 3**: Implement type-safe client
4. **Commit 4**: Add tests and documentation
5. **Commit 5**: Integration with webapp-v2

### Risk Mitigation
- Start with manual types (can automate later)
- Use existing shared types structure
- Test incrementally with real API
- Keep old API client during transition

## Notes

- This is critical infrastructure - take time to get it right
- Consider using existing tools like `typescript-json-schema`
- Keep generated code readable for debugging
- Plan for contract versioning in the future