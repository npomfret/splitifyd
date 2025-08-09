# Streaming Architecture Implementation Plan

## Executive Summary

This plan implements a **Notification-Driven REST** architecture for Splitifyd - a hybrid approach using lightweight Firestore listeners for change detection while keeping all data fetching through REST APIs with pagination. This provides real-time updates without streaming complexity.

## Architecture Overview

The **Notification-Driven REST** approach:

1. **Firestore listeners detect changes only** (no data transfer)
2. **REST APIs handle all data fetching** with traditional pagination
3. **Auto-refresh current view** when changes detected
4. **Preserve user context** during refreshes (selections, scroll position, form inputs)

### Key Benefits
- ✅ Real-time feel with traditional pagination UX
- ✅ Minimal Firestore costs (~100 reads/hour for notifications)
- ✅ Simple mental model (REST + notifications)
- ✅ No streaming pagination complexity
- ✅ Easy rollback to pure REST if needed

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)

#### 1.1 Change Detection with Rate Limiting
```typescript
// firebase/functions/src/triggers/change-tracker.ts
import { debounce } from '../utils/debounce';

const pendingChanges = new Map<string, NodeJS.Timeout>();

export const trackGroupChanges = functions.firestore
  .document('groups/{groupId}')
  .onWrite(async (change, context) => {
    const groupId = context.params.groupId;
    
    // Debounce rapid changes (e.g., multiple field updates)
    if (pendingChanges.has(groupId)) {
      clearTimeout(pendingChanges.get(groupId));
    }
    
    const timeoutId = setTimeout(async () => {
      const changeDoc = {
        groupId,
        timestamp: Date.now(),
        type: !change.before.exists ? 'created' : 
              !change.after.exists ? 'deleted' : 'modified',
        userId: change.after?.data()?.lastModifiedBy,
        fields: getChangedFields(change.before, change.after) // Track what changed
      };
      
      await admin.firestore()
        .collection('group-changes')
        .add(changeDoc);
      
      pendingChanges.delete(groupId);
    }, 500); // 500ms debounce
    
    pendingChanges.set(groupId, timeoutId);
  });

// Helper to identify changed fields for granular updates
function getChangedFields(before: any, after: any): string[] {
  if (!before.exists) return ['*']; // New document
  if (!after.exists) return ['*']; // Deleted document
  
  const beforeData = before.data();
  const afterData = after.data();
  const changedFields: string[] = [];
  
  Object.keys(afterData).forEach(key => {
    if (JSON.stringify(beforeData[key]) !== JSON.stringify(afterData[key])) {
      changedFields.push(key);
    }
  });
  
  return changedFields;
}
```

#### 1.2 Automatic Cleanup
```typescript
// firebase/functions/src/scheduled/cleanup.ts
export const cleanupChanges = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async () => {
    const cutoff = Date.now() - (5 * 60 * 1000);
    const batch = admin.firestore().batch();
    
    // Clean up old changes
    const collections = ['group-changes', 'expense-changes'];
    for (const collection of collections) {
      const snapshot = await admin.firestore()
        .collection(collection)
        .where('timestamp', '<', cutoff)
        .limit(500) // Batch limit
        .get();
      
      snapshot.forEach(doc => batch.delete(doc.ref));
    }
    
    await batch.commit();
  });

### Phase 2: REST API with Pagination (Week 1-2)

```typescript
// firebase/functions/src/routes/groups.ts
router.get('/groups', async (req, res) => {
  const { page = 1, limit = 20, sort = 'lastActivityAt' } = req.query;
  const userId = req.user.uid;
  
  const offset = (page - 1) * limit;
  
  // Parallel queries for better performance
  const [totalQuery, groupsSnapshot] = await Promise.all([
    admin.firestore()
      .collection('groups')
      .where('memberIds', 'array-contains', userId)
      .count()
      .get(),
    admin.firestore()
      .collection('groups')
      .where('memberIds', 'array-contains', userId)
      .orderBy(sort, 'desc')
      .limit(limit)
      .offset(offset)
      .get()
  ]);
  
  const total = totalQuery.data().count;
  const groups = groupsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  res.json({
    groups,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: offset + limit < total
    }
  });
});

### Phase 3: Smart Client-Side Implementation (Week 2)

