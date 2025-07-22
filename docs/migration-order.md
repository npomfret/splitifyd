# Webapp Migration Order

## Overview

This document outlines the recommended order for migrating pages from the vanilla JS/TS webapp to the new Preact-based webapp. The order is based on complexity, dependencies, and user impact.

## Migration Principles

1. **Start Simple**: Begin with static pages to establish patterns
2. **Build Foundation**: Create shared components before complex pages
3. **Incremental Value**: Each migration should provide immediate value
4. **Maintain Functionality**: Keep both apps working during migration
5. **Test Thoroughly**: In-browser testing at every step

## Migration Waves

### Wave 1: Foundation & Static Pages (Week 1)
**Goal**: Establish patterns, build confidence, minimal risk

#### 1.1 Landing Page (index.html)
- **Complexity**: Medium (due to Three.js globe)
- **Dependencies**: None
- **Components Needed**: 
  - Hero section
  - Feature cards
  - Globe component (lazy loaded)
  - Navigation header
- **Challenges**: 
  - Three.js integration with Preact
  - GSAP animations
  - ScrollReveal effects
- **Estimated Time**: 8 hours

#### 1.2 Static Legal Pages
- **Pages**: 
  - Privacy Policy (privacy.html)
  - Terms of Service (tos.html)
  - Cookie Policy (cookie-policy.html)
- **Complexity**: Low
- **Dependencies**: None
- **Components Needed**: 
  - StaticPageLayout
  - Markdown renderer
- **Estimated Time**: 4 hours total

#### 1.3 Pricing Page (pricing.html)
- **Complexity**: Low
- **Dependencies**: None
- **Components Needed**:
  - PricingCard
  - FeatureComparison
  - FAQ section
- **Estimated Time**: 4 hours

**Wave 1 Total**: 16 hours

### Wave 2: Authentication Flow (Week 2)
**Goal**: Establish auth patterns, Firebase integration

#### 2.1 Login Page (login.html)
- **Complexity**: Medium
- **Dependencies**: Firebase Auth
- **Components Needed**:
  - AuthLayout
  - LoginForm
  - FormInput with validation
  - ErrorMessage
- **Integration Points**:
  - Firebase Auth SDK
  - Form validation
  - Auth state management
- **Estimated Time**: 6 hours

#### 2.2 Register Page (register.html)
- **Complexity**: Medium
- **Dependencies**: Firebase Auth, Login components
- **Components Needed**:
  - RegisterForm (extends LoginForm patterns)
  - PasswordStrength indicator
- **Estimated Time**: 4 hours

#### 2.3 Reset Password Page (reset-password.html)
- **Complexity**: Low
- **Dependencies**: Auth components
- **Components Needed**:
  - ResetPasswordForm
- **Estimated Time**: 2 hours

**Wave 2 Total**: 12 hours

### Wave 3: Core App Structure (Week 3)
**Goal**: Build main app shell and navigation

#### 3.1 Dashboard (dashboard.html)
- **Complexity**: High
- **Dependencies**: Auth, API client, Group components
- **Components Needed**:
  - AppLayout (authenticated layout)
  - Navigation/Sidebar
  - GroupList
  - GroupCard
  - BalanceSummary
  - EmptyState
- **API Integration**:
  - GET /groups
  - Real-time balance updates
- **Challenges**:
  - State management for groups
  - Balance calculation display
  - Loading states
- **Estimated Time**: 12 hours

#### 3.2 404 Page (404.html)
- **Complexity**: Low
- **Dependencies**: None
- **Estimated Time**: 1 hour

**Wave 3 Total**: 13 hours

### Wave 4: Group Management (Week 4)
**Goal**: Core group functionality

#### 4.1 Group Detail Page (group-detail.html)
- **Complexity**: High
- **Dependencies**: Dashboard components, Expense list
- **Components Needed**:
  - GroupHeader
  - MemberList
  - ExpenseList
  - BalanceMatrix
  - SimplifiedDebts
  - AddExpenseButton
