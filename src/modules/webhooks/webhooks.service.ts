import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../../common/database/database.service';
import { PRDTO, RunDTO } from '../../common/types/github';

interface GitHubPullRequestEvent {
  pull_request: {
    id: number;
    number: number;
    title: string;
    state: string;
    draft: boolean;
    user: {
      login: string;
    };
    head: {
      ref: string;
    };
    base: {
      ref: string;
      repo: {
        full_name: string;
      };
    };
    html_url: string;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    merged_at: string | null;
    merged_by: {
      login: string;
    } | null;
  };
  action: string;
}

interface GitHubCheckRunEvent {
  check_run: {
    id: number;
    workflow_id: number | null;
    name: string | null;
    run_number: number | null;
    event: string | null;
    status: string;
    conclusion: string | null;
    app: {
      slug: string;
    } | null;
    head_branch: string | null;
    head_sha: string | null;
    html_url: string;
    started_at: string | null;
    completed_at: string | null;
    repository: {
      full_name: string;
    };
  };
  action: string;
}

interface GitHubEvent {
  pull_request?: GitHubPullRequestEvent['pull_request'];
  check_run?: GitHubCheckRunEvent['check_run'];
  action?: string;
  repository?: {
    full_name: string;
  };
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly dbService: DatabaseService) {}

  verifySignature(signature: string, body: Record<string, unknown>): void {
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('Webhook secret not configured');
    }

    const hmac = crypto.createHmac('sha256', webhookSecret);
    const expectedSignature = `sha256=${hmac.update(JSON.stringify(body)).digest('hex')}`;

    if (signature !== expectedSignature) {
      throw new Error('Invalid webhook signature');
    }
  }

  processEvent(
    eventType: string,
    deliveryId: string,
    event: GitHubEvent,
  ): void {
    this.logger.log(`Processing event: ${eventType} (${deliveryId})`);

    // Handle PR events
    if (eventType === 'pull_request' && event.pull_request) {
      const pr = event.pull_request;
      const repo = this.getRepoByFullName(pr.base.repo.full_name);
      if (repo) {
        const prDTO: PRDTO = {
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
          merged_by_login: pr.merged_by?.login ?? null,
        };
        this.dbService.upsertPr(prDTO as { repo_id: number } & PRDTO);
      }
    }

    // Handle check_run events
    if (eventType === 'check_run' && event.check_run) {
      const checkRun = event.check_run;
      const repo = this.getRepoByFullName(checkRun.repository.full_name);
      if (repo) {
        const runDTO: RunDTO = {
          github_id: checkRun.id,
          repo_id: repo.id,
          workflow_id: checkRun.workflow_id ?? 0,
          workflow_name: checkRun.name ?? 'Unknown workflow',
          run_number: checkRun.run_number ?? 0,
          event: checkRun.event ?? 'check_run',
          status: checkRun.status,
          conclusion: checkRun.conclusion,
          actor_login: checkRun.app?.slug ?? 'unknown',
          head_branch: checkRun.head_branch ?? '',
          head_sha: checkRun.head_sha ?? '',
          html_url: checkRun.html_url,
          run_started_at: checkRun.started_at ?? new Date().toISOString(),
          updated_at: checkRun.completed_at ?? new Date().toISOString(),
          completed_at: checkRun.completed_at,
        };
        this.dbService.upsertRun(runDTO as { repo_id: number } & RunDTO);
      }
    }

    // Log the event for audit
    this.dbService.insertWebhookEvent({
      github_delivery_id: deliveryId,
      event_type: eventType,
      action: event.action ?? '',
      payload: JSON.stringify(event),
    });
  }

  private getRepoByFullName(fullName: string): { id: number } | null {
    const repo = this.dbService.getRepoByFullName(fullName);
    return repo ?? null;
  }
}
