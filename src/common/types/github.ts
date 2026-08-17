/**
 * Type definitions for GitHub API responses and internal data models.
 * Replaces unsafe `any` types throughout the codebase.
 */

// GitHub Repository from /installation/repositories
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  private: boolean;
  html_url: string;
  language?: string | null;
  updated_at: string;
}

// GitHub Pull Request from /repos/{owner}/{repo}/pulls
export interface GitHubPullRequest {
  number: number;
  title: string;
  state: string;
  draft: boolean;
  user: {
    login: string;
  } | null;
  head: {
    ref: string;
  };
  base: {
    ref: string;
  };
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merged_by: {
    login: string;
  } | null;
}

// GitHub Workflow Run from /repos/{owner}/{repo}/actions/runs
export interface GitHubWorkflowRun {
  id: number;
  workflow_id: number;
  name: string | null;
  display_title: string | null;
  run_number: number;
  event: string;
  status: string;
  conclusion: string | null;
  actor: {
    login: string;
  } | null;
  head_branch: string | null;
  head_sha: string | null;
  html_url: string;
  run_started_at: string;
  updated_at: string;
  completed_at: string | null;
}

// Internal data transfer objects (matching database schema)
// These are used for syncing FROM GitHub TO database
export interface RepoDTO {
  github_id: number;
  name: string;
  full_name: string;
  owner_login: string;
  private: boolean;
  html_url: string;
  language?: string | null;
  updated_at: string;
}

// PRDTO - used for GitHub API responses (without repo_id initially)
export interface PRDTO {
  github_id: number;
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
  closed_at: string | null;
  merged_at: string | null;
  merged_by_login: string | null;
  repo_id?: number; // Added during sync
}

// RunDTO - used for GitHub API responses (without repo_id initially)
export interface RunDTO {
  github_id: number;
  workflow_id: number;
  workflow_name: string;
  run_number: number;
  event: string;
  status: string;
  conclusion: string | null;
  actor_login: string;
  head_branch: string;
  head_sha: string;
  html_url: string;
  run_started_at: string;
  updated_at: string;
  completed_at: string | null;
  repo_id?: number; // Added during sync
}

// Database row types (with internal IDs)
export interface RepoRow {
  id: number;
  github_id: number;
  name: string;
  full_name: string;
  owner_login: string;
  private: number;
  html_url: string;
  language?: string | null;
  updated_at: string;
}

export interface DashboardSummary {
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
}

export interface IssueRow {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  author_login: string;
  repo_name?: string;
  updated_at: string;
}

export interface CommitRow {
  sha: string;
  message: string;
  html_url: string;
  author_login: string;
  repo_name?: string;
  committed_at: string;
}

export interface PRRow {
  id: number;
  github_id: number;
  repo_id: number;
  number: number;
  title: string;
  state: string;
  draft: number;
  author_login: string;
  head_ref: string;
  base_ref: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merged_by_login: string | null;
  repo_name?: string;
  repo_url?: string;
}

export interface RunRow {
  id: number;
  github_id: number;
  repo_id: number;
  workflow_id: number;
  workflow_name: string;
  run_number: number;
  event: string;
  status: string;
  conclusion: string | null;
  actor_login: string;
  head_branch: string;
  head_sha: string;
  html_url: string;
  run_started_at: string;
  updated_at: string;
  completed_at: string | null;
  repo_name?: string;
}
