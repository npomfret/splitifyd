/**
 * Shared types for expense form components.
 */

/**
 * Represents a group member for display in expense form UI components.
 * Contains the minimal fields needed for member selection and display.
 */
export interface ExpenseFormMember {
    uid: string;
    groupDisplayName: string;
    displayName?: string | null;
}
