import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GithubClientService } from '../../common/github/github-client.service';
import { DatabaseService } from '../../common/database/database.service';

@Injectable()
export class PollerService implements OnModuleInit {
  private readonly logger = new Logger(PollerService.name);
  private isPolling = false;

  constructor(
    private githubClientService: GithubClientService,
    private dbService: DatabaseService,
  ) {}

  async onModuleInit() {
    await this.githubClientService.init();
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async poll() {
    if (this.isPolling) {
      this.logger.warn('Previous poll still running, skipping');
      return;
    }
    this.isPolling = true;
    try {
      this.logger.log('Starting GitHub data sync...');
      await this.githubClientService.syncRepos();
      const repos = this.dbService.getAllRepos();
      for (const repo of repos) {
        const [owner, name] = repo.full_name.split('/');
        await this.githubClientService.syncPRs(owner, name, repo.id);
        await this.githubClientService.syncActionRuns(owner, name, repo.id);
      }
      this.logger.log('GitHub data sync completed');
    } catch (error) {
      this.logger.error('Poll failed', error);
    } finally {
      this.isPolling = false;
    }
  }

  async triggerManualSync(): Promise<{ status: string; message: string }> {
    if (this.isPolling) {
      return { status: 'skipped', message: 'Previous poll still running' };
    }
    await this.poll();
    return { status: 'completed', message: 'Manual sync completed' };
  }
}
