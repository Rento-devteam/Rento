import { Injectable, Logger } from '@nestjs/common';

export interface SendConfirmationInput {
  email: string;
  confirmationUrl: string;
}

@Injectable()
export class EmailSenderStub {
  private readonly logger = new Logger(EmailSenderStub.name);

  async sendConfirmationEmail(input: SendConfirmationInput): Promise<void> {
    this.logger.log(
      `Confirmation email for ${input.email}: ${input.confirmationUrl}`,
    );
  }
}
