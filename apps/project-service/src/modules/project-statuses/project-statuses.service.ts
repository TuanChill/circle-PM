import { EntityManager } from '@mikro-orm/core';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { v7 } from 'uuid';
import {
  CreateProjectStatusDto,
  PROJECT_STATUS_CATEGORIES,
} from './dto/project-status.dto';
import { ProjectStatus } from '../../data-access/project/project-status.entity';
import { canManageWorkspaceRole } from '../access-control';
import { WorkspacesService } from '../workspaces/workspaces.service';

@Injectable()
export class ProjectStatusesService {
  constructor(
    private readonly em: EntityManager,
    private readonly workspacesService: WorkspacesService,
  ) {}

  private async resolveWorkspace(workspaceId: string, memberId: string) {
    try {
      return await this.workspacesService.findOne(workspaceId, memberId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Workspace ${workspaceId} not found`);
      }
      throw error;
    }
  }

  async findAll(workspaceId: string, memberId: string) {
    const workspace = await this.resolveWorkspace(workspaceId, memberId);
    const statuses = await this.em.find(
      ProjectStatus,
      { workspaceId: workspace.id },
      { orderBy: { category: 'asc', position: 'asc', createdAt: 'asc' } },
    );
    return statuses.map((status) => this.serialize(status));
  }

  async create(workspaceId: string, dto: CreateProjectStatusDto, memberId: string) {
    const workspace = await this.resolveWorkspace(workspaceId, memberId);
    if (!canManageWorkspaceRole(workspace.role)) {
      throw new NotFoundException(`Workspace ${workspaceId} not found`);
    }

    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Status name is required');
    if (!PROJECT_STATUS_CATEGORIES.includes(dto.category)) {
      throw new BadRequestException(
        `Unsupported project status category ${dto.category}`,
      );
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(dto.color)) {
      throw new BadRequestException('Status color must be a six-digit hex color');
    }
    const statuses = await this.em.find(ProjectStatus, { workspaceId: workspace.id });
    const builtinNames: Record<string, string[]> = {
      backlog: ['Backlog'],
      unstarted: ['Paused'],
      started: ['In Progress'],
      completed: ['Done'],
      canceled: ['Canceled'],
    };
    if (
      [
        ...statuses.map((status) => status.name),
        ...Object.values(builtinNames).flat(),
      ].some((existingName) => existingName.toLowerCase() === name.toLowerCase())
    ) {
      throw new BadRequestException(
        'A status with this name already exists in this workspace',
      );
    }

    const status = new ProjectStatus({
      id: v7(),
      workspaceId: workspace.id,
      name,
      description: dto.description?.trim() || undefined,
      color: dto.color.toLowerCase(),
      category: dto.category,
      position:
        statuses
          .filter((item) => item.category === dto.category)
          .reduce((max, item) => Math.max(max, item.position), -1) + 1,
    });
    this.em.persist(status);
    await this.em.flush();
    return this.serialize(status);
  }

  private serialize(status: ProjectStatus) {
    return {
      id: status.id,
      workspaceId: status.workspaceId,
      name: status.name,
      description: status.description,
      color: status.color,
      category: status.category,
      position: status.position,
      createdAt: status.createdAt,
      updatedAt: status.updatedAt,
    };
  }
}
