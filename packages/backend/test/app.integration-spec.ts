import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { UserStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { EmailSenderStub } from '../src/email/email-sender.stub';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase } from './db/clean-database';

describe('App (integration, Postgres)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const emailSender = {
    sendConfirmationEmail: jest.fn(async () => undefined),
  };

  beforeEach(async () => {
    process.env.BOT_SECRET = 'test-bot-secret';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailSenderStub)
      .useValue(emailSender)
      .compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get(PrismaService);
    await app.init();
    await cleanDatabase(prisma);
  });

  afterEach(async () => {
    await app.close();
  });

  it('runs register -> confirm-email -> telegram-link -> telegram-verify -> login flow', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/register')
      .send({
        email: 'flow@example.com',
        password: 'StrongPass1!',
        confirmPassword: 'StrongPass1!',
      })
      .expect(201);

    expect(registerResponse.body.status).toBe('pending_confirmation');
    const userId = registerResponse.body.userId as string;
    const emailToken = await prisma.emailConfirmationToken.findFirst({
      where: { userId },
    });
    expect(emailToken).toBeDefined();

    const confirmResponse = await request(app.getHttpServer())
      .get('/confirm-email')
      .query({ token: emailToken?.token })
      .expect(200);

    expect(confirmResponse.body.accessToken).toBeDefined();

    const linkResponse = await request(app.getHttpServer())
      .post('/telegram/link')
      .set('Authorization', `Bearer ${confirmResponse.body.accessToken as string}`)
      .expect(201);

    expect(linkResponse.body.code).toBeDefined();
    const code = linkResponse.body.code as string;

    const verifyResponse = await request(app.getHttpServer())
      .post('/telegram/verify')
      .send({
        code,
        telegramId: 'telegram-user-001',
      })
      .expect(201);

    expect(verifyResponse.body.accessToken).toBeDefined();
    expect(verifyResponse.body.user.status).toBe(UserStatus.ACTIVE);

    await request(app.getHttpServer())
      .post('/login')
      .send({
        email: 'flow@example.com',
        password: 'StrongPass1!',
      })
      .expect(201);
  });

  it('allows login after email confirmation even without telegram link', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/register')
      .send({
        email: 'email-only@example.com',
        password: 'StrongPass1!',
        confirmPassword: 'StrongPass1!',
      })
      .expect(201);

    const userId = registerResponse.body.userId as string;
    const emailToken = await prisma.emailConfirmationToken.findFirst({
      where: { userId },
    });
    expect(emailToken).toBeDefined();

    await request(app.getHttpServer())
      .get('/confirm-email')
      .query({ token: emailToken?.token })
      .expect(200);

    const loginResponse = await request(app.getHttpServer())
      .post('/login')
      .send({
        email: 'email-only@example.com',
        password: 'StrongPass1!',
      })
      .expect(201);

    expect(loginResponse.body.accessToken).toBeDefined();
    expect(loginResponse.body.user.status).toBe(UserStatus.ACTIVE);
    expect(loginResponse.body.user.email).toBe('email-only@example.com');
  });

  it('registers and logs in with telegram only flow', async () => {
    const response = await request(app.getHttpServer())
      .post('/telegram/auth')
      .set('x-bot-secret', 'test-bot-secret')
      .send({
        telegramId: 'telegram-only-user-001',
      })
      .expect(201);

    expect(response.body.accessToken).toBeDefined();
    expect(response.body.user.status).toBe(UserStatus.ACTIVE);
    expect(response.body.user.email).toBeNull();

    const user = await prisma.user.findUnique({
      where: { telegramId: 'telegram-only-user-001' },
    });
    expect(user).toBeDefined();
    expect(user?.status).toBe(UserStatus.ACTIVE);
  });
});
