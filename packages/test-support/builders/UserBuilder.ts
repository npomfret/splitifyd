import { generateNewUserDetails} from "../test-helpers";

export interface TestUser {
    email: string;
    password: string;
    displayName: string;
}

export class UserBuilder {
    private user: TestUser;

    constructor() {
        this.user = generateNewUserDetails();
    }

    withEmail(email: string): this {
        this.user.email = email;
        return this;
    }

    withPassword(password: string): this {
        this.user.password = password;
        return this;
    }

    withDisplayName(displayName: string): this {
        this.user.displayName = displayName;
        return this;
    }

    withName(name: string): this {
        this.user.displayName = name;
        return this;
    }

    build(): TestUser {
        return { ...this.user };
    }
}
