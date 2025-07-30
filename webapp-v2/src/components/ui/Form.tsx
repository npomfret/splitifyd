import { JSX } from 'preact';
import { useCallback, useState } from 'preact/hooks';

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
        console.error('Form submission error:', error instanceof Error ? error.toString() : JSON.stringify(error, null, 2));
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