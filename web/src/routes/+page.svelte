<script lang="ts">
	import { onMount } from 'svelte';

	// Feed subscription state
	let feeds: any[] = [];
	let selectedFeedUrl: string | null = null;
	let feedsLoading = false;
	let feedsError: string | null = null;

	// Add feed state
	let newFeedUrl = '';
	let addingFeed = false;

	// Items state
	let items: any[] = [];
	let itemsTotal = 0;
	let itemsLoading = false;
	let itemsError: string | null = null;
	let sourceFilter = 'all';
	let unreadOnly = false;
	let starredOnly = false;
	let timeFilter = 'all'; // today, 24h, week, all

	// Search
	let searchQuery = '';

	// Settings modal
	let showSettings = false;
	let importResults: any = null;
	let importingOpml = false;

	// Search state
	let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	let isSearching = false;

	onMount(() => {
		loadFeeds();
		loadItems();
	});

	async function loadFeeds() {
		feedsLoading = true;
		feedsError = null;

		try {
			const response = await fetch('/api/feeds');
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			feeds = data.feeds || [];
		} catch (err) {
			feedsError = err instanceof Error ? err.message : 'Unknown error occurred';
		} finally {
			feedsLoading = false;
		}
	}

	async function addFeed() {
		if (!newFeedUrl.trim()) return;

		addingFeed = true;

		try {
			const response = await fetch('/api/feeds', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ url: newFeedUrl.trim(), refresh: true })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
			}

			newFeedUrl = '';
			await loadFeeds();
			await loadItems();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to add feed');
		} finally {
			addingFeed = false;
		}
	}

	async function deleteFeed(url: string) {
		if (!confirm(`Delete feed: ${url}?`)) return;

		try {
			const response = await fetch(`/api/feeds?url=${encodeURIComponent(url)}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
			}

			if (selectedFeedUrl === url) {
				selectedFeedUrl = null;
			}

			await loadFeeds();
			await loadItems();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to delete feed');
		}
	}

	async function refreshAll() {
		try {
			const response = await fetch('/api/refresh', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
			}

			await loadFeeds();
			await loadItems();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to refresh');
		}
	}

	async function loadItems() {
		itemsLoading = true;
		itemsError = null;

		try {
			// If searching, use search endpoint
			if (searchQuery.trim()) {
				const params = new URLSearchParams({
					q: searchQuery.trim(),
					limit: '100',
					offset: '0'
				});

				const response = await fetch(`/api/search?${params}`);
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				const data = await response.json();
				items = data.items || [];
				itemsTotal = data.total || 0;
				isSearching = true;
				return;
			}

			// Normal item listing
			isSearching = false;
			const params = new URLSearchParams({
				limit: '100',
				offset: '0'
			});

			if (selectedFeedUrl) {
				params.set('feed', selectedFeedUrl);
			}

			if (sourceFilter !== 'all') {
				params.set('source', sourceFilter);
			}

			if (unreadOnly) {
				params.set('unreadOnly', 'true');
			}

			if (starredOnly) {
				params.set('starredOnly', '1');
			}

			const response = await fetch(`/api/items?${params}`);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			items = data.items || [];
			itemsTotal = data.total || 0;
		} catch (err) {
			itemsError = err instanceof Error ? err.message : 'Unknown error occurred';
		} finally {
			itemsLoading = false;
		}
	}

	async function toggleRead(item: any) {
		const newReadState = !item.is_read;

		try {
			const response = await fetch(`/api/items/${item.id}/read`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ read: newReadState })
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			// Update local state
			item.is_read = newReadState ? 1 : 0;
			items = [...items];

			// Refresh feed list to update unread counts
			await loadFeeds();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to update read status');
		}
	}

	async function toggleStar(item: any) {
		const newStarredState = !item.is_starred;
		const oldStarredState = item.is_starred;

		// Optimistic update
		item.is_starred = newStarredState ? 1 : 0;
		items = [...items];

		try {
			const response = await fetch(`/api/items/${item.id}/star`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ starred: newStarredState })
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
		} catch (err) {
			// Rollback on error
			item.is_starred = oldStarredState;
			items = [...items];
			alert(err instanceof Error ? err.message : 'Failed to update starred status');
		}
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return 'Unknown';
		try {
			const date = new Date(dateStr);
			return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		} catch {
			return dateStr;
		}
	}

	function selectFeed(url: string | null) {
		selectedFeedUrl = url;
		loadItems();
	}

	// Reactive stats
	$: totalUnread = feeds.reduce((sum, f) => sum + (f.unreadCount || 0), 0);

	// Reload items when filters change
	$: if (sourceFilter || unreadOnly !== undefined || starredOnly !== undefined || selectedFeedUrl !== undefined) {
		loadItems();
	}

	// Debounced search
	function handleSearchInput() {
		if (searchDebounceTimer) {
			clearTimeout(searchDebounceTimer);
		}

		searchDebounceTimer = setTimeout(() => {
			loadItems();
		}, 300);
	}

	function clearSearch() {
		searchQuery = '';
		loadItems();
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			clearSearch();
		}
	}

	async function exportOpml() {
		try {
			const response = await fetch('/api/opml/export');
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `feedstream-${Date.now()}.opml`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to export OPML');
		}
	}

	async function importOpml(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		importingOpml = true;
		importResults = null;

		try {
			const opmlText = await file.text();

			const response = await fetch('/api/opml/import', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ opml: opmlText })
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
			}

			importResults = data;

			// Refresh feeds list
			if (data.added > 0) {
				await loadFeeds();
				await loadItems();
			}
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to import OPML');
		} finally {
			importingOpml = false;
			// Reset file input
			input.value = '';
		}
	}
</script>

<svelte:head>
	<title>FeedStream - Private feed reader</title>
</svelte:head>

<div class="app">
	<!-- Sidebar -->
	<aside class="sidebar glass-panel">
		<div class="sidebar-header">
			<div class="logo">
				<div class="logo-icon">
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
						<path d="M4 4h12v12H4z" fill="currentColor"/>
					</svg>
				</div>
				<span class="logo-text">FeedStream</span>
			</div>
		</div>

		<nav class="sidebar-nav">
			<button 
				class="nav-item" 
				class:active={selectedFeedUrl === null}
				on:click={() => selectFeed(null)}
			>
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
					<rect x="2" y="2" width="6" height="6" rx="1" fill="currentColor"/>
					<rect x="10" y="2" width="6" height="6" rx="1" fill="currentColor"/>
					<rect x="2" y="10" width="6" height="6" rx="1" fill="currentColor"/>
					<rect x="10" y="10" width="6" height="6" rx="1" fill="currentColor"/>
				</svg>
				<span>All Items</span>
				{#if totalUnread > 0}
					<span class="badge">{totalUnread}</span>
				{/if}
			</button>

			<button class="nav-item" on:click={() => unreadOnly = !unreadOnly} class:active={unreadOnly}>
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
					<circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="2" fill="none"/>
					<circle cx="9" cy="9" r="3" fill="currentColor"/>
				</svg>
				<span>Unread</span>
			</button>

			<button class="nav-item" on:click={() => starredOnly = !starredOnly} class:active={starredOnly}>
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
					<path d="M9 2l2.163 4.382 4.837.703-3.5 3.411.826 4.819L9 13.09l-4.326 2.225.826-4.819-3.5-3.411 4.837-.703L9 2z" fill="currentColor"/>
				</svg>
				<span>Starred</span>
			</button>
		</nav>

		<div class="sidebar-section">
			<div class="section-header">SMART FOLDERS</div>
			{#each feeds as feed}
				<button 
					class="feed-item" 
					class:active={selectedFeedUrl === feed.url}
					on:click={() => selectFeed(feed.url)}
				>
					<span class="feed-icon">
						{#if feed.kind === 'youtube'}▶️{:else if feed.kind === 'reddit'}🔗{:else}📰{/if}
					</span>
					<span class="feed-name">{feed.title || feed.url}</span>
					{#if feed.unreadCount > 0}
						<span class="badge">{feed.unreadCount}</span>
					{/if}
					<button class="delete-btn" on:click|stopPropagation={() => deleteFeed(feed.url)}>×</button>
				</button>
			{/each}
		</div>
	</aside>

	<!-- Main Content -->
	<main class="main-content">
		<!-- Top Bar -->
		<header class="topbar glass-panel">
			<div class="topbar-left">
				<div class="logo-small">
					<div class="logo-icon">
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
							<path d="M3 3h10v10H3z" fill="currentColor"/>
						</svg>
					</div>
					<span>FeedStream</span>
				</div>
			</div>

			<div class="topbar-center">
				<div class="search-box">
					<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
						<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/>
						<path d="M12.5 12.5l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
					<input 
						type="text" 
						placeholder="Search articles..." 
						bind:value={searchQuery}
						on:input={handleSearchInput}
						on:keydown={handleSearchKeydown}
					/>
					{#if searchQuery}
						<button class="search-clear" on:click={clearSearch} title="Clear search (ESC)">
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
								<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
							</svg>
						</button>
					{/if}
				</div>
			</div>

			<div class="topbar-right">
				<button class="icon-btn" on:click={refreshAll} title="Refresh all feeds">
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
						<path d="M17 10c0 3.866-3.134 7-7 7s-7-3.134-7-7 3.134-7 7-7c1.933 0 3.683.783 4.95 2.05" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						<path d="M17 6v4h-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</button>
				<button class="icon-btn" on:click={() => showSettings = true} title="Settings">
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
						<circle cx="10" cy="10" r="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
						<path d="M10 2v2m0 12v2M18 10h-2M4 10H2m13.66-5.66l-1.42 1.42M7.76 12.24l-1.42 1.42m11.32 0l-1.42-1.42M7.76 7.76L6.34 6.34" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
				</button>
				<button class="add-btn" on:click={() => {
					const url = prompt('Enter feed URL:');
					if (url) {
						newFeedUrl = url;
						addFeed();
					}
				}}>
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
						<path d="M10 5v10M5 10h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
					</svg>
				</button>
			</div>
		</header>

		<!-- Filter Chips -->
			<div class="content-header">
				<h1>{isSearching ? `Search Results (${itemsTotal})` : 'Articles'}</h1>
				<div class="filter-chips">
					<button class="chip" class:active={timeFilter === 'today'} on:click={() => timeFilter = 'today'}>Today</button>
					<button class="chip" class:active={timeFilter === '24h'} on:click={() => timeFilter = '24h'}>Last 24h</button>
					<button class="chip" class:active={timeFilter === 'week'} on:click={() => timeFilter = 'week'}>Week</button>
					<button class="chip" class:active={timeFilter === 'all'} on:click={() => timeFilter = 'all'}>All</button>
				</div>
			</div>!-- Articles List -->
		<div class="articles-container">
			{#if itemsLoading}
				<div class="empty-state">Loading articles...</div>
			{:else if itemsError}
				<div class="empty-state error">{itemsError}</div>
			{:else if items.length === 0}
				<div class="empty-state">No articles found. Add some feeds to get started!</div>
			{:else}
				{#each items as item}
					<article class="article-card glass-panel-light" class:unread={item.is_read === 0}>
						<div class="article-header">
							<h3 class="article-title">
								{#if item.url}
									<a href={item.url} target="_blank" rel="noopener noreferrer">
										{item.title || 'Untitled'}
									</a>
								{:else}
									{item.title || 'Untitled'}
								{/if}
							</h3>
							<div class="article-actions">
								<button 
									class="star-btn" 
									class:starred={item.is_starred === 1}
									on:click={() => toggleStar(item)}
									title={item.is_starred === 1 ? 'Unstar' : 'Star'}
								>
									<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
										<path d="M8 1.5l1.902 3.854 4.252.618-3.077 3-726.726 3.917L8 11.5l-3.803 2 .726-4.252-3.077-3 4.252-.618L8 1.5z" 
											stroke="currentColor" 
											stroke-width="1.5" 
											fill={item.is_starred === 1 ? 'currentColor' : 'none'}
										/>
									</svg>
								</button>
								<button 
									class="read-dot" 
									class:read={item.is_read === 1}
									on:click={() => toggleRead(item)}
									title={item.is_read === 1 ? 'Mark as unread' : 'Mark as read'}
								>
									<span class="dot"></span>
								</button>
							</div>
						</div>

						<div class="article-meta">
							{#if item.author}
								<span>{item.author}</span>
							{/if}
							{#if item.published}
								<span class="meta-sep">•</span>
								<span>{formatDate(item.published)}</span>
							{/if}
						</div>

						{#if item.summary}
							<p class="article-summary">{item.summary}</p>
						{/if}

						{#if item.media_thumbnail}
							<div class="article-thumbnail">
								<img src={item.media_thumbnail} alt={item.title || 'Thumbnail'} loading="lazy" />
							</div>
						{/if}
					</article>
				{/each}
			{/if}
		</div>
	</main>

	<!-- Settings Modal -->
	{#if showSettings}
		<div class="modal-overlay" on:click={() => showSettings = false}>
			<div class="modal glass-panel" on:click|stopPropagation>
				<div class="modal-header">
					<h2>Settings</h2>
					<button class="close-btn" on:click={() => showSettings = false}>×</button>
				</div>

				<div class="modal-body">
					<div class="settings-section">
						<h3>OPML</h3>
						<div class="settings-actions">
							<button class="settings-btn" on:click={exportOpml}>
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
									<path d="M8 2v8m0 0l3-3m-3 3L5 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
									<path d="M14 10v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
								</svg>
								Export OPML
							</button>

							<label class="settings-btn">
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
									<path d="M8 14V6m0 0l3 3m-3-3L5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
									<path d="M14 6V3a1 1 0 00-1-1H3a1 1 0 00-1 1v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
								</svg>
								{importingOpml ? 'Importing...' : 'Import OPML'}
								<input type="file" accept=".opml,.xml" on:change={importOpml} disabled={importingOpml} style="display: none;"/>
							</label>
						</div>

						{#if importResults}
							<div class="import-results">
								<div class="results-summary">
									<span class="result-item success">✓ Added: {importResults.added}</span>
									<span class="result-item">⊘ Skipped: {importResults.skipped}</span>
									{#if importResults.failed.length > 0}
										<span class="result-item error">✗ Failed: {importResults.failed.length}</span>
									{/if}
								</div>

								{#if importResults.failed.length > 0}
									<div class="failed-feeds">
										<h4>Failed Feeds:</h4>
										{#each importResults.failed as fail}
											<div class="failed-item">
												<div class="failed-url">{fail.url}</div>
												<div class="failed-error">{fail.error}</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.app {
		display: flex;
		height: 100vh;
		overflow: hidden;
	}

	/* Sidebar */
	.sidebar {
		width: var(--sidebar-width);
		display: flex;
		flex-direction: column;
		padding: var(--gap-lg);
		gap: var(--gap);
		overflow-y: auto;
		background: var(--panel0);
		border-right: 1px solid var(--stroke);
	}
    
    /* Remove individual panels if sidebar is whole panel, or keep panels inside? 
       Design decision: The sidebar ITSELF is a glass panel in app structure. 
       Let's refine .sidebar-header and nav items.
    */

	.sidebar-header {
		padding-bottom: var(--gap);
		border-bottom: 1px solid var(--stroke);
        margin-bottom: var(--gap);
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.logo-icon {
		width: 40px;
		height: 40px;
		background: linear-gradient(135deg, var(--accent), #15bd78);
		border-radius: var(--radiusS);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--bg0);
        box-shadow: 0 4px 12px rgba(34, 229, 152, 0.3);
	}

	.logo-text {
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 700;
		color: var(--text);
        letter-spacing: -0.02em;
	}

	.sidebar-nav {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.nav-item, .feed-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radiusS);
		color: var(--muted);
		font-size: 14px;
        font-weight: 500;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
		text-align: left;
		width: 100%;
	}

	.nav-item:hover, .feed-item:hover {
		background: var(--chip);
		color: var(--text);
        border-color: var(--stroke);
        transform: translateX(2px);
	}

	.nav-item.active {
		background: var(--accent-glow);
		color: var(--accent);
        border-color: rgba(34, 229, 153, 0.1);
	}
    
    .feed-item.active {
         background: var(--chip-hover);
         color: var(--text);
         border-color: var(--stroke);
    }

	.nav-item svg, .feed-item .feed-icon {
		flex-shrink: 0;
        opacity: 0.8;
	}
    
    .nav-item.active svg {
        opacity: 1;
    }

	.nav-item span:first-of-type, .feed-name {
		flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
	}

	.badge {
		background: var(--accent);
		color: var(--bg0);
		padding: 2px 8px;
		border-radius: 99px;
		font-size: 11px;
		font-weight: 700;
        min-width: 20px;
        text-align: center;
	}

	.sidebar-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
        margin-top: var(--gap);
	}

	.section-header {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: var(--muted2);
		padding: 8px 16px;
		text-transform: uppercase;
	}

	/* Main Content */
	.main-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
        position: relative;
	}

	/* Top Bar */
	.topbar {
		height: var(--topbar-height);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--page-padding);
        margin-bottom: 0;
        z-index: 10;
        /* Remove glass-panel class style overrides as it might be double applied */
        background: transparent; 
        border: none;
        backdrop-filter: none;
        box-shadow: none;
	}
    
    /* Topbar needs to be clean, search bar is the focus */

	.topbar-left, .topbar-right {
		display: flex;
		align-items: center;
		gap: 12px;
	}
    
    .logo-small {
        /* Hide logo small on desktop if sidebar is visible, handled by media query usually
           But here we keep it simple.
        */
        display: none; 
    }

	.topbar-center {
		flex: 1;
		max-width: 640px;
		margin: 0 var(--gap-lg);
	}

	.search-box {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 0 20px;
		height: 48px;
		background: var(--panel1);
		border: 1px solid var(--stroke);
		border-radius: 999px;
		color: var(--muted);
        transition: all 0.2s ease;
	}
    
    .search-box:focus-within {
        background: var(--panel0);
        border-color: var(--accent);
        box-shadow: 0 0 0 4px rgba(34, 229, 153, 0.1);
        color: var(--text);
    }

	.search-box input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text);
		font-size: 15px;
        font-weight: 500;
	}

	.search-box input::placeholder {
		color: var(--muted2);
	}

	.icon-btn {
		width: 42px;
		height: 42px;
		background: var(--panel1);
		border: 1px solid var(--stroke);
		border-radius: 50%;
		color: var(--muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.icon-btn:hover {
		background: var(--chip-hover);
		color: var(--text);
		border-color: var(--stroke-strong);
        transform: translateY(-1px);
	}

	.add-btn {
		width: 42px;
		height: 42px;
		background: var(--accent);
		border: none;
		border-radius: 50%;
		color: var(--bg0);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
		box-shadow: 0 4px 12px rgba(34, 229, 152, 0.4);
	}

	.add-btn:hover {
		transform: scale(1.05) rotate(90deg);
        background: #15bd78;
	}

	/* Filter Chips */
    .content-header {
        padding: 0 var(--page-padding);
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--gap);
    }
    
    .content-header h1 {
        font-size: 24px;
        margin: 0;
        background: linear-gradient(to right, #fff, #bbb);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }

	.filter-chips {
		display: flex;
		gap: 8px;
	}

	.chip {
		padding: 8px 16px;
		background: var(--chip);
		border: 1px solid var(--stroke);
		border-radius: 999px;
		color: var(--muted);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.chip:hover {
		background: var(--chip-hover);
		color: var(--text);
        border-color: var(--stroke-strong);
	}

	.chip.active {
		background: var(--text);
		color: var(--bg0);
		border-color: var(--text);
        font-weight: 600;
	}
    
    /* Articles Container */
	.articles-container {
		flex: 1;
		overflow-y: auto;
		padding: 0 var(--page-padding) var(--page-padding);
		display: flex;
		flex-direction: column;
		gap: var(--gap);
        /* Add mask to fade bottom scroll */
        mask-image: linear-gradient(to bottom, black calc(100% - 40px), transparent 100%); 
	}

	.article-card {
		padding: 24px;
		transition: transform 0.2s, box-shadow 0.2s;
        display: flex;
        flex-direction: column;
        gap: 12px;
        border: 1px solid var(--stroke); /* Ensure border exists */
	}

	.article-card:hover {
		transform: translateY(-2px);
        background: rgba(255, 255, 255, 0.04); /* Totally slightly lighter */
        border-color: var(--stroke-strong);
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
	}

	.article-card.unread {
		border-left: 3px solid var(--accent);
        background: rgba(34, 229, 153, 0.02); /* Very subtle tint */
	}

	.article-header {
		display: flex;
		align-items: flex-start;
		gap: 16px;
		margin-bottom: 4px;
	}

	.article-title {
		flex: 1;
		font-size: 18px;
		font-weight: 600;
		line-height: 1.4;
		margin: 0;
        font-family: var(--font-display);
        letter-spacing: -0.01em;
	}

	.article-card.unread .article-title {
		font-weight: 700;
        color: #fff;
	}
    
    .article-title a {
        color: inherit;
        text-decoration: none;
    }
    
    .article-title a:hover {
        color: var(--accent);
    }

	.article-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	.star-btn {
		width: 32px;
		height: 32px;
		background: transparent;
		border: 1px solid transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--muted);
		transition: all 0.2s;
		border-radius: 50%;
	}

	.star-btn:hover {
		background: var(--chip);
		color: var(--accent);
        border-color: var(--stroke);
	}

	.star-btn.starred {
		color: var(--accent);
        background: rgba(34, 229, 153, 0.1);
        border-color: rgba(34, 229, 153, 0.2);
	}

	.star-btn.starred:hover {
		background: rgba(34, 229, 153, 0.2);
        box-shadow: 0 0 12px rgba(34, 229, 153, 0.2);
	}

	.read-dot {
		width: 32px;
		height: 32px;
		background: transparent;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
        border-radius: 50%;
        transition: all 0.2s;
	}
    
    .read-dot:hover {
        background: var(--chip);
    }

	.read-dot .dot {
		width: 8px;
		height: 8px;
		background: var(--accent);
		border-radius: 50%;
		transition: all 0.2s;
        box-shadow: 0 0 8px var(--accent);
	}

	.read-dot.read .dot {
		width: 6px;
		height: 6px;
		background: var(--stroke-strong);
		opacity: 0.3;
        box-shadow: none;
	}

	.article-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--muted2);
		margin-bottom: 12px;
        font-family: var(--font-ui);
	}

	.meta-sep {
		color: var(--stroke);
        font-size: 10px;
	}

	.article-summary {
		font-size: 14px;
		line-height: 1.6;
		color: var(--muted);
		margin: 0 0 16px 0;
        font-weight: 400;
	}

	.article-thumbnail {
		border-radius: var(--radiusS);
		overflow: hidden;
		max-width: 100%;
        margin-top: 4px;
        border: 1px solid var(--stroke);
	}

	.article-thumbnail img {
		width: 100%;
        height: auto;
        max-height: 400px;
        object-fit: cover;
		display: block;
	}

	.empty-state {
		padding: 80px 20px;
		text-align: center;
		color: var(--muted2);
		font-size: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 16px;
	}

	.empty-state.error {
		color: #ff5252;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.app {
			flex-direction: column;
		}

		.sidebar {
            /* Mobile Drawer Style? Or simple fixed top? */
            /* Let's make it a bottom drawer or just keep it simple for now */
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: auto;
			max-height: 40vh; /* make it smaller */
			overflow-y: auto;
			z-index: 100;
            border-right: none;
            border-bottom: 1px solid var(--stroke);
            box-shadow: var(--shadow-lg);
		}

		.main-content {
			margin-top: 40vh; /* push content down */
		}
        
        .topbar-center {
            margin: 0 8px;
        }
        
        .search-box {
            padding: 0 12px;
        }
	}

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.85);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
        animation: fadeIn 0.2s ease;
	}

	.modal {
		width: 90%;
		max-width: 520px;
		max-height: 85vh;
		overflow-y: auto;
		padding: 0;
        background: var(--bg0);
        border: 1px solid var(--stroke);
        border-radius: var(--radiusL);
        box-shadow: 0 40px 80px rgba(0,0,0,0.8);
        animation: scaleIn 0.2s ease-out;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 24px;
		border-bottom: 1px solid var(--stroke);
	}

	.modal-header h2 {
		margin: 0;
		font-size: 20px;
		font-weight: 700;
		color: var(--text);
        font-family: var(--font-display);
        letter-spacing: -0.01em;
	}

	.close-btn {
		width: 36px;
		height: 36px;
		background: transparent;
		border: 1px solid var(--stroke);
		color: var(--muted);
		font-size: 24px;
		line-height: 1;
		cursor: pointer;
		transition: all 0.2s;
		border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
	}

	.close-btn:hover {
		background: var(--chip-hover);
		color: var(--text);
        border-color: var(--stroke-strong);
        transform: rotate(90deg);
	}

	.modal-body {
		padding: 32px 24px;
	}

	.settings-section {
		margin-bottom: 32px;
	}

	.settings-section h3 {
		margin: 0 0 16px 0;
		font-size: 13px;
		font-weight: 700;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.settings-actions {
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
	}

	.settings-btn {
		flex: 1;
		min-width: 140px;
		padding: 14px 20px;
		background: var(--panel1);
		border: 1px solid var(--stroke);
		border-radius: 12px;
		color: var(--text);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		transition: all 0.2s;
	}

	.settings-btn:hover {
		background: var(--chip);
		border-color: var(--accent);
		color: var(--accent);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
	}

	.settings-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
        transform: none;
	}

	.import-results {
		margin-top: 24px;
		padding: 20px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid var(--stroke);
		border-radius: var(--radiusM);
	}

	.results-summary {
		display: flex;
		gap: 20px;
		flex-wrap: wrap;
		margin-bottom: 16px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--stroke);
	}

	.result-item {
		font-size: 14px;
        font-weight: 500;
		color: var(--muted);
	}

	.result-item.success {
		color: var(--accent);
	}

	.result-item.error {
		color: #ff6b6b;
	}

	.failed-feeds {
		margin-top: 16px;
	}

	.failed-feeds h4 {
		margin: 0 0 12px 0;
		font-size: 12px;
		font-weight: 700;
		color: var(--muted);
		text-transform: uppercase;
        letter-spacing: 0.05em;
	}

	.failed-item {
		padding: 12px;
		margin-bottom: 8px;
		background: rgba(0,0,0,0.3);
		border-radius: 8px;
        border: 1px solid var(--stroke);
	}

	.failed-url {
		font-size: 13px;
		color: var(--text);
		word-break: break-all;
		margin-bottom: 6px;
        font-family: monospace;
	}

	.failed-error {
		font-size: 12px;
		color: #ff6b6b;
	}
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    @keyframes scaleIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
    }
</style>
