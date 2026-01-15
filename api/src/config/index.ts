// Environment configuration with validation
// Note: Using native validation instead of zod to avoid adding dependencies

function parseNumber(value: string, defaultValue: number): number {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseEnum<T extends string>(value: string | undefined, values: readonly T[], defaultValue: T): T {
  if (!value) return defaultValue;
  return values.includes(value as T) ? (value as T) : defaultValue;
}

export const env = {
  PORT: parseNumber(process.env.PORT || '3000', 3000),
  DB_PATH: process.env.DB_PATH || (process.env.NODE_ENV === 'production' ? '/data/feedstream.sqlite' : './data/feedstream.sqlite'),
  FETCH_TIMEOUT_MS: parseNumber(process.env.FETCH_TIMEOUT_MS || '12000', 12000),
  MAX_CONCURRENCY: parseNumber(process.env.MAX_CONCURRENCY || '6', 6),
  READER_CACHE_TTL_HOURS: parseNumber(process.env.READER_CACHE_TTL_HOURS || '168', 168),
  MAX_JOBS: parseNumber(process.env.MAX_JOBS || '5', 5),
  SYNC_INTERVAL_KEY: process.env.SYNC_INTERVAL_KEY || 'sync_interval',
  LAST_SYNC_KEY: process.env.LAST_SYNC_KEY || 'last_global_sync',
  LAST_BACKUP_KEY: process.env.LAST_BACKUP_KEY || 'last_auto_backup',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  NODE_ENV: parseEnum(process.env.NODE_ENV, ['development', 'production', 'test'] as const, 'development'),
  // CORS configuration - comma-separated list of allowed origins
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || ''
} as const;

export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
