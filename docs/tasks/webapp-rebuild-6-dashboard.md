# Webapp Rebuild Task 6: Migrate Dashboard

## Overview
Migrate the dashboard page with group listing, recent activity, and user management features to Preact with reactive state management.

## Prerequisites
- [ ] Complete webapp-rebuild-5-auth-pages.md
- [ ] Auth system working in Preact
- [ ] API client configured for groups

## Current State
- Static dashboard with manual DOM updates
- Group cards built via `ui-builders.ts`
- Manual refresh for updates
- No real-time data sync
- Basic warning banner system

## Target State
- Reactive dashboard with real-time updates
- Clean component-based group cards
- Automatic data sync
- Loading states and error handling
- Enhanced user experience

## Implementation Steps

### Phase 1: Dashboard Layout (1 hour)

1. **Dashboard component** (`pages/DashboardPage.tsx`)
   - [ ] Main layout with header
   - [ ] Sidebar or navigation
   - [ ] Content area for groups
   - [ ] Quick actions section

2. **Dashboard sections**
   ```
   components/dashboard/
   ├── DashboardHeader.tsx    # Welcome message, user info
   ├── GroupsList.tsx         # Main groups listing
   ├── GroupCard.tsx          # Individual group component
   ├── CreateGroupButton.tsx  # Quick group creation
   ├── EmptyState.tsx         # No groups yet message
   └── WarningBanner.tsx      # System warnings
   ```

### Phase 2: Groups State Management (2 hours)

1. **Groups store** (`stores/groups-store.ts`)
   ```typescript
   interface GroupsStore {
     groups: Group[];
     loading: boolean;
     error: string | null;
     fetchGroups: () => Promise<void>;
     createGroup: (name: string) => Promise<Group>;
     updateGroup: (id: string, updates: Partial<Group>) => Promise<void>;
     deleteGroup: (id: string) => Promise<void>;
   }
   ```

2. **Firestore integration with reactfire**
   - [ ] Real-time groups collection listener
   - [ ] Automatic updates on changes
   - [ ] Optimistic updates for actions
   - [ ] Handle connection states

3. **Groups filtering and sorting**
   - [ ] Active vs archived groups
   - [ ] Sort by recent activity
   - [ ] Search functionality
   - [ ] Filter by member status

### Phase 3: Group Card Component (2 hours)

1. **Group card features**
   - [ ] Group name and member count
   - [ ] Recent activity summary
   - [ ] Outstanding balance indicator
   - [ ] Quick action menu
   - [ ] Member avatars

2. **Interactive features**
   - [ ] Click to navigate to group
   - [ ] Hover states and animations
   - [ ] Context menu for actions
   - [ ] Loading state during actions

3. **Balance calculations**
   - [ ] Show user's balance in group
   - [ ] Color coding (owe/owed)
   - [ ] Quick settle indicators
   - [ ] Update in real-time

### Phase 4: Group Creation Flow (1 hour)

1. **Create group modal/form**
   - [ ] Group name input
   - [ ] Description field
   - [ ] Initial member invites
   - [ ] Group settings
   - [ ] Validation and error handling

2. **Group creation process**
   - [ ] Form validation
   - [ ] API call with loading state
   - [ ] Success feedback
   - [ ] Navigate to new group
   - [ ] Handle errors gracefully

### Phase 5: Dashboard Features (2 hours)

1. **User info section**
   - [ ] User avatar and name
   - [ ] Account settings link
   - [ ] Notification preferences
   - [ ] Logout functionality

2. **Recent activity feed**
   - [ ] Recent expenses across groups
   - [ ] Member invitations
   - [ ] Settlement notifications
   - [ ] Activity filtering

3. **Quick stats**
   - [ ] Total groups count
   - [ ] Outstanding balances
   - [ ] Recent expense total
   - [ ] Activity charts (if needed)

4. **Warning banner system**
   - [ ] System maintenance notices
   - [ ] Account warnings
   - [ ] Feature announcements
   - [ ] Dismissible notifications

## In-Browser Testing Checklist

### Core Functionality

1. **Page load**
   - [ ] Dashboard loads without errors
   - [ ] Groups display correctly
   - [ ] Loading states work
   - [ ] Empty state shows when no groups

2. **Groups listing**
   - [ ] All groups display
   - [ ] Group info accurate
   - [ ] Balances calculated correctly
   - [ ] Real-time updates work

3. **Group interactions**
   - [ ] Click navigates to group
   - [ ] Context menu works
   - [ ] Actions complete successfully
   - [ ] Loading states during actions

### Real-time Features

1. **Data synchronization**
   - [ ] New groups appear automatically
   - [ ] Updates from other users sync
   - [ ] Balance changes reflect
   - [ ] Connection lost/restored handling

2. **Optimistic updates**
   - [ ] Actions show immediately
   - [ ] Rollback on failure
   - [ ] Consistent state maintained
   - [ ] No flickering

### Group Creation

1. **Create group flow**
   - [ ] Form opens correctly
   - [ ] Validation works
   - [ ] Group created successfully
   - [ ] Navigation to new group
   - [ ] Error handling works

2. **Form validation**
   - [ ] Required fields enforced
   - [ ] Name length limits
   - [ ] Duplicate name handling
   - [ ] Invalid input feedback

### Performance Testing

1. **Large group lists**
   - [ ] Performance with 50+ groups
   - [ ] Scroll performance
   - [ ] Memory usage stable
   - [ ] No render thrashing

2. **Network conditions**
   - [ ] Slow connection handling
   - [ ] Offline behavior
   - [ ] Reconnection handling
   - [ ] Error recovery

### Mobile Testing

- [ ] Responsive layout works
- [ ] Touch interactions smooth
- [ ] Text readable on small screens
- [ ] Context menus work on mobile
- [ ] Performance on mobile devices

## Deliverables

1. **Working dashboard page**
2. **Reusable group card component**
3. **Real-time groups synchronization**
4. **Group creation functionality**
5. **Warning banner system**

## Success Criteria

- [ ] Dashboard fully functional
- [ ] Real-time updates working
- [ ] Better performance than original
- [ ] Clean component architecture
- [ ] No data inconsistencies
- [ ] Smooth user experience

## Migration Notes

1. **Data structure changes**
   - Ensure backend compatibility
   - Handle any schema updates
   - Migrate existing group data

2. **URL structure**
   - Maintain `/dashboard` route
   - Handle redirects if needed
   - Preserve bookmarks

3. **Feature parity**
   - All original features working
   - Enhanced with real-time updates
   - Better error handling

## Timeline

- Start Date: TBD
- End Date: TBD
- Duration: ~8 hours

## Notes

- Dashboard is central hub - must be solid
- Real-time updates are key feature
- Consider pagination for large group lists
- Monitor performance closely