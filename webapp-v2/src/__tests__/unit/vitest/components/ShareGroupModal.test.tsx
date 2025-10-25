import { ShareGroupModal } from '@/components/group/ShareGroupModal';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/app/apiClient.ts', () => ({
    apiClient: {
        generateShareLink: vi.fn(),
    },
}));

vi.mock('@/utils/browser-logger.ts', () => ({
    logError: vi.fn(),
}));

vi.mock('qrcode.react', () => ({
    QRCodeCanvas: () => <div data-testid='qr-code' />,
}));

// Create a stable mock translation function to prevent infinite re-renders
const mockTranslate = vi.fn((key: string) => key);

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: mockTranslate,
        i18n: { language: 'en' },
    }),
}));

vi.mock('@/utils/dateUtils.ts', () => ({
    formatDateTimeInUserTimeZone: (isoString: string) => `Formatted: ${isoString}`,
}));

import { apiClient } from '@/app/apiClient';

const mockedApiClient = apiClient as unknown as {
    generateShareLink: Mock;
};

// Test constants to avoid magic numbers
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

describe('ShareGroupModal', () => {
    beforeEach(() => {
        mockedApiClient.generateShareLink.mockReset();

        // Mock clipboard API
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        });
    });

    it('fetches a link when opened and displays the current group name', async () => {
        const defaultExpiresAt = new Date(Date.now() + ONE_DAY_MS).toISOString();
        mockedApiClient.generateShareLink.mockResolvedValue({ shareablePath: '/share/group-1', expiresAt: defaultExpiresAt });

        render(
            <ShareGroupModal
                isOpen={true}
                onClose={() => {}}
                groupId='group-1'
                groupName='Design Guild'
            />,
        );

        await waitFor(() => expect(mockedApiClient.generateShareLink).toHaveBeenCalled());
        const [calledGroupId, calledExpiresAt] = mockedApiClient.generateShareLink.mock.calls[0];
        expect(calledGroupId).toBe('group-1');

        // Verify expiration is approximately 1 day from now (default)
        const expectedExpiryMs = Date.now() + ONE_DAY_MS;
        const actualExpiryMs = new Date(calledExpiresAt).getTime();
        expect(actualExpiryMs).toBeGreaterThan(Date.now());
        expect(actualExpiryMs).toBeLessThan(expectedExpiryMs + 5000); // Allow 5s drift
        expect(actualExpiryMs).toBeGreaterThan(expectedExpiryMs - 5000);

        const linkInput = await screen.findByTestId('share-link-input');
        const origin = window.location.origin;
        await waitFor(() => expect(linkInput).toHaveValue(`${origin}/share/group-1`));
        expect(screen.getByTestId('share-group-name')).toHaveTextContent('Design Guild');
        expect(await screen.findByTestId('share-link-expiration-hint')).toBeInTheDocument();
    });

    it('regenerates the share link when the group changes while open', async () => {
        mockedApiClient
            .generateShareLink
            .mockResolvedValueOnce({ shareablePath: '/share/group-1', expiresAt: new Date(Date.now() + ONE_DAY_MS).toISOString() })
            .mockResolvedValueOnce({ shareablePath: '/share/group-2', expiresAt: new Date(Date.now() + ONE_DAY_MS).toISOString() });

        const { rerender } = render(
            <ShareGroupModal
                isOpen={true}
                onClose={() => {}}
                groupId='group-1'
                groupName='Design Guild'
            />,
        );

        const linkInput = await screen.findByTestId('share-link-input');
        const origin = window.location.origin;
        await waitFor(() => expect(linkInput).toHaveValue(`${origin}/share/group-1`));

        rerender(
            <ShareGroupModal
                isOpen={true}
                onClose={() => {}}
                groupId='group-2'
                groupName='Product Crew'
            />,
        );

        await waitFor(() => {
            const calls = mockedApiClient.generateShareLink.mock.calls;
            const lastCall = calls[calls.length - 1];
            expect(lastCall?.[0]).toBe('group-2');
            expect(new Date(lastCall?.[1] as string).getTime()).toBeGreaterThan(Date.now());
        });
        const updatedInput = await screen.findByTestId('share-link-input');
        await waitFor(() => expect(updatedInput).toHaveValue(`${origin}/share/group-2`));
        expect(screen.getByTestId('share-group-name')).toHaveTextContent('Product Crew');
        expect(updatedInput).not.toHaveValue(`${origin}/share/group-1`);
    });

    it('requests a new link when the expiration option changes', async () => {
        const firstExpiresAt = new Date(Date.now() + ONE_DAY_MS).toISOString();
        const secondExpiresAt = new Date(Date.now() + ONE_HOUR_MS).toISOString();

        mockedApiClient
            .generateShareLink
            .mockResolvedValueOnce({ shareablePath: '/share/group-1', expiresAt: firstExpiresAt })
            .mockResolvedValueOnce({ shareablePath: '/share/group-1-refresh', expiresAt: secondExpiresAt });

        render(
            <ShareGroupModal
                isOpen={true}
                onClose={() => {}}
                groupId='group-1'
                groupName='Design Guild'
            />,
        );

        // Wait for first link to be generated
        await screen.findByTestId('share-link-input');
        const firstCallCount = mockedApiClient.generateShareLink.mock.calls.length;

        // Verify expiration buttons are rendered with expected defaults
        const buttons = ['15m', '1h', '1d', '5d'].map((id) => screen.getByTestId(`share-link-expiration-${id}`));
        expect(buttons).toHaveLength(4);
        expect(screen.getByTestId('share-link-expiration-1d')).toHaveAttribute('aria-pressed', 'true');

        // Verify first call requested ~1 day expiration (default)
        const firstCall = mockedApiClient.generateShareLink.mock.calls[0];
        const firstCallExpiryMs = new Date(firstCall[1]).getTime();
        const expectedFirstMs = Date.now() + ONE_DAY_MS;
        expect(firstCallExpiryMs).toBeGreaterThan(expectedFirstMs - 5000);
        expect(firstCallExpiryMs).toBeLessThan(expectedFirstMs + 5000);

        // Change the selection to 1 hour and ensure a new link is requested
        const oneHourButton = screen.getByTestId('share-link-expiration-1h');
        await act(() => {
            fireEvent.click(oneHourButton);
        });

        await waitFor(() => expect(mockedApiClient.generateShareLink).toHaveBeenCalledTimes(firstCallCount + 1));
        const secondCall = mockedApiClient.generateShareLink.mock.calls[firstCallCount];
        const secondCallExpiryMs = new Date(secondCall[1]).getTime();
        const expectedSecondMs = Date.now() + ONE_HOUR_MS;
        expect(secondCallExpiryMs).toBeGreaterThan(expectedSecondMs - 5000);
        expect(secondCallExpiryMs).toBeLessThan(expectedSecondMs + 5000);
        expect(oneHourButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('displays loading state while generating link', async () => {
        let resolvePromise: (value: any) => void;
        const promise = new Promise((resolve) => {
            resolvePromise = resolve;
        });
        mockedApiClient.generateShareLink.mockReturnValue(promise);

        render(
            <ShareGroupModal
                isOpen={true}
                onClose={() => {}}
                groupId='group-1'
                groupName='Test Group'
            />,
        );

        // Loading spinner should be visible
        const spinner = screen.getByRole('presentation').querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();

        // Link input should not be visible yet
        expect(screen.queryByTestId('share-link-input')).not.toBeInTheDocument();

        // Resolve the promise
        resolvePromise!({
            shareablePath: '/share/group-1',
            expiresAt: new Date(Date.now() + ONE_DAY_MS).toISOString(),
        });

        // Loading should disappear and link should appear
        await waitFor(() => {
            expect(screen.queryByRole('presentation')?.querySelector('.animate-spin')).not.toBeInTheDocument();
        });
        await screen.findByTestId('share-link-input');
    });

    it('displays error message when link generation fails', async () => {
        mockedApiClient.generateShareLink.mockRejectedValue(new Error('Network error'));

        render(
            <ShareGroupModal
                isOpen={true}
                onClose={() => {}}
                groupId='group-1'
                groupName='Test Group'
            />,
        );

        const errorElement = await screen.findByTestId('share-group-error-message');
        expect(errorElement).toHaveTextContent('shareGroupModal.errors.generateLinkFailed');
        expect(errorElement).toHaveAttribute('role', 'alert');

        // Link input should not be visible on error
        expect(screen.queryByTestId('share-link-input')).not.toBeInTheDocument();
    });

    it('copies link to clipboard when copy button is clicked', async () => {
        const writeTextMock = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, {
            clipboard: { writeText: writeTextMock },
        });

        mockedApiClient.generateShareLink.mockResolvedValue({
            shareablePath: '/share/group-1',
            expiresAt: new Date(Date.now() + ONE_DAY_MS).toISOString(),
        });

        render(
            <ShareGroupModal
                isOpen={true}
                onClose={() => {}}
                groupId='group-1'
                groupName='Test Group'
            />,
        );

        const copyButton = await screen.findByTestId('copy-link-button');
        fireEvent.click(copyButton);

        await waitFor(() => {
            expect(writeTextMock).toHaveBeenCalledWith(`${window.location.origin}/share/group-1`);
        });

        // Check icon should appear (indicates copied state)
        const checkIcon = copyButton.querySelector('svg path[d*="M5 13l4 4L19 7"]');
        expect(checkIcon).toBeInTheDocument();
    });

    it('calls onClose when escape key is pressed', async () => {
        const onClose = vi.fn();
        mockedApiClient.generateShareLink.mockResolvedValue({
            shareablePath: '/share/group-1',
            expiresAt: new Date(Date.now() + ONE_DAY_MS).toISOString(),
        });

        render(
            <ShareGroupModal
                isOpen={true}
                onClose={onClose}
                groupId='group-1'
                groupName='Test Group'
            />,
        );

        await screen.findByTestId('share-link-input');

        fireEvent.keyDown(window, { key: 'Escape' });

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when close button is clicked', async () => {
        const onClose = vi.fn();
        mockedApiClient.generateShareLink.mockResolvedValue({
            shareablePath: '/share/group-1',
            expiresAt: new Date(Date.now() + ONE_DAY_MS).toISOString(),
        });

        render(
            <ShareGroupModal
                isOpen={true}
                onClose={onClose}
                groupId='group-1'
                groupName='Test Group'
            />,
        );

        const closeButton = await screen.findByTestId('close-share-modal-button');
        fireEvent.click(closeButton);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('displays QR code when link is generated', async () => {
        mockedApiClient.generateShareLink.mockResolvedValue({
            shareablePath: '/share/group-1',
            expiresAt: new Date(Date.now() + ONE_DAY_MS).toISOString(),
        });

        render(
            <ShareGroupModal
                isOpen={true}
                onClose={() => {}}
                groupId='group-1'
                groupName='Test Group'
            />,
        );

        const qrCode = await screen.findByTestId('qr-code');
        expect(qrCode).toBeInTheDocument();
    });

    it('does not display QR code or link input while loading', async () => {
        let resolvePromise: (value: any) => void;
        const promise = new Promise((resolve) => {
            resolvePromise = resolve;
        });
        mockedApiClient.generateShareLink.mockReturnValue(promise);

        render(
            <ShareGroupModal
                isOpen={true}
                onClose={() => {}}
                groupId='group-1'
                groupName='Test Group'
            />,
        );

        // QR code and link input should not be visible during loading
        expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument();
        expect(screen.queryByTestId('share-link-input')).not.toBeInTheDocument();

        resolvePromise!({
            shareablePath: '/share/group-1',
            expiresAt: new Date(Date.now() + ONE_DAY_MS).toISOString(),
        });

        // Now they should appear
        await screen.findByTestId('qr-code');
        await screen.findByTestId('share-link-input');
    });

    it('resets state when modal is closed and reopened', async () => {
        mockedApiClient.generateShareLink.mockResolvedValue({
            shareablePath: '/share/group-1',
            expiresAt: new Date(Date.now() + ONE_DAY_MS).toISOString(),
        });

        const { rerender } = render(
            <ShareGroupModal
                isOpen={true}
                onClose={() => {}}
                groupId='group-1'
                groupName='Test Group'
            />,
        );

        await screen.findByTestId('share-link-input');
        expect(mockedApiClient.generateShareLink).toHaveBeenCalledTimes(1);

        // Close the modal
        rerender(
            <ShareGroupModal
                isOpen={false}
                onClose={() => {}}
                groupId='group-1'
                groupName='Test Group'
            />,
        );

        // Modal should not be in DOM when closed
        expect(screen.queryByTestId('share-link-input')).not.toBeInTheDocument();

        // Reopen the modal
        rerender(
            <ShareGroupModal
                isOpen={true}
                onClose={() => {}}
                groupId='group-1'
                groupName='Test Group'
            />,
        );

        // Should generate a fresh link
        await waitFor(() => {
            expect(mockedApiClient.generateShareLink).toHaveBeenCalledTimes(2);
        });
    });
});