```typescript
// webapp-v2/src/app/stores/groups-store.ts
import { onSnapshot, query, where, collection, orderBy, limit } from 'firebase/firestore';

class GroupsStore {
  private changeListener: (() => void) | null = null;
  private refreshTimeout: NodeJS.Timeout | null = null;
  private lastRefresh = 0;
  private userContext = new Map<string, any>(); // Preserve user state
  
  // Smart change detection with context preservation
  subscribeToChanges(userId: string) {
    const changesQuery = query(
      collection(db, 'group-changes'),
      where('timestamp', '>', Date.now() - 300000),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    
    this.changeListener = onSnapshot(changesQuery, (snapshot) => {
      if (!snapshot.empty && !snapshot.metadata.fromCache) {
        const change = snapshot.docs[0].data();
        
        // Smart refresh decision based on changed fields
        if (this.shouldRefresh(change, userId)) {
          this.scheduleRefresh(change);
        }
      }
    }, (error) => {
      console.warn('Falling back to REST-only mode:', error);
    });
  }
  
  // Intelligent refresh decision
  private shouldRefresh(change: any, userId: string): boolean {
    // Skip refresh for non-critical fields
    const nonCriticalFields = ['lastViewed', 'analytics', 'metadata'];
    if (change.fields?.every(f => nonCriticalFields.includes(f))) {
      return false;
    }
    
    // Check if change affects current view
    return change.userId !== userId || // Other user's change
           change.type === 'deleted' ||
           change.fields?.includes('name') ||
           change.fields?.includes('balance');
  }
  
  // Debounced refresh with rate limiting
  private scheduleRefresh(change: any) {
    // Rate limit: max 1 refresh per 2 seconds
    const now = Date.now();
    if (now - this.lastRefresh < 2000) {
      return;
    }
    
    // Cancel pending refresh
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    
    // Schedule new refresh with debounce
    this.refreshTimeout = setTimeout(() => {
      this.refreshWithContext();
      this.lastRefresh = Date.now();
    }, 500);
  }
  
  // Refresh while preserving user context
  private async refreshWithContext() {
    // Save current user context
    this.saveUserContext();
    
    try {
      const response = await apiClient.getGroups({
        page: this.currentPage,
        limit: this.pageSize
      });
      
      // Apply optimistic updates for user's own changes
      this.mergeWithOptimisticUpdates(response.groups);
      
      // Restore user context
      this.restoreUserContext();
      
      // Subtle notification
      if (this.hasVisibleChanges(response.groups)) {
        this.showUpdateNotification('Content updated');
      }
    } catch (error) {
      // Silent fail for background refresh
      console.debug('Background refresh failed:', error);
    }
  }
  
  // Preserve form inputs, selections, scroll position
  private saveUserContext() {
    this.userContext.set('scrollPosition', window.scrollY);
    this.userContext.set('selectedItems', this.selectedItems);
    this.userContext.set('formData', this.captureFormData());
  }
  
  private restoreUserContext() {
    window.scrollTo(0, this.userContext.get('scrollPosition') || 0);
    this.selectedItems = this.userContext.get('selectedItems') || [];
    this.restoreFormData(this.userContext.get('formData'));
  }
  
  // Optimistic updates for user's own changes
  private mergeWithOptimisticUpdates(serverData: any[]) {
    const merged = serverData.map(item => {
      const optimistic = this.optimisticUpdates.get(item.id);
      return optimistic ? { ...item, ...optimistic } : item;
    });
    
    this.groups = merged;
  }
  
  dispose() {
    if (this.changeListener) {
      this.changeListener();
    }
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
  }
}

### Phase 4: UI Components & Integration (Week 3)

```typescript
// webapp-v2/src/components/ui/Pagination.tsx
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  hasUpdates?: boolean; // Show when background updates available
}

