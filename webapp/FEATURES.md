# Splitifyd Web App - Feature Checklist

## Core Features (MVP)

### 1. User Authentication
- [x] Login page with email/password
- [x] Registration page with validation
- [x] Session management (store auth token)
- [x] Logout functionality
- [x] Password reset flow

### 2. Dashboard/Home Page
- [x] Basic dashboard structure and authentication
- [x] Groups list (most recently used first)
  - [x] Group name and member avatars/initials
  - [x] Your balance within each group
  - [x] Last activity timestamp
  - [x] Quick "Add expense" button per group
- [x] Overall balance summary at top (total owed/owing across all groups)
- [x] Create new group button
- [x] Search/filter groups functionality
- [ ] Recent activity feed (collapsed by default, expandable)

### 3. Group List Item Display
Each group card should show:
- [x] Group name and icon/color
- [x] Member count and preview (first 3-4 avatars)
- [x] Your net balance in that group
- [x] Visual indicator if you owe money (red) or are owed (green)
- [x] Last expense preview (amount and description)
- [x] Click to enter group detail view

### 4. Group Detail View
When clicking on a group:
- [x] Group balance summary (who owes whom)
- [x] Group expenses list
- [x] Add expense button (pre-populated with this group)
- [x] Group settings/members management
- [x] Simplify debts view for this group
- [x] Group activity history

### 5. Add Expense Form
- [x] Amount input with decimal support
- [x] Description field
- [x] Date picker (default to today)
- [x] Payer selection (who paid)
- [x] Split type selector (equal, exact amounts, percentages)
- [x] Participant selector (checkboxes or multi-select)
- [x] Category selection (food, transport, utilities, etc.)
- [x] Receipt image upload (optional)
- [x] Group association (pre-selected if coming from group view)

### 6. Expense List View
- [ ] Filterable list of all expenses
- [ ] Search by description
- [ ] Filter by date range
- [ ] Filter by participants
- [ ] Filter by group
- [ ] Sort options (date, amount, description)
- [ ] Pagination or infinite scroll

### 7. Individual Expense Detail View
- [ ] Full expense information
- [ ] Edit/delete buttons (if user created it)
- [ ] Activity history for this expense
- [ ] Comments section
- [ ] Split breakdown (who owes what)

### 8. Friends/Contacts Management
- [ ] Add friends by email
- [ ] Contact list with search
- [ ] Pending invitations
- [ ] Remove/block friends
- [ ] Friend activity summary

### 9. Group Management
- [x] Create groups
- [ ] Add/remove members
- [ ] Group settings (name, icon, color)
- [ ] Group expense tracking
- [ ] Group balances view
- [ ] Archive/delete groups

### 10. Settlement/Payment Recording
- [ ] Record cash payments
- [ ] Mark debts as settled
- [ ] Payment history
- [ ] Simplify debts algorithm
- [ ] Settlement suggestions

---

## Enhanced Features (Phase 2)

### 11. Advanced Splitting Options
- [ ] Unequal splits by shares
- [ ] Item-based splitting (itemize receipts)
- [ ] Tax and tip calculators
- [ ] Recurring expenses
- [ ] Split by income ratio

### 12. Data Visualization
- [ ] Balance charts over time
- [ ] Spending by category pie charts
- [ ] Monthly spending trends
- [ ] Group spending analytics
- [ ] Personal spending insights

### 13. Export/Reports
- [ ] CSV export of transactions
- [ ] PDF summary reports
- [ ] Email monthly summaries
- [ ] Tax-ready expense reports

### 14. User Profile & Settings
- [ ] Profile photo upload
- [ ] Display name management
- [ ] Currency preferences
- [ ] Notification settings
- [ ] Theme selection (light/dark)
- [ ] Language preferences
- [ ] Default split preferences

### 15. Real-time Updates
- [ ] WebSocket connection for live updates
- [ ] Notification badges
- [ ] Push notifications setup
- [ ] Live expense feed
- [ ] Real-time balance updates

### 16. Advanced Search & Filters
- [ ] Full-text search across all data
- [ ] Complex filter combinations
- [ ] Saved filter presets
- [ ] Search history

### 17. Expense Templates
- [ ] Save common expenses as templates
- [ ] Quick-add from templates
- [ ] Scheduled/recurring expenses
- [ ] Template sharing within groups

---

## Nice-to-Have Features (Phase 3)

