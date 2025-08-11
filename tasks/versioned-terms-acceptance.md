## Task: Implement Versioned Terms and Cookie Policy Acceptance

**Goal:**
Create a system that tracks which version of the Terms of Service and Cookie Policy a user has accepted. If a policy is updated, the system must prompt the user to accept the new version before they can continue using the app.

**Justification:**
This ensures that we have a clear and auditable record of user consent for specific versions of our legal policies, which is critical for compliance and legal protection.

---

### Proposed Solution Design

#### 1. Firestore Data Model

We will use Firestore to store the policies and the user's acceptance records.

**A. Policies Collection**

A new collection named `policies` will store the content and versioning information for each legal document.

- **Collection:** `policies`
- **Document IDs:** `termsOfService`, `cookiePolicy`

**Document Structure (`/policies/termsOfService`):**
```json
{
  "policyName": "Terms of Service",
  "currentVersionHash": "sha256-abc123def456...",
  "versions": {
    "sha256-abc123def456...": {
      "text": "The full text of the new terms...",
      "createdAt": "2025-09-15T10:00:00Z"
    },
    "sha256-xyz789uvw123...": {
      "text": "The full text of the old terms...",
      "createdAt": "2025-01-20T14:30:00Z"
    }
  }
}
```
- `currentVersionHash`: The hash of the currently active policy version.
- `versions`: A map where each key is the SHA-256 hash of the policy text, and the value is an object containing the text and a timestamp.

**B. User Document Enhancement**

The user's document in the `users` collection will be updated to store the hash of the policy version they accepted.

- **Collection:** `users`
- **Document ID:** `[userId]`

**Document Structure (`/users/{userId}`):**
```json
{
  "email": "user@example.com",
  // ... other user fields
  "acceptedPolicies": {
    "termsOfService": "sha256-xyz789uvw123...",
    "cookiePolicy": "sha256-jkl456mno789..."
  }
}
```
- `acceptedPolicies`: A map where each key is the policy ID and the value is the hash of the version the user last accepted.

---

#### 2. System Logic

**A. Updating a Policy**

1.  An admin updates the policy text.
2.  A script or Cloud Function calculates the SHA-256 hash of the new text.
3.  This script updates the relevant document in the `policies` collection by:
    - Adding a new entry to the `versions` map with the new hash and text.
    - Updating the `currentVersionHash` field to the new hash.

**B. Checking for Acceptance (App Load/Login)**

1.  When a user logs in or opens the app, the client fetches the `currentVersionHash` for all policies from the `/policies` collection.
2.  The client also fetches the user's `acceptedPolicies` map from their user document.
3.  For each policy, the client compares the `currentVersionHash` with the hash stored in the user's `acceptedPolicies`.
4.  **If the hashes do not match** for any policy, the user has not accepted the latest version.

**C. Prompting for Re-acceptance**

1.  If a mismatch is detected, the application should immediately block access to its main features.
2.  A modal or a dedicated, full-screen page must be displayed.
3.  This screen will show the new policy text (fetched from `policies/{policyId}/versions/{currentVersionHash}`).
4.  The user must check a box and click an "I Accept" button.
5.  Upon acceptance, the client updates the user's document in Firestore, setting the appropriate field in `acceptedPolicies` to the `currentVersionHash`.
6.  Once all required policies are accepted, the block is removed, and the user can access the app normally.

---

#### 3. Admin Interface for Policy Management

To manage these policies, a secure admin interface is required.

**A. Access Control**
- Only users with an `admin` role should be able to access this interface.
- Access should be controlled via Firestore Security Rules and checked on the client and in any backend functions.

**B. UI Components**

1.  **Policy List View:**
    - A dashboard page that lists all the documents in the `policies` collection (e.g., "Terms of Service", "Cookie Policy").
    - Each item should show the `policyName` and the `currentVersionHash`.

