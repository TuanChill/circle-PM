import { getProjectPropertyValidationError } from './project-rules';

describe('project property rules', () => {
  it('accepts the supported project properties and date range', () => {
    expect(
      getProjectPropertyValidationError({
        statusId: 'in-progress',
        statusCategory: 'started',
        priorityId: 'high',
        healthId: 'on-track',
        percentComplete: 50,
        startDate: new Date('2026-09-01'),
        targetDate: new Date('2026-09-30'),
      }),
    ).toBeUndefined();
  });

  it('rejects unknown properties, invalid progress, and reversed dates', () => {
    expect(getProjectPropertyValidationError({ statusId: 'unknown' })).toBe(
      'Unknown project status unknown',
    );
    expect(getProjectPropertyValidationError({ healthId: 'unknown' })).toBe(
      'Unknown project health unknown',
    );
    expect(getProjectPropertyValidationError({ percentComplete: 101 })).toBe(
      'Project percentComplete must be between 0 and 100',
    );
    expect(
      getProjectPropertyValidationError({
        startDate: new Date('2026-10-01'),
        targetDate: new Date('2026-09-01'),
      }),
    ).toBe('Project targetDate must be on or after startDate');
  });

  it('accepts a resolved custom status while keeping the default allow-list strict', () => {
    expect(
      getProjectPropertyValidationError({
        statusId: '2f3c98ec-35dd-4b51-9db3-455772a24ea0',
        statusCategory: 'unstarted',
        allowCustomStatus: true,
      }),
    ).toBeUndefined();
    expect(
      getProjectPropertyValidationError({
        statusId: '2f3c98ec-35dd-4b51-9db3-455772a24ea0',
        statusCategory: 'started',
        allowCustomStatus: true,
      }),
    ).toBeUndefined();
  });
});
