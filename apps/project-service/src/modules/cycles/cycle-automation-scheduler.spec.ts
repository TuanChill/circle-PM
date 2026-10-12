import type { EntityManager } from '@mikro-orm/core';
import { CycleAutomationScheduler } from './cycle-automation-scheduler';

jest.mock('@mikro-orm/core', () => ({
  EntityManager: class EntityManager {},
  RequestContext: {
    create: (_em: unknown, callback: () => Promise<void>) => callback(),
  },
}));
jest.mock('./cycles.service', () => ({
  CyclesService: class CyclesService {},
}));

describe('CycleAutomationScheduler', () => {
  afterEach(() => jest.useRealTimers());

  it('reconciles on startup and periodically until destroyed', async () => {
    jest.useFakeTimers();
    const reconcileEnabledTeams = jest.fn().mockResolvedValue(undefined);
    const scheduler = new CycleAutomationScheduler(
      {} as EntityManager,
      { reconcileEnabledTeams } as never,
    );

    scheduler.onModuleInit();
    await jest.advanceTimersByTimeAsync(0);
    expect(reconcileEnabledTeams).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(60_000);
    expect(reconcileEnabledTeams).toHaveBeenCalledTimes(2);

    scheduler.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(reconcileEnabledTeams).toHaveBeenCalledTimes(2);
  });
});