export function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange,
  loading,
  hasUpdates 
}: PaginationProps) {
  return (
    <div className="flex items-center justify-between py-4">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || loading}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        Previous
      </button>
      
      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          {generatePageNumbers(currentPage, totalPages).map(page => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              disabled={loading}
              className={`px-3 py-1 rounded ${
                page === currentPage 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              {page}
            </button>
          ))}
        </div>
        
        {hasUpdates && (
          <div className="text-sm text-blue-600 animate-pulse">
            • New updates
          </div>
        )}
      </div>
      
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || loading}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}

// Smart page number generation
function generatePageNumbers(current: number, total: number): number[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  
  // Show: 1 ... current-1 current current+1 ... total
  const pages = new Set([1, current - 1, current, current + 1, total]);
  return Array.from(pages).filter(p => p > 0 && p <= total).sort((a, b) => a - b);
}

### Phase 5: Comprehensive Testing (Week 4)

#### 5.1 Test Scenarios

```typescript
// webapp-v2/src/__tests__/streaming.test.ts
describe('Streaming Architecture', () => {
  it('should handle concurrent edits without data loss', async () => {
    // User A starts editing
    const userA = await createTestUser();
    await userA.startEditingExpense('expense-1');
    
    // User B makes changes
    const userB = await createTestUser();
    await userB.updateExpense('expense-1', { amount: 100 });
    
    // Verify User A sees notification but preserves their edits
    await wait(1000);
    expect(userA.hasNotification()).toBe(true);
    expect(userA.formData).toEqual(userA.originalFormData);
  });
  
  it('should rate limit rapid changes', async () => {
    // Make 10 rapid changes
    for (let i = 0; i < 10; i++) {
      await updateGroup({ name: `Test ${i}` });
    }
    
    // Should only trigger 1 refresh
    expect(refreshCount).toBe(1);
  });
  
  it('should maintain pagination state after refresh', async () => {
    await navigateToPage(3);
    await triggerBackgroundRefresh();
    
    expect(currentPage).toBe(3);
    expect(scrollPosition).toBeCloseTo(previousScrollPosition, 10);
  });
  
  it('should handle network interruptions gracefully', async () => {
    await simulateOffline();
    await makeChanges();
    await simulateOnline();
    
    // Should reconcile changes
    expect(dataConsistency).toBe(true);
  });
});
```

#### 5.2 Performance Monitoring

```typescript
// firebase/functions/src/monitoring/performance.ts
export const monitorRefreshRate = functions.pubsub
  .schedule('every 1 hour')
  .onRun(async () => {
    const metrics = await getRefreshMetrics();
    
    // Alert if refresh rate too high
    if (metrics.refreshesPerMinute > 10) {
      await sendAlert('High refresh rate detected', metrics);
    }
    
    // Alert if Firestore reads excessive
    if (metrics.firestoreReads > 10000) {
      await sendAlert('Excessive Firestore reads', metrics);
    }
    
    // Log to monitoring dashboard
    await logMetrics(metrics);
  });

## Technical Considerations

### Conflict Resolution

When a user is editing data and a background refresh occurs:

1. **Preserve Active Edits**: Form data and user input are saved before refresh
2. **Show Conflict Indicator**: Visual cue when remote changes detected
3. **Offer Merge Options**: Let user choose to keep their changes or accept remote
4. **Optimistic Updates**: Apply user's changes immediately, reconcile with server later

### Error Handling & Fallback

```typescript
class StreamingErrorHandler {
  handleError(error: FirestoreError) {
    switch(error.code) {
      case 'permission-denied':
        // Silently fallback to REST-only mode
        this.disableStreaming();
        break;
      case 'unavailable':
        // Show subtle offline indicator
        this.setOfflineMode(true);
        break;
      case 'resource-exhausted':
        // Rate limit hit - increase debounce time
        this.increaseDebounceTime();
        break;
      default:
        // Log but don't disrupt user
        console.debug('Streaming error:', error);
    }
  }
}
```

### Alternative: Server-Sent Events (SSE)

Consider SSE as a simpler alternative to Firestore listeners:

```typescript
// firebase/functions/src/routes/sse.ts
router.get('/events/groups/:groupId', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  // Send changes as SSE
  const unsubscribe = onGroupChange(groupId, (change) => {
    res.write(`data: ${JSON.stringify(change)}\n\n`);
  });
  
  req.on('close', () => unsubscribe());
});
```

Benefits: Simpler, cheaper, works through proxies/firewalls better.

## Success Metrics

### Target Performance
- **Change Detection**: <500ms from change to notification
- **Refresh Rate**: Max 1 refresh per 2 seconds per user
- **Firestore Reads**: <100 reads/hour for change detection
- **User Context**: 100% preservation during refreshes
- **Fallback Success**: 100% functionality when streaming fails

### Cost Targets
- **80% reduction** in Firestore reads vs full streaming
- **95% of data** transferred via REST (not Firestore)
- **<$10/month** for change detection infrastructure

## Implementation Timeline

### Week 1: Foundation
- [ ] Change detection infrastructure with rate limiting
- [ ] Automatic cleanup scheduled function
- [ ] Field-level change tracking

### Week 2: REST & Client
- [ ] Paginated REST endpoints
- [ ] Smart client-side store with context preservation
- [ ] Optimistic updates and conflict resolution

### Week 3: UI & Integration
- [ ] Pagination components with update indicators
- [ ] Dashboard integration
- [ ] Real-time status indicators

### Week 4: Testing & Monitoring
- [ ] Comprehensive test suite
- [ ] Performance monitoring
- [ ] Refresh rate alerting
- [ ] Documentation

## Rollback Strategy

The architecture is designed for zero-risk deployment:

1. **Feature Flag Control**: `enableStreaming: false` instantly disables all real-time features
2. **REST Fallback**: System continues working without any streaming
3. **No Data Migration**: No database changes required
4. **Gradual Rollout**: Test with 1% → 10% → 50% → 100% of users

## Migration Checklist

### Pre-deployment
- [ ] Rate limiting implemented and tested
- [ ] Context preservation verified
- [ ] Conflict resolution tested
- [ ] Performance monitoring active
- [ ] Feature flags configured

### Post-deployment
- [ ] Monitor refresh rates
- [ ] Track Firestore costs
- [ ] Gather user feedback
- [ ] Optimize based on metrics

## Appendix: Configuration

```typescript
// config/streaming.ts
export const STREAMING_CONFIG = {
  enabled: process.env.ENABLE_STREAMING === 'true',
  changeRetentionMinutes: 5,
  debounceMs: 500,
  rateLimitMs: 2000,
  maxRefreshesPerMinute: 30,
  fallbackToRest: true,
  preserveUserContext: true,
  showUpdateNotifications: true
};