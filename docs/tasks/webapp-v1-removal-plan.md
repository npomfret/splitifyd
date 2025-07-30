# Webapp v1 Removal Plan

## Overview
This document outlines the steps required to remove the original webapp (v1) and fully transition to webapp-v2. The goal is to simplify the codebase by eliminating the legacy multi-page application while ensuring zero disruption to users.

## Current State Analysis

### Directory Structure
- **webapp v1**: `/webapp` - Traditional multi-page HTML/JS application
- **webapp v2**: `/webapp-v2` - Modern Preact SPA that currently builds into `/webapp/dist/v2`

### Build & Deployment Flow
1. Both apps are npm workspaces in the monorepo
2. webapp-v2 builds its output INTO the webapp directory (`../webapp/dist/v2`)
3. Firebase hosting serves content via a symlink: `public -> ../webapp/dist`
4. Routes are split: v1 pages at root, v2 at `/v2/*` plus specific migrated routes

### Shared Dependencies
- `webapp-shared-types.ts` in `firebase/functions/src/types/` is used by both apps
- No other significant code sharing between v1 and v2

## Removal Steps

### Phase 1: Preparation & Verification
1. **Feature Parity Audit**
   - Verify all v1 pages have v2 equivalents
   - Test all user flows work in v2
   - Confirm all static pages migrated (privacy policy, terms, etc.)

2. **Route Verification**
   - List all v1 routes still in use
   - Ensure firebase.template.json covers all necessary redirects

### Phase 2: Build System Updates

1. **Update webapp-v2 build configuration** (`webapp-v2/vite.config.ts`)
   ```typescript
   // Change from:
   build: {
     outDir: '../webapp/dist/v2',
     // ...
   }
   
   // To:
   build: {
     outDir: 'dist',
     // ...
   }
   ```

2. **Update post-build script** (`webapp-v2/scripts/post-build.js`)
   - Change path from `../../webapp/dist/v2/index.html` to `../dist/index.html`
   - Update any other relative paths

3. **Update webapp-v2 package.json**
   - Ensure all scripts work with new paths
   - Remove any references to webapp v1

### Phase 3: Firebase Configuration

1. **Update Firebase hosting symlink** (`firebase/package.json`)
   ```json
   // Change from:
   "link-webapp": "ln -sf ../webapp/dist public"
   
   // To:
   "link-webapp": "ln -sf ../webapp-v2/dist public"
   ```

2. **Update firebase.template.json**
   - Remove `/v2/**` rewrite (it becomes the default)
   - Update base path handling
   - Ensure all routes point to index.html for SPA routing

3. **Update hosting configuration**
   ```json
   // Simplified rewrites section:
   "rewrites": [
     {
       "source": "/api/**",
       "function": "api"
     },
     {
       "source": "**",
       "destination": "/index.html"
     }
   ]
   ```

### Phase 4: Monorepo Updates

1. **Update root package.json**
   ```json
   // Remove webapp from workspaces:
   "workspaces": [
     "firebase/functions",
     "webapp-v2"
   ]
   ```

2. **Update npm scripts**
   - Remove webapp references from build commands
   - Update dev script to only watch webapp-v2
   - Clean up test commands

3. **Example script updates**
   ```json
   "scripts": {
     "dev": "npm run dev:prep && concurrently \"cd webapp-v2 && npm run watch\" \"cd firebase && npm run link-webapp && npm run start-emulators\"",
     "build": "npm run build -w webapp-v2 && npm run build -w firebase/functions",
     // Remove webapp-specific commands
   }
   ```

### Phase 5: Clean Up

1. **Remove webapp directory**
   ```bash
   rm -rf webapp/
   ```

2. **Update documentation**
   - Update README.md
   - Update CLAUDE.md development instructions
   - Update any setup guides

3. **Update test scripts**
   - Remove webapp test references
   - Update browser test paths if needed

### Phase 6: Verification

1. **Local testing**
   - Run `npm run super-clean`
   - Run `npm install`
   - Run `npm run dev`
   - Test all major user flows

2. **Build verification**
   - Run `npm run build`
   - Check output structure
   - Verify all assets load correctly

3. **Deployment testing**
   - Deploy to staging environment first
   - Run full regression test suite
   - Monitor for any 404s or routing issues

## Rollback Plan

If issues arise:
1. Git revert the changes
2. Rebuild and redeploy
3. The modular nature of changes allows partial rollback if needed

## Timeline Estimate

- Phase 1: 1 hour (verification & testing)
- Phase 2-3: 2 hours (build & Firebase updates)
- Phase 4-5: 1 hour (cleanup & documentation)
- Phase 6: 2 hours (thorough testing)

Total: ~6 hours of focused work

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing v1 features | Users can't access functionality | Complete feature audit before removal |
| Broken routes | 404 errors for users | Test all routes, monitor logs post-deployment |
| Build issues | Can't deploy | Test builds locally first, keep webapp for rollback |
| Type dependencies | Compilation errors | Verify webapp-shared-types imports still work |

## Success Criteria

- [ ] All user-facing features work in v2
- [ ] No 404 errors for previously working routes  
- [ ] Build and deployment processes simplified
- [ ] Development workflow streamlined
- [ ] All tests passing
- [ ] Documentation updated
- [ ] No references to webapp remain in codebase

## Next Steps

1. Review this plan with the team
2. Complete feature parity audit
3. Execute removal in a dedicated branch
4. Thorough testing before merging
5. Monitor production for any issues post-deployment