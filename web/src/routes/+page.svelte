<script lang="ts">
	let feedUrls = '';
	let loading = false;
	let error: string | null = null;
	let results: any[] = [];
	let healthData: any = null;
	let healthLoading = false;
	let healthError: string | null = null;

	// Preset feed examples
	const presets = {
		rss: 'https://hnrss.org/frontpage',
		youtube: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCXuqSBlHAE6Xw-yeJA0Tunw',
		reddit: 'https://www.reddit.com/r/selfhosted/.rss'
	};

	function loadPreset(type: 'rss' | 'youtube' | 'reddit') {
		feedUrls = presets[type];
	}

	function loadAllPresets() {
		feedUrls = Object.values(presets).join('\n');
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

	$: totalNew = results.reduce((sum, r) => sum + (r.newItems || 0), 0);
	$: totalParsed = results.reduce((sum, r) => sum + (r.totalItemsParsed || 0), 0);
	$: successCount = results.filter(r => r.status === 200 || r.status === 304).length;
	$: errorCount = results.filter(r => r.error).length;
	$: youtubeCount = results.filter(r => r.kind === 'youtube').length;
	$: redditCount = results.filter(r => r.kind === 'reddit').length;
	$: genericCount = results.filter(r => r.kind === 'generic').length;
</script>

<svelte:head>
	<title>FeedStream - Private feed reader</title>
</svelte:head>

<main>
	<div class="container">
		<h1>FeedStream</h1>
		<p class="subtitle">Private feed reader</p>

		<div class="section">
			<h2>Feed URLs</h2>
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
				rows="6"
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
								{#if result.totalItemsParsed !== undefined}
									<div class="detail-row">
										<span class="label">Parsed:</span>
										<span class="value">{result.totalItemsParsed}</span>
									</div>
								{/if}
								{#if result.totalItemsStored !== undefined}
									<div class="detail-row">
										<span class="label">Total stored:</span>
										<span class="value">{result.totalItemsStored}</span>
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
		margin-bottom: 2rem;
	}

	h2 {
		font-size: 1.5rem;
		margin: 0 0 0.5rem 0;
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
</style>
