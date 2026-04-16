import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface SendConfirmationInput {
  email: string;
  confirmationUrl: string;
}

@Injectable()
export class EmailSenderStub {
  private readonly logger = new Logger(EmailSenderStub.name);
  private readonly smtpHost = process.env.SMTP_HOST ?? '';
  private readonly smtpPort = Number(process.env.SMTP_PORT ?? 587);
  private readonly smtpSecure = (process.env.SMTP_SECURE ?? 'false') === 'true';
  private readonly smtpUser = process.env.SMTP_USER ?? '';
  private readonly smtpPass = process.env.SMTP_PASS ?? '';
  private readonly smtpFrom = process.env.SMTP_FROM ?? '';

  async sendConfirmationEmail(input: SendConfirmationInput): Promise<void> {
    // If SMTP is configured, send a real email.
    if (this.smtpHost && this.smtpUser && this.smtpPass && this.smtpFrom) {
      const transporter = nodemailer.createTransport({
        host: this.smtpHost,
        port: this.smtpPort,
        secure: this.smtpSecure,
        auth: {
          user: this.smtpUser,
          pass: this.smtpPass,
        },
      });

      await transporter.sendMail({
        from: this.smtpFrom,
        to: input.email,
        subject: 'Rento: Confirm your email',
        text: `Please confirm your email by opening this link: ${input.confirmationUrl}`,
        html: `<p>Please confirm your email by opening this link:</p><p><a href="${input.confirmationUrl}">${input.confirmationUrl}</a></p>`,
      });

      this.logger.log(`Confirmation email sent to ${input.email}`);
      return;
    }

    // Fallback for local dev if SMTP is not set.
    this.logger.log(
      `Confirmation email for ${input.email}: ${input.confirmationUrl}`,
    );
  }
}
