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
import {
  ListingPhotoStorage,
  StoredListingPhoto,
  UploadListingPhotoInput,
} from '../src/listings/listing-photo-storage.service';
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

type ListingPhotoRecord = {
  id: string;
  listingId: string;
  url: string;
  thumbnailUrl: string | null;
  order: number;
  isPrimary: boolean;
  uploadedAt: Date;
};

class InMemoryPrismaService {
  private listingSeq = 0;
  private listingPhotoSeq = 0;

  public users: UserRecord[] = [];
  public categories: CategoryRecord[] = [];
  public listings: ListingRecord[] = [];
  public listingPhotos: ListingPhotoRecord[] = [];

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
          photos: this.getListingPhotos(listing.id),
        };
      },
    ),
    findUnique: jest.fn(
      async ({
        where,
        select,
      }: {
        where: { id: string };
        select?: {
          id?: true;
          ownerId?: true;
          status?: true;
          photos?:
            | { orderBy?: { order: 'asc' | 'desc' } }
            | { select: { id: true } };
        };
      }) => {
        const listing = this.listings.find((entry) => entry.id === where.id) ?? null;
        if (!listing) {
          return null;
        }

        const photos = this.getListingPhotos(listing.id);
        if (!select) {
          return { ...listing, photos };
        }

        return {
          ...(select.id ? { id: listing.id } : {}),
          ...(select.ownerId ? { ownerId: listing.ownerId } : {}),
          ...(select.status ? { status: listing.status } : {}),
          ...(select.photos
            ? {
                photos:
                  'select' in select.photos
                    ? photos.map((photo) => ({ id: photo.id }))
                    : photos,
              }
            : {}),
        };
      },
    ),
    update: jest.fn(
      async ({
        where,
        data,
        select,
      }: {
        where: { id: string };
        data: { status?: ListingStatus };
        select?: { id?: true; status?: true };
      }) => {
        const listing = this.listings.find((entry) => entry.id === where.id);
        if (!listing) {
          throw new Error('Listing not found');
        }

        if (data.status !== undefined) {
          listing.status = data.status;
          listing.updatedAt = new Date();
        }

        if (!select) {
          return listing;
        }

        return {
          ...(select.id ? { id: listing.id } : {}),
          ...(select.status ? { status: listing.status } : {}),
        };
      },
    ),
  };

  listingPhoto = {
    updateMany: jest.fn(
      async ({
        where,
        data,
      }: {
        where: { listingId: string };
        data: { isPrimary: boolean };
      }) => {
        let count = 0;
        this.listingPhotos = this.listingPhotos.map((photo) => {
          if (photo.listingId !== where.listingId) {
            return photo;
          }

          count += 1;
          return {
            ...photo,
            isPrimary: data.isPrimary,
          };
        });

        return { count };
      },
    ),
    create: jest.fn(
      async ({
        data,
      }: {
        data: {
          listingId: string;
          url: string;
          thumbnailUrl: string | null;
          order: number;
          isPrimary: boolean;
        };
      }) => {
        const photo: ListingPhotoRecord = {
          id: `photo-${++this.listingPhotoSeq}`,
          listingId: data.listingId,
          url: data.url,
          thumbnailUrl: data.thumbnailUrl,
          order: data.order,
          isPrimary: data.isPrimary,
          uploadedAt: new Date(),
        };
        this.listingPhotos.push(photo);
        return photo;
      },
    ),
  };

  private getListingPhotos(listingId: string) {
    return this.listingPhotos
      .filter((photo) => photo.listingId === listingId)
      .sort((left, right) => left.order - right.order);
  }
}

class FakeListingPhotoStorage implements ListingPhotoStorage {
  uploadListingPhoto = jest.fn(
    async (input: UploadListingPhotoInput): Promise<StoredListingPhoto> => ({
      url: `https://cdn.example.com/listings/${input.listingId}/${input.originalFileName}`,
      thumbnailUrl: null,
    }),
  );
}

