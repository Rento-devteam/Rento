export function parseISODateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Invalid date');
  }
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatISODateUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function utcDateOnly(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

export function eachUtcDateInclusive(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cursor = utcDateOnly(start);
  const last = utcDateOnly(end);
  while (cursor.getTime() <= last.getTime()) {
    out.push(formatISODateUtc(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export function defaultUtcMonthRange(reference: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const y = reference.getUTCFullYear();
  const m = reference.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 0));
  return { start, end };
}
