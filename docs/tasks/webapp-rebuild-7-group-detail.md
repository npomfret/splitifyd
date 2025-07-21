# Webapp Rebuild Task 7: Migrate Group Detail & Expense List

## Overview
Migrate the group detail page with member management, expense listing, balance calculations, and group settings to Preact.

## Prerequisites
- [ ] Complete webapp-rebuild-6-dashboard.md
- [ ] Groups store implemented
- [ ] API client configured for expenses

## Current State
- Complex page with multiple sections
- Manual balance calculations
- Static expense list
- Member management via direct DOM manipulation
- No real-time updates

## Target State
- Reactive group detail with live updates
- Automatic balance recalculation
- Real-time expense list
- Smooth member management
- Enhanced UX with loading states

## Implementation Steps

### Phase 1: Page Structure (1 hour)

1. **Group detail layout** (`pages/GroupDetailPage.tsx`)
   - [ ] Group header with name/settings
   - [ ] Members section
   - [ ] Balances summary
   - [ ] Expenses list
   - [ ] Quick actions toolbar

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

### Phase 2: Group State Management (2 hours)

1. **Group detail store** (`stores/group-detail-store.ts`)
   ```typescript
   interface GroupDetailStore {
     group: Group | null;
     members: GroupMember[];
     expenses: Expense[];
     balances: Balance[];
     loading: boolean;
     error: string | null;
     
     fetchGroup: (id: string) => Promise<void>;
     updateGroup: (updates: Partial<Group>) => Promise<void>;
     addMember: (email: string) => Promise<void>;
     removeMember: (memberId: string) => Promise<void>;
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

## Timeline

- Start Date: TBD
- End Date: TBD
- Duration: ~9 hours

## Notes

- Most complex page - plan carefully
- Balance calculations are critical
- Real-time features are key selling point
- Consider performance with large datasets