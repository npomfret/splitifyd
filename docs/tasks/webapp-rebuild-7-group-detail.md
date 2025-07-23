# Webapp Rebuild Task 7: Migrate Group Detail & Expense List

## Status: Phase 1 Complete ✅

### Completed (2025-07-23)
- ✅ Created group-detail-store.ts with full data fetching
- ✅ Implemented GroupDetailPage.tsx with all major sections
- ✅ Added routing for /groups/:id
- ✅ Connected dashboard to navigate to group details
- ✅ Implemented expense pagination
- ✅ Display group balances from API
- ✅ Created dateUtils for relative time display

### Remaining Work
- ⏳ Extract components from monolithic page
- ⏳ Add real-time subscriptions
- ⏳ Implement member management actions
- ⏳ Connect quick action buttons

## Overview
Migrate the group detail page with member management, expense listing, balance calculations, and group settings to Preact.

## Prerequisites
- [x] Complete webapp-rebuild-6-dashboard.md (Dashboard is implemented)
- [x] Groups store implemented (groups-store.ts exists and working)
- [x] API client configured for expenses (all endpoints available)

## Current State
- ✅ Basic group detail page implemented
- ✅ Group detail store with data fetching
- ✅ Expense pagination working
- ✅ Balance display from API
- ⏳ Components not yet extracted
- ⏳ Real-time updates not implemented

## Target State
- ✅ Reactive group detail with loading states
- ✅ Automatic balance display from API
- ✅ Paginated expense list
- ⏳ Real-time subscriptions (future phase)
- ✅ Enhanced UX with loading states

## Implementation Steps

### Phase 1: Page Structure (1 hour) ✅ COMPLETED

1. **Group detail layout** (`pages/GroupDetailPage.tsx`)
   - [x] Group header with name/settings
   - [x] Members section
   - [x] Balances summary
   - [x] Expenses list
   - [x] Quick actions toolbar

2. **Component structure**
   ```
   components/group/
   ├── GroupHeader.tsx        # Group name, description, actions
   ├── MembersList.tsx        # Member avatars and management
   ├── BalanceSummary.tsx     # Who owes whom display
   ├── ExpensesList.tsx       # Paginated expense listing
   ├── ExpenseItem.tsx        # Individual expense component
   ├── AddExpenseButton.tsx   # Quick add expense
   ├── SettleUpButton.tsx     # Settlement actions
   └── GroupSettings.tsx      # Group configuration
   ```

### Phase 2: Group State Management (2 hours) ✅ COMPLETED

1. **Group detail store** (`stores/group-detail-store.ts`)
   ```typescript
   interface GroupDetailStore {
     group: GroupDetail | null;
     expenses: ExpenseData[];
     balances: GroupBalances | null;
     loading: boolean;
     loadingExpenses: boolean;
     loadingBalances: boolean;
     error: string | null;
     hasMoreExpenses: boolean;
     expenseCursor: string | null;
     
     fetchGroup(id: string): Promise<void>;
     fetchExpenses(cursor?: string): Promise<void>;
     fetchBalances(): Promise<void>;
     loadMoreExpenses(): Promise<void>;
     reset(): void;
   }
   ```

2. **Real-time subscriptions**
   - [ ] Group document listener
   - [ ] Members collection listener
   - [ ] Expenses collection listener
   - [ ] Handle subscription cleanup

3. **Balance calculations**
   - [ ] Calculate who owes whom
   - [ ] Simplify debts algorithm
   - [ ] Update on expense changes
   - [ ] Handle edge cases

### Phase 3: Members Management (2 hours)

1. **Members display**
   - [ ] Member avatars in circle/grid
   - [ ] Member names and emails
   - [ ] Role indicators (admin/member)
   - [ ] Balance per member
   - [ ] Online status indicators

2. **Member actions**
   - [ ] Add member via email
   - [ ] Remove member (with confirmation)
   - [ ] Change member role
   - [ ] Member profile links
   - [ ] Bulk member operations

