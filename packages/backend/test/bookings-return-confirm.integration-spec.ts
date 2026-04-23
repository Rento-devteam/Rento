import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BookingStatus,
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
import { ListingSearchIndexService } from '../src/search/listing-search-index.service';
import { cleanDatabase } from './db/clean-database';
import { createListingSearchIndexStub } from './stub-listing-search-index';

class FakeListingPhotoStorage implements ListingPhotoStorage {
  uploadListingPhoto = jest.fn(
    (input: UploadListingPhotoInput): StoredListingPhoto => ({
      url: `https://cdn.example.com/listings/${input.listingId}/${input.originalFileName}`,
      thumbnailUrl: null,
    }),
  );
}

describe('Bookings return confirm (integration, Postgres)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const activeCategoryId = '11111111-1111-4111-8111-111111111111';
  const ownerId = '33333333-3333-4333-8333-333333333333';
  const renterId = '55555555-5555-4555-8555-555555555555';
  const listingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const bookingId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailSenderStub)
      .useValue({
        sendConfirmationEmail: jest.fn(() => undefined),
      })
      .overrideProvider(ListingPhotoStorage)
      .useValue(new FakeListingPhotoStorage())
      .overrideProvider(ListingSearchIndexService)
      .useValue(createListingSearchIndexStub())
      .compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get(PrismaService);
    jwtService = moduleFixture.get(JwtService);
    await app.init();

    await cleanDatabase(prisma);

    await prisma.category.create({
      data: {
        id: activeCategoryId,
        name: 'Tools',
        slug: 'tools',
        icon: null,
        order: 1,
        isActive: true,
      },
    });

    await prisma.user.createMany({
      data: [
        {
          id: ownerId,
          email: 'owner@example.com',
          passwordHash: null,
          fullName: 'Owner',
          phone: null,
          avatarUrl: null,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          emailConfirmedAt: new Date(),
          telegramId: null,
        },
        {
          id: renterId,
          email: 'renter@example.com',
          passwordHash: null,
          fullName: 'Renter',
          phone: null,
          avatarUrl: null,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          emailConfirmedAt: new Date(),
          telegramId: null,
        },
      ],
    });

    await prisma.listing.create({
      data: {
        id: listingId,
        ownerId,
        categoryId: activeCategoryId,
        title: 'Drill',
        description: 'Nice drill',
        rentalPrice: 200,
        rentalPeriod: RentalPeriod.DAY,
        depositAmount: 100,
        status: ListingStatus.ACTIVE,
        latitude: null,
        longitude: null,
      },
    });

    await prisma.booking.create({
      data: {
        id: bookingId,
        listingId,
        renterId,
        startDate: new Date('2026-04-20T00:00:00.000Z'),
        endDate: new Date('2026-04-21T00:00:00.000Z'),
        startAt: new Date('2026-04-20T10:00:00.000Z'),
        endAt: new Date('2026-04-21T10:00:00.000Z'),
        rentAmount: 200,
        depositAmount: 100,
        totalAmount: 300,
        amountHeld: 300,
        paymentHoldId: 'hold_123',
        paymentGateway: 'stub',
        paymentAuthorizationCode: 'auth_123',
        status: BookingStatus.ACTIVE,
      },
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('completes booking after mutual return confirm', async () => {
    await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/return/confirm`)
      .set('Authorization', `Bearer ${await token(renterId)}`)
      .expect(200);

    const landlordRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/return/confirm`)
      .set('Authorization', `Bearer ${await token(ownerId)}`)
      .expect(200);

    const body = landlordRes.body as {
      status: BookingStatus;
      completedAt: string | null;
    };
    expect(body.status).toBe(BookingStatus.COMPLETED);
    expect(body.completedAt).toBeTruthy();

    const row = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(row?.status).toBe(BookingStatus.COMPLETED);
    expect(row?.completedAt).toBeTruthy();
  });

  async function token(userId: string) {
    return jwtService.signAsync(
      {
        sub: userId,
        email: `${userId}@example.com`,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      },
      {
        secret: process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret',
      },
    );
  }
});
