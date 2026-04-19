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
    async (input: UploadListingPhotoInput): Promise<StoredListingPhoto> => ({
      url: `https://cdn.example.com/listings/${input.listingId}/${input.originalFileName}`,
      thumbnailUrl: null,
    }),
  );
}

describe('Calendar (integration, Postgres)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const activeCategoryId = '11111111-1111-4111-8111-111111111111';
  const ownerId = '33333333-3333-4333-8333-333333333333';
  const renterId = '55555555-5555-4555-8555-555555555555';
  const listingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const rangeStart = '2026-04-01';
  const rangeEnd = '2026-04-30';

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailSenderStub)
      .useValue({
        sendConfirmationEmail: jest.fn(async () => undefined),
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
        description: 'A drill',
        rentalPrice: 100,
        rentalPeriod: RentalPeriod.DAY,
        depositAmount: 500,
        status: ListingStatus.ACTIVE,
        latitude: null,
        longitude: null,
      },
    });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns 404 for unknown listing calendar', async () => {
    await request(app.getHttpServer())
      .get(
        `/listings/00000000-0000-4000-8000-000000000000/calendar?start=${rangeStart}&end=${rangeEnd}`,
      )
      .expect(404);
  });

  it('returns all AVAILABLE days for an empty calendar', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `/listings/${listingId}/calendar?start=${rangeStart}&end=${rangeEnd}`,
      )
      .expect(200);

    expect(response.body.listingId).toBe(listingId);
    expect(response.body.items).toHaveLength(30);
    expect(
      response.body.items.every(
        (i: { status: string }) => i.status === 'AVAILABLE',
      ),
    ).toBe(true);
  });

  it('blocks dates as owner and surfaces them on the calendar', async () => {
    await request(app.getHttpServer())
      .post(`/listings/${listingId}/calendar/block`)
      .set('Authorization', `Bearer ${await token(ownerId)}`)
      .send({ startDate: '2026-04-10', endDate: '2026-04-12', reason: 'Trip' })
      .expect(200);

    const calendar = await request(app.getHttpServer())
      .get(
        `/listings/${listingId}/calendar?start=${rangeStart}&end=${rangeEnd}`,
      )
      .expect(200);

    const blocked = calendar.body.items.filter(
      (i: { date: string; status: string }) =>
        i.date >= '2026-04-10' && i.date <= '2026-04-12',
    );
    expect(blocked).toHaveLength(3);
    expect(
      blocked.every((i: { status: string }) => i.status === 'BLOCKED_BY_OWNER'),
    ).toBe(true);
  });

  it('rejects manual block when a booking already covers the range', async () => {
    await prisma.booking.create({
      data: {
        listingId,
        renterId,
        startDate: new Date('2026-04-10T00:00:00.000Z'),
        endDate: new Date('2026-04-12T00:00:00.000Z'),
        rentAmount: 300,
        depositAmount: 100,
        totalAmount: 400,
        status: BookingStatus.CONFIRMED,
      },
    });

    await request(app.getHttpServer())
      .post(`/listings/${listingId}/calendar/block`)
      .set('Authorization', `Bearer ${await token(ownerId)}`)
      .send({ startDate: '2026-04-11', endDate: '2026-04-11' })
      .expect(409);
  });

  it('marks booked days on the public calendar', async () => {
    await prisma.booking.create({
      data: {
        listingId,
        renterId,
        startDate: new Date('2026-04-05T00:00:00.000Z'),
        endDate: new Date('2026-04-06T00:00:00.000Z'),
        rentAmount: 200,
        depositAmount: 100,
        totalAmount: 300,
        status: BookingStatus.CONFIRMED,
      },
    });

    const calendar = await request(app.getHttpServer())
      .get(
        `/listings/${listingId}/calendar?start=${rangeStart}&end=${rangeEnd}`,
      )
      .expect(200);

    const booked = calendar.body.items.filter(
      (i: { status: string }) => i.status === 'BOOKED',
    );
    expect(booked.map((i: { date: string }) => i.date).sort()).toEqual([
      '2026-04-05',
      '2026-04-06',
    ]);
  });

  it('reports availability conflicts for booked days', async () => {
    await prisma.booking.create({
      data: {
        listingId,
        renterId,
        startDate: new Date('2026-04-20T00:00:00.000Z'),
        endDate: new Date('2026-04-22T00:00:00.000Z'),
        rentAmount: 150,
        depositAmount: 50,
        totalAmount: 200,
        status: BookingStatus.ACTIVE,
      },
    });

    const res = await request(app.getHttpServer())
      .get(
        `/listings/${listingId}/dates/availability?start=2026-04-19&end=2026-04-23`,
      )
      .expect(200);

    expect(res.body.available).toBe(false);
    expect(res.body.conflicts).toHaveLength(3);
    expect(res.body.conflicts[0].status).toBe('BOOKED');
  });

  it('requires force and cancelBookings to clear manual blocks over active bookings', async () => {
    await prisma.booking.create({
      data: {
        listingId,
        renterId,
        startDate: new Date('2026-04-10T00:00:00.000Z'),
        endDate: new Date('2026-04-12T00:00:00.000Z'),
        rentAmount: 100,
        depositAmount: 50,
        totalAmount: 150,
        status: BookingStatus.CONFIRMED,
      },
    });

    await prisma.listingManualCalendarBlock.create({
      data: {
        listingId,
        startDate: new Date('2026-04-10T00:00:00.000Z'),
        endDate: new Date('2026-04-12T00:00:00.000Z'),
        reason: null,
      },
    });

    await request(app.getHttpServer())
      .delete(
        `/listings/${listingId}/calendar/block?start=2026-04-10&end=2026-04-12`,
      )
      .set('Authorization', `Bearer ${await token(ownerId)}`)
      .expect(409);

    await request(app.getHttpServer())
      .delete(
        `/listings/${listingId}/calendar/block?start=2026-04-10&end=2026-04-12&force=true`,
      )
      .set('Authorization', `Bearer ${await token(ownerId)}`)
      .expect(409);

    await request(app.getHttpServer())
      .delete(
        `/listings/${listingId}/calendar/block?start=2026-04-10&end=2026-04-12&force=true&cancelBookings=true`,
      )
      .set('Authorization', `Bearer ${await token(ownerId)}`)
      .expect(200);

    const updated = await prisma.booking.findFirst({
      where: { listingId },
    });
    expect(updated?.status).toBe(BookingStatus.CANCELLED);
    expect(
      await prisma.listingManualCalendarBlock.count({ where: { listingId } }),
    ).toBe(0);
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
