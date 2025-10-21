import type { Page } from '@playwright/test';
import type { CreateGroupFormData } from '@splitifyd/shared';
import { CreateGroupFormDataBuilder, DashboardPage as BaseDashboardPage, GroupDetailPage as SharedGroupDetailPage } from '@splitifyd/test-support';
import { GroupDetailPage, groupDetailUrlPattern } from './group-detail.page.ts';

export class DashboardPage extends BaseDashboardPage {
    protected override createGroupDetailPageInstance<T extends SharedGroupDetailPage = GroupDetailPage>(page: Page): T {
        return new GroupDetailPage(page) as unknown as T;
    }

    override async createMultiUserGroup<T extends SharedGroupDetailPage = GroupDetailPage>(
        optionsOrBuilder: CreateGroupFormData | CreateGroupFormDataBuilder = new CreateGroupFormDataBuilder(),
        ...dashboardPages: BaseDashboardPage[]
    ): Promise<T[]> {
        return super.createMultiUserGroup<T>(optionsOrBuilder, ...dashboardPages);
    }
}

export { groupDetailUrlPattern };
