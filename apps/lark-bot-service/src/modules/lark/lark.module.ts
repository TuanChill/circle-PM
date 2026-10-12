import { Module } from '@nestjs/common';
import { LarkAssignmentWorker } from './lark-assignment-worker';

@Module({ providers: [LarkAssignmentWorker], exports: [LarkAssignmentWorker] })
export class LarkModule {}
