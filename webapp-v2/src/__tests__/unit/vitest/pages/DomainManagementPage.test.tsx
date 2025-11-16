import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { SystemUserRoles } from '@splitifyd/shared';
import type { TenantDomainsResponse } from '@splitifyd/shared';
import type { ComponentChildren } from 'preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('@/components/layout/BaseLayout', () => ({
    BaseLayout: ({ children }: { children: ComponentChildren }) => <div data-testid='base-layout'>{children}</div>,
}));

vi.mock('@/app/hooks/useAuthRequired', () => ({
    useAuthRequired: vi.fn(),
}));

vi.mock('@/app/apiClient', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/app/apiClient')>();
    return {
        ...actual,
        apiClient: {
            getTenantDomains: vi.fn(),
            addTenantDomain: vi.fn(),
        },
    };
});

const { useAuthRequired } = await import('@/app/hooks/useAuthRequired');
const { apiClient } = await import('@/app/apiClient');
const { DomainManagementPage } = await import('@/pages/DomainManagementPage');

const mockedUseAuthRequired = vi.mocked(useAuthRequired);
const mockedApiClient = vi.mocked(apiClient);

const mockDomainsResponse: TenantDomainsResponse = {
    domains: ['localhost' as any, 'example.com' as any, 'app.example.com' as any],
    primaryDomain: 'localhost' as any,
};

const mockTenantAdminUser = {
    uid: 'admin-123',
    email: 'admin@test.com',
    displayName: 'Tenant Admin',
    role: SystemUserRoles.TENANT_ADMIN,
};

const mockRegularUser = {
    uid: 'user-123',
    email: 'user@test.com',
    displayName: 'Regular User',
    role: SystemUserRoles.SYSTEM_USER,
};

