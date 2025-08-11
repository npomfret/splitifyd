# Phase 3 Testing Guide: Progressive Streaming Migration

## Overview
Phase 3 implements progressive streaming migration with hybrid approaches, client-side balance calculation, collaborative features, and real-time animations.

## Key Components Implemented

### Backend Dependencies
- **Phase 1**: Change detection triggers must be running
- **Phase 2**: Enhanced REST endpoints with metadata
- **Firestore Security Rules**: Updated for presence and typing collections

### Frontend Components
- **Enhanced Group Detail Store** (`webapp-v2/src/app/stores/group-detail-store-enhanced.ts`)
  - Hybrid streaming (group metadata + notification-driven expenses)
  - Real-time balance streaming
  - User context preservation
  - Smart refresh with animations

- **Balance Calculator** (`webapp-v2/src/utils/balance-calculator.ts`)
  - Client-side calculation for small datasets (<100 expenses)
  - Server fallback for large datasets
  - Optimized settlement calculation
  - Balance validation and audit trail

- **Presence Manager** (`webapp-v2/src/utils/presence-manager.ts`)
  - Real-time user presence tracking
  - Typing indicators
  - Location-based presence (group/expense form)
  - Connection-aware presence updates

- **Animation Manager** (`webapp-v2/src/utils/animation-manager.ts`)
  - Balance update animations
  - Expense change animations (add/modify/remove)
  - Presence change animations
  - Performance monitoring

- **Collaborative UI Components** (`webapp-v2/src/components/ui/PresenceIndicator.tsx`)
  - Presence indicators with avatars
  - Typing indicators
  - Activity feed
  - Real-time update animations

## Testing Procedure

### 1. Prerequisites

```bash
# Ensure emulators are running
npm run dev

# Verify Phase 1 and 2 are working
# See phase1-testing.md and phase2-testing.md
```

### 2. Test Enhanced Group Detail Store

#### 2.1 Hybrid Streaming Setup

```bash
# Get auth token
AUTH_TOKEN=$(curl -s http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key \
  -H 'Content-Type: application/json' \
  -d '{\"email\":\"test@example.com\",\"password\":\"testpass123\",\"returnSecureToken\":true}' | jq -r .idToken)

# Create test group
GROUP_RESPONSE=$(curl -X POST http://localhost:5001/splitifyd-test/us-central1/api/groups \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Phase 3 Test Group",
    "description": "Testing progressive streaming",
    "members": []
  }' | jq .)

GROUP_ID=$(echo $GROUP_RESPONSE | jq -r .id)
echo "Created test group: $GROUP_ID"
```

#### 2.2 Test Group Metadata Streaming

Open browser console and run:

```javascript
// Import the enhanced store
import { enhancedGroupDetailStore } from './app/stores/group-detail-store-enhanced.js';

// Load a group
const groupId = 'your-test-group-id'; // Replace with actual ID
const userId = 'test-user-id';

await enhancedGroupDetailStore.loadGroup(groupId);
enhancedGroupDetailStore.subscribeToChanges(userId);

// Monitor streaming status
console.log('Streaming status:', enhancedGroupDetailStore.isStreaming);
console.log('Group data:', enhancedGroupDetailStore.group);

// Test real-time updates
setInterval(() => {
  console.log({
    lastUpdate: new Date(enhancedGroupDetailStore.lastUpdate),
    hasRecentUpdates: enhancedGroupDetailStore.hasRecentUpdates,
    balances: enhancedGroupDetailStore.balances
  });
}, 2000);
```

#### 2.3 Test Real-time Balance Updates

```bash
# Create test expenses to trigger balance changes
curl -X POST http://localhost:5001/splitifyd-test/us-central1/api/expenses \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"groupId\": \"$GROUP_ID\",
    \"description\": \"Test Expense for Balance Update\",
    \"amount\": 25.50,
    \"paidBy\": \"user1\",
    \"splits\": {
      \"user1\": 12.75,
      \"user2\": 12.75
    }
  }"
```

**Expected Results:**
- Balance updates appear within 500ms
- Smooth number animations from old to new values
- Visual indicators (color changes, scaling) for significant changes
- No page refresh required

### 3. Test Client-Side Balance Calculator

#### 3.1 Test Small Dataset (Client-side)

