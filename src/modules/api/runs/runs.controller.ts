import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { RunsService } from '../runs/runs.service';
import { GithubClientService } from '../../../common/github/github-client.service';
import { DatabaseService } from '../../../common/database/database.service';

@Controller('runs')
export class RunsController {
  constructor(
    private readonly runsService: RunsService,
    private readonly githubClientService: GithubClientService,
    private readonly dbService: DatabaseService
  ) {}

  @Get()
  async getRuns(
    @Query('repoId') repoId: number,
    @Query('status') status: string = 'all',
    @Query('since') since: string = 'now',
    @Query('limit') limit: number = 100,
    @Query('offset') offset: number = 0
  ) {
    return this.runsService.getRuns({
      repoId,
      status,
      since,
      limit,
      offset
    });
  }

  @Get(':id')
  async getRunById(id: number) {
    return this.runsService.getRunById(id);
  }

  @Post()
  async createRun(@Body() body: any) {
    return this.runsService.createRun(body);
  }

  @Put(':id')
  async updateRun(id: number, @Body() body: any) {
    return this.runsService.updateRun(id, body);
  }

  @Delete(':id')
  async deleteRun(id: number) {
    return this.runsService.deleteRun(id);
  }
}