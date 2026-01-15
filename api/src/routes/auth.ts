import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/client.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { generateToken } from '../middleware/auth.js';
import { RegisterSchema, LoginSchema } from '../types/schemas.js';

export default async function authRoutes(fastify: FastifyInstance, options: any) {
    // Register new user
    fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
        const result = RegisterSchema.safeParse(request.body);
        
        if (!result.success) {
            reply.code(400);
            return {
                ok: false,
                error: result.error.issues[0].message
            };
        }

        const { email, password } = result.data;

        try {
            // Check if user already exists
            const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
            if (existingUser) {
                reply.code(409);
                return {
                    ok: false,
                    error: 'User with this email already exists'
                };
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, 10);

            // Create user
            const userId = randomUUID();
            const now = new Date().toISOString();
            
            db.prepare(`
                INSERT INTO users (id, email, password_hash, created_at)
                VALUES (?, ?, ?, ?)
            `).run(userId, email, passwordHash, now);

            // Generate token
            const token = generateToken({ userId, email });

            return {
                ok: true,
                token,
                user: {
                    id: userId,
                    email
                }
            };
        } catch (error: any) {
            fastify.log.error(error);
            reply.code(500);
            return {
                ok: false,
                error: 'Failed to create user'
            };
        }
    });

    // Login
    fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
        const result = LoginSchema.safeParse(request.body);
        
        if (!result.success) {
            reply.code(400);
            return {
                ok: false,
                error: result.error.issues[0].message
            };
        }

        const { email, password } = result.data;

        try {
            // Find user
            const user = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email) as any;
            
            if (!user) {
                reply.code(401);
                return {
                    ok: false,
                    error: 'Invalid email or password'
                };
            }

            // Verify password
            const isValid = await bcrypt.compare(password, user.password_hash);
            
            if (!isValid) {
                reply.code(401);
                return {
                    ok: false,
                    error: 'Invalid email or password'
                };
            }

            // Update last login
            db.prepare('UPDATE users SET last_login = ? WHERE id = ?')
                .run(new Date().toISOString(), user.id);

            // Generate token
            const token = generateToken({ userId: user.id, email: user.email });

            return {
                ok: true,
                token,
                user: {
                    id: user.id,
                    email: user.email
                }
            };
        } catch (error: any) {
            fastify.log.error(error);
            reply.code(500);
            return {
                ok: false,
                error: 'Login failed'
            };
        }
    });

    // Get current user info
    fastify.get('/me', {
        onRequest: [async (request: any, reply: any) => {
            const authHeader = request.headers.authorization;
            if (!authHeader) {
                reply.code(401).send({ ok: false, error: 'No authorization header' });
                return;
            }
            const token = authHeader.replace('Bearer ', '');
            try {
                const jwt = (await import('jsonwebtoken')).default;
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change-me-in-production');
                request.user = decoded;
            } catch (error) {
                reply.code(401).send({ ok: false, error: 'Invalid token' });
                return;
            }
        }]
    }, async (request: any, reply: FastifyReply) => {
        try {
            const user = db.prepare('SELECT id, email, created_at, last_login FROM users WHERE id = ?')
                .get(request.user.userId) as any;
            
            if (!user) {
                reply.code(404);
                return {
                    ok: false,
                    error: 'User not found'
                };
            }

            return {
                ok: true,
                user: {
                    id: user.id,
                    email: user.email,
                    createdAt: user.created_at,
                    lastLogin: user.last_login
                }
            };
        } catch (error: any) {
            fastify.log.error(error);
            reply.code(500);
            return {
                ok: false,
                error: 'Failed to fetch user'
            };
        }
    });
}
