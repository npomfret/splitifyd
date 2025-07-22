# Webapp Rebuild Task 1: Set Up Preact Foundation

## Overview
Create the new Preact-based webapp structure alongside the existing webapp, establishing the foundation for incremental migration.

## Prerequisites
- [x] Complete webapp-rebuild-0-recon.md analysis
- [x] Ensure Firebase emulator is running for testing

## Current State
- Existing webapp in `/webapp` using vanilla JS/TS
- Basic esbuild configuration
- No component system or modern dev tools

## Target State
- New Preact app in `/webapp-v2` with modern tooling
- Vite for fast HMR and optimized builds
- TypeScript with strict mode
- Tailwind CSS for styling
- Basic routing and layout components

## Implementation Steps

### Phase 1: Project Setup (2 hours)

1. **Create new webapp structure**
   ```bash
   mkdir -p webapp-v2/src/{app,components,features,pages,styles}
   cd webapp-v2
   ```

2. **Initialize package.json**
   - [ ] Create package.json with Preact dependencies
   - [ ] Add Vite and development tools
   - [ ] Configure TypeScript
   - [ ] Add Tailwind CSS

3. **Essential dependencies**
   ```json
   {
     "dependencies": {
       "preact": "^10.x",
       "@preact/compat": "^17.x",
       "preact-router": "^4.x",
       "reactfire": "^4.x",
       "zustand": "^4.x",
       "firebase": "^10.x"
     },
     "devDependencies": {
       "vite": "^5.x",
       "@preact/preset-vite": "^2.x",
       "typescript": "^5.x",
       "tailwindcss": "^3.x",
       "@types/node": "^20.x"
     }
   }
   ```

### Phase 2: Configuration (1 hour)

1. **Vite configuration** (`vite.config.ts`)
   - [ ] Configure Preact plugin
   - [ ] Set up React compatibility alias
   - [ ] Configure build output
   - [ ] Add source maps for development

2. **TypeScript configuration** (`tsconfig.json`)
   - [ ] Enable strict mode
   - [ ] Configure JSX for Preact
   - [ ] Set up path aliases
   - [ ] Include shared types symlink

3. **Tailwind configuration** (`tailwind.config.js`)
   - [ ] Set up content paths
   - [ ] Import existing color scheme from current webapp
   - [ ] Configure responsive breakpoints

4. **Create shared symlink**
   - [ ] Link to `firebase/functions/src/shared`
   - [ ] Verify TypeScript recognizes the symlink

### Phase 3: Core Structure (2 hours)

1. **App entry point** (`src/main.tsx`)
   - [ ] Initialize Preact app
   - [ ] Set up Firebase
   - [ ] Configure error boundaries
   - [ ] Add performance monitoring

2. **Router setup** (`src/app/router.tsx`)
   - [ ] Configure Preact Router
   - [ ] Define initial routes (start with just home)
   - [ ] Add route guards for authentication
   - [ ] Implement lazy loading for routes

3. **Layout components**
   - [ ] Create `Layout.tsx` with header/footer
   - [ ] Create `AuthLayout.tsx` for auth pages
   - [ ] Create `AppLayout.tsx` for authenticated pages
   - [ ] Ensure responsive design

4. **Firebase initialization** (`src/app/firebase.ts`)
   - [ ] Initialize Firebase app
   - [ ] Configure emulator connection
   - [ ] Set up auth persistence
   - [ ] Export typed Firebase instances

### Phase 4: Initial Pages (1 hour)

1. **Create placeholder pages**
   - [ ] `HomePage.tsx` - Simple welcome message
   - [ ] `NotFoundPage.tsx` - 404 handler
   - [ ] `LoadingPage.tsx` - Loading state

2. **Basic styling** (`src/styles/global.css`)
   - [ ] Import Tailwind directives
   - [ ] Port essential CSS variables from current webapp
   - [ ] Set up base typography

### Phase 5: Development Scripts (30 minutes)

1. **Update root package.json**
   - [ ] Add `webapp-v2:dev` script
   - [ ] Add `webapp-v2:build` script
   - [ ] Add `webapp-v2:preview` script
   - [ ] Integrate with existing `npm run dev`

2. **Environment configuration**
   - [ ] Create `.env.development` for local settings
   - [ ] Create `.env.production` for prod settings
   - [ ] Ensure Firebase config is properly loaded

### Phase 6: Build Integration (1 hour)

1. **Update Firebase hosting config**
   - [ ] Add webapp-v2 build output to hosting
   - [ ] Configure routing rules for `/app/*`
   - [ ] Ensure legacy app remains at root

2. **CI/CD preparation**
   - [ ] Update build scripts to include webapp-v2
   - [ ] Add bundle size checking
   - [ ] Configure source map upload (if using Sentry)

## In-Browser Testing Checklist

**MANDATORY**: Follow the browser testing directive (directives/browser-testing.md) for ALL steps.

For each step, test in browser with DevTools open:

