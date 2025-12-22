/**
 * Dynamic Translation Functions
 *
 * This file contains switch-based translation functions for keys that would otherwise
 * be constructed dynamically at runtime. By using explicit switch statements with
 * literal translation keys, we enable static analysis to detect unused translations.
 *
 * IMPORTANT: When adding new translation keys to any of these categories, you MUST
 * add a corresponding case to the appropriate function here.
 *
 * see: translation-keys.test.ts
 */
import type { TFunction } from 'i18next';

// =============================================================================
// Admin Tabs
// =============================================================================

export function translateAdminTab(tabKey: string, t: TFunction): string {
    switch (tabKey) {
        case 'tenants':
            return t('admin.tabs.tenants');
        case 'diagnostics':
            return t('admin.tabs.diagnostics');
        case 'tenantConfig':
            return t('admin.tabs.tenantConfig');
        case 'users':
            return t('admin.tabs.users');
        case 'ariaLabel':
            return t('admin.tabs.ariaLabel');
        default:
            return tabKey;
    }
}

// =============================================================================
// Theme Mode
// =============================================================================

export function translateThemeMode(mode: string, t: TFunction): string {
    switch (mode) {
        case 'label':
            return t('admin.tenantEditor.derivation.themeMode.label');
        case 'light':
            return t('admin.tenantEditor.derivation.themeMode.light');
        case 'medium':
            return t('admin.tenantEditor.derivation.themeMode.medium');
        case 'dark':
            return t('admin.tenantEditor.derivation.themeMode.dark');
        default:
            return mode;
    }
}

// =============================================================================
// Dashboard Group Card
// =============================================================================

export function translateGroupCardKey(
    key: string,
    t: TFunction,
    options?: Record<string, unknown>,
): string {
    switch (key) {
        case 'settledUp':
            return t('dashboard.groupCard.settledUp', options);
        case 'youOwe':
            return t('dashboard.groupCard.youOwe', options);
        case 'youAreOwed':
            return t('dashboard.groupCard.youAreOwed', options);
        case 'addExpenseTooltip':
            return t('dashboard.groupCard.addExpenseTooltip', options);
        case 'inviteTooltip':
            return t('dashboard.groupCard.inviteTooltip', options);
        case 'noRecentActivity':
            return t('dashboard.groupCard.noRecentActivity', options);
        case 'archivedBadge':
            return t('dashboard.groupCard.archivedBadge', options);
        default:
            return key;
    }
}

// =============================================================================
// Group Settings Modal Tabs
// =============================================================================

export function translateGroupSettingsTab(tabKey: string, t: TFunction): string {
    switch (tabKey) {
        case 'identity':
            return t('groupSettingsModal.tabs.identity');
        case 'general':
            return t('groupSettingsModal.tabs.general');
        case 'security':
            return t('groupSettingsModal.tabs.security');
        default:
            return tabKey;
    }
}

// =============================================================================
// Security Settings Modal - Permissions
// =============================================================================

type PermissionField = 'label' | 'description';

export function translatePermission(
    permission: string,
    field: PermissionField,
    t: TFunction,
): string {
    switch (permission) {
        case 'expenseEditing':
            return field === 'label'
                ? t('securitySettingsModal.permissions.expenseEditing.label')
                : t('securitySettingsModal.permissions.expenseEditing.description');
        case 'expenseDeletion':
            return field === 'label'
                ? t('securitySettingsModal.permissions.expenseDeletion.label')
                : t('securitySettingsModal.permissions.expenseDeletion.description');
        case 'memberInvitation':
            return field === 'label'
                ? t('securitySettingsModal.permissions.memberInvitation.label')
                : t('securitySettingsModal.permissions.memberInvitation.description');
        case 'memberApproval':
            return field === 'label'
                ? t('securitySettingsModal.permissions.memberApproval.label')
                : t('securitySettingsModal.permissions.memberApproval.description');
        case 'settingsManagement':
            return field === 'label'
                ? t('securitySettingsModal.permissions.settingsManagement.label')
                : t('securitySettingsModal.permissions.settingsManagement.description');
        default:
            return permission;
    }
}

export function translatePermissionOption(option: string, t: TFunction): string {
    switch (option) {
        case 'anyone':
            return t('securitySettingsModal.permissions.options.anyone');
        case 'creator-and-admin':
            return t('securitySettingsModal.permissions.options.creator-and-admin');
        case 'admin-only':
            return t('securitySettingsModal.permissions.options.admin-only');
        case 'automatic':
            return t('securitySettingsModal.permissions.options.automatic');
        case 'admin-required':
            return t('securitySettingsModal.permissions.options.admin-required');
        default:
            return option;
    }
}

// =============================================================================
// Security Settings Modal - Member Roles
// =============================================================================

export function translateMemberRole(role: string, t: TFunction): string {
    switch (role) {
        case 'heading':
            return t('securitySettingsModal.memberRoles.heading');
        case 'admin':
            return t('securitySettingsModal.memberRoles.admin');
        case 'member':
            return t('securitySettingsModal.memberRoles.member');
        case 'viewer':
            return t('securitySettingsModal.memberRoles.viewer');
        default:
            return role;
    }
}

// =============================================================================
// Security Settings Modal - Presets
// =============================================================================

type PresetField = 'label' | 'description';

export function translatePreset(preset: string, field: PresetField, t: TFunction): string {
    switch (preset) {
        case 'open':
            return field === 'label'
                ? t('securitySettingsModal.presets.open.label')
                : t('securitySettingsModal.presets.open.description');
        case 'managed':
            return field === 'label'
                ? t('securitySettingsModal.presets.managed.label')
                : t('securitySettingsModal.presets.managed.description');
        default:
            return preset;
    }
}

export function translatePresetActiveBadge(t: TFunction): string {
    return t('securitySettingsModal.presets.activeBadge');
}

// =============================================================================
// Settings Page - Profile Summary Role
// =============================================================================

export function translateProfileRole(role: string, t: TFunction): string {
    switch (role) {
        case 'system_admin':
            return t('settingsPage.profileSummaryRole.system_admin');
        case 'system_user':
            return t('settingsPage.profileSummaryRole.system_user');
        default:
            return role;
    }
}

// =============================================================================
// Server-Side Translation Keys
// =============================================================================
//
// These keys are used server-side (in firebase/functions/src) for features like
// Open Graph tags. They are NOT used via the t() function, but are valid keys
// that should not be flagged as redundant by the translation-keys test.
//
// The keys are listed as string literals so the test can detect them.

const SERVER_SIDE_TRANSLATION_KEYS = [
    'sharing.ogDescription', // Used in SharingHandlers.ts for OG meta description
    'sharing.joinTitle', // Used in SharingHandlers.ts for OG meta title
] as const;
