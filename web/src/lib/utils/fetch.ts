/**
 * Fetch utility with timeout support
 */

export interface FetchWithTimeoutOptions extends RequestInit {
    timeout?: number; // Timeout in milliseconds
}

/**
 * Fetch with automatic timeout
 * @param url - The URL to fetch
 * @param options - Fetch options including optional timeout (default: 30000ms)
 * @returns Promise<Response>
 */
export async function fetchWithTimeout(
    url: string,
    options: FetchWithTimeoutOptions = {}
): Promise<Response> {
    const { timeout = 30000, ...fetchOptions } = options;

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

/**
 * Fetch with authentication token
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @returns Promise<Response>
 */
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
