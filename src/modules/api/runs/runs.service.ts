import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../common/database/database.service';
import { RunDTO, RunRow } from '../../../common/types/github';

@Injectable()
export class RunsService {
  constructor(private readonly dbService: DatabaseService) {}

  getRuns(filters: {
    repoId?: number;
    status?: string;
    since?: string;
    limit?: number;
    offset?: number;
  }): RunRow[] {
    return this.dbService.getRuns({
      repo_id: filters.repoId,
      status: filters.status === 'all' ? undefined : filters.status,
      since:
        filters.since && filters.since !== 'now' ? filters.since : undefined,
      limit: filters.limit,
      offset: filters.offset,
    });
  }

  getRunById(): { message: string } {
    // Implementation depends on schema
    return { message: 'Get run by ID not fully implemented' };
  }

  createRun(body: RunDTO): ReturnType<DatabaseService['upsertRun']> {
    return this.dbService.upsertRun({
      github_id: body.github_id,
      repo_id: body.repo_id!,
      workflow_id: body.workflow_id,
      workflow_name: body.workflow_name,
      run_number: body.run_number,
      event: body.event,
      status: body.status,
      conclusion: body.conclusion,
      actor_login: body.actor_login,
      head_branch: body.head_branch,
      head_sha: body.head_sha,
      html_url: body.html_url,
      run_started_at: body.run_started_at,
      updated_at: body.updated_at,
      completed_at: body.completed_at,
    });
  }

  updateRun(body: RunDTO): ReturnType<DatabaseService['upsertRun']> {
    return this.dbService.upsertRun({
      github_id: body.github_id,
      repo_id: body.repo_id!,
      workflow_id: body.workflow_id,
      workflow_name: body.workflow_name,
      run_number: body.run_number,
      event: body.event,
      status: body.status,
      conclusion: body.conclusion,
      actor_login: body.actor_login,
      head_branch: body.head_branch,
      head_sha: body.head_sha,
      html_url: body.html_url,
      run_started_at: body.run_started_at,
      updated_at: body.updated_at,
      completed_at: body.completed_at,
    });
  }

  deleteRun(): { message: string } {
    return { message: 'Delete not fully implemented' };
  }
}