- **API Integration**:
  - GET /groups/:id
  - GET /groups/balances
  - GET /expenses/group
- **Challenges**:
  - Complex balance visualization
  - Pagination for expenses
  - Real-time updates
- **Estimated Time**: 16 hours

#### 4.2 Join Group Page (join-group.html)
- **Complexity**: Medium
- **Dependencies**: Auth, Group components
- **Components Needed**:
  - JoinGroupFlow
  - GroupPreview
- **API Integration**:
  - POST /groups/join
- **Estimated Time**: 4 hours

**Wave 4 Total**: 20 hours

### Wave 5: Expense Management (Week 5)
**Goal**: Complete expense functionality

#### 5.1 Add Expense Page (add-expense.html)
- **Complexity**: High
- **Dependencies**: Group components, Form components
- **Components Needed**:
  - ExpenseForm
  - ParticipantSelector
  - SplitCalculator
  - AmountInput
  - CategorySelector
  - DatePicker
- **API Integration**:
  - POST /expenses
- **Challenges**:
  - Complex split calculations
  - Dynamic form validation
  - Multiple split types
- **Estimated Time**: 12 hours

#### 5.2 Expense Detail Page (expense-detail.html)
- **Complexity**: Medium
- **Dependencies**: Expense components
- **Components Needed**:
  - ExpenseDetail
  - ExpenseHistory
  - EditExpenseModal
- **API Integration**:
  - GET /expenses
  - PUT /expenses
  - GET /expenses/history
- **Estimated Time**: 8 hours

**Wave 5 Total**: 20 hours

### Wave 6: Testing & Polish (Week 6)
**Goal**: Ensure quality and consistency

#### 6.1 Cross-browser Testing
- Test all pages in Chrome, Firefox, Safari
- Fix any compatibility issues
- **Estimated Time**: 8 hours

#### 6.2 Performance Optimization
- Lazy loading optimization
- Bundle size reduction
- Image optimization
- **Estimated Time**: 8 hours

#### 6.3 Error States & Edge Cases
- Network error handling
- Empty states
- Loading states
- **Estimated Time**: 8 hours

**Wave 6 Total**: 24 hours

## Total Migration Timeline

- **Wave 1**: 16 hours (Static pages)
- **Wave 2**: 12 hours (Authentication)
- **Wave 3**: 13 hours (Dashboard)
- **Wave 4**: 20 hours (Groups)
- **Wave 5**: 20 hours (Expenses)
- **Wave 6**: 24 hours (Testing & Polish)

**Total**: 105 hours (~13-14 days at 8 hours/day)

## Success Criteria for Each Page

Before marking a page as complete:
1. ✅ All functionality from original page works
2. ✅ Zero console errors or warnings
3. ✅ Responsive design works (375px, 768px, 1440px)
4. ✅ Cross-browser tested (Chrome, Firefox, Safari)
5. ✅ Loading states implemented
6. ✅ Error states implemented
7. ✅ TypeScript strict mode passes
8. ✅ In-browser testing completed with screenshots

## Risk Mitigation

1. **Keep both apps running**: Use routing to serve old/new pages
2. **Feature flags**: Toggle between implementations if needed
3. **Incremental deployment**: Deploy each wave separately
4. **Rollback plan**: Keep old pages accessible at /legacy/*
5. **User communication**: Notify users of gradual improvements

## Dependencies to Build First

Before starting page migrations, ensure these are ready:
1. **API Client** with type safety and runtime validation
2. **Auth Manager** for Firebase Auth integration
3. **Router Setup** for navigation
4. **Base Layouts** (AppLayout, AuthLayout)
5. **Common Components** (Button, Input, Card, Modal)
6. **State Management** (if needed)
7. **Error Boundary** for graceful error handling

## Notes

- Three.js globe can be migrated last or kept as-is initially
- Focus on functionality over animations in initial migration
- Add polish and animations after core functionality works
- Consider using feature detection for progressive enhancement

---

*Last Updated: 2025-07-22*