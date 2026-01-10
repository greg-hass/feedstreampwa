// Centralized API client wrapper for consistent error handling
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch {
      // If JSON parsing fails, use status text
    }
    
    throw new ApiError(
      errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      errorData
    );
  }
  
  return response.json();
}

export function successResponse<T>(data: T) {
  return { ok: true, data } as const;
}

export function errorResponse(message: string, statusCode: number = 500) {
  return { ok: false, error: message } as const;
}
