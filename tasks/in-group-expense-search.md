# In-Group Expense Search

## Feature Description

Implement a search tool within a group's context that allows users to search for any expense within that specific group. The search should be fast and typo-tolerant.

## Search Fields

The search should cover the following fields:
- Expense description
- Expense amount
- Expense category
- Notes

## Implementation Considerations

- **Firestore Limitations:** Firestore does not support native full-text search.
- **Third-Party Search Service:** This feature will leverage the same third-party search service implemented for the global search.
- **Recommended Service:** **Typesense** will be used to power this search functionality. We can filter the search results by `groupId`.

## Acceptance Criteria

- A search bar is available on the group detail page.
- Users can type a search query and see results in real-time, limited to the current group.
- Search results should be relevant and ranked appropriately.
- Clicking on a search result should navigate the user to the expense detail view within the group.
