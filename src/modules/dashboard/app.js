// Dashboard JavaScript - fetches data from API and renders UI
document.addEventListener('DOMContentLoaded', () => {
    const timeWindowSelect = document.getElementById('timeWindow');
    const refreshBtn = document.getElementById('refreshBtn');
    const lastUpdatedSpan = document.getElementById('lastUpdated');
    const reposList = document.getElementById('repos-list');
    const prsList = document.getElementById('prs-list');
    const runsList = document.getElementById('runs-list');
    const reposCount = document.getElementById('repos-count');
    const prsCount = document.getElementById('prs-count');
    const runsCount = document.getElementById('runs-count');
    const prStateFilter = document.getElementById('prStateFilter');
    const prRepoFilter = document.getElementById('prRepoFilter');
    const runStatusFilter = document.getElementById('runStatusFilter');
    const runRepoFilter = document.getElementById('runRepoFilter');

    // Time window presets -> milliseconds
    const WINDOWS = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
    };

    // Compute the `since` ISO timestamp for the selected window
    function getSince() {
        const ms = WINDOWS[timeWindowSelect.value];
        if (!ms) return undefined;
        return new Date(Date.now() - ms).toISOString();
    }

    // Safe date formatting
    function formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        try {
            const dateObj = new Date(dateStr);
            if (!isNaN(dateObj.getTime())) {
                return dateObj.toLocaleString();
            }
        } catch (e) {}
        return dateStr;
    }

    function formatRelativeTime(dateStr) {
        if (!dateStr) return 'Unknown';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            return date.toLocaleDateString();
        } catch (e) {
            return dateStr;
        }
    }

    function createEmptyState(icon, text, subtext) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">${icon}</div>
                <div class="empty-state-text">${text}</div>
                <div class="empty-state-subtext">${subtext}</div>
            </div>
        `;
    }

    // Load repos and populate repo filter dropdowns
    async function loadRepos() {
        try {
            const response = await fetch('/repos');
            const repos = await response.json();

            reposCount.textContent = repos.length;

            // Render repo cards
            if (repos.length === 0) {
                reposList.innerHTML = createEmptyState('📦', 'No repositories', 'No GitHub repositories found');
                return;
            }

            reposList.innerHTML = '';
            repos.forEach(repo => {
                const repoEl = document.createElement('div');
                repoEl.className = 'repo-card';
                const isPrivate = repo.private === 1 || repo.private === true;
                const visibilityClass = isPrivate ? 'private' : 'public';
                const visibilityText = isPrivate ? 'Private' : 'Public';

                // Validate date parsing
                let dateStr = 'Unknown';
                try {
                    const dateObj = new Date(repo.updated_at);
                    if (!isNaN(dateObj.getTime())) {
                        dateStr = dateObj.toLocaleString();
                    }
                } catch (e) {
                    console.warn('Invalid date format for repo:', repo.updated_at, e);
                }

                repoEl.innerHTML = `
                    <div class="repo-header">
                        <h3 class="repo-name">${repo.name}</h3>
                        <span class="repo-visibility ${visibilityClass}">${visibilityText}</span>
                    </div>
                    <div class="repo-meta">
                        <div class="repo-meta-item">
                            <span class="repo-meta-label">Owner:</span>
                            <span class="repo-meta-value">${repo.owner_login}</span>
                        </div>
                        <div class="repo-meta-item">
                            <span class="repo-meta-label">Full Name:</span>
                            <span class="repo-meta-value">${repo.full_name}</span>
                        </div>
                        <div class="repo-meta-item">
                            <span class="repo-meta-label">URL:</span>
                            <a href="${repo.html_url}" target="_blank" class="repo-meta-value repo-link">${repo.html_url}</a>
                        </div>
                    </div>
                    <div class="repo-updated">
                        Updated: ${dateStr} · ${formatRelativeTime(repo.updated_at)}
                    </div>
                `;
                reposList.appendChild(repoEl);
            });

            // Populate repo filter dropdowns
            [prRepoFilter, runRepoFilter].forEach(select => {
                const current = select.value;
                select.innerHTML = '<option value="">All Repos</option>';
                repos.forEach(repo => {
                    const opt = document.createElement('option');
                    opt.value = repo.id;
                    opt.textContent = repo.full_name;
                    select.appendChild(opt);
                });
                select.value = current;
            });
        } catch (error) {
            console.error('Error loading repos:', error);
            reposList.innerHTML = createEmptyState('⚠️', 'Error loading repositories', 'Check console for details');
        }
    }

    // Load PRs
    async function loadPRs() {
        try {
            const params = new URLSearchParams();
            if (prRepoFilter.value) params.append('repoId', prRepoFilter.value);
            if (prStateFilter.value && prStateFilter.value !== 'all') params.append('state', prStateFilter.value);
            const since = getSince();
            if (since) params.append('since', since);

            const response = await fetch(`/prs?${params.toString()}`);
            const prs = await response.json();

            prsCount.textContent = prs.length;

            if (prs.length === 0) {
                prsList.innerHTML = createEmptyState('🔀', 'No pull requests', 'No PRs match the current filters');
                return;
            }

            prsList.innerHTML = '';
            prs.forEach(pr => {
                const prEl = document.createElement('div');
                prEl.className = 'pr-card';

                const state = (pr.state || 'unknown').toLowerCase();
                const stateLabel = state === 'open' ? 'Open' : state === 'closed' ? 'Closed' : state === 'merged' ? 'Merged' : state;

                prEl.innerHTML = `
                    <h4 class="pr-title"><a href="${pr.html_url}" target="_blank">${pr.title}</a></h4>
                    <div class="pr-meta">
                        <span class="pr-meta-item">
                            <span class="pr-meta-label">Repo:</span>
                            <span class="pr-meta-value">${pr.repo_name || 'Unknown'}</span>
                        </span>
                        <span class="pr-meta-item">
                            <span class="pr-meta-label">#${pr.number}</span>
                        </span>
                        <span class="pr-meta-item">
                            <span class="pr-state ${state}">${stateLabel}</span>
                        </span>
                        <span class="pr-meta-item">
                            <span class="pr-meta-label">Author:</span>
                            <span class="pr-meta-value">${pr.author_login}</span>
                        </span>
                        <span class="pr-meta-item">
                            <span class="pr-meta-label">Branch:</span>
                            <span class="pr-meta-value">${pr.head_ref} → ${pr.base_ref}</span>
                        </span>
                    </div>
                    <div class="pr-dates">
                        <span>Created: ${formatDate(pr.created_at)}</span>
                        <span>Updated: ${formatDate(pr.updated_at)}</span>
                        ${pr.closed_at ? `<span>Closed: ${formatDate(pr.closed_at)}</span>` : ''}
                        ${pr.merged_at ? `<span>Merged: ${formatDate(pr.merged_at)}</span>` : ''}
                    </div>
                `;
                prsList.appendChild(prEl);
            });
        } catch (error) {
            console.error('Error loading PRs:', error);
            prsList.innerHTML = createEmptyState('⚠️', 'Error loading PRs', 'Check console for details');
        }
    }

    // Load runs
    async function loadRuns() {
        try {
            const params = new URLSearchParams();
            if (runRepoFilter.value) params.append('repoId', runRepoFilter.value);
            if (runStatusFilter.value && runStatusFilter.value !== 'all') params.append('status', runStatusFilter.value);
            const since = getSince();
            if (since) params.append('since', since);

            const response = await fetch(`/runs?${params.toString()}`);
            const runs = await response.json();

            runsCount.textContent = runs.length;

            if (runs.length === 0) {
                runsList.innerHTML = createEmptyState('⚙️', 'No action runs', 'No workflow runs match the current filters');
                return;
            }

            runsList.innerHTML = '';
            runs.forEach(run => {
                const runEl = document.createElement('div');
                runEl.className = 'run-card';

                const conclusion = (run.conclusion || run.status || 'unknown').toLowerCase();
                const conclusionLabel = conclusion.charAt(0).toUpperCase() + conclusion.slice(1).replace('_', ' ');

                runEl.innerHTML = `
                    <div class="run-header">
                        <h4 class="run-workflow"><a href="${run.html_url}" target="_blank">${run.workflow_name || 'Unknown Workflow'}</a></h4>
                        <span class="run-conclusion ${conclusion}">${conclusionLabel}</span>
                    </div>
                    <div class="run-meta">
                        <div class="run-meta-item">
                            <span class="run-meta-label">Repo:</span>
                            <span class="run-meta-value">${run.repo_name || 'Unknown'}</span>
                        </div>
                        <div class="run-meta-item">
                            <span class="run-meta-label">Run:</span>
                            <span class="run-meta-value">#${run.run_number}</span>
                        </div>
                        <div class="run-meta-item">
                            <span class="run-meta-label">Branch:</span>
                            <span class="run-meta-value run-branch">${run.head_branch || 'N/A'}</span>
                        </div>
                        <div class="run-meta-item">
                            <span class="run-meta-label">Commit:</span>
                            <span class="run-meta-value run-sha">${run.head_sha ? run.head_sha.substring(0, 7) : 'N/A'}</span>
                        </div>
                    </div>
                    <div class="run-dates">
                        <span>Started: ${formatDate(run.run_started_at)}</span>
                        <span>Updated: ${formatDate(run.updated_at)}</span>
                        ${run.completed_at ? `<span>Completed: ${formatDate(run.completed_at)}</span>` : ''}
                    </div>
                `;
                runsList.appendChild(runEl);
            });
        } catch (error) {
            console.error('Error loading runs:', error);
            runsList.innerHTML = createEmptyState('⚠️', 'Error loading runs', 'Check console for details');
        }
    }

    // Load all dashboard data
    async function loadDashboardData() {
        lastUpdatedSpan.textContent = 'Last updated: ' + new Date().toLocaleTimeString();
        try {
            await loadRepos();
            await loadPRs();
            await loadRuns();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    // Event listeners
    refreshBtn.addEventListener('click', loadDashboardData);
    timeWindowSelect.addEventListener('change', () => { loadPRs(); loadRuns(); });
    prStateFilter.addEventListener('change', loadPRs);
    prRepoFilter.addEventListener('change', loadPRs);
    runStatusFilter.addEventListener('change', loadRuns);
    runRepoFilter.addEventListener('change', loadRuns);

    // Initial load
    loadDashboardData();
});