import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { PrService } from './prs.service';
import { GithubClientService } from '../../../common/github/github-client.service';
import { DatabaseService } from '../../../common/database/database.service';

@Controller('prs')
export class PrsController {
  constructor(
    private readonly prService: PrService,
    private readonly githubClientService: GithubClientService
  ) {}

  @Get()
  async getPRs(@Query('repoId') repoId: number, @Query('state') state: string = 'open', @Query('since') since: string = 'now') {
    return this.prService.getPRs(repoId, state, since);
  }

  @Get(':id')
  async getPrById(id: number) {
    return this.prService.getPrById(id);
  }

  @Post()
  async createPr(@Body() body: any) {
    return this.prService.createPr(body);
  }

  @Put(':id')
  async updatePr(id: number, @Body() body: any) {
    return this.prService.updatePr(id, body);
  }

  @Delete(':id')
  async deletePr(id: number) {
    return this.prService.deletePr(id);
  }
}