import type { Email } from '@billsplit-wl/shared';

export interface EmailMessage {
    to: Email;
    from: Email;
    subject: string;
    textBody: string;
    htmlBody?: string;
}

export interface IEmailService {
    sendEmail(message: EmailMessage): Promise<void>;
}

