import { apiClient } from '@/app/apiClient';
import { useAuth } from '@/app/hooks/useAuth';
import { Alert, Button, Card, Input, LoadingState, Pagination } from '@/components/ui';
import { navigationService } from '@/services/navigation.service';
import { logError } from '@/utils/browser-logger';
import { computed, useSignal, useSignalEffect } from '@preact/signals';
import { SystemUserRoles } from '@splitifyd/shared';
import { useEffect } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

const DEFAULT_AUTH_LIMIT = 50;
const DEFAULT_FIRESTORE_LIMIT = 50;

type SchemaAnalysis = {
    missing: string[];
    unexpected: string[];
};

const REQUIRED_FIRESTORE_FIELDS = ['createdAt', 'updatedAt'] as const;
const OPTIONAL_FIRESTORE_FIELDS = ['role', 'preferredLanguage', 'acceptedPolicies', 'termsAcceptedAt', 'cookiePolicyAcceptedAt', 'privacyPolicyAcceptedAt', 'passwordChangedAt'] as const;
const ALLOWED_FIRESTORE_FIELDS = new Set<string>(['id', ...REQUIRED_FIRESTORE_FIELDS, ...OPTIONAL_FIRESTORE_FIELDS]);

function analyzeFirestoreUserSchema(user: Record<string, unknown>): SchemaAnalysis {
    const keys = Object.keys(user).filter((key) => key !== 'id');
    const missing = REQUIRED_FIRESTORE_FIELDS.filter((field) => !(field in user));
    const unexpected = keys.filter((field) => !ALLOWED_FIRESTORE_FIELDS.has(field));
    return { missing, unexpected };
}

function renderSchemaStatus(analysis: SchemaAnalysis, translate: (key: string, data?: Record<string, string>) => string) {
    if (analysis.missing.length === 0 && analysis.unexpected.length === 0) {
        return (
            <span class='inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700'>
                {translate('usersBrowser.schema.ok')}
            </span>
        );
    }

    return (
        <div class='flex flex-col gap-1'>
            {analysis.missing.map((field) => (
                <span key={`missing-${field}`} class='inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700'>
                    {translate('usersBrowser.schema.missing', { field })}
                </span>
            ))}
            {analysis.unexpected.map((field) => (
                <span key={`unexpected-${field}`} class='inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700'>
                    {translate('usersBrowser.schema.unexpected', { field })}
                </span>
            ))}
        </div>
    );
}

function formatDate(value: unknown): string {
    if (typeof value === 'string') {
        return new Date(value).toLocaleString();
    }
    return '';
}

function getMetadataField(metadata: unknown, key: 'creationTime' | 'lastSignInTime' | 'lastRefreshTime'): string {
    if (metadata && typeof metadata === 'object' && metadata !== null && key in metadata) {
        const raw = (metadata as Record<string, unknown>)[key];
        if (typeof raw === 'string') {
            return new Date(raw).toLocaleString();
        }
    }
    return '';
}

function ensureQueryValue(value: string): string {
    return value.trim();
}

