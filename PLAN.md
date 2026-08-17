# GitHub Dashboard — Implementation Plan

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        NestJS App (Port 3000)                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   REST API  │  │  Webhooks   │  │  Static UI  │              │
│  │  /repos     │  │  /webhooks  │  │  /dashboard │              │
│  │  /prs       │  │  (PR,       │  │  (vanilla   │              │
│  │  /runs      │  │   check_run)│  │   JS/HTML)  │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          ▼                                       │
│              ┌───────────────────────┐                           │
│              │   Shared Services     │                           │
│              │  - GitHubAppService   │                           │
│              │  - PollerService      │                           │
│              │  - WebhookService     │                           │
│              │  - DatabaseService    │                           │
│              └───────────┬───────────┘                           │
│                          ▼                                       │
│              ┌───────────────────────┐                           │
│              │      SQLite DB        │                           │
│              │  (repos, prs, runs,   │                           │
│              │   webhook_events)     │                           │
│              └───────────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

## Module Structure (NestJS CLI generated)

```
src/
├── main.ts                          # Bootstrap, static assets, global prefix
├── app.module.ts                    # Root module
├── common/                          # Shared utilities
│   ├── config/
│   │   ├── config.module.ts
│   │   └── github.config.ts         # GitHub App config validation
│   ├── database/
│   │   ├── database.module.ts
│   │   ├── database.service.ts      # Better-sqlite3 wrapper
│   │   ├── schema.sql               # DDL
│   │   └── migrations/              # Future-proofing
│   ├── github/
│   │   ├── github.module.ts
│   │   ├── github-app.service.ts    # Installation token, Octokit client
│   │   ├── github-client.service.ts # Typed API wrappers (PRs, runs, repos)
│   │   └── interfaces.ts            # Type-safe GitHub API responses
│   └── utils/
│       ├── time-windows.ts          # Preset parsing (1h, 24h, 7d, 30d)
│       └── pagination.ts            # GitHub pagination helpers
├── modules/
│   ├── poller/
│   │   ├── poller.module.ts
│   │   ├── poller.service.ts        # Cron job (5 min), orchestrates fetch
│   │   ├── poller.controller.ts     # Manual trigger endpoint
│   │   └── dto/
│   ├── webhooks/
│   │   ├── webhooks.module.ts
│   │   ├── webhooks.controller.ts   # POST /webhooks (signature verify)
│   │   ├── webhooks.service.ts      # Event processing, upserts
│   │   ├── guards/
│   │   │   └── github-signature.guard.ts
│   │   └── dto/
│   ├── api/
│   │   ├── api.module.ts
│   │   ├── repos/
│   │   │   ├── repos.controller.ts  # GET /repos
│   │   │   ├── repos.service.ts
│   │   │   └── dto/
│   │   ├── prs/
│   │   │   ├── prs.controller.ts    # GET /prs?repo=&state=&since=
│   │   │   ├── prs.service.ts
│   │   │   └── dto/
│   │   └── runs/
│   │       ├── runs.controller.ts   # GET /runs?repo=&status=&since=
│   │       ├── runs.service.ts
│   │       └── dto/
│   └── dashboard/
│       ├── dashboard.module.ts
│       ├── dashboard.controller.ts  # GET /dashboard (serves index.html)
│       └── assets/                  # Static files (copied to dist)
│           ├── index.html
│           ├── app.js
│           ├── styles.css
│           └── favicon.ico
└── test/                            # E2E tests
    ├── api.e2e-spec.ts
    ├── webhooks.e2e-spec.ts
    └── poller.e2e-spec.ts
```

## Database Schema (SQLite)

