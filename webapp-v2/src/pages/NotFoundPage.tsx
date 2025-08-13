import { useComputed } from '@preact/signals';
import { useAuth } from '../app/hooks/useAuth';

interface NotFoundPageProps {
  path?: string;
}

export function NotFoundPage({ path }: NotFoundPageProps) {
  const authStore = useAuth();
  const isAuthenticated = useComputed(() => !!authStore?.user);
  
  // Check if this is a group-related 404
  const isGroupPath = path?.includes('/groups/') || path?.includes('/group/');
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-4">
          {isGroupPath 
            ? "Group not found or you don't have access" 
            : "Page not found"}
        </p>
        <p className="text-sm text-gray-500 mb-8">
          {isGroupPath 
            ? "The group you're looking for doesn't exist or you need to be invited to access it."
            : "The page you're looking for doesn't exist."}
        </p>
        <div className="space-x-4">
          {isAuthenticated.value ? (
            <a
              href="/dashboard"
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors inline-block"
            >
              Go to Dashboard
            </a>
          ) : (
            <a
              href="/"
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors inline-block"
            >
              Go Home
            </a>
          )}
        </div>
      </div>
    </div>
  );
}