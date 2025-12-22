import type { EmailMessage, IEmailService } from './IEmailService';

export class FakeEmailService implements IEmailService {
    private readonly sentMessages: EmailMessage[] = [];

    async sendEmail(message: EmailMessage): Promise<void> {
        this.sentMessages.push(message);
    }

    getSentMessages(): ReadonlyArray<EmailMessage> {
        return this.sentMessages;
    }
}
