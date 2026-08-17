import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { RepoRow, RepoDTO } from '../../common/types/github';

@Injectable()
export class RepoService {
  constructor(private readonly dbService: DatabaseService) {}

  getAllRepos(): RepoRow[] {
    return this.dbService.getAllRepos();
  }

  getRepoById(id: number): { id: number } | undefined {
    return this.dbService.getRepoByGithubId(id);
  }

  getRepoByNumericId(id: number): RepoRow | undefined {
    if (!id) return undefined;
    return this.dbService.getAllRepos().find((repo) => repo.id === id);
  }

  createRepo(body: RepoDTO): ReturnType<DatabaseService['upsertRepo']> {
    return this.dbService.upsertRepo({
      github_id: body.github_id,
      name: body.name,
      full_name: body.full_name,
      owner_login: body.owner_login,
      private: body.private,
      html_url: body.html_url,
      language: body.language ?? null,
      updated_at: body.updated_at,
    });
  }

  updateRepo(body: RepoDTO): ReturnType<DatabaseService['upsertRepo']> {
    return this.dbService.upsertRepo({
      github_id: body.github_id,
      name: body.name,
      full_name: body.full_name,
      owner_login: body.owner_login,
      private: body.private,
      html_url: body.html_url,
      language: body.language ?? null,
      updated_at: body.updated_at,
    });
  }

  deleteRepo(): { message: string } {
    // Implementation depends on schema
    return { message: 'Delete not fully implemented' };
  }
}
