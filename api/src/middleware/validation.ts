import { FastifyRequest, FastifyReply } from 'fastify';
import { 
  validateFeedUrl, 
  validateRequestSize,
  isValidEmail,
  validatePassword,
  sanitizeHtml,
  SearchQuerySchema,
  FeedUrlSchema,
  EmailSchema,
  PasswordSchema
} from '../utils/validator.js';
import { z } from 'zod';

/**
 * Validation middleware factory
 * Creates middleware that validates request body against a schema
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.body);
    
    if (!result.success) {
      reply.code(400);
      return {
        ok: false,
        error: result.error.issues[0].message
      };
    }
    
    // Attach validated data to request
    (request as any).validatedBody = result.data;
  };
}

/**
 * Validate query parameters
 */
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.query);
    
    if (!result.success) {
      reply.code(400);
      return {
        ok: false,
        error: result.error.issues[0].message
      };
    }
    
    // Attach validated data to request
    (request as any).validatedQuery = result.data;
  };
}

/**
 * Validate feed URL with security checks
 */
export async function validateFeedUrlMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const body = request.body as any;
  
  if (!body.url) {
    reply.code(400);
    reply.send({
      ok: false,
      error: 'URL is required'
    });
    return;
  }

  const validation = validateFeedUrl(body.url);
  
  if (!validation.valid) {
    reply.code(400);
    reply.send({
      ok: false,
      error: validation.error || 'Invalid URL'
    });
    return;
  }

  // Attach sanitized URL
  (request as any).sanitizedUrl = validation.sanitized || body.url;
}

/**
 * Validate and sanitize HTML content
 */
export function sanitizeHtmlMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply, next: () => void) => {
    const body = request.body as any;
    
    if (body.html) {
      (request as any).sanitizedHtml = sanitizeHtml(body.html);
    }
    
    await next();
  };
}

/**
 * Validate request size to prevent DoS attacks
 */
export function validateRequestSizeMiddleware(maxSize: number = 10 * 1024 * 1024) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const contentLength = request.headers['content-length'];
    
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      
      if (size > maxSize) {
        reply.code(413);
        reply.send({
          ok: false,
          error: `Request body too large (max ${maxSize / (1024 * 1024)}MB)`
        });
        return;
      }
    }
    
    await next();
  };
}

/**
 * Validate search query to prevent injection
 */
export function validateSearchQueryMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    
    if (!query.q) {
      reply.code(400);
      reply.send({
        ok: false,
        error: 'Search query is required'
      });
      return;
    }

    const validation = SearchQuerySchema.safeParse(query);
    
    if (!validation.success) {
      reply.code(400);
      reply.send({
        ok: false,
        error: validation.error.issues[0].message
      });
      return;
    }

    // Attach validated query
    (request as any).validatedQuery = validation.data;
    await next();
  };
}

/**
 * Extended schemas with validation
 */
export const RegisterSchemaExtended = RegisterSchema.extend({
  email: EmailSchema,
  password: PasswordSchema
});

export const LoginSchemaExtended = LoginSchema.extend({
  email: EmailSchema,
  password: PasswordSchema
});

export const AddFeedSchemaExtended = AddFeedSchema.extend({
  url: FeedUrlSchema
});
