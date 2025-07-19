import { v4 as uuidv4 } from 'uuid';
import { User } from '../ApiDriver';

export interface TestGroup {
  name: string;
  members: Array<{
    uid: string;
    email: string;
    name: string;
    initials: string;
  }>;
}

export class GroupBuilder {
  private group: TestGroup;

  constructor() {
    this.group = {
      name: `Test Group ${uuidv4().slice(0, 8)}`,
      members: []
    };
  }

  withName(name: string): this {
    this.group.name = name;
    return this;
  }

  withMembers(users: User[]): this {
    this.group.members = users.map(user => ({
      uid: user.uid,
      email: user.email,
      name: user.displayName,
      initials: user.displayName.split(' ').map(n => n[0]).join('')
    }));
    return this;
  }

  withMember(user: User): this {
    const member = {
      uid: user.uid,
      email: user.email,
      name: user.displayName,
      initials: user.displayName.split(' ').map(n => n[0]).join('')
    };
    
    const existingIndex = this.group.members.findIndex(m => m.uid === user.uid);
    if (existingIndex >= 0) {
      this.group.members[existingIndex] = member;
    } else {
      this.group.members.push(member);
    }
    return this;
  }

  build(): TestGroup {
    return {
      name: this.group.name,
      members: [...this.group.members]
    };
  }
}