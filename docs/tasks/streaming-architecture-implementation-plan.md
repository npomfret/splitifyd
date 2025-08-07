# Streaming Architecture Implementation Plan

## Executive Summary

This plan outlines a **Notification-Driven REST** architecture for Splitifyd - a hybrid approach that uses lightweight Firestore listeners purely for change detection while keeping all data fetching through traditional REST APIs with pagination. This provides real-time updates without the complexity of streaming pagination.

## Recommended Architecture: Notification-Driven REST

After analysis, I recommend the **Notification-Driven REST** approach as the primary architecture:

1. **Use Firestore listeners as lightweight change detectors only**
2. **Keep all data fetching through REST APIs**
3. **Auto-refresh current view when changes are detected**

This gives you:
- Real-time feel without complexity
- Perfect pagination (page numbers work as expected)
- Lower costs (minimal Firestore reads)
- Easier to implement and maintain

## Implementation Phases

### Phase 1: Change Detection Infrastructure (Week 1)

#### Tasks:
1. **Create lightweight change tracking**
   ```javascript
   // firebase/functions/src/triggers/change-tracker.ts
   export const trackGroupChanges = functions.firestore
     .document('groups/{groupId}')
     .onWrite(async (change, context) => {
       const changeDoc = {
         groupId: context.params.groupId,
         timestamp: Date.now(),
         type: !change.before.exists ? 'created' : 
               !change.after.exists ? 'deleted' : 'modified',
         userId: change.after?.data()?.lastModifiedBy
       };
       
       // Write to lightweight changes collection
       await admin.firestore()
         .collection('group-changes')
         .add(changeDoc);
       
       // Auto-cleanup old changes (>5 minutes)
       await cleanupOldChanges();
     });
   
   export const trackExpenseChanges = functions.firestore
     .document('groups/{groupId}/expenses/{expenseId}')
     .onWrite(async (change, context) => {
       await admin.firestore()
         .collection('expense-changes')
         .add({
           groupId: context.params.groupId,
           expenseId: context.params.expenseId,
           timestamp: Date.now(),
           type: getChangeType(change)
         });
     });
   ```

2. **Implement change cleanup**
   ```javascript
   // Scheduled function to clean up old change notifications
   export const cleanupChanges = functions.pubsub
     .schedule('every 5 minutes')
     .onRun(async () => {
       const cutoff = Date.now() - (5 * 60 * 1000); // 5 minutes ago
       
       const batch = admin.firestore().batch();
       
       // Clean group changes
       const oldGroupChanges = await admin.firestore()
         .collection('group-changes')
         .where('timestamp', '<', cutoff)
         .get();
       
       oldGroupChanges.forEach(doc => batch.delete(doc.ref));
       
       // Clean expense changes
       const oldExpenseChanges = await admin.firestore()
         .collection('expense-changes')
         .where('timestamp', '<', cutoff)
         .get();
       
       oldExpenseChanges.forEach(doc => batch.delete(doc.ref));
       
       await batch.commit();
     });
   ```

### Phase 2: REST API Pagination Support (Week 2)

#### Tasks:
1. **Update REST API endpoints for pagination**
   ```typescript
   // firebase/functions/src/routes/groups.ts
   router.get('/groups', async (req, res) => {
     const { page = 1, limit = 20, sort = 'lastActivityAt' } = req.query;
     const userId = req.user.uid;
     
     const offset = (page - 1) * limit;
     
     // Get total count for pagination metadata
     const totalQuery = await admin.firestore()
       .collection('groups')
       .where('memberIds', 'array-contains', userId)
       .count()
       .get();
     
     const total = totalQuery.data().count;
     
     // Get paginated data
     const groupsSnapshot = await admin.firestore()
       .collection('groups')
       .where('memberIds', 'array-contains', userId)
       .orderBy(sort, 'desc')
       .limit(limit)
       .offset(offset)
       .get();
     
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
   
   router.get('/groups/:groupId/expenses', async (req, res) => {
     const { groupId } = req.params;
     const { page = 1, limit = 50 } = req.query;
     
     // Verify user has access to group
     await verifyGroupAccess(req.user.uid, groupId);
     
     const offset = (page - 1) * limit;
     
     const expensesSnapshot = await admin.firestore()
       .collection('groups')
       .doc(groupId)
       .collection('expenses')
       .orderBy('createdAt', 'desc')
       .limit(limit)
       .offset(offset)
       .get();
     
     const expenses = expensesSnapshot.docs.map(doc => ({
       id: doc.id,
       ...doc.data()
     }));
     
     res.json({
       expenses,
       pagination: {
         page: Number(page),
         limit: Number(limit),
         hasMore: expensesSnapshot.size === limit
       }
     });
   });
   ```

