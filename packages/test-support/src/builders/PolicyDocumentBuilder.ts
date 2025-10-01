/**
 * Builder for creating policy documents for tests
 * Used for testing Firestore security rules
 */
export class PolicyDocumentBuilder {
    private document: any;

    constructor() {
        this.document = {
            type: 'privacy',
            version: '1.0.0',
            content: 'Default policy content for testing...',
            createdAt: new Date(),
        };
    }

    withType(type: 'privacy' | 'terms' | 'cookie'): this {
        this.document.type = type;
        return this;
    }

    withVersion(version: string): this {
        this.document.version = version;
        return this;
    }

    withContent(content: string): this {
        this.document.content = content;
        return this;
    }

    withCreatedAt(date: Date): this {
        this.document.createdAt = date;
        return this;
    }

    build(): any {
        return { ...this.document };
    }
}