### 18. Social Features
- [ ] Expense comments and reactions
- [ ] Activity feed with likes
- [ ] Expense approval workflow
- [ ] @mentions in comments
- [ ] Group announcements

### 19. Integration Features
- [ ] Bank connection (Plaid)
- [ ] Venmo/PayPal payment links
- [ ] Calendar integration
- [ ] Email expense parsing
- [ ] SMS expense addition

### 20. Advanced Analytics
- [ ] Budget tracking
- [ ] Spending predictions
- [ ] Debt optimization suggestions
- [ ] Category-based budgets
- [ ] Spending alerts

### 21. Offline Support
- [ ] Service worker implementation
- [ ] Offline expense creation
- [ ] Sync when back online
- [ ] Conflict resolution

### 22. Accessibility
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] High contrast mode
- [ ] Font size controls
- [ ] WCAG 2.1 compliance

---

## Technical Implementation

### File Structure
```
webapp/
├── index.html
├── css/
│   ├── main.css
│   ├── components.css
│   └── themes.css
├── js/
│   ├── app.js
│   ├── auth.js
│   ├── api.js
│   ├── groups.js
│   ├── expenses.js
│   ├── utils.js
│   └── components/
│       ├── modal.js
│       ├── dropdown.js
│       └── datepicker.js
└── assets/
    ├── images/
    └── icons/
```

### File Structure Status
- [x] Basic directory structure created
- [x] index.html (login page)
- [x] css/main.css
- [ ] css/components.css
- [ ] css/themes.css
- [ ] js/app.js
- [x] js/auth.js
- [x] js/api.js
- [x] js/groups.js
- [x] js/expenses.js
- [ ] js/utils.js
- [x] js/components/modal.js
- [ ] js/components/dropdown.js
- [ ] js/components/datepicker.js
- [x] assets/images/
- [x] assets/icons/

### API Endpoints Needed
- **Auth**: `/login`, `/register`, `/logout`, `/reset-password`
- **Users**: `/users/me`, `/users/search`, `/users/{id}`
- **Groups**: `/groups`, `/groups/{id}`, `/groups/{id}/members`
- **Expenses**: `/expenses`, `/expenses/{id}`, `/groups/{id}/expenses`
- **Settlements**: `/settlements`, `/settlements/simplify`
- **Friends**: `/friends`, `/friends/invite`, `/friends/requests`

*For API configuration and testing setup, see [TECHNICAL_CONFIG.md](../TECHNICAL_CONFIG.md)*

### API Integration Status
- [x] Auth login endpoint connection
- [x] Auth register endpoint
- [x] Auth logout endpoint  
- [x] Auth reset-password endpoint
- [ ] Users endpoints
- [x] Groups endpoints (create, list)
- [x] Expenses endpoints (create, read, update, delete, list)
- [ ] Settlements endpoints
- [ ] Friends endpoints

### State Management
- [x] localStorage for auth tokens
- [ ] Session storage for temporary UI state
- [ ] IndexedDB for offline support (Phase 3)
- [ ] Simple pub/sub pattern for component communication

### Development Approach
1. [x] Start with static HTML/CSS for all main views
2. [ ] Add JavaScript progressively for interactivity
3. [ ] Implement API calls one feature at a time
4. [ ] Test each feature thoroughly before moving on
5. [ ] Keep components modular and reusable

*For detailed development workflow and testing procedures, see [TECHNICAL_CONFIG.md](../TECHNICAL_CONFIG.md)*

---

## Priority Order (Next Steps)
1. ✅ **Authentication system** - Login page complete
2. ✅ **Registration page** - Complete
3. ✅ **Dashboard/Home Page** - Complete with balance summary
4. ✅ **Groups list on home page** - Complete with search/filter
5. ✅ **Group creation** - Complete with validation
6. ✅ **Add expense form** - Complete with all split types
7. ✅ **Group detail view** - Complete with all features
8. **Expense list and filtering** - Next priority
9. **Settlement recording**
10. **Friends management**
11. Everything else based on user feedback

---

## UI/UX Considerations
- [x] Mobile-first responsive design
- [x] Touch-friendly tap targets
- [x] Clear visual hierarchy
- [x] Consistent color coding (red for debt, green for credit)
- [x] Loading states for all async operations
- [x] Error handling with user-friendly messages
- [ ] Smooth transitions and micro-animations
- [ ] Clear CTAs throughout