### Phase 3: Client-side Change Detection (Week 3)

#### Tasks:
1. **Update groups store with change detection**
   ```typescript
   // webapp-v2/src/app/stores/groups-store.ts
   import { onSnapshot, query, where, collection, orderBy, limit } from 'firebase/firestore';
   
   class GroupsStore {
     private changeListener: (() => void) | null = null;
     private currentPage = 1;
     private pageSize = 20;
     private totalPages = 1;
     
     // Listen for changes only (not data)
     subscribeToChanges(userId: string) {
       // Lightweight listener for change notifications
       const changesQuery = query(
         collection(db, 'group-changes'),
         where('timestamp', '>', Date.now() - 300000), // Last 5 minutes
         orderBy('timestamp', 'desc'),
         limit(1)
       );
       
       this.changeListener = onSnapshot(changesQuery, (snapshot) => {
         if (!snapshot.empty && !snapshot.metadata.fromCache) {
           const change = snapshot.docs[0].data();
           
           // Check if change affects current user's groups
           if (this.shouldRefresh(change, userId)) {
             // Refresh current page via REST
             this.refreshCurrentPage();
           }
         }
       }, (error) => {
         console.warn('Change listener error:', error);
         // Continue working with REST only
       });
     }
     
     // Load groups via REST with pagination
     async loadGroups(page = 1) {
       this.loading = true;
       this.error = null;
       
       try {
         const response = await apiClient.getGroups({ 
           page, 
           limit: this.pageSize 
         });
         
         this.groups = response.groups;
         this.currentPage = response.pagination.page;
         this.totalPages = response.pagination.totalPages;
         this.hasMore = response.pagination.hasMore;
       } catch (error) {
         this.error = this.getErrorMessage(error);
         throw error;
       } finally {
         this.loading = false;
       }
     }
     
     // Refresh current page when changes detected
     async refreshCurrentPage() {
       // Don't show loading spinner for background refresh
       const response = await apiClient.getGroups({ 
         page: this.currentPage, 
         limit: this.pageSize 
       });
       
       // Smoothly update the UI
       this.groups = response.groups;
       
       // Optional: Show subtle notification
       this.showUpdateNotification('Groups updated');
     }
     
     // Traditional pagination methods
     async nextPage() {
       if (this.currentPage < this.totalPages) {
         await this.loadGroups(this.currentPage + 1);
       }
     }
     
     async previousPage() {
       if (this.currentPage > 1) {
         await this.loadGroups(this.currentPage - 1);
       }
     }
     
     async goToPage(page: number) {
       if (page >= 1 && page <= this.totalPages) {
         await this.loadGroups(page);
       }
     }
     
     dispose() {
       if (this.changeListener) {
         this.changeListener();
         this.changeListener = null;
       }
     }
   }
   ```

