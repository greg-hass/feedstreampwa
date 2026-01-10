// Input validation utilities

// URL validation
export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateUrl(value: string, fieldName: string = 'URL'): void {
  if (!value || typeof value !== 'string') {
    throw new Error(`${fieldName} is required`);
  }
  if (!isValidUrl(value)) {
    throw new Error(`Invalid ${fieldName} format`);
  }
}

// String validation
export function validateNonEmptyString(value: string, fieldName: string, min: number = 1, max: number = 255): void {
  if (!value || typeof value !== 'string') {
    throw new Error(`${fieldName} is required`);
  }
  if (value.length < min) {
    throw new Error(`${fieldName} must be at least ${min} character(s)`);
  }
  if (value.length > max) {
    throw new Error(`${fieldName} must be at most ${max} character(s)`);
  }
}

export function validateFolderName(value: string): void {
  validateNonEmptyString(value, 'Folder name', 1, 60);
}

export function validateFeedUrl(value: string): void {
  validateUrl(value, 'Feed URL');
}

export function validateFeedTitle(value: string): void {
  validateNonEmptyString(value, 'Feed title', 1, 100);
}

export function validateSearchQuery(value: string): void {
  validateNonEmptyString(value, 'Search query', 1, 500);
}

// Boolean validation
export function validateBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${fieldName} must be a boolean`);
  }
  return value;
}

// Number validation
export function validateNumber(value: unknown, fieldName: string, min: number = 0, max?: number): number {
  if (typeof value !== 'number') {
    throw new Error(`${fieldName} must be a number`);
  }
  if (value < min) {
    throw new Error(`${fieldName} must be at least ${min}`);
  }
  if (max !== undefined && value > max) {
    throw new Error(`${fieldName} must be at most ${max}`);
  }
  return value;
}

// Array validation
export function validateArray<T>(value: T[], fieldName: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }
  return value;
}

// Enum validation
export function validateEnum<T extends string>(value: string, fieldName: string, allowedValues: readonly T[]): T {
  if (!allowedValues.includes(value as T)) {
    throw new Error(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
  }
  return value as T;
}

// Feed validation
export function validateCreateFeedBody(body: any): { url: string; refresh?: boolean; folderIds?: string[] } {
  if (!body) {
    throw new Error('Request body is required');
  }
  
  validateFeedUrl(body.url);
  
  const result: any = { url: body.url.trim() };
  
  if (body.refresh !== undefined) {
    result.refresh = validateBoolean(body.refresh, 'refresh');
  }
  
  if (body.folderIds !== undefined) {
    result.folderIds = validateArray(body.folderIds, 'folderIds');
  }
  
  return result;
}

export function validateUpdateFeedBody(body: any): { url: string; title?: string } {
  if (!body) {
    throw new Error('Request body is required');
  }
  
  validateFeedUrl(body.url);
  
  const result: any = { url: body.url.trim() };
  
  if (body.title !== undefined) {
    validateFeedTitle(body.title);
    result.title = body.title.trim();
  }
  
  return result;
}

// Folder validation
export function validateCreateFolderBody(body: any): { name: string } {
  if (!body) {
    throw new Error('Request body is required');
  }
  
  validateFolderName(body.name);
  
  return { name: body.name.trim() };
}

export function validateRenameFolderBody(body: any): { name: string } {
  if (!body) {
    throw new Error('Request body is required');
  }
  
  validateFolderName(body.name);
  
  return { name: body.name.trim() };
}

// Item validation
export function validateToggleItemReadBody(body: any): { read: boolean } {
  if (!body) {
    throw new Error('Request body is required');
  }
  
  return { read: validateBoolean(body.read, 'read') };
}

export function validateToggleItemStarBody(body: any): { starred: boolean } {
  if (!body) {
    throw new Error('Request body is required');
  }
  
  return { starred: validateBoolean(body.starred, 'starred') };
}

export function validateUpdatePlaybackPositionBody(body: any): { position: number } {
  if (!body) {
    throw new Error('Request body is required');
  }
  
  return { position: validateNumber(body.position, 'position', 0, 999999) };
}

export function validateMarkAllReadBody(body: any): { feedUrl?: string; source?: string; before?: string } {
  if (!body) {
    throw new Error('Request body is required');
  }
  
  const result: any = {};
  
  if (body.feedUrl !== undefined) {
    validateFeedUrl(body.feedUrl);
    result.feedUrl = body.feedUrl.trim();
  }
  
  if (body.source !== undefined) {
    result.source = validateEnum(body.source, 'source', ['generic', 'youtube', 'reddit'] as const);
  }
  
  if (body.before !== undefined) {
    try {
      new Date(body.before);
      result.before = body.before;
    } catch {
      throw new Error('Invalid date format for "before" parameter');
    }
  }
  
  return result;
}

// Settings validation
export function validateUpdateSettingsBody(body: any): any {
  if (!body) {
    throw new Error('Request body is required');
  }
  
  const validIntervals = ['off', '15m', '30m', '1h', '4h', '8h', '12h', '24h'] as const;
  
  const result: any = {};
  
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== 'string') {
      throw new Error(`Setting "${key}" must be a string`);
    }
    
    if (key === 'sync_interval') {
      result[key] = validateEnum(value, key, validIntervals);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

// OPML validation
export function validateImportOpmlBody(body: any): { opml: string } {
  if (!body) {
    throw new Error('Request body is required');
  }
  
  if (!body.opml || typeof body.opml !== 'string') {
    throw new Error('OPML data is required and must be a string');
  }
  
  if (body.opml.trim().length === 0) {
    throw new Error('OPML data cannot be empty');
  }
  
  return { opml: body.opml.trim() };
}

// Query parameter validation
export function validatePaginationParams(query: any): { limit: number; offset: number } {
  const limit = validateNumber(
    query.limit ? parseInt(query.limit, 10) : 50,
    'limit',
    1,
    200
  );
  
  const offset = validateNumber(
    query.offset ? parseInt(query.offset, 10) : 0,
    'offset',
    0
  );
  
  return { limit, offset };
}

export function validateSearchParams(query: any): { q: string; limit: number; offset: number } {
  if (!query.q || typeof query.q !== 'string') {
    throw new Error('Search query parameter "q" is required');
  }
  
  validateSearchQuery(query.q);
  
  const { limit, offset } = validatePaginationParams(query);
  
  return { q: query.q.trim(), limit, offset };
}

// Parameter validation
export function validateFeedParams(params: any): { id: string } {
  if (!params || !params.id || typeof params.id !== 'string') {
    throw new Error('Feed ID is required');
  }
  if (params.id.trim().length === 0) {
    throw new Error('Feed ID cannot be empty');
  }
  return { id: params.id.trim() };
}

export function validateItemParams(params: any): { id: string } {
  if (!params || !params.id || typeof params.id !== 'string') {
    throw new Error('Item ID is required');
  }
  if (params.id.trim().length === 0) {
    throw new Error('Item ID cannot be empty');
  }
  return { id: params.id.trim() };
}

export function validateFolderParams(params: any): { id: string } {
  if (!params || !params.id || typeof params.id !== 'string') {
    throw new Error('Folder ID is required');
  }
  if (params.id.trim().length === 0) {
    throw new Error('Folder ID cannot be empty');
  }
  return { id: params.id.trim() };
}

// Body validation helpers (non-throwing versions)
export function validateFeedBody(body: any): { valid: boolean; error?: string } {
  try {
    validateCreateFeedBody(body);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Validation failed' };
  }
}

export function validateUpdateFeedBodySafe(body: any): { valid: boolean; error?: string } {
  try {
    validateUpdateFeedBody(body);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Validation failed' };
  }
}