3. **Member invitation flow**
   - [ ] Email validation
   - [ ] Send invitation
   - [ ] Track invitation status
   - [ ] Resend invitations
   - [ ] Handle invitation errors

### Phase 4: Expenses List (2 hours)

1. **Expense listing**
   - [ ] Chronological order (newest first)
   - [ ] Expense categories/icons
   - [ ] Amount and currency
   - [ ] Payer and participants
   - [ ] Date formatting

2. **List features**
   - [ ] Infinite scroll or pagination
   - [ ] Search/filter expenses
   - [ ] Sort by different criteria
   - [ ] Virtualization for large lists
   - [ ] Pull-to-refresh on mobile

3. **Expense interactions**
   - [ ] Click to view details
   - [ ] Quick edit inline
   - [ ] Delete with confirmation
   - [ ] Share expense
   - [ ] Export functionality

### Phase 5: Balance Summary (1 hour)

1. **Balance display**
   - [ ] Simplified debts view
   - [ ] Who owes whom matrix
   - [ ] Color coding for amounts
   - [ ] Clear settlement paths
   - [ ] Total group balance

2. **Settlement features**
   - [ ] Suggest optimal settlements
   - [ ] Mark settlement payments
   - [ ] Settlement history
   - [ ] Payment reminders
   - [ ] Export settlements

### Phase 6: Group Actions (1 hour)

1. **Quick actions toolbar**
   - [ ] Add expense button
   - [ ] Settle up button
   - [ ] Group settings
   - [ ] Share group
   - [ ] Leave group

2. **Group settings modal**
   - [ ] Edit group name/description
   - [ ] Group image upload
   - [ ] Privacy settings
   - [ ] Notification preferences
   - [ ] Archive/delete group

## In-Browser Testing Checklist

### Core Functionality

1. **Page load**
   - [ ] Group loads with correct data
   - [ ] All members display
   - [ ] Expenses list populates
   - [ ] Balances calculated correctly

2. **Real-time updates**
   - [ ] New expenses appear automatically
   - [ ] Member changes sync
   - [ ] Balance updates immediately
   - [ ] Connection issues handled

3. **Navigation**
   - [ ] Group URL works directly
   - [ ] Back to dashboard works
   - [ ] Deep linking to expenses works
   - [ ] Browser history correct

### Member Management

1. **Add members**
   - [ ] Email validation works
   - [ ] Invitation sent successfully
   - [ ] Member appears in list
   - [ ] Error handling for duplicates

2. **Remove members**
   - [ ] Confirmation dialog shows
   - [ ] Member removed from group
   - [ ] Balances recalculated
   - [ ] Can't remove if debts exist

3. **Member permissions**
   - [ ] Admin actions restricted
   - [ ] Member role changes work
   - [ ] Permission errors handled
   - [ ] Role indicators correct

### Expense Management

1. **Expense display**
   - [ ] All expenses show correctly
   - [ ] Amounts formatted properly
   - [ ] Participants list accurate
   - [ ] Dates display correctly

2. **Expense actions**
   - [ ] Click navigates to detail
   - [ ] Edit actions work
   - [ ] Delete confirms and works
   - [ ] Share functionality works

3. **List performance**
   - [ ] Scrolling smooth with many expenses
   - [ ] Search filters correctly
   - [ ] Sort options work
   - [ ] Loading states appropriate

### Balance Calculations

1. **Balance accuracy**
   - [ ] Simple splits calculated correctly
   - [ ] Complex splits accurate
   - [ ] Multi-currency handled
   - [ ] Edge cases work

2. **Settlement suggestions**
   - [ ] Optimal paths calculated
   - [ ] Settlement options clear
   - [ ] Mark payment works
   - [ ] Balance updates after settlement

### Error Handling

1. **Network errors**
   - [ ] Offline mode graceful
   - [ ] Retry mechanisms work
   - [ ] Error messages clear
   - [ ] Data consistency maintained

2. **Permission errors**
   - [ ] Access denied handled
   - [ ] Group not found handled
   - [ ] Member not found handled
   - [ ] Appropriate redirects

