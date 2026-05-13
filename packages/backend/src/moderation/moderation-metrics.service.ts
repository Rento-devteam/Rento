import { Injectable } from '@nestjs/common';
import type { ModerationDecisionStatus } from './moderation.types';

/**
 * Lightweight in-process counters for moderation outcomes (replace with Prometheus later).
 */
@Injectable()
export class ModerationMetricsService {
  private total = 0;
  private readonly byStatus = new Map<ModerationDecisionStatus, number>();

  record(status: ModerationDecisionStatus): void {
    this.total += 1;
    this.byStatus.set(status, (this.byStatus.get(status) ?? 0) + 1);
  }

  snapshot(): {
    total: number;
    byStatus: Record<string, number>;
  } {
    return {
      total: this.total,
      byStatus: Object.fromEntries(this.byStatus.entries()),
    };
  }
}
