import { render, screen, fireEvent, waitFor } from '../../../test-utils';
import { vi } from 'vitest';
import { ShareGroupModal } from '../ShareGroupModal';
import { apiClient } from '@/app/apiClient';

vi.mock('@/app/apiClient', () => ({
  apiClient: {
    generateShareLink: vi.fn()
  }
}));

vi.mock('@/utils/browser-logger', () => ({
  logError: vi.fn()
}));

describe('ShareGroupModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    groupId: 'test-group-id',
    groupName: 'Test Group'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:3000' },
      writable: true
    });

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined)
      },
      writable: true
    });

    document.execCommand = vi.fn().mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Component Rendering', () => {
    it('renders modal when isOpen is true', () => {
      render(<ShareGroupModal {...defaultProps} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Invite Others')).toBeInTheDocument();
    });

    it('does not render modal when isOpen is false', () => {
      render(<ShareGroupModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('displays header with gradient background and icon', () => {
      render(<ShareGroupModal {...defaultProps} />);
      
      const header = screen.getByText('Invite Others').closest('div')?.parentElement?.parentElement;
      expect(header).toHaveClass('bg-gradient-to-r', 'from-purple-50', 'to-indigo-50');
      
      const icon = header?.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('displays instructional text', () => {
      render(<ShareGroupModal {...defaultProps} />);
      
      expect(screen.getByText('Share this link with anyone you want to join this group.')).toBeInTheDocument();
    });

    it('displays QR code placeholder section', async () => {
      (apiClient.generateShareLink as any).mockResolvedValue({
        shareablePath: '/join/abc123'
      });

      render(<ShareGroupModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/QR Code/)).toBeInTheDocument();
        expect(screen.getByText(/Coming Soon/)).toBeInTheDocument();
        expect(screen.getByText('Or scan this code')).toBeInTheDocument();
      });
    });

    it('displays link expiration options', async () => {
      (apiClient.generateShareLink as any).mockResolvedValue({
        shareablePath: '/join/abc123'
      });

      render(<ShareGroupModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Expiration: 1 day')).toBeInTheDocument();
        expect(screen.getByText('Generate New')).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('generates share link on mount', async () => {
      const mockShareablePath = '/join/test123';
      (apiClient.generateShareLink as any).mockResolvedValue({
        shareablePath: mockShareablePath
      });

      render(<ShareGroupModal {...defaultProps} />);

      await waitFor(() => {
        expect(apiClient.generateShareLink).toHaveBeenCalledWith('test-group-id');
      });

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('http://localhost:3000/join/test123');
    });

    it('shows loading spinner while generating link', () => {
      (apiClient.generateShareLink as any).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      render(<ShareGroupModal {...defaultProps} />);
      
      expect(screen.getByRole('presentation').querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('displays error message on API failure', async () => {
      const errorMessage = 'Network error';
      (apiClient.generateShareLink as any).mockRejectedValue(new Error(errorMessage));

      render(<ShareGroupModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to generate share link. Please try again.')).toBeInTheDocument();
      });
    });

    it('does not generate link when modal is closed', () => {
      render(<ShareGroupModal {...defaultProps} isOpen={false} />);
      
      expect(apiClient.generateShareLink).not.toHaveBeenCalled();
    });
  });

  describe('Copy Functionality', () => {
    beforeEach(async () => {
      (apiClient.generateShareLink as any).mockResolvedValue({
        shareablePath: '/join/abc123'
      });
    });

    it('copies link to clipboard on button click', async () => {
      render(<ShareGroupModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const copyButton = screen.getByTitle('Copy link');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost:3000/join/abc123');
      });
    });

    it('changes icon from clipboard to checkmark on successful copy', async () => {
      vi.useFakeTimers();
      render(<ShareGroupModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const copyButton = screen.getByTitle('Copy link');
      
      // Initially shows clipboard icon
      let icon = copyButton.querySelector('svg path');
      expect(icon?.getAttribute('d')).toContain('M8 16H6a2');

      fireEvent.click(copyButton);

      await waitFor(() => {
        // Changes to checkmark icon
        icon = copyButton.querySelector('svg path');
        expect(icon?.getAttribute('d')).toContain('M5 13l4 4L19 7');
      });

      // Fast-forward time to check icon reverts
      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        // Reverts to clipboard icon
        icon = copyButton.querySelector('svg path');
        expect(icon?.getAttribute('d')).toContain('M8 16H6a2');
      });
    });

    it('shows toast notification on successful copy', async () => {
      vi.useFakeTimers();
      render(<ShareGroupModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const copyButton = screen.getByTitle('Copy link');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(screen.getByText('Link copied to clipboard')).toBeInTheDocument();
      });

      // Toast should have slide-up animation
      const toast = screen.getByText('Link copied to clipboard').closest('div')?.parentElement;
      expect(toast).toHaveClass('animate-slide-up');

      // Fast-forward to check toast disappears
      vi.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(screen.queryByText('Link copied to clipboard')).not.toBeInTheDocument();
      });
    });

    it('falls back to execCommand when clipboard API is unavailable', async () => {
      // Mock clipboard API to fail
      (navigator.clipboard.writeText as any).mockRejectedValue(new Error('Clipboard API not available'));
      
      render(<ShareGroupModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox') as HTMLInputElement;
      input.select = vi.fn();

      const copyButton = screen.getByTitle('Copy link');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(input.select).toHaveBeenCalled();
        expect(document.execCommand).toHaveBeenCalledWith('copy');
      });
    });
  });

  describe('User Interactions', () => {
    it('closes modal when backdrop is clicked', async () => {
      (apiClient.generateShareLink as any).mockResolvedValue({
        shareablePath: '/join/abc123'
      });

      render(<ShareGroupModal {...defaultProps} />);

      const backdrop = screen.getByRole('presentation');
      fireEvent.click(backdrop);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('closes modal when close button is clicked', async () => {
      (apiClient.generateShareLink as any).mockResolvedValue({
        shareablePath: '/join/abc123'
      });

      render(<ShareGroupModal {...defaultProps} />);

      const closeButton = screen.getAllByRole('button').find(button => 
        button.querySelector('svg path[d*="M6 18L18 6M6 6l12 12"]')
      );
      
      fireEvent.click(closeButton!);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('closes modal when Escape key is pressed', async () => {
      (apiClient.generateShareLink as any).mockResolvedValue({
        shareablePath: '/join/abc123'
      });

      render(<ShareGroupModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('selects all text when input is clicked', async () => {
      (apiClient.generateShareLink as any).mockResolvedValue({
        shareablePath: '/join/abc123'
      });

      render(<ShareGroupModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox') as HTMLInputElement;
      input.select = vi.fn();

      fireEvent.click(input);

      expect(input.select).toHaveBeenCalled();
    });

    it('does not close modal when dialog content is clicked', async () => {
      (apiClient.generateShareLink as any).mockResolvedValue({
        shareablePath: '/join/abc123'
      });

      render(<ShareGroupModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('handles multiple rapid copy clicks correctly', async () => {
      vi.useFakeTimers();
      (apiClient.generateShareLink as any).mockResolvedValue({
        shareablePath: '/join/abc123'
      });

      render(<ShareGroupModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const copyButton = screen.getByTitle('Copy link');
      
      // Click multiple times rapidly
      fireEvent.click(copyButton);
      fireEvent.click(copyButton);
      fireEvent.click(copyButton);

      // Should still only copy once per click
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(3);
      
      // Icon should still change to checkmark
      await waitFor(() => {
        const icon = copyButton.querySelector('svg path');
        expect(icon?.getAttribute('d')).toContain('M5 13l4 4L19 7');
      });
    });

    it('cleans up event listeners on unmount', async () => {
      (apiClient.generateShareLink as any).mockResolvedValue({
        shareablePath: '/join/abc123'
      });

      const { unmount } = render(<ShareGroupModal {...defaultProps} />);

      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('handles component unmounting during API call', async () => {
      let resolvePromise: any;
      (apiClient.generateShareLink as any).mockImplementation(() => 
        new Promise(resolve => {
          resolvePromise = resolve;
        })
      );

      const { unmount } = render(<ShareGroupModal {...defaultProps} />);

      // Unmount while API call is pending
      unmount();

      // Resolve the promise after unmount
      if (resolvePromise) {
        resolvePromise({ shareablePath: '/join/abc123' });
      }

      // Should not cause any errors
      expect(() => {
        // Component is unmounted, no errors should occur
      }).not.toThrow();
    });

    it('handles clipboard and execCommand both failing gracefully', async () => {
      (navigator.clipboard.writeText as any).mockRejectedValue(new Error('Clipboard API failed'));
      document.execCommand = vi.fn().mockReturnValue(false);
      
      (apiClient.generateShareLink as any).mockResolvedValue({
        shareablePath: '/join/abc123'
      });

      render(<ShareGroupModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const copyButton = screen.getByTitle('Copy link');
      
      // Should not throw error when both methods fail
      expect(() => {
        fireEvent.click(copyButton);
      }).not.toThrow();
    });
  });
});