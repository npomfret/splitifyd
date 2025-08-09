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

## Implementation Plan

### Phase 0: Document Migration (Prerequisites)

Before implementing the versioned acceptance system, existing legal documents must be migrated into the new structure.

#### Migration Tasks:
1. **Document Discovery and Conversion**
   - Locate current Terms of Service and Cookie Policy documents
   - Convert to Markdown format for consistent editing and storage
   - Clean up formatting and ensure proper structure for web display

2. **Firebase Integration**
   - Create initial documents in `policies` collection with proper schema
   - Calculate SHA-256 hashes for existing content to establish baseline versions
   - Set up proper versioning structure with current documents as version 1

3. **User Data Migration** 
   - Ensure all existing users have `acceptedPolicies` field in their user documents
   - Migrate existing `termsAcceptedAt` and `cookiePolicyAcceptedAt` timestamps to new hash-based system
   - Set initial accepted hashes to match current document versions (prevents unnecessary re-prompting)

### Phase 1: Backend Security Infrastructure

#### 1.1 Admin Access Control System
- **Create `requireAdmin` middleware** for Firebase Functions
  - Implement role-based access control checking user `role` field
  - Add comprehensive error handling and logging
  - Rate limiting for admin operations

- **User Role Management**
  - Add `role: 'admin' | 'user'` field to user documents (default: 'user')
  - Create admin role assignment system for super-admins
  - Implement role validation in authentication flow

#### 1.2 Protected Policy Management Endpoints
Create secure API endpoints for policy operations:
- `GET /admin/policies` - List all policies with metadata
- `GET /admin/policies/:id` - Get policy details and version history  
- `GET /admin/policies/:id/versions/:hash` - Get specific version content
- `PUT /admin/policies/:id` - Create new draft version (not published)
- `POST /admin/policies/:id/publish` - Publish draft as current version
- `DELETE /admin/policies/:id/versions/:hash` - Remove old version (with safeguards)

#### 1.3 Firestore Security Rules
Update security rules to protect policies collection:
```javascript
// Only admins can read/write policies
match /policies/{policyId} {
  allow read, write: if request.auth != null && 
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}
```

### Phase 2: Frontend Admin Interface

#### 2.1 Admin Route Protection
- **Route Guards**: Create admin-only route protection
- **Navigation**: Add admin section to main navigation (admin users only)
- **Access Control**: Show "Access Denied" page for unauthorized users

#### 2.2 Policy Management Dashboard (`/admin/policies`)
- **Policy List View**: Display all policies with current version info
- **Quick Actions**: Edit, view history, publish status for each policy
- **Creation Workflow**: Add new policy types beyond terms/cookies
- **Search and Filtering**: Find policies by name, status, last modified

#### 2.3 Policy Editor Interface (`/admin/policies/:id`)
- **Rich Text Editor**: Markdown-compatible editor with preview
- **Version Management**: 
  - Dropdown to view/compare historical versions
  - Visual diff between versions
  - Version metadata (created date, author, publish status)
- **Draft System**: Save changes without publishing
- **Publishing Workflow**:
  - Clear separation between "Save Draft" and "Publish"
  - Confirmation dialog with impact warning
  - Preview changes before publishing

### Phase 3: User-Facing Integration

#### 3.1 Policy Acceptance Flow
- **Login/App Load Check**: Compare user's accepted versions with current versions
- **Blocking Modal**: Full-screen modal when re-acceptance required
- **Policy Display**: Render Markdown content with proper styling
- **Acceptance Tracking**: Update user document with new version hashes

#### 3.2 Policy Viewing
- **Terms Page**: Public page showing current terms (no auth required)
- **Privacy Page**: Public page showing current privacy/cookie policy
- **Version History**: Allow users to see what they previously accepted

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
