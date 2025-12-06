import { ReadonlySignal, signal } from '@preact/signals';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

interface UseSuccessMessageResult {
    message: ReadonlySignal<string | null>;
    showSuccess: (text: string) => void;
    clearMessage: () => void;
}

const DEFAULT_TIMEOUT_MS = 4000;

export function useSuccessMessage(timeoutMs: number = DEFAULT_TIMEOUT_MS): UseSuccessMessageResult {
    const [messageSignal] = useState(() => signal<string | null>(null));
    const timerRef = useRef<number | null>(null);

    const clearMessage = useCallback(() => {
        if (timerRef.current) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        messageSignal.value = null;
    }, [messageSignal]);

    const showSuccess = useCallback(
        (text: string) => {
            clearMessage();
            messageSignal.value = text;
            timerRef.current = window.setTimeout(() => {
                messageSignal.value = null;
                timerRef.current = null;
            }, timeoutMs);
        },
        [clearMessage, messageSignal, timeoutMs],
    );

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, []);

    return {
        message: messageSignal,
        showSuccess,
        clearMessage,
    };
}
