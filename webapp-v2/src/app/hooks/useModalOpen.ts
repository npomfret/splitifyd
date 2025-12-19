import { useEffect, useRef } from 'preact/hooks';

interface ModalTransitionCallbacks {
    /** Called when modal transitions from closed to open */
    onOpen?: () => void;
    /** Called when modal transitions from open to closed */
    onClose?: () => void;
}

/**
 * Hook that executes callbacks on modal open/close transitions.
 *
 * This eliminates the repeated pattern of:
 * ```
 * const previousIsOpenRef = useRef(isOpen);
 * useEffect(() => {
 *     const wasOpen = previousIsOpenRef.current;
 *     previousIsOpenRef.current = isOpen;
 *     if (!wasOpen && isOpen) {
 *         // reset form...
 *     }
 *     if (wasOpen && !isOpen) {
 *         // cleanup...
 *     }
 * }, [isOpen, ...deps]);
 * ```
 *
 * @example
 * // Simple open callback
 * useModalOpen(isOpen, {
 *     onOpen: () => {
 *         nameSignal.value = '';
 *         errorSignal.value = null;
 *     }
 * });
 *
 * @example
 * // Both open and close callbacks
 * useModalOpen(isOpen, {
 *     onOpen: () => loadData(),
 *     onClose: () => resetState()
 * });
 */
export function useModalOpen(isOpen: boolean, callbacks: ModalTransitionCallbacks): void {
    const previousIsOpenRef = useRef(isOpen);

    useEffect(() => {
        const wasOpen = previousIsOpenRef.current;
        previousIsOpenRef.current = isOpen;

        if (!wasOpen && isOpen) {
            callbacks.onOpen?.();
        }

        if (wasOpen && !isOpen) {
            callbacks.onClose?.();
        }
    }, [isOpen, callbacks]);
}

/**
 * Hook for entity-editing modals that reset on open OR when the entity changes.
 *
 * Use this for modals like UserEditorModal or TenantEditorModal where:
 * - Form resets when modal opens
 * - Form resets when a different entity is selected while modal is open
 *
 * @example
 * useModalOpenOrChange(isOpen, user.uid, () => {
 *     setDisplayName(user.displayName);
 *     setEmail(user.email);
 *     setError('');
 * });
 */
export function useModalOpenOrChange<T>(
    isOpen: boolean,
    entityId: T | undefined,
    onOpenOrChange: () => void,
): void {
    const previousIsOpenRef = useRef(isOpen);
    const previousEntityIdRef = useRef(entityId);

    useEffect(() => {
        const wasOpen = previousIsOpenRef.current;
        const prevId = previousEntityIdRef.current;
        previousIsOpenRef.current = isOpen;
        previousEntityIdRef.current = entityId;

        const isOpenTransition = !wasOpen && isOpen;
        const isEntityChange = isOpen && prevId !== entityId;

        if (isOpenTransition || isEntityChange) {
            onOpenOrChange();
        }
    }, [isOpen, entityId, onOpenOrChange]);
}
