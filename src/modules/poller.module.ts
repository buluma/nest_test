import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PollerService } from './poller/poller.service';
import { PollerController } from './poller/poller.controller';
import { WebhooksModule } from './webhooks.module';
import { ApiModule } from './api.module';

@Module({
  imports: [ScheduleModule.forRoot(), WebhooksModule, ApiModule],
  providers: [PollerService],
  controllers: [PollerController],
})
export class PollerModule {}
