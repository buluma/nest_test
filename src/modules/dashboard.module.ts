import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard/dashboard.controller';
import { DatabaseModule } from '../common/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
