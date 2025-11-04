import { Alert, Button, Card, Input } from '@/components/ui';
import { SystemUserRoles } from '@splitifyd/shared';
import type { AddTenantDomainRequest, TenantDomainsResponse } from '@splitifyd/shared';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../app/apiClient';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { BaseLayout } from '../components/layout/BaseLayout';

/**
 * Domain Management Page
 *
 * Allows tenant admins to manage their tenant's domains:
 * - View list of mapped domains
 * - View primary domain
 * - Add new domains
 * - View DNS configuration instructions
 *
 * Access: Requires tenant-admin or system-admin role
 */
export function DomainManagementPage() {
    const { t } = useTranslation();
    const authStore = useAuthRequired();
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [domains, setDomains] = useState<TenantDomainsResponse | null>(null);
    const [newDomain, setNewDomain] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [copiedDns, setCopiedDns] = useState(false);

    const user = authStore.user;

    // Check if user has tenant-admin or system-admin role
    const hasAdminAccess = user?.role === SystemUserRoles.TENANT_ADMIN || user?.role === SystemUserRoles.SYSTEM_ADMIN;

    // Load domains on mount
    useEffect(() => {
        if (!hasAdminAccess) {
            return;
        }

        const loadDomains = async () => {
            try {
                setIsLoading(true);
                const domainsData = await apiClient.getTenantDomains();
                setDomains(domainsData);
            } catch (error: any) {
                setErrorMessage(error.message || 'Failed to load tenant domains');
                console.error('Failed to load tenant domains:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadDomains();
    }, [hasAdminAccess]);

    // Clear messages after 5 seconds
    useEffect(() => {
        if (successMessage || errorMessage) {
            const timer = setTimeout(() => {
                setSuccessMessage('');
                setErrorMessage('');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [successMessage, errorMessage]);

    // Reset copied state after 3 seconds
    useEffect(() => {
        if (copiedDns) {
            const timer = setTimeout(() => setCopiedDns(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [copiedDns]);

    const handleAddDomain = async () => {
        if (!newDomain.trim() || isAdding) return;

        setIsAdding(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const requestData: AddTenantDomainRequest = {
                domain: newDomain.trim() as any,
            };

            await apiClient.addTenantDomain(requestData);
            setSuccessMessage(`Domain "${newDomain}" added successfully`);
            setNewDomain('');
            setShowAddForm(false);

            // Reload domains
            const domainsData = await apiClient.getTenantDomains();
            setDomains(domainsData);
        } catch (error: any) {
            if (error.code === 'NOT_IMPLEMENTED') {
                setErrorMessage('Domain addition not yet implemented on the backend');
            } else {
                setErrorMessage(error.message || 'Failed to add domain');
            }
            console.error('Failed to add domain:', error);
        } finally {
            setIsAdding(false);
        }
    };

    const handleCopyDnsInstructions = async () => {
        const dnsText = `CNAME Record Configuration:
Type: CNAME
Name: @ (or your domain)
Value: ${domains?.primaryDomain || 'your-primary-domain'}
TTL: 3600

After adding this CNAME record, domain verification may take up to 24 hours.`;

        try {
            await navigator.clipboard.writeText(dnsText);
            setCopiedDns(true);
        } catch (error) {
            console.error('Failed to copy DNS instructions:', error);
        }
    };

    if (!user) {
        return null;
    }

    if (!hasAdminAccess) {
        return (
            <BaseLayout title='Access Denied' description='Domain Management' headerVariant='dashboard'>
                <div class='mx-auto max-w-screen-xl px-4 py-10 sm:px-6 lg:px-8'>
                    <Alert type='error' message='You do not have permission to access domain management. This page requires tenant-admin or system-admin role.' />
                </div>
            </BaseLayout>
        );
    }

    if (isLoading) {
        return (
            <BaseLayout title='Domain Management' description='Manage tenant domains' headerVariant='dashboard'>
                <div class='mx-auto max-w-screen-xl px-4 py-10 sm:px-6 lg:px-8'>
                    <Card padding='lg'>
                        <div class='flex items-center justify-center py-12'>
                            <div class='text-center'>
                                <div class='mx-auto h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600' />
                                <p class='mt-4 text-sm text-slate-600'>Loading domain settings...</p>
                            </div>
                        </div>
                    </Card>
                </div>
            </BaseLayout>
        );
    }

    return (
        <BaseLayout title='Domain Management' description='Manage tenant domains' headerVariant='dashboard'>
            <div class='mx-auto max-w-screen-xl px-4 py-10 sm:px-6 lg:px-8'>
                <div class='space-y-8'>
                    {/* Header */}
                    <div class='flex flex-col gap-2'>
                        <span class='text-xs font-medium uppercase tracking-wide text-indigo-600'>
                            Tenant Settings
                        </span>
                        <div class='flex flex-col gap-2'>
                            <h1 class='text-3xl font-semibold text-slate-900'>
                                Domain Management
                            </h1>
                            <p class='max-w-2xl text-sm text-slate-600 sm:text-base'>
                                Configure custom domains for your tenant
                            </p>
                        </div>
                    </div>

                    {/* Messages */}
                    {(successMessage || errorMessage) && (
                        <div class='space-y-3'>
                            {successMessage && <Alert type='success' message={successMessage} />}
                            {errorMessage && <Alert type='error' message={errorMessage} data-testid='error-message' />}
                        </div>
                    )}

                    {/* Domains List */}
                    <Card padding='lg'>
                        <div class='space-y-6'>
                            <div class='flex items-center justify-between'>
                                <div class='space-y-2'>
                                    <h2 class='text-xl font-semibold text-slate-900'>Configured Domains</h2>
                                    <p class='text-sm text-slate-600'>Domains mapped to your tenant</p>
                                </div>
                                <Button
                                    onClick={() => setShowAddForm(!showAddForm)}
                                    variant='secondary'
                                    data-testid='add-domain-button'
                                >
                                    {showAddForm ? 'Cancel' : 'Add Domain'}
                                </Button>
                            </div>

                            {/* Add Domain Form */}
                            {showAddForm && (
                                <div class='rounded-lg border border-slate-200 bg-slate-50 p-4'>
                                    <div class='space-y-4'>
                                        <Input
                                            label='New Domain'
                                            value={newDomain}
                                            onChange={setNewDomain}
                                            placeholder='example.com'
                                            disabled={isAdding}
                                            data-testid='new-domain-input'
                                        />
                                        <div class='flex justify-end gap-2'>
                                            <Button
                                                onClick={() => {
                                                    setShowAddForm(false);
                                                    setNewDomain('');
                                                }}
                                                variant='secondary'
                                                disabled={isAdding}
                                                data-testid='cancel-domain-button'
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                onClick={handleAddDomain}
                                                disabled={!newDomain.trim() || isAdding}
                                                loading={isAdding}
                                                data-testid='submit-domain-button'
                                            >
                                                {isAdding ? 'Adding...' : 'Add Domain'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Domain List */}
                            {domains && (
                                <div class='space-y-3' data-testid='domain-list'>
                                    {domains.domains.map((domain) => (
                                        <div
                                            key={domain}
                                            data-testid={`domain-item-${domain}`}
                                            class='flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3'
                                        >
                                            <div class='flex items-center gap-3'>
                                                <svg
                                                    class='h-5 w-5 text-slate-400'
                                                    fill='none'
                                                    viewBox='0 0 24 24'
                                                    stroke='currentColor'
                                                >
                                                    <path
                                                        stroke-linecap='round'
                                                        stroke-linejoin='round'
                                                        stroke-width='2'
                                                        d='M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9'
                                                    />
                                                </svg>
                                                <div>
                                                    <p class='font-medium text-slate-900'>{domain}</p>
                                                    {domain === domains.primaryDomain && (
                                                        <span
                                                            class='mt-1 inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700'
                                                            data-testid='primary-domain-badge'
                                                        >
                                                            Primary Domain
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* DNS Instructions */}
                    <Card padding='lg'>
                        <div class='space-y-6'>
                            <div class='space-y-2'>
                                <h2 class='text-xl font-semibold text-slate-900'>DNS Configuration</h2>
                                <p class='text-sm text-slate-600'>
                                    Add these DNS records to verify domain ownership
                                </p>
                            </div>

                            <div
                                class='rounded-lg border border-slate-200 bg-slate-50 p-4'
                                data-testid='dns-instructions'
                            >
                                <div class='space-y-4'>
                                    <div class='space-y-2'>
                                        <p class='text-sm font-medium text-slate-700'>CNAME Record</p>
                                        <div class='rounded bg-white px-3 py-2 font-mono text-sm text-slate-900'>
                                            <div class='space-y-1'>
                                                <div><span class='text-slate-500'>Type:</span> CNAME</div>
                                                <div><span class='text-slate-500'>Name:</span> @ (or your domain)</div>
                                                <div><span class='text-slate-500'>Value:</span> {domains?.primaryDomain || 'your-primary-domain'}</div>
                                                <div><span class='text-slate-500'>TTL:</span> 3600</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class='flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800'>
                                        <svg
                                            class='h-5 w-5 flex-shrink-0'
                                            fill='none'
                                            viewBox='0 0 24 24'
                                            stroke='currentColor'
                                        >
                                            <path
                                                stroke-linecap='round'
                                                stroke-linejoin='round'
                                                stroke-width='2'
                                                d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                                            />
                                        </svg>
                                        <p>Domain verification may take up to 24 hours after DNS records are added.</p>
                                    </div>

                                    <Button
                                        onClick={handleCopyDnsInstructions}
                                        variant='secondary'
                                        data-testid='copy-dns-button'
                                        className='w-full sm:w-auto'
                                    >
                                        {copiedDns ? 'Copied!' : 'Copy DNS Instructions'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </BaseLayout>
    );
}