describe('ListingsController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: InMemoryPrismaService;
  let jwtService: JwtService;
  let listingPhotoStorage: FakeListingPhotoStorage;

  const activeCategoryId = '11111111-1111-4111-8111-111111111111';
  const inactiveCategoryId = '22222222-2222-4222-8222-222222222222';
  const activeUserId = '33333333-3333-4333-8333-333333333333';
  const bannedUserId = '44444444-4444-4444-8444-444444444444';
  const secondUserId = '55555555-5555-4555-8555-555555555555';

  beforeEach(async () => {
    prisma = new InMemoryPrismaService();
    listingPhotoStorage = new FakeListingPhotoStorage();
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
      {
        id: secondUserId,
        email: 'other@example.com',
        passwordHash: null,
        fullName: 'Other User',
        phone: null,
        avatarUrl: null,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
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
      .overrideProvider(ListingPhotoStorage)
      .useValue(listingPhotoStorage)
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

  it('uploads a photo for an owned draft listing with uuid id', async () => {
    const listingId = '66666666-6666-4666-8666-666666666666';
    prisma.listings.push({
      id: listingId,
      ownerId: activeUserId,
      categoryId: activeCategoryId,
      title: 'Cordless Drill',
      description: '18V cordless drill in good condition',
      rentalPrice: 300,
      rentalPeriod: RentalPeriod.DAY,
      depositAmount: 1500,
      status: ListingStatus.DRAFT,
      latitude: null,
      longitude: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await request(app.getHttpServer())
      .post(`/listings/${listingId}/photos`)
      .set(
        'Authorization',
        `Bearer ${await issueAccessToken(activeUserId, UserStatus.ACTIVE)}`,
      )
      .field('isPrimary', 'true')
      .attach('file', Buffer.from('fake-image'), {
        filename: 'photo.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(response.body.photo.url).toContain(`/listings/${listingId}/photo.png`);
    expect(response.body.nextStep).toBe('publish_listing');
    expect(response.body.totalPhotos).toBe(1);
    expect(prisma.listingPhotos).toHaveLength(1);
    expect(listingPhotoStorage.uploadListingPhoto).toHaveBeenCalled();
  });

  it('lists uploaded photos without authentication', async () => {
    const listingId = '77777777-7777-4777-8777-777777777777';
    prisma.listings.push({
      id: listingId,
      ownerId: activeUserId,
      categoryId: activeCategoryId,
      title: 'Cordless Drill',
      description: '18V cordless drill in good condition',
      rentalPrice: 300,
      rentalPeriod: RentalPeriod.DAY,
      depositAmount: 1500,
      status: ListingStatus.DRAFT,
      latitude: null,
      longitude: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.listingPhotos.push({
      id: 'photo-1',
      listingId,
      url: 'https://cdn.example.com/listings/photo-1.png',
      thumbnailUrl: null,
      order: 0,
      isPrimary: true,
      uploadedAt: new Date('2026-04-17T12:00:00.000Z'),
    });

    const response = await request(app.getHttpServer())
      .get(`/listings/${listingId}/photos`)
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].id).toBe('photo-1');
  });

  it('rejects publishing a draft without photos', async () => {
    const listingId = '88888888-8888-4888-8888-888888888888';
    prisma.listings.push({
      id: listingId,
      ownerId: activeUserId,
      categoryId: activeCategoryId,
      title: 'Cordless Drill',
      description: '18V cordless drill in good condition',
      rentalPrice: 300,
      rentalPeriod: RentalPeriod.DAY,
      depositAmount: 1500,
      status: ListingStatus.DRAFT,
      latitude: null,
      longitude: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await request(app.getHttpServer())
      .post(`/listings/${listingId}/publish`)
      .set(
        'Authorization',
        `Bearer ${await issueAccessToken(activeUserId, UserStatus.ACTIVE)}`,
      )
      .expect(400);
  });

  it('publishes a draft with photos and activates it immediately', async () => {
    const listingId = '99999999-9999-4999-8999-999999999999';
    prisma.listings.push({
      id: listingId,
      ownerId: activeUserId,
      categoryId: activeCategoryId,
      title: 'Cordless Drill',
      description: '18V cordless drill in good condition',
      rentalPrice: 300,
      rentalPeriod: RentalPeriod.DAY,
      depositAmount: 1500,
      status: ListingStatus.DRAFT,
      latitude: null,
      longitude: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.listingPhotos.push({
      id: 'photo-1',
      listingId,
      url: 'https://cdn.example.com/listings/photo-1.png',
      thumbnailUrl: null,
      order: 0,
      isPrimary: true,
      uploadedAt: new Date(),
    });

    const response = await request(app.getHttpServer())
      .post(`/listings/${listingId}/publish`)
      .set(
        'Authorization',
        `Bearer ${await issueAccessToken(activeUserId, UserStatus.ACTIVE)}`,
      )
      .expect(200);

    expect(response.body.status).toBe(ListingStatus.ACTIVE);
    expect(response.body.nextStep).toBeNull();
    expect(response.body.message).toBe('Listing published successfully.');
    expect(prisma.listings.find((listing) => listing.id === listingId)?.status).toBe(
      ListingStatus.ACTIVE,
    );
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
