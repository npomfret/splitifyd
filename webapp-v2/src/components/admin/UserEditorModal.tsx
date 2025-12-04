import { apiClient } from '@/app/apiClient';
import { Alert, Button, Card, Input, Modal } from '@/components/ui';
import { logError } from '@/utils/browser-logger';
import type { AdminUserProfile, DisplayName, Email, SystemUserRole, UpdateUserProfileAdminRequest } from '@billsplit-wl/shared';
import { SystemUserRoles, toDisplayName, toEmail } from '@billsplit-wl/shared';
import { useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

interface UserEditorModalProps {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
    user: AdminUserProfile;
    isCurrentUser: boolean;
}

type TabType = 'profile' | 'role' | 'firebase-auth' | 'firestore';

export function UserEditorModal({ open, onClose, onSave, user, isCurrentUser }: UserEditorModalProps) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabType>('profile');
    const [selectedRole, setSelectedRole] = useState<SystemUserRole>(user.role ?? SystemUserRoles.SYSTEM_USER);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [firebaseAuthData, setFirebaseAuthData] = useState<any | null>(null);
    const [firestoreData, setFirestoreData] = useState<any | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(false);
    const [loadingFirestore, setLoadingFirestore] = useState(false);

    // Profile tab state
    const [displayName, setDisplayName] = useState(String(user.displayName ?? ''));
    const [email, setEmail] = useState(String(user.email ?? ''));

    const handleSaveProfile = async () => {
        setIsSaving(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const updates: UpdateUserProfileAdminRequest = {};

            if (displayName.trim() !== String(user.displayName ?? '')) {
                updates.displayName = toDisplayName(displayName.trim());
            }
            if (email.trim().toLowerCase() !== String(user.email ?? '').toLowerCase()) {
                updates.email = toEmail(email.trim().toLowerCase());
            }

            if (Object.keys(updates).length === 0) {
                setErrorMessage(t('admin.userEditor.errors.noChanges'));
                setIsSaving(false);
                return;
            }

            await apiClient.updateUserProfileAdmin(user.uid, updates);
            setSuccessMessage(t('admin.userEditor.success.profileUpdated'));
            setTimeout(() => {
                onSave();
                onClose();
            }, 1000);
        } catch (error) {
            logError('Failed to update user profile', error);
            setErrorMessage(error instanceof Error ? error.message : t('admin.userEditor.errors.profileUpdate'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveRole = async () => {
        if (isCurrentUser) {
            setErrorMessage(t('admin.userEditor.errors.selfRoleChange'));
            return;
        }

        setIsSaving(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            await apiClient.updateUserRole(user.uid, { role: selectedRole });
            setSuccessMessage(t('admin.userEditor.success.roleUpdated'));
            setTimeout(() => {
                onSave();
                onClose();
            }, 1000);
        } catch (error) {
            logError('Failed to update user role', error);
            setErrorMessage(error instanceof Error ? error.message : t('admin.userEditor.errors.roleUpdate'));
        } finally {
            setIsSaving(false);
        }
    };

    const loadFirebaseAuthData = async () => {
        if (firebaseAuthData) return; // Already loaded

        setLoadingAuth(true);
        try {
            const authData = await apiClient.getUserAuth(user.uid);
            setFirebaseAuthData(authData);
        } catch (error) {
            logError('Failed to load Firebase Auth data', error);
            setFirebaseAuthData({ error: t('admin.userEditor.errors.loadData') });
        } finally {
            setLoadingAuth(false);
        }
    };

    const loadFirestoreData = async () => {
        if (firestoreData) return; // Already loaded

        setLoadingFirestore(true);
        try {
            const firestoreDoc = await apiClient.getUserFirestore(user.uid);
            setFirestoreData(firestoreDoc);
        } catch (error) {
            logError('Failed to load Firestore data', error);
            setFirestoreData({ error: t('admin.userEditor.errors.loadData') });
        } finally {
            setLoadingFirestore(false);
        }
    };

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        setErrorMessage('');
        setSuccessMessage('');
        if (tab === 'firebase-auth' && !firebaseAuthData) {
            loadFirebaseAuthData();
        } else if (tab === 'firestore' && !firestoreData) {
            loadFirestoreData();
        }
    };

    const roleOptions = [
        { value: SystemUserRoles.SYSTEM_USER, label: t('roles.regular.label'), description: t('roles.regular.description') },
        { value: SystemUserRoles.TENANT_ADMIN, label: t('roles.tenantAdmin.label'), description: t('roles.tenantAdmin.description') },
        { value: SystemUserRoles.SYSTEM_ADMIN, label: t('roles.systemAdmin.label'), description: t('roles.systemAdmin.description') },
    ];

    const hasProfileChanges = displayName.trim() !== String(user.displayName ?? '') ||
        email.trim().toLowerCase() !== String(user.email ?? '').toLowerCase();

    return (
        <Modal open={open} onClose={onClose} size='lg' data-testid='user-editor-modal'>
            <div class='flex flex-col max-h-[90vh] overflow-hidden'>
                {/* Header */}
                <div class='border-b border-border-default px-6 py-4'>
                    <h2 class='text-xl font-semibold text-text-primary'>{t('admin.userEditor.title')}</h2>
                    <p class='text-sm text-text-muted mt-1'>{user.email}</p>
                </div>

                {/* Tabs */}
                <div class='border-b border-border-default px-6'>
                    <nav class='flex space-x-4' aria-label={t('admin.userEditor.tabs.ariaLabel')}>
                        <button
                            onClick={() => handleTabChange('profile')}
                            class={`py-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'profile'
                                    ? 'border-interactive-primary text-interactive-primary'
                                    : 'border-transparent text-text-muted hover:text-text-primary'
                            }`}
                            data-testid='profile-tab'
                        >
                            {t('admin.userEditor.tabs.profile')}
                        </button>
                        <button
                            onClick={() => handleTabChange('role')}
                            class={`py-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'role'
                                    ? 'border-interactive-primary text-interactive-primary'
                                    : 'border-transparent text-text-muted hover:text-text-primary'
                            }`}
                            data-testid='role-tab'
                        >
                            {t('admin.userEditor.tabs.role')}
                        </button>
                        <button
                            onClick={() => handleTabChange('firebase-auth')}
                            class={`py-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'firebase-auth'
                                    ? 'border-interactive-primary text-interactive-primary'
                                    : 'border-transparent text-text-muted hover:text-text-primary'
                            }`}
                        >
                            {t('admin.userEditor.tabs.firebaseAuth')}
                        </button>
                        <button
                            onClick={() => handleTabChange('firestore')}
                            class={`py-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'firestore'
                                    ? 'border-interactive-primary text-interactive-primary'
                                    : 'border-transparent text-text-muted hover:text-text-primary'
                            }`}
                        >
                            {t('admin.userEditor.tabs.firestore')}
                        </button>
                    </nav>
                </div>

                {/* Content */}
                <div class='flex-1 overflow-y-auto px-6 py-6'>
                    <div class='mb-4'>
                        {errorMessage && <Alert type='error' message={errorMessage} />}
                        {successMessage && <Alert type='success' message={successMessage} />}
                    </div>

                    {/* Profile Tab */}
                    {activeTab === 'profile' && (
                        <div class='space-y-6'>
                            <p class='text-sm text-text-muted'>{t('admin.userEditor.profile.description')}</p>

                            <div class='space-y-4'>
                                <div>
                                    <label class='block text-sm font-medium text-text-primary mb-2'>
                                        {t('admin.userEditor.profile.displayName')}
                                    </label>
                                    <Input
                                        value={displayName}
                                        onChange={setDisplayName}
                                        placeholder={t('admin.userEditor.profile.displayNamePlaceholder')}
                                        data-testid='display-name-input'
                                    />
                                </div>

                                <div>
                                    <label class='block text-sm font-medium text-text-primary mb-2'>
                                        {t('admin.userEditor.profile.email')}
                                    </label>
                                    <Input
                                        type='email'
                                        value={email}
                                        onChange={setEmail}
                                        placeholder={t('admin.userEditor.profile.emailPlaceholder')}
                                        data-testid='email-input'
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Role Tab */}
                    {activeTab === 'role' && (
                        <div class='space-y-4'>
                            <p class='text-sm text-text-muted'>{t('admin.userEditor.role.description')}</p>

                            {isCurrentUser && <Alert type='warning' message={t('admin.userEditor.errors.selfRoleChangeWarning')} />}

                            <div class='space-y-3'>
                                {roleOptions.map((option) => (
                                    <label
                                        key={String(option.value)}
                                        class={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                            selectedRole === option.value
                                                ? 'border-interactive-primary bg-surface-raised'
                                                : 'border-border-default hover:border-border-strong'
                                        } ${isCurrentUser ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <input
                                            type='radio'
                                            name='role'
                                            value={String(option.value)}
                                            checked={selectedRole === option.value}
                                            onChange={() => !isCurrentUser && setSelectedRole(option.value)}
                                            disabled={isCurrentUser}
                                            class='mt-1 mr-3'
                                        />
                                        <div>
                                            <div class='font-medium text-text-primary'>{option.label}</div>
                                            <div class='text-sm text-text-muted mt-1'>{option.description}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Firebase Auth Document Tab */}
                    {activeTab === 'firebase-auth' && (
                        <div>
                            {loadingAuth ? <div class='text-center py-8 text-text-muted'>{t('admin.userEditor.loading')}</div> : firebaseAuthData
                                ? (
                                    <Card padding='md' className='bg-surface-muted'>
                                        <pre class='text-xs overflow-x-auto whitespace-pre-wrap break-all'>
                                        {JSON.stringify(firebaseAuthData, null, 2)}
                                        </pre>
                                    </Card>
                                )
                                : <div class='text-center py-8 text-text-muted'>{t('admin.userEditor.noDataAvailable')}</div>}
                        </div>
                    )}

                    {/* Firestore Document Tab */}
                    {activeTab === 'firestore' && (
                        <div>
                            {loadingFirestore ? <div class='text-center py-8 text-text-muted'>{t('admin.userEditor.loading')}</div> : firestoreData
                                ? (
                                    <Card padding='md' className='bg-surface-muted'>
                                        <pre class='text-xs overflow-x-auto whitespace-pre-wrap break-all'>
                                        {JSON.stringify(firestoreData, null, 2)}
                                        </pre>
                                    </Card>
                                )
                                : <div class='text-center py-8 text-text-muted'>{t('admin.userEditor.noDataAvailable')}</div>}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div class='flex items-center justify-end gap-3 border-t border-border-default bg-surface-base px-6 py-4 rounded-b-2xl'>
                    <Button
                        onClick={onClose}
                        variant='secondary'
                        disabled={isSaving}
                        data-testid='cancel-button'
                    >
                        {activeTab === 'profile' || activeTab === 'role' ? t('common.cancel') : t('common.close')}
                    </Button>
                    {activeTab === 'profile' && (
                        <Button
                            onClick={handleSaveProfile}
                            variant='primary'
                            loading={isSaving}
                            disabled={isSaving || !hasProfileChanges}
                            data-testid='save-profile-button'
                            className='!bg-gradient-to-r !from-indigo-600 !to-purple-600 !text-white !shadow-lg hover:!shadow-indigo-500/30'
                        >
                            {isSaving ? t('common.saving') : t('common.save')}
                        </Button>
                    )}
                    {activeTab === 'role' && (
                        <Button
                            onClick={handleSaveRole}
                            variant='primary'
                            loading={isSaving}
                            disabled={isSaving || isCurrentUser || selectedRole === user.role}
                            data-testid='save-role-button'
                            className='!bg-gradient-to-r !from-indigo-600 !to-purple-600 !text-white !shadow-lg hover:!shadow-indigo-500/30'
                        >
                            {isSaving ? t('common.saving') : t('common.save')}
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
}
