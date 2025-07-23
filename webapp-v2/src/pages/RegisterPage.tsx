import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { AuthLayout } from '../components/auth/AuthLayout';
import { AuthForm } from '../components/auth/AuthForm';
import { EmailInput } from '../components/auth/EmailInput';
import { PasswordInput } from '../components/auth/PasswordInput';
import { SubmitButton } from '../components/auth/SubmitButton';
import { authStore } from '../app/stores/auth-store';

const nameSignal = signal('');
const emailSignal = signal('');
const passwordSignal = signal('');
const confirmPasswordSignal = signal('');
const agreeToTermsSignal = signal(false);
const localErrorSignal = signal<string | null>(null);

export function RegisterPage() {
  // Clear any previous errors when component mounts
  useEffect(() => {
    authStore.clearError();
    localErrorSignal.value = null;
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (authStore.user) {
      route('/dashboard', true);
    }
  }, [authStore.user]);

  const validateForm = (): string | null => {
    if (!nameSignal.value.trim()) {
      return 'Name is required';
    }
    if (!emailSignal.value.trim()) {
      return 'Email is required';
    }
    if (!passwordSignal.value) {
      return 'Password is required';
    }
    if (passwordSignal.value.length < 6) {
      return 'Password must be at least 6 characters';
    }
    if (passwordSignal.value !== confirmPasswordSignal.value) {
      return 'Passwords do not match';
    }
    if (!agreeToTermsSignal.value) {
      return 'You must agree to the Terms of Service';
    }
    return null;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      localErrorSignal.value = validationError;
      return;
    }

    localErrorSignal.value = null;

    try {
      await authStore.register(
        emailSignal.value.trim(),
        passwordSignal.value,
        nameSignal.value.trim()
      );
      // Redirect will happen via useEffect when user state updates
    } catch (error) {
      // Error is handled by the auth store
    }
  };

  const isFormValid = nameSignal.value.trim() && 
                     emailSignal.value.trim() && 
                     passwordSignal.value && 
                     confirmPasswordSignal.value &&
                     agreeToTermsSignal.value;
  const isSubmitting = authStore.loading;
  const displayError = authStore.error || localErrorSignal.value;

  return (
    <AuthLayout 
      title="Create Account"
      description="Create your Splitifyd account to start managing shared expenses"
    >
      <AuthForm 
        onSubmit={handleSubmit}
        error={displayError}
        disabled={isSubmitting}
      >
        <div class="space-y-1">
          <label class="block text-sm font-medium text-gray-700">
            Full Name <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={nameSignal.value}
            onInput={(e) => nameSignal.value = (e.target as HTMLInputElement).value}
            placeholder="Enter your full name"
            required
            disabled={isSubmitting}
            autoComplete="name"
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>

        <EmailInput
          value={emailSignal.value}
          onInput={(value) => emailSignal.value = value}
          disabled={isSubmitting}
        />

        <PasswordInput
          value={passwordSignal.value}
          onInput={(value) => passwordSignal.value = value}
          label="Password"
          placeholder="Create a strong password"
          disabled={isSubmitting}
          showStrength
          autoComplete="new-password"
        />

        <PasswordInput
          value={confirmPasswordSignal.value}
          onInput={(value) => confirmPasswordSignal.value = value}
          label="Confirm Password"
          placeholder="Confirm your password"
          disabled={isSubmitting}
          autoComplete="new-password"
        />

        <div class="space-y-4">
          <label class="flex items-start">
            <input
              type="checkbox"
              checked={agreeToTermsSignal.value}
              onChange={(e) => agreeToTermsSignal.value = (e.target as HTMLInputElement).checked}
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1 flex-shrink-0"
              disabled={isSubmitting}
              required
            />
            <span class="ml-2 block text-sm text-gray-700">
              I agree to the{' '}
              <a 
                href="/v2/terms" 
                target="_blank"
                class="text-blue-600 hover:text-blue-500 transition-colors"
              >
                Terms of Service
              </a>
              {' '}and{' '}
              <a 
                href="/v2/privacy" 
                target="_blank"
                class="text-blue-600 hover:text-blue-500 transition-colors"
              >
                Privacy Policy
              </a>
            </span>
          </label>
        </div>

        <SubmitButton
          loading={isSubmitting}
          disabled={!isFormValid}
        >
          Create Account
        </SubmitButton>

        <div class="text-center">
          <p class="text-sm text-gray-600">
            Already have an account?{' '}
            <a 
              href="/login"
              class="font-medium text-blue-600 hover:text-blue-500 transition-colors"
            >
              Sign in
            </a>
          </p>
        </div>
      </AuthForm>
    </AuthLayout>
  );
}