2. **Update expense store similarly**
   ```typescript
   // webapp-v2/src/app/stores/group-detail-store.ts
   class GroupDetailStore {
     private expenseChangeListener: (() => void) | null = null;
     private currentExpensePage = 1;
     private expensePageSize = 50;
     
     // Listen for expense changes in current group
     subscribeToExpenseChanges(groupId: string) {
       const changesQuery = query(
         collection(db, 'expense-changes'),
         where('groupId', '==', groupId),
         where('timestamp', '>', Date.now() - 300000),
         orderBy('timestamp', 'desc'),
         limit(1)
       );
       
       this.expenseChangeListener = onSnapshot(changesQuery, () => {
         // Refresh current expense page
         this.refreshExpenses(groupId);
       });
     }
     
     // Load expenses with pagination
     async loadExpenses(groupId: string, page = 1) {
       const response = await apiClient.getExpenses(groupId, {
         page,
         limit: this.expensePageSize
       });
       
       this.expenses = response.expenses;
       this.currentExpensePage = page;
       this.hasMoreExpenses = response.pagination.hasMore;
     }
     
     // Background refresh
     async refreshExpenses(groupId: string) {
       const response = await apiClient.getExpenses(groupId, {
         page: this.currentExpensePage,
         limit: this.expensePageSize
       });
       
       this.expenses = response.expenses;
     }
   }
   ```

### Phase 4: UI Components (Week 4)

#### Tasks:
1. **Create pagination UI components**
   ```typescript
   // webapp-v2/src/components/ui/Pagination.tsx
   interface PaginationProps {
     currentPage: number;
     totalPages: number;
     onPageChange: (page: number) => void;
     loading?: boolean;
   }
   
   export function Pagination({ 
     currentPage, 
     totalPages, 
     onPageChange,
     loading 
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
         
         <div className="flex gap-2">
           {/* Page numbers */}
           {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
             const page = i + 1;
             return (
               <button
                 key={page}
                 onClick={() => onPageChange(page)}
                 className={`px-3 py-1 rounded ${
                   page === currentPage 
                     ? 'bg-blue-500 text-white' 
                     : 'bg-gray-200'
                 }`}
               >
                 {page}
               </button>
             );
           })}
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
   ```

2. **Update Dashboard with pagination**
   ```typescript
   // webapp-v2/src/pages/DashboardPage.tsx
   export function DashboardPage() {
     const [currentPage, setCurrentPage] = useState(1);
     
     useEffect(() => {
       // Initial load
       groupsStore.loadGroups(currentPage);
       
       // Start listening for changes
       groupsStore.subscribeToChanges(userId);
       
       return () => {
         groupsStore.dispose();
       };
     }, []);
     
     const handlePageChange = async (page: number) => {
       setCurrentPage(page);
       await groupsStore.loadGroups(page);
     };
     
     return (
       <div>
         <GroupsList groups={groupsStore.groups} />
         
         <Pagination
           currentPage={currentPage}
           totalPages={groupsStore.totalPages}
           onPageChange={handlePageChange}
           loading={groupsStore.loading}
         />
         
         {/* Subtle update indicator */}
         {groupsStore.lastUpdated && (
           <div className="text-sm text-gray-500">
             Updated {formatRelativeTime(groupsStore.lastUpdated)}
           </div>
         )}
       </div>
     );
   }
   ```

3. **Add real-time status indicator**
   ```typescript
   // webapp-v2/src/components/ui/RealtimeStatus.tsx
   export function RealtimeStatus({ connected }: { connected: boolean }) {
     return (
       <div className="flex items-center gap-2 text-sm">
         <div className={`w-2 h-2 rounded-full ${
           connected ? 'bg-green-500' : 'bg-gray-400'
         }`} />
         <span>{connected ? 'Live updates' : 'Offline'}</span>
       </div>
     );
   }
   ```

### Phase 5: Testing and Performance Optimization (Week 5)

#### Tasks:
1. **End-to-end testing**
   - Test real-time synchronization across multiple clients
   - Verify data consistency
   - Test offline/online transitions

2. **Performance testing**
   - Load test with varying group sizes
   - Measure latency improvements
   - Monitor Firestore read/write costs

3. **Optimization**
   - Implement hybrid pagination for large expense lists (see Pagination Strategy)
   - Add debouncing for rapid updates
   - Optimize bundle size with code splitting

## Technical Considerations

### Pagination Strategy

**Challenge:** Firestore's real-time listeners don't naturally support traditional pagination like REST APIs. You can't easily "load more" while maintaining real-time updates for already-loaded items.

**Solution: Notification-Driven REST Approach (Recommended)**

This elegant hybrid uses Firestore listeners purely as change notifications, while REST APIs handle all data fetching:

