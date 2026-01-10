// Centralized API client for FeedStream
// Provides consistent error handling and request/response patterns

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  details?: any;
}

interface ApiError extends Error {
  statusCode?: number;
  details?: any;
}

class ApiRequestError extends Error implements ApiError {
  statusCode?: number;
  details?: any;

  constructor(message: string, statusCode?: number, details?: any) {
    super(message);
    this.name = 'ApiRequestError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Base API client class
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new ApiRequestError(
          data.error || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          data.details
        );
      }

      return data;
    } catch (error) {
      if (error instanceof ApiRequestError) {
        throw error;
      }
      throw new ApiRequestError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        undefined
      );
    }
  }

  // Generic HTTP methods
  async get<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Create singleton instance
const apiClient = new ApiClient();

// Feed API
export const feedsApi = {
  list: () => apiClient.get<{ feeds: any[] }>('/feeds'),
  get: (id: string) => apiClient.get<{ feed: any }>(`/feeds/${id}`),
  create: (url: string, options?: { refresh?: boolean; folderIds?: string[] }) =>
    apiClient.post<{ id: number }>('/feeds', { url, ...options }),
  update: (id: string, data: any) =>
    apiClient.put<{ updated: number }>(`/feeds/${id}`, data),
  delete: (id: string) =>
    apiClient.delete<{ deleted: number }>(`/feeds/${id}`),
  refresh: (id: string) =>
    apiClient.post<{ message: string }>(`/feeds/${id}/refresh`, undefined),
  stats: () => apiClient.get<{ stats: any }>('/feeds/stats'),
};

// Items API
export const itemsApi = {
  list: (params?: { feedId?: string; read?: string; starred?: string; limit?: number; offset?: number }) => {
    const queryParams = new URLSearchParams(params as any).toString();
    return apiClient.get<{ items: any[]; total: number }>(`/items?${queryParams}`);
  },
  get: (id: string) =>
    apiClient.get<{ item: any }>(`/items/${id}`),
  toggleRead: (id: string, read: boolean) =>
    apiClient.patch<{ updated: number }>(`/items/${id}/read`, { read }),
  toggleStar: (id: string, starred: boolean) =>
    apiClient.patch<{ updated: number }>(`/items/${id}/star`, { starred }),
  updatePlaybackPosition: (id: string, position: number) =>
    apiClient.patch<{ updated: number }>(`/items/${id}/playback`, { position }),
  markAllRead: (options?: { feedUrl?: string; source?: string; before?: string }) =>
    apiClient.post<{ marked: number }>('/items/mark-all-read', options),
  stats: () => apiClient.get<{ stats: any }>('/items/stats'),
};

// Folders API
export const foldersApi = {
  list: () => apiClient.get<{ folders: any[] }>('/folders'),
  get: (id: string) => apiClient.get<{ folder: any; feeds: any[] }>(`/folders/${id}`),
  create: (name: string) =>
    apiClient.post<{ id: number }>('/folders', { name }),
  update: (id: string, name: string) =>
    apiClient.patch<{ updated: number }>(`/folders/${id}`, { name }),
  delete: (id: string) =>
    apiClient.delete<{ deleted: number }>(`/folders/${id}`),
  addFeed: (folderId: string, feedUrl: string) =>
    apiClient.post(`/folders/${folderId}/feeds`, { feedUrl }),
  removeFeed: (folderId: string, feedUrl: string) => {
    const params = new URLSearchParams({ feedUrl }).toString();
    return apiClient.delete<{ deleted: number }>(`/folders/${folderId}/feeds?${params}`);
  },
};

// Settings API
export const settingsApi = {
  list: () => apiClient.get<{ settings: Record<string, string> }>('/settings'),
  get: (key: string) => apiClient.get<{ setting: any }>(`/settings/${key}`),
  update: (key: string, value: string) =>
    apiClient.put<{ updated: number }>(`/settings/${key}`, { value }),
  updateMultiple: (settings: Record<string, string>) =>
    apiClient.put<{ updated: string[] }>('/settings', settings),
  delete: (key: string) =>
    apiClient.delete<{ deleted: number }>(`/settings/${key}`),
};

// Reader API
export const readerApi = {
  get: (url: string) => {
    const params = new URLSearchParams({ url }).toString();
    return apiClient.get<any>(`/reader?${params}`);
  },
  getCache: (id: string) =>
    apiClient.get<{ content: string }>(`/reader/${id}/cache`),
  setCache: (id: string, content: string) =>
    apiClient.put<{ message: string }>(`/reader/${id}/cache`, { content }),
  deleteCache: (id: string) =>
    apiClient.delete<{ deleted: number }>(`/reader/${id}/cache`),
  clearCache: () =>
    apiClient.delete<{ deleted: number }>('/reader/cache'),
};

// Search API
export const searchApi = {
  items: (query: string, limit: number = 100, offset: number = 0) => {
    const params = new URLSearchParams({ q: query, limit: String(limit), offset: String(offset) }).toString();
    return apiClient.get<{ items: any[] }>(`/search?${params}`);
  },
  feeds: (query: string, type: string = 'all') => {
    const params = new URLSearchParams({ q: query, type }).toString();
    return apiClient.get<{ results: any[] }>(`/search/feeds?${params}`);
  },
};

// Refresh API
export const refreshApi = {
  status: () => apiClient.get<{ activeJobs: any[]; recentJobs: any[]; activeCount: number }>('/refresh'),
  start: () => apiClient.post<{ jobId: string; message: string }>('/refresh'),
  startAll: () => apiClient.post<{ jobIds: number[]; message: string }>('/refresh/all'),
  getJob: (jobId: string) => {
    const params = new URLSearchParams({ jobId }).toString();
    return apiClient.get<{ job: any }>(`/refresh?${params}`);
  },
  cancel: (jobId: string) => {
    const params = new URLSearchParams({ jobId }).toString();
    return apiClient.delete<{ cancelled: number }>(`/refresh?${params}`);
  },
  clear: (status?: 'all' | 'completed' | 'failed') => {
    const params = status ? new URLSearchParams({ status }).toString() : '';
    return apiClient.delete<{ deleted: number }>(`/refresh${params}`);
  },
};

// OPML API
export const opmlApi = {
  export: async () => {
    const response = await fetch('/api/opml', {
      method: 'GET',
    });
    if (!response.ok) {
      throw new ApiRequestError(`HTTP ${response.status}: ${response.statusText}`, response.status);
    }
    return response.blob();
  },
  import: (opml: string) =>
    apiClient.post<{ added: number; skipped: number; total: number; failed: any[] }>('/opml', { opml }),
};

// Export the ApiError class for use in components
export { ApiRequestError };
export type { ApiError, ApiResponse };
