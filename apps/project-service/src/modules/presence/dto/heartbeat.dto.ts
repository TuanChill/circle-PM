import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class HeartbeatDto {
  @ApiProperty({ enum: ['online', 'away'], default: 'online' })
  @IsIn(['online', 'away'])
  status: 'online' | 'away';

  @ApiProperty({ description: 'Workspace ID' })
  @IsString()
  @IsNotEmpty()
  workspaceId: string;
}
