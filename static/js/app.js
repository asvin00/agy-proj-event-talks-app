// --- STATE MANAGEMENT ---
let appState = {
    updates: [],
    selectedUpdates: new Set(),
    currentFilter: 'all',
    searchQuery: '',
    currentTweetMode: 'single', // 'single' or 'multi'
    activeTweetData: null // Stores text/links for the modal
};

// --- DOM ELEMENTS ---
const elements = {
    refreshBtn: document.getElementById('refreshBtn'),
    statusIndicator: document.getElementById('statusIndicator'),
    statusText: document.getElementById('statusText'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    filterPills: document.getElementById('filterPills'),
    statsOverview: document.getElementById('statsOverview'),
    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    errorTitle: document.getElementById('errorTitle'),
    errorMessage: document.getElementById('errorMessage'),
    retryBtn: document.getElementById('retryBtn'),
    emptyState: document.getElementById('emptyState'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    updatesTimeline: document.getElementById('updatesTimeline'),
    floatingActionBar: document.getElementById('floatingActionBar'),
    selectedCountText: document.getElementById('selectedCountText'),
    deselectAllBtn: document.getElementById('deselectAllBtn'),
    tweetSelectedBtn: document.getElementById('tweetSelectedBtn'),
    
    // Stats elements
    countFeatures: document.getElementById('countFeatures'),
    countChanges: document.getElementById('countChanges'),
    countBreaking: document.getElementById('countBreaking'),
    countIssues: document.getElementById('countIssues'),
    
    // Modal elements
    tweetModal: document.getElementById('tweetModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    tweetTextarea: document.getElementById('tweetTextarea'),
    charCounter: document.getElementById('charCounter'),
    postTweetActionBtn: document.getElementById('postTweetActionBtn'),
    btnShortenText: document.getElementById('btnShortenText'),
    btnLinkOnly: document.getElementById('btnLinkOnly')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes();
    setupEventListeners();
});

// --- EVENT LISTENERS setup ---
function setupEventListeners() {
    // Refresh button
    elements.refreshBtn.addEventListener('click', () => {
        fetchReleaseNotes();
    });

    // Retry button
    elements.retryBtn.addEventListener('click', () => {
        fetchReleaseNotes();
    });

    // Search Input
    elements.searchInput.addEventListener('input', (e) => {
        appState.searchQuery = e.target.value.toLowerCase().trim();
        elements.clearSearchBtn.style.display = appState.searchQuery ? 'block' : 'none';
        renderFilteredUpdates();
    });

    // Clear Search button
    elements.clearSearchBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        appState.searchQuery = '';
        elements.clearSearchBtn.style.display = 'none';
        renderFilteredUpdates();
    });

    // Reset Filters button (in empty state)
    elements.resetFiltersBtn.addEventListener('click', resetFilters);

    // Filter pills selection
    elements.filterPills.addEventListener('click', (e) => {
        const pill = e.target.closest('.pill');
        if (!pill) return;
        
        // Remove active class from all pills
        document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        
        // Add active class to selected pill
        pill.classList.add('active');
        
        // Update state and render
        appState.currentFilter = pill.dataset.filter;
        syncStatsCardsHighlight();
        renderFilteredUpdates();
    });

    // Stats card clicking (acts as a filter filter shortcut)
    elements.statsOverview.addEventListener('click', (e) => {
        const card = e.target.closest('.stat-card');
        if (!card) return;
        
        const category = card.dataset.category;
        
        // Find corresponding pill
        const pill = document.querySelector(`.pill[data-filter="${category}"]`);
        if (pill) {
            pill.click();
        }
    });

    // Floating selection bar action
    elements.deselectAllBtn.addEventListener('click', deselectAll);
    elements.tweetSelectedBtn.addEventListener('click', openMultiTweetModal);

    // Modal close events
    elements.closeModalBtn.addEventListener('click', closeTweetModal);
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) closeTweetModal();
    });

    // Live character counting in textarea
    elements.tweetTextarea.addEventListener('input', updateCharCount);

    // Modal optimization helpers
    elements.btnShortenText.addEventListener('click', handleAutoShorten);
    elements.btnLinkOnly.addEventListener('click', handleLinkOnly);

    // Tweet action button
    elements.postTweetActionBtn.addEventListener('click', submitTweetToX);
}

