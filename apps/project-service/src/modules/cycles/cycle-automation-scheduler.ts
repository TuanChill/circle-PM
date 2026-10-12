import { EntityManager, RequestContext } from '@mikro-orm/core';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CyclesService } from './cycles.service';

const RECONCILIATION_INTERVAL_MS = 60_000;

@Injectable()
export class CycleAutomationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CycleAutomationScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly em: EntityManager,
    private readonly cyclesService: CyclesService,
  ) {}

  onModuleInit() {
    void this.reconcile();
    this.timer = setInterval(() => void this.reconcile(), RECONCILIATION_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async reconcile() {
    if (this.running) return;
    this.running = true;
    try {
      await RequestContext.create(this.em, () =>
        this.cyclesService.reconcileEnabledTeams(),
      );
    } catch (error) {
      const detail = error instanceof Error ? error.stack : String(error);
      this.logger.error('Scheduled cycle reconciliation failed', detail);
    } finally {
      this.running = false;
    }
  }
}
