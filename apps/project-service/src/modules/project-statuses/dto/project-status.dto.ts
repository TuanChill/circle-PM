import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const PROJECT_STATUS_CATEGORIES = [
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
] as const;

export class CreateProjectStatusDto {
  @ApiProperty({ maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: '#f2c94c' })
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color: string;

  @ApiProperty({ enum: PROJECT_STATUS_CATEGORIES })
  @IsString()
  @IsIn(PROJECT_STATUS_CATEGORIES)
  category: (typeof PROJECT_STATUS_CATEGORIES)[number];
}