// --- FETCH DATA FROM API ---
async function fetchReleaseNotes() {
    setLoading(true);
    try {
        const response = await fetch('/api/notes');
        const data = await response.json();
        
        if (data.status === 'success' || data.status === 'warning') {
            appState.updates = data.updates;
            
            // Set sync status text
            if (data.status === 'warning') {
                setSyncStatus('warning', 'Cached data (Offline)');
            } else {
                const now = new Date();
                setSyncStatus('success', `Synced at ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
            }
            
            // Populate statistics
            updateStatsOverview(data.updates);
            
            // Render content
            renderFilteredUpdates();
        } else {
            showError('Server Error', data.message || 'Failed to fetch release notes.');
        }
    } catch (error) {
        showError('Network Connection Error', 'Could not reach the server. Please verify Flask is running.');
        console.error(error);
    } finally {
        setLoading(false);
    }
}

// --- UI HELPERS ---
function setLoading(isLoading) {
    if (isLoading) {
        elements.loadingState.style.display = 'block';
        elements.updatesTimeline.style.display = 'none';
        elements.errorState.style.display = 'none';
        elements.emptyState.style.display = 'none';
        
        // Animate refresh button icon
        const icon = elements.refreshBtn.querySelector('.sync-icon');
        icon.classList.add('loading');
        elements.refreshBtn.disabled = true;
        
        elements.statusIndicator.className = 'status-indicator syncing';
        elements.statusText.textContent = 'Syncing feed...';
    } else {
        elements.loadingState.style.display = 'none';
        const icon = elements.refreshBtn.querySelector('.sync-icon');
        icon.classList.remove('loading');
        elements.refreshBtn.disabled = false;
    }
}

function setSyncStatus(type, text) {
    elements.statusIndicator.className = `status-indicator ${type === 'success' ? 'synced' : 'syncing'}`;
    elements.statusText.textContent = text;
}

function showError(title, message) {
    elements.errorState.style.display = 'block';
    elements.errorTitle.textContent = title;
    elements.errorMessage.textContent = message;
    elements.updatesTimeline.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.loadingState.style.display = 'none';
}

function updateStatsOverview(updates) {
    const stats = {
        Feature: 0,
        Change: 0,
        Breaking: 0,
        Issue: 0
    };
    
    updates.forEach(u => {
        if (stats[u.category] !== undefined) {
            stats[u.category]++;
        }
    });

    // Animate counter increments
    animateCounter(elements.countFeatures, stats.Feature);
    animateCounter(elements.countChanges, stats.Change);
    animateCounter(elements.countBreaking, stats.Breaking);
    animateCounter(elements.countIssues, stats.Issue);
}

function animateCounter(element, targetValue) {
    let start = 0;
    const duration = 800; // ms
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Easing function outQuad
        const ease = progress * (2 - progress);
        const currentVal = Math.round(ease * targetValue);
        
        element.textContent = currentVal;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}

function resetFilters() {
    elements.searchInput.value = '';
    appState.searchQuery = '';
    elements.clearSearchBtn.style.display = 'none';
    
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    document.querySelector('.pill[data-filter="all"]').classList.add('active');
    appState.currentFilter = 'all';
    
    syncStatsCardsHighlight();
    renderFilteredUpdates();
}

function syncStatsCardsHighlight() {
    document.querySelectorAll('.stat-card').forEach(card => {
        if (card.dataset.category === appState.currentFilter) {
            card.classList.add('active-pill');
        } else {
            card.classList.remove('active-pill');
        }
    });
}

// --- RENDER FILTERED UPDATES ---
function renderFilteredUpdates() {
    const timeline = elements.updatesTimeline;
    
    // Apply filters
    const filtered = appState.updates.filter(update => {
        // Filter by category
        if (appState.currentFilter !== 'all' && update.category !== appState.currentFilter) {
            return false;
        }
        
        // Filter by search query
        if (appState.searchQuery) {
            const dateMatch = update.date.toLowerCase().includes(appState.searchQuery);
            const catMatch = update.category.toLowerCase().includes(appState.searchQuery);
            const textMatch = update.text.toLowerCase().includes(appState.searchQuery);
            return dateMatch || catMatch || textMatch;
        }
        
        return true;
    });

    // Check if empty
    if (filtered.length === 0) {
        timeline.style.display = 'none';
        elements.emptyState.style.display = 'block';
        return;
    }
    
    elements.emptyState.style.display = 'none';
    timeline.style.display = 'flex';
    timeline.innerHTML = '';

    // Group updates by date
    const groups = {};
    filtered.forEach(update => {
        if (!groups[update.date]) {
            groups[update.date] = [];
        }
        groups[update.date].push(update);
    });

    // Render groups
    Object.keys(groups).forEach(date => {
        // Group Container
        const groupDiv = document.createElement('div');
        groupDiv.className = 'update-group';
        
        // Group date header
        const dateHeader = document.createElement('div');
        dateHeader.className = 'update-group-date';
        dateHeader.textContent = date;
        groupDiv.appendChild(dateHeader);
        
        // Render individual cards inside group
        groups[date].forEach(update => {
            const card = document.createElement('div');
            const isSelected = appState.selectedUpdates.has(update.id);
            card.className = `update-card ${isSelected ? 'selected' : ''}`;
            card.dataset.id = update.id;
            
            // Safe Class Tag
            const tagClass = `tag-${update.category.toLowerCase()}`;
            
            card.innerHTML = `
                <div class="card-header">
                    <div class="card-meta">
                        <span class="tag ${tagClass}">${update.category}</span>
                        <span class="card-date">${update.date}</span>
                    </div>
                    <div class="card-select">
                        <label class="checkbox-container">
                            <input type="checkbox" class="update-select-checkbox" data-id="${update.id}" ${isSelected ? 'checked' : ''}>
                            <span class="checkmark"></span>
                        </label>
                    </div>
                </div>
                <div class="card-body">
                    ${update.html}
                </div>
                <div class="card-actions">
                    <a href="${update.link}" target="_blank" class="btn-card-action" rel="noopener noreferrer">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
                        </svg>
                        <span>Docs</span>
                    </a>
                    <button class="btn-card-action tweet" data-id="${update.id}">
                        <svg class="x-icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span>Tweet</span>
                    </button>
                </div>
            `;
            
            // Add listeners to inside elements
            const checkbox = card.querySelector('.update-select-checkbox');
            checkbox.addEventListener('change', (e) => {
                handleSelectionChange(update.id, e.target.checked);
            });

            const tweetBtn = card.querySelector('.tweet');
            tweetBtn.addEventListener('click', () => {
                openSingleTweetModal(update);
            });
            
            groupDiv.appendChild(card);
        });
        
        timeline.appendChild(groupDiv);
    });
}

// --- SELECTION ACTIONS ---
function handleSelectionChange(id, isChecked) {
    const card = document.querySelector(`.update-card[data-id="${id}"]`);
    
    if (isChecked) {
        appState.selectedUpdates.add(id);
        if (card) card.classList.add('selected');
    } else {
        appState.selectedUpdates.delete(id);
        if (card) card.classList.remove('selected');
    }
    
    updateFloatingActionBar();
}

function updateFloatingActionBar() {
    const bar = elements.floatingActionBar;
    const count = appState.selectedUpdates.size;
    
    if (count > 0) {
        elements.selectedCountText.textContent = `${count} update${count > 1 ? 's' : ''} selected`;
        bar.classList.add('show');
    } else {
        bar.classList.remove('show');
    }
}

function deselectAll() {
    appState.selectedUpdates.clear();
    
    // Uncheck all visible checkboxes
    document.querySelectorAll('.update-select-checkbox').forEach(cb => {
        cb.checked = false;
    });
    
    // Remove selected class from cards
    document.querySelectorAll('.update-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    updateFloatingActionBar();
}

// --- TWEET COMPOSITION MODAL LOGIC ---
function openSingleTweetModal(update) {
    appState.currentTweetMode = 'single';
    appState.activeTweetData = {
        id: update.id,
        category: update.category,
        date: update.date,
        text: update.text,
        link: update.link
    };
    
    // Compose initial tweet text
    const emojiMap = {
        'Feature': '💡',
        'Change': '⚙️',
        'Breaking': '⚠️',
        'Issue': '🐛',
        'Announcement': '📢',
        'General': '⚡'
    };
    const emoji = emojiMap[update.category] || '⚡';
    
    // Default tweet template
    const text = `${emoji} BigQuery Update - [${update.category}] (${update.date}):\n\n${update.text}\n\n🔗 Source: ${update.link}`;
    
    elements.tweetTextarea.value = text;
    elements.tweetModal.classList.add('open');
    updateCharCount();
}

function openMultiTweetModal() {
    appState.currentTweetMode = 'multi';
    
    // Gather selected updates details
    const selectedList = appState.updates.filter(u => appState.selectedUpdates.has(u.id));
    if (selectedList.length === 0) return;
    
    appState.activeTweetData = selectedList;
    
    const emojiMap = {
        'Feature': '💡',
        'Change': '⚙️',
        'Breaking': '⚠️',
        'Issue': '🐛',
        'Announcement': '📢',
        'General': '⚡'
    };
    
    // Format bullet points of updates
    let updateTexts = [];
    selectedList.forEach((update, idx) => {
        const emoji = emojiMap[update.category] || '⚡';
        // Get first sentence or short text
        let snippet = update.text.split(/[.!\n]/)[0].trim();
        if (snippet.length > 70) {
            snippet = snippet.substring(0, 67) + '...';
        }
        updateTexts.push(`${idx + 1}. ${emoji} [${update.category}] ${snippet}`);
    });
    
    // Combine link (use default link if multiple, or the link of the first one)
    const baseLink = selectedList[0].link;
    
    const text = `📢 BigQuery Releases Hub:\n\n${updateTexts.join('\n')}\n\n🔗 Read all updates: ${baseLink}`;
    
    elements.tweetTextarea.value = text;
    elements.tweetModal.classList.add('open');
    updateCharCount();
}

function closeTweetModal() {
    elements.tweetModal.classList.remove('open');
    appState.activeTweetData = null;
}

function updateCharCount() {
    const length = elements.tweetTextarea.value.length;
    elements.charCounter.textContent = length;
    
    // Color code counter based on proximity to limit
    elements.charCounter.className = 'char-count';
    if (length > 280) {
        elements.charCounter.classList.add('error');
        elements.postTweetActionBtn.disabled = true;
        elements.postTweetActionBtn.style.opacity = '0.5';
        elements.postTweetActionBtn.style.cursor = 'not-allowed';
    } else {
        if (length > 240) {
            elements.charCounter.classList.add('warning');
        }
        elements.postTweetActionBtn.disabled = false;
        elements.postTweetActionBtn.style.opacity = '1';
        elements.postTweetActionBtn.style.cursor = 'pointer';
    }
}

// --- OPTIMIZATION HELPERS ---
function handleAutoShorten() {
    if (appState.currentTweetMode === 'single') {
        const update = appState.activeTweetData;
        const emojiMap = { 'Feature': '💡', 'Change': '⚙️', 'Breaking': '⚠️', 'Issue': '🐛', 'Announcement': '📢' };
        const emoji = emojiMap[update.category] || '⚡';
        
        // Base structure without description:
        const header = `${emoji} BigQuery - [${update.category}] (${update.date}):\n\n`;
        const footer = `\n\n🔗 Source: ${update.link}`;
        
        // Calculate max allowed length for description
        const maxDescLength = 280 - header.length - footer.length;
        
        let desc = update.text;
        if (desc.length > maxDescLength) {
            desc = desc.substring(0, maxDescLength - 3).trim() + '...';
        }
        
        elements.tweetTextarea.value = `${header}${desc}${footer}`;
        updateCharCount();
    } else {
        // Multi mode shorten: keep only first sentence and smaller bullet sizes
        const selectedList = appState.activeTweetData;
        const emojiMap = { 'Feature': '💡', 'Change': '⚙️', 'Breaking': '⚠️', 'Issue': '🐛', 'Announcement': '📢' };
        
        let updateTexts = [];
        selectedList.forEach((update, idx) => {
            const emoji = emojiMap[update.category] || '⚡';
            // Only first few words or very short snippet
            let snippet = update.text.split(/[.!\n]/)[0].trim();
            if (snippet.length > 40) {
                snippet = snippet.substring(0, 37) + '...';
            }
            updateTexts.push(`${idx + 1}. ${emoji} ${snippet}`);
        });
        
        const baseLink = selectedList[0].link;
        const text = `📢 BigQuery Updates:\n\n${updateTexts.join('\n')}\n\n🔗 Details: ${baseLink}`;
        
        elements.tweetTextarea.value = text;
        updateCharCount();
    }
}

function handleLinkOnly() {
    if (appState.currentTweetMode === 'single') {
        const update = appState.activeTweetData;
        const emojiMap = { 'Feature': '💡', 'Change': '⚙️', 'Breaking': '⚠️', 'Issue': '🐛', 'Announcement': '📢' };
        const emoji = emojiMap[update.category] || '⚡';
        
        const text = `${emoji} BigQuery Update - [${update.category}] (${update.date})\n\nRead the full update details here:\n🔗 Source: ${update.link}`;
        elements.tweetTextarea.value = text;
        updateCharCount();
    } else {
        const selectedList = appState.activeTweetData;
        const baseLink = selectedList[0].link;
        const text = `📢 Google Cloud BigQuery released ${selectedList.length} updates recently. Check out details here:\n\n🔗 Source: ${baseLink}`;
        elements.tweetTextarea.value = text;
        updateCharCount();
    }
}

// --- SUBMIT TWEET TO TWITTER/X ---
function submitTweetToX() {
    const text = elements.tweetTextarea.value;
    if (text.length > 280) {
        alert("Your tweet is too long. Please shorten it before posting.");
        return;
    }
    
    // Construct Web Intent URL
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    
    // Open in a new tab
    window.open(intentUrl, '_blank', 'noopener,noreferrer');
    
    // Close modal
    closeTweetModal();
}
