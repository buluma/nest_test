import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { PrService } from './prs.service';
import { GithubClientService } from '../../../common/github/github-client.service';
import type { PRDTO } from '../../../common/types/github';

@Controller('prs')
export class PrsController {
  constructor(
    private readonly prService: PrService,
    private readonly githubClientService: GithubClientService,
  ) {}

  @Get()
  getPRs(
    @Query('repoId') repoId?: string,
    @Query('state') state: string = 'open',
    @Query('since') since: string = 'now',
  ) {
    return this.prService.getPRs(
      repoId ? Number(repoId) : undefined,
      state,
      since,
    );
  }

  @Get(':id')
  getPrById(@Param('id') id: string) {
    return this.prService.getPrById(Number(id));
  }

  @Post()
  createPr(@Body() body: PRDTO) {
    return this.prService.createPr(body);
  }

  @Put(':id')
  updatePr(@Body() body: PRDTO) {
    return this.prService.updatePr(body);
  }

  @Delete(':id')
  deletePr() {
    return this.prService.deletePr();
  }
}