2.  **Policy Detail/Editor View:**
    - Clicking a policy opens an editor page.
    - The page should have a large text area (supporting Markdown or rich text) to edit the policy content.
    - It should display a list or dropdown of all historical versions of the policy, allowing an admin to view the text of any previous version.

3.  **Publishing Workflow:**
    - After editing the text, the admin can save the changes.
    - Saving a change should NOT automatically make it the live version. It should be saved as a new, inactive version.
    - A separate, explicit "Set as Current Version" or "Publish" button is required.
    - Clicking this button will:
        a. Calculate the SHA-256 hash of the new text.
        b. Add the new version to the `versions` map in the policy document.
        c. Update the `currentVersionHash` field to the new hash.
        d. This action should have a confirmation dialog (e.g., "Are you sure you want to publish this version? All users will be required to re-accept.") to prevent accidental updates.

---

---

## Detailed Implementation Plan

### 📋 Current Architecture Integration

**Existing Infrastructure (✅ Already Available):**
- User role system: `UserRoles.ADMIN`, `UserRoles.USER` in `firebase/functions/src/shared/shared-types.ts:9-12`
- Firestore security: `isAdmin()` helper in `firebase/firestore.rules:33-36`  
- Policy types: Complete type definitions in `firebase/functions/src/shared/shared-types.ts:154-191`
- Policy collection: `FirestoreCollections.POLICIES` constant ready to use
- User registration: Already captures `acceptedPolicies` field in `firebase/functions/src/auth/handlers.ts:33`
- Policy helper: `getCurrentPolicyVersions()` in `firebase/functions/src/auth/policy-helpers.ts`
- Frontend hook: `usePolicy()` in `webapp-v2/src/hooks/usePolicy.ts`

**What We Need to Build:** Admin interface, policy acceptance flow, and content management system.

---

## Implementation Plan

### Phase 0: Document Migration (Prerequisites)

#### 0.1 Document Discovery and Conversion
**Files to Examine:**
- `docs/policies/terms-and-conditions.md` - Current terms document
- `docs/policies/cookie-policy.md` - Current cookie policy  
- `docs/policies/privacy-policy.md` - Current privacy policy

**Actions:**
```bash
# 1. Validate current policy documents exist and are well-formatted
cd docs/policies && ls -la *.md

# 2. Convert to consistent Markdown structure
# Ensure headers, links, and formatting work for web display
```

#### 0.2 Migration Script Implementation
**Create:** `firebase/functions/src/scripts/migrate-policies.ts`
```typescript
interface MigrationScript {
  // Read policy files from docs/policies/
  // Calculate SHA-256 hashes 
  // Create initial Firestore documents
  // Migrate user acceptance fields
}
```

**Actions:**
1. Create policy seeding script (build on existing `firebase/functions/src/scripts/seed-policies.ts`)
2. Add user data migration for `acceptedPolicies` field
3. Create rollback capability for safe migration

#### 0.3 User Data Migration Strategy
**Modify:** `firebase/functions/src/scripts/migrate-policies.ts`
```typescript
// Batch process existing users
// Set acceptedPolicies[policyId] = initialVersionHash
// Preserve termsAcceptedAt/cookiePolicyAcceptedAt for audit trail
```

**Validation:**
- Test with Firebase emulator first
- Verify no users lose access after migration
- Ensure all existing users have proper policy acceptance records

### Phase 1: Backend Security Infrastructure

#### 1.1 Admin Middleware Enhancement
**Extend:** `firebase/functions/src/auth/middleware.ts` 
```typescript
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  // Build on existing auth middleware
  // Add role checking against UserRoles.ADMIN
  // Add rate limiting and audit logging
}
```

**Status:** ✅ Admin role system already exists in `firebase/functions/src/shared/shared-types.ts:9-12`
**Status:** ✅ `isAdmin()` helper ready in `firebase/firestore.rules:33-36`

