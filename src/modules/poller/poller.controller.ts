import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PollerService } from './poller.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('poller')
@Controller('poller')
export class PollerController {
  constructor(private pollerService: PollerService) {}

  @Post('trigger')
  @ApiOperation({ summary: 'Trigger manual GitHub data sync' })
  @ApiResponse({ status: 200, description: 'Sync completed' })
  @ApiResponse({ status: 429, description: 'Previous sync still running' })
  async triggerSync() {
    return this.pollerService.triggerManualSync();
  }

  @Get('status')
  @ApiOperation({ summary: 'Get poller status' })
  @ApiResponse({ status: 200, description: 'Returns poller status' })
  getStatus() {
    return { timestamp: new Date().toISOString() };
  }
}