import { LoadingSpinner } from './LoadingSpinner';

interface LoadingStateProps {
  message?: string;
  fullPage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingState({
  message = 'Loading...',
  fullPage = false,
  size = 'md',
  className = ''
}: LoadingStateProps) {
  const content = (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <LoadingSpinner size={size} />
      {message && (
        <p className="mt-3 text-sm text-gray-600">{message}</p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        {content}
      </div>
    );
  }

  return content;
}