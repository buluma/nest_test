// Dashboard JavaScript - fetches data from API and renders UI
document.addEventListener('DOMContentLoaded', () => {
    const timeWindowSelect = document.getElementById('timeWindow');
    const refreshBtn = document.getElementById('refreshBtn');
    const lastUpdatedSpan = document.getElementById('lastUpdated');
    const reposList = document.getElementById('repos-list');
    const prsList = document.getElementById('prs-list');
    const runsList = document.getElementById('runs-list');
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

    // Load repos and populate repo filter dropdowns
    async function loadRepos() {
        const response = await fetch('/repos');
        const repos = await response.json();

        // Render repo cards
        reposList.innerHTML = '';
        repos.forEach(repo => {
            const repoEl = document.createElement('div');
            repoEl.className = 'repo-item';
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
                <h3>${repo.name}</h3>
                <p>Full Name: ${repo.full_name}</p>
                <p>Owner: ${repo.owner_login}</p>
                <p>Private: ${repo.private ? 'Yes' : 'No'}</p>
                <p>URL: <a href="${repo.html_url}" target="_blank">${repo.html_url}</a></p>
                <p>Updated: ${dateStr}</p>
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

            prsList.innerHTML = '';
            if (prs.length === 0) {
                prsList.innerHTML = '<p class="empty">No pull requests found.</p>';
                return;
            }
            prs.forEach(pr => {
                const prEl = document.createElement('div');
                prEl.className = 'pr-item';
                // Format dates safely
                const formatDate = (dateStr) => {
                    if (!dateStr) return 'N/A';
                    try {
                        const dateObj = new Date(dateStr);
                        if (!isNaN(dateObj.getTime())) {
                            return dateObj.toLocaleString();
                        }
                    } catch (e) {}
                    return dateStr;
                };
                prEl.innerHTML = `
                    <h4><a href="${pr.html_url}" target="_blank">${pr.title}</a></h4>
                    <p>Repo: ${pr.repo_name} · #${pr.number}</p>
                    <p>State: <span class="badge badge-${pr.state}">${pr.state}</span></p>
                    <p>Author: ${pr.author_login}</p>
                    <p>Head Branch: ${pr.head_ref}</p>
                    <p>Base Branch: ${pr.base_ref}</p>
                    <p>Created: ${formatDate(pr.created_at)}</p>
                    <p>Updated: ${formatDate(pr.updated_at)}</p>
                    ${pr.closed_at ? `<p>Closed: ${formatDate(pr.closed_at)}</p>` : ''}
                    ${pr.merged_at ? `<p>Merged: ${formatDate(pr.merged_at)}</p>` : ''}
                `;
                prsList.appendChild(prEl);
            });
        } catch (error) {
            console.error('Error loading PRs:', error);
            prsList.innerHTML = '<p class="empty">Error loading pull requests. Check console.</p>';
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

            runsList.innerHTML = '';
            if (runs.length === 0) {
                runsList.innerHTML = '<p class="empty">No action runs found.</p>';
                return;
            }
            runs.forEach(run => {
                const runEl = document.createElement('div');
                runEl.className = 'run-item';
                const conclusion = run.conclusion || run.status;
                // Format dates safely
                const formatDate = (dateStr) => {
                    if (!dateStr) return 'N/A';
                    try {
                        const dateObj = new Date(dateStr);
                        if (!isNaN(dateObj.getTime())) {
                            return dateObj.toLocaleString();
                        }
                    } catch (e) {}
                    return dateStr;
                };
                runEl.innerHTML = `
                    <h4><a href="${run.html_url}" target="_blank">${run.workflow_name}</a></h4>
                    <p>Repo: ${run.repo_name} · Run #${run.run_number}</p>
                    <p>Status: <span class="badge badge-${conclusion}">${conclusion}</span></p>
                    <p>Branch: ${run.head_branch}</p>
                    <p>Commit: ${run.head_sha.substring(0, 7)}</p>
                    <p>Started: ${formatDate(run.run_started_at)}</p>
                    <p>Updated: ${formatDate(run.updated_at)}</p>
                    ${run.completed_at ? `<p>Completed: ${formatDate(run.completed_at)}</p>` : ''}
                `;
                runsList.appendChild(runEl);
            });
        } catch (error) {
            console.error('Error loading runs:', error);
            runsList.innerHTML = '<p class="empty">Error loading runs. Check console.</p>';
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