```typescript
// webapp-v2/src/stores/smart-pagination-store.ts
class SmartPaginationStore {
  private changeListeners: Map<string, () => void> = new Map();
  private currentData: Map<string, any> = new Map();
  private pageSize = 50;
  private currentPage = 1;
  
  // Listen ONLY for changes (lightweight metadata)
  subscribeToChanges(groupId: string) {
    // Ultra-lightweight listener - only gets timestamps/IDs
    const changesQuery = query(
      collection(db, 'groups', groupId, 'changes'),
      where('timestamp', '>', Date.now() - 60000), // Last minute
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    
    const unsubscribe = onSnapshot(changesQuery, async (snapshot) => {
      if (!snapshot.empty) {
        // Change detected! Refresh via REST
        await this.refreshCurrentPage(groupId);
        
        // Optional: Show notification
        this.showChangeNotification(snapshot.docs[0].data());
      }
    });
    
    this.changeListeners.set(groupId, unsubscribe);
  }
  
  // All data fetching via REST (with pagination)
  async loadPage(groupId: string, page: number) {
    const response = await fetch(
      `/api/groups/${groupId}/expenses?page=${page}&limit=${this.pageSize}`
    );
    
    const { data, totalPages, hasMore } = await response.json();
    
    // Store in local state
    data.forEach(item => {
      this.currentData.set(item.id, item);
    });
    
    this.currentPage = page;
    this.updateUI();
  }
  
  // Refresh current view when changes detected
  async refreshCurrentPage(groupId: string) {
    // Re-fetch only the current page
    await this.loadPage(groupId, this.currentPage);
    
    // UI updates automatically via signals/state
  }
  
  // Traditional pagination controls
  async nextPage(groupId: string) {
    await this.loadPage(groupId, this.currentPage + 1);
  }
  
  async previousPage(groupId: string) {
    await this.loadPage(groupId, this.currentPage - 1);
  }
}
```

**Benefits of Notification-Driven REST:**
- ✅ Traditional pagination works perfectly (page numbers, sorting, filtering)
- ✅ Minimal Firestore reads (only change notifications)
- ✅ Data stays fresh (auto-refresh on changes)
- ✅ Simple mental model (REST with real-time notifications)
- ✅ Easy to implement search, filters, sorting
- ✅ Predictable costs (mostly REST, few Firestore reads)

**Alternative: Full Streaming Approach (Original)**

```typescript
// webapp-v2/src/stores/expense-pagination-store.ts
class ExpensePaginationStore {
  private pageSize = 50;
  private loadedExpenses: Map<string, Expense> = new Map();
  private latestExpenseListener: (() => void) | null = null;
  private olderExpensesLoaded = 0;
  
  // Stream only the most recent expenses (real-time)
  subscribeToRecentExpenses(groupId: string) {
    const recentQuery = query(
      collection(db, 'groups', groupId, 'expenses'),
      orderBy('createdAt', 'desc'),
      limit(this.pageSize)
    );
    
    this.latestExpenseListener = onSnapshot(recentQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const expense = { id: change.doc.id, ...change.doc.data() };
        
        if (change.type === 'added' || change.type === 'modified') {
          this.loadedExpenses.set(expense.id, expense);
        } else if (change.type === 'removed') {
          this.loadedExpenses.delete(expense.id);
        }
      });
      
      this.updateExpensesList();
    });
  }
  
  // Load older expenses via REST (one-time fetch, no streaming)
  async loadMoreExpenses(groupId: string) {
    const lastExpense = Array.from(this.loadedExpenses.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .pop();
    
    if (!lastExpense) return;
    
    // Use REST API for older expenses (static data)
    const response = await fetch(`/api/groups/${groupId}/expenses?` + 
      `startAfter=${lastExpense.createdAt}&limit=${this.pageSize}`);
    const olderExpenses = await response.json();
    
    // Add to map without listener (these won't update in real-time)
    olderExpenses.forEach(expense => {
      this.loadedExpenses.set(expense.id, expense);
    });
    
    this.olderExpensesLoaded += olderExpenses.length;
    this.updateExpensesList();
  }
  
  // Virtual scrolling for very large lists
  getVisibleExpenses(scrollPosition: number): Expense[] {
    const allExpenses = Array.from(this.loadedExpenses.values())
      .sort((a, b) => b.createdAt - a.createdAt);
    
    const startIndex = Math.floor(scrollPosition / ITEM_HEIGHT);
    const endIndex = startIndex + VISIBLE_ITEMS;
    
    return allExpenses.slice(startIndex, endIndex);
  }
}
```

