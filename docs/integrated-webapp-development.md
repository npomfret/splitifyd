# Integrated Webapp Development

## Overview

The webapp-v2 (new Preact app) is now integrated with Firebase hosting, allowing both the old and new apps to run together. This enables gradual migration from the old vanilla JS webapp to the new Preact-based webapp.

## Architecture

- **Old webapp**: Served at root (`/`) via Firebase hosting
- **New webapp-v2**: Served at `/v2/` via Firebase hosting
- **Shared hosting**: Both apps run on the same Firebase emulator (port 6002)
- **Shared auth**: Authentication state shared via localStorage

## Development Workflow

### Integrated Development

Run both apps together through Firebase hosting:

```bash
# Build both apps and start emulator
npm run dev:integrated

# Access:
# - Old app: http://localhost:6002/
# - New app: http://localhost:6002/v2/
```

### Build Commands

```bash
# Build both apps
npm run build:all

# Build only webapp-v2
npm run webapp-v2:build

# Build only old webapp
npm run build -w webapp
```

## File Structure

```
firebase/
  public/
    ├── index.html        # Old webapp files
    ├── dashboard.html
    ├── js/
    ├── css/
    └── v2/              # New webapp-v2 build output
        ├── index.html
        └── assets/
```

## Authentication Sharing

Both apps share authentication state through localStorage using the auth bridge:

```typescript
// webapp-v2/src/utils/auth-bridge.ts
import { authBridge } from '@/utils/auth-bridge';

// Check if user is authenticated
if (authBridge.isAuthenticated()) {
  const user = authBridge.getUser();
  // Use authenticated state
}

// Listen for auth changes from old app
const unsubscribe = authBridge.onAuthChange((isAuthenticated) => {
  // React to auth state changes
});
```

The auth bridge uses these localStorage keys:
- `auth_token`: Firebase auth token
- `userId`: User information

## Migration Path

1. **Current State**: Both apps running side-by-side
2. **Development Phase**: Build pages in webapp-v2 at `/v2/`
3. **Testing Phase**: Test pages work correctly with shared auth
4. **Migration Phase**: Redirect specific routes from old to new
5. **Completion**: Eventually serve webapp-v2 at root

## Adding New Pages

When adding a new page to webapp-v2:

1. Create the page component in `webapp-v2/src/pages/`
2. Add route in `webapp-v2/src/App.tsx`
3. Build: `npm run webapp-v2:build`
4. Test at `http://localhost:6002/v2/your-page`

## Production Deployment

The integrated setup is ready for production:

```bash
# Build everything
npm run build:all

# Deploy to Firebase
cd firebase && npm run deploy:prod
```

Both apps will be deployed together:
- Old app: `https://yourapp.web.app/`
- New app: `https://yourapp.web.app/v2/`

## Troubleshooting

### CORS Issues
Both apps are served from the same origin (localhost:6002), so CORS issues should not occur. If they do, check:
- API calls use relative paths (`/api/...`)
- No hardcoded ports in API URLs

### Auth State Not Syncing
- Check browser console for localStorage access
- Verify both apps use the same auth bridge keys
- Clear localStorage and re-login if needed

### Build Failures
- Ensure `firebase/public/v2/` directory exists
- Check Vite config base path matches deployment path
- Run `npm run super-clean` if dependency issues occur

## Next Steps

1. Start building pages in webapp-v2
2. Use MCP browser automation for testing verification (see README.md for MCP setup)
3. Gradually migrate pages from old to new
4. Update redirects as pages are completed

See `docs/migration-order.md` for the recommended page migration sequence.