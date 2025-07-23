import { v4 as uuidv4 } from 'uuid';
import type { User } from '@shared/apiTypes';

export class MemberBuilder {
  private member: User;

  constructor() {
    const uid = uuidv4();
    const displayName = `Test User ${uid.slice(0, 8)}`;
    this.member = {
      uid,
      displayName,
      email: `user-${uid.slice(0, 8)}@test.com`
    };
  }

  withUid(uid: string): this {
    this.member.uid = uid;
    return this;
  }

  withName(displayName: string): this {
    this.member.displayName = displayName;
    return this;
  }

  withEmail(email: string): this {
    this.member.email = email;
    return this;
  }

  build(): User {
    return { ...this.member };
  }
}