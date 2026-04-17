import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ListingStatus,
  RentalPeriod,
  UserRole,
  UserStatus,
} from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { EmailSenderStub } from '../src/email/email-sender.stub';
import { PrismaService } from '../src/prisma/prisma.service';

type UserRecord = {
  id: string;
  email: string | null;
  passwordHash: string | null;
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  emailConfirmedAt: Date | null;
  telegramId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CategoryRecord = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type ListingRecord = {
  id: string;
  ownerId: string;
  categoryId: string;
  title: string;
  description: string;
  rentalPrice: number;
  rentalPeriod: RentalPeriod;
  depositAmount: number;
  status: ListingStatus;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date;
  updatedAt: Date;
};

class InMemoryPrismaService {
  private listingSeq = 0;

  public users: UserRecord[] = [];
  public categories: CategoryRecord[] = [];
  public listings: ListingRecord[] = [];

  user = {
    findUnique: jest.fn(
      async ({
        where,
        select,
      }: {
        where: { id?: string; email?: string };
        select?: { id?: true; status?: true };
      }) => {
        const user =
          this.users.find((entry) =>
            where.id ? entry.id === where.id : entry.email === where.email,
          ) ?? null;
        if (!user) {
          return null;
        }
        if (!select) {
          return user;
        }

        return {
          ...(select.id ? { id: user.id } : {}),
          ...(select.status ? { status: user.status } : {}),
        };
      },
    ),
  };

  category = {
    findMany: jest.fn(
      async ({
        where,
      }: {
        where?: { isActive?: boolean };
        orderBy?: Array<{ order?: 'asc' | 'desc'; name?: 'asc' | 'desc' }>;
      }) => {
        const filtered = this.categories.filter((category) =>
          where?.isActive === undefined ? true : category.isActive === where.isActive,
        );
        return filtered.sort((left, right) => {
          if (left.order !== right.order) {
            return left.order - right.order;
          }
          return left.name.localeCompare(right.name);
        });
      },
    ),
    findFirst: jest.fn(async ({ where }: { where: { id: string; isActive?: boolean } }) => {
      return (
        this.categories.find(
          (category) =>
            category.id === where.id &&
            (where.isActive === undefined || category.isActive === where.isActive),
        ) ?? null
      );
    }),
  };

  listing = {
    create: jest.fn(
      async ({
        data,
      }: {
        data: {
          ownerId: string;
          categoryId: string;
          title: string;
          description: string;
          rentalPrice: number;
          rentalPeriod: RentalPeriod;
          depositAmount: number;
          status: ListingStatus;
          latitude: number | null;
          longitude: number | null;
        };
        include?: {
          category?: true;
          photos?: { orderBy: { order: 'asc' | 'desc' } };
        };
      }) => {
        const now = new Date();
        const listing: ListingRecord = {
          id: `listing-${++this.listingSeq}`,
          ownerId: data.ownerId,
          categoryId: data.categoryId,
          title: data.title,
          description: data.description,
          rentalPrice: data.rentalPrice,
          rentalPeriod: data.rentalPeriod,
          depositAmount: data.depositAmount,
          status: data.status,
          latitude: data.latitude,
          longitude: data.longitude,
          createdAt: now,
          updatedAt: now,
        };
        this.listings.push(listing);

        const category = this.categories.find(
          (entry) => entry.id === listing.categoryId,
        );
        if (!category) {
          throw new Error('Category not found');
        }

        return {
          ...listing,
          category,
          photos: [],
        };
      },
    ),
  };
}

describe('ListingsController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: InMemoryPrismaService;
  let jwtService: JwtService;

  const activeCategoryId = '11111111-1111-4111-8111-111111111111';
  const inactiveCategoryId = '22222222-2222-4222-8222-222222222222';
  const activeUserId = '33333333-3333-4333-8333-333333333333';
  const bannedUserId = '44444444-4444-4444-8444-444444444444';

  beforeEach(async () => {
    prisma = new InMemoryPrismaService();
    prisma.categories.push(
      {
        id: activeCategoryId,
        name: 'Tools',
        slug: 'tools',
        icon: null,
        order: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: inactiveCategoryId,
        name: 'Vehicles',
        slug: 'vehicles',
        icon: null,
        order: 2,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );
    prisma.users.push(
      {
        id: activeUserId,
        email: 'active@example.com',
        passwordHash: null,
        fullName: 'Active User',
        phone: null,
        avatarUrl: null,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        emailConfirmedAt: new Date(),
        telegramId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: bannedUserId,
        email: 'banned@example.com',
        passwordHash: null,
        fullName: 'Banned User',
        phone: null,
        avatarUrl: null,
        role: UserRole.USER,
        status: UserStatus.BANNED,
        emailConfirmedAt: new Date(),
        telegramId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(EmailSenderStub)
      .useValue({
        sendConfirmationEmail: jest.fn(async () => undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    jwtService = moduleFixture.get(JwtService);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns listing create metadata for active users', async () => {
    const response = await request(app.getHttpServer())
      .get('/listings/create')
      .set('Authorization', `Bearer ${await issueAccessToken(activeUserId, UserStatus.ACTIVE)}`)
      .expect(200);

    expect(response.body.categories).toHaveLength(1);
    expect(response.body.categories[0].id).toBe(activeCategoryId);
    expect(response.body.limits.maxPhotos).toBe(10);
    expect(response.body.priceRules.supportedPeriods).toEqual(
      Object.values(RentalPeriod),
    );
  });

  it('rejects invalid payloads with 422', async () => {
    await request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${await issueAccessToken(activeUserId, UserStatus.ACTIVE)}`)
      .send({
        categoryId: activeCategoryId,
        title: '',
      })
      .expect(422);
  });

  it('rejects negative rental price and deposit with 422', async () => {
    await request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${await issueAccessToken(activeUserId, UserStatus.ACTIVE)}`)
      .send({
        categoryId: activeCategoryId,
        title: 'Drill',
        description: 'Power drill',
        rentalPrice: -1,
        rentalPeriod: RentalPeriod.DAY,
        depositAmount: -10,
      })
      .expect(422);
  });

  it('rejects blocked users', async () => {
    await request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${await issueAccessToken(bannedUserId, UserStatus.BANNED)}`)
      .send({
        categoryId: activeCategoryId,
        title: 'Drill',
        description: 'Power drill',
        rentalPrice: 100,
        rentalPeriod: RentalPeriod.DAY,
        depositAmount: 300,
      })
      .expect(403);
  });

  it('creates a listing draft and returns next step', async () => {
    const response = await request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${await issueAccessToken(activeUserId, UserStatus.ACTIVE)}`)
      .send({
        categoryId: activeCategoryId,
        title: 'Cordless Drill',
        description: '18V cordless drill in good condition',
        rentalPrice: 300,
        rentalPeriod: RentalPeriod.DAY,
        depositAmount: 1500,
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.status).toBe(ListingStatus.DRAFT);
    expect(response.body.nextStep).toBe('upload_photos');
    expect(prisma.listings).toHaveLength(1);
    expect(prisma.listings[0].title).toBe('Cordless Drill');
  });

  async function issueAccessToken(userId: string, status: UserStatus) {
    return jwtService.signAsync(
      {
        sub: userId,
        email: `${userId}@example.com`,
        role: UserRole.USER,
        status,
      },
      {
        secret: process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret',
      },
    );
  }
});
