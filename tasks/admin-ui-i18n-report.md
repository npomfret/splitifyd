# Admin UI Internationalization Report

## Objective

This report details the findings of a deep dive into the Admin UI codebase to identify hardcoded text strings that require internationalization (i18n). The goal is to prepare for pulling these strings into a translation management system like `react-i18next`.

No code has been changed as part of this investigation.

## Summary of Findings

The Admin UI contains a significant number of hardcoded user-facing strings across its pages and components. The most significant files are the various tab components (`Admin...Tab.tsx`) and the modals (`...EditorModal.tsx`), which are rich with labels, titles, descriptions, buttons, and validation messages that are currently not translated.

While some top-level components use the `useTranslation` hook, its usage is not consistent, and the vast majority of strings are hardcoded.

## Files Analyzed

-   `webapp-v2/src/pages/AdminPage.tsx`
-   `webapp-v2/src/components/admin/AdminDiagnosticsTab.tsx`
-   `webapp-v2/src/components/admin/AdminTenantConfigTab.tsx`
-   `webapp-v2/src/components/admin/AdminTenantsTab.tsx`
-   `webapp-v2/src/components/admin/AdminUsersTab.tsx`
-   `webapp-v2/src/components/admin/TenantEditorModal.tsx`
-   `webapp-v2/src/components/admin/UserEditorModal.tsx`

---

## Detailed String Analysis

### 1. `webapp-v2/src/pages/AdminPage.tsx`

| Line | Hardcoded String | Suggested Key |
| :--- | :--- | :--- |
| 62 | `Loading admin...` | `admin.loading` |
| 70 | `Tenants` | `admin.tabs.tenants` |
| 75 | `Diagnostics` | `admin.tabs.diagnostics` |
| 80 | `Tenant Config` | `admin.tabs.tenantConfig` |
| 86 | `Users` | `admin.tabs.users` |
| 102 | `Admin tabs` | `admin.tabs.ariaLabel` |

### 2. `webapp-v2/src/components/admin/AdminDiagnosticsTab.tsx`

This component is for developers and administrators, but for consistency, its strings should also be internationalized.

| Line | Hardcoded String | Suggested Key |
| :--- | :--- | :--- |
| 18 | `Failed to fetch environment data` | `admin.diagnostics.errors.fetch` |
| 19 | `Unknown error occurred` | `errors.unknown` |
| 27 | `Loading environment diagnostics...`| `admin.diagnostics.loading` |
| 35 | `Server Status` | `admin.diagnostics.serverStatus.title` |
| 39 | `Environment` | `admin.diagnostics.serverStatus.environment` |
| 43 | `Node Version` | `admin.diagnostics.serverStatus.nodeVersion` |
| 47 | `Uptime` | `admin.diagnostics.serverStatus.uptime` |
| 51 | `Started At` | `admin.diagnostics.serverStatus.startedAt` |
| 59 | `Build Information` | `admin.diagnostics.buildInfo.title` |
| 63 | `Version` | `admin.diagnostics.buildInfo.version` |
| 67 | `Build Date` | `admin.diagnostics.buildInfo.buildDate` |
| 71 | `Build Timestamp` | `admin.diagnostics.buildInfo.buildTimestamp`|
| 79 | `Memory Usage` | `admin.diagnostics.memory.title` |
| 83 | `RSS (Resident Set Size)` | `admin.diagnostics.memory.rss` |
| 88 | `Heap Used` | `admin.diagnostics.memory.heapUsed` |
| 93 | `Heap Total` | `admin.diagnostics.memory.heapTotal` |
| 98 | `Heap Available` | `admin.diagnostics.memory.heapAvailable` |
| 104| `External Memory` | `admin.diagnostics.memory.external` |
| 108| `Array Buffers` | `admin.diagnostics.memory.arrayBuffers` |
| 112| `Heap Limit` | `admin.diagnostics.memory.heapLimit` |
| 120| `V8 Heap Spaces` | `admin.diagnostics.heap.title` |
| 125| `Size:` | `admin.diagnostics.heap.size` |
| 129| `Used:` | `admin.diagnostics.heap.used` |
| 133| `Available:` | `admin.diagnostics.heap.available` |
| 144| `Environment Variables` | `admin.diagnostics.envVars.title` |
| 149| `Variable` | `admin.diagnostics.envVars.variable` |
| 150| `Value` | `admin.diagnostics.envVars.value` |
| 155| `(empty)` | `common.empty` |
| 164| `Filesystem` | `admin.diagnostics.filesystem.title` |
| 168| `Working Directory` | `admin.diagnostics.filesystem.cwd` |
| 174| `Name` | `common.name` |
| 175| `Type` | `common.type` |
| 176| `Size` | `common.size` |
| 177| `Modified` | `common.modified` |

### 3. `webapp-v2/src/components/admin/AdminTenantConfigTab.tsx`

