import { v4 as uuidv4 } from 'uuid';
import type { User, CreateGroupRequest } from '../../../src/types/webapp-shared-types';

export class GroupBuilder {
  private group: CreateGroupRequest;

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

  withMembers(users: (User | {uid: string; displayName: string; email: string; [key: string]: any})[]): this {
    // Convert users to member emails for API compatibility
    this.group.memberEmails = users.map(user => user.email);
    
    // Store full member details for internal use
    this.group.members = users.map(user => ({
      uid: user.uid,
      displayName: user.displayName,
      email: user.email
    }));
    return this;
  }

  withMember(user: User | {uid: string; displayName: string; email: string; [key: string]: any}): this {
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
    const member: User = {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email
    };
    
    const existingIndex = this.group.members.findIndex(m => m.uid === user.uid);
    if (existingIndex >= 0) {
      this.group.members[existingIndex] = member;
    } else {
      this.group.members.push(member);
    }
    return this;
  }

  build(): CreateGroupRequest {
    const result: CreateGroupRequest = {
      name: this.group.name
    };
    
    if (this.group.description !== undefined) {
      result.description = this.group.description;
    }
    
    if (this.group.memberEmails !== undefined) {
      result.memberEmails = this.group.memberEmails;
    }
    
    if (this.group.members !== undefined) {
      result.members = this.group.members;
    }
    
    return result;
  }

}