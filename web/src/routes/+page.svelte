<script lang="ts">
	let healthData: any = null;
	let loading = false;
	let error: string | null = null;

	async function checkHealth() {
		loading = true;
		error = null;
		healthData = null;

		try {
			const response = await fetch('/api/health');
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			healthData = await response.json();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error occurred';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>FeedStream - Private feed reader</title>
</svelte:head>

<main>
	<div class="container">
		<h1>FeedStream</h1>
		<p class="subtitle">Private feed reader</p>

		<button on:click={checkHealth} disabled={loading} class="health-btn">
			{loading ? 'Checking...' : 'Health check'}
		</button>

		{#if error}
			<div class="error">
				<strong>Error:</strong> {error}
			</div>
		{/if}

		{#if healthData}
			<div class="result">
				<h2>Health Check Result</h2>
				<pre>{JSON.stringify(healthData, null, 2)}</pre>
			</div>
		{/if}
	</div>
</main>

<style>
	main {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 100vh;
		padding: 2rem;
	}

	.container {
		max-width: 600px;
		width: 100%;
		text-align: center;
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

	.health-btn {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
		padding: 1rem 2rem;
		font-size: 1rem;
		font-weight: 600;
		border-radius: 8px;
		cursor: pointer;
		transition: transform 0.2s, box-shadow 0.2s;
		box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
	}

	.health-btn:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
	}

	.health-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.health-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error {
		margin-top: 2rem;
		padding: 1rem;
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 8px;
		color: #fca5a5;
	}

	.result {
		margin-top: 2rem;
		padding: 1.5rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		backdrop-filter: blur(10px);
		text-align: left;
	}

	.result h2 {
		margin: 0 0 1rem 0;
		font-size: 1.25rem;
		color: #667eea;
	}

	pre {
		margin: 0;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 8px;
		overflow-x: auto;
		font-family: 'Courier New', monospace;
		font-size: 0.9rem;
		line-height: 1.5;
	}
</style>
