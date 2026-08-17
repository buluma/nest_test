import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { RepoRow, PRRow, RunRow } from '../types/github';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private db: Database.Database | null = null;
  private readonly dbPath: string;

  constructor() {
    // Use DATABASE_PATH env var or default to ./data/github-dashboard.sqlite
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath =
      process.env.DATABASE_PATH ||
      path.join(dataDir, 'github-dashboard.sqlite');
  }

  onModuleInit() {
    this.initialize();
  }

  onModuleDestroy() {
    this.close();
  }

  private initialize(): void {
    this.logger.log(`Initializing database at ${this.dbPath}`);
    this.db = new Database(this.dbPath);

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.runMigrations();
    this.logger.log('Database initialized successfully');
  }

  private runMigrations(): void {
    if (!this.db) return;

    const migrations = [
      // Migration 1: Initial schema
      `
      CREATE TABLE IF NOT EXISTS repos (
        id INTEGER PRIMARY KEY,
        github_id INTEGER UNIQUE NOT NULL,
        name TEXT NOT NULL,
        full_name TEXT UNIQUE NOT NULL,
        owner_login TEXT NOT NULL,
        private INTEGER NOT NULL DEFAULT 0,
        html_url TEXT NOT NULL,
        language TEXT,
        updated_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        synced_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS pull_requests (
        id INTEGER PRIMARY KEY,
        github_id INTEGER UNIQUE NOT NULL,
        repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
        number INTEGER NOT NULL,
        title TEXT NOT NULL,
        state TEXT NOT NULL,
        draft INTEGER NOT NULL DEFAULT 0,
        author_login TEXT NOT NULL,
        head_ref TEXT NOT NULL,
        base_ref TEXT NOT NULL,
        html_url TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        closed_at TEXT,
        merged_at TEXT,
        merged_by_login TEXT,
        synced_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(repo_id, number)
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS action_runs (
        id INTEGER PRIMARY KEY,
        github_id INTEGER UNIQUE NOT NULL,
        repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
        workflow_id INTEGER NOT NULL,
        workflow_name TEXT NOT NULL,
        run_number INTEGER NOT NULL,
        event TEXT NOT NULL,
        status TEXT NOT NULL,
        conclusion TEXT,
        actor_login TEXT NOT NULL,
        head_branch TEXT NOT NULL,
        head_sha TEXT NOT NULL,
        html_url TEXT NOT NULL,
        run_started_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        synced_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS webhook_events (
        id INTEGER PRIMARY KEY,
        github_delivery_id TEXT UNIQUE NOT NULL,
        event_type TEXT NOT NULL,
        action TEXT NOT NULL,
        payload TEXT NOT NULL,
        processed_at TEXT NOT NULL DEFAULT (datetime('now')),
        processing_error TEXT
      );
      `,
      // Indexes
      `CREATE INDEX IF NOT EXISTS idx_prs_repo_state ON pull_requests(repo_id, state);`,
      `CREATE INDEX IF NOT EXISTS idx_prs_updated ON pull_requests(updated_at);`,
      `CREATE INDEX IF NOT EXISTS idx_runs_repo_status ON action_runs(repo_id, status);`,
      `CREATE INDEX IF NOT EXISTS idx_runs_started ON action_runs(run_started_at);`,
      `CREATE INDEX IF NOT EXISTS idx_webhooks_delivery ON webhook_events(github_delivery_id);`,
    ];

    for (const migration of migrations) {
      this.db.exec(migration);
    }

    const repoColumns = this.db.prepare(`PRAGMA table_info(repos)`).all() as Array<{ name: string }>;
    if (!repoColumns.some((column) => column.name === 'language')) {
      this.db.exec(`ALTER TABLE repos ADD COLUMN language TEXT;`);
    }
  }

  getDb(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.logger.log('Database connection closed');
    }
  }

  // Transaction helper
  transaction<T>(fn: (db: Database.Database) => T): T {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    const transaction = this.db.transaction(fn);
    return transaction(this.db);
  }

  // Repo operations
  upsertRepo(repo: {
    github_id: number;
    name: string;
    full_name: string;
    owner_login: string;
    private: boolean;
    html_url: string;
    language?: string | null;
    updated_at: string;
  }): Database.RunResult {
    if (!this.db) throw new Error('Database not initialized');
    return this.db
      .prepare(
        `
      INSERT INTO repos (github_id, name, full_name, owner_login, private, html_url, language, updated_at, synced_at)
      VALUES (@github_id, @name, @full_name, @owner_login, @private, @html_url, @language, @updated_at, datetime('now'))
      ON CONFLICT(github_id) DO UPDATE SET
        name = @name,
        full_name = @full_name,
        owner_login = @owner_login,
        private = @private,
        html_url = @html_url,
        language = @language,
        updated_at = @updated_at,
        synced_at = datetime('now')
    `,
      )
      .run({
        ...repo,
        private: repo.private ? 1 : 0,
      });
  }

  getAllRepos(): RepoRow[] {
    if (!this.db) throw new Error('Database not initialized');
    return this.db
      .prepare(
        'SELECT id, github_id, name, full_name, owner_login, private, html_url, language, updated_at FROM repos ORDER BY full_name',
      )
      .all() as RepoRow[];
  }

  getLastSyncedAt(): string | null {
    if (!this.db) throw new Error('Database not initialized');
    const row = this.db
      .prepare(
        `
        SELECT MAX(synced_at) as last_synced_at
        FROM (
          SELECT synced_at FROM repos
          UNION ALL
          SELECT synced_at FROM pull_requests
          UNION ALL
          SELECT synced_at FROM action_runs
        )
      `,
      )
      .get() as { last_synced_at: string | null } | undefined;
    return row?.last_synced_at ?? null;
  }

  getDashboardSummary(): {
    repo_count: number;
    private_repo_count: number;
    public_repo_count: number;
    active_repo_count: number;
    pr_count: number;
    issue_count: number;
    commit_count: number;
    run_count: number;
    failure_count: number;
    language_count: number;
    last_synced_at: string | null;
  } {
    if (!this.db) throw new Error('Database not initialized');
    const repoCount = this.db.prepare('SELECT COUNT(*) as count FROM repos').get() as { count: number };
    const privateRepoCount = this.db.prepare('SELECT COUNT(*) as count FROM repos WHERE private = 1').get() as { count: number };
    const activeRepoCount = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM repos r
      WHERE EXISTS (
        SELECT 1
        FROM action_runs ar
        WHERE ar.repo_id = r.id AND (
          COALESCE(ar.conclusion, '') NOT IN ('failure', 'timed_out', 'cancelled')
        )
      )
    `).get() as { count: number };
    const prCount = this.db.prepare('SELECT COUNT(*) as count FROM pull_requests').get() as { count: number };
    const runCount = this.db.prepare('SELECT COUNT(*) as count FROM action_runs').get() as { count: number };
    const failureCount = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM action_runs
      WHERE LOWER(COALESCE(conclusion, '')) IN ('failure', 'timed_out', 'cancelled')
    `).get() as { count: number };
    const languageCount = this.db.prepare(`
      SELECT COUNT(DISTINCT language) as count
      FROM repos
      WHERE language IS NOT NULL AND TRIM(language) != ''
    `).get() as { count: number };
    const lastSyncedAt = this.getLastSyncedAt();
    return {
      repo_count: repoCount.count,
      private_repo_count: privateRepoCount.count,
      public_repo_count: repoCount.count - privateRepoCount.count,
      active_repo_count: activeRepoCount.count,
      pr_count: prCount.count,
      issue_count: 0,
      commit_count: 0,
      run_count: runCount.count,
      failure_count: failureCount.count,
      language_count: languageCount.count,
      last_synced_at: lastSyncedAt,
    };
  }

  getRepoByGithubId(github_id: number): { id: number } | undefined {
    if (!this.db) throw new Error('Database not initialized');
    return this.db
      .prepare('SELECT id FROM repos WHERE github_id = ?')
      .get(github_id) as { id: number } | undefined;
  }

  getRepoByFullName(full_name: string): { id: number } | undefined {
    if (!this.db) throw new Error('Database not initialized');
    return this.db
      .prepare('SELECT id FROM repos WHERE full_name = ?')
      .get(full_name) as { id: number } | undefined;
  }

  getPrById(id: number): PRRow | undefined {
    if (!this.db) throw new Error('Database not initialized');
    return this.db
      .prepare(
        `
      SELECT pr.*, r.full_name as repo_name, r.html_url as repo_url
      FROM pull_requests pr
      JOIN repos r ON pr.repo_id = r.id
      WHERE pr.id = ?
    `,
      )
      .get(id) as PRRow | undefined;
  }

  getRunById(id: number): RunRow | undefined {
    if (!this.db) throw new Error('Database not initialized');
    return this.db
      .prepare(
        `
      SELECT ar.*, r.full_name as repo_name
      FROM action_runs ar
      JOIN repos r ON ar.repo_id = r.id
      WHERE ar.id = ?
    `,
      )
      .get(id) as RunRow | undefined;
  }

  // PR operations
  upsertPr(pr: {
    github_id: number;
    repo_id: number;
    number: number;
    title: string;
    state: string;
    draft: boolean;
    author_login: string;
    head_ref: string;
    base_ref: string;
    html_url: string;
    created_at: string;
    updated_at: string;
    closed_at?: string | null;
    merged_at?: string | null;
    merged_by_login?: string | null;
  }): Database.RunResult {
    if (!this.db) throw new Error('Database not initialized');
    return this.db
      .prepare(
        `
      INSERT INTO pull_requests (github_id, repo_id, number, title, state, draft, author_login, head_ref, base_ref, html_url, created_at, updated_at, closed_at, merged_at, merged_by_login, synced_at)
      VALUES (@github_id, @repo_id, @number, @title, @state, @draft, @author_login, @head_ref, @base_ref, @html_url, @created_at, @updated_at, @closed_at, @merged_at, @merged_by_login, datetime('now'))
      ON CONFLICT(github_id) DO UPDATE SET
        repo_id = @repo_id,
        number = @number,
        title = @title,
        state = @state,
        draft = @draft,
        author_login = @author_login,
        head_ref = @head_ref,
        base_ref = @base_ref,
        html_url = @html_url,
        created_at = @created_at,
        updated_at = @updated_at,
        closed_at = @closed_at,
        merged_at = @merged_at,
        merged_by_login = @merged_by_login,
        synced_at = datetime('now')
    `,
      )
      .run({
        ...pr,
        draft: pr.draft ? 1 : 0,
      });
  }

  getPrs(
    filters: {
      repo_id?: number;
      state?: string;
      since?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): PRRow[] {
    if (!this.db) throw new Error('Database not initialized');
    let query = `
      SELECT pr.*, r.full_name as repo_name, r.html_url as repo_url
      FROM pull_requests pr
      JOIN repos r ON pr.repo_id = r.id
      WHERE 1=1
    `;
    const params: Record<string, unknown> = {};

    if (filters.repo_id) {
      query += ' AND pr.repo_id = @repo_id';
      params.repo_id = filters.repo_id;
    }
    if (filters.state) {
      query += ' AND pr.state = @state';
      params.state = filters.state;
    }
    if (filters.since) {
      query += ' AND pr.updated_at >= @since';
      params.since = filters.since;
    }

    query += ' ORDER BY pr.updated_at DESC';

    if (filters.limit) {
      query += ' LIMIT @limit';
      params.limit = filters.limit;
    }
    if (filters.offset) {
      query += ' OFFSET @offset';
      params.offset = filters.offset;
    }

    return this.db.prepare(query).all(params) as PRRow[];
  }

  // Action runs operations
  upsertRun(run: {
    github_id: number;
    repo_id: number;
    workflow_id: number;
    workflow_name: string;
    run_number: number;
    event: string;
    status: string;
    conclusion?: string | null;
    actor_login: string;
    head_branch: string;
    head_sha: string;
    html_url: string;
    run_started_at: string;
    updated_at: string;
    completed_at?: string | null;
  }): Database.RunResult {
    if (!this.db) throw new Error('Database not initialized');
    return this.db
      .prepare(
        `
      INSERT INTO action_runs (github_id, repo_id, workflow_id, workflow_name, run_number, event, status, conclusion, actor_login, head_branch, head_sha, html_url, run_started_at, updated_at, completed_at, synced_at)
      VALUES (@github_id, @repo_id, @workflow_id, @workflow_name, @run_number, @event, @status, @conclusion, @actor_login, @head_branch, @head_sha, @html_url, @run_started_at, @updated_at, @completed_at, datetime('now'))
      ON CONFLICT(github_id) DO UPDATE SET
        repo_id = @repo_id,
        workflow_id = @workflow_id,
        workflow_name = @workflow_name,
        run_number = @run_number,
        event = @event,
        status = @status,
        conclusion = @conclusion,
        actor_login = @actor_login,
        head_branch = @head_branch,
        head_sha = @head_sha,
        html_url = @html_url,
        run_started_at = @run_started_at,
        updated_at = @updated_at,
        completed_at = @completed_at,
        synced_at = datetime('now')
    `,
      )
      .run(run);
  }

  getRuns(
    filters: {
      repo_id?: number;
      status?: string;
      conclusion?: string;
      since?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): RunRow[] {
    if (!this.db) throw new Error('Database not initialized');
    let query = `
      SELECT ar.*, r.full_name as repo_name
      FROM action_runs ar
      JOIN repos r ON ar.repo_id = r.id
      WHERE 1=1
    `;
    const params: Record<string, unknown> = {};

    if (filters.repo_id) {
      query += ' AND ar.repo_id = @repo_id';
      params.repo_id = filters.repo_id;
    }
    if (filters.status) {
      query += ' AND ar.status = @status';
      params.status = filters.status;
    }
    if (filters.conclusion) {
      query += ' AND ar.conclusion = @conclusion';
      params.conclusion = filters.conclusion;
    }
    if (filters.since) {
      query += ' AND ar.run_started_at >= @since';
      params.since = filters.since;
    }

    query += ' ORDER BY ar.run_started_at DESC';

    if (filters.limit) {
      query += ' LIMIT @limit';
      params.limit = filters.limit;
    }
    if (filters.offset) {
      query += ' OFFSET @offset';
      params.offset = filters.offset;
    }

    return this.db.prepare(query).all(params) as RunRow[];
  }

  // Webhook events (audit)
  insertWebhookEvent(event: {
    github_delivery_id: string;
    event_type: string;
    action: string;
    payload: string;
    processing_error?: string | null;
  }): Database.RunResult {
    if (!this.db) throw new Error('Database not initialized');
    return this.db
      .prepare(
        `
      INSERT OR IGNORE INTO webhook_events (github_delivery_id, event_type, action, payload, processing_error)
      VALUES (@github_delivery_id, @event_type, @action, @payload, @processing_error)
    `,
      )
      .run(event);
  }
}
