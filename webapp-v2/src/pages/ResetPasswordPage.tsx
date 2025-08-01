import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { AuthLayout } from '../components/auth/AuthLayout';
import { AuthForm } from '../components/auth/AuthForm';
import { EmailInput } from '../components/auth/EmailInput';
import { SubmitButton } from '../components/auth/SubmitButton';
import { authStore } from '../app/stores/auth-store';

const emailSignal = signal('');

export function ResetPasswordPage() {
  const [emailSent, setEmailSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear any previous errors when component mounts
  useEffect(() => {
    authStore.clearError();
    setError(null);
  }, []);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    
    const email = emailSignal.value.trim();
    if (!email) return;

    setIsLoading(true);
    setError(null);

    try {
      await authStore.resetPassword(email);
      setEmailSent(true);
    } catch (error) {
      setError(authStore.error || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTryAgain = () => {
    setEmailSent(false);
    emailSignal.value = '';
    setError(null);
  };

  if (emailSent) {
    return (
      <AuthLayout 
        title="Check Your Email"
        description="Password reset instructions have been sent to your email"
      >
        <div class="text-center space-y-6">
          <div class="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          
          <div class="space-y-2">
            <h2 class="text-lg font-medium text-gray-900">Email Sent Successfully</h2>
            <p class="text-gray-600">
              We've sent password reset instructions to:
            </p>
            <p class="font-medium text-gray-900">{emailSignal.value}</p>
          </div>

          <div class="bg-blue-50 border border-blue-200 rounded-md p-4 text-left">
            <h3 class="text-sm font-medium text-blue-800 mb-1">What's next?</h3>
            <ul class="text-sm text-blue-700 space-y-1">
              <li>• Check your email inbox (and spam folder)</li>
              <li>• Click the reset link in the email</li>
              <li>• Create a new password</li>
              <li>• Sign in with your new password</li>
            </ul>
          </div>

          <div class="space-y-3">
            <button
              onClick={handleTryAgain}
              class="w-full px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-300 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Send to Different Email
            </button>

            <div class="text-center">
              <a 
                href="/login"
                class="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Back to Sign In
              </a>
            </div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout 
      title="Reset Password"
      description="Enter your email address to receive password reset instructions"
    >
      <AuthForm 
        onSubmit={handleSubmit}
        error={error}
        disabled={isLoading}
      >
        <div class="space-y-4">
          <p class="text-sm text-gray-600">
            Enter the email address associated with your account and we'll send you a link to reset your password.
          </p>

          <EmailInput
            value={emailSignal.value}
            onInput={(value) => emailSignal.value = value}
            placeholder="Enter your email address"
            autoFocus
            disabled={isLoading}
          />
        </div>

        <SubmitButton
          loading={isLoading}
          disabled={!emailSignal.value.trim()}
        >
          Send Reset Instructions
        </SubmitButton>

        <div class="text-center">
          <a 
            href="/login"
            class="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Back to Sign In
          </a>
        </div>
      </AuthForm>
    </AuthLayout>
  );
}