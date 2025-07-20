
# Optimise Data Structures for Performance

## Task

Review and refactor the Firestore data structures to optimize for performance, focusing on denormalization, document size, and the appropriate use of subcollections.

## Background

Our current data structures may not be optimized for all query patterns, leading to slow queries and unnecessary data fetching. By optimizing our data structures, we can improve performance and reduce costs.

This task has dependencies on `webapp-efficient-queries.md` as the data structure will influence the queries required.

## Implementation Strategy

1.  **Analyze query patterns**: Identify the most common query patterns in the application.
2.  **Denormalize data**: To avoid complex and slow queries, duplicate related data across multiple documents or collections. This reduces the need for expensive "join" operations on the client side. For example, if you frequently need to display the author's name next to a post, you could store the author's name in the post document itself, in addition to the user document.
3.  **Keep documents small**: Large documents are slower to retrieve and update. If a document is approaching the 1 MiB limit, split it into smaller, related documents in a subcollection. For example, a `group` document could have a subcollection for `expenses` instead of storing all expenses in an array within the group document.
4.  **Use subcollections strategically**: Use subcollections for data that is strongly associated with a parent document. However, if you need to query across different parent documents (e.g., get all expenses for a user across all groups), a root-level collection might be more efficient. A hybrid approach can also be effective.
5.  **Refactor the application code**: Update the application code to work with the new data structures.
6.  **Test the performance improvements**: After refactoring, test the performance of the application to ensure that the changes have had a positive impact.