| Line | Hardcoded String | Suggested Key |
| :--- | :--- | :--- |
| 30 | `Loading tenant configuration...` | `admin.tenantConfig.loading` |
| 46 | `Theme link copied to clipboard.` | `admin.tenantConfig.theme.copySuccess` |
| 49 | `Unable to copy theme link. Please copy manually.` | `admin.tenantConfig.theme.copyError` |
| 67 | `Tenant Overview` | `admin.tenantConfig.overview.title` |
| 71 | `Tenant ID` | `admin.tenantConfig.overview.tenantId` |
| 72 | `unknown` | `common.unknown` |
| 75 | `App Name` | `admin.tenantConfig.overview.appName` |
| 76 | `Not configured` | `common.notConfigured` |
| 79 | `Last Updated` | `admin.tenantConfig.overview.lastUpdated` |
| 87 | `Theme Artifact` | `admin.tenantConfig.theme.title` |
| 91 | `Hash + CSS delivery helpers` | `admin.tenantConfig.theme.description` |
| 98 | `Copy Theme Link` | `admin.tenantConfig.theme.copyLink` |
| 101 | `Force Reload Theme` | `admin.tenantConfig.theme.forceReload` |
| 107 | `Active Hash` | `admin.tenantConfig.theme.activeHash` |
| 108 | `not published` | `admin.tenantConfig.theme.notPublished` |
| 111 | `Generated At` | `admin.tenantConfig.theme.generatedAt` |
| 115 | `Link` | `common.link` |
| 124 | `Branding Tokens` | `admin.tenantConfig.brandingTokens.title`|
| 132 | `Computed CSS Variables` | `admin.tenantConfig.computedCss.title`|
| 138 | `not set` | `common.notSet` |

### 4. `webapp-v2/src/components/admin/AdminTenantsTab.tsx`

| Line | Hardcoded String | Suggested Key |
| :--- | :--- | :--- |
| 32 | `Failed to load tenants` | `admin.tenants.errors.load` |
| 59 | `Total tenants:` | `admin.tenants.summary.total` |
| 63 | `Create New Tenant` | `admin.tenants.actions.create` |
| 66 | `Refresh` | `common.refresh` |
| 88 | `Active` | `admin.tenants.status.active` |
| 93 | `Default` | `admin.tenants.status.default` |
| 100| `Tenant ID:` | `admin.tenants.details.tenantId` |
| 105| `Domains:` | `admin.tenants.details.domains` |
| 112| `Click to switch to this tenant` | `admin.tenants.actions.switchTenant` |
| 121| `Created:` | `common.created` |
| 124| `Updated:` | `common.updated` |
| 134| `Edit` | `common.edit` |
| 149| `No tenants found` | `admin.tenants.emptyState` |

### 5. `webapp-v2/src/components/admin/AdminUsersTab.tsx`

This component has many hardcoded strings, especially for dynamic confirmation messages.

| Line | Hardcoded String | Suggested Key |
| :--- | :--- | :--- |
| 152 | `You cannot disable your own account` | `admin.users.errors.selfDisable` |
| 157 | `enable` / `disable` | `common.enable` / `common.disable` |
| 158 | `Are you sure you want to {action} this user account?` | `admin.users.confirmations.disableUser`|
| 166 | `User account {action}d successfully` | `admin.users.success.userDisabled` |
| 171 | `Failed to {action} user account` | `admin.users.errors.disableUser` |
| 178 | `You cannot change your own role`| `admin.users.errors.selfRoleChange` |
| 183 | `Regular User (no role)` | `roles.regular.withNoRole` |
| 184 | `Tenant Admin` | `roles.tenantAdmin.label` |
| 185 | `System Admin` | `roles.systemAdmin.label` |
| 194 | `Current role: ... Select new role: ...` | `admin.users.confirmations.changeRole` |
| 200 | `Invalid selection` | `errors.invalidSelection` |
| 205 | `Role unchanged` | `admin.users.success.roleUnchanged`|
| 211 | `User role updated to {roleLabel}`| `admin.users.success.roleUpdated` |
| 216 | `Failed to update user role` | `admin.users.errors.roleUpdate` |
| 229 | `System Admin` | `roles.systemAdmin.label` |
| 230 | `Tenant Admin` | `roles.tenantAdmin.label` |
| 231 | `Regular User` | `roles.regular.label` |
| 249 | `Manage user accounts, roles, and permissions` | `admin.users.description` |
| 252 | `Refresh` | `common.refresh` |
| 258 | `Search by email or UID` | `admin.users.search.label` |
| 262 | `Enter email or UID...` | `admin.users.search.placeholder` |
| 266 | `Search` | `common.search` |
| 267 | `Reset` | `common.reset` |
| 272 | `Loading users...` | `admin.users.loading` |
| 276 | `No users found` | `admin.users.emptyState` |
| 282-288 | Table Headers (`Email`, `Display Name`, `Role`, `Status`, `Created`, `Last Sign In`, `Actions`) | `admin.users.table.header.*` |
| 300 | `You` | `common.you` |
| 315 | `Disabled` | `common.disabled` |
| 315 | `Active` | `common.active` |
| 330 | `Edit user` | `admin.users.actions.edit` |
| 343 | `Processing...` | `common.processing` |
| 345, 347 | `Enable` / `Disable` | `common.enable` / `common.disable` |