#### 1.2 Protected Policy Management API
**Create:** `firebase/functions/src/policies/admin-handlers.ts`
```typescript
// GET /admin/policies - List all policies with metadata
export const listPolicies = async (req: Request, res: Response)

// GET /admin/policies/:id - Get policy details and version history
export const getPolicyDetails = async (req: Request, res: Response)

// GET /admin/policies/:id/versions/:hash - Get specific version
export const getPolicyVersion = async (req: Request, res: Response)

// PUT /admin/policies/:id - Create new draft version (unpublished)
export const createPolicyDraft = async (req: Request, res: Response)

// POST /admin/policies/:id/publish - Publish draft as current
export const publishPolicy = async (req: Request, res: Response)

// DELETE /admin/policies/:id/versions/:hash - Remove old version
export const deleteOldVersion = async (req: Request, res: Response)
```

**Update:** `firebase/functions/src/index.ts`
```typescript
// Add admin routes with requireAdmin middleware
app.use('/admin/policies', requireAdmin);
app.get('/admin/policies', listPolicies);
app.get('/admin/policies/:id', getPolicyDetails);
// ... other admin routes
```

#### 1.3 Security Rules Enhancement  
**Status:** ✅ Policy security rules already implemented in `firebase/firestore.rules:113-120`

**Additional Rules Needed:**
```javascript
// Add audit logging collection
match /policy_audit_logs/{logId} {
  allow write: if isAdmin(); // Admin actions only
  allow read: if false; // Server-side processing only
}
```

### Phase 2: Frontend Admin Interface

#### 2.1 Admin Route Protection
**Create:** `webapp-v2/src/components/admin/AdminRoute.tsx`
```typescript
// Build on existing auth patterns
// Check user.role === UserRoles.ADMIN
// Redirect to access denied page if not admin
```

**Update:** `webapp-v2/src/App.tsx` - Add admin routes:
```typescript
import { AdminRoute } from './components/admin/AdminRoute';

// Add admin routes
<Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
<Route path="/admin/policies" element={<AdminRoute><PolicyDashboard /></AdminRoute>} />
<Route path="/admin/policies/:id" element={<AdminRoute><PolicyEditor /></AdminRoute>} />
```

**Update:** `webapp-v2/src/constants/routes.ts`
```typescript
export const ROUTES = {
  // ... existing routes
  ADMIN: '/admin',
  ADMIN_POLICIES: '/admin/policies',
  ADMIN_POLICY_EDITOR: '/admin/policies/:id',
} as const;
```

#### 2.2 Policy Management Dashboard
**Create:** `webapp-v2/src/pages/admin/PolicyDashboard.tsx`
```typescript
// List all policies from /admin/policies API
// Show currentVersionHash, last modified, publish status
// Add search/filter functionality
```

**Create:** `webapp-v2/src/components/admin/PolicyCard.tsx`
```typescript
interface PolicyCardProps {
  policy: PolicyDocument;
  onEdit: (id: string) => void;
  onViewHistory: (id: string) => void;
}
```

#### 2.3 Policy Editor Interface
**Create:** `webapp-v2/src/pages/admin/PolicyEditor.tsx`
```typescript
// Markdown editor with preview
// Version dropdown to compare historical versions
// Draft/Publish workflow with confirmation dialogs
```

**Create:** `webapp-v2/src/components/admin/MarkdownEditor.tsx`
```typescript
// Rich text editor supporting Markdown
// Live preview pane 
// Syntax highlighting for policy content
```

**Create:** `webapp-v2/src/components/admin/VersionComparison.tsx`
```typescript
// Side-by-side diff view
// Highlight changes between versions
// Version metadata display
```

#### 2.4 Admin Navigation Integration
**Update:** `webapp-v2/src/components/layout/Header.tsx`
```typescript
// Add admin menu item for admin users
// Check user.role in useAuth hook
// Add admin icon/badge in navigation
```

### Phase 3: User-Facing Integration

