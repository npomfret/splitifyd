# Webapp Rebuild Task 3: Migration Infrastructure (Strangler Fig Pattern)

## Overview
Set up infrastructure to run legacy and new webapp side-by-side, allowing incremental page-by-page migration without disrupting users.

## Prerequisites
- [ ] Complete webapp-rebuild-1-setup-preact.md
- [ ] Have working Preact app at `/webapp-v2`
- [ ] Firebase hosting configured

## Current State
- Legacy webapp served from root (`/`)
- All routes handled by static HTML files
- No routing infrastructure for dual apps

## Target State
- Legacy app accessible at both `/` and `/legacy/*`
- New Preact app at `/app/*`
- Seamless navigation between old and new pages
- Shared authentication state
- Gradual migration path

## Implementation Steps

### Phase 1: Routing Infrastructure (2 hours)

1. **Update Firebase hosting rules** (`firebase.json`)
   ```json
   {
     "hosting": {
       "rewrites": [
         {
           "source": "/app/**",
           "destination": "/webapp-v2/index.html"
         },
         {
           "source": "/legacy/**", 
           "destination": "/index.html"
         }
       ],
       "redirects": [
         {
           "source": "/",
           "destination": "/app/",
           "type": 302
         }
       ]
     }
   }
   ```

2. **Configure build outputs**
   - [ ] Legacy webapp builds to `public/`
   - [ ] New webapp builds to `public/webapp-v2/`
   - [ ] Static assets properly namespaced
   - [ ] No conflicts between builds

3. **Migration toggle**
   - [ ] Create feature flags for each page
   - [ ] Store in localStorage or cookie
   - [ ] Allow per-user migration testing
   - [ ] Admin panel to control flags

### Phase 2: Shared State Bridge (3 hours)

1. **Authentication bridge** (`shared/auth-bridge.ts`)
   - [ ] Share Firebase auth between apps
   - [ ] Sync auth state changes
   - [ ] Handle token refresh
   - [ ] Consistent user object

2. **Data bridge** (`shared/data-bridge.ts`)
   - [ ] Share critical data via localStorage
   - [ ] Event system for cross-app communication
   - [ ] Cache invalidation strategy
   - [ ] Handle concurrent updates

3. **Navigation bridge** (`shared/nav-bridge.ts`)
   - [ ] Detect which app should handle route
   - [ ] Smooth transitions between apps
   - [ ] Preserve query parameters
   - [ ] Handle back button correctly

### Phase 3: Migration Utilities (2 hours)

1. **Route mapper** (`webapp-v2/src/app/migration/route-mapper.ts`)
   ```typescript
   const routeMap = {
     '/': '/app/dashboard',
     '/login.html': '/app/login',
     '/group-detail.html': '/app/groups/:id',
     // etc...
   };
   ```

2. **Legacy page wrapper** (`webapp-v2/src/components/LegacyPageWrapper.tsx`)
   - [ ] Iframe wrapper for legacy pages
   - [ ] Shared header/footer
   - [ ] Event communication
   - [ ] Loading states

3. **Migration helpers**
   - [ ] URL parameter converter
   - [ ] Legacy API response adapter
   - [ ] Style migration utilities
   - [ ] Analytics bridge

### Phase 4: Development Workflow (1 hour)

1. **Side-by-side development**
   - [ ] Update `npm run dev` to run both apps
   - [ ] Proxy configuration for local dev
   - [ ] Hot reload for both apps
   - [ ] Shared Firebase emulator

2. **Migration scripts**
   - [ ] Script to migrate a page
   - [ ] Automated test runner
   - [ ] Visual regression tests
   - [ ] Performance comparison

3. **Developer documentation**
   - [ ] Migration checklist template
   - [ ] Common patterns guide
   - [ ] Troubleshooting guide
   - [ ] Best practices

### Phase 5: User Experience (2 hours)

1. **Seamless navigation**
   - [ ] Preload next app version
   - [ ] Smooth transitions
   - [ ] Consistent loading states
   - [ ] Error boundaries

2. **Fallback handling**
   - [ ] Detect migration failures
   - [ ] Automatic fallback to legacy
   - [ ] Error reporting
   - [ ] User notification

3. **Performance optimization**
   - [ ] Lazy load unused app
   - [ ] Share common bundles
   - [ ] Progressive enhancement
   - [ ] Service worker strategy

## In-Browser Testing Checklist

### Local Development Testing

1. **Routing tests**
   - [ ] Access legacy app at `/legacy/`
   - [ ] Access new app at `/app/`
   - [ ] Verify redirects work
   - [ ] Test direct URL access
   - [ ] Check 404 handling

2. **Authentication flow**
   - [ ] Login in legacy app
   - [ ] Navigate to new app - still logged in
   - [ ] Logout in new app
   - [ ] Verify legacy app logged out
   - [ ] Test token refresh

3. **Data synchronization**
   - [ ] Create group in legacy app
   - [ ] See it immediately in new app
   - [ ] Update in new app
   - [ ] Verify legacy app shows update

4. **Navigation testing**
   - [ ] Click link from legacy to new
   - [ ] Browser back button works
   - [ ] Deep linking works
   - [ ] Query parameters preserved

### Production-like Testing

1. **Performance testing**
   - [ ] Measure transition time between apps
   - [ ] Check bundle sizes
   - [ ] Verify caching works
   - [ ] Test on slow connections

2. **Error scenarios**
   - [ ] Kill one app mid-navigation
   - [ ] Clear localStorage
   - [ ] Corrupt feature flags
   - [ ] Test offline behavior

3. **Browser compatibility**
   - [ ] Chrome (latest)
   - [ ] Firefox (latest)
   - [ ] Safari (latest)
   - [ ] Mobile browsers
   - [ ] Private/incognito mode

## Deliverables

1. **Working dual-app setup** with routing
2. **Shared state management** between apps
3. **Migration utilities** and helpers
4. **Developer documentation**
5. **Testing checklist** for migrations

## Success Criteria

- [ ] Can run both apps simultaneously
- [ ] Authentication state shared correctly
- [ ] Zero-downtime migration possible
- [ ] No user-visible errors during transition
- [ ] Performance not degraded
- [ ] Easy to migrate individual pages

## Risk Mitigation

1. **State synchronization issues**
   - Use single source of truth (Firebase)
   - Implement conflict resolution
   - Add extensive logging

2. **Performance degradation**
   - Monitor bundle sizes closely
   - Implement code splitting
   - Use performance budget

3. **User confusion**
   - Keep UI consistent
   - Clear migration communication
   - Ability to opt-out

## Timeline

- Start Date: TBD
- End Date: TBD
- Duration: ~10 hours

## Notes

- This is the most critical piece - take time to test thoroughly
- Consider A/B testing framework for gradual rollout
- Plan for rollback scenarios
- Monitor user feedback closely during migration