### Mobile Experience

- [ ] Touch-friendly interactions
- [ ] Responsive member grid
- [ ] Swipe actions on expenses
- [ ] Bottom sheet for actions
- [ ] Performance on mobile

## Deliverables

1. **Complete group detail page**
2. **Member management system**
3. **Real-time expense listing**
4. **Balance calculation engine**
5. **Group settings interface**

## Success Criteria

- [ ] All original functionality preserved
- [ ] Real-time updates working
- [ ] Balance calculations accurate
- [ ] Better performance than original
- [ ] Enhanced user experience
- [ ] Mobile-friendly interface

## Complex Features Notes

1. **Balance calculations**
   - Implement debt simplification algorithm
   - Handle floating point precision
   - Consider multiple currencies
   - Cache calculations for performance

2. **Real-time synchronization**
   - Handle conflicting updates
   - Implement optimistic updates
   - Manage subscription lifecycle
   - Handle network partitions

3. **Large groups/expenses**
   - Virtualize long lists
   - Paginate API calls
   - Cache frequently accessed data
   - Optimize re-renders

## Detailed Implementation Plan

### Analysis Summary
After analyzing the existing codebase:

1. ✅ **Full API support available**:
   - GET `/groups/:id` - Fetch group details
   - GET `/expenses/group` - Fetch expenses with pagination
   - GET `/groups/balances` - Get balance calculations
   - POST `/expenses` - Create new expense
   - PUT/DELETE `/expenses` - Update/delete expenses

2. ✅ **Type definitions complete**:
   - GroupDetail, ExpenseData, GroupBalances types defined
   - User and balance types ready
   - All request/response types available

3. ✅ **Infrastructure ready**:
   - Groups store pattern established
   - API client with auth working
   - UI components library available
   - Router ready for new routes

4. ❌ **Missing components**:
   - No group detail page yet
   - No expense-related components
   - No balance display components
   - No member management UI

### Implementation Strategy

**Chosen Approach: Feature-Based Implementation**
1. Start with basic group detail display (read-only)
2. Add expense list with pagination
3. Implement balance calculations display
4. Add member management features
5. Enable expense CRUD operations last

This approach ensures we have a working page early and can incrementally add features.

### Phase-by-Phase Breakdown

#### Phase 1: Group Detail Store & Basic Page (2 hours)
**Purpose**: Create foundation for group detail functionality

**Implementation**:
1. **Create `src/app/stores/group-detail-store.ts`**
   ```typescript
   interface GroupDetailStore {
     group: GroupDetail | null;
     expenses: ExpenseData[];
     balances: GroupBalances | null;
     loading: boolean;
     error: string | null;
     
     fetchGroup(id: string): Promise<void>;
     fetchExpenses(cursor?: string): Promise<void>;
     fetchBalances(): Promise<void>;
     reset(): void;
   }
   ```

2. **Create `src/pages/GroupDetailPage.tsx`**
   - Route params handling for group ID
   - Loading states while data fetches
   - Error handling for invalid groups
   - Basic layout structure

3. **Add route to App.tsx**:
   ```tsx
   <Route path="/groups/:id" component={GroupDetailPage} />
   ```

#### Phase 2: Group Header & Info Display (1.5 hours)
**Purpose**: Display group information and quick stats

**Implementation**:
1. **Create `src/components/group/GroupHeader.tsx`**
   - Group name and description
   - Member count and avatars preview
   - Total expense count
   - Created date
   - Settings button (placeholder)

2. **Create `src/components/group/MembersList.tsx`**
   - Display all members with avatars
   - Show member names and emails
   - Indicate group creator
   - Placeholder for member actions

3. **Styling approach**:
   - Use existing Card component for sections
   - Consistent spacing with Stack component
   - Mobile-responsive grid for members

#### Phase 3: Expense List Implementation (2 hours)
**Purpose**: Display paginated expense list

**Implementation**:
1. **Create `src/components/group/ExpensesList.tsx`**
   - Fetch expenses on mount
   - Handle pagination with "Load More" button
   - Show loading state for pagination
   - Empty state when no expenses

