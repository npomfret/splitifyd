# TypeScript Migration Plan

This document outlines the comprehensive plan for gradually migrating the webapp to TypeScript.

## Current State

The webapp has been set up for gradual TypeScript migration with:
- ✅ TypeScript v5.8.3 installed
- ✅ Basic tsconfig.json configured for hybrid JS/TS development
- ✅ Build process supports both .js and .ts files
- ✅ Working build pipeline that copies all files and compiles any .ts files found
- ✅ All files currently remain as .js for stability

**Approach**: Hybrid migration strategy - files remain as .js until they are individually migrated to .ts with proper type annotations.

## Immediate Actions Required

### Step 1: Create Type Definitions Directory
Create a centralized location for TypeScript type definitions:

```bash
mkdir -p webapp/src/js/types
```

### Step 2: Create Global Type Definitions
Create `webapp/src/js/types/global.d.ts` with:

```typescript
// Global window extensions
declare global {
  interface Window {
    firebaseAuth: any;
    ModalComponent: any;
  }
}

// Global functions (from warning-banner.js)
declare function showWarning(message: string): void;
declare function hideWarning(): void;

// Config types
interface Config {
  apiUrl: string;
  dashboardUrl: string;
  authUrl: string;
}

export {};
```

### Step 3: Convert First Utility File
Convert `webapp/src/js/utils/safe-dom.js` to TypeScript:

1. **Rename file**: `safe-dom.js` → `safe-dom.ts`
2. **Add proper types**:
   ```typescript
   interface ValidationOptions {
     required?: boolean;
     maxLength?: number;
     minLength?: number;
     allowedPattern?: RegExp | null;
   }
   
   interface ValidationResult {
     valid: boolean;
     error?: string;
     value?: string;
   }
   
   export function createElementSafe(
     tag: string, 
     attributes: Record<string, string> = {}, 
     children: (string | Node)[] = []
   ): HTMLElement;
   
   export function validateInput(
     input: string, 
     options: ValidationOptions = {}
   ): ValidationResult;
   ```

### Step 4: Convert Logger Utility
Convert `webapp/src/js/utils/logger.js` to TypeScript:

1. **Rename file**: `logger.js` → `logger.ts`
2. **Add proper types**:
   ```typescript
   interface Logger {
     log(...args: any[]): void;
     warn(...args: any[]): void;
     error(...args: any[]): void;
   }
   
   function formatArgs(args: any[]): string[];
   export const logger: Logger;
   ```

### Step 5: Test Each Conversion
After each file conversion:

1. **Run build**: `cd webapp && npm run build`
2. **Test in browser**: Ensure functionality works
3. **Check for errors**: Look for TypeScript compilation issues
4. **Commit changes**: Small, focused commits for each file

## Priority Conversion Order

### Phase 1: Utilities (Week 1)
- [ ] `utils/safe-dom.js` → `utils/safe-dom.ts`
- [ ] `utils/logger.js` → `utils/logger.ts`
- [ ] `config.js` → `config.ts`

### Phase 2: Core Services (Week 2)
- [ ] `firebase-config.js` → `firebase-config.ts`
- [ ] `api.js` → `api.ts`
- [ ] `auth.js` → `auth.ts`

### Phase 3: Components (Week 3)
- [ ] `components/modal.js` → `components/modal.ts`
- [ ] `components/header.js` → `components/header.ts`
- [ ] `components/navigation.js` → `components/navigation.ts`
- [ ] `components/auth-card.js` → `components/auth-card.ts`

### Phase 4: Business Logic (Week 4)
- [ ] `expenses.js` → `expenses.ts`
- [ ] `groups.js` → `groups.ts`
- [ ] `dashboard.js` → `dashboard.ts`

## TypeScript Configuration Phases

### Phase 1: Type Infrastructure
- Create global type definitions
- Add proper type assertions for DOM elements
- Create interface definitions for API responses

### Phase 2: Incremental Strictness
- Enable `"noImplicitAny": true` in tsconfig.json
- Enable `"strictNullChecks": true` in tsconfig.json
- Enable `"strict": true` in tsconfig.json

### Phase 3: Modern TypeScript Features
- Convert from CommonJS to ES modules
- Add generic types where beneficial
- Implement type guards for runtime type checking

### Phase 4: Testing Integration
- Update Jest configuration to work with TypeScript
- Add types for test helpers and utilities
- Ensure test files have proper type coverage

## Common Type Patterns

### DOM Elements
```typescript
// Instead of any or HTMLElement
const input = document.getElementById('myInput') as HTMLInputElement;
const button = document.querySelector('.btn') as HTMLButtonElement;
const form = document.forms.namedItem('myForm') as HTMLFormElement;
```

### Event Handlers
```typescript
// Instead of any parameter
function handleClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  // ...
}

function handleSubmit(event: SubmitEvent): void {
  event.preventDefault();
  // ...
}
```

### API Responses
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface Group {
  id: string;
  name: string;
  members: string[];
  createdAt: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  groupId: string;
  createdAt: string;
}
```

## Implementation Strategy

1. **Hybrid Approach**: Keep files as .js until they are ready for full .ts migration
2. **File-by-File Migration**: Convert one file at a time from .js to .ts with proper types
3. **Maintain Functionality**: Ensure the app continues to work after each change
4. **Test Coverage**: Run tests after each significant change
5. **Commit Small Changes**: Make small, focused commits for each improvement
6. **Infrastructure First**: Start with utility files and type definitions before core logic

## Build Process

### Current Build Command
```bash
cd webapp && npm run build
```

### Expected Output
- JavaScript files are copied to `dist/`
- TypeScript files are compiled to `dist/`
- Build succeeds with or without `.ts` files present

### Troubleshooting
If build fails:
1. Check TypeScript errors in terminal
2. Verify type definitions are correct
3. Ensure imports/exports are properly typed
4. Use `any` temporarily for complex types

## Testing Strategy

### After Each File Conversion
1. **Build Test**: `npm run build` should succeed
2. **Manual Test**: Load affected pages in browser
3. **Console Check**: No new JavaScript errors
4. **Functionality Test**: Verify features still work

### Integration Testing
- Test form submissions
- Test API calls
- Test authentication flow
- Test expense/group operations

## Commit Strategy

### Commit Message Format
```
feat(typescript): convert [filename] to TypeScript

- Add proper type annotations
- Replace any types with specific types
- Ensure backward compatibility
- Test functionality preserved
```

### Example Commits
```
feat(typescript): convert safe-dom.js to TypeScript
feat(typescript): convert logger.js to TypeScript
feat(typescript): add global type definitions
```

## Success Criteria

### Per File
- [ ] Zero TypeScript compilation errors
- [ ] All functions have explicit parameter types
- [ ] All functions have explicit return types
- [ ] No usage of `any` except where absolutely necessary
- [ ] All DOM operations properly typed

### Overall Progress
- [ ] 5+ files successfully converted
- [ ] Global type definitions created
- [ ] Build process remains stable
- [ ] No regression in functionality
- [ ] Documentation updated for each conversion

## Getting Started Command

To begin the migration right now:

```bash
# 1. Create types directory
mkdir -p webapp/src/js/types

# 2. Create global types file
touch webapp/src/js/types/global.d.ts

# 3. Start with first utility file
cp webapp/src/js/utils/safe-dom.js webapp/src/js/utils/safe-dom.ts

# 4. Begin adding types to safe-dom.ts
```

## Next Review

Schedule a review after completing Phase 1 (utilities) to:
- Assess progress and challenges
- Adjust strategy if needed
- Plan Phase 2 approach
- Update documentation based on learnings