#### 3.1 Policy Acceptance Flow Enhancement
**Status:** ✅ Policy hooks already exist in `webapp-v2/src/hooks/usePolicy.ts`

**Create:** `webapp-v2/src/hooks/usePolicyAcceptance.ts`
```typescript
export function usePolicyAcceptance() {
  // Compare user.acceptedPolicies vs currentVersionHash
  // Return { needsAcceptance: boolean, pendingPolicies: Policy[] }
  // Handle acceptance API calls
}
```

**Create:** `webapp-v2/src/components/policy/PolicyAcceptanceModal.tsx`
```typescript
interface PolicyAcceptanceModalProps {
  policies: Policy[];
  onAccept: (policyId: string) => Promise<void>;
  onAcceptAll: () => Promise<void>;
}
// Full-screen blocking modal
// Render Markdown policy content
// Checkbox + "I Accept" button workflow
```

**Update:** `webapp-v2/src/App.tsx`
```typescript
// Add policy acceptance check on app load
// Show PolicyAcceptanceModal when needed
// Block navigation until acceptance complete
```

#### 3.2 Enhanced Policy Viewing
**Enhance:** `webapp-v2/src/pages/static/TermsOfServicePage.tsx`
```typescript
// Use usePolicy hook to show current version
// Add "What's Changed" section for updates
// Display version info and last updated date
```

**Enhance:** `webapp-v2/src/pages/static/CookiePolicyPage.tsx` 
```typescript
// Same enhancements as Terms page
// Show current cookie policy version
```

**Create:** `webapp-v2/src/components/policy/PolicyRenderer.tsx`
```typescript
// Unified component for rendering policy content
// Handle Markdown to HTML conversion
// Consistent styling across all policy views
```

#### 3.3 User Acceptance History
**Create:** `webapp-v2/src/components/policy/AcceptanceHistory.tsx`
```typescript
// Show user's policy acceptance history
// Display accepted versions and dates
// Allow viewing previously accepted versions
```

**Update:** `webapp-v2/src/pages/DashboardPage.tsx`
```typescript
// Add link to view policy acceptance history
// Show indicator if policies need re-acceptance
```

### Phase 4: Advanced Features (Future)

#### 4.1 Enhanced Admin Features
- **Audit Logging**: Track all admin actions with timestamps and IP addresses
- **Admin Activity Monitoring**: Dashboard showing recent policy changes
- **Bulk Operations**: Manage multiple policies simultaneously
- **Scheduling**: Schedule policy changes for future publication

#### 4.2 User Experience Enhancements  
- **Email Notifications**: Notify users of policy changes via email
- **Change Highlights**: Show what changed between versions
- **Acceptance History**: User dashboard showing their acceptance timeline
- **Granular Consent**: Optional features requiring separate opt-in

#### 4.3 Compliance Features
- **Export Capabilities**: Generate compliance reports
- **Retention Policies**: Automatic cleanup of old versions
- **Geographic Compliance**: Different policies for different regions
- **Integration APIs**: Connect with legal management systems

## Security Considerations

### Authentication & Authorization
- **Multi-Factor Authentication**: Required for admin accounts
- **Session Management**: Short timeouts for admin sessions
- **IP Whitelisting**: Optional restriction of admin access by IP
- **Audit Trail**: Complete logging of all policy changes

### Data Protection
- **Input Validation**: Strict validation of all policy content
- **XSS Prevention**: Sanitize all user-generated content
- **CSRF Protection**: Secure all admin forms with CSRF tokens
- **Rate Limiting**: Prevent abuse of admin endpoints

### Operational Security
- **Backup Strategy**: Regular backups of policy data
- **Disaster Recovery**: Plan for policy system outages
- **Change Management**: Approval workflow for critical policy changes
- **Monitoring**: Real-time alerting for admin activities

---

## Testing Strategy

