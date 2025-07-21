import { v4 as uuidv4 } from 'uuid';
import { User } from '../ApiDriver';

export interface TestGroup {
  name: string;
  description?: string;
  memberEmails?: string[];
  members?: Array<{
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
      name: `Test Group ${uuidv4().slice(0, 8)}`
    };
  }

  withName(name: string): this {
    this.group.name = name;
    return this;
  }

  withDescription(description: string): this {
    this.group.description = description;
    return this;
  }

  withMemberEmails(emails: string[]): this {
    this.group.memberEmails = emails;
    return this;
  }

  withMembers(users: User[]): this {
    // Convert users to member emails for API compatibility
    this.group.memberEmails = users.map(user => user.email);
    
    // Store full member details for internal use
    if (!this.group.members) {
      this.group.members = [];
    }
    this.group.members = users.map(user => ({
      uid: user.uid,
      email: user.email,
      name: user.displayName,
      initials: user.displayName.split(' ').map(n => n[0]).join('')
    }));
    return this;
  }

  withMember(user: User): this {
    // Add user email to memberEmails for API compatibility
    if (!this.group.memberEmails) {
      this.group.memberEmails = [];
    }
    if (!this.group.memberEmails.includes(user.email)) {
      this.group.memberEmails.push(user.email);
    }
    
    // Store full member details for internal use
    if (!this.group.members) {
      this.group.members = [];
    }
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
    const result: TestGroup = {
      name: this.group.name
    };
    
    if (this.group.description !== undefined) {
      result.description = this.group.description;
    }
    
    if (this.group.memberEmails !== undefined) {
      result.memberEmails = this.group.memberEmails;
    }
    
    // Don't include members field in the built object as it's not accepted by API
    // Members field is only used internally for test tracking
    
    return result;
  }
}