```sql
-- repos table
CREATE TABLE repos (
  id INTEGER PRIMARY KEY,
  github_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT UNIQUE NOT NULL,
  owner_login TEXT NOT NULL,
  private INTEGER NOT NULL DEFAULT 0,
  html_url TEXT NOT NULL,
  updated_at TEXT NOT NULL,          -- ISO8601
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- pull_requests table
CREATE TABLE pull_requests (
  id INTEGER PRIMARY KEY,
  github_id INTEGER UNIQUE NOT NULL,
  repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  state TEXT NOT NULL,               -- open, closed, merged
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

-- action_runs table
CREATE TABLE action_runs (
  id INTEGER PRIMARY KEY,
  github_id INTEGER UNIQUE NOT NULL,
  repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  workflow_id INTEGER NOT NULL,
  workflow_name TEXT NOT NULL,
  run_number INTEGER NOT NULL,
  event TEXT NOT NULL,               -- push, pull_request, workflow_dispatch, etc.
  status TEXT NOT NULL,              -- queued, in_progress, completed
  conclusion TEXT,                   -- success, failure, cancelled, skipped, timed_out
  actor_login TEXT NOT NULL,
  head_branch TEXT NOT NULL,
  head_sha TEXT NOT NULL,
  html_url TEXT NOT NULL,
  run_started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- webhook_events table (audit/debug)
CREATE TABLE webhook_events (
  id INTEGER PRIMARY KEY,
  github_delivery_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,          -- pull_request, check_run, etc.
  action TEXT NOT NULL,              -- opened, closed, completed, etc.
  payload TEXT NOT NULL,             -- JSON
  processed_at TEXT NOT NULL DEFAULT (datetime('now')),
  processing_error TEXT
);

-- Indexes
CREATE INDEX idx_prs_repo_state ON pull_requests(repo_id, state);
CREATE INDEX idx_prs_updated ON pull_requests(updated_at);
CREATE INDEX idx_runs_repo_status ON action_runs(repo_id, status);
CREATE INDEX idx_runs_started ON action_runs(run_started_at);
CREATE INDEX idx_webhooks_delivery ON webhook_events(github_delivery_id);
```

## Implementation Sequence (TDD per module)

### Phase 1: Foundation (Day 1)
| Step | Task | Verify |
|------|------|--------|
| 1.1 | Add dependencies: `better-sqlite3`, `@octokit/rest`, `octokit`, `node-cron`, `class-validator`, `class-transformer` | `npm install` succeeds |
| 1.2 | Generate `ConfigModule` + `GithubConfig` (validate App ID, private key path) | Unit test: config loads/validates |
| 1.3 | Generate `DatabaseModule` + `DatabaseService` (better-sqlite3 wrapper, migrations runner) | Unit test: CRUD works, schema applied |
| 1.4 | Generate `GithubModule` + `GithubAppService` (JWT → installation token → Octokit) | Unit test: token refresh works, mocked |
| 1.5 | Generate `GithubClientService` (typed wrappers: listRepos, listPRs, listRuns) | Unit test: pagination, error handling |

### Phase 2: Poller (Day 1-2)
| Step | Task | Verify |
|------|------|--------|
| 2.1 | Generate `PollerModule` + `PollerService` (cron 5min, calls GithubClientService) | Unit test: cron triggers, rate limit respected |
| 2.2 | Implement full sync: repos → PRs → runs per repo | E2E test: poller populates DB from mock GitHub |
| 2.3 | Add `PollerController` POST /poller/trigger (manual refresh) | E2E: trigger returns 202, data refreshed |
| 2.4 | Add rate-limit awareness (read headers, backoff) | Unit test: 403 handling, retry-after respected |

### Phase 3: Webhooks (Day 2)
| Step | Task | Verify |
|------|------|--------|
| 3.1 | Generate `WebhooksModule` + controller (POST /webhooks) | Unit test: signature verification rejects invalid |
| 3.2 | Implement `WebhooksService` (PR events, check_run events → upserts) | Unit test: each event type updates DB correctly |
| 3.3 | Handle idempotency (github-delivery-id unique constraint) | Unit test: duplicate delivery ignored |
| 3.4 | Register webhook URL in GitHub App settings (doc only) | Manual verify: ngrok + GitHub delivers test payload |

