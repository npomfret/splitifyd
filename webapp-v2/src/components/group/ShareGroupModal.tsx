import { useState, useEffect, useRef } from 'preact/hooks';
import { apiClient } from '../../app/apiClient';
import { Button } from '../ui';
import { logError } from '../../utils/error-logger';

interface ShareGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
}

export function ShareGroupModal({ isOpen, onClose, groupId, groupName }: ShareGroupModalProps) {
  const [shareLink, setShareLink] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && groupId) {
      // Intentionally not awaited - useEffect cannot be async (React anti-pattern)
      generateLink();
    }
  }, [isOpen, groupId]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const generateLink = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.generateShareLink(groupId);
      setShareLink(response.shareableUrl);
    } catch (err) {
      logError('Failed to generate share link', err);
      setError('Failed to generate share link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      if (linkInputRef.current) {
        linkInputRef.current.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleBackdropClick = (e: Event) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div 
        class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
      >
        {/* Modal Header */}
        <div class="flex items-center justify-between mb-6">
          <h3 id="share-modal-title" class="text-lg font-semibold text-gray-900">Share Group</h3>
          <button
            onClick={onClose}
            class="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div class="space-y-4">
          <p class="text-sm text-gray-600">
            Share this link with others to invite them to join "{groupName}"
          </p>

          {loading && (
            <div class="flex justify-center py-4">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          )}

          {error && (
            <div class="bg-red-50 border border-red-200 rounded-md p-3">
              <p class="text-sm text-red-800">{error}</p>
            </div>
          )}

          {shareLink && !loading && (
            <div class="space-y-3">
              <div class="relative">
                <input
                  ref={linkInputRef}
                  type="text"
                  value={shareLink}
                  readOnly={true}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
              </div>

              <Button
                variant="primary"
                onClick={copyToClipboard}
                className="w-full"
              >
                {copied ? '✓ Copied!' : 'Copy Link'}
              </Button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div class="flex items-center justify-end mt-6 pt-4 border-t border-gray-200">
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}