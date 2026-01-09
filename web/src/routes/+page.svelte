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

	// Bulk refresh state
	let bulkFeedUrls = '';
	let bulkRefreshing = false;
	let bulkResults: any[] = [];
	let bulkError: string | null = null;
	let showBulkRefresh = false;

	// Items state
	let items: any[] = [];
	let itemsTotal = 0;
	let itemsLoading = false;
	let itemsError: string | null = null;
	let sourceFilter = 'all';
	let unreadOnly = false;

	// Health check state
	let healthData: any = null;
	let healthLoading = false;
	let healthError: string | null = null;

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
		bulkRefreshing = true;
		bulkError = null;
		bulkResults = [];

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

			const data = await response.json();
			bulkResults = data.results || [];

			await loadFeeds();
			await loadItems();
		} catch (err) {
			bulkError = err instanceof Error ? err.message : 'Unknown error occurred';
		} finally {
			bulkRefreshing = false;
		}
	}

	async function bulkRefresh() {
		bulkRefreshing = true;
		bulkError = null;
		bulkResults = [];

		try {
			const urls = bulkFeedUrls
				.split('\n')
				.map(url => url.trim())
				.filter(url => url.length > 0);

			if (urls.length === 0) {
				throw new Error('Please enter at least one feed URL');
			}

			const response = await fetch('/api/refresh', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ urls, force: false })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			bulkResults = data.results || [];

			await loadFeeds();
			await loadItems();
		} catch (err) {
			bulkError = err instanceof Error ? err.message : 'Unknown error occurred';
		} finally {
			bulkRefreshing = false;
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

	async function checkHealth() {
		healthLoading = true;
		healthError = null;
		healthData = null;

		try {
			const response = await fetch('/api/health');
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			healthData = await response.json();
		} catch (err) {
			healthError = err instanceof Error ? err.message : 'Unknown error occurred';
		} finally {
			healthLoading = false;
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
	$: unreadCount = items.filter(i => i.is_read === 0).length;
	$: totalUnread = feeds.reduce((sum, f) => sum + (f.unreadCount || 0), 0);

	// Reload items when filters change
	$: if (sourceFilter || unreadOnly !== undefined || selectedFeedUrl !== undefined) {
		loadItems();
	}
</script>

<svelte:head>
	<title>FeedStream - Private feed reader</title>
</svelte:head>

<main>
	<div class="app-container">
		<!-- Sidebar -->
		<aside class="sidebar">
			<h1>FeedStream</h1>
			
			<div class="add-feed-section">
				<input
					type="text"
					bind:value={newFeedUrl}
					placeholder="https://example.com/feed.xml"
					on:keydown={(e) => e.key === 'Enter' && addFeed()}
					disabled={addingFeed}
				/>
				<button on:click={addFeed} disabled={addingFeed} class="add-btn">
					{addingFeed ? '...' : '+'}
				</button>
			</div>

			<div class="actions">
				<button on:click={refreshAll} disabled={bulkRefreshing} class="refresh-all-btn">
					{bulkRefreshing ? 'Refreshing...' : '🔄 Refresh All'}
				</button>
				<button on:click={() => showBulkRefresh = !showBulkRefresh} class="advanced-btn">
					⚙️ Advanced
				</button>
			</div>

			{#if feedsLoading}
				<div class="loading">Loading feeds...</div>
			{:else if feedsError}
				<div class="error-text">{feedsError}</div>
			{:else}
				<div class="feeds-list">
					<button
						class="feed-item"
						class:active={selectedFeedUrl === null}
						on:click={() => selectFeed(null)}
					>
						<span class="feed-name">📚 All Feeds</span>
						{#if totalUnread > 0}
							<span class="unread-badge">{totalUnread}</span>
						{/if}
					</button>

					{#each feeds as feed}
						<div class="feed-item-wrapper">
							<button
								class="feed-item"
								class:active={selectedFeedUrl === feed.url}
								on:click={() => selectFeed(feed.url)}
							>
								<span class="feed-icon">
									{#if feed.kind === 'youtube'}
										▶️
									{:else if feed.kind === 'reddit'}
										🔗
									{:else}
										📰
									{/if}
								</span>
								<span class="feed-name">{feed.title || feed.url}</span>
								{#if feed.unreadCount > 0}
									<span class="unread-badge">{feed.unreadCount}</span>
								{/if}
							</button>
							<button class="delete-btn" on:click={() => deleteFeed(feed.url)} title="Delete feed">
								×
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</aside>

		<!-- Main Content -->
		<div class="main-content">
			{#if showBulkRefresh}
				<div class="bulk-refresh-section">
					<h2>Advanced: Bulk Refresh</h2>
					<textarea
						bind:value={bulkFeedUrls}
						placeholder="https://hnrss.org/frontpage&#10;https://www.youtube.com/feeds/videos.xml?channel_id=...&#10;https://www.reddit.com/r/selfhosted/.rss"
						rows="4"
					/>
					<button on:click={bulkRefresh} disabled={bulkRefreshing} class="primary-btn">
						{bulkRefreshing ? 'Refreshing...' : 'Bulk Refresh'}
					</button>
					{#if bulkError}
						<div class="error-box">{bulkError}</div>
					{/if}
					{#if bulkResults.length > 0}
						<div class="bulk-results">
							{#each bulkResults as result}
								<div class="bulk-result-item">
									<span class="kind-badge {result.kind}">
										{#if result.kind === 'youtube'}▶️{:else if result.kind === 'reddit'}🔗{:else}📰{/if}
									</span>
									<span>{result.title || result.url}</span>
									<span class="new-items">+{result.newItems}</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<div class="items-header">
				<h2>
					{#if selectedFeedUrl}
						{feeds.find(f => f.url === selectedFeedUrl)?.title || 'Feed'}
					{:else}
						All Items
					{/if}
					<span class="item-count">({itemsTotal})</span>
				</h2>
				<div class="filters">
					<label class="filter-label">
						<span>Source:</span>
						<select bind:value={sourceFilter} class="filter-select">
							<option value="all">All</option>
							<option value="generic">📰 RSS</option>
							<option value="youtube">▶️ YouTube</option>
							<option value="reddit">🔗 Reddit</option>
						</select>
					</label>
					<label class="filter-checkbox">
						<input type="checkbox" bind:checked={unreadOnly} />
						<span>Unread only ({unreadCount})</span>
					</label>
				</div>
			</div>

			{#if itemsLoading}
				<div class="loading-box">Loading items...</div>
			{:else if itemsError}
				<div class="error-box">{itemsError}</div>
			{:else if items.length === 0}
				<div class="empty-box">
					No items found. Try adding and refreshing some feeds!
				</div>
			{:else}
				<div class="items-list">
					{#each items as item}
						<div class="item-card" class:unread={item.is_read === 0}>
							<div class="item-header">
								<span class="item-source-badge {item.source}">
									{#if item.source === 'youtube'}▶️{:else if item.source === 'reddit'}🔗{:else}📰{/if}
								</span>
								<h3 class="item-title">
									{#if item.url}
										<a href={item.url} target="_blank" rel="noopener noreferrer">
											{item.title || 'Untitled'}
										</a>
									{:else}
										{item.title || 'Untitled'}
									{/if}
								</h3>
								<button 
									on:click={() => toggleRead(item)} 
									class="read-toggle"
									class:read={item.is_read === 1}
								>
									{item.is_read === 1 ? '✓ Read' : '○ Unread'}
								</button>
							</div>
							
							{#if item.author || item.published}
								<div class="item-meta">
									{#if item.author}
										<span class="meta-item">👤 {item.author}</span>
									{/if}
									{#if item.published}
										<span class="meta-item">📅 {formatDate(item.published)}</span>
									{/if}
								</div>
							{/if}

							{#if item.summary}
								<p class="item-summary">{item.summary}</p>
							{/if}

							{#if item.media_thumbnail}
								<div class="item-thumbnail">
									<img src={item.media_thumbnail} alt={item.title || 'Thumbnail'} />
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</main>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
		background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
		color: #e4e4e4;
		min-height: 100vh;
	}

	main {
		height: 100vh;
		overflow: hidden;
	}

	.app-container {
		display: flex;
		height: 100%;
	}

	/* Sidebar */
	.sidebar {
		width: 300px;
		background: rgba(0, 0, 0, 0.3);
		border-right: 1px solid rgba(255, 255, 255, 0.1);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	h1 {
		font-size: 1.5rem;
		margin: 0;
		padding: 1.5rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.add-feed-section {
		padding: 1rem;
		display: flex;
		gap: 0.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.add-feed-section input {
		flex: 1;
		padding: 0.75rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		color: #e4e4e4;
		font-size: 0.9rem;
	}

	.add-feed-section input:focus {
		outline: none;
		border-color: #667eea;
	}

	.add-btn {
		width: 40px;
		height: 40px;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		border: none;
		border-radius: 6px;
		color: white;
		font-size: 1.5rem;
		cursor: pointer;
		transition: transform 0.2s;
	}

	.add-btn:hover:not(:disabled) {
		transform: scale(1.05);
	}

	.add-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.actions {
		padding: 1rem;
		display: flex;
		gap: 0.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.refresh-all-btn, .advanced-btn {
		flex: 1;
		padding: 0.75rem;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 6px;
		color: #e4e4e4;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.refresh-all-btn:hover:not(:disabled),
	.advanced-btn:hover {
		background: rgba(255, 255, 255, 0.15);
		transform: translateY(-2px);
	}

	.refresh-all-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.feeds-list {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.feed-item-wrapper {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 0.25rem;
	}

	.feed-item {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		color: #e4e4e4;
		text-align: left;
		cursor: pointer;
		transition: all 0.2s;
	}

	.feed-item:hover {
		background: rgba(255, 255, 255, 0.1);
		transform: translateX(4px);
	}

	.feed-item.active {
		background: rgba(102, 126, 234, 0.2);
		border-color: rgba(102, 126, 234, 0.4);
	}

	.feed-icon {
		font-size: 1.2rem;
	}

	.feed-name {
		flex: 1;
		font-size: 0.9rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.unread-badge {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		padding: 0.25rem 0.5rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 700;
	}

	.delete-btn {
		width: 32px;
		height: 32px;
		background: rgba(239, 68, 68, 0.2);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 6px;
		color: #fca5a5;
		font-size: 1.5rem;
		line-height: 1;
		cursor: pointer;
		transition: all 0.2s;
		align-self: center;
	}

	.delete-btn:hover {
		background: rgba(239, 68, 68, 0.3);
		transform: scale(1.1);
	}

	.loading, .error-text {
		padding: 1rem;
		text-align: center;
		color: #a0a0a0;
		font-size: 0.9rem;
	}

	.error-text {
		color: #fca5a5;
	}

	/* Main Content */
	.main-content {
		flex: 1;
		overflow-y: auto;
		padding: 2rem;
	}

	.bulk-refresh-section {
		margin-bottom: 2rem;
		padding: 1.5rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
	}

	.bulk-refresh-section h2 {
		margin: 0 0 1rem 0;
		font-size: 1.25rem;
		color: #667eea;
	}

	.bulk-refresh-section textarea {
		width: 100%;
		padding: 1rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		color: #e4e4e4;
		font-family: 'Courier New', monospace;
		font-size: 0.9rem;
		resize: vertical;
		margin-bottom: 1rem;
	}

	.bulk-refresh-section textarea:focus {
		outline: none;
		border-color: #667eea;
	}

	.primary-btn {
		padding: 1rem 2rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		border: none;
		border-radius: 8px;
		color: white;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.primary-btn:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
	}

	.primary-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.bulk-results {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.bulk-result-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 6px;
		font-size: 0.9rem;
	}

	.new-items {
		margin-left: auto;
		color: #86efac;
		font-weight: 600;
	}

	.items-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
		gap: 1rem;
	}

	h2 {
		font-size: 1.5rem;
		margin: 0;
		color: #667eea;
	}

	.item-count {
		color: #a0a0a0;
		font-weight: normal;
	}

	.filters {
		display: flex;
		gap: 1.5rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.filter-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: #a0a0a0;
	}

	.filter-select {
		padding: 0.5rem 1rem;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 6px;
		color: #e4e4e4;
		font-size: 0.9rem;
		cursor: pointer;
	}

	.filter-select:focus {
		outline: none;
		border-color: #667eea;
	}

	.filter-checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: #a0a0a0;
		cursor: pointer;
	}

	.filter-checkbox input[type="checkbox"] {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}

	.loading-box, .empty-box {
		padding: 3rem;
		text-align: center;
		color: #a0a0a0;
		font-size: 1.1rem;
	}

	.error-box {
		padding: 1rem;
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 8px;
		color: #fca5a5;
		margin-top: 1rem;
	}

	/* Items List */
	.items-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.item-card {
		padding: 1.5rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.item-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.item-card.unread {
		border-color: rgba(102, 126, 234, 0.4);
		background: rgba(102, 126, 234, 0.05);
	}

	.item-header {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.item-source-badge {
		font-size: 1.2rem;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		flex-shrink: 0;
	}

	.item-source-badge.youtube {
		background: rgba(255, 0, 0, 0.1);
	}

	.item-source-badge.reddit {
		background: rgba(255, 69, 0, 0.1);
	}

	.item-source-badge.generic {
		background: rgba(102, 126, 234, 0.1);
	}

	.item-title {
		flex: 1;
		margin: 0;
		font-size: 1.1rem;
		line-height: 1.4;
	}

	.item-card.unread .item-title {
		font-weight: 700;
	}

	.item-title a {
		color: #e4e4e4;
		text-decoration: none;
		transition: color 0.2s;
	}

	.item-title a:hover {
		color: #667eea;
	}

	.read-toggle {
		padding: 0.4rem 0.8rem;
		font-size: 0.85rem;
		font-weight: 600;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s;
		background: rgba(255, 255, 255, 0.1);
		color: #e4e4e4;
		border: 1px solid rgba(255, 255, 255, 0.2);
		flex-shrink: 0;
	}

	.read-toggle:hover {
		background: rgba(255, 255, 255, 0.15);
		transform: scale(1.05);
	}

	.read-toggle.read {
		background: rgba(34, 197, 94, 0.2);
		border-color: rgba(34, 197, 94, 0.3);
		color: #86efac;
	}

	.item-meta {
		display: flex;
		gap: 1.5rem;
		margin-bottom: 0.75rem;
		flex-wrap: wrap;
	}

	.meta-item {
		font-size: 0.85rem;
		color: #a0a0a0;
	}

	.item-summary {
		margin: 0 0 0.75rem 0;
		color: #c0c0c0;
		line-height: 1.6;
		font-size: 0.95rem;
	}

	.item-thumbnail {
		margin-top: 0.75rem;
		border-radius: 8px;
		overflow: hidden;
		max-width: 400px;
	}

	.item-thumbnail img {
		width: 100%;
		height: auto;
		display: block;
	}

	.kind-badge {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.kind-badge.youtube {
		background: rgba(255, 0, 0, 0.2);
		color: #ff6b6b;
		border: 1px solid rgba(255, 0, 0, 0.3);
	}

	.kind-badge.reddit {
		background: rgba(255, 69, 0, 0.2);
		color: #ff8c42;
		border: 1px solid rgba(255, 69, 0, 0.3);
	}

	.kind-badge.generic {
		background: rgba(102, 126, 234, 0.2);
		color: #8b9aff;
		border: 1px solid rgba(102, 126, 234, 0.3);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.app-container {
			flex-direction: column;
		}

		.sidebar {
			width: 100%;
			max-height: 50vh;
		}

		.main-content {
			padding: 1rem;
		}
	}
</style>
