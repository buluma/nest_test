import { Module } from '@nestjs/common';
import { ReposController } from './api/repositories.controller';
import { PrsController } from './api/prs/prs.controller';
import { RunsController } from './api/runs/runs.controller';
import { RepoService } from './api/repos.service';
import { PrService } from './api/prs/prs.service';
import { RunsService } from './api/runs/runs.service';
import { GithubClientService } from '../common/github/github-client.service';

@Module({
  controllers: [ReposController, PrsController, RunsController],
  providers: [RepoService, PrService, RunsService, GithubClientService],
  exports: [GithubClientService],
})
export class ApiModule {}
