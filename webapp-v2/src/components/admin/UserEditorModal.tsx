import { apiClient } from '@/app/apiClient';
import { Alert, Button, Card, Modal } from '@/components/ui';
import { logError } from '@/utils/browser-logger';
import type { AdminUserProfile, SystemUserRole } from '@billsplit-wl/shared';
import { SystemUserRoles } from '@billsplit-wl/shared';
import { useState } from 'preact/hooks';

interface UserEditorModalProps {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
    user: AdminUserProfile;
    isCurrentUser: boolean;
}

type TabType = 'role' | 'firebase-auth' | 'firestore';

export function UserEditorModal({ open, onClose, onSave, user, isCurrentUser }: UserEditorModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('role');
    const [selectedRole, setSelectedRole] = useState<SystemUserRole>(user.role ?? SystemUserRoles.SYSTEM_USER);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [firebaseAuthData, setFirebaseAuthData] = useState<any | null>(null);
    const [firestoreData, setFirestoreData] = useState<any | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(false);
    const [loadingFirestore, setLoadingFirestore] = useState(false);

    const handleSaveRole = async () => {
        if (isCurrentUser) {
            setErrorMessage('Cannot change your own role');
            return;
        }

        setIsSaving(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            await apiClient.updateUserRole(user.uid, { role: selectedRole });
            setSuccessMessage('Role updated successfully');
            setTimeout(() => {
                onSave();
                onClose();
            }, 1000);
        } catch (error) {
            logError('Failed to update user role', error);
            setErrorMessage(error instanceof Error ? error.message : 'Failed to update role');
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
            setFirebaseAuthData({ error: 'Failed to load data' });
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
            setFirestoreData({ error: 'Failed to load data' });
        } finally {
            setLoadingFirestore(false);
        }
    };

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        if (tab === 'firebase-auth' && !firebaseAuthData) {
            loadFirebaseAuthData();
        } else if (tab === 'firestore' && !firestoreData) {
            loadFirestoreData();
        }
    };

    const roleOptions = [
        { value: SystemUserRoles.SYSTEM_USER, label: 'Regular User', description: 'Standard user with no administrative privileges' },
        { value: SystemUserRoles.TENANT_ADMIN, label: 'Tenant Admin', description: 'Can manage tenant settings and configuration' },
        { value: SystemUserRoles.SYSTEM_ADMIN, label: 'System Admin', description: 'Full system access and control' },
    ];

    return (
        <Modal open={open} onClose={onClose} size='lg' data-testid='user-editor-modal'>
            <div class='flex flex-col max-h-[90vh]'>
                {/* Header */}
                <div class='border-b border-border-default px-6 py-4'>
                    <h2 class='text-xl font-semibold text-text-primary'>Edit User</h2>
                    <p class='text-sm text-text-muted mt-1'>{user.email}</p>
                </div>

                {/* Tabs */}
                <div class='border-b border-border-default px-6'>
                    <nav class='flex space-x-4' aria-label='User editor tabs'>
                        <button
                            onClick={() => handleTabChange('role')}
                            class={`py-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'role'
                                    ? 'border-interactive-primary text-interactive-primary'
                                    : 'border-transparent text-text-muted hover:text-text-primary'
                            }`}
                        >
                            Role Editor
                        </button>
                        <button
                            onClick={() => handleTabChange('firebase-auth')}
                            class={`py-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'firebase-auth'
                                    ? 'border-interactive-primary text-interactive-primary'
                                    : 'border-transparent text-text-muted hover:text-text-primary'
                            }`}
                        >
                            Firebase Auth Document
                        </button>
                        <button
                            onClick={() => handleTabChange('firestore')}
                            class={`py-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'firestore'
                                    ? 'border-interactive-primary text-interactive-primary'
                                    : 'border-transparent text-text-muted hover:text-text-primary'
                            }`}
                        >
                            Firestore Document
                        </button>
                    </nav>
                </div>

                {/* Content */}
                <div class='flex-1 overflow-y-auto px-6 py-6'>
                    <div class='mb-4'>
                        {errorMessage && <Alert type='error' message={errorMessage} />}
                        {successMessage && <Alert type='success' message={successMessage} />}
                    </div>

                    {/* Role Editor Tab */}
                    {activeTab === 'role' && (
                        <div class='space-y-4'>
                            <p class='text-sm text-text-muted'>Select a role for this user</p>

                            {isCurrentUser && (
                                <Alert type='warning' message='You cannot change your own role' />
                            )}

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
                            {loadingAuth ? (
                                <div class='text-center py-8 text-text-muted'>Loading...</div>
                            ) : firebaseAuthData ? (
                                <Card padding='md' className='bg-surface-muted'>
                                    <pre class='text-xs overflow-x-auto whitespace-pre-wrap break-all'>
                                        {JSON.stringify(firebaseAuthData, null, 2)}
                                    </pre>
                                </Card>
                            ) : (
                                <div class='text-center py-8 text-text-muted'>No data available</div>
                            )}
                        </div>
                    )}

                    {/* Firestore Document Tab */}
                    {activeTab === 'firestore' && (
                        <div>
                            {loadingFirestore ? (
                                <div class='text-center py-8 text-text-muted'>Loading...</div>
                            ) : firestoreData ? (
                                <Card padding='md' className='bg-surface-muted'>
                                    <pre class='text-xs overflow-x-auto whitespace-pre-wrap break-all'>
                                        {JSON.stringify(firestoreData, null, 2)}
                                    </pre>
                                </Card>
                            ) : (
                                <div class='text-center py-8 text-text-muted'>No data available</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div class='flex items-center justify-end gap-3 border-t border-border-default bg-surface-base px-6 py-4'>
                    <Button
                        onClick={onClose}
                        variant='secondary'
                        disabled={isSaving}
                        data-testid='cancel-button'
                    >
                        {activeTab === 'role' ? 'Cancel' : 'Close'}
                    </Button>
                    {activeTab === 'role' && (
                        <Button
                            onClick={handleSaveRole}
                            variant='primary'
                            loading={isSaving}
                            disabled={isSaving || isCurrentUser || selectedRole === user.role}
                            data-testid='save-role-button'
                            className='!bg-gradient-to-r !from-indigo-600 !to-purple-600 !text-white !shadow-lg hover:!shadow-indigo-500/30'
                        >
                            {isSaving ? 'Saving...' : 'Save Role'}
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
}
