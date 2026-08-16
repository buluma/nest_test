import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../common/database/database.service';

@Injectable()
export class PrService {
  constructor(private readonly dbService: DatabaseService) {}

  async getPRs(repoId?: number, state: string = 'all', since?: string) {
    return this.dbService.getPrs({
      repo_id: repoId,
      state: state === 'all' ? undefined : state,
      since: since && since !== 'now' ? since : undefined,
      limit: 100,
      offset: 0,
    });
  }

  async getPrById(id: number) {
    return this.dbService.getPrById(id);
  }

  async createPr(body: any) {
    return this.dbService.upsertPr({
      github_id: body.github_id,
      repo_id: body.repo_id,
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

  async updatePr(id: number, body: any) {
    return this.dbService.upsertPr({
      github_id: body.github_id,
      repo_id: body.repo_id,
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

  async deletePr(id: number) {
    return { message: 'Delete not fully implemented' };
  }
}