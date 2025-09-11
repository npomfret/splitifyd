/**
 * Helper class for creating mock Firestore responses for testing
 * Used for mocking QuerySnapshot and DocumentSnapshot objects
 */
export class MockFirestoreBuilder {
    static createQuerySnapshot(docs: any[]) {
        return {
            docs: docs.map((doc) => ({
                id: doc.id || 'default-id',
                data: () => doc,
            })),
            empty: docs.length === 0,
        };
    }

    static createDocSnapshot(doc: any) {
        return {
            exists: true,
            id: doc.id || 'default-id',
            data: () => doc.data || doc,
        };
    }
}
