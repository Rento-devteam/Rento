import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface SendConfirmationInput {
  email: string;
  confirmationUrl: string;
}

@Injectable()
export class EmailSenderStub {
  private readonly logger = new Logger(EmailSenderStub.name);
  private readonly smtpService = process.env.SMTP_SERVICE ?? '';
  private readonly smtpHost = process.env.SMTP_HOST ?? '';
  private readonly smtpPort = Number(process.env.SMTP_PORT ?? 587);
  private readonly smtpSecure = (process.env.SMTP_SECURE ?? 'false') === 'true';
  private readonly smtpUser = process.env.SMTP_USER ?? '';
  private readonly smtpPass = process.env.SMTP_PASS ?? '';
  private readonly smtpFrom = process.env.SMTP_FROM ?? '';
  private readonly smtpRequireTls =
    (process.env.SMTP_REQUIRE_TLS ?? 'true').toLowerCase() === 'true';
  private readonly smtpDebug = (process.env.SMTP_DEBUG ?? 'false').toLowerCase() === 'true';
  private readonly isSmtpConfigured =
    (Boolean(this.smtpService) || Boolean(this.smtpHost)) &&
    Boolean(this.smtpUser) &&
    Boolean(this.smtpPass) &&
    Boolean(this.smtpFrom);

  async sendConfirmationEmail(input: SendConfirmationInput): Promise<void> {
    if (!this.isSmtpConfigured) {
      throw new InternalServerErrorException(
        'SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM.',
      );
    }

    const baseTransportOptions = this.smtpService
      ? {
          service: this.smtpService,
          auth: { user: this.smtpUser, pass: this.smtpPass },
        }
      : {
          host: this.smtpHost,
          port: this.smtpPort,
          secure: this.smtpSecure,
          auth: { user: this.smtpUser, pass: this.smtpPass },
          tls: {
            // Gmail expects modern TLS; we keep defaults but allow runtime override.
            servername: this.smtpHost,
          },
        };

    const transporter = nodemailer.createTransport({
      ...baseTransportOptions,
      requireTLS: this.smtpRequireTls,
      logger: this.smtpDebug,
      debug: this.smtpDebug,
      // Avoid indefinite hangs on firewalls / blocked ports.
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 20_000,
    } as any);

    // Fail fast with a clear error if SMTP auth/handshake is wrong.
    await transporter.verify();

    const info = await transporter.sendMail({
      from: this.smtpFrom,
      to: input.email,
      subject: 'Rento: Confirm your email',
      text: `Please confirm your email by opening this link: ${input.confirmationUrl}`,
      html: `<p>Please confirm your email by opening this link:</p><p><a href="${input.confirmationUrl}">${input.confirmationUrl}</a></p>`,
    });

    this.logger.log(`Confirmation email sent to ${input.email} (messageId=${info.messageId})`);
  }
}
