import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from 'octokit';
import { GithubAppService } from './github-app.service';
import { DatabaseService } from '../database/database.service';
import {
  GitHubRepository,
  RepoDTO,
  PRDTO,
  RunDTO,
  IssueRow,
  CommitRow,
} from '../types/github';

interface InstallationRepositoriesResponse {
  repositories: GitHubRepository[];
}

@Injectable()
export class GithubClientService {
  private readonly logger = new Logger(GithubClientService.name);
  private appOctokit: Octokit | null = null;

  constructor(
    private githubAppService: GithubAppService,
    private dbService: DatabaseService,
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

  async getAllRepos(): Promise<RepoDTO[]> {
    const response = await this.getOctokit().request(
      'GET /installation/repositories',
      { per_page: 100 },
    );
    const data = response.data as InstallationRepositoriesResponse;
    const repositories: GitHubRepository[] = data.repositories;
    return repositories.map((repo: GitHubRepository): RepoDTO => ({
      github_id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      owner_login: repo.owner.login,
      private: repo.private,
      html_url: repo.html_url,
      language: repo.language ?? null,
      updated_at: repo.updated_at,
    }));
  }

  async getPRs(
    owner: string,
    repo: string,
    state: string = 'open',
  ): Promise<PRDTO[]> {
    const { data } = await this.getOctokit().rest.pulls.list({
      owner,
      repo,
      state: state as 'open' | 'closed' | 'all',
      sort: 'updated',
      direction: 'desc',
      per_page: 100,
    });

    // Cast through unknown to avoid TypeScript structural typing issues
    const pulls = data as unknown as Array<{
      number: number;
      title: string;
      state: string;
      draft: boolean;
      user: { login: string } | null;
      head: { ref: string };
      base: { ref: string };
      html_url: string;
      created_at: string;
      updated_at: string;
      closed_at: string | null;
      merged_at: string | null;
      merged_by: { login: string } | null;
    }>;

    return pulls.map((pr): PRDTO => ({
      github_id: pr.number,
      number: pr.number,
      title: pr.title,
      state: pr.state,
      draft: pr.draft,
      author_login: pr.user?.login ?? '',
      head_ref: pr.head.ref,
      base_ref: pr.base.ref,
      html_url: pr.html_url,
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      closed_at: pr.closed_at,
      merged_at: pr.merged_at,
      merged_by_login: pr.merged_by?.login ?? null,
    }));
  }

  async getActionRuns(
    owner: string,
    repo: string,
    status: string = 'completed',
  ): Promise<RunDTO[]> {
    const response =
      await this.getOctokit().rest.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        status: status as 'completed' | 'in_progress' | 'queued' | 'waiting',
        per_page: 100,
      });

    const data = response.data as unknown as {
      workflow_runs: Array<{
        id: number;
        workflow_id: number;
        name: string | null;
        display_title: string | null;
        run_number: number;
        event: string;
        status: string;
        conclusion: string | null;
        actor: { login: string } | null;
        head_branch: string | null;
        head_sha: string | null;
        html_url: string;
        run_started_at: string;
        updated_at: string;
        completed_at: string | null;
      }>;
    };

    return data.workflow_runs.map((run): RunDTO => ({
      github_id: run.id,
      workflow_id: run.workflow_id,
      workflow_name: run.name ?? run.display_title ?? 'Unknown workflow',
      run_number: run.run_number,
      event: run.event,
      status: run.status,
      conclusion: run.conclusion,
      actor_login: run.actor?.login ?? 'unknown',
      head_branch: run.head_branch ?? '',
      head_sha: run.head_sha ?? '',
      html_url: run.html_url,
      run_started_at: run.run_started_at,
      updated_at: run.updated_at,
      completed_at: run.completed_at,
    }));
  }

  async getIssues(
    owner: string,
    repo: string,
    state: string = 'open',
  ): Promise<IssueRow[]> {
    try {
      const { data } = await this.getOctokit().rest.issues.listForRepo({
        owner,
        repo,
        state: state as 'open' | 'closed' | 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: 50,
      });

      const issues = data as unknown as Array<{
        id: number;
        number: number;
        title: string;
        state: string;
        html_url: string;
        user: { login: string } | null;
        updated_at: string;
        pull_request?: unknown;
      }>;

      return issues
        .filter((issue) => !issue.pull_request)
        .map((issue): IssueRow => ({
          id: issue.id,
          number: issue.number,
          title: issue.title,
          state: issue.state,
          html_url: issue.html_url,
          author_login: issue.user?.login ?? 'unknown',
          updated_at: issue.updated_at,
        }));
    } catch (error) {
      this.logger.warn(
        `Issues unavailable for ${owner}/${repo}: ${(error as Error).message}`,
      );
      return [];
    }
  }

  async getCommits(owner: string, repo: string): Promise<CommitRow[]> {
    const { data } = await this.getOctokit().rest.repos.listCommits({
      owner,
      repo,
      per_page: 50,
    });

    const commits = data as unknown as Array<{
      sha: string;
      html_url: string;
      commit: { message: string; committer: { date: string } | null };
      author: { login: string } | null;
    }>;

    return commits.map((commit): CommitRow => ({
      sha: commit.sha,
      message: commit.commit.message,
      html_url: commit.html_url,
      author_login: commit.author?.login ?? 'unknown',
      committed_at: commit.commit.committer?.date ?? new Date().toISOString(),
    }));
  }

  async syncRepos(): Promise<void> {
    const repos = await this.getAllRepos();
    for (const repo of repos) {
      this.dbService.upsertRepo(repo);
    }
    this.logger.log(`Synced ${repos.length} repositories`);
  }

  async syncPRs(owner: string, repo: string, repoId: number): Promise<void> {
    const prs = await this.getPRs(owner, repo);
    for (const pr of prs) {
      this.dbService.upsertPr({
        ...pr,
        repo_id: repoId,
      });
    }
    this.logger.log(`Synced ${prs.length} PRs for repo ${repoId}`);
  }

  async syncActionRuns(
    owner: string,
    repo: string,
    repoId: number,
  ): Promise<void> {
    const runs = await this.getActionRuns(owner, repo);
    for (const run of runs) {
      this.dbService.upsertRun({
        ...run,
        repo_id: repoId,
      });
    }
    this.logger.log(`Synced ${runs.length} Action runs for repo ${repoId}`);
  }
}
