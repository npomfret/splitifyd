import { apiClient } from '@/app/apiClient';
import { useModalOpenOrChange } from '@/app/hooks/useModalOpen';
import { Alert, Button, Card, Input, LoadingSpinner } from '@/components/ui';
import { Modal, ModalFooter, ModalHeader } from '@/components/ui/Modal';
import { logError } from '@/utils/browser-logger';
import type { AdminUserProfile, SystemUserRole, UpdateUserProfileAdminRequest } from '@billsplit-wl/shared';
import { SystemUserRoles, toDisplayName, toEmail } from '@billsplit-wl/shared';
import { useCallback, useState } from 'preact/hooks';
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

    // Reset form when modal opens or user changes
    useModalOpenOrChange(open, user.uid, useCallback(() => {
        setDisplayName(String(user.displayName ?? ''));
        setEmail(String(user.email ?? ''));
        setSelectedRole(user.role ?? SystemUserRoles.SYSTEM_USER);
        setErrorMessage('');
        setSuccessMessage('');
        setFirebaseAuthData(null);
        setFirestoreData(null);
        setActiveTab('profile');
    }, [user.displayName, user.email, user.role]));

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

    const hasProfileChanges = displayName.trim() !== String(user.displayName ?? '')
        || email.trim().toLowerCase() !== String(user.email ?? '').toLowerCase();

    return (
        <Modal open={open} onClose={onClose} size='lg' labelledBy='user-editor-modal-title'>
            <div className='flex flex-col max-h-[90vh] overflow-hidden'>
                <ModalHeader>
                    <h2 id='user-editor-modal-title' className='text-xl font-semibold text-text-primary'>{t('admin.userEditor.title')}</h2>
                    <p className='help-text mt-1'>{user.email}</p>
                </ModalHeader>

                {/* Tabs */}
                <div className='border-b border-border-default px-6'>
                    <nav className='flex space-x-4' role='tablist' aria-label={t('admin.userEditor.tabs.ariaLabel')}>
                        <button
                            onClick={() => handleTabChange('profile')}
                            className={`py-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'profile'
                                    ? 'border-interactive-primary text-interactive-primary'
                                    : 'border-transparent text-text-muted hover:text-text-primary'
                            }`}
                            role='tab'
                            aria-selected={activeTab === 'profile'}
                        >
                            {t('admin.userEditor.tabs.profile')}
                        </button>
                        <button
                            onClick={() => handleTabChange('role')}
                            className={`py-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'role'
                                    ? 'border-interactive-primary text-interactive-primary'
                                    : 'border-transparent text-text-muted hover:text-text-primary'
                            }`}
                            role='tab'
                            aria-selected={activeTab === 'role'}
                        >
                            {t('admin.userEditor.tabs.role')}
                        </button>
                        <button
                            onClick={() => handleTabChange('firebase-auth')}
                            className={`py-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'firebase-auth'
                                    ? 'border-interactive-primary text-interactive-primary'
                                    : 'border-transparent text-text-muted hover:text-text-primary'
                            }`}
                            role='tab'
                            aria-selected={activeTab === 'firebase-auth'}
                        >
                            {t('admin.userEditor.tabs.firebaseAuth')}
                        </button>
                        <button
                            onClick={() => handleTabChange('firestore')}
                            className={`py-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'firestore'
                                    ? 'border-interactive-primary text-interactive-primary'
                                    : 'border-transparent text-text-muted hover:text-text-primary'
                            }`}
                            role='tab'
                            aria-selected={activeTab === 'firestore'}
                        >
                            {t('admin.userEditor.tabs.firestore')}
                        </button>
                    </nav>
                </div>

                {/* Content */}
                <div className='flex-1 overflow-y-auto px-6 py-6'>
                    <div className='mb-4'>
                        {errorMessage && <Alert type='error' message={errorMessage} />}
                        {successMessage && <Alert type='success' message={successMessage} />}
                    </div>

                    {/* Profile Tab */}
                    {activeTab === 'profile' && (
                        <div className='space-y-6'>
                            <p className='help-text'>{t('admin.userEditor.profile.description')}</p>

                            <div className='space-y-4'>
                                <div>
                                    <label htmlFor='user-editor-display-name' className='block text-sm font-medium text-text-primary mb-2'>
                                        {t('admin.userEditor.profile.displayName')}
                                    </label>
                                    <Input
                                        id='user-editor-display-name'
                                        value={displayName}
                                        onChange={setDisplayName}
                                        placeholder={t('admin.userEditor.profile.displayNamePlaceholder')}
                                    />
                                </div>

                                <div>
                                    <label htmlFor='user-editor-email' className='block text-sm font-medium text-text-primary mb-2'>
                                        {t('admin.userEditor.profile.email')}
                                    </label>
                                    <Input
                                        id='user-editor-email'
                                        type='email'
                                        value={email}
                                        onChange={setEmail}
                                        placeholder={t('admin.userEditor.profile.emailPlaceholder')}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Role Tab */}
                    {activeTab === 'role' && (
                        <div className='space-y-4'>
                            <p className='help-text'>{t('admin.userEditor.role.description')}</p>

                            {isCurrentUser && <Alert type='warning' message={t('admin.userEditor.errors.selfRoleChangeWarning')} />}

                            <div className='space-y-3'>
                                {roleOptions.map((option) => (
                                    <label
                                        key={String(option.value)}
                                        className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
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
                                            className='mt-1 mr-3'
                                        />
                                        <div>
                                            <div className='font-medium text-text-primary'>{option.label}</div>
                                            <div className='help-text mt-1'>{option.description}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Firebase Auth Document Tab */}
                    {activeTab === 'firebase-auth' && (
                        <div>
                            {loadingAuth
                                ? (
                                    <div className='flex justify-center py-8'>
                                        <LoadingSpinner size='md' />
                                    </div>
                                )
                                : firebaseAuthData
                                ? (
                                    <Card padding='md' className='bg-surface-muted'>
                                        <pre className='text-xs overflow-x-auto whitespace-pre-wrap break-all'>
                                            {JSON.stringify(firebaseAuthData, null, 2)}
                                        </pre>
                                    </Card>
                                )
                                : <div className='text-center py-8 text-text-muted'>{t('admin.userEditor.noDataAvailable')}</div>}
                        </div>
                    )}

                    {/* Firestore Document Tab */}
                    {activeTab === 'firestore' && (
                        <div>
                            {loadingFirestore
                                ? (
                                    <div className='flex justify-center py-8'>
                                        <LoadingSpinner size='md' />
                                    </div>
                                )
                                : firestoreData
                                ? (
                                    <Card padding='md' className='bg-surface-muted'>
                                        <pre className='text-xs overflow-x-auto whitespace-pre-wrap break-all'>
                                            {JSON.stringify(firestoreData, null, 2)}
                                        </pre>
                                    </Card>
                                )
                                : <div className='text-center py-8 text-text-muted'>{t('admin.userEditor.noDataAvailable')}</div>}
                        </div>
                    )}
                </div>

                <ModalFooter className='bg-surface-base rounded-b-2xl'>
                    <Button
                        onClick={onClose}
                        variant='secondary'
                        disabled={isSaving}
                    >
                        {activeTab === 'profile' || activeTab === 'role' ? t('common.cancel') : t('common.close')}
                    </Button>
                    {activeTab === 'profile' && (
                        <Button
                            onClick={handleSaveProfile}
                            variant='primary'
                            loading={isSaving}
                            disabled={isSaving || !hasProfileChanges}
                            className='bg-linear-to-r! from-indigo-600! to-purple-600! text-white! shadow-lg! hover:shadow-indigo-500/30!'
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
                            className='bg-linear-to-r! from-indigo-600! to-purple-600! text-white! shadow-lg! hover:shadow-indigo-500/30!'
                        >
                            {isSaving ? t('common.saving') : t('common.save')}
                        </Button>
                    )}
                </ModalFooter>
            </div>
        </Modal>
    );
}
