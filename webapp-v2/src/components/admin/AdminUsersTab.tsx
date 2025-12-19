import { apiClient } from '@/app/apiClient';
import { useAuth } from '@/app/hooks/useAuth';
import { Alert, Button, Card, Input, LoadingState, Pagination } from '@/components/ui';
import { EditIcon } from '@/components/ui/icons';
import { logError } from '@/utils/browser-logger';
import type { AdminUserProfile, Email, UserId } from '@billsplit-wl/shared';
import { SystemUserRoles, toDisplayName, toEmail, toUserId } from '@billsplit-wl/shared';
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

    // Initialize only on mount, not on every signal change
    useSignalEffect(() => {
        // Only run once when component mounts and users haven't been loaded yet
        if (!loading.value && users.value.length === 0 && !hasSearchApplied.value && pageHistory.value.length === 1) {
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
            window.alert(t('admin.users.errors.selfDisable'));
            return;
        }

        // Confirm action
        const action = currentlyDisabled ? t('common.enable').toLowerCase() : t('common.disable').toLowerCase();
        const confirmMessage = t('admin.users.confirmations.disableUser', { action });

        if (!window.confirm(confirmMessage)) {
            return;
        }

        operationInProgress.value = `${action}-${uid}`;
        try {
            await apiClient.updateUser(uid, { disabled: !currentlyDisabled });
            window.alert(t('admin.users.success.userToggled', { action }));

            // Reload the user list
            await loadUsers(hasSearchApplied.value ? undefined : pageHistory.value[pageHistory.value.length - 1]);
        } catch (err) {
            logError(`Failed to ${action} user`, err);
            window.alert(t('admin.users.errors.disableUser', { action }));
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
        if (role === SystemUserRoles.SYSTEM_ADMIN) return t('roles.systemAdmin.label');
        if (role === SystemUserRoles.TENANT_ADMIN) return t('roles.tenantAdmin.label');
        if (!role) return t('roles.regular.label');
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
        <div className='space-y-6'>
            <div className='flex items-center justify-between'>
                <p className='text-sm text-gray-700'>
                    {t('admin.users.description')}
                </p>
                <Button variant='secondary' size='sm' onClick={handleReset}>
                    {t('common.refresh')}
                </Button>
            </div>

            <Card className='p-6 space-y-6 bg-white/70 border border-indigo-200'>
                <form className='flex gap-4' onSubmit={handleSearch}>
                    <label className='flex flex-col text-sm text-gray-800 flex-1'>
                        <span className='mb-1'>{t('admin.users.search.label')}</span>
                        <Input
                            value={searchValue.value}
                            onChange={(value) => (searchValue.value = value)}
                            placeholder={t('admin.users.search.placeholder')}
                        />
                    </label>
                    <div className='flex gap-2 items-end'>
                        <Button type='submit' variant='primary'>{t('common.search')}</Button>
                        <Button type='button' variant='secondary' onClick={handleReset}>
                            {t('common.reset')}
                        </Button>
                    </div>
                </form>

                {loading.value && (
                    <div className='flex justify-center py-6'>
                        <LoadingState message={t('admin.users.loading')} />
                    </div>
                )}

                {error.value && <Alert type='error' message={error.value} />}

                {!loading.value && users.value.length === 0 && !error.value && <Alert type='info' message={t('admin.users.emptyState')} />}

                {users.value.length > 0 && (
                    <div className='overflow-x-auto border border-indigo-200 rounded-lg'>
                        <table className='min-w-full divide-y divide-indigo-200'>
                            <thead className='bg-indigo-50'>
                                <tr>
                                    <th scope='col' className='px-4 py-3 text-start text-xs font-medium text-indigo-700 uppercase tracking-wider'>
                                        {t('admin.users.table.displayName')}
                                    </th>
                                    <th scope='col' className='px-4 py-3 text-start text-xs font-medium text-indigo-700 uppercase tracking-wider'>
                                        {t('admin.users.table.signupHost')}
                                    </th>
                                    <th scope='col' className='px-4 py-3 text-start text-xs font-medium text-indigo-700 uppercase tracking-wider'>
                                        {t('admin.users.table.role')}
                                    </th>
                                    <th scope='col' className='px-4 py-3 text-start text-xs font-medium text-indigo-700 uppercase tracking-wider'>
                                        {t('admin.users.table.status')}
                                    </th>
                                    <th scope='col' className='px-4 py-3 text-start text-xs font-medium text-indigo-700 uppercase tracking-wider'>
                                        {t('admin.users.table.created')}
                                    </th>
                                    <th scope='col' className='px-4 py-3 text-start text-xs font-medium text-indigo-700 uppercase tracking-wider'>
                                        {t('admin.users.table.lastSignIn')}
                                    </th>
                                    <th scope='col' className='px-4 py-3 text-end text-xs font-medium text-indigo-700 uppercase tracking-wider'>
                                        {t('admin.users.table.actions')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className='bg-white divide-y divide-indigo-200'>
                                {users.value.map((authUser) => {
                                    const metadata = authUser.metadata;
                                    const uid = authUser.uid;
                                    const isCurrentUser = uid === user.uid;
                                    const role = authUser.role ?? null;

                                    return (
                                        <tr key={uid} class={isCurrentUser ? 'bg-blue-50' : ''}>
                                            <td className='px-4 py-3 text-sm text-gray-900 break-all'>
                                                {String(authUser.displayName ?? '-')}
                                                {isCurrentUser && (
                                                    <span className='ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700'>
                                                        {t('common.you')}
                                                    </span>
                                                )}
                                            </td>
                                            <td className='px-4 py-3 text-sm text-gray-700 break-all'>
                                                {authUser.signupTenantId ?? '-'}
                                            </td>
                                            <td className='px-4 py-3 text-sm'>
                                                <span class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getRoleBadgeClass(role, false)}`}>
                                                    {formatRole(role)}
                                                </span>
                                            </td>
                                            <td className='px-4 py-3 text-sm'>
                                                <span
                                                    class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                        authUser.disabled
                                                            ? 'bg-red-100 text-red-700 border border-red-300'
                                                            : 'bg-green-100 text-green-700 border border-green-300'
                                                    }`}
                                                >
                                                    {authUser.disabled ? t('common.disabled') : t('common.active')}
                                                </span>
                                            </td>
                                            <td className='px-4 py-3 text-sm text-gray-700'>
                                                {getMetadataField(metadata, 'creationTime')}
                                            </td>
                                            <td className='px-4 py-3 text-sm text-gray-700'>
                                                {getMetadataField(metadata, 'lastSignInTime')}
                                            </td>
                                            <td className='px-4 py-3 text-end text-sm'>
                                                <div className='flex items-center justify-end gap-2'>
                                                    <button
                                                        onClick={() => editingUser.value = authUser}
                                                        disabled={operationInProgress.value === `role-${uid}`}
                                                        className='p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                                                        title={t('admin.users.actions.editUser')}
                                                        aria-label={t('admin.users.actions.editUser')}
                                                    >
                                                        <EditIcon size={20} aria-hidden='true' />
                                                    </button>
                                                    <Button
                                                        variant={authUser.disabled ? 'secondary' : 'danger'}
                                                        size='sm'
                                                        onClick={() => void handleDisableUser(uid, Boolean(authUser.disabled))}
                                                        disabled={isCurrentUser || operationInProgress.value === `disable-${uid}` || operationInProgress.value === `enable-${uid}`}
                                                    >
                                                        {operationInProgress.value === `disable-${uid}` || operationInProgress.value === `enable-${uid}`
                                                            ? t('common.processing')
                                                            : authUser.disabled
                                                            ? t('common.enable')
                                                            : t('common.disable')}
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

            {/* User Editor Modal - key forces re-mount when user changes to reinitialize form state */}
            <UserEditorModal
                key={editingUser.value?.uid ?? 'no-user'}
                open={editingUser.value !== null}
                onClose={() => editingUser.value = null}
                onSave={() => {
                    editingUser.value = null;
                    handleReset();
                }}
                user={editingUser.value ?? {
                    uid: toUserId(''),
                    displayName: toDisplayName(''),
                    disabled: false,
                    role: SystemUserRoles.SYSTEM_USER,
                    metadata: { creationTime: '' },
                    emailVerified: false,
                    photoURL: null,
                }}
                isCurrentUser={editingUser.value?.uid === user.uid}
            />
        </div>
    );
}
