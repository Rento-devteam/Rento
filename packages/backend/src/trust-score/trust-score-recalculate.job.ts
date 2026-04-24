import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TrustScoreService } from './trust-score.service';

const JOB_LOCK_KEY = 'job:trust_score_recalculate_v1';

@Injectable()
export class TrustScoreRecalculateJob {
  private readonly logger = new Logger(TrustScoreRecalculateJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trustScoreService: TrustScoreService,
  ) {}

  @Cron('0 3 * * *') // every day at 03:00
  async tick() {
    if (process.env.DISABLE_SCHEDULED_JOBS === 'true') {
      return;
    }

    const gotLock = await this.prisma.$transaction(async (tx) => {
      const rows = (await tx.$queryRaw<
        Array<{ locked: boolean }>
      >`SELECT pg_try_advisory_xact_lock(hashtext(${JOB_LOCK_KEY})) AS locked;`) as Array<{
        locked: boolean;
      }>;
      return Boolean(rows[0]?.locked);
    });

    if (!gotLock) {
      return;
    }

    await this.recalculateAllActiveUsers();
  }

  private async recalculateAllActiveUsers() {
    const pageSize = 200;
    let cursorId: string | undefined;

    while (true) {
      const users = await this.prisma.user.findMany({
        where: { status: UserStatus.ACTIVE },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: pageSize,
        ...(cursorId
          ? { cursor: { id: cursorId }, skip: 1 }
          : {}),
      });

      if (users.length === 0) {
        break;
      }

      await Promise.allSettled(
        users.map((u) =>
          this.trustScoreService.recalculateForUser({
            userId: u.id,
            eventType: 'scheduled_batch_calculation',
          }),
        ),
      );

      cursorId = users[users.length - 1]?.id;
      this.logger.log(`Recalculated trust score batch; lastUserId=${cursorId}`);
    }
  }
}

