const DEFAULT_TIMEOUT_MS = 30000;

export interface FetchWithTimeoutOptions extends RequestInit {
    timeout?: number;
}

export async function fetchWithTimeout(
    url: string,
    options: FetchWithTimeoutOptions = {}
): Promise<Response> {
    const { timeout = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeout}ms`);
        }
        throw error;
    }
}

export async function fetchWithAuth(
    url: string,
    options: RequestInit = {}
): Promise<Response> {
    const token = localStorage.getItem('auth_token');
    
    const headers: HeadersInit = {
        ...options.headers,
    };
    
    if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
    
    return fetchWithTimeout(url, {
        ...options,
        headers,
    });
}

export default fetchWithTimeout;
