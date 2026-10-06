import { User } from '@app/common';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { MessageEvent } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { PresenceService } from './presence.service';

@ApiTags('Presence')
@Controller('presence')
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  @ApiOperation({ summary: 'Send presence heartbeat' })
  @Post('heartbeat')
  async heartbeat(
    @User('id') userId: string,
    @Body() dto: HeartbeatDto,
  ): Promise<{ success: boolean }> {
    await this.presenceService.recordHeartbeat(userId, dto);
    return { success: true };
  }

  @ApiOperation({ summary: 'SSE stream for workspace presence updates' })
  @Sse('stream')
  stream(@Query('workspaceId') workspaceId: string): Observable<MessageEvent> {
    if (!workspaceId) {
      throw new BadRequestException('workspaceId query parameter is required');
    }
    return this.presenceService.getPresenceStream(workspaceId);
  }

  @ApiOperation({ summary: 'Get workspace presence snapshot' })
  @Get('workspace/:workspaceId')
  async getWorkspacePresence(
    @Param('workspaceId') workspaceId: string,
  ): Promise<{ presence: Record<string, string> }> {
    const presence = await this.presenceService.getWorkspacePresence(workspaceId);
    return { presence };
  }
}
