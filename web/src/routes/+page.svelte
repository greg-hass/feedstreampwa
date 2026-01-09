<script lang="ts">
	import { onMount } from 'svelte';

	// Feed refresh state
	let feedUrls = '';
	let loading = false;
	let error: string | null = null;
	let results: any[] = [];

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

	// Preset feed examples
	const presets = {
		rss: 'https://hnrss.org/frontpage',
		youtube: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCXuqSBlHAE6Xw-yeJA0Tunw',
		reddit: 'https://www.reddit.com/r/selfhosted/.rss'
	};

	onMount(() => {
		loadItems();
	});

	function loadPreset(type: 'rss' | 'youtube' | 'reddit') {
		feedUrls = presets[type];
	}

	function loadAllPresets() {
		feedUrls = Object.values(presets).join('\n');
	}

	async function loadItems() {
		itemsLoading = true;
		itemsError = null;

		try {
			const params = new URLSearchParams({
				limit: '100',
				offset: '0'
			});

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
			items = [...items]; // Trigger reactivity
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to update read status');
		}
	}

	async function refreshFeeds() {
		loading = true;
		error = null;
		results = [];

		try {
			// Parse URLs from textarea (one per line)
			const urls = feedUrls
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
			results = data.results || [];

			// Reload items after successful refresh
			await loadItems();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error occurred';
		} finally {
			loading = false;
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

	// Reactive stats
	$: totalNew = results.reduce((sum, r) => sum + (r.newItems || 0), 0);
	$: totalParsed = results.reduce((sum, r) => sum + (r.totalItemsParsed || 0), 0);
	$: successCount = results.filter(r => r.status === 200 || r.status === 304).length;
	$: errorCount = results.filter(r => r.error).length;
	$: youtubeCount = results.filter(r => r.kind === 'youtube').length;
	$: redditCount = results.filter(r => r.kind === 'reddit').length;
	$: genericCount = results.filter(r => r.kind === 'generic').length;
	$: unreadCount = items.filter(i => i.is_read === 0).length;

	// Reload items when filters change
	$: if (sourceFilter || unreadOnly !== undefined) {
		loadItems();
	}
</script>

<svelte:head>
	<title>FeedStream - Private feed reader</title>
</svelte:head>

<main>
	<div class="container">
		<h1>FeedStream</h1>
		<p class="subtitle">Private feed reader</p>

		<!-- Feed Refresh Section -->
		<div class="section">
			<h2>📥 Refresh Feeds</h2>
			<p class="help-text">Enter feed URLs (one per line) or use presets:</p>
			
			<div class="preset-buttons">
				<button on:click={() => loadPreset('rss')} class="preset-btn rss">
					📰 RSS Example
				</button>
				<button on:click={() => loadPreset('youtube')} class="preset-btn youtube">
					▶️ YouTube Example
				</button>
				<button on:click={() => loadPreset('reddit')} class="preset-btn reddit">
					🔗 Reddit Example
				</button>
				<button on:click={loadAllPresets} class="preset-btn all">
					📚 All Examples
				</button>
			</div>

			<textarea
				bind:value={feedUrls}
				placeholder="https://hnrss.org/frontpage&#10;https://www.youtube.com/feeds/videos.xml?channel_id=...&#10;https://www.reddit.com/r/selfhosted/.rss"
				rows="4"
			/>

			<div class="button-group">
				<button on:click={refreshFeeds} disabled={loading} class="primary-btn">
					{loading ? 'Refreshing...' : 'Refresh feeds'}
				</button>
				<button on:click={checkHealth} disabled={healthLoading} class="secondary-btn">
					{healthLoading ? 'Checking...' : 'Health check'}
				</button>
			</div>
		</div>

		{#if error}
			<div class="error-box">
				<strong>Error:</strong> {error}
			</div>
		{/if}

		{#if healthError}
			<div class="error-box">
				<strong>Health Check Error:</strong> {healthError}
			</div>
		{/if}

		{#if healthData}
			<div class="result-box">
				<h3>Health Check Result</h3>
				<pre>{JSON.stringify(healthData, null, 2)}</pre>
			</div>
		{/if}

		{#if results.length > 0}
			<div class="results">
				<h2>Refresh Results</h2>
				<div class="stats">
					<div class="stat">
						<span class="stat-value">{results.length}</span>
						<span class="stat-label">Feeds</span>
					</div>
					<div class="stat">
						<span class="stat-value">{successCount}</span>
						<span class="stat-label">Success</span>
					</div>
					<div class="stat">
						<span class="stat-value">{errorCount}</span>
						<span class="stat-label">Errors</span>
					</div>
					<div class="stat">
						<span class="stat-value">{totalNew}</span>
						<span class="stat-label">New Items</span>
					</div>
					<div class="stat">
						<span class="stat-value">{totalParsed}</span>
						<span class="stat-label">Total Parsed</span>
					</div>
				</div>

				<div class="kind-stats">
					{#if youtubeCount > 0}
						<span class="kind-stat youtube">▶️ YouTube: {youtubeCount}</span>
					{/if}
					{#if redditCount > 0}
						<span class="kind-stat reddit">🔗 Reddit: {redditCount}</span>
					{/if}
					{#if genericCount > 0}
						<span class="kind-stat generic">📰 RSS: {genericCount}</span>
					{/if}
				</div>

				<div class="result-list">
					{#each results as result}
						<div class="result-item" class:has-error={result.error}>
							<div class="result-header">
								<span class="kind-badge {result.kind}">
									{#if result.kind === 'youtube'}
										▶️ YouTube
									{:else if result.kind === 'reddit'}
										🔗 Reddit
									{:else}
										📰 RSS
									{/if}
								</span>
								<span class="status-badge" class:success={result.status === 200 || result.status === 304} class:error={result.error}>
									{result.status || 'ERR'}
								</span>
								<span class="feed-title">{result.title || result.url}</span>
							</div>
							<div class="result-details">
								<div class="detail-row">
									<span class="label">URL:</span>
									<span class="value url">{result.url}</span>
								</div>
								{#if result.newItems !== undefined}
									<div class="detail-row">
										<span class="label">New items:</span>
										<span class="value highlight">{result.newItems}</span>
									</div>
								{/if}
								{#if result.error}
									<div class="detail-row error-row">
										<span class="label">Error:</span>
										<span class="value">{result.error}</span>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Items List Section -->
		<div class="section items-section">
			<div class="section-header">
				<h2>📚 Items ({itemsTotal})</h2>
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
				<div class="error-box">
					<strong>Error:</strong> {itemsError}
				</div>
			{:else if items.length === 0}
				<div class="empty-box">
					No items found. Try refreshing some feeds first!
				</div>
			{:else}
				<div class="items-list">
					{#each items as item}
						<div class="item-card" class:unread={item.is_read === 0}>
							<div class="item-header">
								<span class="item-source-badge {item.source}">
									{#if item.source === 'youtube'}
										▶️
									{:else if item.source === 'reddit'}
										🔗
									{:else}
										📰
									{/if}
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
	main {
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
	}

	.container {
		width: 100%;
	}

	h1 {
		font-size: 3rem;
		margin: 0 0 0.5rem 0;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.subtitle {
		font-size: 1.25rem;
		color: #a0a0a0;
		margin: 0 0 2rem 0;
	}

	.section {
		margin-bottom: 3rem;
		padding: 1.5rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
	}

	.items-section {
		background: rgba(255, 255, 255, 0.05);
	}

	.section-header {
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

	h3 {
		font-size: 1.25rem;
		margin: 0 0 1rem 0;
		color: #667eea;
	}

	.help-text {
		font-size: 0.9rem;
		color: #a0a0a0;
		margin: 0 0 0.75rem 0;
	}

	.preset-buttons {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}

	.preset-btn {
		padding: 0.5rem 1rem;
		font-size: 0.9rem;
		font-weight: 600;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		transition: transform 0.2s, box-shadow 0.2s;
		background: rgba(255, 255, 255, 0.1);
		color: #e4e4e4;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.preset-btn:hover {
		transform: translateY(-2px);
		background: rgba(255, 255, 255, 0.15);
	}

	.preset-btn.rss {
		border-color: rgba(102, 126, 234, 0.4);
	}

	.preset-btn.youtube {
		border-color: rgba(255, 0, 0, 0.4);
	}

	.preset-btn.reddit {
		border-color: rgba(255, 69, 0, 0.4);
	}

	.preset-btn.all {
		border-color: rgba(118, 75, 162, 0.4);
	}

	textarea {
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

	textarea:focus {
		outline: none;
		border-color: #667eea;
	}

	.button-group {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.primary-btn, .secondary-btn {
		padding: 1rem 2rem;
		font-size: 1rem;
		font-weight: 600;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.primary-btn {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
	}

	.primary-btn:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
	}

	.secondary-btn {
		background: rgba(255, 255, 255, 0.1);
		color: #e4e4e4;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.secondary-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.15);
		transform: translateY(-2px);
	}

	.primary-btn:active:not(:disabled),
	.secondary-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.primary-btn:disabled,
	.secondary-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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
		padding: 2rem;
		text-align: center;
		color: #a0a0a0;
		font-size: 1.1rem;
	}

	.error-box {
		margin-top: 1rem;
		padding: 1rem;
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 8px;
		color: #fca5a5;
	}

	.result-box {
		margin-top: 2rem;
		padding: 1.5rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		backdrop-filter: blur(10px);
	}

	.result-box pre {
		margin: 0;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 8px;
		overflow-x: auto;
		font-family: 'Courier New', monospace;
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.results {
		margin-top: 2rem;
	}

	.stats {
		display: flex;
		gap: 1rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}

	.stat {
		flex: 1;
		min-width: 100px;
		padding: 1rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		text-align: center;
	}

	.stat-value {
		display: block;
		font-size: 2rem;
		font-weight: 700;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.stat-label {
		display: block;
		font-size: 0.85rem;
		color: #a0a0a0;
		margin-top: 0.25rem;
	}

	.kind-stats {
		display: flex;
		gap: 1rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	.kind-stat {
		padding: 0.5rem 1rem;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.kind-stat.youtube {
		background: rgba(255, 0, 0, 0.1);
		border: 1px solid rgba(255, 0, 0, 0.3);
		color: #ff6b6b;
	}

	.kind-stat.reddit {
		background: rgba(255, 69, 0, 0.1);
		border: 1px solid rgba(255, 69, 0, 0.3);
		color: #ff8c42;
	}

	.kind-stat.generic {
		background: rgba(102, 126, 234, 0.1);
		border: 1px solid rgba(102, 126, 234, 0.3);
		color: #8b9aff;
	}

	.result-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.result-item {
		padding: 1.5rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		backdrop-filter: blur(10px);
	}

	.result-item.has-error {
		border-color: rgba(239, 68, 68, 0.3);
		background: rgba(239, 68, 68, 0.05);
	}

	.result-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}

	.kind-badge {
		padding: 0.25rem 0.75rem;
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

	.status-badge {
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		font-size: 0.85rem;
		font-weight: 600;
		font-family: 'Courier New', monospace;
	}

	.status-badge.success {
		background: rgba(34, 197, 94, 0.2);
		color: #86efac;
		border: 1px solid rgba(34, 197, 94, 0.3);
	}

	.status-badge.error {
		background: rgba(239, 68, 68, 0.2);
		color: #fca5a5;
		border: 1px solid rgba(239, 68, 68, 0.3);
	}

	.feed-title {
		font-weight: 600;
		font-size: 1.1rem;
		flex: 1;
	}

	.result-details {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.detail-row {
		display: flex;
		gap: 0.5rem;
		font-size: 0.9rem;
	}

	.detail-row .label {
		color: #a0a0a0;
		min-width: 100px;
	}

	.detail-row .value {
		color: #e4e4e4;
		flex: 1;
	}

	.detail-row .value.url {
		font-family: 'Courier New', monospace;
		font-size: 0.85rem;
		word-break: break-all;
	}

	.detail-row .value.highlight {
		color: #86efac;
		font-weight: 600;
	}

	.detail-row.error-row .value {
		color: #fca5a5;
	}

	/* Items List Styles */
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
</style>
