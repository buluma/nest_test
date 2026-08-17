import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../common/database/database.service';
import { PRRow, PRDTO } from '../../../common/types/github';

@Injectable()
export class PrService {
  constructor(private readonly dbService: DatabaseService) {}

  getPRs(repoId?: number, state: string = 'all', since?: string): PRRow[] {
    return this.dbService.getPrs({
      repo_id: repoId,
      state: state === 'all' ? undefined : state,
      since: since && since !== 'now' ? since : undefined,
      limit: 100,
      offset: 0,
    });
  }

  getPrById(id: number): PRRow | undefined {
    return this.dbService.getPrById(id);
  }

  createPr(body: PRDTO): ReturnType<DatabaseService['upsertPr']> {
    return this.dbService.upsertPr({
      github_id: body.github_id,
      repo_id: body.repo_id!,
      number: body.number,
      title: body.title,
      state: body.state,
      draft: body.draft,
      author_login: body.author_login,
      head_ref: body.head_ref,
      base_ref: body.base_ref,
      html_url: body.html_url,
      created_at: body.created_at,
      updated_at: body.updated_at,
      closed_at: body.closed_at,
      merged_at: body.merged_at,
      merged_by_login: body.merged_by_login,
    });
  }

  updatePr(body: PRDTO): ReturnType<DatabaseService['upsertPr']> {
    return this.dbService.upsertPr({
      github_id: body.github_id,
      repo_id: body.repo_id!,
      number: body.number,
      title: body.title,
      state: body.state,
      draft: body.draft,
      author_login: body.author_login,
      head_ref: body.head_ref,
      base_ref: body.base_ref,
      html_url: body.html_url,
      created_at: body.created_at,
      updated_at: body.updated_at,
      closed_at: body.closed_at,
      merged_at: body.merged_at,
      merged_by_login: body.merged_by_login,
    });
  }

  deletePr(): { message: string } {
    return { message: 'Delete not fully implemented' };
  }
}
