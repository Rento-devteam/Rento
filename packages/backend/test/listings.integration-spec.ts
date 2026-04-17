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
import { cleanDatabase } from './db/clean-database';

class FakeListingPhotoStorage implements ListingPhotoStorage {
  uploadListingPhoto = jest.fn(
    async (input: UploadListingPhotoInput): Promise<StoredListingPhoto> => ({
      url: `https://cdn.example.com/listings/${input.listingId}/${input.originalFileName}`,
      thumbnailUrl: null,
    }),
  );
}

describe('ListingsController (integration, Postgres)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let listingPhotoStorage: FakeListingPhotoStorage;

  const activeCategoryId = '11111111-1111-4111-8111-111111111111';
  const inactiveCategoryId = '22222222-2222-4222-8222-222222222222';
  const activeUserId = '33333333-3333-4333-8333-333333333333';
  const bannedUserId = '44444444-4444-4444-8444-444444444444';
  const secondUserId = '55555555-5555-4555-8555-555555555555';

  beforeEach(async () => {
    listingPhotoStorage = new FakeListingPhotoStorage();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailSenderStub)
      .useValue({
        sendConfirmationEmail: jest.fn(async () => undefined),
      })
      .overrideProvider(ListingPhotoStorage)
      .useValue(listingPhotoStorage)
      .compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get(PrismaService);
    jwtService = moduleFixture.get(JwtService);
    await app.init();

    await cleanDatabase(prisma);

    await prisma.category.createMany({
      data: [
        {
          id: activeCategoryId,
          name: 'Tools',
          slug: 'tools',
          icon: null,
          order: 1,
          isActive: true,
        },
        {
          id: inactiveCategoryId,
          name: 'Vehicles',
          slug: 'vehicles',
          icon: null,
          order: 2,
          isActive: false,
        },
      ],
    });

    await prisma.user.createMany({
      data: [
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
        },
      ],
    });
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

    const rows = await prisma.listing.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Cordless Drill');
  });

  it('uploads a photo for an owned draft listing with uuid id', async () => {
    const listingId = '66666666-6666-4666-8666-666666666666';
    await prisma.listing.create({
      data: {
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
      },
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
    expect(await prisma.listingPhoto.count()).toBe(1);
    expect(listingPhotoStorage.uploadListingPhoto).toHaveBeenCalled();
  });

  it('lists uploaded photos without authentication', async () => {
    const listingId = '77777777-7777-4777-8777-777777777777';
    await prisma.listing.create({
      data: {
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
      },
    });
    const photo = await prisma.listingPhoto.create({
      data: {
        listingId,
        url: 'https://cdn.example.com/listings/photo-1.png',
        thumbnailUrl: null,
        order: 0,
        isPrimary: true,
        uploadedAt: new Date('2026-04-17T12:00:00.000Z'),
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/listings/${listingId}/photos`)
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].id).toBe(photo.id);
  });

  it('rejects publishing a draft without photos', async () => {
    const listingId = '88888888-8888-4888-8888-888888888888';
    await prisma.listing.create({
      data: {
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
      },
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
    await prisma.listing.create({
      data: {
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
      },
    });
    await prisma.listingPhoto.create({
      data: {
        listingId,
        url: 'https://cdn.example.com/listings/photo-1.png',
        thumbnailUrl: null,
        order: 0,
        isPrimary: true,
      },
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

    const updated = await prisma.listing.findUnique({ where: { id: listingId } });
    expect(updated?.status).toBe(ListingStatus.ACTIVE);
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
