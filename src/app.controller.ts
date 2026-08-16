import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as path from 'path';

@Controller()
export class AppController {
  @Get()
  getDashboard(@Res() res: Response) {
    res.sendFile(
      path.join(process.cwd(), 'src', 'modules', 'dashboard', 'index.html'),
    );
  }
}