### Phase 0 Testing (Migration)
```bash
# Test migration script with Firebase emulator
cd firebase/functions && npm run test -- --grep "migration"

# Validate policy documents structure
cd docs/policies && npm run validate-policies

# Test user data migration rollback
npm run test:migration:rollback
```

### Phase 1 Testing (Backend)
```bash
# Test admin middleware and API endpoints
npm run test -- src/policies/admin-handlers.test.ts

# Test security rules with admin/user scenarios
npm run test:security -- --grep "policies"

# Integration test for policy management workflow
npm run test:integration -- --grep "admin-policies"
```

### Phase 2 Testing (Admin Interface)
```bash
# Test admin components with role-based access
cd webapp-v2 && npm test -- admin/

# E2E test for policy editing workflow
npm run e2e -- tests/admin-policy-management.e2e.test.ts

# Test admin navigation and route protection
npm test -- components/admin/AdminRoute.test.tsx
```

### Phase 3 Testing (User Flow)
```bash
# Test policy acceptance modal and workflow
npm test -- components/policy/PolicyAcceptanceModal.test.tsx

# E2E test for user policy acceptance flow
npm run e2e -- tests/policy-acceptance.e2e.test.ts

# Test policy viewing and history components
npm test -- pages/static/TermsOfServicePage.test.tsx
```

---

## Performance Considerations

### Caching Strategy
```typescript
// Frontend: Cache policy data in localStorage
const POLICY_CACHE_KEY = 'splitify-policies-cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Backend: Cache current policy versions in memory
const policyVersionCache = new Map<string, string>();
```

### Batch Operations
```typescript
// Batch user acceptance updates
const batchUpdateUserPolicies = async (userUpdates: UserPolicyUpdate[]) => {
  const batch = admin.firestore().batch();
  // Update multiple users' acceptedPolicies in single transaction
};
```

### Offline Handling
```typescript
// Service worker cache for policy content
// Graceful degradation when policy API unavailable
// Queue acceptance updates for when connection restored
```

---

## Security Implementation Details

### Admin Authentication Flow
```typescript
// Multi-layered admin verification
1. Firebase Auth token validation
2. User role check in Firestore
3. Admin middleware with rate limiting
4. Audit logging for all admin actions
```

### Content Security Policy
```typescript
// CSP headers for admin interface
'Content-Security-Policy': `
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
`
```

### Input Validation & Sanitization
```typescript
// Validate policy content before storage
const validatePolicyContent = (content: string): ValidationResult => {
  // Check length limits, allowed HTML tags, XSS prevention
  // Validate markdown syntax and structure
};
```

---

## Deployment & Operations

### Deployment Checklist
```bash
# 1. Deploy backend changes first
cd firebase/functions && npm run deploy

# 2. Update Firestore security rules
firebase deploy --only firestore:rules

# 3. Run data migration (if needed)
npm run migrate:policies

# 4. Deploy frontend changes
cd webapp-v2 && npm run build && npm run deploy

# 5. Verify policy system functionality
npm run test:smoke:policies
```

### Monitoring & Alerts
```typescript
// Monitor policy acceptance rates
// Alert on admin policy changes
// Track user acceptance completion times
// Monitor API error rates for policy endpoints
```

### Rollback Strategy
```typescript
// Database snapshots before major changes
// Feature flags for policy system components
// Quick rollback scripts for policy versions
// Automated health checks post-deployment
```

---

## Success Metrics

### Technical Metrics
- Policy update deployment time < 5 minutes
- Zero downtime during policy updates
- 100% audit trail coverage for admin actions
- < 1% false positive re-acceptance prompts

### Business Metrics  
- Legal compliance audit passing rate
- User completion rate for policy acceptance
- Time to deploy policy changes
- Admin user satisfaction with interface

### User Experience Metrics
- Policy acceptance completion rate > 95%
- Average time to complete acceptance < 2 minutes
- User complaints about unnecessary re-prompts < 1%
- Support tickets related to policy acceptance < 5/month
