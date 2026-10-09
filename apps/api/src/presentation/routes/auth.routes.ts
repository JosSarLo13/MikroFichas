import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database/prisma.js';
import { CryptoService } from '../../infrastructure/security/crypto.service.js';

const loginSchema = z.object({
  username: z.string().min(1, 'El nombre de usuario es obligatorio'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/v1/auth/login
  fastify.post('/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0]?.message || 'Datos de login inválidos',
        },
      });
    }

    const { username, password } = parseResult.data;

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.isActive) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Usuario o contraseña incorrectos.',
        },
      });
    }

    const isValidPassword = await CryptoService.verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Usuario o contraseña incorrectos.',
        },
      });
    }

    // Generar JWT
    const token = fastify.jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      { expiresIn: '7d' }
    );

    return {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        expiresIn: 604800, // 7 días en segundos
      },
      timestamp: new Date().toISOString(),
    };
  });

  // GET /api/v1/auth/me
  fastify.get('/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const payload = request.user as { id: string };
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, username: true, email: true, role: true, isActive: true },
      });

      if (!user) {
        return reply.status(404).send({ success: false, message: 'Usuario no encontrado' });
      }

      return {
        success: true,
        data: user,
      };
    } catch {
      return reply.status(401).send({ success: false, message: 'Token no válido o expirado' });
    }
  });
}
