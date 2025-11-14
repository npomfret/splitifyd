import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { SystemUserRoles } from '@splitifyd/shared';
import type { TenantSettingsResponse } from '@splitifyd/shared';
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
            getTenantSettings: vi.fn(),
            updateTenantBranding: vi.fn(),
        },
    };
});

const { useAuthRequired } = await import('@/app/hooks/useAuthRequired');
const { apiClient } = await import('@/app/apiClient');
const { TenantBrandingPage } = await import('@/pages/TenantBrandingPage');

const mockedUseAuthRequired = vi.mocked(useAuthRequired);
const mockedApiClient = vi.mocked(apiClient);

const mockTenantSettings: TenantSettingsResponse = {
    tenantId: 'test-tenant' as any,
    config: {
        tenantId: 'test-tenant' as any,
        branding: {
            appName: 'Test App' as any,
            logoUrl: '/logo.svg' as any,
            faviconUrl: '/favicon.ico' as any,
            primaryColor: '#1a73e8' as any,
            secondaryColor: '#34a853' as any,
            marketingFlags: {
                showLandingPage: true as any,
                showMarketingContent: true as any,
                showPricingPage: false as any,
            },
        },
        features: {
            enableAdvancedReporting: true as any,
            enableMultiCurrency: false as any,
            enableCustomFields: false as any,
            maxGroupsPerUser: 100 as any,
            maxUsersPerGroup: 200 as any,
        },
        createdAt: '2025-01-01T00:00:00.000Z' as any,
        updatedAt: '2025-01-01T00:00:00.000Z' as any,
    },
    domains: ['localhost' as any],
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

describe('TenantBrandingPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Access Control', () => {
        it('should deny access to regular users', async () => {
            mockedUseAuthRequired.mockReturnValue({
                user: mockRegularUser,
                initialized: true,
            } as any);

            render(<TenantBrandingPage />);

            await waitFor(() => {
                expect(screen.getByText(/you do not have permission/i)).toBeInTheDocument();
            });

            expect(mockedApiClient.getTenantSettings).not.toHaveBeenCalled();
        });

        it('should allow access to tenant admins', async () => {
            mockedUseAuthRequired.mockReturnValue({
                user: mockTenantAdminUser,
                initialized: true,
            } as any);

            mockedApiClient.getTenantSettings.mockResolvedValueOnce(mockTenantSettings);

            render(<TenantBrandingPage />);

            await waitFor(() => {
                expect(screen.getByText('Branding Configuration')).toBeInTheDocument();
            });

            expect(mockedApiClient.getTenantSettings).toHaveBeenCalledOnce();
        });

        it('should allow access to system admins', async () => {
            mockedUseAuthRequired.mockReturnValue({
                user: { ...mockTenantAdminUser, role: SystemUserRoles.SYSTEM_ADMIN },
                initialized: true,
            } as any);

            mockedApiClient.getTenantSettings.mockResolvedValueOnce(mockTenantSettings);

            render(<TenantBrandingPage />);

            await waitFor(() => {
                expect(screen.getByText('Branding Configuration')).toBeInTheDocument();
            });

            expect(mockedApiClient.getTenantSettings).toHaveBeenCalledOnce();
        });
    });

    describe('Loading State', () => {
        it('should show loading spinner while fetching settings', async () => {
            mockedUseAuthRequired.mockReturnValue({
                user: mockTenantAdminUser,
                initialized: true,
            } as any);

            mockedApiClient.getTenantSettings.mockImplementation(
                () => new Promise((resolve) => setTimeout(() => resolve(mockTenantSettings), 100)),
            );

            render(<TenantBrandingPage />);

            expect(screen.getByText(/loading tenant settings/i)).toBeInTheDocument();

            await waitFor(() => {
                expect(screen.getByText('Branding Configuration')).toBeInTheDocument();
            });
        });

        it('should show error message if loading fails', async () => {
            mockedUseAuthRequired.mockReturnValue({
                user: mockTenantAdminUser,
                initialized: true,
            } as any);

            mockedApiClient.getTenantSettings.mockRejectedValueOnce(new Error('Network error'));

            render(<TenantBrandingPage />);

            await waitFor(() => {
                expect(screen.getByText(/network error/i)).toBeInTheDocument();
            });
        });
    });

    describe('Form Population', () => {
        beforeEach(() => {
            mockedUseAuthRequired.mockReturnValue({
                user: mockTenantAdminUser,
                initialized: true,
            } as any);

            mockedApiClient.getTenantSettings.mockResolvedValue(mockTenantSettings);
        });

        it('should populate form fields with current tenant settings', async () => {
            render(<TenantBrandingPage />);

            await waitFor(() => {
                expect(screen.getByDisplayValue('Test App')).toBeInTheDocument();
            });

            expect(screen.getByDisplayValue('/logo.svg')).toBeInTheDocument();
            expect(screen.getByDisplayValue('/favicon.ico')).toBeInTheDocument();
            expect(screen.getByDisplayValue('#1a73e8')).toBeInTheDocument();
            expect(screen.getByDisplayValue('#34a853')).toBeInTheDocument();
        });

        it('should populate marketing flags correctly', async () => {
            render(<TenantBrandingPage />);

            await waitFor(() => {
                const showLandingPageCheckbox = screen.getByTestId('show-landing-page-checkbox') as HTMLInputElement;
                expect(showLandingPageCheckbox.checked).toBe(true);
            });

            const showMarketingContentCheckbox = screen.getByTestId('show-marketing-content-checkbox') as HTMLInputElement;
            expect(showMarketingContentCheckbox.checked).toBe(true);

            const showPricingPageCheckbox = screen.getByTestId('show-pricing-page-checkbox') as HTMLInputElement;
            expect(showPricingPageCheckbox.checked).toBe(false);
        });

        it('should display tenant ID in info card', async () => {
            render(<TenantBrandingPage />);

            await waitFor(() => {
                expect(screen.getByText(/tenant id: test-tenant/i)).toBeInTheDocument();
            });
        });
    });

    describe('Form Interactions', () => {
        beforeEach(() => {
            mockedUseAuthRequired.mockReturnValue({
                user: mockTenantAdminUser,
                initialized: true,
            } as any);

            mockedApiClient.getTenantSettings.mockResolvedValue(mockTenantSettings);
        });

        it('should enable save button when changes are made', async () => {
            render(<TenantBrandingPage />);

            await waitFor(() => {
                expect(screen.getByTestId('save-branding-button')).toBeDisabled();
            });

            const appNameInput = screen.getByTestId('app-name-input');
            fireEvent.input(appNameInput, { target: { value: 'Updated App Name' } });

            await waitFor(() => {
                expect(screen.getByTestId('save-branding-button')).toBeEnabled();
            });
        });

        it('should update color pickers', async () => {
            render(<TenantBrandingPage />);

            await waitFor(() => {
                expect(screen.getByDisplayValue('#1a73e8')).toBeInTheDocument();
            });

            const primaryColorInput = screen.getByTestId('primary-color-input') as HTMLInputElement;
            fireEvent.input(primaryColorInput, { target: { value: '#ff0000' } });

            expect(primaryColorInput.value).toBe('#ff0000');
        });

        it('should toggle marketing flags', async () => {
            render(<TenantBrandingPage />);

            await waitFor(() => {
                const checkbox = screen.getByTestId('show-pricing-page-checkbox') as HTMLInputElement;
                expect(checkbox.checked).toBe(false);
            });

            const checkbox = screen.getByTestId('show-pricing-page-checkbox');
            fireEvent.click(checkbox);

            expect((checkbox as HTMLInputElement).checked).toBe(true);
        });
    });

    describe('Form Submission', () => {
        beforeEach(() => {
            mockedUseAuthRequired.mockReturnValue({
                user: mockTenantAdminUser,
                initialized: true,
            } as any);

            mockedApiClient.getTenantSettings.mockResolvedValue(mockTenantSettings);
        });

        it('should call updateTenantBranding with correct data when saved', async () => {
            mockedApiClient.updateTenantBranding.mockResolvedValueOnce({ message: 'Success' });

            render(<TenantBrandingPage />);

            await waitFor(() => {
                expect(screen.getByTestId('save-branding-button')).toBeInTheDocument();
            });

            // Make a change
            const appNameInput = screen.getByTestId('app-name-input');
            fireEvent.input(appNameInput, { target: { value: 'New App Name' } });

            // Click save
            const saveButton = screen.getByTestId('save-branding-button');
            fireEvent.click(saveButton);

            await waitFor(() => {
                expect(mockedApiClient.updateTenantBranding).toHaveBeenCalledWith(
                    expect.objectContaining({
                        appName: 'New App Name',
                    }),
                );
            });
        });

        it('should show success message after successful save', async () => {
            mockedApiClient.updateTenantBranding.mockResolvedValueOnce({ message: 'Success' });

            render(<TenantBrandingPage />);

            await waitFor(() => {
                expect(screen.getByTestId('app-name-input')).toBeInTheDocument();
            });

            const appNameInput = screen.getByTestId('app-name-input');
            fireEvent.input(appNameInput, { target: { value: 'New Name' } });

            const saveButton = screen.getByTestId('save-branding-button');
            fireEvent.click(saveButton);

            await waitFor(() => {
                expect(screen.getByText(/branding settings updated successfully/i)).toBeInTheDocument();
            });
        });

        it('should show not implemented message for 501 errors', async () => {
            const notImplementedError = new Error('Not implemented');
            (notImplementedError as any).code = 'NOT_IMPLEMENTED';
            mockedApiClient.updateTenantBranding.mockRejectedValueOnce(notImplementedError);

            render(<TenantBrandingPage />);

            await waitFor(() => {
                expect(screen.getByTestId('app-name-input')).toBeInTheDocument();
            });

            const appNameInput = screen.getByTestId('app-name-input');
            fireEvent.input(appNameInput, { target: { value: 'New Name' } });

            const saveButton = screen.getByTestId('save-branding-button');
            fireEvent.click(saveButton);

            await waitFor(() => {
                expect(screen.getByText(/branding update not yet implemented/i)).toBeInTheDocument();
            });
        });

        it('should show generic error message for other errors', async () => {
            mockedApiClient.updateTenantBranding.mockRejectedValueOnce(new Error('Server error'));

            render(<TenantBrandingPage />);

            await waitFor(() => {
                expect(screen.getByTestId('app-name-input')).toBeInTheDocument();
            });

            const appNameInput = screen.getByTestId('app-name-input');
            fireEvent.input(appNameInput, { target: { value: 'New Name' } });

            const saveButton = screen.getByTestId('save-branding-button');
            fireEvent.click(saveButton);

            await waitFor(() => {
                expect(screen.getByText(/server error/i)).toBeInTheDocument();
            });
        });

        it('should call API when save button is clicked', async () => {
            mockedApiClient.updateTenantBranding.mockResolvedValueOnce({ message: 'Success' });

            render(<TenantBrandingPage />);

            await waitFor(() => {
                expect(screen.getByTestId('app-name-input')).toBeInTheDocument();
            });

            const appNameInput = screen.getByTestId('app-name-input');
            fireEvent.input(appNameInput, { target: { value: 'New Name' } });

            const saveButton = screen.getByTestId('save-branding-button');
            expect(saveButton).toBeEnabled();

            fireEvent.click(saveButton);

            await waitFor(() => {
                expect(mockedApiClient.updateTenantBranding).toHaveBeenCalled();
            });
        });
    });

    describe('Live Preview', () => {
        beforeEach(() => {
            mockedUseAuthRequired.mockReturnValue({
                user: mockTenantAdminUser,
                initialized: true,
            } as any);

            mockedApiClient.getTenantSettings.mockResolvedValue(mockTenantSettings);
        });

        it('should show app name in preview panel', async () => {
            render(<TenantBrandingPage />);

            await waitFor(() => {
                // Preview shows the app name
                const previewElements = screen.getAllByText('Test App');
                expect(previewElements.length).toBeGreaterThan(0);
            });
        });

        it('should update preview when app name changes', async () => {
            render(<TenantBrandingPage />);

            await waitFor(() => {
                expect(screen.getByTestId('app-name-input')).toBeInTheDocument();
            });

            const appNameInput = screen.getByTestId('app-name-input');
            fireEvent.input(appNameInput, { target: { value: 'Updated Name' } });

            await waitFor(() => {
                expect(screen.getByText('Updated Name')).toBeInTheDocument();
            });
        });
    });
});
