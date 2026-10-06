import { AwsS3Service } from '@app/core';
import { EntityManager } from '@mikro-orm/core';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { v7 } from 'uuid';
import { CreateUploadDto } from './dto/upload.dto';
import { FileAttachment, Issue, Project, ProjectTeam, Team } from '../../data-access';
import { WorkspacesService } from '../workspaces/workspaces.service';

type UploadTarget = {
  workspaceId: string;
  teamId: string;
  issueIdentifier?: string;
  projectId?: string;
};

@Injectable()
export class UploadsService {
  constructor(
    private readonly em: EntityManager,
    private readonly workspacesService: WorkspacesService,
    private readonly s3Service: AwsS3Service,
  ) {}

  private sanitizeFileName(fileName: string) {
    const baseName = fileName.split(/[\\/]/).pop()?.trim() ?? '';
    const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
    if (!safeName || safeName === '.' || safeName === '..') {
      throw new BadRequestException('A valid file name is required');
    }
    return safeName.slice(0, 180);
  }

  private async resolveTarget(
    memberId: string,
    issueIdentifier?: string,
    projectId?: string,
  ): Promise<UploadTarget> {
    if (Boolean(issueIdentifier) === Boolean(projectId)) {
      throw new BadRequestException(
        'Exactly one issueIdentifier or projectId is required',
      );
    }

    const accessibleTeamIds = await this.workspacesService.getAccessibleTeamIds(memberId);
    let teamId: string;
    const target: UploadTarget = { workspaceId: '', teamId: '' };

    if (issueIdentifier) {
      const issue = await this.em.findOne(Issue, { identifier: issueIdentifier });
      if (!issue || !accessibleTeamIds.includes(issue.teamId)) {
        throw new NotFoundException(`Issue ${issueIdentifier} not found`);
      }
      teamId = issue.teamId;
      target.issueIdentifier = issue.identifier;
    } else {
      const project = await this.em.findOne(Project, { id: projectId });
      if (!project) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }
      const projectTeamLinks = await this.em.find(ProjectTeam, { projectId: project.id });
      const projectTeamIds = [
        ...new Set([project.teamId, ...projectTeamLinks.map((link) => link.teamId)]),
      ];
      const projectTeams = await this.em.find(Team, { id: { $in: projectTeamIds } });
      const workspaceIds = new Set(projectTeams.map((team) => team.workspaceId));
      if (
        projectTeams.length !== projectTeamIds.length ||
        workspaceIds.size !== 1 ||
        !projectTeamIds.some((id) => accessibleTeamIds.includes(id))
      ) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }
      teamId = projectTeamIds.find((id) => accessibleTeamIds.includes(id))!;
      target.projectId = project.id;
    }

    const team = await this.em.findOne(Team, { id: teamId });
    if (!team?.workspaceId) {
      throw new NotFoundException('Upload target workspace not found');
    }

    target.teamId = team.id;
    target.workspaceId = team.workspaceId;
    return target;
  }

  private async assertAttachmentAccess(memberId: string, attachment: FileAttachment) {
    const accessibleTeamIds = await this.workspacesService.getAccessibleTeamIds(memberId);
    const attachmentTeam = await this.em.findOne(Team, { id: attachment.teamId });
    if (!attachmentTeam || attachmentTeam.workspaceId !== attachment.workspaceId) {
      throw new NotFoundException(`Upload ${attachment.id} not found`);
    }

    if (attachment.issueIdentifier) {
      const issue = await this.em.findOne(Issue, {
        identifier: attachment.issueIdentifier,
      });
      if (
        !issue ||
        issue.teamId !== attachmentTeam.id ||
        !accessibleTeamIds.includes(attachmentTeam.id)
      ) {
        throw new NotFoundException(`Upload ${attachment.id} not found`);
      }
      return;
    }

    if (attachment.projectId) {
      const project = await this.em.findOne(Project, { id: attachment.projectId });
      if (!project) throw new NotFoundException(`Upload ${attachment.id} not found`);
      const links = await this.em.find(ProjectTeam, { projectId: project.id });
      const projectTeamIds = [
        ...new Set([project.teamId, ...links.map((link) => link.teamId)]),
      ];
      const projectTeams = await this.em.find(Team, { id: { $in: projectTeamIds } });
      const workspaceIds = new Set(projectTeams.map((team) => team.workspaceId));
      if (
        projectTeams.length !== projectTeamIds.length ||
        workspaceIds.size !== 1 ||
        !workspaceIds.has(attachment.workspaceId) ||
        !projectTeamIds.includes(attachmentTeam.id) ||
        !projectTeamIds.some((teamId) => accessibleTeamIds.includes(teamId))
      ) {
        throw new NotFoundException(`Upload ${attachment.id} not found`);
      }
      return;
    }

    if (!accessibleTeamIds.includes(attachmentTeam.id)) {
      throw new NotFoundException(`Upload ${attachment.id} not found`);
    }
  }

  private toResponse(attachment: FileAttachment) {
    return {
      id: attachment.id,
      workspaceId: attachment.workspaceId,
      teamId: attachment.teamId,
      issueIdentifier: attachment.issueIdentifier ?? null,
      projectId: attachment.projectId ?? null,
      uploaderId: attachment.uploaderId,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      fileSize: attachment.fileSize,
      fileKey: attachment.fileKey,
      fileUrl: attachment.fileUrl,
      status: attachment.status,
      createdAt: attachment.createdAt,
      completedAt: attachment.completedAt ?? null,
    };
  }

  async createPresignedUpload(dto: CreateUploadDto, memberId: string) {
    if (!this.s3Service.isConfigured()) {
      throw new ServiceUnavailableException('File storage is not configured');
    }

    const target = await this.resolveTarget(memberId, dto.issueIdentifier, dto.projectId);
    const fileName = this.sanitizeFileName(dto.fileName);
    const folder = `workspaces/${target.workspaceId}/attachments`;
    const signed = await this.s3Service.getPresignedUploadUrl(
      `${v7()}-${fileName}`,
      dto.contentType,
      folder,
    );
    const attachment = new FileAttachment({
      workspaceId: target.workspaceId,
      teamId: target.teamId,
      issueIdentifier: target.issueIdentifier,
      projectId: target.projectId,
      uploaderId: memberId,
      fileName,
      contentType: dto.contentType,
      fileSize: dto.fileSize,
      fileKey: signed.fileKey,
      fileUrl: signed.fileUrl,
    });

    this.em.persist(attachment);
    await this.em.flush();
    return { ...this.toResponse(attachment), uploadUrl: signed.uploadUrl };
  }

  async complete(id: string, memberId: string) {
    const attachment = await this.em.findOne(FileAttachment, { id });
    if (!attachment) throw new NotFoundException(`Upload ${id} not found`);
    await this.assertAttachmentAccess(memberId, attachment);
    if (attachment.status === 'completed') return this.toResponse(attachment);

    try {
      await this.s3Service.assertObjectExists(attachment.fileKey);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new BadRequestException('The uploaded object is not available yet');
    }

    attachment.status = 'completed';
    attachment.completedAt = new Date();
    await this.em.flush();
    return this.toResponse(attachment);
  }

  async getDownloadUrl(id: string, memberId: string) {
    const attachment = await this.em.findOne(FileAttachment, {
      id,
      status: 'completed',
    });
    if (!attachment) throw new NotFoundException(`Upload ${id} not found`);
    await this.assertAttachmentAccess(memberId, attachment);

    const downloadUrl = await this.s3Service.getPresignedDownloadUrl(
      attachment.fileKey,
      attachment.fileName,
      attachment.contentType,
    );
    return { downloadUrl };
  }

  async findAll(memberId: string, issueIdentifier?: string, projectId?: string) {
    const target = await this.resolveTarget(memberId, issueIdentifier, projectId);
    const where: Record<string, unknown> = {
      workspaceId: target.workspaceId,
      status: 'completed',
    };
    if (target.issueIdentifier) {
      where.issueIdentifier = target.issueIdentifier;
      where.teamId = target.teamId;
      where.commentId = null;
    }
    if (target.projectId) where.projectId = target.projectId;

    const attachments = await this.em.find(FileAttachment, where);
    const accessResults = await Promise.allSettled(
      attachments.map((attachment) => this.assertAttachmentAccess(memberId, attachment)),
    );
    return attachments.flatMap((attachment, index) => {
      const accessResult = accessResults[index];
      if (accessResult.status === 'fulfilled') return [this.toResponse(attachment)];
      if (accessResult.reason instanceof NotFoundException) return [];
      throw accessResult.reason;
    });
  }
}
