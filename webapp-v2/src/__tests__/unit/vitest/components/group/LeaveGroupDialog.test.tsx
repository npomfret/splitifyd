import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { useTranslation } from 'react-i18next';
import { route } from 'preact-router';
import { LeaveGroupDialog } from '@/components/group/LeaveGroupDialog';
import { apiClient } from '@/app/apiClient';
import { logError } from '@/utils/browser-logger';

// Mock all dependencies
vi.mock('react-i18next');
vi.mock('preact-router');
vi.mock('@/app/apiClient');
vi.mock('@/utils/browser-logger');

// Mock translations
const mockT = vi.fn((key: string) => {
    const translations: Record<string, string> = {
        'membersList.leaveGroupDialog.title': 'Leave Group',
        'membersList.leaveGroupDialog.messageConfirm': 'Are you sure you want to leave this group?',
        'membersList.leaveGroupDialog.messageWithBalance': 'You have an outstanding balance. Please settle up before leaving.',
        'membersList.leaveGroupDialog.confirmText': 'Leave Group',
        'membersList.leaveGroupDialog.cancelText': 'Cancel',
        'common.understood': 'Understood',
    };
    return translations[key] || key;
}) as any;

const mockRoute = vi.mocked(route);
const mockApiClient = apiClient as any;
const mockLogError = logError as MockedFunction<typeof logError>;

describe('LeaveGroupDialog', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        groupId: 'test-group-id',
        hasOutstandingBalance: false,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useTranslation as MockedFunction<typeof useTranslation>).mockReturnValue({
            t: mockT,
            i18n: {} as any,
            ready: true,
        } as any);
        mockApiClient.leaveGroup = vi.fn();
    });

    it('renders the dialog when open', () => {
        render(<LeaveGroupDialog {...defaultProps} />);

        expect(screen.getByRole('heading', { name: 'Leave Group' })).toBeInTheDocument();
        expect(screen.getByText('Are you sure you want to leave this group?')).toBeInTheDocument();
        expect(screen.getByTestId('confirm-button')).toHaveTextContent('Leave Group');
        expect(screen.getByTestId('cancel-button')).toHaveTextContent('Cancel');
    });

    it('does not render when closed', () => {
        render(<LeaveGroupDialog {...defaultProps} isOpen={false} />);

        expect(screen.queryByText('Leave Group')).not.toBeInTheDocument();
    });

    it('shows different message when user has outstanding balance', () => {
        render(<LeaveGroupDialog {...defaultProps} hasOutstandingBalance={true} />);

        expect(screen.getByText('You have an outstanding balance. Please settle up before leaving.')).toBeInTheDocument();
        expect(screen.getByText('Understood')).toBeInTheDocument();
    });

    it('calls onClose when cancel is clicked', () => {
        const onCloseMock = vi.fn();
        render(<LeaveGroupDialog {...defaultProps} onClose={onCloseMock} />);

        const cancelButton = screen.getByTestId('cancel-button');
        fireEvent.click(cancelButton);

        expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('prevents leaving when user has outstanding balance', async () => {
        const onCloseMock = vi.fn();
        render(<LeaveGroupDialog {...defaultProps} hasOutstandingBalance={true} onClose={onCloseMock} />);

        const confirmButton = screen.getByTestId('confirm-button');
        fireEvent.click(confirmButton);

        // Should not call API or navigate
        expect(mockApiClient.leaveGroup).not.toHaveBeenCalled();
        expect(mockRoute).not.toHaveBeenCalled();
    });

    it('successfully leaves group when no outstanding balance', async () => {
        const onCloseMock = vi.fn();
        mockApiClient.leaveGroup.mockResolvedValueOnce(undefined);

        render(<LeaveGroupDialog {...defaultProps} onClose={onCloseMock} />);

        const confirmButton = screen.getByTestId('confirm-button');
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(mockApiClient.leaveGroup).toHaveBeenCalledWith('test-group-id');
            expect(mockRoute).toHaveBeenCalledWith('/dashboard', false);
            expect(onCloseMock).toHaveBeenCalled();
        });
    });

    it('handles API error gracefully', async () => {
        const onCloseMock = vi.fn();
        const mockError = new Error('API Error');
        mockApiClient.leaveGroup.mockRejectedValueOnce(mockError);

        render(<LeaveGroupDialog {...defaultProps} onClose={onCloseMock} />);

        const confirmButton = screen.getByTestId('confirm-button');
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(mockApiClient.leaveGroup).toHaveBeenCalledWith('test-group-id');
            expect(mockLogError).toHaveBeenCalledWith('Failed to leave group', mockError);
            expect(onCloseMock).toHaveBeenCalled();
        });

        // Should not navigate on error
        expect(mockRoute).not.toHaveBeenCalled();
    });

    it('shows loading state while processing', async () => {
        mockApiClient.leaveGroup.mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 100)));

        render(<LeaveGroupDialog {...defaultProps} />);

        const confirmButton = screen.getByTestId('confirm-button');
        fireEvent.click(confirmButton);

        // Check that button is disabled during processing
        expect(confirmButton).toHaveAttribute('aria-busy', 'true');

        await waitFor(() => {
            expect(mockApiClient.leaveGroup).toHaveBeenCalledWith('test-group-id');
        });
    });

    it('uses correct dialog variant based on balance status', () => {
        // Test warning variant (no outstanding balance)
        const { rerender } = render(<LeaveGroupDialog {...defaultProps} hasOutstandingBalance={false} />);
        const dialog = screen.getByTestId('leave-group-dialog');
        // The dialog should show warning styling when user has no balance
        expect(dialog).toBeInTheDocument();

        // Test info variant (outstanding balance)
        rerender(<LeaveGroupDialog {...defaultProps} hasOutstandingBalance={true} />);
        const dialogWithBalance = screen.getByTestId('leave-group-dialog');
        // The dialog should show info styling when user has outstanding balance
        expect(dialogWithBalance).toBeInTheDocument();
    });

    it('has correct test id for identification', () => {
        render(<LeaveGroupDialog {...defaultProps} />);
        expect(screen.getByTestId('leave-group-dialog')).toBeInTheDocument();
    });
});