```javascript
import { BalanceCalculator } from './utils/balance-calculator.js';

// Create test expenses (under 100 limit)
const testExpenses = [
  {
    id: 'exp1',
    amount: 30,
    paidBy: 'user1',
    splits: { user1: 15, user2: 15 }
  },
  {
    id: 'exp2', 
    amount: 40,
    paidBy: 'user2',
    splits: { user1: 20, user2: 20 }
  }
];

// Calculate balances
const result = await BalanceCalculator.calculateBalances('test-group', testExpenses);
console.log('Balance result:', result);

// Verify calculation method
console.log('Calculated using:', result.calculated); // Should be 'client'

// Validate results
const validation = BalanceCalculator.validateBalances(testExpenses, result);
console.log('Validation:', validation);
```

**Expected Results:**
- `calculated: 'client'` for small datasets
- Balanced credits and debits (sum to zero)
- Optimized settlements (minimal transactions)
- Validation passes with no errors

#### 3.2 Test Large Dataset (Server Fallback)

```javascript
// Create large dataset (>100 expenses)
const largeDataset = Array.from({length: 150}, (_, i) => ({
  id: `exp${i}`,
  amount: Math.random() * 100,
  paidBy: `user${i % 5}`,
  splits: {
    [`user${i % 5}`]: Math.random() * 50,
    [`user${(i + 1) % 5}`]: Math.random() * 50
  }
}));

const result = await BalanceCalculator.calculateBalances('test-group', largeDataset);
console.log('Large dataset result:', result.calculated); // Should be 'server'
```

### 4. Test Collaborative Features

#### 4.1 Test Presence Tracking

```javascript
import { PresenceManager } from './utils/presence-manager.js';

const presenceManager = PresenceManager.getInstance();

// Initialize presence
await presenceManager.initialize({
  id: 'test-user-1',
  name: 'Test User 1',
  avatar: '/avatars/user1.png'
});

// Update location
await presenceManager.updateLocation('group', groupId, 'viewing');

// Monitor presence
presenceManager.onlineUsers.subscribe(users => {
  console.log('Online users:', users);
});

presenceManager.usersInCurrentLocation.subscribe(users => {
  console.log('Users in current location:', users);
});
```

#### 4.2 Test Typing Indicators

```javascript
// Simulate typing in expense form
presenceManager.updateLocation('expense-form', groupId, 'editing');

// Start typing
presenceManager.startTyping();

// Monitor typing users
presenceManager.typingUsers.subscribe(typing => {
  console.log('Users typing:', typing);
});

// Stop typing after delay
setTimeout(() => {
  presenceManager.stopTyping();
}, 3000);
```

#### 4.3 Test Multi-User Presence

Open the app in multiple browser tabs/windows:

1. **Tab 1**: User "Alice" viewing group
2. **Tab 2**: User "Bob" editing expense form  
3. **Tab 3**: User "Charlie" typing in expense form

**Expected Results:**
- Each tab shows other users' presence
- Different activity indicators (viewing/editing/typing)
- Real-time updates when users change location/activity
- Typing indicators appear/disappear appropriately

### 5. Test Real-Time Animations

#### 5.1 Test Balance Animations

```javascript
import { AnimationManager } from './utils/animation-manager.js';

const animationManager = AnimationManager.getInstance();

// Find a balance element
const balanceElement = document.querySelector('.balance-amount');

// Animate balance change
await animationManager.animateBalanceUpdate(
  balanceElement,
  25.50,  // old value
  42.75,  // new value
  '$'     // currency
);

console.log('Balance animation completed');
```

#### 5.2 Test Expense List Animations

```javascript
// Simulate expense changes
const mockChanges = {
  added: [document.querySelector('[data-expense-id="new-expense"]')],
  modified: [document.querySelector('[data-expense-id="existing-expense"]')],
  removed: [document.querySelector('[data-expense-id="old-expense"]')]
};

await animationManager.animateExpenseChanges(mockChanges);
console.log('Expense animations completed');
```

#### 5.3 Test Performance Monitoring

```javascript
// Monitor animation performance
const metrics = animationManager.getPerformanceMetrics();
console.log('Animation performance:', metrics);

// Check for reduced motion preference
const reducedMotion = animationManager.respectsReducedMotion();
console.log('Reduced motion preferred:', reducedMotion);
```

### 6. Integration Testing

#### 6.1 Test Complete User Flow

1. **User A** opens group page
2. **User B** opens same group in another browser
3. **User A** creates new expense
4. **User B** should see:
   - Presence indicator for User A
   - Real-time expense addition with animation
   - Balance updates with smooth transitions
   - Activity indicators

#### 6.2 Test Connection Quality Changes

