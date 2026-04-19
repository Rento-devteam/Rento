import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmailSenderStub } from '../src/email/email-sender.stub';
import { ListingSearchIndexService } from '../src/search/listing-search-index.service';
import { UserStatus } from '@prisma/client';
import { createListingSearchIndexStub } from './stub-listing-search-index';

type UserRecord = {
  id: string;
  email: string | null;
  passwordHash: string | null;
  status: UserStatus;
  emailConfirmedAt: Date | null;
  telegramId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type EmailTokenRecord = {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

type TelegramCodeRecord = {
  id: string;
  code: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

type RefreshTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

class InMemoryPrismaService {
  private seq = 0;
  public users: UserRecord[] = [];
  public emailTokens: EmailTokenRecord[] = [];
  public telegramCodes: TelegramCodeRecord[] = [];
  public refreshTokens: RefreshTokenRecord[] = [];

  user = {
    findUnique: jest.fn(
      async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id) {
          return this.users.find((u) => u.id === where.id) ?? null;
        }
        if (where.email !== undefined) {
          return this.users.find((u) => u.email === where.email) ?? null;
        }
        return null;
      },
    ),
    findFirst: jest.fn(
      async ({
        where,
      }: {
        where: { telegramId?: string; id?: { not?: string } };
      }) => {
        return (
          this.users.find((u) => {
            if (where.telegramId && u.telegramId !== where.telegramId) {
              return false;
            }
            if (where.id?.not && u.id === where.id.not) {
              return false;
            }
            return true;
          }) ?? null
        );
      },
    ),
    create: jest.fn(
      async ({
        data,
      }: {
        data: {
          email?: string;
          passwordHash?: string;
          telegramId?: string;
          status: UserStatus;
        };
      }) => {
        const now = new Date();
        const row: UserRecord = {
          id: `user-${++this.seq}`,
          email: data.email ?? null,
          passwordHash: data.passwordHash ?? null,
          status: data.status,
          emailConfirmedAt: null,
          telegramId: data.telegramId ?? null,
          createdAt: now,
          updatedAt: now,
        };
        this.users.push(row);
        return row;
      },
    ),
    update: jest.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<UserRecord>;
      }) => {
        const user = this.users.find((u) => u.id === where.id);
        if (!user) {
          throw new Error('User not found');
        }
        Object.assign(user, data);
        user.updatedAt = new Date();
        return user;
      },
    ),
  };

  emailConfirmationToken = {
    create: jest.fn(
      async ({
        data,
      }: {
        data: { token: string; userId: string; expiresAt: Date };
      }) => {
        const row: EmailTokenRecord = {
          id: `email-token-${++this.seq}`,
          token: data.token,
          userId: data.userId,
          expiresAt: data.expiresAt,
          usedAt: null,
          createdAt: new Date(),
        };
        this.emailTokens.push(row);
        return row;
      },
    ),
    findFirst: jest.fn(
      async ({
        where,
      }: {
        where: { token: string; usedAt: null };
        include?: { user: true };
      }) => {
        const token = this.emailTokens.find(
          (t) => t.token === where.token && t.usedAt === null,
        );
        if (!token) {
          return null;
        }
        const user = this.users.find((u) => u.id === token.userId);
        return {
          ...token,
          user: user ?? null,
        };
      },
    ),
    update: jest.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<EmailTokenRecord>;
      }) => {
        const token = this.emailTokens.find((t) => t.id === where.id);
        if (!token) {
          throw new Error('Token not found');
        }
        Object.assign(token, data);
        return token;
      },
    ),
  };

  telegramLinkCode = {
    create: jest.fn(
      async ({
        data,
      }: {
        data: { code: string; userId: string; expiresAt: Date };
      }) => {
        const row: TelegramCodeRecord = {
          id: `tg-code-${++this.seq}`,
          code: data.code,
          userId: data.userId,
          expiresAt: data.expiresAt,
          usedAt: null,
          createdAt: new Date(),
        };
        this.telegramCodes.push(row);
        return row;
      },
    ),
    findFirst: jest.fn(
      async ({ where }: { where: { code: string; usedAt: null } }) => {
        return (
          this.telegramCodes.find(
            (t) => t.code === where.code && t.usedAt === null,
          ) ?? null
        );
      },
    ),
    update: jest.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<TelegramCodeRecord>;
      }) => {
        const code = this.telegramCodes.find((c) => c.id === where.id);
        if (!code) {
          throw new Error('Code not found');
        }
        Object.assign(code, data);
        return code;
      },
    ),
  };

  refreshToken = {
    create: jest.fn(
      async ({
        data,
      }: {
        data: {
          userId: string;
          tokenHash: string;
          expiresAt: Date;
        };
      }) => {
        const row: RefreshTokenRecord = {
          id: `refresh-${++this.seq}`,
          userId: data.userId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          revokedAt: null,
          createdAt: new Date(),
        };
        this.refreshTokens.push(row);
        return row;
      },
    ),
  };

  $transaction = jest.fn(async (actions: Promise<unknown>[]) => {
    await Promise.all(actions);
    return [];
  });
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: InMemoryPrismaService;
  const emailSender = {
    sendConfirmationEmail: jest.fn(async () => undefined),
  };

  beforeEach(async () => {
    process.env.BOT_SECRET = 'test-bot-secret';
    prisma = new InMemoryPrismaService();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(EmailSenderStub)
      .useValue(emailSender)
      .overrideProvider(ListingSearchIndexService)
      .useValue(createListingSearchIndexStub())
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
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
    const emailToken = prisma.emailTokens.find((t) => t.userId === userId);
    expect(emailToken).toBeDefined();

    const confirmResponse = await request(app.getHttpServer())
      .get('/confirm-email')
      .query({ token: emailToken?.token })
      .expect(200);

    expect(confirmResponse.body.accessToken).toBeDefined();

    const linkResponse = await request(app.getHttpServer())
      .post('/telegram/link')
      .set(
        'Authorization',
        `Bearer ${confirmResponse.body.accessToken as string}`,
      )
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
    const emailToken = prisma.emailTokens.find((t) => t.userId === userId);
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

    const user = prisma.users.find(
      (u) => u.telegramId === 'telegram-only-user-001',
    );
    expect(user).toBeDefined();
    expect(user?.status).toBe(UserStatus.ACTIVE);
  });
});
