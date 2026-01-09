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
	let timeFilter = 'all'; // today, 24h, week, all

	// Search
	let searchQuery = '';

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
	$: if (sourceFilter || unreadOnly !== undefined || selectedFeedUrl !== undefined) {
		loadItems();
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
						<circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.5" fill="none"/>
						<path d="M12 12l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
					<input 
						type="text" 
						placeholder="Search articles…" 
						bind:value={searchQuery}
					/>
				</div>
			</div>

			<div class="topbar-right">
				<button class="icon-btn" on:click={refreshAll} title="Refresh all feeds">
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
						<path d="M17 10c0 3.866-3.134 7-7 7s-7-3.134-7-7 3.134-7 7-7c1.933 0 3.683.783 4.95 2.05" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						<path d="M17 6v4h-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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
		<div class="filters-row">
			<button class="chip" class:active={timeFilter === 'today'} on:click={() => timeFilter = 'today'}>
				Today
			</button>
			<button class="chip" class:active={timeFilter === '24h'} on:click={() => timeFilter = '24h'}>
				Last 24h
			</button>
			<button class="chip" class:active={timeFilter === 'week'} on:click={() => timeFilter = 'week'}>
				Week
			</button>
			<button class="chip" class:active={timeFilter === 'all'} on:click={() => timeFilter = 'all'}>
				All
			</button>
		</div>

		<!-- Articles List -->
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
							<button 
								class="read-dot" 
								class:read={item.is_read === 1}
								on:click={() => toggleRead(item)}
								title={item.is_read === 1 ? 'Mark as unread' : 'Mark as read'}
							>
								<span class="dot"></span>
							</button>
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
		padding: var(--page-padding);
		gap: var(--gap-lg);
		overflow-y: auto;
	}

	.sidebar-header {
		padding-bottom: var(--gap);
		border-bottom: 1px solid var(--stroke2);
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.logo-icon {
		width: 36px;
		height: 36px;
		background: var(--accent);
		border-radius: var(--radiusS);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--bg0);
	}

	.logo-text {
		font-size: 18px;
		font-weight: 600;
		color: var(--text);
	}

	.sidebar-nav {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.nav-item, .feed-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		background: transparent;
		border: none;
		border-radius: var(--radiusS);
		color: var(--muted);
		font-size: 14px;
		cursor: pointer;
		transition: all 0.2s;
		text-align: left;
		width: 100%;
	}

	.nav-item:hover, .feed-item:hover {
		background: var(--chip);
		color: var(--text);
	}

	.nav-item.active {
		background: rgba(24, 227, 138, 0.12);
		color: var(--accent);
	}

	.nav-item svg, .feed-item .feed-icon {
		flex-shrink: 0;
	}

	.nav-item span:first-of-type, .feed-name {
		flex: 1;
	}

	.badge {
		background: var(--accent);
		color: var(--bg0);
		padding: 2px 8px;
		border-radius: 10px;
		font-size: 11px;
		font-weight: 700;
	}

	.sidebar-section {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.section-header {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.08em;
		color: var(--muted2);
		padding: 8px 14px;
		text-transform: uppercase;
	}

	.feed-item {
		position: relative;
	}

	.feed-item.active {
		background: rgba(24, 227, 138, 0.12);
		color: var(--accent);
	}

	.delete-btn {
		opacity: 0;
		width: 20px;
		height: 20px;
		background: rgba(255, 82, 82, 0.2);
		border: none;
		border-radius: 4px;
		color: #ff5252;
		font-size: 16px;
		cursor: pointer;
		transition: opacity 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.feed-item:hover .delete-btn {
		opacity: 1;
	}

	/* Main Content */
	.main-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Top Bar */
	.topbar {
		height: var(--topbar-height);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--page-padding);
		margin: var(--page-padding);
		margin-bottom: 0;
	}

	.topbar-left, .topbar-right {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.logo-small {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
	}

	.logo-small .logo-icon {
		width: 28px;
		height: 28px;
	}

	.topbar-center {
		flex: 1;
		max-width: 600px;
		margin: 0 var(--page-padding);
	}

	.search-box {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 0 20px;
		height: 46px;
		background: var(--panel1);
		border: 1px solid var(--stroke2);
		border-radius: 999px;
		color: var(--muted);
	}

	.search-box input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text);
		font-size: 14px;
	}

	.search-box input::placeholder {
		color: var(--muted2);
	}

	.icon-btn {
		width: 40px;
		height: 40px;
		background: transparent;
		border: 1px solid var(--stroke2);
		border-radius: 50%;
		color: var(--muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.icon-btn:hover {
		background: var(--chip);
		color: var(--text);
		border-color: var(--stroke);
	}

	.add-btn {
		width: 44px;
		height: 44px;
		background: var(--accent);
		border: none;
		border-radius: 50%;
		color: var(--bg0);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
		box-shadow: var(--shadow2);
	}

	.add-btn:hover {
		transform: scale(1.05);
	}

	/* Filter Chips */
	.filters-row {
		display: flex;
		gap: 8px;
		padding: var(--gap-lg) var(--page-padding);
	}

	.chip {
		padding: 8px 18px;
		background: var(--chip);
		border: 1px solid var(--stroke2);
		border-radius: 999px;
		color: var(--muted);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.chip:hover {
		background: var(--panel1);
		color: var(--text);
	}

	.chip.active {
		background: var(--chipActive);
		color: var(--bg0);
		border-color: transparent;
	}

	/* Articles */
	.articles-container {
		flex: 1;
		overflow-y: auto;
		padding: 0 var(--page-padding) var(--page-padding);
		display: flex;
		flex-direction: column;
		gap: var(--gap);
	}

	.article-card {
		padding: 18px 20px;
		transition: transform 0.15s;
	}

	.article-card:hover {
		transform: translateY(-1px);
	}

	.article-card.unread {
		border-left: 3px solid var(--accent);
	}

	.article-header {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		margin-bottom: 8px;
	}

	.article-title {
		flex: 1;
		font-size: 15px;
		font-weight: 600;
		line-height: 1.5;
		margin: 0;
	}

	.article-card.unread .article-title {
		font-weight: 700;
	}

	.article-title a {
		color: var(--text);
		text-decoration: none;
		transition: color 0.2s;
	}

	.article-title a:hover {
		color: var(--accent);
	}

	.read-dot {
		width: 24px;
		height: 24px;
		background: transparent;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.read-dot .dot {
		width: 8px;
		height: 8px;
		background: var(--accent);
		border-radius: 50%;
		transition: all 0.2s;
	}

	.read-dot.read .dot {
		width: 6px;
		height: 6px;
		background: var(--stroke2);
		opacity: 0.5;
	}

	.article-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: var(--muted2);
		margin-bottom: 10px;
	}

	.meta-sep {
		color: var(--stroke2);
	}

	.article-summary {
		font-size: 13px;
		line-height: 1.6;
		color: var(--muted);
		margin: 0 0 12px 0;
	}

	.article-thumbnail {
		border-radius: var(--radiusS);
		overflow: hidden;
		max-width: 400px;
	}

	.article-thumbnail img {
		width: 100%;
		height: auto;
		display: block;
	}

	.empty-state {
		padding: 60px 20px;
		text-align: center;
		color: var(--muted2);
		font-size: 14px;
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
			width: 100%;
			max-height: 50vh;
		}

		.topbar-center {
			display: none;
		}
	}
</style>