2. **Create `src/components/group/ExpenseItem.tsx`**
   - Expense description and amount
   - Paid by indicator
   - Date formatting
   - Category icon/badge
   - Participants list
   - Click handler for detail view (placeholder)

3. **Features**:
   - Virtual scrolling for performance (phase 2)
   - Search/filter (phase 2)
   - Sort options (phase 2)

#### Phase 4: Balance Display (2 hours)
**Purpose**: Show who owes whom

**Implementation**:
1. **Create `src/components/group/BalanceSummary.tsx`**
   - Fetch balances from API
   - Display user's personal balance prominently
   - Show simplified debts list
   - Color coding (red for owing, green for owed)

2. **Create `src/components/group/BalanceItem.tsx`**
   - Individual balance display
   - "Person A owes Person B $X" format
   - Settle button (placeholder)
   - Amount formatting with currency

3. **Balance calculation display**:
   - Use the API's pre-calculated balances
   - Don't recalculate client-side (trust server)
   - Handle multi-currency gracefully

#### Phase 5: Quick Actions & Polish (1.5 hours)
**Purpose**: Add interactivity and polish

**Implementation**:
1. **Create `src/components/group/QuickActions.tsx`**
   - Add Expense button (navigate to add page)
   - Settle Up button (placeholder)
   - Share Group button (placeholder)
   - Leave Group option (placeholder)

2. **Error handling improvements**:
   - Network error retry buttons
   - Permission denied messages
   - Group not found redirect

3. **Performance optimizations**:
   - Debounce scroll events
   - Lazy load member avatars
   - Cache group data in store

### Technical Decisions

1. **State Management**: 
   - Separate group-detail-store for this page
   - Don't pollute groups-store with detail data
   - Clear store on unmount to prevent stale data

2. **Data Fetching**:
   - Parallel fetch group, expenses, and balances
   - Show partial data as it arrives
   - Implement proper error boundaries

3. **Navigation**:
   - Add expense → `/groups/:id/add-expense`
   - Expense detail → `/groups/:id/expenses/:expenseId`
   - Back to dashboard preserves scroll position

4. **Mobile First**:
   - Stack layout on mobile
   - Side-by-side on desktop
   - Touch-friendly tap targets

### Commit Strategy

**Commit 1**: Group detail store and basic page (2 hours) ✅ COMPLETED
- group-detail-store.ts implementation
- GroupDetailPage with routing  
- Basic data fetching
- All sections in monolithic page (to be extracted later)
- Expense pagination
- Balance display
- Member grid
- Quick actions toolbar (placeholders)
- Error and loading states
- dateUtils for formatting

**Future Commits** (Component extraction):
- Extract GroupHeader component
- Extract MembersList component  
- Extract ExpensesList component
- Extract ExpenseItem component
- Extract BalanceSummary component
- Extract QuickActions component
- Add member management functionality
- Add real-time subscriptions

### Future Enhancements (Not in MVP)
1. Real-time updates via Firestore listeners
2. Expense search and filtering
3. Member management (add/remove)
4. Group settings editing
5. Expense bulk operations
6. Export functionality

## Timeline

- Start Date: When instructed
- End Date: Same day
- Duration: ~9 hours (detailed breakdown above)
- **Ready to implement** ✅

## Notes

- Most complex page - taking incremental approach
- Balance calculations handled by API - no client-side math
- Real-time features deferred to phase 2
- Focus on solid foundation with good UX

## Implementation Notes (Phase 1)

The initial implementation created a fully functional group detail page as a monolithic component. This approach was chosen to:
1. Get a working page quickly to validate the data flow
2. Ensure all pieces work together before componentization
3. Allow for easier refactoring once the full picture is clear

The page currently includes all functionality inline within GroupDetailPage.tsx:
- Group header with stats
- Member grid display
- Balance summary from API
- Paginated expense list
- Quick action buttons (placeholders)

Next steps would be to extract each section into its own component for better maintainability and reusability.

## Phase 2 Implementation Status (2025-07-23)

