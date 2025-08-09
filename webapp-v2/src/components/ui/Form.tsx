import { JSX } from 'preact';
import { useCallback, useState } from 'preact/hooks';
import { logError } from '@/utils/browser-logger.ts';

interface FormProps {
  onSubmit: (e: Event) => void | Promise<void>;
  children: JSX.Element | JSX.Element[];
  className?: string;
  id?: string;
}

export function Form({ onSubmit, children, className = '', id }: FormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: Event) => {
      e.preventDefault();
      
      if (isSubmitting) return;

      setIsSubmitting(true);
      
      try {
        await onSubmit(e);
      } catch (error) {
        logError('Form submission error', error, { formId: id });
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSubmit, isSubmitting]
  );

  return (
    <form
      id={id}
      onSubmit={handleSubmit}
      className={className}
      noValidate
      aria-busy={isSubmitting}
    >
      {children}
    </form>
  );
}