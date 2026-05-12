import { Booking, Listing, User } from '@prisma/client';

type BookingListRow = Booking & {
  completedAt?: Date | null;
  listing: Pick<Listing, 'id' | 'title'> & {
    owner?: Pick<User, 'fullName' | 'email'> | null;
  };
  renter?: Pick<User, 'id' | 'fullName' | 'email'> | null;
};

export function mapBookingListItem(
  row: BookingListRow,
  perspective: 'renter' | 'landlord',
) {
  const renterLabel =
    perspective === 'landlord'
      ? row.renter?.fullName?.trim() || row.renter?.email?.trim() || 'Арендатор'
      : undefined;

  const landlordLabel =
    perspective === 'renter'
      ? row.listing.owner?.fullName?.trim() ||
        row.listing.owner?.email?.trim() ||
        'Арендодатель'
      : undefined;

  return {
    id: row.id,
    listingId: row.listingId,
    listingTitle: row.listing.title,
    status: row.status,
    startAt: row.startAt?.toISOString() ?? null,
    endAt: row.endAt?.toISOString() ?? null,
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate.toISOString().slice(0, 10),
    rentAmount: row.rentAmount,
    depositAmount: row.depositAmount,
    totalAmount: row.totalAmount,
    amountHeld: row.amountHeld,
    paymentHoldId: row.paymentHoldId,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    perspective,
    renterLabel,
    landlordLabel,
  };
}

export function mapBookingDetail(
  row: BookingListRow,
  role: 'renter' | 'landlord',
) {
  return {
    ...mapBookingListItem(row, role === 'renter' ? 'renter' : 'landlord'),
    role,
    paymentGateway: row.paymentGateway,
    paymentAuthorizationCode: row.paymentAuthorizationCode,
    settlementStatus: row.settlementStatus,
    settlementError: row.settlementError ?? null,
    settledAt: row.settledAt ? row.settledAt.toISOString() : null,
  };
}

export type BookingListItem = ReturnType<typeof mapBookingListItem>;
export type BookingDetailItem = ReturnType<typeof mapBookingDetail>;
