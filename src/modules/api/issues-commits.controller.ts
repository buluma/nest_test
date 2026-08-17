import { Controller, Get, Query } from '@nestjs/common';
import { GithubClientService } from '../../common/github/github-client.service';
import { RepoService } from './repos.service';
import type { IssueRow, CommitRow } from '../../common/types/github';

@Controller()
export class IssuesCommitsController {
  constructor(
    private readonly repoService: RepoService,
    private readonly githubClientService: GithubClientService,
  ) {}

  @Get('issues')
  async getIssues(
    @Query('repoId') repoId?: string,
    @Query('state') state: string = 'open',
  ): Promise<IssueRow[]> {
    if (!repoId) return [];
    const repo = this.repoService.getRepoByNumericId(Number(repoId));
    if (!repo) return [];
    const [owner, name] = repo.full_name.split('/');
    try {
      return await this.githubClientService.getIssues(owner, name, state);
    } catch {
      return [];
    }
  }

  @Get('commits')
  async getCommits(@Query('repoId') repoId?: string): Promise<CommitRow[]> {
    if (!repoId) return [];
    const repo = this.repoService.getRepoByNumericId(Number(repoId));
    if (!repo) return [];
    const [owner, name] = repo.full_name.split('/');
    try {
      return await this.githubClientService.getCommits(owner, name);
    } catch {
      return [];
    }
  }
}
