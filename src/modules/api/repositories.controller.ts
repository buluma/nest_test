import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { RepoService } from './repos.service';
import { GithubClientService } from '../../common/github/github-client.service';
import type { RepoDTO } from '../../common/types/github';

@Controller('repos')
export class ReposController {
  constructor(
    private readonly repoService: RepoService,
    private readonly githubClientService: GithubClientService,
  ) {}

  @Get()
  getRepos() {
    return this.repoService.getAllRepos();
  }

  @Get(':id')
  getRepoById(@Param('id') id: number) {
    return this.repoService.getRepoById(id);
  }

  @Post()
  createRepo(@Body() body: RepoDTO) {
    return this.repoService.createRepo(body);
  }

  @Put(':id')
  updateRepo(@Body() body: RepoDTO) {
    return this.repoService.updateRepo(body);
  }

  @Delete(':id')
  deleteRepo() {
    return this.repoService.deleteRepo();
  }
}
