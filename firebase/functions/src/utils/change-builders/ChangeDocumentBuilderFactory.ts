import { IChangeDocumentBuilder } from './IChangeDocumentBuilder';
import { GroupChangeDocumentBuilder } from './GroupChangeDocumentBuilder';
import { ExpenseChangeDocumentBuilder } from './ExpenseChangeDocumentBuilder';
import { SettlementChangeDocumentBuilder } from './SettlementChangeDocumentBuilder';

/**
 * Factory for creating appropriate change document builders
 *
 * This factory eliminates the need for conditional type logic by providing
 * a centralized mechanism for selecting the correct builder implementation
 * based on entity type. It follows the same pattern established in Phase 3
 * with the CommentService strategy factory.
 */
export class ChangeDocumentBuilderFactory {
    /**
     * Get the appropriate change document builder for the specified entity type
     *
     * @param entityType - The type of entity ('group', 'expense', or 'settlement')
     * @returns The appropriate builder instance
     * @throws Error if entity type is not supported
     */
    getBuilder(entityType: 'group' | 'expense' | 'settlement'): IChangeDocumentBuilder {
        switch (entityType) {
            case 'group':
                return new GroupChangeDocumentBuilder();
            case 'expense':
                return new ExpenseChangeDocumentBuilder();
            case 'settlement':
                return new SettlementChangeDocumentBuilder();
            default:
                throw new Error(`Unsupported entity type for change document builder: ${entityType}`);
        }
    }
}
