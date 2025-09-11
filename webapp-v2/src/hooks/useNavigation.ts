import { navigationService } from '@/services/navigation.service';

/**
 * Custom hook for accessing the navigation service.
 *
 * This provides a React/Preact-friendly interface to the navigation service,
 * allowing components to navigate programmatically with consistent patterns.
 *
 * @returns The navigation service instance with all navigation methods
 */
export function useNavigation() {
    return navigationService;
}
