import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeUnits } from './booking-pricing';

@Injectable()
export class BookingsSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getBookingSummary(listingId: string, startAt: string, endAt: string) {
    const start = this.parseIso(startAt, 'startAt');
    const end = this.parseIso(endAt, 'endAt');
    if (start.getTime() >= end.getTime()) {
      throw new BadRequestException('startAt must be before endAt');
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, rentalPrice: true, rentalPeriod: true, depositAmount: true },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const units = computeUnits(listing.rentalPeriod, start, end);
    const rentAmount = round2(listing.rentalPrice * units);
    const depositAmount = round2(listing.depositAmount);
    const total = round2(rentAmount + depositAmount);

    return {
      listingId: listing.id,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      rentalPeriod: listing.rentalPeriod,
      units,
      rentalAmount: rentAmount,
      depositAmount,
      totalHoldAmount: total,
    };
  }

  private parseIso(value: string, field: string): Date {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return d;
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

