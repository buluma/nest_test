import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly dbService: DatabaseService) {}

  async verifySignature(signature: string, body: any) {
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('Webhook secret not configured');
    }

    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', webhookSecret);
    const expectedSignature = `sha256=${hmac.update(JSON.stringify(body)).digest('hex')}`;
    
    if (signature !== expectedSignature) {
      throw new Error('Invalid webhook signature');
    }
  }

  async processEvent(eventType: string, deliveryId: string, event: any) {
    this.logger.log(`Processing event: ${eventType} (${deliveryId})`);
    
    // Handle PR events
    if (eventType === 'pull_request') {
      const pr = event.pull_request;
      const repo = await this.getRepoByFullName(pr.base.repo.full_name);
      if (repo) {
        await this.dbService.upsertPr({
          github_id: pr.id,
          repo_id: repo.id,
          number: pr.number,
          title: pr.title,
          state: pr.state,
          draft: pr.draft,
          author_login: pr.user.login,
          head_ref: pr.head.ref,
          base_ref: pr.base.ref,
          html_url: pr.html_url,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          closed_at: pr.closed_at,
          merged_at: pr.merged_at,
          merged_by_login: pr.merged_by?.login,
        });
      }
    }

    // Handle check_run events
    if (eventType === 'check_run') {
      const checkRun = event.check_run;
      const repo = await this.getRepoByFullName(checkRun.repository.full_name);
      if (repo) {
        await this.dbService.upsertRun({
          github_id: checkRun.id,
          repo_id: repo.id,
          workflow_id: checkRun.workflow_id,
          workflow_name: checkRun.name || 'Unknown workflow',
          run_number: checkRun.run_number || 0,
          event: checkRun.event || 'check_run',
          status: checkRun.status,
          conclusion: checkRun.conclusion,
          actor_login: checkRun.app?.slug || 'unknown',
          head_branch: checkRun.head_branch || '',
          head_sha: checkRun.head_sha || '',
          html_url: checkRun.html_url,
          run_started_at: checkRun.started_at || new Date().toISOString(),
          updated_at: checkRun.completed_at || new Date().toISOString(),
          completed_at: checkRun.completed_at,
        });
      }
    }

    // Log the event for audit
    await this.dbService.insertWebhookEvent({
      github_delivery_id: deliveryId,
      event_type: eventType,
      action: event.action || '',
      payload: JSON.stringify(event),
    });
  }

  private async getRepoByFullName(fullName: string): Promise<{ id: number } | null> {
    const repo = this.dbService.getRepoByFullName(fullName);
    return repo || null;
  }
}