import { Module } from '@nestjs/common';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { SesMailerService } from '../email/ses-mailer.service';
import { PresenceModule } from '../presence/presence.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [WorkspacesModule, PresenceModule],
  controllers: [MembersController],
  providers: [MembersService, SesMailerService],
  exports: [MembersService, SesMailerService],
})
export class MembersModule {}
