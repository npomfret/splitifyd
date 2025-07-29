# Package and TypeScript Setup Cleanup

## Overview

This document outlines cleanup opportunities for the monorepo's package and TypeScript configuration that would improve consistency and maintainability without requiring the complex ES modules migration.

## Current State Analysis

The codebase is a monorepo with three main packages:
- `firebase/functions` - CommonJS, Firebase Functions backend
- `webapp` - CommonJS, original web application  
- `webapp-v2` - ES modules, new web application

## Cleanup Opportunities

### 1. Standardize TypeScript Versions

**Current State:**
- Root: `typescript@^5.8.3`
- Firebase: `typescript@^5.8.3`
- Webapp: `typescript@^5.7.2`
- Webapp-v2: `typescript@^5.3.3`

**Action:** Align all packages to `typescript@^5.8.3`

**Benefits:**
- Consistent TypeScript features across packages
- Avoid version-specific bugs
- Simplified dependency management

### 2. Fix Missing shared-types Module

**Current State:**
- TypeScript configs reference `@bill-splitter/shared-types`
- The `shared-types` directory doesn't exist
- Path mappings point to non-existent files

**Action:** Either:
- Remove all references to `@bill-splitter/shared-types`, OR
- Create a proper shared types package

**Benefits:**
- Remove broken imports
- Clear type sharing strategy

### 3. Consolidate Test Infrastructure

**Current State:**
- Firebase & Webapp: Jest with ts-jest
- Webapp-v2: Vitest
- Root: Has Jest dependencies but no configuration

**Action:** 
- Document why different test runners are used
- Consider standardizing on one test runner
- If keeping both, clearly document the rationale

**Benefits:**
- Reduced learning curve
- Consistent test patterns
- Simplified CI/CD

### 4. Document Module Resolution Strategy

**Current State:**
- webapp-v2 uses ES modules (`"type": "module"`)
- Other packages use CommonJS
- This is intentional due to Firebase Functions constraints

**Action:** Create clear documentation explaining:
- Why webapp-v2 uses ES modules
- Why Firebase Functions must use CommonJS
- How the build process handles this split

**Benefits:**
- Avoid confusion about "incomplete" migration
- Clear architectural decisions

### 5. TypeScript Configuration Improvements

**Current State:**
- Inconsistent compiler options
- Some configs have `strict: true`, others don't
- Different module resolution strategies

**Action:**
- Enable `strict: true` everywhere
- Standardize common compiler options
- Fix webapp's `module: "ES2020"` to `"ESNext"`
- Consider TypeScript project references for better monorepo support

**Benefits:**
- Better type safety
- Faster incremental builds
- Consistent development experience

### 6. Standardize Node Engine Requirements

**Current State:**
- Root, Firebase, Webapp: Node 22
- Webapp-v2: Node >=20

**Action:** Standardize to `"node": "22"` in all package.json files

**Benefits:**
- Consistent runtime behavior
- Clear deployment requirements
- Avoid Node version issues

### 7. Build Process Optimization

**Current State:**
- Each package has similar but separate build scripts
- Duplicate build:check patterns
- No shared build utilities

**Action:**
- Create shared build scripts at root level
- Implement TypeScript project references
- Consider build caching strategies

**Benefits:**
- Faster builds
- DRY principle
- Easier maintenance

### 8. Dependency Hoisting

**Current State:**
- Multiple packages declare the same dev dependencies
- Duplicate installations in node_modules

**Action:** 
- Move common dev dependencies to root package.json
- Use workspace features for deduplication
- Keep runtime dependencies in individual packages

**Benefits:**
- Smaller node_modules
- Faster npm install
- Version consistency

### 9. Add Root TypeScript Configuration

**Current State:**
- Root package.json has TypeScript dependency
- No tsconfig.json at root level
- Scripts might fail without proper config

**Action:** Create root-level tsconfig.json for:
- Shared compiler options
- Project references
- Build scripts

**Benefits:**
- Centralized configuration
- Better IDE support
- Consistent settings

### 10. Fix Test Setup Files

**Current State:**
- Jest setup files exist but are minimal
- Could benefit from shared test utilities
- Some suppressions might hide real issues

**Action:**
- Review and improve jest.setup.js files
- Create shared test utilities
- Document why certain errors are suppressed

**Benefits:**
- Better test reliability
- Shared test patterns
- Cleaner test output

## Implementation Priority

1. **High Priority** (Do first, low risk, high benefit)
   - Standardize TypeScript versions
   - Fix missing shared-types references
   - Standardize Node engine requirements
   - Add root TypeScript configuration

2. **Medium Priority** (Important but requires more planning)
   - Document module resolution strategy
   - TypeScript configuration improvements
   - Build process optimization

3. **Low Priority** (Nice to have, can be done gradually)
   - Test infrastructure consolidation
   - Dependency hoisting
   - Test setup improvements

## Conclusion

These improvements would significantly enhance the codebase without the risks and complexity of ES modules migration. They respect the current architecture (especially Firebase Functions' CommonJS requirement) while improving consistency and maintainability.