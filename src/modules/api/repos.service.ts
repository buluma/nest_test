import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';

@Injectable()
export class RepoService {
  constructor(private readonly dbService: DatabaseService) {}

  async getAllRepos() {
    return this.dbService.getAllRepos();
  }

  async getRepoById(id: number) {
    return this.dbService.getRepoByGithubId(id);
  }

  async createRepo(body: any) {
    return this.dbService.upsertRepo({
      github_id: body.github_id,
      name: body.name,
      full_name: body.full_name,
      owner_login: body.owner_login,
      private: body.private,
      html_url: body.html_url,
      updated_at: body.updated_at,
    });
  }

  async updateRepo(id: number, body: any) {
    return this.dbService.upsertRepo({
      github_id: body.github_id,
      name: body.name,
      full_name: body.full_name,
      owner_login: body.owner_login,
      private: body.private,
      html_url: body.html_url,
      updated_at: body.updated_at,
    });
  }

  async deleteRepo(id: number) {
    // Implementation depends on schema
    return { message: 'Delete not fully implemented' };
  }
}