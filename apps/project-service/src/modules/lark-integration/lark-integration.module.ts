import { Module } from '@nestjs/common';
import { LarkIntegrationController } from './lark-integration.controller';
import { LarkIntegrationGrpcController } from './lark-integration.grpc.controller';
import { LarkIntegrationService } from './lark-integration.service';

@Module({
  controllers: [LarkIntegrationController, LarkIntegrationGrpcController],
  providers: [LarkIntegrationService],
  exports: [LarkIntegrationService],
})
export class LarkIntegrationModule {}
