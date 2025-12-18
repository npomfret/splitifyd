import { Errors, ErrorDetail } from '../../errors';
import { logger } from '../../logger';
import type { PostmarkTokenProvider } from './postmark/PostmarkTokenProvider';
import type { EmailMessage, IEmailService } from './IEmailService';

interface PostmarkSendEmailRequest {
    From: string;
    To: string;
    Subject: string;
    TextBody: string;
    HtmlBody?: string;
    MessageStream: string;
}

interface PostmarkSendEmailResponse {
    To: string;
    SubmittedAt: string;
    MessageID: string;
    ErrorCode: number;
    Message: string;
}

export class PostmarkEmailService implements IEmailService {
    constructor(private readonly tokenProvider: PostmarkTokenProvider) {}

    async sendEmail(message: EmailMessage): Promise<void> {
        const token = await this.tokenProvider.getServerToken();

        const payload: PostmarkSendEmailRequest = {
            From: message.from,
            To: message.to,
            Subject: message.subject,
            TextBody: message.textBody,
            HtmlBody: message.htmlBody,
            MessageStream: message.messageStream,
        };

        const response = await fetch('https://api.postmarkapp.com/email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Postmark-Server-Token': token,
            },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            let successBody: PostmarkSendEmailResponse | undefined;
            try {
                successBody = (await response.json()) as PostmarkSendEmailResponse;
            } catch {
                // ignore
            }
            logger.info('email-sent', {
                to: message.to,
                subject: message.subject,
                messageId: successBody?.MessageID,
                submittedAt: successBody?.SubmittedAt,
            });
            return;
        }

        let errorBody: PostmarkSendEmailResponse | undefined;
        try {
            errorBody = (await response.json()) as PostmarkSendEmailResponse;
        } catch {
            // ignore
        }

        logger.error('Postmark send email failed', {
            status: response.status,
            errorCode: errorBody?.ErrorCode,
            message: errorBody?.Message,
            to: message.to,
            subject: message.subject,
        });

        throw response.status >= 500
            ? Errors.serviceError(ErrorDetail.EMAIL_SERVICE_ERROR)
            : Errors.unavailable(ErrorDetail.EMAIL_SERVICE_ERROR);
    }
}

