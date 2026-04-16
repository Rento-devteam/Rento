import 'dotenv/config';
import { lookup } from 'dns/promises';
import { EmailSenderStub } from './email-sender.stub';

async function main() {
  const to = process.env.EMAIL_TEST_TO || process.env.SMTP_USER;
  if (!to) {
    throw new Error('Missing EMAIL_TEST_TO (or SMTP_USER) in environment');
  }

  if (!process.env.SMTP_DEBUG) {
    process.env.SMTP_DEBUG = 'true';
  }

  // eslint-disable-next-line no-console
  console.log(`Sending test email to ${to}...`);

  const host = process.env.SMTP_HOST;
  if (host) {
    // eslint-disable-next-line no-console
    console.log(`Resolving ${host}...`);
    const resolved = await lookup(host);
    // eslint-disable-next-line no-console
    console.log(`Resolved ${host} -> ${resolved.address} (family=${resolved.family})`);
  }

  const sender = new EmailSenderStub();
  await Promise.race([
    sender.sendConfirmationEmail({
      email: to,
      confirmationUrl: `${process.env.APP_BASE_URL ?? 'http://localhost:3000'}/confirm-email?token=TEST_TOKEN`,
    }),
    new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Timed out after 30s waiting for SMTP')), 30_000);
    }),
  ]);
  // eslint-disable-next-line no-console
  console.log('Done.');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

