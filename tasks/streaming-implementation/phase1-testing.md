# Phase 1 Streaming Infrastructure Testing Guide

## Overview
Phase 1 implements the foundational infrastructure for real-time capabilities:
- Change detection triggers for groups and expenses
- Debounced notifications to prevent spam
- Connection state management
- Automatic cleanup of old notifications

## Testing in Firebase Emulator

### 1. Start the Emulator
```bash
npm run dev
```

### 2. Deploy Security Rules
The updated security rules will be automatically loaded. Verify in the Firestore UI that the following collections have rules:
- `group-changes`
- `expense-changes`
- `balance-changes`

### 3. Test Change Detection

#### Create/Modify a Group
1. Open the app in browser
2. Create a new group or edit an existing one
3. Check Firestore emulator UI for:
   - New document in `group-changes` collection
   - Document should contain:
     - `groupId`
     - `timestamp`
     - `type` (created/modified/deleted)
     - `fields` array
     - `metadata.priority` (high/medium/low)
     - `metadata.affectedUsers` array

#### Create/Modify an Expense
1. Add an expense to a group
2. Check Firestore emulator UI for:
   - New document in `expense-changes` collection
   - New document in `balance-changes` collection (expenses affect balances)
   - Both should have appropriate metadata

### 4. Test Debouncing
1. Make rapid changes to the same group (edit name multiple times quickly)
2. Verify only one change notification appears after 500ms
3. Check function logs for debouncing messages

### 5. Test Cleanup Function
The cleanup runs every 5 minutes. To test immediately:

```bash
# Trigger cleanup manually in emulator
curl -X POST http://localhost:5001/splitifyd/us-central1/cleanupChanges
```

Verify:
- Old change documents (>5 minutes) are deleted
- Recent changes remain
- Check logs for cleanup metrics

### 6. Test Connection Manager (Frontend)
1. Open browser console
2. Import and test the connection manager:

```javascript
import { connectionManager } from '/src/utils/connection-manager.js';

// Check current state
console.log(connectionManager.state);

// Simulate offline
window.dispatchEvent(new Event('offline'));
console.log(connectionManager.state); // Should show offline

// Simulate online
window.dispatchEvent(new Event('online'));
console.log(connectionManager.state); // Should show online
```

### 7. Monitor Performance
Check the function logs for:
- Execution time of triggers
- Debouncing effectiveness
- Cleanup metrics
- Any errors or warnings

## Verification Checklist

- [ ] Security rules deployed and working
- [ ] Group changes create notifications
- [ ] Expense changes create notifications
- [ ] Balance changes are tracked
- [ ] Debouncing prevents duplicate notifications
- [ ] Cleanup removes old notifications
- [ ] Connection manager detects online/offline
- [ ] No TypeScript errors
- [ ] No runtime errors in logs

## Common Issues

### Changes Not Being Tracked
- Check security rules are deployed
- Verify user is authenticated
- Check function logs for errors

### Cleanup Not Running
- In emulator, scheduled functions need manual triggering
- Check cleanup function is exported in index.ts

### Debouncing Not Working
- Check DebounceManager is properly imported
- Verify timeout values (500ms for groups, 300ms for expenses)

## Next Steps
Once Phase 1 is verified:
1. Monitor for 24 hours to ensure stability
2. Check Firestore usage metrics
3. Proceed to Phase 2: Smart REST with Auto-Refresh