### 6. `webapp-v2/src/components/admin/TenantEditorModal.tsx`

This modal is extremely large and contains hundreds of hardcoded labels and descriptions. A full listing is impractical. The strategy should be to create nested i18n keys for each section.

**Summary of Hardcoded Strings:**

- **Validation Errors**: A huge number of `... is required` messages. These should use a single key, e.g., `errors.validation.requiredField`.
- **User-facing Messages**: Success and error messages for saving, publishing, and uploading.
- **Section Titles & Descriptions**: e.g., "Getting Started", "Choose how to initialize your tenant".
- **Field Labels & Placeholders**: Every input field has a hardcoded label (e.g., `Tenant ID`, `Primary *`) and often a placeholder.
- **Button Texts**: `Cancel`, `Save Changes`, `Create Tenant`, `Publish Theme`, `Add`.

**Example Key Structure:**

```json
{
  "admin": {
    "tenantEditor": {
      "titleCreate": "Create New Tenant",
      "titleEdit": "Edit Tenant",
      "descriptionCreate": "Configure a new tenant with branding and domains",
      "descriptionEdit": "Update tenant configuration",
      "gettingStarted": {
        "title": "Getting Started",
        "description": "Choose how to initialize your tenant",
        "fromEmpty": "Start from empty",
        "fromCopy": "Copy from existing tenant"
      },
      "basicInfo": {
        "title": "Basic Info",
        "description": "Tenant ID, name, and domains",
        "tenantId": "Tenant ID",
        "appName": "App Name",
        "domains": "Domains"
      },
      "palette": {
          "title": "Palette Colors",
          "description": "Core color palette ({count} required)",
          "primary": "Primary *",
          "...": "..."
      },
      "footer": {
        "cancel": "Cancel",
        "publish": "Publish Theme",
        "publishing": "Publishing...",
        "save": "Save Changes",
        "saving": "Saving...",
        "create": "Create Tenant"
      }
    }
  }
}
```

### 7. `webapp-v2/src/components/admin/UserEditorModal.tsx`

| Line | Hardcoded String | Suggested Key |
| :--- | :--- | :--- |
| 50 | `No changes to save` | `admin.userEditor.errors.noChanges` |
| 56 | `Profile updated successfully` | `admin.userEditor.success.profileUpdated` |
| 60 | `Failed to update profile` | `admin.userEditor.errors.profileUpdate` |
| 66 | `Cannot change your own role` | `admin.userEditor.errors.selfRoleChange` |
| 74 | `Role updated successfully` | `admin.userEditor.success.roleUpdated` |
| 78 | `Failed to update role` | `admin.userEditor.errors.roleUpdate` |
| 89 | `Failed to load data` | `admin.userEditor.errors.loadData` |
| 110-112 | Role names and descriptions | `roles.regular.label`, `roles.regular.description`, etc. |
| 119 | `Edit User` | `admin.userEditor.title` |
| 125 | `User editor tabs` | `admin.userEditor.tabs.ariaLabel` |
| 133, 142, 151, 160 | `Profile`, `Role`, `Firebase Auth`, `Firestore` | `admin.userEditor.tabs.*` |
| 172 | `Edit the user's display name and email address` | `admin.userEditor.profile.description`|
| 176 | `Display Name` | `admin.userEditor.profile.displayName` |
| 182 | `Enter display name` | `admin.userEditor.profile.displayNamePlaceholder` |
| 187 | `Email Address` | `admin.userEditor.profile.email` |
| 194 | `Enter email address` | `admin.userEditor.profile.emailPlaceholder`|
| 201 | `Select a role for this user` | `admin.userEditor.role.description` |
| 203 | `You cannot change your own role` | `admin.userEditor.errors.selfRoleChangeWarning` |
| 232, 245 | `Loading...` | `common.loading` |
| 238, 251 | `No data available` | `common.noData` |
| 259 | `Cancel` / `Close` | `common.cancel` / `common.close` |
| 268, 280 | `Saving...` / `Save` | `common.saving` / `common.save` |

## Recommendations

1.  **Adopt a structured key naming convention**, such as `feature.component.element.state` (e.g., `admin.users.table.header.email`).
2.  **Tackle `TenantEditorModal.tsx` systematically**, section by section, due to its size. Create a nested JSON structure for its translations that mirrors the collapsible sections in the UI.
3.  **Create a shared `common.json` namespace** for frequently used strings like "Save", "Cancel", "Loading...", "Error", "Success", "Edit", "Refresh".
4.  For dynamic messages (e.g., "Are you sure you want to **enable** this user?"), use i18next's interpolation features.
5.  All new Admin UI development must enforce the use of the `useTranslation` hook and i18n keys from the start.

This report provides the necessary information to begin the internationalization process for the Admin UI.
