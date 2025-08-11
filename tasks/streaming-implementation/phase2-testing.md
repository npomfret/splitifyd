# Phase 2 Testing Guide: Smart REST with Auto-Refresh

## Overview
Phase 2 implements smart REST endpoints with metadata and intelligent client-side refresh logic triggered by change notifications.

## Key Components Implemented

### Backend
- **Enhanced REST endpoints** (`firebase/functions/src/groups/handlers.ts`)
  - Groups endpoint now includes metadata with change information
  - Parallel queries for performance
  - Change timestamp tracking

### Frontend
- **Change Detector** (`webapp-v2/src/utils/change-detector.ts`)
  - Subscribes to Firestore change notifications
  - Smart refresh scheduling based on priority
  - Connection quality awareness
  
- **Enhanced Groups Store** (`webapp-v2/src/app/stores/groups-store-enhanced.ts`)
  - User context preservation during refreshes
  - Optimistic updates with conflict resolution
  - Background refresh with debouncing

- **Firebase Firestore Integration** (`webapp-v2/src/app/firebase.ts`)
  - Added Firestore support for change detection
  - Emulator connection for local development

## Testing Procedure

### 1. Start the Emulator
```bash
npm run dev
```
Wait for the emulator to fully start.

### 2. Test Enhanced REST Endpoints

#### Test Metadata in Groups Endpoint
```bash
# Get auth token first
AUTH_TOKEN=$(curl -s http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"testpass123","returnSecureToken":true}' | jq -r .idToken)

# Test groups endpoint with metadata
curl http://localhost:5001/splitifyd-test/us-central1/api/groups?includeMetadata=true \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq .
```

Expected: Response should include a `metadata` object with:
- `lastChangeTimestamp`
- `changeCount`
- `serverTime`
- `hasRecentChanges`

### 3. Test Change Detection

#### Create a Test Group
```bash
curl -X POST http://localhost:5001/splitifyd-test/us-central1/api/groups \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Group Phase 2",
    "description": "Testing smart refresh",
    "members": []
  }' | jq .
```

#### Monitor Change Collection
Open Firebase Emulator UI: http://localhost:4000/firestore

Navigate to `group-changes` collection and observe:
- New change documents being created
- Timestamp and metadata fields
- Automatic cleanup after 5 minutes

### 4. Test Client-Side Features

#### Test in Browser Console
Open the app in browser and run in console:

```javascript
// Import the enhanced store
import { enhancedGroupsStore } from './app/stores/groups-store-enhanced.js';
import { ChangeDetector } from './utils/change-detector.js';

// Subscribe to changes
const userId = 'test-user-id'; // Replace with actual user ID
enhancedGroupsStore.subscribeToChanges(userId);

// Monitor refresh status
setInterval(() => {
  console.log({
    isRefreshing: enhancedGroupsStore.isRefreshing,
    lastRefresh: new Date(enhancedGroupsStore.lastRefresh),
    hasRecentChanges: enhancedGroupsStore.hasRecentChanges,
    groups: enhancedGroupsStore.groups.length
  });
}, 2000);

// Test optimistic update
const testGroup = enhancedGroupsStore.groups[0];
if (testGroup) {
  enhancedGroupsStore.updateGroup(testGroup.id, {
    name: 'Updated Name - ' + Date.now()
  });
}
```

### 5. Test Connection Management

#### Simulate Poor Connection
```javascript
// In browser console
import { ConnectionManager } from './utils/connection-manager.js';
const connMgr = ConnectionManager.getInstance();

// Simulate poor connection
connMgr.connectionQuality.value = 'poor';

// Observe delayed refresh behavior
// Changes should now be debounced longer
```

#### Test Offline Mode
```javascript
// Simulate offline
connMgr.isOnline.value = false;

// Changes should not trigger refreshes
// Check that UI remains responsive
```

### 6. Test User Context Preservation

#### Manual Test Steps
1. Open groups list in the app
2. Scroll down to a specific position
3. Open a form or expand a group detail
4. Trigger a change from another browser/tab
5. Observe that:
   - Scroll position is maintained
   - Form data is preserved
   - Focus state is restored
   - Expanded items remain expanded

### 7. Test Optimistic Updates

#### Test Conflict Resolution
1. Make an optimistic update in one tab
2. Make a conflicting change in another tab
3. Observe that conflicts are detected and resolved
4. Server state should win in conflicts

### 8. Performance Testing

#### Monitor Network Activity
1. Open browser DevTools Network tab
2. Perform various actions
3. Verify:
   - Metadata requests are efficient
   - No excessive polling
   - Debouncing prevents rapid requests
   - Failed requests trigger exponential backoff

#### Check Memory Usage
1. Open DevTools Memory tab
2. Take heap snapshot
3. Perform multiple refreshes
4. Take another snapshot
5. Compare to ensure no memory leaks

## Success Criteria

✅ REST endpoints return metadata with change information
✅ Change notifications trigger smart refreshes
✅ User context preserved during updates
✅ Optimistic updates work with rollback on failure
✅ Connection quality affects refresh timing
✅ No console errors during normal operation
✅ Performance targets met (<500ms refresh latency)
✅ Memory usage stable over time

## Troubleshooting

### Changes Not Detected
- Check Firestore security rules allow reading change collections
- Verify user is authenticated
- Check browser console for listener errors
- Ensure Firebase is initialized before change detection

### Refresh Too Frequent
- Check debounce settings in change-detector.ts
- Verify priority classification is working
- Monitor connection quality status

### Context Not Preserved
- Ensure DOM elements have proper data attributes
- Check that context save/restore happens in animation frame
- Verify form elements have name or id attributes

## Known Limitations

1. `updateGroup` method in apiClient not yet implemented - using optimistic updates only
2. Firestore emulator connection uses hardcoded port 8080
3. Change cleanup runs every 5 minutes (configurable in cleanup.ts)

## Next Steps

After successful testing of Phase 2:
1. Proceed to Phase 3: Progressive Streaming Migration
2. Implement full streaming for high-frequency data
3. Add collaborative features
4. Optimize performance further