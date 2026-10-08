import {
  IsArray,
  IsHexColor,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IssueStatusCategory } from '../../../data-access/issue/issue-status.entity';

export const ISSUE_STATUS_CATEGORIES: IssueStatusCategory[] = [
  'triage',
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
];

export class CreateIssueStatusDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsHexColor()
  color: string;

  @IsIn(ISSUE_STATUS_CATEGORIES)
  category: IssueStatusCategory;
}

export class UpdateIssueStatusDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;
}

export class ReorderIssueStatusesDto {
  @IsIn(ISSUE_STATUS_CATEGORIES)
  category: IssueStatusCategory;

  @IsArray()
  @IsString({ each: true })
  statusIds: string[];
}
