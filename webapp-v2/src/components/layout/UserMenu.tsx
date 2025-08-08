import { useState, useRef, useEffect } from 'preact/hooks';
import { useAuthRequired } from '@/app/hooks/useAuthRequired.ts';

interface UserMenuProps {
  user: {
    uid: string;
    email: string;
    displayName?: string;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const authStore = useAuthRequired();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);

  const userInitial = user.displayName 
    ? user.displayName.charAt(0).toUpperCase()
    : user.email.charAt(0).toUpperCase();

  const userName = user.displayName || user.email.split('@')[0];

  return (
    <div class="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        class="flex items-center space-x-2 hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors"
      >
        <div class="w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center">
          <span class="text-sm font-medium">{userInitial}</span>
        </div>
        <div class="hidden sm:block text-left">
          <p class="text-sm font-medium text-gray-700">{userName}</p>
          <p class="text-xs text-gray-500">{user.email}</p>
        </div>
        <svg 
          class="w-4 h-4 text-gray-500" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2" 
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div class="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <div class="px-4 py-2 border-b border-gray-100">
            <p class="text-sm font-medium text-gray-900">{userName}</p>
            <p class="text-xs text-gray-500">{user.email}</p>
          </div>
          
          <a 
            href="/dashboard" 
            class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Dashboard
          </a>
          
          <a 
            href="/settings" 
            class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Settings
          </a>
          
          <hr class="my-1 border-gray-100" />
          
          <button
            onClick={() => authStore.logout()}
            class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            disabled={authStore.loading}
          >
            {authStore.loading ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}