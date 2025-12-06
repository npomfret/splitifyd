import type { ExpenseFormMember } from '@/components/expense-form/types';
import { UserId } from '@billsplit-wl/shared';
import { useDropdownSelector } from './useDropdownSelector';

interface UsePayerSelectorOptions {
    members: ExpenseFormMember[];
    onPayerChange: (payerId: UserId) => void;
}

/**
 * Hook for payer selection dropdown.
 * Wraps useDropdownSelector with member-specific filtering logic.
 */
export function usePayerSelector({ members, onPayerChange }: UsePayerSelectorOptions) {
    const filterFn = (member: ExpenseFormMember, searchTerm: string) => member.groupDisplayName.toLowerCase().includes(searchTerm.toLowerCase());

    const dropdown = useDropdownSelector({
        items: members,
        onSelect: (member) => onPayerChange(member.uid as UserId),
        filterFn,
        debounceMs: 0,
    });

    return {
        ...dropdown,
        filteredMembers: dropdown.filteredItems,
    };
}
