document.addEventListener('DOMContentLoaded', () => {
  const state = {
    repos: [],
    prs: [],
    runs: [],
    issues: [],
    commits: [],
    summary: null,
    selectedRepoId: '',
    loading: false,
    repoScopeLoading: false,
    filters: {
      search: '',
      visibility: 'all',
      language: 'all',
      ci: 'all',
      prState: 'all',
      prRepoId: '',
      runStatus: 'all',
      runRepoId: '',
    },
  };

  const els = {
    repoSearch: document.getElementById('repoSearch'),
    visibilityFilter: document.getElementById('visibilityFilter'),
    languageFilter: document.getElementById('languageFilter'),
    ciFilter: document.getElementById('ciFilter'),
    refreshBtn: document.getElementById('refreshBtn'),
    reposList: document.getElementById('repos-list'),
    prsList: document.getElementById('prs-list'),
    issuesList: document.getElementById('issues-list'),
    commitsList: document.getElementById('commits-list'),
    failuresList: document.getElementById('failures-list'),
    billingContent: document.getElementById('billing-content'),
    activeRepoCount: document.getElementById('activeRepoCount'),
    allRepoCount: document.getElementById('allRepoCount'),
    privateRepoCount: document.getElementById('privateRepoCount'),
    prsCount: document.getElementById('prs-count'),
    issuesCount: document.getElementById('issues-count'),
    commitsCount: document.getElementById('commits-count'),
    billingPeriod: document.getElementById('billing-period'),
    billingBilled: document.getElementById('billing-billed'),
    billingGross: document.getElementById('billing-gross'),
    billingCovered: document.getElementById('billing-covered'),
    billingMinutes: document.getElementById('billing-minutes'),
    billingStorage: document.getElementById('billing-storage'),
    billingLinux: document.getElementById('billing-linux'),
    billingMacos: document.getElementById('billing-macos'),
    summaryLine: document.getElementById('lastUpdated'),
    summaryStats: document.getElementById('summary-stats'),
    failuresSubtitle: document.getElementById('failures-subtitle'),
    summaryLanguageCount: document.getElementById('summary-language-count'),
    summaryFailureCount: document.getElementById('summary-failure-count'),
    selectedRepoLabel: document.getElementById('selected-repo-label'),
    prStateTabs: document.querySelectorAll('[data-pr-state]'),
    prRepoFilter: document.getElementById('prRepoFilter'),
    runRepoFilter: document.getElementById('runRepoFilter'),
    runStatusFilter: document.getElementById('runStatusFilter'),
    lastUpdated: document.getElementById('lastUpdated'),
  };

  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const relativeFormatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: 'auto',
  });

  function escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function formatDate(value) {
    if (!value) return 'Unknown';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : timeFormatter.format(date);
  }

  function formatRelative(value) {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    const diff = date.getTime() - Date.now();
    const minutes = Math.round(diff / 60000);
    const hours = Math.round(diff / 3600000);
    const days = Math.round(diff / 86400000);
    const absMinutes = Math.abs(minutes);
    const absHours = Math.abs(hours);
    const absDays = Math.abs(days);
    if (absMinutes < 60) return relativeFormatter.format(minutes, 'minute');
    if (absHours < 24) return relativeFormatter.format(hours, 'hour');
    return relativeFormatter.format(days, 'day');
  }

  function repoPrivate(repo) {
    return repo.private === true || repo.private === 1;
  }

  function repoKey(repo) {
    return String(repo.id);
  }

  function runSeverity(run) {
    const conclusion = String(run.conclusion || '').toLowerCase();
    const status = String(run.status || '').toLowerCase();
    if (['failure', 'timed_out', 'cancelled'].includes(conclusion)) return 'failed';
    if (['queued', 'pending', 'requested', 'waiting'].includes(conclusion) || ['queued', 'in_progress', 'requested', 'waiting'].includes(status)) return 'running';
    if (['success', 'completed'].includes(conclusion) || ['completed'].includes(status)) return 'success';
    if (conclusion === 'neutral' || conclusion === 'skipped') return 'neutral';
    return conclusion || status || 'neutral';
  }

  function repoStatus(repo) {
    const repoRuns = state.runs.filter((run) => String(run.repo_id) === String(repo.id));
    const latestRun = repoRuns[0];
    if (!latestRun) return { label: 'Active', className: 'active' };
    const severity = runSeverity(latestRun);
    if (severity === 'failed') return { label: 'Failed', className: 'failed' };
    if (severity === 'running') return { label: 'Running', className: 'running' };
    if (severity === 'success') return { label: 'Active', className: 'active' };
    return { label: severity, className: severity };
  }

  function emptyState(title, subtitle) {
    return `
      <div class="empty-state">
        <div class="empty-state-mark"></div>
        <div class="empty-state-title">${escapeHtml(title)}</div>
        <div class="empty-state-subtitle">${escapeHtml(subtitle)}</div>
      </div>
    `;
  }

  function loadingState(lines = 3) {
    return `
      <div class="loading-state" aria-busy="true" aria-live="polite">
        ${Array.from({ length: lines }, (_, idx) => `<div class="skeleton skeleton-${idx + 1}"></div>`).join('')}
      </div>
    `;
  }

  function selectedRepos() {
    return state.repos.filter((repo) => {
      const search = state.filters.search.trim().toLowerCase();
      const visibility = state.filters.visibility;
      const language = state.filters.language;
      const ci = state.filters.ci;
      const repoRuns = state.runs.filter((run) => String(run.repo_id) === String(repo.id));
      const latestRun = repoRuns[0];
      const ciState = latestRun ? runSeverity(latestRun) : 'unknown';

      if (search) {
        const text = [repo.name, repo.full_name, repo.owner_login, repo.html_url].join(' ').toLowerCase();
        if (!text.includes(search)) return false;
      }
      if (visibility !== 'all' && ((visibility === 'private') !== repoPrivate(repo))) return false;
      if (language !== 'all' && String(repo.language || '').toLowerCase() !== language) return false;
      if (ci !== 'all' && ci !== ciState) return false;
      return true;
    });
  }

  function renderRepoFilters() {
    const prValue = els.prRepoFilter.value;
    const runValue = els.runRepoFilter.value;
    const languageValue = els.languageFilter.value;
    const languages = Array.from(
      new Set(
        state.repos
          .map((repo) => String(repo.language || '').trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
    els.languageFilter.innerHTML = ['<option value="all">All languages</option>']
      .concat(languages.map((language) => `<option value="${escapeHtml(language)}">${escapeHtml(language)}</option>`))
      .join('');
    els.languageFilter.value = languageValue || 'all';
    const options = ['<option value="">All Repositories</option>']
      .concat(state.repos.map((repo) => `<option value="${repoKey(repo)}">${escapeHtml(repo.full_name)}</option>`))
      .join('');
    els.prRepoFilter.innerHTML = options;
    els.runRepoFilter.innerHTML = options;
    els.prRepoFilter.value = prValue;
    els.runRepoFilter.value = runValue;
  }

  function renderRepos() {
    const repos = selectedRepos();
    const summary = state.summary;
    const activeCount = summary?.active_repo_count ?? repos.filter((repo) => repoStatus(repo).className !== 'failed').length;
    const privateCount = summary?.private_repo_count ?? state.repos.filter(repoPrivate).length;
    els.activeRepoCount.textContent = String(activeCount);
    els.allRepoCount.textContent = String(summary?.repo_count ?? state.repos.length);
    els.privateRepoCount.textContent = String(privateCount);

    if (!repos.length) {
      els.reposList.innerHTML = emptyState('No repositories match the current filters', 'Adjust search or filters to show more repositories');
      return;
    }

    if (summary) {
      els.summaryLanguageCount.textContent = `${summary.language_count ?? 0} languages`;
      els.summaryFailureCount.textContent = `${summary.failure_count ?? 0} failures`;
    }

    els.reposList.innerHTML = repos.map((repo) => {
      const status = repoStatus(repo);
      const visibility = repoPrivate(repo) ? 'PRIVATE' : 'PUBLIC';
      const isSelected = state.selectedRepoId === repoKey(repo);
      const latestRun = state.runs.find((run) => String(run.repo_id) === String(repo.id));
      return `
        <button class="repo-row ${isSelected ? 'is-selected' : ''}" data-repo-id="${repoKey(repo)}" type="button" aria-pressed="${isSelected}">
          <span class="repo-status repo-status-${status.className}"></span>
          <span class="repo-main">
            <span class="repo-name">${escapeHtml(repo.name)}</span>
            <span class="repo-fullname">${escapeHtml(repo.full_name)} · ${escapeHtml(repo.owner_login || 'unknown')} · updated ${escapeHtml(formatRelative(repo.updated_at))}</span>
          </span>
          <span class="repo-meta">
            <span class="repo-badge">${visibility}</span>
            <span class="repo-count">${escapeHtml(String((state.prs.filter((pr) => String(pr.repo_id) === String(repo.id))).length))} PRs</span>
            ${latestRun ? `<span class="repo-run">${escapeHtml(formatRelative(latestRun.updated_at))}</span>` : ''}
          </span>
        </button>
      `;
    }).join('');

    if (els.selectedRepoLabel) {
      const selected = state.repos.find((repo) => repoKey(repo) === state.selectedRepoId) || state.repos[0];
      els.selectedRepoLabel.textContent = selected ? selected.full_name : 'No repository selected';
    }
  }

  function currentPrs() {
    return state.prs.filter((pr) => {
      if (state.selectedRepoId && String(pr.repo_id) !== state.selectedRepoId) return false;
      if (state.filters.prState !== 'all' && pr.state !== state.filters.prState) return false;
      if (state.filters.prRepoId && String(pr.repo_id) !== state.filters.prRepoId) return false;
      return true;
    });
  }

  function renderPRs() {
    const prs = currentPrs();
    els.prsCount.textContent = String(prs.length);
    if (!prs.length) {
      els.prsList.innerHTML = state.loading ? loadingState(2) : emptyState('No recent pull requests', 'No pull requests match the current filters');
      return;
    }
    els.prsList.innerHTML = prs.map((pr) => `
      <article class="compact-row">
        <div class="compact-row-main">
          <div class="compact-title">
            <a href="${escapeHtml(pr.html_url)}" target="_blank" rel="noreferrer">#${escapeHtml(String(pr.number))} ${escapeHtml(pr.title)}</a>
          </div>
          <div class="compact-subtitle">
            ${escapeHtml(pr.repo_name || 'Unknown repo')} · ${escapeHtml(pr.author_login || 'unknown')} · ${escapeHtml(pr.head_ref || '')} → ${escapeHtml(pr.base_ref || '')}
          </div>
        </div>
        <div class="compact-row-meta">
          <span class="state-badge state-${escapeHtml((pr.draft ? 'draft' : pr.state || 'unknown').toLowerCase())}">${pr.draft ? 'DRAFT' : escapeHtml(String(pr.state || 'unknown').toUpperCase())}</span>
          <span class="age">${escapeHtml(formatRelative(pr.updated_at))}</span>
        </div>
      </article>
    `).join('');
  }

  function renderIssues() {
    els.issuesCount.textContent = String(state.issues.length);
    if (state.repoScopeLoading) {
      els.issuesList.innerHTML = loadingState(2);
      return;
    }
    if (!state.issues.length) {
      els.issuesList.innerHTML = state.loading ? loadingState(2) : emptyState('No recent issues', 'No issues match the selected repository');
      return;
    }
    els.issuesList.innerHTML = state.issues.map((issue) => `
      <article class="compact-row">
        <div class="compact-row-main">
          <div class="compact-title">
            <a href="${escapeHtml(issue.html_url)}" target="_blank" rel="noreferrer">#${escapeHtml(String(issue.number))} ${escapeHtml(issue.title)}</a>
          </div>
          <div class="compact-subtitle">
            ${escapeHtml(issue.repo_name || 'Unknown repo')} · ${escapeHtml(issue.author_login || 'unknown')}
          </div>
        </div>
        <div class="compact-row-meta">
          <span class="state-badge state-${escapeHtml(String(issue.state || 'unknown').toLowerCase())}">${escapeHtml(String(issue.state || 'unknown').toUpperCase())}</span>
          <span class="age">${escapeHtml(formatRelative(issue.updated_at))}</span>
        </div>
      </article>
    `).join('');
  }

  function renderCommits() {
    els.commitsCount.textContent = String(state.commits.length);
    if (state.repoScopeLoading) {
      els.commitsList.innerHTML = loadingState(2);
      return;
    }
    if (!state.commits.length) {
      els.commitsList.innerHTML = state.loading ? loadingState(2) : emptyState('No recent commits', 'No commits match the selected repository');
      return;
    }
    els.commitsList.innerHTML = state.commits.map((commit) => `
      <article class="compact-row">
        <div class="compact-row-main">
          <div class="compact-title">
            <a href="${escapeHtml(commit.html_url)}" target="_blank" rel="noreferrer">${escapeHtml(commit.message.split('\n')[0])}</a>
          </div>
          <div class="compact-subtitle">
            ${escapeHtml(commit.repo_name || 'Unknown repo')} · ${escapeHtml(commit.author_login || 'unknown')} · ${escapeHtml(commit.sha.slice(0, 7))}
          </div>
        </div>
        <div class="compact-row-meta">
          <span class="state-badge state-neutral">COMMIT</span>
          <span class="age">${escapeHtml(formatRelative(commit.committed_at))}</span>
        </div>
      </article>
    `).join('');
  }

  function currentRuns() {
    return state.runs.filter((run) => {
      if (state.selectedRepoId && String(run.repo_id) !== state.selectedRepoId) return false;
      if (state.filters.runStatus !== 'all') {
        const severity = runSeverity(run);
        if (severity !== state.filters.runStatus) return false;
      }
      if (state.filters.runRepoId && String(run.repo_id) !== state.filters.runRepoId) return false;
      const ci = state.filters.ci;
      if (ci !== 'all' && runSeverity(run) !== ci) return false;
      return true;
    });
  }

  function renderRuns() {
    const runs = currentRuns().filter((run) => runSeverity(run) !== 'success');
    if (state.summary && els.failuresSubtitle) {
      els.failuresSubtitle.textContent = `${state.summary.failure_count ?? 0} recent non-green runs`;
    }
    els.failuresList.innerHTML = runs.length ? runs.map((run) => {
      const severity = runSeverity(run);
      const repo = state.repos.find((item) => String(item.id) === String(run.repo_id));
      return `
        <article class="compact-row compact-row-run">
          <div class="compact-row-main">
            <div class="compact-title">${escapeHtml(run.workflow_name || 'Unknown workflow')}</div>
            <div class="compact-subtitle">
              ${escapeHtml(repo?.name || run.repo_name || 'Unknown repo')} · ${escapeHtml(run.head_branch || 'unknown')} · #${escapeHtml(String(run.run_number || '—'))} · ${escapeHtml(run.display_title || '')}
            </div>
          </div>
          <div class="compact-row-meta">
            <span class="state-badge state-${escapeHtml(severity)}">${escapeHtml(severity.toUpperCase())}</span>
            <span class="age">${escapeHtml(formatRelative(run.updated_at))}</span>
          </div>
        </article>
      `;
    }).join('') : state.loading ? loadingState(3) : emptyState('No non-green runs', 'Workflow failures and other non-green runs will appear here');
  }

  function renderBilling() {
    els.billingPeriod.textContent = 'Billing unavailable';
    els.billingContent.innerHTML = state.loading ? loadingState(4) : `
      <div class="billing-row">
        <span class="billing-label">GitHub Actions Billing</span>
        <span class="billing-value billing-muted">Unavailable from backend</span>
      </div>
      <div class="billing-divider"></div>
      <div class="billing-row">
        <span class="billing-label">Runner minutes</span>
        <span class="billing-value billing-muted">—</span>
      </div>
      <div class="billing-row">
        <span class="billing-label">Storage GB-hours</span>
        <span class="billing-value billing-muted">—</span>
      </div>
    `;
  }

  function renderAll() {
    renderRepoFilters();
    renderRepos();
    renderPRs();
    renderIssues();
    renderCommits();
    renderRuns();
    renderBilling();
    const lastSyncedAt = state.summary?.last_synced_at;
    els.summaryLine.textContent = lastSyncedAt
      ? `Last synced ${formatDate(lastSyncedAt)}`
      : `Last updated ${new Date().toLocaleTimeString()}`;
    const summary = state.summary;
    if (summary && els.summaryStats) {
      els.summaryStats.textContent = `${summary.repo_count ?? 0} repos · ${summary.pr_count ?? 0} PRs · ${summary.run_count ?? 0} runs`;
    }
  }

  async function loadRepoScopedData(repoId) {
    if (!repoId) {
      state.issues = [];
      state.commits = [];
      state.repoScopeLoading = false;
      renderIssues();
      renderCommits();
      return;
    }
    state.repoScopeLoading = true;
    renderIssues();
    renderCommits();
    const [issuesRes, commitsRes] = await Promise.all([
      fetch(`/issues?repoId=${encodeURIComponent(repoId)}`),
      fetch(`/commits?repoId=${encodeURIComponent(repoId)}`),
    ]);
    state.issues = (await issuesRes.json()).slice().sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    state.commits = (await commitsRes.json()).slice().sort((a, b) => new Date(b.committed_at).getTime() - new Date(a.committed_at).getTime());
    state.repoScopeLoading = false;
    renderIssues();
    renderCommits();
  }

  async function loadData() {
    state.loading = true;
    renderAll();
    const [summaryRes, reposRes, prsRes, runsRes] = await Promise.all([
      fetch('/dashboard/summary'),
      fetch('/repos'),
      fetch(`/prs?state=${encodeURIComponent(state.filters.prState)}${state.filters.prRepoId ? `&repoId=${encodeURIComponent(state.filters.prRepoId)}` : ''}`),
      fetch(`/runs?status=${encodeURIComponent(state.filters.runStatus)}${state.filters.runRepoId ? `&repoId=${encodeURIComponent(state.filters.runRepoId)}` : ''}&limit=100`),
    ]);

    state.summary = await summaryRes.json();
    state.repos = (await reposRes.json()).slice().sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
    state.prs = (await prsRes.json()).slice().sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    state.runs = (await runsRes.json()).slice().sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    if (!state.selectedRepoId && state.repos[0]) {
      state.selectedRepoId = repoKey(state.repos[0]);
    }
    state.loading = false;

    renderAll();
    await loadRepoScopedData(state.selectedRepoId || repoKey(state.repos[0]));
  }

  function updateFilters(next) {
    Object.assign(state.filters, next);
    loadData().catch((err) => console.error(err));
  }

  els.repoSearch.addEventListener('input', (event) => {
    state.filters.search = event.target.value;
    renderRepos();
  });
  els.visibilityFilter.addEventListener('change', (event) => updateFilters({ visibility: event.target.value }));
  els.languageFilter.addEventListener('change', (event) => updateFilters({ language: event.target.value }));
  els.ciFilter.addEventListener('change', (event) => updateFilters({ ci: event.target.value }));
  els.refreshBtn.addEventListener('click', () => loadData().catch((err) => console.error(err)));
  els.prStateTabs.forEach((tab) => tab.addEventListener('click', () => {
    els.prStateTabs.forEach((item) => item.classList.toggle('is-active', item === tab));
    updateFilters({ prState: tab.dataset.prState });
  }));
  els.prRepoFilter.addEventListener('change', (event) => updateFilters({ prRepoId: event.target.value }));
  els.runRepoFilter.addEventListener('change', (event) => updateFilters({ runRepoId: event.target.value }));
  els.runStatusFilter.addEventListener('change', (event) => updateFilters({ runStatus: event.target.value }));

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-repo-id]');
    if (!button) return;
    const repoId = button.dataset.repoId;
    state.selectedRepoId = repoId;
    state.filters.prRepoId = repoId;
    state.filters.runRepoId = repoId;
    els.prRepoFilter.value = repoId;
    els.runRepoFilter.value = repoId;
    renderAll();
    loadRepoScopedData(repoId).catch((err) => {
      state.repoScopeLoading = false;
      console.error(err);
      renderIssues();
      renderCommits();
    });
  });

  loadData().catch((err) => {
    console.error('Failed to load dashboard data', err);
    els.reposList.innerHTML = emptyState('Unable to load dashboard', 'Check the API connection and reload the page');
  });
});
