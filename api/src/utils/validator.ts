import { z } from 'zod';

/**
 * URL Validation
 */

// Allowed URL schemes
const ALLOWED_SCHEMES = ['http:', 'https:'];

// Maximum URL length to prevent abuse
const MAX_URL_LENGTH = 2048;

// Common malicious patterns
const MALICIOUS_PATTERNS = [
  /javascript:/i,
  /data:/i,
  /vbscript:/i,
];

/**
 * Validate a URL string
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_SCHEMES.includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Check if URL contains malicious patterns
 */
export function isMaliciousUrl(url: string): boolean {
  return MALICIOUS_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Validate and sanitize a URL
 */
export function validateAndSanitizeUrl(url: string): { valid: boolean; sanitized?: string } {
  // Check length
  if (url.length > MAX_URL_LENGTH) {
    return { valid: false };
  }

  // Check for malicious patterns
  if (isMaliciousUrl(url)) {
    return { valid: false };
  }

  // Validate URL format
  if (!isValidUrl(url)) {
    return { valid: false };
  }

  return { valid: true, sanitized: url };
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password must not exceed 128 characters' };
  }

  // Check for common weak passwords
  const commonPasswords = ['password', '123456', 'qwerty', 'abc123'];
  if (commonPasswords.includes(password.toLowerCase())) {
    return { valid: false, error: 'Password is too common' };
  }

  return { valid: true };
}

/**
 * Sanitize HTML content to prevent XSS
 */
export function sanitizeHtml(html: string): string {
  // Remove script tags and event handlers
  let sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"]*["'][^"]*\)/gi, '')
    .replace(/on\w+\s*=\s*["'][^"]*["'][^"]*\)/gi, '');

  return sanitized;
}

/**
 * Validate request body size
 */
export function validateRequestSize(body: any, maxSize: number = 10 * 1024 * 1024): { valid: boolean; error?: string } {
  const size = JSON.stringify(body).length;
  
  if (size > maxSize) {
    const sizeMB = (size / (1024 * 1024)).toFixed(2);
    return { valid: false, error: `Request body too large (${sizeMB}MB, max ${maxSize / (1024 * 1024)}MB)` };
  }

  return { valid: true };
}

/**
 * Validate feed URL with additional checks
 */
export function validateFeedUrl(url: string): { valid: boolean; error?: string } {
  const urlValidation = validateAndSanitizeUrl(url);
  
  if (!urlValidation.valid) {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Additional feed-specific checks
  try {
    const parsed = new URL(url);
    
    // Check for localhost/private IPs
    const hostname = parsed.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
      return { valid: false, error: 'Local/private IP addresses not allowed' };
    }

    // Check for file:// protocol
    if (parsed.protocol === 'file:') {
      return { valid: false, error: 'file:// protocol not allowed' };
    }
  } catch {
    return { valid: false, error: 'Invalid URL' };
  }

  return { valid: true };
}

/**
 * Create a Zod schema for feed URL validation
 */
export const FeedUrlSchema = z.string()
  .min(1, 'URL is required')
  .max(MAX_URL_LENGTH, `URL too long (max ${MAX_URL_LENGTH} characters)`)
  .refine((url) => isValidUrl(url), 'Invalid URL format')
  .refine((url) => !isMaliciousUrl(url), 'URL contains malicious patterns')
  .refine((url) => {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;
      return !hostname.includes('localhost') && 
             !hostname.includes('127.0.0.1') && 
             !hostname.startsWith('192.168.') && 
             !hostname.startsWith('10.') &&
             parsed.protocol !== 'file:';
    } catch {
      return false;
    }
  }, 'Local/private IP addresses not allowed');

/**
 * Create a Zod schema for email validation
 */
export const EmailSchema = z.string()
  .email('Invalid email format')
  .min(1, 'Email is required')
  .max(254, 'Email too long');

/**
 * Create a Zod schema for password validation
 */
export const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .refine((password) => {
    const commonPasswords = ['password', '123456', 'qwerty', 'abc123'];
    return !commonPasswords.includes(password.toLowerCase());
  }, 'Password is too common');

/**
 * Validate search query
 */
export const SearchQuerySchema = z.string()
  .min(1, 'Search query is required')
  .max(200, 'Search query too long')
  .refine((q) => {
    // Remove potentially dangerous characters
    const dangerous = /[<>{}|\\]/;
    return !dangerous.test(q);
  }, 'Search query contains invalid characters');
