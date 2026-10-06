import { EntityManager, MikroORM } from '@mikro-orm/core';
import { Injectable, Logger } from '@nestjs/common';
import {
  Cycle,
  DocumentFolder,
  Initiative,
  Issue,
  IssueActivity,
  Label,
  Member,
  Notification,
  Project,
  ProjectMilestone,
  ProjectUpdate,
  Review,
  SavedView,
  Team,
  TeamDocument,
  TeamMember,
} from '../../data-access';
import {
  RAW_CYCLES,
  RAW_DOCUMENT_FOLDERS,
  RAW_INITIATIVES,
  RAW_LABELS,
  RAW_SAVED_VIEWS,
  RAW_TEAMS,
  RAW_USERS,
} from '../../database/seeders/seed-data';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly orm: MikroORM,
    private readonly em: EntityManager,
  ) {}

  async seedAll() {
    this.logger.log('Starting full database seed...');

    try {
      this.logger.log('Ensuring PostgreSQL schema and tables exist...');
      if (this.orm.schema) {
        await this.orm.schema.ensureDatabase();
        try {
          await this.orm.schema.create();
          this.logger.log('Tables created successfully via this.orm.schema.create.');
        } catch (createErr: any) {
          this.logger.warn(`schema.create fallback: ${createErr?.message || createErr}`);
          try {
            await this.orm.schema.update();
            this.logger.log('Tables updated successfully via this.orm.schema.update.');
          } catch (updateErr: any) {
            this.logger.warn(`schema.update warning: ${updateErr?.message || updateErr}`);
          }
        }
      }
    } catch (schemaErr: any) {
      this.logger.error('Schema generator error:', schemaErr?.stack || schemaErr);
    }

    // 1. Seed Members
    const membersCount = await this.em.count(Member, {});
    if (membersCount === 0) {
      this.logger.log('Seeding members...');
      for (const u of RAW_USERS) {
        const member = new Member({
          id: u.id,
          name: u.name,
          email: u.email,
          avatarUrl: u.avatarUrl,
          status: u.status as any,
          role: u.role as any,
          timezone: u.timezone,
          joinedDate: new Date(u.joinedDate),
        });
        this.em.persist(member);
      }
      await this.em.flush();
    }

    // 2. Seed Teams & TeamMembers
    const teamsCount = await this.em.count(Team, {});
    if (teamsCount === 0) {
      this.logger.log('Seeding teams...');
      for (const t of RAW_TEAMS) {
        const team = new Team({
          id: t.id,
          name: t.name,
          icon: t.icon,
          joined: t.joined,
          color: t.color,
        });
        this.em.persist(team);
      }
      await this.em.flush();

      // Team memberships
      for (const u of RAW_USERS) {
        for (const tid of u.teamIds) {
          const tm = new TeamMember({
            teamId: tid,
            memberId: u.id,
            role: 'member',
          });
          this.em.persist(tm);
        }
      }
      await this.em.flush();
    }

    // 3. Seed Labels
    const labelsCount = await this.em.count(Label, {});
    if (labelsCount === 0) {
      this.logger.log('Seeding labels...');
      for (const l of RAW_LABELS) {
        const label = new Label(l);
        this.em.persist(label);
      }
      await this.em.flush();
    }

    // 4. Seed Cycles
    const cyclesCount = await this.em.count(Cycle, {});
    if (cyclesCount === 0) {
      this.logger.log('Seeding cycles...');
      for (const c of RAW_CYCLES) {
        const cycle = new Cycle({
          id: c.id,
          number: c.number,
          name: c.name,
          teamId: c.teamId,
          status: c.status as any,
          startDate: new Date(c.startDate),
          endDate: new Date(c.endDate),
          capacity: c.capacity,
          scope: 0,
          scopeDelta: 0,
          started: 0,
          completed: 0,
          successRate: (c as any).successRate,
        });
        this.em.persist(cycle);
      }
      await this.em.flush();
    }

    // 5. Seed Projects
    const projectsCount = await this.em.count(Project, {});
    if (projectsCount === 0) {
      this.logger.log('Seeding 20 core projects...');
      const projectNames = [
        'LNDev UI - Core Components',
        'LNDev UI - Theming',
        'LNDev UI - Modals',
        'LNDev UI - Navigation',
        'LNDev UI - Layout',
        'LNDev UI - Sidebar',
        'LNDev UI - Cards',
        'LNDev UI - Tooltip',
        'LNDev UI - Dropdown',
        'LNDev UI - Data Tables',
        'LNDev UI - Form Controls',
        'LNDev UI - Notifications',
        'LNDev UI - Authentication Flow',
        'LNDev UI - User Preferences',
        'LNDev UI - Dashboard Widgets',
        'LNDev UI - Onboarding Guide',
        'LNDev UI - Progress Indicators',
        'LNDev UI - Internationalization',
        'LNDev UI - Accessibility Features',
        'LNDev UI - Media Player',
      ];
      const icons = [
        'Cuboid',
        'Blocks',
        'Vault',
        'BrickWall',
        'Wallpaper',
        'TrafficCone',
        'Grid2X2',
        'Bomb',
        'Shapes',
        'Table',
        'FormInput',
        'Bell',
        'Lock',
        'Settings',
        'LayoutDashboard',
        'HelpCircle',
        'Loader',
        'Globe',
        'Accessibility',
        'Play',
      ];
      const leads = ['mason', 'ln', 'sophia', 'emma', 'alex'];
      const healths = ['no-update', 'off-track', 'on-track', 'at-risk'];
      const teams = ['CORE', 'DESIGN', 'PERF', 'WEB', 'API', 'ANALYTICS'];

      for (let i = 0; i < 20; i++) {
        const id = String(i + 1);
        const p = new Project({
          id,
          name: projectNames[i],
          teamId: teams[i % teams.length],
          leadId: leads[i % leads.length],
          statusId: i % 3 === 0 ? 'in-progress' : i % 3 === 1 ? 'done' : 'backlog',
          statusCategory: i % 3 === 0 ? 'started' : i % 3 === 1 ? 'completed' : 'backlog',
          priorityId: i % 4 === 0 ? 'urgent' : i % 4 === 1 ? 'high' : 'medium',
          healthId: healths[i % healths.length],
          percentComplete: (i * 17) % 100,
          icon: icons[i],
          startDate: new Date('2026-03-01'),
          targetDate: new Date('2026-09-30'),
          summary: `Rebuild and optimize ${projectNames[i]} primitive suite.`,
          description: [
            { type: 'heading', text: '1. Overview' },
            {
              type: 'paragraph',
              text: `Standardized architecture, accessibility compliance, and performance guarantees for ${projectNames[i]}.`,
            },
          ],
          resources: [
            { label: 'Design Specs', url: 'https://figma.com' },
            { label: 'Documentation PRD', url: 'https://linear.app' },
          ],
        });
        this.em.persist(p);

        // Milestone
        const milestone = new ProjectMilestone({
          projectId: id,
          name: 'Core Spec Complete',
          targetDate: new Date('2026-06-01'),
          completed: i % 2 === 0,
          orderIndex: 0,
        });
        this.em.persist(milestone);

        // Project update
        const update = new ProjectUpdate({
          projectId: id,
          authorId: leads[i % leads.length],
          health: 'on-track',
          blocks: [
            {
              type: 'paragraph',
              text: `Milestone 1 is on track with test coverage at 90%.`,
            },
          ],
        });
        this.em.persist(update);
      }
      await this.em.flush();
    }

    // 6. Seed Initiatives
    const initiativesCount = await this.em.count(Initiative, {});
    if (initiativesCount === 0) {
      this.logger.log('Seeding initiatives...');
      for (const ini of RAW_INITIATIVES) {
        const initiative = new Initiative(ini as any);
        this.em.persist(initiative);
      }
      await this.em.flush();
    }

    // 7. Seed Document Folders & Documents
    const docsCount = await this.em.count(DocumentFolder, {});
    if (docsCount === 0) {
      this.logger.log('Seeding documents...');
      for (const folderData of RAW_DOCUMENT_FOLDERS) {
        const folder = new DocumentFolder({
          id: folderData.id,
          name: folderData.name,
          icon: folderData.icon,
          teamId: folderData.teamId,
        });
        this.em.persist(folder);

        for (const docData of folderData.documents) {
          const doc = new TeamDocument({
            id: docData.id,
            folderId: folderData.id,
            name: docData.name,
            icon: docData.icon,
            creatorId: docData.creatorId,
            pinned: (docData as any).pinned || false,
            createdAt: new Date(docData.createdAt),
            updatedAt: new Date(docData.updatedAt),
          });
          this.em.persist(doc);
        }
      }
      await this.em.flush();
    }

    // 8. Seed Saved Views
    const viewsCount = await this.em.count(SavedView, {});
    if (viewsCount === 0) {
      this.logger.log('Seeding saved views...');
      for (const v of RAW_SAVED_VIEWS) {
        const view = new SavedView(v as any);
        this.em.persist(view);
      }
      await this.em.flush();
    }

    // 9. Seed Sample Issues
    const issuesCount = await this.em.count(Issue, {});
    if (issuesCount === 0) {
      this.logger.log('Seeding sample issues...');
      const sampleSeeds = [
        [
          'LNUI-701',
          'Combobox: keyboard selection skips disabled options inconsistently',
          'product-feedback',
          'urgent',
          'ln',
          '21',
          '1',
        ],
        [
          'LNUI-702',
          'Date picker: month navigation feels laggy on low-end devices',
          'product-feedback',
          'medium',
          'sophia',
          '21',
          '2',
        ],
        [
          'LNUI-703',
          'Rework Dialog focus trap to support nested portals',
          'in-progress',
          'urgent',
          'mason',
          '21',
          '3',
        ],
        [
          'LNUI-704',
          'Add virtualization to Data Table for 10k+ rows',
          'in-progress',
          'high',
          'alex',
          '21',
          '10',
        ],
        [
          'LNUI-705',
          'Ship CLI flag to scaffold components with test files',
          'in-progress',
          'medium',
          'ethan',
          '21',
          '6',
        ],
        [
          'LNUI-706',
          'Migrate color tokens to OKLCH with fallbacks',
          'in-progress',
          'high',
          'aiden',
          '21',
          '2',
        ],
        [
          'LNUI-707',
          'Refactor Tooltip positioning engine to floating middleware',
          'technical-review',
          'high',
          'sophia',
          '21',
          '8',
        ],
        [
          'LNUI-708',
          'Toast queue: collapse duplicate notifications',
          'technical-review',
          'medium',
          'noah',
          '21',
          '12',
        ],
        [
          'LNUI-709',
          'Carousel: momentum scrolling on trackpads',
          'paused',
          'low',
          'logan',
          '21',
          '1',
        ],
        [
          'LNUI-710',
          'Command palette: async sources hang when provider throws',
          'blocked',
          'urgent',
          'emma',
          '21',
          '1',
        ],
        [
          'LNUI-711',
          'Report: Select dropdown clipped inside scrollable Sheet',
          'triage',
          'no-priority',
          'ln',
          '21',
          '3',
        ],
        [
          'LNUI-712',
          'Add skeleton variants for Card and Table',
          'to-do',
          'medium',
          'olivia',
          '21',
          '7',
        ],
        [
          'LNUI-713',
          'Expose CSS variables for Radix Accordion animations',
          'to-do',
          'low',
          'lucas',
          '21',
          '1',
        ],
        [
          'LNUI-714',
          'Fix popover anchor drift during page zoom',
          'done',
          'high',
          'mason',
          '21',
          '9',
        ],
        [
          'LNUI-715',
          'Improve screen reader announcements for Toast',
          'done',
          'urgent',
          'amelia',
          '21',
          '12',
        ],
      ];

      for (let i = 0; i < sampleSeeds.length; i++) {
        const [identifier, title, statusId, priorityId, assigneeId, cycleId, projectId] =
          sampleSeeds[i];
        const issue = new Issue({
          id: String(i + 1),
          identifier,
          title,
          description: title,
          statusId,
          statusCategory:
            statusId === 'done'
              ? 'completed'
              : statusId === 'in-progress' ||
                  statusId === 'technical-review' ||
                  statusId === 'product-feedback'
                ? 'started'
                : statusId === 'triage'
                  ? 'triage'
                  : 'unstarted',
          priorityId,
          assigneeId,
          creatorId: 'ln',
          teamId: 'CORE',
          projectId,
          cycleId,
          rank: `0|hzzzz${String.fromCharCode(97 + i)}:`,
          dueDate: new Date('2026-08-30'),
        });
        this.em.persist(issue);

        // Activity
        const act = new IssueActivity({
          issueIdentifier: identifier,
          actorId: assigneeId,
          event: 'created',
          text: 'created this issue',
        });
        this.em.persist(act);
      }
      await this.em.flush();

      // Seed Notifications
      const notif = new Notification({
        id: 'notification-1',
        issueIdentifier: 'LNUI-703',
        userId: 'ln',
        actorId: 'sophia',
        type: 'comment',
        content:
          'Heads up: Radix solves this with a DismissableLayer tree — worth reading before we reinvent it.',
        read: false,
      });
      this.em.persist(notif);

      // Seed PR Review
      const review = new Review({
        id: 'rev-101',
        title: 'fix: rework Dialog focus trap for nested portals',
        authorId: 'sophia',
        status: 'open',
        resolves: 'LNUI-703',
        branch: 'feat/dialog-nested-portals',
        summaryBullets: [
          'Track allowlist of portal roots registered through PortalRootContext',
          'Prevent focus containment from pulling focus away from active popovers',
        ],
      });
      this.em.persist(review);
      await this.em.flush();
    }

    this.logger.log('Database seed completed successfully!');
    return { success: true, message: 'All tables seeded successfully' };
  }
}
