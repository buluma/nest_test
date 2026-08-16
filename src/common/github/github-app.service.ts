import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App } from 'octokit';
import { GithubConfig } from '../config/github.config';

@Injectable()
export class GithubAppService implements OnModuleInit {
  private readonly logger = new Logger(GithubAppService.name);
  private app: App | null = null;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const config = this.configService.get<GithubConfig>('github');
    if (!config) {
      throw new Error('Github configuration not found');
    }

    this.app = new App({
      appId: config.appId,
      privateKey: config.privateKey,
    });

    this.logger.log('GitHub App initialized');
  }

  /**
   * Returns an Octokit instance authenticated as the App.
   * Useful for getting installations.
   */
  getAppOctokit() {
    if (!this.app) throw new Error('GitHub App not initialized');
    return this.app.octokit;
  }

  /**
   * Gets the first installation ID for this App.
   * Since this is a personal dashboard, we assume a single installation.
   */
  async getInstallationId(): Promise<number> {
    const octokit = this.getAppOctokit();
    const { data: installations } = await octokit.rest.apps.listInstallations();

    if (installations.length === 0) {
      throw new Error(
        'No installations found for this GitHub App. Please install it on at least one repo/org.',
      );
    }

    return installations[0].id;
  }

  /**
   * Returns an Octokit instance authenticated as the specific installation.
   * This is what we use for most API calls (PRs, Actions, etc).
   */
  async getInstallationOctokit() {
    if (!this.app) throw new Error('GitHub App not initialized');
    const installationId = await this.getInstallationId();
    return this.app.getInstallationOctokit(installationId);
  }

  /**
   * Returns the webhook secret for signature verification.
   */
  getWebhookSecret(): string {
    const config = this.configService.get<GithubConfig>('github');
    return config?.webhookSecret || '';
  }
}
