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

	// Reader View state
	let showReader = false;
	let readerLoading = false;
	let readerError: string | null = null;
	let readerData: {
		url: string;
		title: string | null;
		byline: string | null;
		excerpt: string | null;
		siteName: string | null;
		imageUrl: string | null;
		contentHtml: string;
		fromCache: boolean;
	} | null = null;
	let readerCache: Map<string, typeof readerData> = new Map();
	let prefetchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	let currentItemUrl: string | null = null;

	// Add Feed modal state
	let showAddFeedModal = false;
	let addFeedTab: 'url' | 'search' | 'bulk' = 'url';
	let addFeedUrl = '';
	let addFeedBulkUrls = '';
	let addFeedError: string | null = null;
	let addFeedLoading = false;

	// Refresh toast state
	let showRefreshToast = false;
	let refreshJobId: string | null = null;
	let refreshCurrent = 0;
	let refreshTotal = 0;
	let refreshMessage = '';
	let refreshPollTimer: ReturnType<typeof setInterval> | null = null;

	// Folder state
	let folders: any[] = [];
	let foldersLoading = false;
	let foldersError: string | null = null;

	// View mode state
	type ViewMode = 'all' | 'unread' | 'smart' | 'folder' | 'feed';
	let viewMode: ViewMode = 'all';
	let activeSmartFolder: 'rss' | 'youtube' | 'reddit' | null = null;
	let activeFolderId: string | null = null;

	// Folder management modals
	let showCreateFolderModal = false;
	let showRenameFolderModal = false;
	let showDeleteFolderConfirm = false;
	let folderModalName = '';
	let folderModalLoading = false;
	let folderModalError: string | null = null;
	let selectedFolderForAction: any = null;

	// Feed folder popover
	let showFeedFolderPopover = false;
	let feedFolderPopoverFeed: any = null;
	let feedFolderPopoverPosition = { x: 0, y: 0 };
	let showCreateFolderInPopover = false;
	let newFolderNameInPopover = '';

	// Add Feed modal folder selection
	let selectedFolderIdsForNewFeed: string[] = [];

	onMount(() => {
		loadFeeds();
		loadFolders();
		loadItems();

		// ESC key to close reader and modals
		const handleKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				if (showReader) {
					closeReader();
				} else if (showAddFeedModal) {
					closeAddFeedModal();
				} else if (showSettings) {
					showSettings = false;
				} else if (showCreateFolderModal) {
					showCreateFolderModal = false;
					folderModalName = '';
					folderModalError = null;
				} else if (showRenameFolderModal) {
					showRenameFolderModal = false;
					folderModalName = '';
					folderModalError = null;
				} else if (showDeleteFolderConfirm) {
					showDeleteFolderConfirm = false;
				} else if (showFeedFolderPopover) {
					showFeedFolderPopover = false;
					showCreateFolderInPopover = false;
					newFolderNameInPopover = '';
				}
			}
		};
		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});

	// Process links in reader content after render for safety
	$: if (showReader && readerData && typeof document !== 'undefined') {
		setTimeout(() => {
			const container = document.getElementById('reader-body-content');
			if (container) {
				container.querySelectorAll('a').forEach((link: HTMLAnchorElement) => {
					link.target = '_blank';
					link.rel = 'noopener noreferrer';
				});
			}
		}, 0);
	}

	// Compute unread counts for smart folders
	$: totalUnread = feeds.reduce((sum, feed) => sum + (feed.unreadCount || 0), 0);
	$: rssUnread = feeds.filter(f => f.smartFolder === 'rss').reduce((sum, feed) => sum + (feed.unreadCount || 0), 0);
	$: youtubeUnread = feeds.filter(f => f.smartFolder === 'youtube').reduce((sum, feed) => sum + (feed.unreadCount || 0), 0);
	$: redditUnread = feeds.filter(f => f.smartFolder === 'reddit').reduce((sum, feed) => sum + (feed.unreadCount || 0), 0);

	// Compute unread counts for custom folders
	$: folderUnreadCounts = folders.reduce((acc, folder) => {
		const unread = feeds
			.filter(f => f.folders && f.folders.includes(folder.id))
			.reduce((sum, feed) => sum + (feed.unreadCount || 0), 0);
		acc[folder.id] = unread;
		return acc;
	}, {} as Record<string, number>);

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

	async function loadFolders() {
		foldersLoading = true;
		foldersError = null;

		try {
			const response = await fetch('/api/folders');
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			folders = data.folders || [];
		} catch (err) {
			foldersError = err instanceof Error ? err.message : 'Unknown error occurred';
		} finally {
			foldersLoading = false;
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

			// View mode filtering
			if (viewMode === 'feed' && selectedFeedUrl) {
				params.set('feed', selectedFeedUrl);
			} else if (viewMode === 'smart' && activeSmartFolder) {
				params.set('smartFolder', activeSmartFolder);
			} else if (viewMode === 'folder' && activeFolderId) {
				params.set('folderId', activeFolderId);
			} else if (viewMode === 'unread') {
				params.set('unreadOnly', 'true');
			}
			// viewMode === 'all' requires no special params

			// Legacy filters (keep for compatibility)
			if (sourceFilter !== 'all') {
				params.set('source', sourceFilter);
			}

			if (unreadOnly && viewMode !== 'unread') {
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

	// Reader View functions
	async function fetchReaderContent(url: string): Promise<typeof readerData> {
		const response = await fetch(`/api/reader?url=${encodeURIComponent(url)}`);
		const data = await response.json();
		if (!data.ok) {
			throw new Error(data.error || 'Failed to load reader content');
		}
		return {
			url: data.url,
			title: data.title,
			byline: data.byline,
			excerpt: data.excerpt,
			siteName: data.siteName,
			imageUrl: data.imageUrl,
			contentHtml: data.contentHtml,
			fromCache: data.fromCache
		};
	}

	async function openReader(item: any) {
		if (!item.url) return;
		
		currentItemUrl = item.url;
		showReader = true;
		readerError = null;
		
		// Check local cache first
		const cached = readerCache.get(item.url);
		if (cached) {
			readerData = cached;
			readerLoading = false;
			return;
		}
		
		readerLoading = true;
		readerData = null;
		
		try {
			const data = await fetchReaderContent(item.url);
			readerData = data;
			readerCache.set(item.url, data);
		} catch (err) {
			readerError = err instanceof Error ? err.message : 'Failed to load reader';
		} finally {
			readerLoading = false;
		}
	}

	function prefetchReader(url: string) {
		if (!url || readerCache.has(url)) return;
		
		if (prefetchDebounceTimer) {
			clearTimeout(prefetchDebounceTimer);
		}
		
		prefetchDebounceTimer = setTimeout(async () => {
			try {
				const data = await fetchReaderContent(url);
				readerCache.set(url, data);
			} catch {
				// Silently fail prefetch
			}
		}, 400);
	}

	function closeReader() {
		showReader = false;
		readerData = null;
		readerError = null;
		currentItemUrl = null;
	}

	function handleArticleClick(event: MouseEvent, item: any) {
		// Don't open reader if clicking on a link or button
		const target = event.target as HTMLElement;
		if (target.tagName === 'A' || target.tagName === 'BUTTON' || target.closest('a') || target.closest('button')) {
			return;
		}
		openReader(item);
	}

	function handleArticleMouseEnter(item: any) {
		if (item.url) {
			prefetchReader(item.url);
		}
	}

	// Add Feed modal functions
	function openAddFeedModal() {
		showAddFeedModal = true;
		addFeedTab = 'url';
		addFeedUrl = '';
		addFeedBulkUrls = '';
		addFeedError = null;
	}

	function closeAddFeedModal() {
		showAddFeedModal = false;
		addFeedUrl = '';
		addFeedBulkUrls = '';
		addFeedError = null;
		addFeedLoading = false;
		selectedFolderIdsForNewFeed = [];
	}

	function validateFeedUrl(url: string): boolean {
		if (!url.trim()) return false;
		// Basic validation: must contain a dot or start with http
		return url.includes('.') || url.startsWith('http://') || url.startsWith('https://');
	}

	async function submitAddFeed() {
		if (addFeedTab === 'url') {
			await submitSingleFeed();
		} else if (addFeedTab === 'bulk') {
			await submitBulkFeeds();
		}
	}

	async function submitSingleFeed() {
		if (!validateFeedUrl(addFeedUrl)) {
			addFeedError = 'Please enter a valid URL';
			return;
		}

		addFeedLoading = true;
		addFeedError = null;

		try {
			const response = await fetch('/api/feeds', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					url: addFeedUrl.trim(), 
					refresh: true,
					folderIds: selectedFolderIdsForNewFeed
				})
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || `HTTP ${response.status}`);
			}

			closeAddFeedModal();
			await loadFeeds();
			await loadFolders();
			await loadItems();
		} catch (err) {
			addFeedError = err instanceof Error ? err.message : 'Failed to add feed';
		} finally {
			addFeedLoading = false;
		}
	}

	async function submitBulkFeeds() {
		const urls = addFeedBulkUrls
			.split('\n')
			.map(u => u.trim())
			.filter(u => u.length > 0);

		if (urls.length === 0) {
			addFeedError = 'Please enter at least one URL';
			return;
		}

		addFeedLoading = true;
		addFeedError = null;

		let added = 0;
		let skipped = 0;
		let failed = 0;

		for (const url of urls) {
			try {
				const response = await fetch('/api/feeds', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ 
						url, 
						refresh: false,
						folderIds: selectedFolderIdsForNewFeed
					})
				});

				if (response.ok) {
					added++;
				} else {
					const data = await response.json();
					if (data.error?.includes('already exists')) {
						skipped++;
					} else {
						failed++;
					}
				}
			} catch {
				failed++;
			}
		}

		addFeedLoading = false;
		addFeedError = `Added: ${added}, Skipped: ${skipped}, Failed: ${failed}`;

		if (added > 0) {
			await loadFeeds();
			await loadFolders();
			await loadItems();
		}
	}

	// Refresh toast functions
	async function startRefresh() {
		try {
			const response = await fetch('/api/refresh/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to start refresh');
			}

			refreshJobId = data.jobId;
			showRefreshToast = true;
			refreshCurrent = 0;
			refreshTotal = 0;
			refreshMessage = 'Starting refresh...';

			// Start polling
			pollRefreshStatus();
		} catch (err) {
			console.error('Failed to start refresh:', err);
		}
	}

	async function pollRefreshStatus() {
		if (!refreshJobId) return;

		if (refreshPollTimer) {
			clearInterval(refreshPollTimer);
		}

		refreshPollTimer = setInterval(async () => {
			if (!refreshJobId) {
				stopRefreshPolling();
				return;
			}

			try {
				const response = await fetch(`/api/refresh/status?jobId=${encodeURIComponent(refreshJobId)}`);
				const data = await response.json();

				if (!response.ok) {
					stopRefreshPolling();
					return;
				}

				refreshCurrent = data.current;
				refreshTotal = data.total;
				refreshMessage = data.message || '';

				if (data.status === 'done' || data.status === 'error') {
					stopRefreshPolling();
					// Refresh feeds and items
					await loadFeeds();
					await loadItems();
					// Auto-hide toast after 2 seconds
					setTimeout(() => {
						showRefreshToast = false;
					}, 2000);
				}
			} catch (err) {
				console.error('Failed to poll refresh status:', err);
				stopRefreshPolling();
			}
		}, 500);
	}

	function stopRefreshPolling() {
		if (refreshPollTimer) {
			clearInterval(refreshPollTimer);
			refreshPollTimer = null;
		}
	}

	function dismissRefreshToast() {
		showRefreshToast = false;
		stopRefreshPolling();
	}

	// View switching functions
	function setViewAll() {
		viewMode = 'all';
		activeSmartFolder = null;
		activeFolderId = null;
		selectedFeedUrl = null;
		loadItems();
	}

	function setViewUnread() {
		viewMode = 'unread';
		activeSmartFolder = null;
		activeFolderId = null;
		selectedFeedUrl = null;
		loadItems();
	}

	function setViewSmartFolder(folder: 'rss' | 'youtube' | 'reddit') {
		viewMode = 'smart';
		activeSmartFolder = folder;
		activeFolderId = null;
		selectedFeedUrl = null;
		loadItems();
	}

	function setViewFolder(folderId: string) {
		viewMode = 'folder';
		activeSmartFolder = null;
		activeFolderId = folderId;
		selectedFeedUrl = null;
		loadItems();
	}

	function setViewFeed(feedUrl: string) {
		viewMode = 'feed';
		activeSmartFolder = null;
		activeFolderId = null;
		selectedFeedUrl = feedUrl;
		loadItems();
	}

	// Folder management functions
	async function createFolder() {
		const name = folderModalName.trim();
		if (!name || name.length < 1 || name.length > 60) {
			folderModalError = 'Folder name must be between 1 and 60 characters';
			return;
		}

		folderModalLoading = true;
		folderModalError = null;

		try {
			const response = await fetch('/api/folders', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || `HTTP ${response.status}`);
			}

			showCreateFolderModal = false;
			folderModalName = '';
			await loadFolders();
			await loadFeeds();
		} catch (err) {
			folderModalError = err instanceof Error ? err.message : 'Failed to create folder';
		} finally {
			folderModalLoading = false;
		}
	}

	async function renameFolder() {
		const name = folderModalName.trim();
		if (!name || name.length < 1 || name.length > 60) {
			folderModalError = 'Folder name must be between 1 and 60 characters';
			return;
		}

		if (!selectedFolderForAction) return;

		folderModalLoading = true;
		folderModalError = null;

		try {
			const response = await fetch(`/api/folders/${selectedFolderForAction.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || `HTTP ${response.status}`);
			}

			showRenameFolderModal = false;
			folderModalName = '';
			selectedFolderForAction = null;
			await loadFolders();
		} catch (err) {
			folderModalError = err instanceof Error ? err.message : 'Failed to rename folder';
		} finally {
			folderModalLoading = false;
		}
	}

	async function deleteFolder() {
		if (!selectedFolderForAction) return;

		try {
			const response = await fetch(`/api/folders/${selectedFolderForAction.id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || `HTTP ${response.status}`);
			}

			showDeleteFolderConfirm = false;
			
			// If we're viewing the deleted folder, switch to All
			if (viewMode === 'folder' && activeFolderId === selectedFolderForAction.id) {
				setViewAll();
			}

			selectedFolderForAction = null;
			await loadFolders();
			await loadFeeds();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to delete folder');
		}
	}

	async function toggleFeedInFolder(folderId: string, feedUrl: string, currentlyInFolder: boolean) {
		try {
			if (currentlyInFolder) {
				// Remove from folder
				const response = await fetch(`/api/folders/${folderId}/feeds`, {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ feedUrl })
				});

				if (!response.ok) {
					throw new Error('Failed to remove feed from folder');
				}

				// Update local state
				const feed = feeds.find(f => f.url === feedUrl);
				if (feed) {
					feed.folders = feed.folders.filter((id: string) => id !== folderId);
				}
			} else {
				// Add to folder
				const response = await fetch(`/api/folders/${folderId}/feeds`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ feedUrl })
				});

				if (!response.ok) {
					throw new Error('Failed to add feed to folder');
				}

				// Update local state
				const feed = feeds.find(f => f.url === feedUrl);
				if (feed) {
					if (!feed.folders) feed.folders = [];
					feed.folders.push(folderId);
				}
			}

			// Trigger reactivity
			feeds = [...feeds];
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to update folder');
			// Reload to get correct state
			await loadFeeds();
		}
	}

	async function createFolderInPopover() {
		const name = newFolderNameInPopover.trim();
		if (!name || !feedFolderPopoverFeed) return;

		try {
			const response = await fetch('/api/folders', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to create folder');
			}

			// Add feed to new folder
			await toggleFeedInFolder(data.folder.id, feedFolderPopoverFeed.url, false);
			
			newFolderNameInPopover = '';
			showCreateFolderInPopover = false;
			await loadFolders();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to create folder');
		}
	}

	function openFeedFolderPopover(feed: any, event: MouseEvent) {
		event.stopPropagation();
		feedFolderPopoverFeed = feed;
		const button = event.currentTarget as HTMLElement;
		const rect = button.getBoundingClientRect();
		feedFolderPopoverPosition = {
			x: rect.left,
			y: rect.bottom + 4
		};
		showFeedFolderPopover = true;
	}

	function closeFeedFolderPopover() {
		showFeedFolderPopover = false;
		showCreateFolderInPopover = false;
		newFolderNameInPopover = '';
		feedFolderPopoverFeed = null;
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
			<!-- Smart Folders Section -->
			<div class="nav-section-label">SMART FOLDERS</div>
			
			<button 
				class="nav-item" 
				class:active={viewMode === 'all'}
				on:click={setViewAll}
			>
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
					<rect x="2" y="2" width="6" height="6" rx="1" fill="currentColor"/>
					<rect x="10" y="2" width="6" height="6" rx="1" fill="currentColor"/>
					<rect x="2" y="10" width="6" height="6" rx="1" fill="currentColor"/>
					<rect x="10" y="10" width="6" height="6" rx="1" fill="currentColor"/>
				</svg>
				<span>All</span>
				{#if totalUnread > 0}
					<span class="badge">{totalUnread}</span>
				{/if}
			</button>

			<button 
				class="nav-item" 
				class:active={viewMode === 'unread'}
				on:click={setViewUnread}
			>
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
					<circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="2" fill="none"/>
					<circle cx="9" cy="9" r="3" fill="currentColor"/>
				</svg>
				<span>Unread</span>
				{#if totalUnread > 0}
					<span class="badge">{totalUnread}</span>
				{/if}
			</button>

			<button 
				class="nav-item smart-folder" 
				class:active={viewMode === 'smart' && activeSmartFolder === 'rss'}
				on:click={() => setViewSmartFolder('rss')}
			>
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
					<circle cx="3" cy="15" r="2" fill="currentColor"/>
					<path d="M3 9a6 6 0 016 6M3 3a12 12 0 0112 12" stroke="currentColor" stroke-width="2" fill="none"/>
				</svg>
				<span>RSS</span>
				{#if rssUnread > 0}
					<span class="badge">{rssUnread}</span>
				{/if}
			</button>

			<button 
				class="nav-item smart-folder" 
				class:active={viewMode === 'smart' && activeSmartFolder === 'youtube'}
				on:click={() => setViewSmartFolder('youtube')}
			>
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
					<path d="M17 6s0-2-2-2H3c-2 0-2 2-2 2v6s0 2 2 2h12c2 0 2-2 2-2V6z" stroke="currentColor" stroke-width="1.5" fill="none"/>
					<path d="M7 5l5 4-5 4V5z" fill="currentColor"/>
				</svg>
				<span>YouTube</span>
				{#if youtubeUnread > 0}
					<span class="badge">{youtubeUnread}</span>
				{/if}
			</button>

			<button 
				class="nav-item smart-folder" 
				class:active={viewMode === 'smart' && activeSmartFolder === 'reddit'}
				on:click={() => setViewSmartFolder('reddit')}
			>
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
					<circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.5" fill="none"/>
					<circle cx="6" cy="8" r="1" fill="currentColor"/>
					<circle cx="12" cy="8" r="1" fill="currentColor"/>
					<path d="M6 11c.5 1 1.5 1.5 3 1.5s2.5-.5 3-1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
				</svg>
				<span>Reddit</span>
				{#if redditUnread > 0}
					<span class="badge">{redditUnread}</span>
				{/if}
			</button>

			<!-- Custom Folders Section -->
			<div class="nav-section-header">
				<div class="nav-section-label">FOLDERS</div>
				<button 
					class="add-folder-btn" 
					on:click={() => {
						showCreateFolderModal = true;
						folderModalName = '';
						folderModalError = null;
					}}
					title="New folder"
				>
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
						<path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
				</button>
			</div>

			{#if foldersLoading}
				<div class="nav-item-loading">Loading folders...</div>
			{:else if folders.length === 0}
				<div class="nav-item-empty">No folders yet</div>
			{:else}
				{#each folders as folder}
					<div class="folder-item-wrapper">
						<button 
							class="nav-item folder-item" 
							class:active={viewMode === 'folder' && activeFolderId === folder.id}
							on:click={() => setViewFolder(folder.id)}
						>
							<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
								<path d="M2 4h5l1 2h8v10H2V4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
							</svg>
							<span class="folder-name">{folder.name}</span>
							<div class="folder-meta">
								{#if folderUnreadCounts[folder.id] > 0}
									<span class="badge">{folderUnreadCounts[folder.id]}</span>
								{/if}
								<span class="feed-count">{folder.feedCount}</span>
							</div>
						</button>
						<button 
							class="folder-actions-btn"
							on:click={(e) => {
								e.stopPropagation();
								selectedFolderForAction = folder;
							}}
						>
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
								<circle cx="8" cy="3" r="1.5" fill="currentColor"/>
								<circle cx="8" cy="8" r="1.5" fill="currentColor"/>
								<circle cx="8" cy="13" r="1.5" fill="currentColor"/>
							</svg>
							{#if selectedFolderForAction?.id === folder.id}
								<div class="folder-actions-menu" on:click|stopPropagation>
									<button 
										class="menu-item"
										on:click={() => {
											folderModalName = folder.name;
											folderModalError = null;
											showRenameFolderModal = true;
											selectedFolderForAction = folder;
										}}
									>
										<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
											<path d="M10 1l3 3-7 7H3v-3l7-7z" stroke="currentColor" stroke-width="1.5" fill="none"/>
										</svg>
										Rename
									</button>
									<button 
										class="menu-item danger"
										on:click={() => {
											showDeleteFolderConfirm = true;
											selectedFolderForAction = folder;
										}}
									>
										<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
											<path d="M2 4h10M5 4V2h4v2M4 4v8h6V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
										</svg>
										Delete
									</button>
								</div>
							{/if}
						</button>
					</div>
				{/each}
			{/if}

			<!-- Feeds Section -->
			<div class="nav-section-label" style="margin-top: 20px;">FEEDS</div>
			{#each feeds as feed}
				<button 
					class="feed-item" 
					class:active={viewMode === 'feed' && selectedFeedUrl === feed.url}
					on:click={() => setViewFeed(feed.url)}
				>
					<div class="feed-item-content">
						<span class="feed-title">{feed.title || feed.url}</span>
						{#if feed.unreadCount > 0}
							<span class="badge">{feed.unreadCount}</span>
						{/if}
					</div>
					<button 
						class="feed-folder-btn"
						on:click={(e) => openFeedFolderPopover(feed, e)}
						title="Add to folder"
					>
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
							<path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						</svg>
					</button>
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
				<button class="icon-btn" on:click={startRefresh} title="Refresh all feeds">
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
				<button class="add-btn" on:click={openAddFeedModal}>
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
					<article 
						class="article-card glass-panel-light" 
						class:unread={item.is_read === 0}
						on:click={(e) => handleArticleClick(e, item)}
						on:mouseenter={() => handleArticleMouseEnter(item)}
						role="button"
						tabindex="0"
					>
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

	<!-- Reader View Overlay -->
	{#if showReader}
		<div class="reader-overlay" on:click={closeReader}>
			<div class="reader-container" on:click|stopPropagation>
				<div class="reader-header">
					<button class="reader-close" on:click={closeReader} title="Close (ESC)">
						<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
							<path d="M5 5l10 10M15 5l-10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
						</svg>
					</button>
					{#if currentItemUrl}
						<a href={currentItemUrl} target="_blank" rel="noopener noreferrer" class="reader-source">
							Open Original ↗
						</a>
					{/if}
				</div>

				{#if readerLoading}
					<div class="reader-loading">
						<div class="reader-spinner"></div>
						<span>Loading article...</span>
					</div>
				{:else if readerError}
					<div class="reader-error">
						<p>{readerError}</p>
						{#if currentItemUrl}
							<a href={currentItemUrl} target="_blank" rel="noopener noreferrer" class="reader-fallback-btn">
								Open Original Article
							</a>
						{/if}
					</div>
				{:else if readerData}
					<article class="reader-content">
						{#if readerData.imageUrl}
							<img src={readerData.imageUrl} alt="" class="reader-hero" />
						{/if}
						<h1 class="reader-title">{readerData.title || 'Untitled'}</h1>
						{#if readerData.byline || readerData.siteName}
							<div class="reader-meta">
								{#if readerData.byline}<span>{readerData.byline}</span>{/if}
								{#if readerData.byline && readerData.siteName}<span class="meta-sep">•</span>{/if}
								{#if readerData.siteName}<span>{readerData.siteName}</span>{/if}
							</div>
						{/if}
						<div class="reader-body" id="reader-body-content">
							{@html readerData.contentHtml}
						</div>
					</article>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Add Feed Modal -->
	{#if showAddFeedModal}
		<div class="modal-overlay" on:click={closeAddFeedModal}>
			<div class="add-feed-modal glass-panel" on:click|stopPropagation>
				<div class="modal-header">
					<h2>Add Feed</h2>
					<button class="close-btn" on:click={closeAddFeedModal}>×</button>
				</div>

				<div class="modal-tabs">
					<button 
						class="tab-btn" 
						class:active={addFeedTab === 'url'}
						on:click={() => addFeedTab = 'url'}
					>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
							<path d="M6.5 10.5l-3 3a2.121 2.121 0 01-3-3l3-3m9-6l-3 3a2.121 2.121 0 01-3-3l3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						</svg>
						URL
					</button>
					<button 
						class="tab-btn" 
						class:active={addFeedTab === 'search'}
						on:click={() => addFeedTab = 'search'}
					>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
							<circle cx="7" cy="7" r="4" stroke="currentColor" stroke-width="1.5" fill="none"/>
							<path d="M10 10l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						</svg>
						Search
					</button>
					<button 
						class="tab-btn" 
						class:active={addFeedTab === 'bulk'}
						on:click={() => addFeedTab = 'bulk'}
					>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
							<path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						</svg>
						Bulk
					</button>
				</div>

				<div class="modal-body">
					{#if addFeedTab === 'url'}
						<div class="input-group">
							<div class="input-with-icon">
								<svg width="18" height="18" viewBox="0 0 18 18" fill="none" class="input-icon">
									<path d="M7 11l-3.5 3.5a2.475 2.475 0 01-3.5-3.5L3.5 7.5m11-4L11 7a2.475 2.475 0 01-3.5-3.5L11 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
								</svg>
								<input
									type="text"
									bind:value={addFeedUrl}
									placeholder="Paste feed URL, YouTube channel, or Reddit subreddit…"
									class="feed-input"
									on:keydown={(e) => e.key === 'Enter' && submitAddFeed()}
								/>
							</div>
						</div>

						{#if folders.length > 0}
							<div class="folder-selection-section">
								<div class="section-label">Also add to folder(s)</div>
								<div class="folder-checkboxes">
									{#each folders as folder}
										<label class="folder-checkbox-label">
											<input
												type="checkbox"
												value={folder.id}
												checked={selectedFolderIdsForNewFeed.includes(folder.id)}
												on:change={(e) => {
													if (e.currentTarget.checked) {
														selectedFolderIdsForNewFeed = [...selectedFolderIdsForNewFeed, folder.id];
													} else {
														selectedFolderIdsForNewFeed = selectedFolderIdsForNewFeed.filter(id => id !== folder.id);
													}
												}}
											/>
											<span>{folder.name}</span>
										</label>
									{/each}
								</div>
							</div>
						{/if}
					{:else if addFeedTab === 'search'}
						<div class="search-placeholder">
							<svg width="48" height="48" viewBox="0 0 48 48" fill="none">
								<circle cx="20" cy="20" r="12" stroke="currentColor" stroke-width="2" fill="none"/>
								<path d="M29 29l10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
							</svg>
							<p>Search for feeds</p>
							<span class="placeholder-hint">Coming soon</span>
						</div>
					{:else if addFeedTab === 'bulk'}
						<div class="input-group">
							<label class="input-label">Paste URLs (one per line)</label>
							<textarea
								bind:value={addFeedBulkUrls}
								placeholder="https://example.com/feed&#10;https://youtube.com/@channel&#10;https://reddit.com/r/subreddit"
								class="bulk-textarea"
								rows="8"
							></textarea>
						</div>

						{#if folders.length > 0}
							<div class="folder-selection-section">
								<div class="section-label">Also add to folder(s)</div>
								<div class="folder-checkboxes">
									{#each folders as folder}
										<label class="folder-checkbox-label">
											<input
												type="checkbox"
												value={folder.id}
												checked={selectedFolderIdsForNewFeed.includes(folder.id)}
												on:change={(e) => {
													if (e.currentTarget.checked) {
														selectedFolderIdsForNewFeed = [...selectedFolderIdsForNewFeed, folder.id];
													} else {
														selectedFolderIdsForNewFeed = selectedFolderIdsForNewFeed.filter(id => id !== folder.id);
													}
												}}
											/>
											<span>{folder.name}</span>
										</label>
									{/each}
								</div>
							</div>
						{/if}
					{/if}

					{#if addFeedError}
						<div class="feed-error">{addFeedError}</div>
					{/if}
				</div>

				<div class="modal-footer">
					<button 
						class="primary-btn" 
						disabled={addFeedLoading || (addFeedTab === 'url' && !validateFeedUrl(addFeedUrl)) || (addFeedTab === 'bulk' && !addFeedBulkUrls.trim()) || addFeedTab === 'search'}
						on:click={submitAddFeed}
					>
						{addFeedLoading ? 'Adding...' : 'Add Feed'}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Create Folder Modal -->
	{#if showCreateFolderModal}
		<div class="modal-overlay" on:click={() => { showCreateFolderModal = false; folderModalName = ''; folderModalError = null; }}>
			<div class="folder-modal glass-panel" on:click|stopPropagation>
				<div class="modal-header">
					<h2>Create Folder</h2>
					<button class="close-btn" on:click={() => { showCreateFolderModal = false; folderModalName = ''; folderModalError = null; }}>×</button>
				</div>
				<div class="modal-body">
					<input
						type="text"
						bind:value={folderModalName}
						placeholder="Folder name"
						class="folder-input"
						maxlength="60"
						on:keydown={(e) => e.key === 'Enter' && createFolder()}
					/>
					{#if folderModalError}
						<div class="folder-error">{folderModalError}</div>
					{/if}
				</div>
				<div class="modal-footer">
					<button class="secondary-btn" on:click={() => { showCreateFolderModal = false; folderModalName = ''; folderModalError = null; }}>Cancel</button>
					<button class="primary-btn" disabled={folderModalLoading || !folderModalName.trim()} on:click={createFolder}>
						{folderModalLoading ? 'Creating...' : 'Create'}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Rename Folder Modal -->
	{#if showRenameFolderModal}
		<div class="modal-overlay" on:click={() => { showRenameFolderModal = false; folderModalName = ''; folderModalError = null; }}>
			<div class="folder-modal glass-panel" on:click|stopPropagation>
				<div class="modal-header">
					<h2>Rename Folder</h2>
					<button class="close-btn" on:click={() => { showRenameFolderModal = false; folderModalName = ''; folderModalError = null; }}>×</button>
				</div>
				<div class="modal-body">
					<input
						type="text"
						bind:value={folderModalName}
						placeholder="Folder name"
						class="folder-input"
						maxlength="60"
						on:keydown={(e) => e.key === 'Enter' && renameFolder()}
					/>
					{#if folderModalError}
						<div class="folder-error">{folderModalError}</div>
					{/if}
				</div>
				<div class="modal-footer">
					<button class="secondary-btn" on:click={() => { showRenameFolderModal = false; folderModalName = ''; folderModalError = null; }}>Cancel</button>
					<button class="primary-btn" disabled={folderModalLoading || !folderModalName.trim()} on:click={renameFolder}>
						{folderModalLoading ? 'Renaming...' : 'Rename'}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Delete Folder Confirm -->
	{#if showDeleteFolderConfirm}
		<div class="modal-overlay" on:click={() => { showDeleteFolderConfirm = false; selectedFolderForAction = null; }}>
			<div class="folder-modal glass-panel" on:click|stopPropagation>
				<div class="modal-header">
					<h2>Delete Folder</h2>
					<button class="close-btn" on:click={() => { showDeleteFolderConfirm = false; selectedFolderForAction = null; }}>×</button>
				</div>
				<div class="modal-body">
					<p>Are you sure you want to delete "{selectedFolderForAction?.name}"?</p>
					<p class="warning-text">This will remove all feed associations but won't delete the feeds themselves.</p>
				</div>
				<div class="modal-footer">
					<button class="secondary-btn" on:click={() => { showDeleteFolderConfirm = false; selectedFolderForAction = null; }}>Cancel</button>
					<button class="danger-btn" on:click={deleteFolder}>Delete</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Feed Folder Popover -->
	{#if showFeedFolderPopover && feedFolderPopoverFeed}
		<div class="popover-overlay" on:click={closeFeedFolderPopover}>
			<div 
				class="feed-folder-popover glass-panel" 
				style="left: {feedFolderPopoverPosition.x}px; top: {feedFolderPopoverPosition.y}px;"
				on:click|stopPropagation
			>
				<div class="popover-header">
					<span>Add to folder</span>
					<button class="close-btn-small" on:click={closeFeedFolderPopover}>×</button>
				</div>
				<div class="popover-body">
					{#if folders.length === 0}
						<div class="popover-empty">No folders yet</div>
					{:else}
						{#each folders as folder}
							<label class="folder-checkbox-item">
								<input
									type="checkbox"
									checked={feedFolderPopoverFeed.folders && feedFolderPopoverFeed.folders.includes(folder.id)}
									on:change={() => toggleFeedInFolder(
										folder.id,
										feedFolderPopoverFeed.url,
										feedFolderPopoverFeed.folders && feedFolderPopoverFeed.folders.includes(folder.id)
									)}
								/>
								<span>{folder.name}</span>
							</label>
						{/each}
					{/if}
					
					{#if !showCreateFolderInPopover}
						<button class="create-folder-in-popover-btn" on:click={() => showCreateFolderInPopover = true}>
							<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
								<path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
							</svg>
							Create new folder
						</button>
					{:else}
						<div class="create-folder-inline">
							<input
								type="text"
								bind:value={newFolderNameInPopover}
								placeholder="Folder name"
								class="inline-folder-input"
								maxlength="60"
								on:keydown={(e) => e.key === 'Enter' && createFolderInPopover()}
							/>
							<button class="inline-create-btn" on:click={createFolderInPopover} disabled={!newFolderNameInPopover.trim()}>Add</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Refresh Toast -->
	{#if showRefreshToast}
		<div class="refresh-toast glass-panel">
			<div class="toast-content">
				<div class="toast-header">
					<span class="toast-title">Refreshing Feeds</span>
					<button class="toast-close" on:click={dismissRefreshToast}>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
							<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						</svg>
					</button>
				</div>
				<div class="toast-progress-text">
					{refreshCurrent} / {refreshTotal} • {refreshMessage}
				</div>
				<div class="progress-bar">
					<div class="progress-fill" style="width: {refreshTotal > 0 ? (refreshCurrent / refreshTotal * 100) : 0}%"></div>
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

	/* Reader View Styles */
	.reader-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.92);
		backdrop-filter: blur(12px);
		z-index: 2000;
		display: flex;
		justify-content: center;
		overflow-y: auto;
		animation: fadeIn 0.2s ease;
	}

	.reader-container {
		width: 100%;
		max-width: 720px;
		min-height: 100vh;
		padding: 24px var(--page-padding);
		animation: scaleIn 0.25s ease-out;
	}

	.reader-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 32px;
		position: sticky;
		top: 0;
		background: rgba(0, 0, 0, 0.8);
		backdrop-filter: blur(8px);
		padding: 16px 0;
		z-index: 10;
	}

	.reader-close {
		width: 44px;
		height: 44px;
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

	.reader-close:hover {
		background: var(--chip-hover);
		color: var(--text);
		transform: rotate(90deg);
	}

	.reader-source {
		color: var(--accent);
		text-decoration: none;
		font-size: 14px;
		font-weight: 500;
		padding: 10px 16px;
		border: 1px solid var(--accent);
		border-radius: 99px;
		transition: all 0.2s;
	}

	.reader-source:hover {
		background: var(--accent);
		color: var(--bg0);
	}

	.reader-loading, .reader-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 20px;
		padding: 80px 20px;
		text-align: center;
		color: var(--muted);
	}

	.reader-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--stroke);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.reader-error {
		color: var(--muted2);
	}

	.reader-fallback-btn {
		color: var(--accent);
		text-decoration: none;
		padding: 12px 24px;
		border: 1px solid var(--accent);
		border-radius: var(--radiusM);
		transition: all 0.2s;
	}

	.reader-fallback-btn:hover {
		background: var(--accent);
		color: var(--bg0);
	}

	.reader-content {
		color: var(--text);
	}

	.reader-hero {
		width: 100%;
		max-height: 400px;
		object-fit: cover;
		border-radius: var(--radiusM);
		margin-bottom: 32px;
	}

	.reader-title {
		font-family: var(--font-display);
		font-size: 32px;
		font-weight: 700;
		line-height: 1.25;
		letter-spacing: -0.02em;
		margin: 0 0 16px 0;
		color: #fff;
	}

	.reader-meta {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 15px;
		color: var(--muted);
		margin-bottom: 32px;
		padding-bottom: 24px;
		border-bottom: 1px solid var(--stroke);
	}

	.reader-body {
		font-size: 18px;
		line-height: 1.8;
		color: rgba(255, 255, 255, 0.88);
	}

	.reader-body p {
		margin: 0 0 1.5em 0;
	}

	.reader-body a {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.reader-body a:hover {
		text-decoration: none;
	}

	.reader-body blockquote {
		margin: 1.5em 0;
		padding-left: 20px;
		border-left: 3px solid var(--accent);
		color: var(--muted);
		font-style: italic;
	}

	.reader-body pre, .reader-body code {
		background: var(--panel0);
		border-radius: 6px;
		font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
		font-size: 0.9em;
	}

	.reader-body pre {
		padding: 16px;
		overflow-x: auto;
		margin: 1.5em 0;
	}

	.reader-body code {
		padding: 2px 6px;
	}

	.reader-body ul, .reader-body ol {
		margin: 1.5em 0;
		padding-left: 1.5em;
	}

	.reader-body li {
		margin-bottom: 0.5em;
	}

	.reader-body h2, .reader-body h3 {
		font-family: var(--font-display);
		margin: 2em 0 1em 0;
		color: #fff;
	}

	.reader-body h2 {
		font-size: 24px;
	}

	.reader-body h3 {
		font-size: 20px;
	}

	.reader-body hr {
		border: none;
		border-top: 1px solid var(--stroke);
		margin: 2em 0;
	}

	/* Add Feed Modal */
	.add-feed-modal {
		width: 90%;
		max-width: 480px;
		max-height: 85vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		animation: scaleIn 0.25s ease-out;
	}

	.modal-tabs {
		display: flex;
		gap: 4px;
		padding: 0 var(--gap-lg);
		border-bottom: 1px solid var(--stroke);
	}

	.tab-btn {
		flex: 1;
		padding: 12px 16px;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--muted);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
	}

	.tab-btn:hover {
		color: var(--text);
	}

	.tab-btn.active {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	.tab-btn svg {
		opacity: 0.7;
	}

	.tab-btn.active svg {
		opacity: 1;
	}

	.input-group {
		margin-bottom: 20px;
	}

	.input-with-icon {
		position: relative;
		display: flex;
		align-items: center;
	}

	.input-icon {
		position: absolute;
		left: 16px;
		color: var(--muted);
		pointer-events: none;
	}

	.feed-input {
		width: 100%;
		padding: 14px 16px 14px 44px;
		background: var(--panel0);
		border: 1px solid var(--stroke);
		border-radius: var(--radiusM);
		color: var(--text);
		font-size: 15px;
		font-family: var(--font-ui);
		transition: all 0.2s;
	}

	.feed-input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-glow);
	}

	.feed-input::placeholder {
		color: var(--muted2);
	}

	.folder-section {
		margin-top: 24px;
		padding-top: 24px;
		border-top: 1px solid var(--stroke);
	}

	.section-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 12px;
	}

	.folder-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 14px;
		background: var(--panel0);
		border: 1px solid var(--stroke);
		border-radius: var(--radiusM);
		color: var(--text);
		font-size: 14px;
	}

	.folder-row svg {
		color: var(--muted);
	}

	.create-folder-btn {
		margin-top: 10px;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 10px 14px;
		background: none;
		border: 1px dashed var(--stroke);
		border-radius: var(--radiusM);
		color: var(--muted);
		font-size: 13px;
		font-weight: 500;
		cursor: not-allowed;
		opacity: 0.5;
	}

	.search-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 60px 20px;
		text-align: center;
		color: var(--muted);
	}

	.search-placeholder svg {
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.search-placeholder p {
		font-size: 16px;
		font-weight: 500;
		margin: 0 0 8px 0;
	}

	.placeholder-hint {
		font-size: 13px;
		color: var(--muted2);
	}

	.input-label {
		display: block;
		font-size: 13px;
		font-weight: 600;
		color: var(--muted);
		margin-bottom: 8px;
	}

	.bulk-textarea {
		width: 100%;
		padding: 14px 16px;
		background: var(--panel0);
		border: 1px solid var(--stroke);
		border-radius: var(--radiusM);
		color: var(--text);
		font-size: 14px;
		font-family: var(--font-ui);
		resize: vertical;
		transition: all 0.2s;
	}

	.bulk-textarea:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-glow);
	}

	.bulk-textarea::placeholder {
		color: var(--muted2);
	}

	.feed-error {
		margin-top: 12px;
		padding: 12px 14px;
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: var(--radiusM);
		color: #ef4444;
		font-size: 13px;
	}

	.modal-footer {
		padding: var(--gap-lg);
		border-top: 1px solid var(--stroke);
	}

	.primary-btn {
		width: 100%;
		padding: 14px 24px;
		background: var(--accent);
		border: none;
		border-radius: var(--radiusM);
		color: var(--bg0);
		font-size: 15px;
		font-weight: 600;
		font-family: var(--font-ui);
		cursor: pointer;
		transition: all 0.2s;
	}

	.primary-btn:hover:not(:disabled) {
		background: #1ed685;
		transform: translateY(-1px);
		box-shadow: 0 4px 12px var(--accent-glow);
	}

	.primary-btn:disabled {
		background: var(--panel1);
		color: var(--muted2);
		cursor: not-allowed;
		opacity: 0.5;
	}

	/* Refresh Toast */
	.refresh-toast {
		position: fixed;
		bottom: 24px;
		left: 50%;
		transform: translateX(-50%);
		min-width: 320px;
		max-width: 400px;
		padding: 16px 20px;
		z-index: 1500;
		animation: slideUp 0.3s ease-out;
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	.toast-content {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.toast-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.toast-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
	}

	.toast-close {
		width: 24px;
		height: 24px;
		padding: 0;
		background: none;
		border: none;
		color: var(--muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.toast-close:hover {
		background: var(--panel1);
		color: var(--text);
	}

	.toast-progress-text {
		font-size: 13px;
		color: var(--muted);
	}

	.progress-bar {
		height: 4px;
		background: var(--panel1);
		border-radius: 99px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--accent);
		border-radius: 99px;
		transition: width 0.3s ease;
	}

	/* Folder UI Styles */
	.nav-section-label {
		font-size: 11px;
		font-weight: 700;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.8px;
		padding: 16px var(--gap-md) 8px;
	}

	.nav-section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-right: var(--gap-md);
	}

	.nav-section-header .nav-section-label {
		flex: 1;
		padding-right: 0;
	}

	.add-folder-btn {
		width: 24px;
		height: 24px;
		padding: 0;
		background: none;
		border: none;
		color: var(--muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.add-folder-btn:hover {
		background: var(--panel1);
		color: var(--accent);
	}

	.smart-folder {
		opacity: 0.9;
	}

	.folder-item-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.folder-item {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 10px;
		padding-right: 32px;
	}

	.folder-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.folder-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-left: auto;
	}

	.feed-count {
		font-size: 11px;
		color: var(--muted2);
	}

	.folder-actions-btn {
		position: absolute;
		right: var(--gap-md);
		width: 24px;
		height: 24px;
		padding: 0;
		background: none;
		border: none;
		color: var(--muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
		opacity: 0;
	}

	.folder-item-wrapper:hover .folder-actions-btn {
		opacity: 1;
	}

	.folder-actions-btn:hover {
		background: var(--panel1);
		color: var(--text);
	}

	.folder-actions-menu {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 4px;
		min-width: 140px;
		background: var(--panel1);
		border: 1px solid var(--stroke);
		border-radius: var(--radiusM);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		overflow: hidden;
		z-index: 100;
	}

	.menu-item {
		width: 100%;
		padding: 10px 14px;
		background: none;
		border: none;
		color: var(--text);
		font-size: 13px;
		font-family: var(--font-ui);
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 8px;
		transition: all 0.2s;
		text-align: left;
	}

	.menu-item:hover {
		background: var(--panel0);
	}

	.menu-item.danger {
		color: #ef4444;
	}

	.menu-item.danger:hover {
		background: rgba(239, 68, 68, 0.1);
	}

	.nav-item-loading,
	.nav-item-empty {
		padding: 12px var(--gap-md);
		font-size: 13px;
		color: var(--muted2);
		text-align: center;
	}

	.feed-item {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px var(--gap-md);
		background: none;
		border: none;
		border-left: 3px solid transparent;
		color: var(--text);
		font-size: 14px;
		font-family: var(--font-ui);
		cursor: pointer;
		transition: all 0.2s;
		width: 100%;
		text-align: left;
	}

	.feed-item:hover {
		background: var(--panel0);
	}

	.feed-item.active {
		background: var(--panel0);
		border-left-color: var(--accent);
	}

	.feed-item-content {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 8px;
		overflow: hidden;
	}

	.feed-title {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.feed-folder-btn {
		width: 24px;
		height: 24px;
		padding: 0;
		background: none;
		border: none;
		color: var(--muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
		opacity: 0;
	}

	.feed-item:hover .feed-folder-btn {
		opacity: 1;
	}

	.feed-folder-btn:hover {
		background: var(--panel1);
		color: var(--accent);
	}

	/* Folder Modals */
	.folder-modal {
		width: 90%;
		max-width: 420px;
		padding: 0;
		animation: scaleIn 0.25s ease-out;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--gap-lg);
		border-bottom: 1px solid var(--stroke);
	}

	.modal-header h2 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: var(--text);
	}

	.close-btn {
		width: 32px;
		height: 32px;
		padding: 0;
		background: none;
		border: none;
		color: var(--muted);
		font-size: 24px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.close-btn:hover {
		background: var(--panel1);
		color: var(--text);
	}

	.modal-body {
		padding: var(--gap-lg);
	}

	.modal-body p {
		margin: 0 0 12px 0;
		color: var(--text);
		font-size: 14px;
		line-height: 1.5;
	}

	.warning-text {
		color: var(--muted);
		font-size: 13px;
	}

	.folder-input {
		width: 100%;
		padding: 12px 14px;
		background: var(--panel0);
		border: 1px solid var(--stroke);
		border-radius: var(--radiusM);
		color: var(--text);
		font-size: 15px;
		font-family: var(--font-ui);
		transition: all 0.2s;
	}

	.folder-input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-glow);
	}

	.folder-error {
		margin-top: 12px;
		padding: 10px 12px;
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: var(--radiusM);
		color: #ef4444;
		font-size: 13px;
	}

	.modal-footer {
		display: flex;
		gap: 10px;
		padding: var(--gap-lg);
		border-top: 1px solid var(--stroke);
	}

	.secondary-btn {
		flex: 1;
		padding: 12px 20px;
		background: var(--panel1);
		border: 1px solid var(--stroke);
		border-radius: var(--radiusM);
		color: var(--text);
		font-size: 14px;
		font-weight: 600;
		font-family: var(--font-ui);
		cursor: pointer;
		transition: all 0.2s;
	}

	.secondary-btn:hover {
		background: var(--panel0);
	}

	.danger-btn {
		flex: 1;
		padding: 12px 20px;
		background: #ef4444;
		border: none;
		border-radius: var(--radiusM);
		color: white;
		font-size: 14px;
		font-weight: 600;
		font-family: var(--font-ui);
		cursor: pointer;
		transition: all 0.2s;
	}

	.danger-btn:hover {
		background: #dc2626;
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
	}

	/* Feed Folder Popover */
	.popover-overlay {
		position: fixed;
		inset: 0;
		z-index: 2000;
	}

	.feed-folder-popover {
		position: fixed;
		min-width: 240px;
		max-width: 300px;
		padding: 0;
		z-index: 2001;
		animation: scaleIn 0.2s ease-out;
	}

	.popover-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 14px;
		border-bottom: 1px solid var(--stroke);
	}

	.popover-header span {
		font-size: 13px;
		font-weight: 600;
		color: var(--text);
	}

	.close-btn-small {
		width: 20px;
		height: 20px;
		padding: 0;
		background: none;
		border: none;
		color: var(--muted);
		font-size: 18px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 3px;
		transition: all 0.2s;
	}

	.close-btn-small:hover {
		background: var(--panel1);
		color: var(--text);
	}

	.popover-body {
		padding: 8px;
		max-height: 300px;
		overflow-y: auto;
	}

	.popover-empty {
		padding: 20px;
		text-align: center;
		color: var(--muted2);
		font-size: 13px;
	}

	.folder-checkbox-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 10px;
		cursor: pointer;
		border-radius: var(--radiusS);
		transition: all 0.2s;
	}

	.folder-checkbox-item:hover {
		background: var(--panel0);
	}

	.folder-checkbox-item input[type="checkbox"] {
		width: 16px;
		height: 16px;
		cursor: pointer;
	}

	.folder-checkbox-item span {
		flex: 1;
		font-size: 14px;
		color: var(--text);
	}

	.create-folder-in-popover-btn {
		width: 100%;
		margin-top: 4px;
		padding: 8px 10px;
		background: none;
		border: 1px dashed var(--stroke);
		border-radius: var(--radiusM);
		color: var(--muted);
		font-size: 13px;
		font-weight: 500;
		font-family: var(--font-ui);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		transition: all 0.2s;
	}

	.create-folder-in-popover-btn:hover {
		background: var(--panel0);
		border-color: var(--accent);
		color: var(--accent);
	}

	.create-folder-inline {
		margin-top: 4px;
		display: flex;
		gap: 6px;
	}

	.inline-folder-input {
		flex: 1;
		padding: 6px 10px;
		background: var(--panel0);
		border: 1px solid var(--stroke);
		border-radius: var(--radiusM);
		color: var(--text);
		font-size: 13px;
		font-family: var(--font-ui);
	}

	.inline-folder-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.inline-create-btn {
		padding: 6px 12px;
		background: var(--accent);
		border: none;
		border-radius: var(--radiusM);
		color: var(--bg0);
		font-size: 13px;
		font-weight: 600;
		font-family: var(--font-ui);
		cursor: pointer;
		transition: all 0.2s;
	}

	.inline-create-btn:hover:not(:disabled) {
		background: #1ed685;
	}

	.inline-create-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Folder Selection in Add Feed Modal */
	.folder-selection-section {
		margin-top: 20px;
		padding-top: 20px;
		border-top: 1px solid var(--stroke);
	}

	.folder-checkboxes {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.folder-checkbox-label {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		background: var(--panel0);
		border: 1px solid var(--stroke);
		border-radius: var(--radiusM);
		cursor: pointer;
		transition: all 0.2s;
	}

	.folder-checkbox-label:hover {
		background: var(--panel1);
		border-color: var(--accent);
	}

	.folder-checkbox-label input[type="checkbox"] {
		width: 16px;
		height: 16px;
		cursor: pointer;
	}

	.folder-checkbox-label span {
		flex: 1;
		font-size: 14px;
		color: var(--text);
	}
</style>
