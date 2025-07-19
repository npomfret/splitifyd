import { v4 as uuidv4 } from 'uuid';

export interface TestUser {
  email: string;
  password: string;
  displayName: string;
}

export class UserBuilder {
  private user: TestUser;

  constructor() {
    const uniqueId = uuidv4().slice(0, 8);
    this.user = {
      email: `testuser-${uniqueId}@test.com`,
      password: 'Password123!',
      displayName: `Test User ${uniqueId}`
    };
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

  build(): TestUser {
    return { ...this.user };
  }
}