import { Page } from '@playwright/test';
import { createAndLoginTestUser, TestUser } from './auth-utils';
import { CreateGroupModalPage } from '../pages';

/**
 * Creates multiple test users and has them join a group via share link.
 * Useful for multi-user collaboration tests.
 */
export async function createMultiUserGroup(
  browser: any,
  userCount: number = 3,
  groupName: string = 'Multi-User Test Group'
): Promise<{
  contexts: any[];
  pages: Page[];
  users: TestUser[];
  groupUrl: string;
}> {
  const contexts = [];
  const pages = [];
  const users = [];
  
  // Create contexts and pages for each user
  for (let i = 0; i < userCount; i++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    contexts.push(context);
    pages.push(page);
  }
  
  // First user creates the group
  const firstUser = await createAndLoginTestUser(pages[0]);
  users.push(firstUser);
  
  // Create group
  const createGroupModal = new CreateGroupModalPage(pages[0]);
  await pages[0].getByRole('button', { name: 'Create Group' }).click();
  await createGroupModal.createGroup(groupName, 'Testing with multiple users');
  
  await pages[0].waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
  const groupUrl = pages[0].url();
  
  // Other users join via direct navigation (simplified for now)
  for (let i = 1; i < userCount; i++) {
    const user = await createAndLoginTestUser(pages[i]);
    users.push(user);
    await pages[i].goto(groupUrl);
    await pages[i].waitForLoadState('networkidle');
  }
  
  return {
    contexts,
    pages,
    users,
    groupUrl
  };
}