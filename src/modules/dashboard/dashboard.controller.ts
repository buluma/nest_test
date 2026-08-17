import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as path from 'path';
import { DatabaseService } from '../../common/database/database.service';
import type { DashboardSummary } from '../../common/types/github';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dbService: DatabaseService) {}

  @Get()
  getDashboard(@Res() res: Response) {
    res.sendFile(
      path.join(process.cwd(), 'src', 'modules', 'dashboard', 'index.html'),
    );
  }

  @Get('summary')
  getSummary(): DashboardSummary {
    return this.dbService.getDashboardSummary();
  }
}