describe('DomainManagementPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Access Control', () => {
        it('should deny access to regular users', async () => {
            mockedUseAuthRequired.mockReturnValue({
                user: mockRegularUser,
                initialized: true,
            } as any);

            render(<DomainManagementPage />);

            await waitFor(() => {
                expect(screen.getByText(/you do not have permission/i)).toBeInTheDocument();
            });

            expect(mockedApiClient.getTenantDomains).not.toHaveBeenCalled();
        });

        it('should allow access to tenant admins', async () => {
            mockedUseAuthRequired.mockReturnValue({
                user: mockTenantAdminUser,
                initialized: true,
            } as any);

            mockedApiClient.getTenantDomains.mockResolvedValueOnce(mockDomainsResponse);

            render(<DomainManagementPage />);

            await waitFor(() => {
                expect(screen.getByText('Domain Management')).toBeInTheDocument();
            });

            expect(mockedApiClient.getTenantDomains).toHaveBeenCalledOnce();
        });

        it('should allow access to system admins', async () => {
            mockedUseAuthRequired.mockReturnValue({
                user: { ...mockTenantAdminUser, role: SystemUserRoles.SYSTEM_ADMIN },
                initialized: true,
            } as any);

            mockedApiClient.getTenantDomains.mockResolvedValueOnce(mockDomainsResponse);

            render(<DomainManagementPage />);

            await waitFor(() => {
                expect(screen.getByText('Domain Management')).toBeInTheDocument();
            });

            expect(mockedApiClient.getTenantDomains).toHaveBeenCalledOnce();
        });
    });

    describe('Loading State', () => {
        it('should show loading spinner while fetching domains', async () => {
            mockedUseAuthRequired.mockReturnValue({
                user: mockTenantAdminUser,
                initialized: true,
            } as any);

            mockedApiClient.getTenantDomains.mockImplementation(
                () => new Promise((resolve) => setTimeout(() => resolve(mockDomainsResponse), 100)),
            );

            render(<DomainManagementPage />);

            expect(screen.getByText(/loading domain settings/i)).toBeInTheDocument();

            await waitFor(() => {
                expect(screen.getByText('Domain Management')).toBeInTheDocument();
            });
        });

        it('should show error message if loading fails', async () => {
            mockedUseAuthRequired.mockReturnValue({
                user: mockTenantAdminUser,
                initialized: true,
            } as any);

            mockedApiClient.getTenantDomains.mockRejectedValueOnce(new Error('Network error'));

            render(<DomainManagementPage />);

            await waitFor(() => {
                expect(screen.getByText(/network error/i)).toBeInTheDocument();
            });
        });
    });

    describe('Domain List', () => {
        beforeEach(() => {
            mockedUseAuthRequired.mockReturnValue({
                user: mockTenantAdminUser,
                initialized: true,
            } as any);

            mockedApiClient.getTenantDomains.mockResolvedValue(mockDomainsResponse);
        });

        it('should display all domains', async () => {
            render(<DomainManagementPage />);

            await waitFor(() => {
                expect(screen.getByTestId('domain-list')).toBeInTheDocument();
            });

            expect(screen.getByTestId('domain-item-localhost')).toBeInTheDocument();
            expect(screen.getByTestId('domain-item-example.com')).toBeInTheDocument();
            expect(screen.getByTestId('domain-item-app.example.com')).toBeInTheDocument();
        });

        it('should mark primary domain with badge', async () => {
            render(<DomainManagementPage />);

            await waitFor(() => {
                expect(screen.getByTestId('domain-item-localhost')).toBeInTheDocument();
            });

            const localhostItem = screen.getByTestId('domain-item-localhost');
            expect(localhostItem.querySelector('[data-testid="primary-domain-badge"]')).toBeInTheDocument();
        });

        it('should not mark non-primary domains with badge', async () => {
            render(<DomainManagementPage />);

            await waitFor(() => {
                expect(screen.getByTestId('domain-item-example.com')).toBeInTheDocument();
            });

            const exampleItem = screen.getByTestId('domain-item-example.com');
            expect(exampleItem.querySelector('[data-testid="primary-domain-badge"]')).not.toBeInTheDocument();
        });
    });

    describe('Add Domain Form', () => {
        beforeEach(() => {
            mockedUseAuthRequired.mockReturnValue({
                user: mockTenantAdminUser,
                initialized: true,
            } as any);

            mockedApiClient.getTenantDomains.mockResolvedValue(mockDomainsResponse);
        });

        it('should show form when add domain button is clicked', async () => {
            render(<DomainManagementPage />);

            await waitFor(() => {
                expect(screen.getByTestId('add-domain-button')).toBeInTheDocument();
            });

            // Form should not be visible initially
            expect(screen.queryByTestId('new-domain-input')).not.toBeInTheDocument();

            // Click add domain button
            const addButton = screen.getByTestId('add-domain-button');
            fireEvent.click(addButton);

            // Form should now be visible
            await waitFor(() => {
                expect(screen.getByTestId('new-domain-input')).toBeInTheDocument();
            });
        });

        it('should hide form when cancel button is clicked', async () => {
            render(<DomainManagementPage />);

            await waitFor(() => {
                expect(screen.getByTestId('add-domain-button')).toBeInTheDocument();
            });

            // Show form
            fireEvent.click(screen.getByTestId('add-domain-button'));

            await waitFor(() => {
                expect(screen.getByTestId('new-domain-input')).toBeInTheDocument();
            });

            // Click cancel
            const cancelButton = screen.getByTestId('cancel-domain-button');
            fireEvent.click(cancelButton);

            // Form should be hidden
            await waitFor(() => {
                expect(screen.queryByTestId('new-domain-input')).not.toBeInTheDocument();
            });
        });

        it('should disable submit button when input is empty', async () => {
            render(<DomainManagementPage />);

            await waitFor(() => {
                expect(screen.getByTestId('add-domain-button')).toBeInTheDocument();
            });

            // Show form
            fireEvent.click(screen.getByTestId('add-domain-button'));

            await waitFor(() => {
                expect(screen.getByTestId('submit-domain-button')).toBeInTheDocument();
            });

            // Submit button should be disabled
            const submitButton = screen.getByTestId('submit-domain-button');
            expect(submitButton).toBeDisabled();
        });

        it('should enable submit button when input has value', async () => {
            render(<DomainManagementPage />);

            await waitFor(() => {
                expect(screen.getByTestId('add-domain-button')).toBeInTheDocument();
            });

            // Show form
            fireEvent.click(screen.getByTestId('add-domain-button'));

            await waitFor(() => {
                expect(screen.getByTestId('new-domain-input')).toBeInTheDocument();
            });

            // Enter domain
            const input = screen.getByTestId('new-domain-input');
            fireEvent.input(input, { target: { value: 'newdomain.com' } });

            // Submit button should be enabled
            const submitButton = screen.getByTestId('submit-domain-button');
            await waitFor(() => {
                expect(submitButton).toBeEnabled();
            });
        });
    });

    describe('Domain Addition', () => {
        beforeEach(() => {
            mockedUseAuthRequired.mockReturnValue({
                user: mockTenantAdminUser,
                initialized: true,
            } as any);

            mockedApiClient.getTenantDomains.mockResolvedValue(mockDomainsResponse);
        });

        it('should call API when adding a domain', async () => {
            mockedApiClient.addTenantDomain.mockResolvedValueOnce({ message: 'Success' });

            render(<DomainManagementPage />);

            await waitFor(() => {
                expect(screen.getByTestId('add-domain-button')).toBeInTheDocument();
            });

            // Show form and enter domain
            fireEvent.click(screen.getByTestId('add-domain-button'));

            await waitFor(() => {
                expect(screen.getByTestId('new-domain-input')).toBeInTheDocument();
            });

            const input = screen.getByTestId('new-domain-input');
            fireEvent.input(input, { target: { value: 'newdomain.com' } });

            // Click submit
            const submitButton = screen.getByTestId('submit-domain-button');
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(mockedApiClient.addTenantDomain).toHaveBeenCalledWith(
                    expect.objectContaining({
                        domain: 'newdomain.com',
                    }),
                );
            });
        });

        it('should show success message after adding domain', async () => {
            mockedApiClient.addTenantDomain.mockResolvedValueOnce({ message: 'Success' });

            render(<DomainManagementPage />);

            await waitFor(() => {
                expect(screen.getByTestId('add-domain-button')).toBeInTheDocument();
            });

            // Add domain
            fireEvent.click(screen.getByTestId('add-domain-button'));

            await waitFor(() => {
                expect(screen.getByTestId('new-domain-input')).toBeInTheDocument();
            });

            fireEvent.input(screen.getByTestId('new-domain-input'), { target: { value: 'newdomain.com' } });
            fireEvent.click(screen.getByTestId('submit-domain-button'));

            await waitFor(() => {
                expect(screen.getByText(/domain.*added successfully/i)).toBeInTheDocument();
            });
        });

        it('should show not implemented message for 501 errors', async () => {
            const notImplementedError = new Error('Not implemented');
            (notImplementedError as any).code = 'NOT_IMPLEMENTED';
            mockedApiClient.addTenantDomain.mockRejectedValueOnce(notImplementedError);

            render(<DomainManagementPage />);

            await waitFor(() => {
                expect(screen.getByTestId('add-domain-button')).toBeInTheDocument();
            });

            // Add domain
            fireEvent.click(screen.getByTestId('add-domain-button'));

            await waitFor(() => {
                expect(screen.getByTestId('new-domain-input')).toBeInTheDocument();
            });

            fireEvent.input(screen.getByTestId('new-domain-input'), { target: { value: 'newdomain.com' } });
            fireEvent.click(screen.getByTestId('submit-domain-button'));

            await waitFor(() => {
                expect(screen.getByText(/domain addition not yet implemented/i)).toBeInTheDocument();
            });
        });

        it('should reload domains after successful addition', async () => {
            mockedApiClient.addTenantDomain.mockResolvedValueOnce({ message: 'Success' });

            render(<DomainManagementPage />);

            await waitFor(() => {
                expect(screen.getByTestId('add-domain-button')).toBeInTheDocument();
            });

            // Clear initial call
            mockedApiClient.getTenantDomains.mockClear();

            // Add domain
            fireEvent.click(screen.getByTestId('add-domain-button'));

            await waitFor(() => {
                expect(screen.getByTestId('new-domain-input')).toBeInTheDocument();
            });

            fireEvent.input(screen.getByTestId('new-domain-input'), { target: { value: 'newdomain.com' } });
            fireEvent.click(screen.getByTestId('submit-domain-button'));

            // Should reload domains
            await waitFor(() => {
                expect(mockedApiClient.getTenantDomains).toHaveBeenCalledOnce();
            });
        });
    });

    describe('DNS Instructions', () => {
        beforeEach(() => {
            mockedUseAuthRequired.mockReturnValue({
                user: mockTenantAdminUser,
                initialized: true,
            } as any);

            mockedApiClient.getTenantDomains.mockResolvedValue(mockDomainsResponse);
        });

        it('should display DNS instructions', async () => {
            render(<DomainManagementPage />);

            await waitFor(() => {
                expect(screen.getByTestId('dns-instructions')).toBeInTheDocument();
            });

            // Should show CNAME record details
            expect(screen.getAllByText(/CNAME/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/localhost/i).length).toBeGreaterThan(0); // primary domain appears in list and DNS instructions
        });

        it('should have copy button', async () => {
            render(<DomainManagementPage />);

            await waitFor(() => {
                expect(screen.getByTestId('copy-dns-button')).toBeInTheDocument();
            });
        });
    });
});
