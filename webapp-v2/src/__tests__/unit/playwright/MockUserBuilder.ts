import { UserBuilder } from '@splitifyd/test-support';
import type { MockUser } from './setup';

/**
 * Builder for MockUser objects used in Playwright UI tests
 * Extends the existing UserBuilder to add UI-specific properties
 */
export class MockUserBuilder {
    private userBuilder: UserBuilder;
    private uid: string;
    private photoURL?: string;

    constructor() {
        this.userBuilder = new UserBuilder();
        this.uid = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.photoURL = 'https://via.placeholder.com/150';
    }

    withUid(uid: string): this {
        this.uid = uid;
        return this;
    }

    withEmail(email: string): this {
        this.userBuilder.withEmail(email);
        return this;
    }

    withDisplayName(displayName: string): this {
        this.userBuilder.withDisplayName(displayName);
        return this;
    }

    withName(name: string): this {
        this.userBuilder.withName(name);
        return this;
    }

    withPassword(password: string): this {
        this.userBuilder.withPassword(password);
        return this;
    }

    withPhotoURL(photoURL: string): this {
        this.photoURL = photoURL;
        return this;
    }

    withoutPhoto(): this {
        this.photoURL = undefined;
        return this;
    }

    build(): MockUser {
        const testUser = this.userBuilder.build();
        
        return {
            uid: this.uid,
            email: testUser.email,
            displayName: testUser.displayName,
            photoURL: this.photoURL,
        };
    }

    // Convenience methods for common user types
    static testUser(): MockUserBuilder {
        return new MockUserBuilder()
            .withUid('test-user-123')
            .withEmail('testuser@example.com')
            .withDisplayName('Test User');
    }

    static adminUser(): MockUserBuilder {
        return new MockUserBuilder()
            .withUid('admin-user-456')
            .withEmail('admin@example.com')
            .withDisplayName('Admin User');
    }

    static regularUser(suffix: string = ''): MockUserBuilder {
        return new MockUserBuilder()
            .withEmail(`user${suffix}@example.com`)
            .withDisplayName(`User ${suffix || 'Member'}`);
    }
}