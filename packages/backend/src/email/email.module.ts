import { Module } from '@nestjs/common';
import { EmailSenderStub } from './email-sender.stub';

@Module({
  providers: [EmailSenderStub],
  exports: [EmailSenderStub],
})
export class EmailModule {}
