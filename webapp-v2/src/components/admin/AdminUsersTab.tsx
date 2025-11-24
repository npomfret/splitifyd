import { apiClient } from '@/app/apiClient';
import { useAuth } from '@/app/hooks/useAuth';
import { Alert, Button, Card, Input, LoadingState, Pagination } from '@/components/ui';
import { logError, logInfo } from '@/utils/browser-logger';
import type { AdminUserProfile, Email, SystemUserRole, UserId } from '@billsplit-wl/shared';
import { SystemUserRoles, toEmail, toUserId } from '@billsplit-wl/shared';
import { computed, useSignal, useSignalEffect } from '@preact/signals';
import { useTranslation } from 'react-i18next';
import { UserEditorModal } from './UserEditorModal';

const DEFAULT_LIMIT = 25;

export function AdminUsersTab() {
    const { t } = useTranslation();
    const authStore = useAuth();

    const user = authStore?.user;
    if (!user) {
        return <LoadingState message={t('app.loading')} />;
    }

    // State
    const users = useSignal<AdminUserProfile[]>([]);
    const loading = useSignal(false);
    const error = useSignal<string | null>(null);
    const nextPageToken = useSignal<string | undefined>(undefined);
    const pageHistory = useSignal<Array<string | undefined>>([undefined]);
    const page = useSignal(1);
    const hasMore = useSignal(false);
    const searchValue = useSignal('');
    const hasSearchApplied = useSignal(false);
    const operationInProgress = useSignal<string | null>(null);
    const editingUser = useSignal<AdminUserProfile | null>(null);

    const hasPrevious = computed(() => pageHistory.value.length > 1 && !hasSearchApplied.value);

    // Smart search field detection
    function detectSearchField(value: string): { type: 'email' | 'uid'; value: string; } {
        const trimmed = value.trim();

        // Email detection (contains @)
        if (trimmed.includes('@')) {
            return { type: 'email', value: trimmed };
        }

        // UID detection
        return { type: 'uid', value: trimmed };
    }

    const loadUsers = async (pageToken?: string) => {
        loading.value = true;
        error.value = null;

        try {
            const query: { limit: number; pageToken?: string; email?: Email; uid?: UserId; } = { limit: DEFAULT_LIMIT };

            if (hasSearchApplied.value) {
                const searchVal = searchValue.value.trim();
                if (searchVal) {
                    const detected = detectSearchField(searchVal);
                    if (detected.type === 'email') {
                        query.email = toEmail(detected.value);
                    } else {
                        query.uid = toUserId(detected.value);
                    }
                }
            } else if (pageToken) {
                query.pageToken = pageToken;
            }

            // Fetch auth users with Firestore roles included
            const authResponse = await apiClient.listAuthUsers(query);
            users.value = authResponse.users ?? [];

            nextPageToken.value = authResponse.nextPageToken ?? undefined;
            hasMore.value = Boolean(authResponse.hasMore);

            if (hasSearchApplied.value) {
                hasMore.value = false;
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : t('usersBrowser.errors.auth');
            error.value = message;
        } finally {
            loading.value = false;
        }
    };

    const initialize = async () => {
        pageHistory.value = [undefined];
        page.value = 1;
        hasSearchApplied.value = false;
        await loadUsers();
    };

    useSignalEffect(() => {
        if (!loading.value && users.value.length === 0) {
            void initialize();
        }
    });

    const handleSearch = async (event: Event) => {
        event.preventDefault();
        const value = searchValue.value.trim();
        if (!value) {
            hasSearchApplied.value = false;
            await initialize();
            return;
        }

        hasSearchApplied.value = true;
        pageHistory.value = [undefined];
        page.value = 1;
        await loadUsers();
    };

    const handleReset = async () => {
        searchValue.value = '';
        hasSearchApplied.value = false;
        await initialize();
    };

    const handleNext = async () => {
        if (!hasMore.value || hasSearchApplied.value) return;
        const nextToken = nextPageToken.value;
        if (!nextToken) return;
        pageHistory.value = [...pageHistory.value, nextToken];
        page.value = pageHistory.value.length;
        await loadUsers(nextToken);
    };

    const handlePrevious = async () => {
        if (!hasPrevious.value) return;
        const history = [...pageHistory.value];
        history.pop();
        const previousToken = history[history.length - 1];
        pageHistory.value = history;
        page.value = history.length;
        await loadUsers(previousToken);
    };

    const handleDisableUser = async (uid: UserId, currentlyDisabled: boolean) => {
        // Prevent self-disable
        if (uid === user.uid) {
            window.alert('You cannot disable your own account');
            return;
        }

        // Confirm action
        const action = currentlyDisabled ? 'enable' : 'disable';
        const confirmMessage = `Are you sure you want to ${action} this user account?`;

        if (!window.confirm(confirmMessage)) {
            return;
        }

        operationInProgress.value = `${action}-${uid}`;
        try {
            await apiClient.updateUser(uid, { disabled: !currentlyDisabled });

            logInfo(`User account ${action}d`, { uid, disabled: !currentlyDisabled });
            window.alert(`User account ${action}d successfully`);

            // Reload the user list
            await loadUsers(hasSearchApplied.value ? undefined : pageHistory.value[pageHistory.value.length - 1]);
        } catch (err) {
            logError(`Failed to ${action} user`, err);
            window.alert(`Failed to ${action} user account`);
        } finally {
            operationInProgress.value = null;
        }
    };

    const handleUpdateRole = async (uid: UserId, currentRole: string | null) => {
        // Prevent self-role change
        if (uid === user.uid) {
            window.alert('You cannot change your own role');
            return;
        }

        // Get new role from user
        const roleOptions = [
            { value: '', label: 'Regular User (no role)' },
            { value: SystemUserRoles.TENANT_ADMIN, label: 'Tenant Admin' },
            { value: SystemUserRoles.SYSTEM_ADMIN, label: 'System Admin' },
        ];

        const currentRoleLabel = currentRole === SystemUserRoles.TENANT_ADMIN
            ? 'Tenant Admin'
            : currentRole === SystemUserRoles.SYSTEM_ADMIN
            ? 'System Admin'
            : 'Regular User';

        const message = `Current role: ${currentRoleLabel}\n\nSelect new role:\n${roleOptions.map((opt, i) => `${i + 1}. ${opt.label}`).join('\n')}`;
        const choice = window.prompt(message, '1');

        if (!choice) return;

        const selectedIndex = parseInt(choice, 10) - 1;
        if (selectedIndex < 0 || selectedIndex >= roleOptions.length) {
            window.alert('Invalid selection');
            return;
        }

        const newRole = (roleOptions[selectedIndex].value || null) as SystemUserRole | null;

        if (newRole === currentRole) {
            window.alert('Role unchanged');
            return;
        }

        operationInProgress.value = `role-${uid}`;
        try {
            await apiClient.updateUserRole(uid, { role: newRole });

            logInfo('User role updated', { uid, oldRole: currentRole, newRole });
            window.alert(`User role updated to ${roleOptions[selectedIndex].label}`);

            // Reload the user list
            await loadUsers(hasSearchApplied.value ? undefined : pageHistory.value[pageHistory.value.length - 1]);
        } catch (err) {
            logError('Failed to update user role', err);
            window.alert('Failed to update user role');
        } finally {
            operationInProgress.value = null;
        }
    };

    function getMetadataField(metadata: unknown, key: 'creationTime' | 'lastSignInTime'): string {
        if (metadata && typeof metadata === 'object' && metadata !== null && key in metadata) {
            const raw = (metadata as Record<string, unknown>)[key];
            if (typeof raw === 'string') {
                return new Date(raw).toLocaleString();
            }
        }
        return '';
    }

    function formatRole(role: string | null): string {
        if (role === SystemUserRoles.SYSTEM_ADMIN) return 'System Admin';
        if (role === SystemUserRoles.TENANT_ADMIN) return 'Tenant Admin';
        if (!role) return 'Regular User';
        return role;
    }

    function getRoleBadgeClass(role: string | null, isMismatch: boolean): string {
        if (isMismatch) {
            return 'bg-orange-100 text-orange-700 border border-orange-300';
        }
        if (role === SystemUserRoles.SYSTEM_ADMIN) {
            return 'bg-purple-100 text-purple-700 border border-purple-300';
        }
        if (role === SystemUserRoles.TENANT_ADMIN) {
            return 'bg-blue-100 text-blue-700 border border-blue-300';
        }
        return 'bg-gray-100 text-gray-700 border border-gray-300';
    }

    return (
        <div class='space-y-6'>
            <div class='flex items-center justify-between'>
                <p class='text-sm text-gray-700'>
                    Manage user accounts, roles, and permissions
                </p>
                <Button variant='secondary' size='sm' onClick={handleReset}>
                    Refresh
                </Button>
            </div>

            <Card className='p-6 space-y-6 bg-white/70 border border-indigo-200'>
                <form class='flex gap-4' onSubmit={handleSearch}>
                    <label class='flex flex-col text-sm text-gray-800 flex-1'>
                        <span class='mb-1'>Search by email or UID</span>
                        <Input
                            value={searchValue.value}
                            onChange={(value) => (searchValue.value = value)}
                            placeholder='Enter email or UID...'
                        />
                    </label>
                    <div class='flex gap-2 items-end'>
                        <Button type='submit' variant='primary'>Search</Button>
                        <Button type='button' variant='secondary' onClick={handleReset}>
                            Reset
                        </Button>
                    </div>
                </form>

                {loading.value && (
                    <div class='flex justify-center py-6'>
                        <LoadingState message='Loading users...' />
                    </div>
                )}

                {error.value && <Alert type='error' message={error.value} />}

                {!loading.value && users.value.length === 0 && !error.value && <Alert type='info' message='No users found' />}

                {users.value.length > 0 && (
                    <div class='overflow-x-auto border border-indigo-200 rounded-lg'>
                        <table class='min-w-full divide-y divide-indigo-200'>
                            <thead class='bg-indigo-50'>
                                <tr>
                                    <th scope='col' class='px-4 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider'>
                                        Email
                                    </th>
                                    <th scope='col' class='px-4 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider'>
                                        Display Name
                                    </th>
                                    <th scope='col' class='px-4 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider'>
                                        Role
                                    </th>
                                    <th scope='col' class='px-4 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider'>
                                        Status
                                    </th>
                                    <th scope='col' class='px-4 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider'>
                                        Created
                                    </th>
                                    <th scope='col' class='px-4 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider'>
                                        Last Sign In
                                    </th>
                                    <th scope='col' class='px-4 py-3 text-right text-xs font-medium text-indigo-700 uppercase tracking-wider'>
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody class='bg-white divide-y divide-indigo-200'>
                                {users.value.map((authUser) => {
                                    const metadata = authUser.metadata;
                                    const uid = authUser.uid;
                                    const isCurrentUser = uid === user.uid;
                                    const role = authUser.role ?? null;

                                    return (
                                        <tr key={uid} class={isCurrentUser ? 'bg-blue-50' : ''}>
                                            <td class='px-4 py-3 text-sm text-gray-900 break-all'>
                                                {String(authUser.email ?? '')}
                                                {isCurrentUser && (
                                                    <span class='ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700'>
                                                        You
                                                    </span>
                                                )}
                                            </td>
                                            <td class='px-4 py-3 text-sm text-gray-700 break-all'>
                                                {String(authUser.displayName ?? '-')}
                                            </td>
                                            <td class='px-4 py-3 text-sm'>
                                                <span class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getRoleBadgeClass(role, false)}`}>
                                                    {formatRole(role)}
                                                </span>
                                            </td>
                                            <td class='px-4 py-3 text-sm'>
                                                <span
                                                    class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                        authUser.disabled
                                                            ? 'bg-red-100 text-red-700 border border-red-300'
                                                            : 'bg-green-100 text-green-700 border border-green-300'
                                                    }`}
                                                >
                                                    {authUser.disabled ? 'Disabled' : 'Active'}
                                                </span>
                                            </td>
                                            <td class='px-4 py-3 text-sm text-gray-700'>
                                                {getMetadataField(metadata, 'creationTime')}
                                            </td>
                                            <td class='px-4 py-3 text-sm text-gray-700'>
                                                {getMetadataField(metadata, 'lastSignInTime')}
                                            </td>
                                            <td class='px-4 py-3 text-right text-sm'>
                                                <div class='flex items-center justify-end gap-2'>
                                                    <button
                                                        onClick={() => editingUser.value = authUser}
                                                        disabled={operationInProgress.value === `role-${uid}`}
                                                        class='p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                                                        title='Edit user'
                                                        data-testid={`edit-user-${uid}`}
                                                    >
                                                        <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                                            <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' />
                                                        </svg>
                                                    </button>
                                                    <Button
                                                        variant={authUser.disabled ? 'secondary' : 'danger'}
                                                        size='sm'
                                                        onClick={() => void handleDisableUser(uid, Boolean(authUser.disabled))}
                                                        disabled={isCurrentUser || operationInProgress.value === `disable-${uid}` || operationInProgress.value === `enable-${uid}`}
                                                    >
                                                        {operationInProgress.value === `disable-${uid}` || operationInProgress.value === `enable-${uid}`
                                                            ? 'Processing...'
                                                            : authUser.disabled
                                                            ? 'Enable'
                                                            : 'Disable'}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {!hasSearchApplied.value && users.value.length > 0 && (
                    <Pagination
                        currentPage={page.value}
                        hasMore={hasMore.value}
                        hasPrevious={hasPrevious.value}
                        onNext={handleNext}
                        onPrevious={handlePrevious}
                        loading={loading.value}
                    />
                )}
            </Card>

            {/* User Editor Modal */}
            {editingUser.value && (
                <UserEditorModal
                    open={editingUser.value !== null}
                    onClose={() => editingUser.value = null}
                    onSave={() => {
                        editingUser.value = null;
                        handleReset();
                    }}
                    user={editingUser.value}
                    isCurrentUser={editingUser.value.uid === user.uid}
                />
            )}
        </div>
    );
}
