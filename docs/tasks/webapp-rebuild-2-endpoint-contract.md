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
- Shared types between frontend and backend
- Build-time validation of API compatibility
- CI fails on breaking changes
- Full type safety for all API calls

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

### Phase 3: Type-Safe API Client (2 hours)

1. **Create new typed API client** (`webapp-v2/src/app/api-client.ts`)
   - [ ] Generic fetch wrapper using contract types
   - [ ] Automatic URL parameter substitution
   - [ ] Request/response type inference
   - [ ] Error handling with typed errors

2. **Example implementation**
   ```typescript
   class ApiClient {
     async request<T extends keyof ApiContract>(
       endpoint: T,
       options: ApiRequestOptions<T>
     ): Promise<ApiContract[T]['response']> {
       // Implementation
     }
   }

   // Usage - fully typed!
   const groups = await api.request('/groups', { method: 'GET' });
   ```

3. **Migration compatibility**
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

1. **Test contract generation**
   - [ ] Run generation script
   - [ ] Verify output matches actual endpoints
   - [ ] Check types compile without errors
   - [ ] Test with TypeScript strict mode

2. **Test new API client**
   - [ ] Make request to each endpoint type
   - [ ] Verify type inference works
   - [ ] Check error handling
   - [ ] Test parameter substitution
   - [ ] Verify in browser DevTools network tab

3. **Test validation**
   - [ ] Make breaking change to function
   - [ ] Run validation script
   - [ ] Verify it catches the change
   - [ ] Test non-breaking changes pass

4. **Integration test**
   - [ ] Use new client in sample Preact component
   - [ ] Verify autocomplete works
   - [ ] Check runtime behavior matches types
   - [ ] Test error scenarios

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

## Notes

- This is critical infrastructure - take time to get it right
- Consider using existing tools like `typescript-json-schema`
- Keep generated code readable for debugging
- Plan for contract versioning in the future