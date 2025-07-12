export function hideElement(element: HTMLElement): void {
    element.classList.add('hidden');
}

export function showElement(element: HTMLElement, displayType: string = 'block'): void {
    element.classList.remove('hidden');
    // Optionally set display type if 'hidden' class only sets display: none
    // If 'hidden' class handles all display properties, this might not be needed.
    // For now, assuming 'hidden' just sets display: none.
    // If the element needs a specific display type (e.g., flex, grid), it should be passed.
    if (displayType !== 'block') {
        element.style.display = displayType;
    }
}
