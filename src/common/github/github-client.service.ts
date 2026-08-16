import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from 'octokit';
import { GithubAppService } from './github-app.service';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class GithubClientService {
  private readonly logger = new Logger(GithubClientService.name);
  private appOctokit: Octokit | null = null;

  constructor(
    private githubAppService: GithubAppService,
    private dbService: DatabaseService
  ) {}

  async init() {
    this.appOctokit = await this.githubAppService.getInstallationOctokit();
    this.logger.log('GitHub App Octokit initialized');
  }

  private getOctokit(): Octokit {
    if (!this.appOctokit) {
      throw new Error('GitHub App Octokit not initialized. Call init() first.');
    }
    return this.appOctokit;
  }

  async getAllRepos() {
    const { data } = await this.getOctokit().request('GET /installation/repositories', {
      per_page: 100,
    });
    return data.repositories.map((repo: any) => ({
      github_id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      owner_login: repo.owner.login,
      private: repo.private,
      html_url: repo.html_url,
      updated_at: repo.updated_at,
    }));
  }

  async getPRs(owner: string, repo: string, state: string = 'open', since: string = 'now') {
    const { data } = await this.getOctokit().rest.pulls.list({
      owner,
      repo,
      state: state as any,
      sort: 'updated',
      direction: 'desc',
      per_page: 100,
    });

    return data.map(pr => ({
      github_id: pr.number,
      number: pr.number,
      title: pr.title,
      state: pr.state,
      draft: pr.draft,
      author_login: pr.user?.login,
      head_ref: pr.head.ref,
      base_ref: pr.base.ref,
      html_url: pr.html_url,
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      closed_at: pr.closed_at,
      merged_at: pr.merged_at,
      merged_by_login: (pr as any).merged_by?.login,
    }));
  }

  async getActionRuns(owner: string, repo: string, status: string = 'completed', since: string = 'now') {
    const { data } = await this.getOctokit().rest.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      status: status as any,
      per_page: 100,
    });

    return data.workflow_runs.map((run: any) => ({
      github_id: run.id,
      workflow_id: run.workflow_id,
      workflow_name: run.name || run.display_title || 'Unknown workflow',
      run_number: run.run_number,
      event: run.event,
      status: run.status,
      conclusion: run.conclusion,
      actor_login: run.actor?.login || 'unknown',
      head_branch: run.head_branch || '',
      head_sha: run.head_sha || '',
      html_url: run.html_url,
      run_started_at: run.run_started_at,
      updated_at: run.updated_at,
      completed_at: run.completed_at,
    }));
  }

  async syncRepos() {
    const repos = await this.getAllRepos();
    repos.forEach(async (repo: any) => {
      await this.dbService.upsertRepo({
        github_id: repo.github_id,
        name: repo.name,
        full_name: repo.full_name,
        owner_login: repo.owner_login,
        private: repo.private,
        html_url: repo.html_url,
        updated_at: repo.updated_at,
      });
    });
    this.logger.log(`Synced ${repos.length} repositories`);
  }

  async syncPRs(owner: string, repo: string, repoId: number) {
    const prs = await this.getPRs(owner, repo);
    prs.forEach(async (pr: any) => {
      await this.dbService.upsertPr({
        github_id: pr.github_id,
        repo_id: repoId,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        draft: pr.draft,
        author_login: pr.author_login,
        head_ref: pr.head_ref,
        base_ref: pr.base_ref,
        html_url: pr.html_url,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        closed_at: pr.closed_at,
        merged_at: pr.merged_at,
        merged_by_login: pr.merged_by_login,
      });
    });
    this.logger.log(`Synced ${prs.length} PRs for repo ${repoId}`);
  }

  async syncActionRuns(owner: string, repo: string, repoId: number) {
    const runs = await this.getActionRuns(owner, repo);
    runs.forEach(async (run: any) => {
      await this.dbService.upsertRun({
        github_id: run.github_id,
        repo_id: repoId,
        workflow_id: run.workflow_id,
        workflow_name: run.workflow_name,
        run_number: run.run_number,
        event: run.event,
        status: run.status,
        conclusion: run.conclusion,
        actor_login: run.actor_login,
        head_branch: run.head_branch,
        head_sha: run.head_sha,
        html_url: run.html_url,
        run_started_at: run.run_started_at,
        updated_at: run.updated_at,
        completed_at: run.completed_at,
      });
    });
    this.logger.log(`Synced ${runs.length} Action runs for repo ${repoId}`);
  }
}