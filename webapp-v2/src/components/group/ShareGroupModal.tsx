import { useState, useEffect, useRef } from 'preact/hooks';
import { apiClient } from '@/app/apiClient.ts';
import { Button } from '../ui';
import { logError } from '@/utils/browser-logger.ts';

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
  const [showToast, setShowToast] = useState(false);
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
      // Construct full URL from the path returned by server
      const fullUrl = `${window.location.origin}${response.shareablePath}`;
      setShareLink(fullUrl);
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
      setShowToast(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
      setTimeout(() => {
        setShowToast(false);
      }, 3000);
    } catch (err) {
      if (linkInputRef.current) {
        linkInputRef.current.select();
        document.execCommand('copy');
        setCopied(true);
        setShowToast(true);
        setTimeout(() => {
          setCopied(false);
        }, 2000);
        setTimeout(() => {
          setShowToast(false);
        }, 3000);
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
    <>
      <div 
        class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
        onClick={handleBackdropClick}
        role="presentation"
      >
        <div 
          class="relative top-20 mx-auto w-96 shadow-xl rounded-lg bg-white overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-modal-title"
        >
          {/* Modal Header with colored background */}
          <div class="bg-gradient-to-r from-purple-50 to-indigo-50 px-6 py-4 border-b border-purple-100">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <h3 id="share-modal-title" class="text-lg font-semibold text-gray-900">Invite Others</h3>
              </div>
              <button
                onClick={onClose}
                class="text-gray-400 hover:text-gray-600 transition-colors rounded-full p-1 hover:bg-gray-100"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Modal Content */}
          <div class="p-6">
            <p class="text-sm text-gray-600 mb-4">
              Share this link with anyone you want to join this group.
            </p>

            {loading && (
              <div class="flex justify-center py-8">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
              </div>
            )}

            {error && (
              <div class="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                <p class="text-sm text-red-800">{error}</p>
              </div>
            )}

            {shareLink && !loading && (
              <div class="space-y-6">
                {/* Share link input with inline copy button */}
                <div class="relative">
                  <input
                    ref={linkInputRef}
                    type="text"
                    value={shareLink}
                    readOnly={true}
                    class="w-full pl-3 pr-12 py-3 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={copyToClipboard}
                    class="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-all duration-200"
                    title="Copy link"
                  >
                    {copied ? (
                      <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* QR Code placeholder section */}
                <div class="flex flex-col items-center py-4">
                  <div class="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-gray-200">
                    <span class="text-xs text-gray-400 text-center px-2">QR Code<br />Coming Soon</span>
                  </div>
                  <p class="text-sm text-gray-500 mt-2">Or scan this code</p>
                </div>

                {/* Link expiration options */}
                <div class="flex items-center justify-between text-sm text-gray-500 pt-2 border-t border-gray-100">
                  <span>Expiration: 1 day</span>
                  <button class="text-purple-600 hover:text-purple-700 font-medium">
                    Generate New
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast notification */}
      {showToast && (
        <div class="fixed bottom-4 right-4 z-[60] animate-slide-up">
          <div class="bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2">
            <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span class="text-sm font-medium">Link copied to clipboard</span>
          </div>
        </div>
      )}
    </>
  );
}