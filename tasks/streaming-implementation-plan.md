# Real-time Streaming Implementation Plan

## Overview

This document outlines the staged implementation plan for migrating Splitifyd from a REST-based architecture to a hybrid approach using Firestore's real-time streaming capabilities. The migration will be done in three phases to minimize risk and deliver value incrementally.

## Current Architecture

- **Frontend**: Preact SPA with signals-based state management
- **State Stores**: `groups-store.ts`, `group-detail-store.ts`, `expense-form-store.ts`
- **Backend**: Express.js REST API running as Firebase Functions
- **Database**: Firestore with comprehensive security rules
- **Data Flow**: Manual refresh/polling with optimistic updates

## Implementation Phases

### Phase 1: Core Streaming Infrastructure (Estimated: 1-2 weeks)

#### Objective
Establish the foundation for real-time data streaming by implementing core infrastructure and migrating the groups list to use `onSnapshot`.

#### Tasks

1. **Enhance Firestore Security Rules** (`firebase/firestore.rules`)
   - Review and update rules for streaming access patterns
   - Add specific rules for real-time listeners
   - Test rule changes in emulator environment

2. **Update Type Definitions** (`firebase/functions/src/shared/`)
   - Add streaming-specific types and interfaces
   - Define connection state types
   - Add error handling types for real-time scenarios

3. **Implement Connection State Management**
   - Create new utility: `webapp-v2/src/utils/connection-manager.ts`
   - Handle online/offline scenarios
   - Implement exponential backoff for reconnection
   - Add connection status to stores

4. **Migrate Groups List to Streaming** (`webapp-v2/src/app/stores/groups-store.ts`)
   - Replace `fetchGroups()` REST call with `onSnapshot` listener
   - Add listener management (subscribe/unsubscribe)
   - Update loading states for real-time scenarios
   - Handle connection errors gracefully
   - Maintain compatibility with existing components

5. **Update Groups Dashboard** (`webapp-v2/src/pages/DashboardPage.tsx`)
   - Remove manual refresh triggers
   - Add connection status indicators
   - Test real-time group updates

#### Success Criteria
- Groups list updates in real-time when changes occur
- Connection state is properly managed and displayed
- No console errors during connection state changes
- All existing tests pass
- Performance is equal or better than REST approach

#### Testing Requirements
- Unit tests for connection manager
- Integration tests for groups store streaming
- Browser tests for real-time updates
- Network condition testing (offline/online scenarios)

---

### Phase 2: Group Detail Streaming (Estimated: 2-3 weeks)

#### Objective
Implement real-time streaming for group details, expenses, and balances to provide a collaborative experience.

#### Tasks

1. **Stream Group Data** (`webapp-v2/src/app/stores/group-detail-store.ts`)
   - Replace `fetchGroup()` with `onSnapshot` listener for group details
   - Implement smart listener management (start/stop based on route)
   - Handle group updates and deletions in real-time

2. **Stream Expenses List**
   - Replace `fetchExpenses()` with `onSnapshot` listener
   - Implement pagination with real-time updates
   - Handle new expense additions and modifications
   - Maintain cursor-based pagination compatibility

3. **Stream Group Balances**
   - Add `onSnapshot` listener for `group-balances` collection
   - Implement real-time balance updates
   - Handle balance recalculation events

4. **Client-side Balance Calculation**
   - Create utility: `webapp-v2/src/utils/balance-calculator.ts`
   - Implement balance calculation logic for small/medium groups
   - Add size threshold logic (client vs server calculation)
   - Ensure calculation accuracy matches server implementation

5. **Update Group Detail Page** (`webapp-v2/src/pages/GroupDetailPage.tsx`)
   - Remove manual refresh mechanisms
   - Add real-time update animations/notifications
   - Implement optimistic updates for user actions

6. **Enhance Error Handling**
   - Add retry logic for failed listeners
   - Implement user-friendly error messages
   - Handle permission changes gracefully

#### Success Criteria
- Group details update in real-time across all users
- Expense additions/modifications appear instantly
- Balance calculations are accurate and real-time
- Page performance is maintained or improved
- All CRUD operations work seamlessly with streaming

#### Testing Requirements
- Real-time collaboration testing (multiple users)
- Balance calculation accuracy tests
- Performance testing with large expense lists
- Error scenario testing (permission denied, network issues)

---

### Phase 3: Optimization & Polish (Estimated: 1 week)

#### Objective
Optimize performance, enhance user experience, and ensure production readiness.

#### Tasks

1. **Performance Optimization**
   - Implement intelligent batching for rapid updates
   - Add debouncing for UI updates
   - Optimize listener management (selective field updates)
   - Memory leak prevention and cleanup

2. **Advanced Error Handling**
   - Implement circuit breaker pattern for repeated failures
   - Add fallback to REST API when streaming fails
   - Enhanced offline support with cached data
   - User notification system for connection issues

3. **Size-based Strategy Selection**
   - Implement automatic threshold detection for client vs server balance calculation
   - Add configuration options for strategy selection
   - Performance monitoring and metrics collection

4. **User Experience Enhancements**
   - Add loading skeletons for initial data load
   - Implement smooth animations for real-time updates
   - Add "someone is typing" or activity indicators
   - Improve offline experience messaging

5. **Monitoring and Analytics**
   - Add performance metrics for streaming vs REST
   - Implement error tracking for real-time scenarios
   - Monitor connection quality and success rates

#### Success Criteria
- Application performs well under high-frequency updates
- Graceful degradation when streaming is unavailable
- Smooth user experience with appropriate feedback
- Production-ready error handling and monitoring

#### Testing Requirements
- Load testing with multiple concurrent users
- Network condition simulation
- Performance benchmarking vs current REST implementation
- End-to-end collaboration scenarios

## Technical Considerations

### Firestore Listener Management
- Use `unsubscribe()` functions to prevent memory leaks
- Implement listener lifecycle management in stores
- Handle component unmounting properly

### State Management Integration
- Leverage existing Preact signals for automatic UI updates
- Maintain backward compatibility with existing components
- Ensure type safety throughout the migration

### Security
- All streaming access controlled by existing Firestore rules
- No additional authentication required
- Maintain principle of least privilege

### Performance
- Monitor Firestore read costs (streaming vs REST)
- Implement efficient query patterns
- Use Firestore offline persistence where beneficial

## Rollback Strategy

Each phase can be independently rolled back:
- **Phase 1**: Revert groups store to REST calls
- **Phase 2**: Disable streaming listeners, re-enable REST endpoints
- **Phase 3**: Remove optimizations, keep core streaming functionality

## Future Enhancements

After successful implementation:
- User presence indicators
- Real-time notifications
- Collaborative expense editing
- Live activity feeds
- Enhanced offline synchronization

## Migration Timeline

- **Week 1**: Phase 1 implementation and testing
- **Week 2**: Phase 1 completion, Phase 2 start
- **Week 3-4**: Phase 2 implementation and testing
- **Week 5**: Phase 3 optimization and production preparation

Total estimated timeline: **4-5 weeks** for complete implementation.