**Three-tier Strategy for Different Scenarios:**

1. **Small Groups (<100 expenses)**: Stream everything
   ```typescript
   // Full real-time sync for all expenses
   onSnapshot(collection(db, 'groups', groupId, 'expenses'), ...)
   ```

2. **Medium Groups (100-1000 expenses)**: Hybrid approach
   ```typescript
   // Stream recent 50, REST API for older ones
   // Recent expenses update in real-time
   // Older expenses are static until refresh
   ```

3. **Large Groups (>1000 expenses)**: Virtual scrolling + on-demand loading
   ```typescript
   // Stream only visible window + buffer
   // Load chunks via REST as user scrolls
   // Use intersection observer for infinite scroll
   ```

**Benefits of this approach:**
- Recent/active data stays real-time (most important for UX)
- Older/archived data loads on-demand (less critical for real-time)
- Reduces Firestore read costs significantly
- Maintains good performance even with thousands of items

**Trade-offs:**
- More complex than simple REST pagination
- Older expenses won't update in real-time (usually acceptable)
- Need to manage two data sources (streaming + REST)

### Error Handling
```typescript
class StreamingErrorHandler {
  handleError(error: FirestoreError) {
    switch(error.code) {
      case 'permission-denied':
        // Fallback to REST API
        break;
      case 'unavailable':
        // Show offline indicator
        break;
      default:
        // Log to monitoring service
    }
  }
}
```

### Backward Compatibility
- Maintain REST endpoints during transition
- Implement feature flags for gradual rollout
- Provide fallback mechanisms for streaming failures

### Monitoring
- Track streaming connection health
- Monitor real-time update latency
- Alert on excessive reconnections

## Success Metrics

1. **User Experience**
   - Real-time feel with traditional pagination UX
   - <500ms latency for change detection
   - Seamless background updates without disruption

2. **Performance**
   - Traditional REST performance with real-time updates
   - Predictable pagination (page 1, 2, 3...)
   - Minimal memory footprint (no streaming all data)

3. **Cost**
   - 80% reduction in Firestore reads vs full streaming
   - Minimal change detection overhead (~100 reads/hour)
   - REST API handles 95% of data transfer

## Rollback Plan

If issues arise during implementation:

1. **Immediate rollback**
   - Feature flag to disable streaming
   - REST API remains fully functional
   - No data migration required

2. **Gradual rollback**
   - Disable streaming for specific features
   - Monitor and fix issues
   - Re-enable after fixes

## Timeline

- **Week 1**: Security rules (Critical)
- **Week 2**: Dashboard streaming
- **Week 3**: Group details streaming
- **Week 4**: Client-side calculations
- **Week 5**: Testing and optimization
- **Week 6**: Production rollout (10% users)
- **Week 7**: Full rollout

## Next Steps

1. Get stakeholder approval
2. Set up feature flags
3. Begin Phase 1: Security Rules Audit
4. Create monitoring dashboard
5. Schedule daily standups for migration team

## Appendix

### A. Required Dependencies
```json
{
  "firebase": "^10.x",
  "@firebase/firestore": "^4.x",
  "preact": "^10.x",
  "@preact/signals": "^1.x"
}
```

### B. Firestore Index Requirements
```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "groups",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "memberIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### C. Migration Checklist
- [ ] Security rules updated and tested
- [ ] Feature flags configured
- [ ] Monitoring dashboards created
- [ ] Error tracking configured
- [ ] Load testing completed
- [ ] Documentation updated
- [ ] Team trained on new architecture
- [ ] Rollback procedures tested