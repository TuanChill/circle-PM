import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

export class LarkMemberMappingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @ApiProperty({
    description: 'Lark open_id for the selected member, or empty to clear it',
  })
  @IsString()
  @Length(0, 255)
  openId: string;
}

export class UpdateLarkIntegrationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 255)
  appId?: string;

  @ApiPropertyOptional({
    description: 'Only supplied when setting or rotating the secret',
  })
  @IsOptional()
  @IsString()
  @Length(1, 2048)
  appSecret?: string;

  @ApiPropertyOptional({ enum: ['https://open.larksuite.com', 'https://open.feishu.cn'] })
  @IsOptional()
  @IsIn(['https://open.larksuite.com', 'https://open.feishu.cn'])
  domain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 255)
  groupChatId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ type: [LarkMemberMappingDto] })
  @IsOptional()
  @IsArray()
  @ArrayUnique((mapping: LarkMemberMappingDto) => mapping.memberId)
  @ValidateNested({ each: true })
  @Type(() => LarkMemberMappingDto)
  memberMappings?: LarkMemberMappingDto[];
}
