import { User } from '@app/common';
import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UpdateLarkIntegrationDto } from './dto/update-lark-integration.dto';
import { LarkIntegrationService } from './lark-integration.service';

@ApiTags('Workspace Lark integration')
@ApiBearerAuth()
@Controller('workspaces/:workspaceId/lark-integration')
export class LarkIntegrationController {
  constructor(private readonly service: LarkIntegrationService) {}

  @Get()
  @ApiOperation({ summary: 'Get workspace Lark notification settings' })
  get(@Param('workspaceId') workspaceId: string, @User('id') actorId: string) {
    return this.service.get(workspaceId, actorId);
  }

  @Put()
  @ApiOperation({
    summary: 'Update workspace Lark notification settings and member mappings',
  })
  update(
    @Param('workspaceId') workspaceId: string,
    @User('id') actorId: string,
    @Body() dto: UpdateLarkIntegrationDto,
  ) {
    return this.service.update(workspaceId, actorId, dto);
  }
}