### Phase 4: REST API (Day 2-3)
| Step | Task | Verify |
|------|------|--------|
| 4.1 | Generate `ApiModule` + `ReposController` (GET /repos) | E2E: returns paginated repo list from DB |
| 4.2 | Generate `PrsController` (GET /prs?repo=&state=&since=) | E2E: filters work, time-window presets parse |
| 4.3 | Generate `RunsController` (GET /runs?repo=&status=&since=) | E2E: filters work, conclusions mapped |
| 4.4 | Add global validation pipe, error filter, Swagger (optional) | E2E: 400 on bad query, 500 structured |

### Phase 5: Dashboard UI (Day 3)
| Step | Task | Verify |
|------|------|--------|
| 5.1 | Generate `DashboardModule` + controller (serves index.html + static) | Manual: `curl /dashboard` returns HTML |
| 5.2 | Build `index.html` (semantic HTML, no framework) | Manual: loads in browser |
| 5.3 | Build `app.js` (fetch /repos, /prs, /runs; render tables; filters; refresh button) | Manual: dashboard shows data, filters work, refresh updates |
| 5.4 | Build `styles.css` (clean, responsive, dark mode via prefers-color-scheme) | Manual: looks good on mobile/desktop |

### Phase 6: Polish & Tests (Day 3-4)
| Step | Task | Verify |
|------|------|--------|
| 6.1 | E2E test suite: full flow (poller → DB → API → UI) | `npm run test:e2e` passes |
| 6.2 | Unit test coverage ≥80% on services | `npm run test:cov` |
| 6.3 | TypeScript strict compiles, ESLint clean | `npm run build && npm run lint` |
| 6.4 | README: setup, .env example, webhook registration steps | Manual verify |

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| `better-sqlite3` over Prisma/TypeORM | Zero-config, synchronous, fast, tiny bundle |
| Octokit REST (not GraphQL) | Simpler for list endpoints, pagination built-in |
| `node-cron` for poller | Lightweight, standard cron syntax, no worker threads needed |
| Vanilla JS frontend | No build step, served as static files, easy to hack on |
| Installation token per request (cached 55min) | GitHub App best practice; auto-refresh before expiry |
| Webhook signature verification | Required by GitHub; prevents spoofing |
| Time-window parsing in shared util | Single source of truth for API + UI |

## Environment Variables

```bash
# Required
GITHUB_APP_ID=4605503
GITHUB_APP_PRIVATE_KEY_PATH=/absolute/path/to/private-key.pem
WEBHOOK_SECRET=<generate: openssl rand -hex 32>  # For signature verification

# Optional
PORT=3000
POLL_INTERVAL_MS=300000        # 5 min default
DATABASE_PATH=./data/github-dashboard.sqlite
LOG_LEVEL=info
```

## GitHub App Configuration (Manual Steps)

1. **Webhook URL**: `https://your-domain/webhooks` (or ngrok for dev)
2. **Webhook Secret**: Value from `WEBHOOK_SECRET` env
3. **Events to subscribe**:
   - Pull requests (all actions)
   - Check runs (all actions)
   - Repositories (added/removed - optional, for auto-discovery)
4. **Permissions**:
   - Repository metadata: Read
   - Pull requests: Read
   - Checks: Read
   - Actions: Read (for workflow runs)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Rate limit exceeded | Conservative 5min poll; read `x-ratelimit-remaining`; exponential backoff |
| Webhook delivery fails | GitHub retries (3x); idempotency key (delivery-id) prevents duplicates |
| Private key exposure | Stored outside repo (already); .gitignore covers `.pem` files |
| Schema migrations | Simple `migrations/` folder with numbered SQL files; run on startup |
| Timezone issues | All timestamps stored as UTC ISO8601; UI renders in local time |

## Start Commands

```bash
# Development
npm run start:dev        # Watch mode, http://localhost:3000/dashboard

# Production build
npm run build
node dist/main.js        # Serves API + dashboard on PORT
```

---

**Next Action**: Start with Phase 1.1 — install dependencies and generate ConfigModule.
Want me to begin?