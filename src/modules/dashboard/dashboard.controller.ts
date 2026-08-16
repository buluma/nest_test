import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as path from 'path';

@Controller('dashboard')
export class DashboardController {
  @Get()
  getDashboard(@Res() res: Response) {
    res.sendFile(path.join(process.cwd(), 'src', 'modules', 'dashboard', 'index.html'));
  }
}