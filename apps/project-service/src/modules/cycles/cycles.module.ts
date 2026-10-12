import { Module } from '@nestjs/common';
import { CycleAutomationScheduler } from './cycle-automation-scheduler';
import { CyclesController } from './cycles.controller';
import { CyclesService } from './cycles.service';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [WorkspacesModule],
  controllers: [CyclesController],
  providers: [CyclesService, CycleAutomationScheduler],
  exports: [CyclesService],
})
export class CyclesModule {}
