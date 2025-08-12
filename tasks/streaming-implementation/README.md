# Real-time Updates Implementation

## Overview

Splitifyd uses a **notification-driven REST architecture** for real-time updates. This approach combines the reliability of REST APIs with lightweight change notifications for an optimal user experience.

## Architecture

### Core Principle: Notification-Driven REST

```
Change occurs → Notification created → Client receives notification → REST refresh
```

- **Notifications**: Lightweight signals that something changed (no data payload)
- **REST API**: Single source of truth for all data fetching
- **Real-time feel**: Immediate notifications trigger targeted REST refreshes

### Why This Architecture?

1. **Solves emulator limitations**: Simple notifications work reliably in all environments
2. **Maintains pagination**: REST handles complex queries and cursors properly
3. **Single source of truth**: No complex data merging between REST and streaming
4. **Better performance**: Tiny notifications instead of full document streams
5. **Simpler testing**: Clear separation of concerns

## Current Implementation Status

### ✅ Backend Infrastructure (Complete)
- Firestore triggers detect all changes
- Change notifications created for groups and expenses
- Debouncing prevents notification spam (300-500ms)
- Monitoring and metrics collection implemented

### ✅ Frontend Stores (Complete)
- Enhanced stores connected to UI pages
- Change detection subscribes to notifications
- REST refresh triggered by notifications
- Protection against emulator empty snapshots

### 🚧 Known Issues
- **Emulator visibility**: Client SDK subscriptions can't see Admin SDK writes
- **Solution implemented**: Keep REST data when subscriptions are empty
- **Production ready**: This issue only affects local development

## How It Works

### 1. Change Detection (Backend)
When data changes, Firestore triggers create lightweight notifications:

```typescript
// Simplified notification structure
{
  groupId: "abc123",
  type: "expense_added",
  timestamp: 1234567890,
  userId: "user123"
}
```

### 2. Subscription (Frontend)
Clients subscribe to relevant notifications:

```typescript
// User-level notifications (for groups list)
subscribeToGroupChanges(userId, () => {
  groupsStore.refreshGroups(); // REST refresh
});

// Group-level notifications (for expense list)
subscribeToExpenseChanges(groupId, userId, () => {
  groupDetailStore.refreshAll(); // REST refresh
});
```

### 3. REST Refresh
When notified, stores refresh via REST API:
- Maintains pagination state
- Preserves filters and sorting
- Single source of truth

## Testing

```bash
# Run all tests
npm test

# Integration tests (backend)
cd firebase/functions && npm run test:integration

# E2E tests (full stack)
npm run test:e2e
```

### Emulator Behavior
In the Firebase emulator, you may see:
- Empty initial snapshots (normal Firestore behavior)
- REST data preserved when subscriptions are empty
- This is expected and handled correctly

## Cost Analysis

- **Notifications**: ~10 reads/hour per active user
- **REST refreshes**: ~50-100 reads/hour per active user  
- **Total**: <150 reads/hour per active user
- **Well within free tier** for typical usage

## Production Deployment

The system is production-ready:

```bash
# Deploy functions
cd firebase && npm run deploy:prod

# Monitor metrics
firebase functions:log --only collectStreamingMetrics
```

## Future Improvements

The current architecture is intentionally simple and can be enhanced:
- Add notification batching for high-frequency changes
- Implement selective field updates for large documents
- Add WebSocket support for truly instant updates (if needed)

## Troubleshooting

### "Expenses not showing"
- **Cause**: Emulator visibility issue (Admin SDK vs Client SDK)
- **Solution**: Already handled - REST data is preserved

### "Real-time updates not working"
- **Check**: Are notifications being created? (Check Firestore console)
- **Check**: Are subscriptions active? (Check browser console)
- **Check**: Is REST refresh being called? (Check network tab)

## Key Files

- **Backend triggers**: `firebase/functions/src/triggers/`
- **Change detector**: `webapp-v2/src/utils/change-detector.ts`
- **Enhanced stores**: `webapp-v2/src/app/stores/*-enhanced.ts`
- **REST API client**: `webapp-v2/src/app/apiClient.ts`