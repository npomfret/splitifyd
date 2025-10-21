import { Page } from '@playwright/test';
import { GroupDetailPage as BaseGroupDetailPage, SettlementFormPage as SharedSettlementFormPage } from '@splitifyd/test-support';
import { SettlementFormPage as E2ESettlementFormPage } from './settlement-form.page';

export class GroupDetailPage extends BaseGroupDetailPage {
    override async clickSettleUpButton<T extends SharedSettlementFormPage = E2ESettlementFormPage>(
        expectedMemberCount: number,
        options: {
            createSettlementFormPage?: (page: Page) => T;
            waitForFormReady?: boolean;
            ensureModalVisible?: boolean;
        } = {},
    ): Promise<T> {
        return super.clickSettleUpButton<T>(expectedMemberCount, {
            ...options,
            createSettlementFormPage:
                options.createSettlementFormPage
                ?? ((page) => new E2ESettlementFormPage(page) as unknown as T),
        });
    }

    override async clickEditSettlement<T extends SharedSettlementFormPage = E2ESettlementFormPage>(
        settlementNote: string | RegExp,
        options: {
            createSettlementFormPage?: (page: Page) => T;
            expectedMemberCount?: number;
            waitForFormReady?: boolean;
            ensureUpdateHeading?: boolean;
        } = {},
    ): Promise<T> {
        return super.clickEditSettlement<T>(settlementNote, {
            ...options,
            createSettlementFormPage:
                options.createSettlementFormPage
                ?? ((page) => new E2ESettlementFormPage(page) as unknown as T),
            waitForFormReady: options.waitForFormReady ?? true,
        });
    }
}

export const groupDetailUrlPattern = BaseGroupDetailPage.groupDetailUrlPattern;
