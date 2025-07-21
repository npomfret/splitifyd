# Webapp Rebuild Task 10: Migrate Join Group Flow

## Overview
Migrate the join group functionality with invitation link handling, group preview, and seamless onboarding experience to Preact.

## Prerequisites
- [ ] Complete webapp-rebuild-7-group-detail.md
- [ ] Group management functionality working
- [ ] Auth system integrated

## Current State
- Separate join group page
- Basic group preview
- Simple join confirmation
- Manual navigation after joining

## Target State
- Enhanced join group experience
- Rich group preview before joining
- Streamlined onboarding flow
- Better error handling and edge cases
- Mobile-optimized interface

## Implementation Steps

### Phase 1: Join Group Page (1 hour)

1. **Join group component** (`pages/JoinGroupPage.tsx`)
   - [ ] URL parameter handling for group ID/code
   - [ ] Loading state while fetching group
   - [ ] Group preview section
   - [ ] Join confirmation area
   - [ ] Error state handling

2. **URL pattern handling**
   - [ ] Support `/join/:groupId` format
   - [ ] Support `/join?code=:inviteCode` format
   - [ ] Handle invalid/expired links
   - [ ] Redirect to appropriate pages

### Phase 2: Group Preview Components (2 hours)

1. **Group preview components**
   ```
   components/join-group/
   ├── GroupPreview.tsx       # Group info and stats
   ├── MembersPreview.tsx     # Current members list
   ├── RecentActivity.tsx     # Recent group activity
   ├── JoinButton.tsx         # Primary join action
   ├── GroupStats.tsx         # Group statistics
   └── InviterInfo.tsx        # Who invited you
   ```

2. **Preview information**
   - [ ] Group name and description
   - [ ] Member count and avatars
   - [ ] Recent expense activity
   - [ ] Group creation date
   - [ ] Total expenses/amounts

### Phase 3: Join Flow Logic (1 hour)

1. **Join process implementation**
   - [ ] Validate invitation (not expired, valid group)
   - [ ] Check if user already member
   - [ ] Handle different invitation types
   - [ ] Add user to group
   - [ ] Navigate to group after joining

2. **Edge case handling**
   - [ ] User not authenticated (redirect to login)
   - [ ] Invitation expired
   - [ ] Group not found
   - [ ] User already member
   - [ ] Group at member limit

### Phase 4: Enhanced Features (1 hour)

1. **Invitation context**
   - [ ] Show who invited you
   - [ ] Invitation message display
   - [ ] Invitation timestamp
   - [ ] Personal invitation notes

2. **Onboarding improvements**
   - [ ] Welcome message for new members
   - [ ] Quick tour of group features
   - [ ] Suggested first actions
   - [ ] Tutorial tooltips

### Phase 5: Mobile & UX Polish (1 hour)

1. **Mobile optimization**
   - [ ] Touch-friendly interface
   - [ ] Proper viewport handling
   - [ ] Share functionality
   - [ ] App-like experience

2. **UX enhancements**
   - [ ] Smooth loading transitions
   - [ ] Clear action buttons
   - [ ] Progress indicators
   - [ ] Success animations

## In-Browser Testing Checklist

### Basic Functionality

1. **URL handling**
   - [ ] Direct group ID links work
   - [ ] Invite code links work
   - [ ] Invalid links handled gracefully
   - [ ] Deep linking works properly

2. **Group preview**
   - [ ] Group information displays correctly
   - [ ] Member list shows properly
   - [ ] Statistics calculated correctly
   - [ ] Activity feed loads

3. **Join process**
   - [ ] Join button works
   - [ ] Success confirmation shown
   - [ ] Navigation to group works
   - [ ] User added to group correctly

### Authentication Flow

1. **Unauthenticated users**
   - [ ] Redirected to login
   - [ ] Return to join after login
   - [ ] Invitation link preserved
   - [ ] Registration flow works

2. **Authenticated users**
   - [ ] Direct join process
   - [ ] Proper permission checks
   - [ ] User context maintained
   - [ ] Session handling correct

### Edge Cases

1. **Invalid invitations**
   - [ ] Expired invitations handled
   - [ ] Non-existent groups handled
   - [ ] Invalid codes handled
   - [ ] Clear error messages shown

2. **Duplicate joins**
   - [ ] Already member detected
   - [ ] Appropriate message shown
   - [ ] Navigation to group works
   - [ ] No duplicate memberships

3. **Group limits**
   - [ ] Member limit respected
   - [ ] Clear rejection message
   - [ ] Alternative actions suggested
   - [ ] Contact options provided

### Mobile Experience

1. **Share functionality**
   - [ ] Share invitation links
   - [ ] Share group previews
   - [ ] Native share APIs work
   - [ ] Fallback sharing works

2. **Touch interactions**
   - [ ] Touch targets adequate
   - [ ] Scroll behavior smooth
   - [ ] Tap feedback clear
   - [ ] Loading states visible

### Performance

1. **Loading performance**
   - [ ] Group preview loads quickly
   - [ ] Images load progressively
   - [ ] No blocking operations
   - [ ] Offline handling graceful

2. **Error recovery**
   - [ ] Network errors handled
   - [ ] Retry mechanisms work
   - [ ] Degraded functionality available
   - [ ] User feedback clear

## Deliverables

1. **Working join group page**
2. **Rich group preview interface**
3. **Streamlined join process**
4. **Edge case handling**
5. **Mobile-optimized experience**

## Success Criteria

- [ ] All invitation types work correctly
- [ ] Group previews informative and attractive
- [ ] Join process smooth and reliable
- [ ] Excellent mobile experience
- [ ] Proper error handling
- [ ] No broken invitation links

## Implementation Notes

1. **URL structure**
   - Maintain backward compatibility
   - Support both ID and code formats
   - Handle URL encoding properly
   - Consider SEO implications

2. **Security considerations**
   - Validate all invitation tokens
   - Check group permissions
   - Prevent invitation abuse
   - Rate limit join attempts

3. **Analytics tracking**
   - Track invitation success rates
   - Monitor join funnel
   - Identify drop-off points
   - A/B testing capabilities

## Timeline

- Start Date: TBD
- End Date: TBD
- Duration: ~6 hours

## Notes

- Join flow is critical for user growth
- Mobile experience especially important
- Consider viral/sharing features
- Monitor conversion rates closely