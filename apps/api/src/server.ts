import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { env } from './config/env.js';
import { healthRoutes } from './presentation/routes/health.routes.js';
import { authRoutes } from './presentation/routes/auth.routes.js';
import { routerRoutes } from './presentation/routes/routers.routes.js';
import { planRoutes } from './presentation/routes/plans.routes.js';
import { ticketRoutes } from './presentation/routes/tickets.routes.js';
import { saleRoutes } from './presentation/routes/sales.routes.js';
import { hotspotRoutes } from './presentation/routes/hotspot.routes.js';

export async function buildServer() {
  const app = fastify({
    logger: true,
    trustProxy: true,
  });

  // 1. Plugins de Seguridad y Red
  await app.register(cors, {
    origin: (origin, cb) => {
      // Permitir solicitudes locales o sin cabecera origin (curl, apps móviles, etc.)
      if (!origin || env.NODE_ENV === 'development') {
        cb(null, true);
        return;
      }
      const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
      if (allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error('Bloqueado por política CORS de MikroManager'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(helmet, {
    contentSecurityPolicy: false, // Permitir websockets y assets en dev
  });

  // 2. JWT Plugin para Autorización
  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  // 3. Soporte WebSocket para Telemetría en Vivo
  await app.register(websocket);

  // 4. Manejador de Errores Global Estandarizado
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    const err = error as { statusCode?: number; code?: string; message: string };
    const statusCode = err.statusCode || 500;
    reply.status(statusCode).send({
      success: false,
      error: {
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message:
          env.NODE_ENV === 'production' && statusCode === 500
            ? 'Ocurrió un error interno en el servidor.'
            : err.message,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // 5. Registro de Rutas API
  app.get('/', async () => {
    return {
      service: 'MikroManager API Gateway',
      version: '1.0.0',
      description: 'Controlador de Redes Hotspot y MikroTik RouterOS',
      documentation: '/docs',
      health: '/api/v1/health',
      timestamp: new Date().toISOString(),
    };
  });
  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(routerRoutes, { prefix: '/api/v1' });
  await app.register(planRoutes, { prefix: '/api/v1' });
  await app.register(ticketRoutes, { prefix: '/api/v1' });
  await app.register(saleRoutes, { prefix: '/api/v1' });
  await app.register(hotspotRoutes, { prefix: '/api/v1' });

  return app;
}

// Inicialización del proceso del servidor
async function start() {
  const app = await buildServer();
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`⚡ MikroManager API activa y lista en http://${env.HOST}:${env.PORT}`);
    app.log.info(`📡 Healthcheck disponible en http://${env.HOST}:${env.PORT}/api/v1/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Ejecutar si es el módulo principal
if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  start();
}
