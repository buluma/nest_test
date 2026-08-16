import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { RepoService } from './repos.service';
import { GithubClientService } from '../../common/github/github-client.service';
import { DatabaseService } from '../../common/database/database.service';

@Controller('repos')
export class ReposController {
  constructor(
    private readonly repoService: RepoService,
    private readonly githubClientService: GithubClientService
  ) {}

  @Get()
  async getRepos() {
    return this.repoService.getAllRepos();
  }

  @Get(':id')
  async getRepoById(id: number) {
    return this.repoService.getRepoById(id);
  }

  @Post()
  async createRepo(@Body() body: any) {
    return this.repoService.createRepo(body);
  }

  @Put(':id')
  async updateRepo(id: number, @Body() body: any) {
    return this.repoService.updateRepo(id, body);
  }

  @Delete(':id')
  async deleteRepo(id: number) {
    return this.repoService.deleteRepo(id);
  }
}