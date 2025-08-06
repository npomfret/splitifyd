import { useComputed } from '@preact/signals';
import { useAuth } from '../../app/hooks/useAuth';
import { UserMenu } from './UserMenu';

interface HeaderProps {
  variant?: 'default' | 'minimal' | 'dashboard';
  showAuth?: boolean;
}

export function Header({ variant = 'default', showAuth = true }: HeaderProps) {
  const authStore = useAuth();
  const user = useComputed(() => authStore.user);
  const isAuthenticated = useComputed(() => !!user.value);

  const getNavLinks = () => {
    if (variant === 'minimal') {
      return null;
    }

    // No nav links needed - everything goes in footer
    return null;
  };

  const getAuthSection = () => {
    if (!showAuth) return null;

    if (isAuthenticated.value && user.value) {
      return <UserMenu user={user.value} />;
    }

    return (
      <div class="flex items-center gap-4">
        <a href="/login" class="text-gray-700 hover:text-purple-600 transition-colors">
          Login
        </a>
        <a href="/register" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
          Sign Up
        </a>
      </div>
    );
  };

  const headerClasses = variant === 'dashboard' 
    ? "bg-white shadow-sm border-b border-gray-200"
    : "bg-white shadow-sm border-b border-gray-200";

  return (
    <header class={headerClasses}>
      <div class="max-w-7xl mx-auto px-4">
        <nav class="flex items-center justify-between h-16">
          <div class="flex items-center space-x-8">
            <a href={isAuthenticated.value ? "/dashboard" : "/"} class="flex items-center">
              <img src="/images/logo.svg" alt="Splitifyd" class="h-8" />
            </a>
            {getNavLinks()}
          </div>
          {getAuthSection()}
        </nav>
      </div>
    </header>
  );
}