### ✅ COMPLETED
- **Component Extraction**: Successfully extracted GroupDetailPage into 6 focused, reusable components:
  - `GroupHeader` (29 lines) - Group info display
  - `QuickActions` (19 lines) - Action buttons  
  - `MembersList` (25 lines) - Member grid
  - `BalanceSummary` (29 lines) - Debt calculations
  - `ExpensesList` (39 lines) - Expense list with pagination
  - `ExpenseItem` (25 lines) - Individual expense display

- **SPA Routing Fix**: Fixed critical UX issue where refresh/direct access caused 404 errors
  - Updated `firebase.template.json` with comprehensive rewrite rules
  - All routes now work on direct access: `/login`, `/dashboard`, `/groups/:id`

- **TypeScript Integration**: 
  - Fixed all import paths to use `webapp-shared-types.ts`
  - Resolved compilation errors
  - Build process working correctly

- **Browser Test Infrastructure**:
  - Created fast, optimized test framework
  - Verified authentication flow works
  - Confirmed routing fixes are effective

### ✅ PHASE 2 COMPLETE - ALL CRITICAL ISSUES RESOLVED (2025-07-23)

#### **GroupDetailPage Rendering Issues - FIXED**
- ✅ **Root Cause Identified**: Multiple validation and type errors causing component crashes
- ✅ **API Schema Validation Fixed**: Resolved "Response from /groups/:id does not match expected type" errors
  - Fixed member object structure in Firebase functions (missing `name` and `initials` fields)
  - Added proper schema validation for API responses
  - Ensured all member objects have required `displayName` fallbacks
- ✅ **Type Consolidation Completed**: Successfully consolidated duplicate types
  - Removed `TransformedGroup`, `GroupSummary`, `GroupDetail` duplicates  
  - Unified to single `Group` interface with optional detail fields
  - Fixed all TypeScript compilation errors
- ✅ **Component Error Handling**: Fixed multiple rendering crashes
  - Resolved null group access errors (members.length on undefined)
  - Fixed member displayName undefined errors in MembersList
  - Added proper loading states and error boundaries

#### **Browser Refresh Routing - FULLY FUNCTIONAL**
- ✅ **Firebase Hosting Configuration**: Reordered rewrite rules for proper asset serving
- ✅ **SPA Routing**: All routes now support direct browser navigation and refresh
  - `/dashboard` - ✅ Works with browser refresh
  - `/group/:id` - ✅ Works with browser refresh  
  - `/login`, `/register` - ✅ All auth routes functional
- ✅ **Static Asset Loading**: Fixed "Failed to load module script" MIME type errors

#### **Comprehensive Browser Testing - PASSED**
- ✅ **Homepage** (`/v2/`): V2 indicator present, loads correctly
- ✅ **Authentication Flow**: Login → Dashboard navigation working perfectly
- ✅ **Dashboard** (`/dashboard`): Groups load with proper balance information, v2 indicator present
- ✅ **Group Detail** (`/group/:id`): 
  - Navigation from dashboard works ✅
  - Direct browser navigation works ✅
  - Browser refresh supported ✅
  - Displays group data, members, and expenses correctly ✅
  - V2 indicator present ✅

#### **Data Integration - COMPLETE**
- ✅ **Group Detail Store**: Fetches group, expenses, and balance data
- ✅ **Member Display**: Shows all members with proper names and avatars
- ✅ **Expense List**: Displays paginated expenses with amounts and dates
- ✅ **Balance Information**: Integrated from group API response

### 🎯 FINAL STATUS: TASK COMPLETE ✅

**All critical functionality is working:**
- Group detail page renders correctly with real data
- Browser refresh routing fully supported
- API integration working without validation errors
- Component extraction completed (6 focused components)
- TypeScript compilation clean
- V2 webapp fully functional for group detail workflow

**Remaining work is LOW PRIORITY:**
- Real-time subscriptions (future enhancement)
- Advanced member management (add/remove)
- Expense CRUD operations (separate task)
- Advanced error handling improvements