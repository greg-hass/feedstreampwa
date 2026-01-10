import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorHandler(error: Error, request: FastifyRequest, reply: FastifyReply) {
  // Log the error
  request.log.error({
    error: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method
  }, 'Request error');

  // Handle API errors
  if (error instanceof ApiError) {
    reply.code(error.statusCode).send({
      ok: false,
      error: error.message,
      ...(error.details && { details: error.details })
    });
    return;
  }

  // Handle Fastify validation errors (check for validation property)
  if ('validation' in error && Array.isArray((error as any).validation)) {
    reply.code(400).send({
      ok: false,
      error: 'Validation failed',
      details: (error as any).validation
    });
    return;
  }

  // Handle other errors
  reply.code(500).send({
    ok: false,
    error: 'Internal server error'
  });
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  reply.code(404).send({
    ok: false,
    error: 'Not found',
    path: request.url
  });
}
