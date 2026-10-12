import type { EntityManager } from '@mikro-orm/core';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CyclesService } from './cycles.service';
import { Cycle, CycleSettings, Issue } from '../../data-access';

jest.mock('@mikro-orm/core', () => ({
  EntityManager: class MockEntityManager {},
}));

jest.mock('../../data-access', () => ({
  CycleHistory: class MockCycleHistory {},
  Cycle: class MockCycle {
    constructor(partial?: Record<string, unknown>) {
      Object.assign(this, partial);
    }
  },
  CycleSettings: class MockCycleSettings {
    teamId = '';
    enabled = false;
    durationWeeks = 2;
    startDayOfWeek = 1;
    cooldownDays = 0;
    upcomingCycleCount = 3;
    autoAddActiveIssues = false;

    constructor(partial?: Record<string, unknown>) {
      Object.assign(this, partial);
    }
  },
  Issue: class MockIssue {
    constructor(partial?: Record<string, unknown>) {
      Object.assign(this, partial);
    }
  },
}));

jest.mock('../workspaces/workspaces.service', () => ({
  WorkspacesService: class WorkspacesService {},
}));

describe('CyclesService settings', () => {
  function createService(
    initialSettings?: InstanceType<typeof CycleSettings>,
    initialCycles?: Cycle[],
    initialIssues: Issue[] = [],
  ) {
    let settings = initialSettings;
    const persisted: unknown[] = [];
    const defaultCycles = [
      new Cycle({
        id: 'existing-upcoming',
        teamId: 'team-a',
        status: 'upcoming',
        startDate: new Date(Date.now() + 7 * 86400000),
        endDate: new Date(Date.now() + 20 * 86400000),
      }),
    ];
    const cycleRows: Cycle[] =
      initialCycles ?? (initialSettings?.enabled ? defaultCycles : []);
    const em = {
      findOne: jest.fn(async (entity: unknown, where?: { id?: string }) => {
        if (entity === CycleSettings) return settings ?? null;
        if (entity === Cycle) {
          return cycleRows.find((cycle) => cycle.id === where?.id) ?? null;
        }
        return null;
      }),
      find: jest.fn(async (entity: unknown, where?: Record<string, unknown>) => {
        if (entity === CycleSettings) {
          return settings && (!where || settings.enabled === where.enabled)
            ? [settings]
            : [];
        }
        if (entity === Cycle) return cycleRows;
        if (entity === Issue) {
          return initialIssues.filter((issue) => {
            if (where?.teamId && issue.teamId !== where.teamId) return false;
            if (where?.cycleId && issue.cycleId !== where.cycleId) return false;
            const categoryFilter = where?.statusCategory as
              | { $in?: string[] }
              | undefined;
            return (
              !categoryFilter?.$in || categoryFilter.$in.includes(issue.statusCategory)
            );
          });
        }
        return [];
      }),
      persist: jest.fn((value: unknown) => {
        persisted.push(value);
        if (value instanceof CycleSettings) settings = value;
        if (value instanceof Cycle) cycleRows.push(value);
      }),
      flush: jest.fn(async () => undefined),
    } as unknown as EntityManager;
    const workspacesService = {
      getAccessibleTeamIds: jest.fn(async () => ['team-a']),
    };

    return {
      service: new CyclesService(em, workspacesService as never),
      em,
      persisted,
      upcoming: cycleRows,
    };
  }

  it('rejects invalid cadence before persisting settings', async () => {
    const { service, em, persisted } = createService();

    await expect(
      service.updateSettings(
        'team-a',
        {
          durationWeeks: 9,
        },
        'member-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(persisted).toHaveLength(0);
    expect(em.flush).not.toHaveBeenCalled();
  });

  it('provisions only the requested team cadence after a valid update', async () => {
    const { service, persisted } = createService();

    const result = await service.updateSettings(
      'team-a',
      {
        enabled: true,
        durationWeeks: 1,
        startDayOfWeek: 1,
        cooldownDays: 2,
        upcomingCycleCount: 2,
      },
      'member-1',
    );

    expect(result).toMatchObject({
      teamId: 'team-a',
      enabled: true,
      durationWeeks: 1,
      cooldownDays: 2,
      upcomingCycleCount: 2,
    });
    const createdCycles = persisted.filter((value) => value instanceof Cycle) as Cycle[];
    expect(createdCycles).toHaveLength(2);
    expect(createdCycles.every((cycle) => cycle.teamId === 'team-a')).toBe(true);
    expect(createdCycles[0].startDate).toBeInstanceOf(Date);
    expect(createdCycles[0].endDate).toBeInstanceOf(Date);
  });

  it('reconciles enabled team cycles repeatedly without generating duplicate schedules', async () => {
    const settings = new CycleSettings({
      teamId: 'team-a',
      enabled: true,
      upcomingCycleCount: 2,
    });
    const { service, em, persisted } = createService(settings, []);

    await Promise.all([service.reconcileEnabledTeams(), service.reconcileEnabledTeams()]);

    const generatedCycles = persisted.filter(
      (value) => value instanceof Cycle,
    ) as Cycle[];
    expect(generatedCycles).toHaveLength(2);
    expect(generatedCycles.every((cycle) => cycle.teamId === 'team-a')).toBe(true);
    expect(em.find).toHaveBeenCalledWith(CycleSettings, { enabled: true });
  });

  it('soft-deletes upcoming cycles when cadence is disabled', async () => {
    const current = new CycleSettings({ teamId: 'team-a', enabled: true });
    const { service, upcoming } = createService(current);

    await service.updateSettings('team-a', { enabled: false }, 'member-1');

    expect(upcoming[0].deletedAt).toBeInstanceOf(Date);
  });

  it('completes the current cycle while removing future cycles when disabled', async () => {
    const today = new Date();
    const todayStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const currentCycle = new Cycle({
      id: 'cycle-current',
      teamId: 'team-a',
      status: 'current',
      startDate: new Date(todayStart.getTime() - 2 * 86400000),
      endDate: new Date(todayStart.getTime() + 5 * 86400000),
    });
    const futureCycle = new Cycle({
      id: 'cycle-future',
      teamId: 'team-a',
      status: 'upcoming',
      startDate: new Date(todayStart.getTime() + 6 * 86400000),
      endDate: new Date(todayStart.getTime() + 12 * 86400000),
    });
    const current = new CycleSettings({ teamId: 'team-a', enabled: true });
    const { service } = createService(current, [currentCycle, futureCycle]);

    await service.updateSettings('team-a', { enabled: false }, 'member-1');

    expect(currentCycle.status).toBe('completed');
    expect(futureCycle.deletedAt).toBeInstanceOf(Date);
  });

  it('reconciles cycle status using the configured team timezone', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-16T23:30:00.000Z'));
    try {
      const localDayCycle = new Cycle({
        id: 'cycle-local-day',
        teamId: 'team-a',
        status: 'upcoming',
        startDate: new Date('2026-09-17T00:00:00.000Z'),
        endDate: new Date('2026-09-17T00:00:00.000Z'),
      });
      const settings = new CycleSettings({
        teamId: 'team-a',
        enabled: true,
        timeZone: 'Asia/Ho_Chi_Minh',
      });
      const { service } = createService(settings, [localDayCycle]);

      await service.getSettings('team-a', 'member-1');

      expect(localDayCycle.status).toBe('current');
    } finally {
      jest.useRealTimers();
    }
  });

  it('hides settings for an inaccessible team', async () => {
    const { service, em } = createService();

    await expect(service.getSettings('team-b', 'member-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(em.findOne).not.toHaveBeenCalled();
  });

  it('rolls unfinished issues forward and auto-adds active issues to the current cycle', async () => {
    const today = new Date();
    const todayStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const previous = new Cycle({
      id: 'cycle-previous',
      teamId: 'team-a',
      status: 'current',
      startDate: new Date(todayStart.getTime() - 14 * 86400000),
      endDate: new Date(todayStart.getTime() - 8 * 86400000),
    });
    const current = new Cycle({
      id: 'cycle-current',
      teamId: 'team-a',
      status: 'upcoming',
      startDate: new Date(todayStart.getTime() - 7 * 86400000),
      endDate: new Date(todayStart.getTime() + 6 * 86400000),
    });
    const next = new Cycle({
      id: 'cycle-next',
      teamId: 'team-a',
      status: 'upcoming',
      startDate: new Date(todayStart.getTime() + 7 * 86400000),
      endDate: new Date(todayStart.getTime() + 13 * 86400000),
    });
    const unfinished = new Issue({
      teamId: 'team-a',
      cycleId: previous.id,
      statusCategory: 'started',
    });
    const activeStarted = new Issue({
      teamId: 'team-a',
      cycleId: '',
      statusCategory: 'started',
    });
    const activeCompleted = new Issue({
      teamId: 'team-a',
      cycleId: '',
      statusCategory: 'completed',
    });
    const settings = new CycleSettings({
      teamId: 'team-a',
      enabled: true,
      upcomingCycleCount: 1,
      autoAddActiveIssues: true,
    });
    const { service } = createService(
      settings,
      [previous, current, next],
      [unfinished, activeStarted, activeCompleted],
    );

    await service.getSettings('team-a', 'member-1');

    expect(previous.status).toBe('completed');
    expect(current.status).toBe('current');
    expect(unfinished.cycleId).toBe(current.id);
    expect(activeStarted.cycleId).toBe(current.id);
    expect(activeCompleted.cycleId).toBe(current.id);
  });

  it('attributes active issues to the previous and next cycles during cooldown', async () => {
    const today = new Date();
    const todayStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const previous = new Cycle({
      id: 'cycle-previous',
      teamId: 'team-a',
      status: 'completed',
      startDate: new Date(todayStart.getTime() - 14 * 86400000),
      endDate: new Date(todayStart.getTime() - 1 * 86400000),
    });
    const next = new Cycle({
      id: 'cycle-next',
      teamId: 'team-a',
      status: 'upcoming',
      startDate: new Date(todayStart.getTime() + 2 * 86400000),
      endDate: new Date(todayStart.getTime() + 8 * 86400000),
    });
    const activeStarted = new Issue({
      teamId: 'team-a',
      cycleId: '',
      statusCategory: 'started',
    });
    const activeCompleted = new Issue({
      teamId: 'team-a',
      cycleId: '',
      statusCategory: 'completed',
    });
    const settings = new CycleSettings({
      teamId: 'team-a',
      enabled: true,
      upcomingCycleCount: 1,
      autoAddActiveIssues: true,
    });
    const { service } = createService(
      settings,
      [previous, next],
      [activeStarted, activeCompleted],
    );

    await service.getSettings('team-a', 'member-1');

    expect(activeStarted.cycleId).toBe(next.id);
    expect(activeCompleted.cycleId).toBe(previous.id);
  });

  it('rolls unfinished active issues forward but leaves backlog, triage, and closed issues behind', async () => {
    const today = new Date();
    const todayStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const previous = new Cycle({
      id: 'cycle-previous',
      teamId: 'team-a',
      status: 'current',
      startDate: new Date(todayStart.getTime() - 14 * 86400000),
      endDate: new Date(todayStart.getTime() - 1 * 86400000),
    });
    const current = new Cycle({
      id: 'cycle-current',
      teamId: 'team-a',
      status: 'upcoming',
      startDate: todayStart,
      endDate: new Date(todayStart.getTime() + 13 * 86400000),
    });
    const issueIn = (statusCategory: string) =>
      new Issue({ teamId: 'team-a', cycleId: previous.id, statusCategory });
    const started = issueIn('started');
    const unstarted = issueIn('unstarted');
    const backlog = issueIn('backlog');
    const triage = issueIn('triage');
    const completed = issueIn('completed');
    const canceled = issueIn('canceled');
    const settings = new CycleSettings({ teamId: 'team-a', enabled: true });
    const { service } = createService(
      settings,
      [previous, current],
      [started, unstarted, backlog, triage, completed, canceled],
    );

    await service.getSettings('team-a', 'member-1');

    expect(previous.status).toBe('completed');
    expect(current.status).toBe('current');
    expect(started.cycleId).toBe(current.id);
    expect(unstarted.cycleId).toBe(current.id);
    expect(backlog.cycleId).toBe(previous.id);
    expect(triage.cycleId).toBe(previous.id);
    expect(completed.cycleId).toBe(previous.id);
    expect(canceled.cycleId).toBe(previous.id);
  });

  it('starts the next cycle today, rolls open work, and preserves future cadence', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-16T12:00:00.000Z'));
    try {
      const current = new Cycle({
        id: 'cycle-current',
        teamId: 'team-a',
        status: 'current',
        startDate: new Date('2026-09-07T00:00:00.000Z'),
        endDate: new Date('2026-09-20T00:00:00.000Z'),
      });
      const next = new Cycle({
        id: 'cycle-next',
        teamId: 'team-a',
        status: 'upcoming',
        startDate: new Date('2026-09-21T00:00:00.000Z'),
        endDate: new Date('2026-10-04T00:00:00.000Z'),
      });
      const future = new Cycle({
        id: 'cycle-future',
        teamId: 'team-a',
        status: 'upcoming',
        startDate: new Date('2026-10-05T00:00:00.000Z'),
        endDate: new Date('2026-10-18T00:00:00.000Z'),
      });
      const openIssue = new Issue({
        teamId: 'team-a',
        cycleId: current.id,
        statusCategory: 'started',
      });
      const completedIssue = new Issue({
        teamId: 'team-a',
        cycleId: current.id,
        statusCategory: 'completed',
      });
      const settings = new CycleSettings({
        teamId: 'team-a',
        enabled: true,
        cooldownDays: 0,
      });
      const { service } = createService(
        settings,
        [current, next, future],
        [openIssue, completedIssue],
      );

      await service.startToday(next.id, 'member-1');

      expect(current.status).toBe('completed');
      expect(next.status).toBe('current');
      expect(next.startDate).toEqual(new Date('2026-09-16T00:00:00.000Z'));
      expect(next.endDate).toEqual(new Date('2026-09-29T00:00:00.000Z'));
      expect(future.startDate).toEqual(new Date('2026-09-30T00:00:00.000Z'));
      expect(future.endDate).toEqual(new Date('2026-10-13T00:00:00.000Z'));
      expect(openIssue.cycleId).toBe(next.id);
      expect(completedIssue.cycleId).toBe(current.id);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects starting a cycle that is already current or completed', async () => {
    const current = new Cycle({
      id: 'cycle-current',
      teamId: 'team-a',
      status: 'current',
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-09-14T00:00:00.000Z'),
    });
    const settings = new CycleSettings({ teamId: 'team-a', enabled: true });
    const { service } = createService(settings, [current]);

    await expect(service.startToday(current.id, 'member-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
