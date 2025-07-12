
# Implement Efficient Queries with Indexing and Pagination

## Task

Improve the performance of Firestore queries in the webapp by creating composite indexes for complex queries and implementing pagination for large datasets.

## Background

Some queries in the webapp may be slow due to a lack of proper indexing. Additionally, fetching large datasets without pagination can lead to high read costs and a poor user experience.

This task is a dependency for `webapp-advanced-search-filters` and `webapp-data-visualization` as those features will rely on efficient querying of large datasets.

## Implementation Strategy

1.  **Identify slow queries**: Use the Firebase console and application logs to identify queries that are performing poorly.
2.  **Create composite indexes**: For each slow query, create the necessary composite index in `firestore.indexes.json` and deploy it. The Firebase console will often provide an error message with a direct link to create a missing index.
3.  **Implement pagination**: For views that display large lists of data, implement pagination using `startAfter()` with a document snapshot (a cursor) to fetch data in smaller chunks. Avoid using `offset()`, which is inefficient.

    ```javascript
    import { collection, query, orderBy, startAfter, limit, getDocs } from "firebase/firestore";

    async function getNextPage(lastVisible) {
      const q = query(
        collection(db, "items"),
        orderBy("createdAt"),
        startAfter(lastVisible),
        limit(25)
      );

      const documentSnapshots = await getDocs(q);

      const newLastVisible = documentSnapshots.docs[documentSnapshots.docs.length-1];
      return { documents: documentSnapshots.docs, lastVisible: newLastVisible };
    }
    ```
4.  **Test the performance improvements**: After implementing these changes, test the performance of the affected queries to ensure that they are faster and more efficient.