```javascript
import { ConnectionManager } from './utils/connection-manager.js';
const connMgr = ConnectionManager.getInstance();

// Simulate poor connection
connMgr.connectionQuality.value = 'poor';

// Observe delayed updates and longer debouncing
// Changes should still work but with longer delays
```

#### 6.3 Test Offline/Online Transitions

```javascript
// Simulate offline
connMgr.isOnline.value = false;

// Verify:
// - Presence tracking stops
// - Streaming pauses
// - UI shows offline indicators

// Simulate back online
connMgr.isOnline.value = true;

// Verify:
// - Streaming resumes
// - Presence tracking restarts
// - Missed updates are fetched
```

### 7. Error Handling Tests

#### 7.1 Test Streaming Failures

```javascript
// Test Firestore connection failure
// Disable network in DevTools or use:
// await firebase.firestore().disableNetwork();

// Expected behavior:
// - Graceful fallback to REST
// - No console errors
// - User experience remains functional
```

#### 7.2 Test Balance Calculation Errors

```javascript
// Test with malformed expense data
const badExpenses = [
  { id: 'bad1', amount: NaN, paidBy: 'user1', splits: {} },
  { id: 'bad2', amount: -50, paidBy: null, splits: { user1: 'invalid' } }
];

const result = await BalanceCalculator.calculateBalances('test-group', badExpenses);
const validation = BalanceCalculator.validateBalances(badExpenses, result);

// Should handle errors gracefully
console.log('Error handling result:', validation);
```

### 8. Performance Testing

#### 8.1 Test with Large Groups

```javascript
// Create group with many members and expenses
const largeGroup = {
  memberIds: Array.from({length: 50}, (_, i) => `user${i}`),
  // Many expenses...
};

// Monitor performance
const startTime = performance.now();
await enhancedGroupDetailStore.loadGroup(largeGroupId);
const loadTime = performance.now() - startTime;

console.log(`Load time for large group: ${loadTime}ms`);
```

#### 8.2 Test Memory Usage

```javascript
// Monitor memory over time
const memoryBefore = performance.memory?.usedJSHeapSize || 0;

// Perform many streaming updates
for (let i = 0; i < 100; i++) {
  // Trigger updates
  await new Promise(resolve => setTimeout(resolve, 100));
}

const memoryAfter = performance.memory?.usedJSHeapSize || 0;
console.log(`Memory increase: ${(memoryAfter - memoryBefore) / 1024 / 1024}MB`);
```

## Success Criteria

### Functionality ✅
- [ ] Hybrid streaming works (group metadata streams, expenses use notifications)
- [ ] Client-side balance calculation for <100 expenses
- [ ] Server fallback for large datasets  
- [ ] Real-time presence tracking
- [ ] Typing indicators work correctly
- [ ] Smooth animations for all updates
- [ ] User context preserved during updates

### Performance ✅
- [ ] Group load time <2 seconds
- [ ] Balance update latency <500ms
- [ ] Smooth animations (no frame drops)
- [ ] Memory usage stable over time
- [ ] Client calculation faster than server for small datasets

### Reliability ✅
- [ ] Graceful fallback when streaming fails
- [ ] Offline/online transitions work smoothly
- [ ] Error handling doesn't break UI
- [ ] Connection quality affects behavior appropriately
- [ ] Balance calculations are accurate

### User Experience ✅
- [ ] Real-time updates feel natural
- [ ] Animations enhance rather than distract
- [ ] Presence indicators are informative
- [ ] No jarring interruptions during use
- [ ] Reduced motion preferences respected

## Troubleshooting

### Streaming Not Working
- Verify Firebase emulator running on correct ports
- Check Firestore security rules allow reading change collections
- Ensure user is authenticated
- Look for console errors related to Firestore connections

### Animations Jerky or Slow
- Check `prefers-reduced-motion` setting
- Monitor performance with DevTools
- Verify hardware acceleration enabled
- Test on different devices/browsers

### Presence Not Updating
- Confirm multiple users are authenticated
- Check network connectivity
- Verify presence documents being created in Firestore
- Test typing timeout behavior (3-second auto-stop)

### Balance Calculations Wrong
- Use `BalanceCalculator.validateBalances()` to check
- Compare client vs server results
- Check expense data format and types
- Verify split amounts sum to total expense amount

## Next Steps

After successful Phase 3 testing:
1. Proceed to Phase 4: Optimization & Production Polish
2. Monitor real-world performance metrics
3. Gather user feedback on collaborative features
4. Optimize based on usage patterns