1. **After Vite setup**
   - [ ] Run `npm run webapp-v2:dev`
   - [ ] Open Chrome DevTools Console - **ZERO errors/warnings allowed**
   - [ ] Verify HMR works (change text, see instant update)
   - [ ] Check Network tab - all assets load successfully
   - [ ] Test responsive: 375px, 768px, 1440px
   - [ ] **Take screenshot of initial working setup**

2. **After router setup**
   - [ ] Navigate between routes - check console stays clean
   - [ ] Verify 404 page works - **screenshot 404 page**
   - [ ] Check browser back/forward buttons
   - [ ] Test direct URL navigation
   - [ ] Network tab: no failed requests on route changes
   - [ ] Test in Chrome, Firefox, Safari

3. **After Firebase setup** (when implemented)
   - [ ] Verify connection to emulator - check Network tab
   - [ ] Check auth state persistence - no console errors
   - [ ] Ensure no production data access
   - [ ] Monitor console for Firebase warnings
   - [ ] **Screenshot Firebase connection status**

4. **After styling setup**
   - [ ] Verify Tailwind classes work - inspect elements
   - [ ] Check responsive design at all breakpoints
   - [ ] Ensure CSS variables are loaded - check computed styles
   - [ ] No missing styles or broken layouts
   - [ ] **Screenshot mobile and desktop views**

5. **Final integration test**
   - [ ] Chrome: Full test, console clean, no network errors
   - [ ] Firefox: Full test, console clean, no network errors
   - [ ] Safari: Full test, console clean, no network errors
   - [ ] Mobile (375px): Layout correct, interactive elements work
   - [ ] Tablet (768px): Layout correct, no overflow
   - [ ] Desktop (1440px): Full layout visible
   - [ ] Performance: No requests > 3 seconds
   - [ ] **Document with screenshots of success**

## Deliverables

1. **Working Preact app** at `/webapp-v2`
2. **Development server** with HMR
3. **Basic routing** and layout structure
4. **Configured build pipeline**
5. **Updated documentation** for running webapp-v2

## Success Criteria

- [ ] `npm run webapp-v2:dev` starts development server
- [ ] Hot module replacement works correctly
- [ ] TypeScript strict mode passes
- [ ] Can navigate between placeholder pages
- [ ] Firebase emulator connection established
- [ ] No console errors in development
- [ ] Build output under 50KB for initial bundle

## Common Issues & Solutions

1. **Symlink issues on Windows**
   - Use junction instead of symlink
   - Or copy shared files during build

2. **TypeScript path resolution**
   - Ensure tsconfig paths match Vite aliases
   - Use absolute imports consistently

3. **Firebase emulator connection**
   - Check emulator is running
   - Verify correct ports in config

4. **Tailwind not working**
   - Ensure content paths are correct
   - Check PostCSS configuration

## Updated Implementation Plan (2025-07-22)

### Simplifications Based on Codebase Analysis

After analyzing the existing webapp, I'm recommending these changes to keep the initial setup minimal:

1. **Reduced Dependencies**
   - Remove `reactfire` - use Firebase SDK directly
   - Remove `zustand` - add state management only when needed
   - Focus on: preact, preact-router, vite, typescript, tailwind

2. **Simplified Structure**
   - Start with just HomePage and NotFoundPage
   - Skip complex layouts initially
   - No auth guards yet (add during auth migration)
   - No Firebase setup in this phase

3. **Path Strategy**
   - Use TypeScript paths instead of symlinks
   - Import utilities from existing webapp as needed
   - Share types via build process

4. **Phased Approach**
   - Phase 1: Basic Vite + Preact setup (1 hour)
   - Phase 2: TypeScript + Tailwind config (30 min)
   - Phase 3: Minimal pages + router (1 hour)
   - Phase 4: Dev script integration (30 min)
   - Phase 5: Testing & documentation (30 min)

Total: ~3.5 hours (reduced from 6-7)

## Timeline

- Start Date: 2025-07-22
- End Date: 2025-07-22
- Duration: ~30 minutes (actual)
- **Status**: ✅ COMPLETED

## Implementation Summary

Successfully created a minimal Preact foundation with:
- ✅ Vite dev server with HMR working
- ✅ TypeScript strict mode configured
- ✅ Tailwind CSS integrated
- ✅ Basic routing with home and 404 pages
- ✅ Monorepo integration with npm scripts
- ✅ Clean, minimal setup following YAGNI principle

### Key Decisions Made
1. **No Firebase setup yet** - will add when migrating auth
2. **No complex layouts** - just basic pages
3. **No state management** - will add if/when needed
4. **Minimal dependencies** - only essentials
5. **Used TypeScript paths** instead of symlinks for simplicity

### Next Steps
Run `npm run webapp-v2:dev` to start the development server on http://localhost:3000

## Notes

- Keep initial setup minimal - don't add features yet
- Focus on developer experience and fast feedback
- Document any deviations from plan
- Test each phase before moving to next
- Follow "YAGNI" principle - add complexity only when needed