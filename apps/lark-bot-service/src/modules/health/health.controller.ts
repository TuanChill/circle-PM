import { Controller, Get } from '@nestjs/common';
import { LarkAssignmentWorker } from '../lark/lark-assignment-worker';

@Controller('health')
export class HealthController {
  constructor(private readonly worker: LarkAssignmentWorker) {}

  @Get()
  getHealth() {
    return this.worker.getHealth();
  }
}