export function UsersBrowserPage() {
    const { t } = useTranslation();
    const authStore = useAuth();

    useEffect(() => {
        document.title = `${t('usersBrowser.title')} | Splitifyd`;
    }, [t]);

    if (!authStore) {
        return (
            <div class='p-6'>
                <LoadingState message={t('app.loading')} />
            </div>
        );
    }

    const user = authStore.user;
    if (!user) {
        return (
            <div class='p-6'>
                <LoadingState message={t('app.loading')} />
            </div>
        );
    }

    const hasBrowserAccess = user.role === SystemUserRoles.SYSTEM_ADMIN;

    if (!hasBrowserAccess) {
        return (
            <div class='max-w-5xl mx-auto px-4 py-8'>
                <Card className='p-6 space-y-4'>
                    <h1 class='text-xl font-semibold text-gray-900'>{t('usersBrowser.title')}</h1>
                    <Alert type='error' message={t('usersBrowser.unauthorized')} />
                    <Button variant='primary' onClick={() => void navigationService.goToDashboard()}>
                        {t('userMenu.dashboard')}
                    </Button>
                </Card>
            </div>
        );
    }

    const activeTab = useSignal<'auth' | 'firestore'>('auth');

    // Auth state
    const authUsers = useSignal<Array<Record<string, unknown>>>([]);
    const authLoading = useSignal(false);
    const authError = useSignal<string | null>(null);
    const authNextPageToken = useSignal<string | undefined>(undefined);
    const authPageHistory = useSignal<Array<string | undefined>>([undefined]);
    const authPage = useSignal(1);
    const authHasMore = useSignal(false);
    const authSearchValue = useSignal('');
    const authHasSearchApplied = useSignal(false);

    const hasAuthPrevious = computed(() => authPageHistory.value.length > 1 && !authHasSearchApplied.value);

    // Firestore state
    const firestoreUsers = useSignal<Array<Record<string, unknown>>>([]);
    const firestoreLoading = useSignal(false);
    const firestoreError = useSignal<string | null>(null);
    const firestoreNextCursor = useSignal<string | undefined>(undefined);
    const firestorePageHistory = useSignal<Array<string | undefined>>([undefined]);
    const firestorePage = useSignal(1);
    const firestoreHasMore = useSignal(false);
    const firestoreSearchValue = useSignal('');
    const firestoreHasSearchApplied = useSignal(false);

    // Smart search field detection
    function detectSearchField(value: string): { type: 'email' | 'uid' | 'displayName'; value: string; } {
        const trimmed = value.trim();

        // Email detection (contains @)
        if (trimmed.includes('@')) {
            return { type: 'email', value: trimmed };
        }

        // UID detection (28 alphanumeric characters, typical Firebase UID format)
        if (/^[a-zA-Z0-9]{20,}$/.test(trimmed)) {
            return { type: 'uid', value: trimmed };
        }

        // Default to display name
        return { type: 'displayName', value: trimmed };
    }

    const hasFirestorePrevious = computed(() => firestorePageHistory.value.length > 1 && !firestoreHasSearchApplied.value);

    const loadAuthUsers = async (pageToken?: string) => {
        authLoading.value = true;
        authError.value = null;

        try {
            const query: { limit: number; pageToken?: string; email?: string; uid?: string; } = { limit: DEFAULT_AUTH_LIMIT };

            if (authHasSearchApplied.value) {
                const searchValue = ensureQueryValue(authSearchValue.value);
                if (searchValue) {
                    const detected = detectSearchField(searchValue);

                    // Auth only supports email and uid searches
                    if (detected.type === 'email' || detected.type === 'uid') {
                        query[detected.type] = detected.value;
                    } else {
                        // Display name not supported for Auth
                        authError.value = t('usersBrowser.authDisplayNameNotSupported');
                        authLoading.value = false;
                        return;
                    }
                }
            } else if (pageToken) {
                query.pageToken = pageToken;
            }

            const response = await apiClient.listAuthUsers(query);
            authUsers.value = response.users ?? [];
            authNextPageToken.value = response.nextPageToken ?? undefined;
            authHasMore.value = Boolean(response.hasMore);

            if (authHasSearchApplied.value) {
                authHasMore.value = false;
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : t('usersBrowser.errors.auth');
            authError.value = message;
        } finally {
            authLoading.value = false;
        }
    };

    const loadFirestoreUsers = async (cursor?: string) => {
        firestoreLoading.value = true;
        firestoreError.value = null;

        try {
            const query: { limit: number; cursor?: string; email?: string; uid?: string; displayName?: string; } = { limit: DEFAULT_FIRESTORE_LIMIT };

            if (firestoreHasSearchApplied.value) {
                const searchValue = ensureQueryValue(firestoreSearchValue.value);
                if (searchValue) {
                    const detected = detectSearchField(searchValue);
                    query[detected.type] = detected.value;
                }
            } else if (cursor) {
                query.cursor = cursor;
            }

            const response = await apiClient.listFirestoreUsers(query);
            firestoreUsers.value = response.users ?? [];
            firestoreNextCursor.value = response.nextCursor ?? undefined;
            firestoreHasMore.value = Boolean(response.hasMore);

            if (firestoreHasSearchApplied.value) {
                firestoreHasMore.value = false;
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : t('usersBrowser.errors.firestore');
            firestoreError.value = message;
        } finally {
            firestoreLoading.value = false;
        }
    };

    const initializeAuth = async () => {
        authPageHistory.value = [undefined];
        authPage.value = 1;
        authHasSearchApplied.value = false;
        await loadAuthUsers();
    };

    const initializeFirestore = async () => {
        firestorePageHistory.value = [undefined];
        firestorePage.value = 1;
        firestoreHasSearchApplied.value = false;
        await loadFirestoreUsers();
    };

    useSignalEffect(() => {
        if (activeTab.value === 'auth' && !authLoading.value && authUsers.value.length === 0) {
            void initializeAuth();
        }
        if (activeTab.value === 'firestore' && !firestoreLoading.value && firestoreUsers.value.length === 0) {
            void initializeFirestore();
        }
    });

    const handleAuthSearch = async (event: Event) => {
        event.preventDefault();
        const value = ensureQueryValue(authSearchValue.value);
        if (!value) {
            authHasSearchApplied.value = false;
            await initializeAuth();
            return;
        }

        authHasSearchApplied.value = true;
        authPageHistory.value = [undefined];
        authPage.value = 1;
        await loadAuthUsers();
    };

    const handleAuthReset = async () => {
        authSearchValue.value = '';
        authHasSearchApplied.value = false;
        await initializeAuth();
    };

    const handleAuthNext = async () => {
        if (!authHasMore.value || authHasSearchApplied.value) return;
        const nextToken = authNextPageToken.value;
        if (!nextToken) return;
        authPageHistory.value = [...authPageHistory.value, nextToken];
        authPage.value = authPageHistory.value.length;
        await loadAuthUsers(nextToken);
    };

    const handleAuthPrevious = async () => {
        if (!hasAuthPrevious.value) return;
        const history = [...authPageHistory.value];
        history.pop();
        const previousToken = history[history.length - 1];
        authPageHistory.value = history;
        authPage.value = history.length;
        await loadAuthUsers(previousToken);
    };

    const handleFirestoreSearch = async (event: Event) => {
        event.preventDefault();
        const value = ensureQueryValue(firestoreSearchValue.value);
        if (!value) {
            firestoreHasSearchApplied.value = false;
            await initializeFirestore();
            return;
        }

        firestoreHasSearchApplied.value = true;
        firestorePageHistory.value = [undefined];
        firestorePage.value = 1;
        await loadFirestoreUsers();
    };

    const handleFirestoreReset = async () => {
        firestoreSearchValue.value = '';
        firestoreHasSearchApplied.value = false;
        await initializeFirestore();
    };

    const handleFirestoreNext = async () => {
        if (!firestoreHasMore.value || firestoreHasSearchApplied.value) return;
        const nextCursor = firestoreNextCursor.value;
        if (!nextCursor) return;
        firestorePageHistory.value = [...firestorePageHistory.value, nextCursor];
        firestorePage.value = firestorePageHistory.value.length;
        await loadFirestoreUsers(nextCursor);
    };

    const handleFirestorePrevious = async () => {
        if (!hasFirestorePrevious.value) return;
        const history = [...firestorePageHistory.value];
        history.pop();
        const previousCursor = history[history.length - 1];
        firestorePageHistory.value = history;
        firestorePage.value = history.length;
        await loadFirestoreUsers(previousCursor);
    };

    const selectedUserData = useSignal<{ auth: Record<string, unknown> | null; firestore: Record<string, unknown> | null; } | null>(null);
    const jsonViewLoading = useSignal(false);

    const handleViewJson = async (uid: string) => {
        jsonViewLoading.value = true;
        try {
            // Fetch both auth and firestore data for this user
            const [authResponse, firestoreResponse] = await Promise.all([
                apiClient.listAuthUsers({ uid }),
                apiClient.listFirestoreUsers({ uid }),
            ]);

            selectedUserData.value = {
                auth: authResponse.users?.[0] ?? null,
                firestore: firestoreResponse.users?.[0] ?? null,
            };
        } catch (error) {
            logError('Failed to load user data for JSON view', error);
            selectedUserData.value = {
                auth: null,
                firestore: null,
            };
        } finally {
            jsonViewLoading.value = false;
        }
    };

    const closeJsonViewer = () => {
        selectedUserData.value = null;
    };

    const copyJson = async () => {
        if (!selectedUserData.value) return;
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                await navigator.clipboard.writeText(JSON.stringify(selectedUserData.value, null, 2));
                if (typeof window !== 'undefined') {
                    window.alert(t('usersBrowser.copiedJson'));
                }
            }
        } catch (error) {
            logError('Failed to copy JSON', error);
        }
    };

    const renderJsonViewer = () => {
        if (!selectedUserData.value && !jsonViewLoading.value) return null;
        return (
            <div class='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center px-4'>
                <div class='bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[80vh] overflow-hidden flex flex-col'>
                    <div class='px-4 py-3 border-b border-gray-200 flex items-center justify-between'>
                        <h2 class='text-lg font-semibold text-gray-800'>{t('usersBrowser.jsonViewTitle')}</h2>
                        <div class='flex items-center gap-2'>
                            <Button variant='secondary' onClick={copyJson} ariaLabel={t('usersBrowser.copyJson')}>
                                {t('usersBrowser.copyJson')}
                            </Button>
                            <Button variant='primary' onClick={closeJsonViewer} ariaLabel={t('usersBrowser.closeJsonViewer')}>
                                {t('usersBrowser.closeJsonViewer')}
                            </Button>
                        </div>
                    </div>
                    {jsonViewLoading.value
                        ? (
                            <div class='flex-1 flex items-center justify-center p-8'>
                                <LoadingState message={t('usersBrowser.loadingUserData')} />
                            </div>
                        )
                        : (
                            <div class='flex-1 overflow-auto grid grid-cols-2 gap-4 p-4'>
                                <div class='flex flex-col'>
                                    <h3 class='text-sm font-semibold text-gray-700 mb-2 px-4 py-2 bg-blue-50 rounded-t-lg'>Firebase Auth</h3>
                                    <pre class='flex-1 overflow-auto p-4 text-sm bg-gray-50 text-gray-800 whitespace-pre-wrap border border-gray-200 rounded-b-lg'>
                                    {JSON.stringify(selectedUserData.value?.auth ?? null, null, 2)}
                                    </pre>
                                </div>
                                <div class='flex flex-col'>
                                    <h3 class='text-sm font-semibold text-gray-700 mb-2 px-4 py-2 bg-green-50 rounded-t-lg'>Firestore Document</h3>
                                    <pre class='flex-1 overflow-auto p-4 text-sm bg-gray-50 text-gray-800 whitespace-pre-wrap border border-gray-200 rounded-b-lg'>
                                    {JSON.stringify(selectedUserData.value?.firestore ?? null, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}
                </div>
            </div>
        );
    };

    return (
        <div class='max-w-7xl mx-auto px-4 py-8 space-y-6'>
            <div class='flex items-center justify-between'>
                <h1 class='text-2xl font-semibold text-gray-900'>{t('usersBrowser.title')}</h1>
            </div>

            <div class='flex flex-wrap gap-2'>
                <Button variant={activeTab.value === 'auth' ? 'primary' : 'secondary'} onClick={() => (activeTab.value = 'auth')}>
                    {t('usersBrowser.authTab')}
                </Button>
                <Button variant={activeTab.value === 'firestore' ? 'primary' : 'secondary'} onClick={() => (activeTab.value = 'firestore')}>
                    {t('usersBrowser.firestoreTab')}
                </Button>
            </div>

            <Card className='p-6 space-y-6'>
                {activeTab.value === 'auth'
                    ? (
                        <div class='space-y-6'>
                            <p class='text-sm text-gray-600'>{t('usersBrowser.authLimitNote', { count: DEFAULT_AUTH_LIMIT })}</p>
                            <form class='flex gap-4' onSubmit={handleAuthSearch}>
                                <label class='flex flex-col text-sm text-gray-700 flex-1'>
                                    <span class='mb-1'>{t('usersBrowser.searchLabel')}</span>
                                    <Input value={authSearchValue.value} onChange={(value) => (authSearchValue.value = value)} placeholder={t('usersBrowser.searchPlaceholderSmart')} />
                                </label>
                                <div class='flex gap-2 items-end'>
                                    <Button type='submit'>{t('usersBrowser.searchButton')}</Button>
                                    <Button type='button' variant='secondary' onClick={handleAuthReset}>
                                        {t('usersBrowser.resetButton')}
                                    </Button>
                                </div>
                            </form>

                            {authLoading.value && (
                                <div class='flex justify-center py-6'>
                                    <LoadingState message={t('usersBrowser.loaders.loadingAuth')} />
                                </div>
                            )}

                            {authError.value && <Alert type='error' message={authError.value} />}

                            {!authLoading.value && authUsers.value.length === 0 && !authError.value && <Alert type='info' message={t('usersBrowser.noResults')} />}

                            {authUsers.value.length > 0 && (
                                <div class='overflow-x-auto border border-gray-200 rounded-lg'>
                                    <table class='min-w-full divide-y divide-gray-200'>
                                        <thead class='bg-gray-50'>
                                            <tr>
                                                <th scope='col' class='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                                    {t('usersBrowser.table.auth.uid')}
                                                </th>
                                                <th scope='col' class='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                                    {t('usersBrowser.table.auth.email')}
                                                </th>
                                                <th scope='col' class='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                                    {t('usersBrowser.table.auth.displayName')}
                                                </th>
                                                <th scope='col' class='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                                    {t('usersBrowser.table.auth.status')}
                                                </th>
                                                <th scope='col' class='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                                    {t('usersBrowser.table.auth.createdAt')}
                                                </th>
                                                <th scope='col' class='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                                    {t('usersBrowser.table.auth.lastSignInAt')}
                                                </th>
                                                <th scope='col' class='px-4 py-3'>
                                                    <span class='sr-only'>{t('usersBrowser.viewJson')}</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody class='bg-white divide-y divide-gray-200'>
                                            {authUsers.value.map((authUser) => {
                                                const metadata = authUser.metadata;
                                                return (
                                                    <tr key={String(authUser.uid)}>
                                                        <td class='px-4 py-3 text-sm text-gray-900 break-all'>{String(authUser.uid ?? '')}</td>
                                                        <td class='px-4 py-3 text-sm text-gray-900 break-all'>{String(authUser.email ?? '')}</td>
                                                        <td class='px-4 py-3 text-sm text-gray-900 break-all'>{String(authUser.displayName ?? '')}</td>
                                                        <td class='px-4 py-3 text-sm'>
                                                            <span
                                                                class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                                    authUser.disabled
                                                                        ? 'bg-red-100 text-red-800'
                                                                        : 'bg-green-100 text-green-800'
                                                                }`}
                                                            >
                                                                {authUser.disabled ? t('usersBrowser.statusDisabled') : t('usersBrowser.statusEnabled')}
                                                            </span>
                                                        </td>
                                                        <td class='px-4 py-3 text-sm text-gray-700'>{getMetadataField(metadata, 'creationTime')}</td>
                                                        <td class='px-4 py-3 text-sm text-gray-700'>{getMetadataField(metadata, 'lastSignInTime')}</td>
                                                        <td class='px-4 py-3 text-right text-sm'>
                                                            <div class='flex items-center justify-end gap-2'>
                                                                <Button variant='secondary' onClick={() => void handleViewJson(String(authUser.uid))}>
                                                                    {t('usersBrowser.viewJson')}
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

                            {!authHasSearchApplied.value && authUsers.value.length > 0 && (
                                <Pagination
                                    currentPage={authPage.value}
                                    hasMore={authHasMore.value}
                                    hasPrevious={hasAuthPrevious.value}
                                    onNext={handleAuthNext}
                                    onPrevious={handleAuthPrevious}
                                    loading={authLoading.value}
                                />
                            )}
                        </div>
                    )
                    : (
                        <div class='space-y-6'>
                            <p class='text-sm text-gray-600'>{t('usersBrowser.firestoreLimitNote', { count: DEFAULT_FIRESTORE_LIMIT })}</p>
                            <form class='flex gap-4' onSubmit={handleFirestoreSearch}>
                                <label class='flex flex-col text-sm text-gray-700 flex-1'>
                                    <span class='mb-1'>{t('usersBrowser.searchLabel')}</span>
                                    <Input value={firestoreSearchValue.value} onChange={(value) => (firestoreSearchValue.value = value)} placeholder={t('usersBrowser.searchPlaceholderSmart')} />
                                </label>
                                <div class='flex gap-2 items-end'>
                                    <Button type='submit'>{t('usersBrowser.searchButton')}</Button>
                                    <Button type='button' variant='secondary' onClick={handleFirestoreReset}>
                                        {t('usersBrowser.resetButton')}
                                    </Button>
                                </div>
                            </form>

                            {firestoreLoading.value && (
                                <div class='flex justify-center py-6'>
                                    <LoadingState message={t('usersBrowser.loaders.loadingFirestore')} />
                                </div>
                            )}

                            {firestoreError.value && <Alert type='error' message={firestoreError.value} />}

                            {!firestoreLoading.value && firestoreUsers.value.length === 0 && !firestoreError.value && <Alert type='info' message={t('usersBrowser.noResults')} />}

                            {firestoreUsers.value.length > 0 && (
                                <div class='overflow-x-auto border border-gray-200 rounded-lg'>
                                    <table class='min-w-full divide-y divide-gray-200'>
                                        <thead class='bg-gray-50'>
                                            <tr>
                                                <th scope='col' class='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                                    {t('usersBrowser.table.firestore.id')}
                                                </th>
                                                <th scope='col' class='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                                    {t('usersBrowser.table.firestore.role')}
                                                </th>
                                                <th scope='col' class='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                                    {t('usersBrowser.table.firestore.updatedAt')}
                                                </th>
                                                <th scope='col' class='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                                    {t('usersBrowser.table.firestore.schema')}
                                                </th>
                                                <th scope='col' class='px-4 py-3'>
                                                    <span class='sr-only'>{t('usersBrowser.viewJson')}</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody class='bg-white divide-y divide-gray-200'>
                                            {firestoreUsers.value.map((firestoreUser) => (
                                                <tr key={String(firestoreUser.id)}>
                                                    <td class='px-4 py-3 text-sm text-gray-900 break-all'>{String(firestoreUser.id ?? '')}</td>
                                                    <td class='px-4 py-3 text-sm text-gray-700 break-all'>{String(firestoreUser.role ?? '')}</td>
                                                    <td class='px-4 py-3 text-sm text-gray-700'>{formatDate(firestoreUser.updatedAt)}</td>
                                                    <td class='px-4 py-3'>{renderSchemaStatus(analyzeFirestoreUserSchema(firestoreUser), t)}</td>
                                                    <td class='px-4 py-3 text-right text-sm'>
                                                        <Button variant='secondary' onClick={() => void handleViewJson(String(firestoreUser.id))}>
                                                            {t('usersBrowser.viewJson')}
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {!firestoreHasSearchApplied.value && firestoreUsers.value.length > 0 && (
                                <Pagination
                                    currentPage={firestorePage.value}
                                    hasMore={firestoreHasMore.value}
                                    hasPrevious={hasFirestorePrevious.value}
                                    onNext={handleFirestoreNext}
                                    onPrevious={handleFirestorePrevious}
                                    loading={firestoreLoading.value}
                                />
                            )}
                        </div>
                    )}
            </Card>

            {renderJsonViewer()}
        </div>
    );
}
