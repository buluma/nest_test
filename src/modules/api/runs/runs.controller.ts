import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
} from '@nestjs/common';
import { RunsService } from '../runs/runs.service';
import { GithubClientService } from '../../../common/github/github-client.service';
import type { RunDTO } from '../../../common/types/github';

@Controller('runs')
export class RunsController {
  constructor(
    private readonly runsService: RunsService,
    private readonly githubClientService: GithubClientService,
  ) {}

  @Get()
  getRuns(
    @Query('repoId') repoId: number,
    @Query('status') status: string = 'all',
    @Query('since') since: string = 'now',
    @Query('limit') limit: number = 100,
    @Query('offset') offset: number = 0,
  ) {
    return this.runsService.getRuns({
      repoId,
      status,
      since,
      limit,
      offset,
    });
  }

  @Get(':id')
  getRunById() {
    return this.runsService.getRunById();
  }

  @Post()
  createRun(@Body() body: RunDTO) {
    return this.runsService.createRun(body);
  }

  @Put(':id')
  updateRun(@Body() body: RunDTO) {
    return this.runsService.updateRun(body);
  }

  @Delete(':id')
  deleteRun() {
    return this.runsService.deleteRun();
  }
}
