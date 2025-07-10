# Webapp Issue: Efficient DOM Updates

## Issue Description

The application frequently re-renders large lists of items (e.g., expenses, groups) from scratch, causing UI jank and slow performance.

## Recommendation

Implement Targeted DOM Updates. Instead of full re-renders, adopt a strategy of making minimal, targeted changes to the DOM. When a single item changes, only the corresponding DOM element should be updated. Use a Keyed-List Strategy by assigning a unique `data-id` attribute to each element in a list. Develop Granular Rendering Functions like `addListItem`, `updateListItem`, and `removeListItem` to handle individual item changes without affecting the rest of the list.

## Implementation Suggestions

1.  **Identify Lists for Optimization:**
    *   `webapp/src/js/groups.ts` (for groups list)
    *   `webapp/src/js/group-detail.ts` (for expenses list)

2.  **Implement Keyed-List Strategy:**
    *   Ensure each list item rendered has a unique `data-id` attribute corresponding to its data model's ID.
    *   **Example (in `groups.ts` `renderGroupCard` or `group-detail.ts` `createExpenseItem`):
        ```html
        <div class="group-card" data-id="${group.id}">
            <!-- ... content ... -->
        </div>
        ```

3.  **Develop Granular Rendering Functions:**
    *   Instead of clearing and re-appending all items, create functions that can:
        *   `addListItem(itemData)`: Create and append a new list item.
        *   `updateListItem(itemId, newData)`: Find an existing item by `data-id` and update its content.
        *   `removeListItem(itemId)`: Find and remove an item by `data-id`.
    *   **Example (Conceptual for `groups.ts`):
        ```typescript
        // webapp/src/js/groups.ts
        // ...

        private updateGroupInList(updatedGroup: TransformedGroup): void {
            const existingCard = this.container.querySelector(`[data-id="${updatedGroup.id}"]`);
            if (existingCard) {
                // Update content of existingCard based on updatedGroup
                // e.g., update balance, last activity, etc.
                // This avoids re-rendering the entire list
                const newCardHtml = this.renderGroupCard(updatedGroup);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = newCardHtml;
                existingCard.replaceWith(tempDiv.firstElementChild!);
            }
        }

        private addGroupToList(newGroup: TransformedGroup): void {
            const newCardHtml = this.renderGroupCard(newGroup);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = newCardHtml;
            const groupsGrid = this.container.querySelector('.groups-grid');
            if (groupsGrid) {
                groupsGrid.prepend(tempDiv.firstElementChild!); // Add to top
            }
        }

        private removeGroupFromList(groupId: string): void {
            const existingCard = this.container.querySelector(`[data-id="${groupId}"]`);
            if (existingCard) {
                existingCard.remove();
            }
        }
        ```

**Next Steps:**
1.  Refactor `GroupsList` in `groups.ts` to use targeted DOM updates when groups are added, updated, or deleted.
2.  Refactor expense rendering in `group-detail.ts` to use similar targeted updates.
3.  Ensure that data changes (e.g., from API responses) trigger these granular update functions.
