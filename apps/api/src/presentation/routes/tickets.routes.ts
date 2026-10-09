import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomInt } from 'node:crypto';
import { prisma } from '../../infrastructure/database/prisma.js';
import { MikroTikService, HotspotUserInput } from '../../infrastructure/mikrotik/MikroTikService.js';

const generateTicketsSchema = z.object({
  routerId: z.string().min(1, 'routerId es obligatorio'),
  planId: z.string().min(1, 'planId es obligatorio'),
  quantity: z.coerce.number().min(1).max(500).default(1),
  prefix: z.string().max(8).optional().default(''),
  pinLength: z.coerce.number().min(4).max(12).default(5),
  authType: z.enum(['USER_PASSWORD', 'PIN_ONLY']).default('USER_PASSWORD'),
  syncAllRouters: z.coerce.boolean().default(true),
});

/**
 * Convierte duración en segundos al formato compatible con RouterOS (=limit-uptime)
 */
function formatSecondsToLimitUptime(seconds: number): string {
  if (seconds <= 0) return '';
  if (seconds % 86400 === 0) return `${seconds / 86400}d`;
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

/**
 * Genera números aleatorios criptográficamente seguros de N dígitos (sin letras).
 * Por ejemplo para length=5 genera entre 10000 y 99999 usando CSPRNG.
 */
function generateSecureRandomDigits(length: number): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length);
  return randomInt(min, max).toString();
}

export async function ticketRoutes(fastify: FastifyInstance) {
  // GET /api/v1/tickets
  fastify.get('/tickets', async (request: FastifyRequest) => {
    const { routerId, status, planId } = request.query as {
      routerId?: string;
      status?: string;
      planId?: string;
    };

    const tickets = await prisma.ticket.findMany({
      where: {
        routerId: routerId || undefined,
        status: status || undefined,
        planId: planId || undefined,
      },
      include: {
        plan: {
          select: { id: true, name: true, price: true, durationSeconds: true, downloadSpeedKbps: true, uploadSpeedKbps: true },
        },
        router: {
          select: { id: true, name: true, host: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return {
      success: true,
      data: tickets,
    };
  });

  // POST /api/v1/tickets/generate
  fastify.post('/tickets/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = generateTicketsSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0]?.message },
      });
    }

    const { routerId, planId, quantity, prefix, pinLength, authType, syncAllRouters } = parseResult.data;

    // 1. Verificar router y plan principal
    const primaryRouter = await prisma.router.findUnique({
      where: { id: routerId },
    });
    if (!primaryRouter) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Router principal no encontrado' },
      });
    }

    const primaryPlan = await prisma.plan.findFirst({
      where: { id: planId, routerId },
    });

    if (!primaryPlan) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'El plan especificado no pertenece a este router' },
      });
    }

    // 2. Determinar routers destino (uno o todos para roaming multizona)
    let targetRouters = [primaryRouter];
    if (syncAllRouters) {
      const allRouters = await prisma.router.findMany();
      if (allRouters.length > 0) {
        targetRouters = allRouters;
      }
    }

    const targetRouterIds = targetRouters.map((r) => r.id);

    // 3. Obtener todos los usuarios ya existentes en los routers objetivo para evitar colisiones
    const existingTickets = await prisma.ticket.findMany({
      where: { routerId: { in: targetRouterIds } },
      select: { username: true },
    });
    const takenUsernames = new Set<string>(existingTickets.map((t) => t.username));

    const generatedBatch: { username: string; password: string }[] = [];
    let attempts = 0;
    const maxAttempts = quantity * 100;

    // 4. Generar fichas con CSPRNG aleatorio de 5 dígitos seguros sin repetición
    while (generatedBatch.length < quantity && attempts < maxAttempts) {
      attempts++;
      const userDigits = generateSecureRandomDigits(pinLength);
      const username = prefix ? `${prefix}${userDigits}` : userDigits;

      if (!takenUsernames.has(username)) {
        takenUsernames.add(username);

        let password = username;
        if (authType === 'USER_PASSWORD') {
          let passDigits = generateSecureRandomDigits(pinLength);
          while (passDigits === userDigits) {
            passDigits = generateSecureRandomDigits(pinLength);
          }
          password = prefix ? `${prefix}${passDigits}` : passDigits;
        }

        generatedBatch.push({
          username,
          password,
        });
      }
    }

    // 5. Insertar las mismas fichas en la base de datos para cada router objetivo
    for (const targetRouter of targetRouters) {
      let currentPlanId = primaryPlan.id;

      if (targetRouter.id !== primaryRouter.id) {
        // Buscar o replicar el plan homólogo en el router secundario
        let counterpartPlan = await prisma.plan.findFirst({
          where: { routerId: targetRouter.id, name: primaryPlan.name },
        });

        if (!counterpartPlan) {
          counterpartPlan = await prisma.plan.create({
            data: {
              name: primaryPlan.name,
              price: primaryPlan.price,
              durationSeconds: primaryPlan.durationSeconds,
              validityType: primaryPlan.validityType,
              downloadSpeedKbps: primaryPlan.downloadSpeedKbps,
              uploadSpeedKbps: primaryPlan.uploadSpeedKbps,
              sharedUsers: primaryPlan.sharedUsers,
              hotspotProfileName: primaryPlan.hotspotProfileName,
              routerId: targetRouter.id,
            },
          });
        }
        currentPlanId = counterpartPlan.id;
      }

      const routerTicketsData = generatedBatch.map((t) => ({
        routerId: targetRouter.id,
        planId: currentPlanId,
        username: t.username,
        password: t.password,
        status: 'AVAILABLE',
      }));

      await prisma.ticket.createMany({
        data: routerTicketsData,
      });
    }

    // 6. Inyectar físicamente en MikroTik Hotspot vía API en cada router
    const limitUptime = formatSecondsToLimitUptime(primaryPlan.durationSeconds);
    const hotspotUsers: HotspotUserInput[] = generatedBatch.map((t) => ({
      name: t.username,
      password: t.password,
      profile: primaryPlan.hotspotProfileName || 'default',
      limitUptime: limitUptime,
      comment: `MikroFichas ${primaryPlan.name} ($${primaryPlan.price})`,
    }));

    const syncResults: { routerName: string; online: boolean; injectedCount: number; message: string }[] = [];

    for (const targetRouter of targetRouters) {
      try {
        const batchRes = await MikroTikService.injectHotspotUsersBatch(targetRouter, hotspotUsers);
        if (batchRes.injectedCount > 0) {
          syncResults.push({
            routerName: targetRouter.name,
            online: true,
            injectedCount: batchRes.injectedCount,
            message: `${batchRes.injectedCount} fichas inyectadas activas`,
          });

          await prisma.router.update({
            where: { id: targetRouter.id },
            data: { status: 'ONLINE', lastSeenAt: new Date() },
          }).catch(() => {});
        } else {
          syncResults.push({
            routerName: targetRouter.name,
            online: false,
            injectedCount: 0,
            message: batchRes.errors[0] || 'Guardado en BD (Router no respondió API)',
          });
        }
      } catch (err: any) {
        syncResults.push({
          routerName: targetRouter.name,
          online: false,
          injectedCount: 0,
          message: `Guardado en BD (Offline: ${err.message})`,
        });
      }
    }

    const onlineCount = syncResults.filter((s) => s.online).length;

    return reply.status(201).send({
      success: true,
      data: {
        quantity: generatedBatch.length,
        planName: primaryPlan.name,
        price: primaryPlan.price,
        durationSeconds: primaryPlan.durationSeconds,
        downloadSpeedKbps: primaryPlan.downloadSpeedKbps,
        uploadSpeedKbps: primaryPlan.uploadSpeedKbps,
        authType,
        targetRoutersCount: targetRouters.length,
        syncedRouters: syncResults.map((s) => `${s.routerName}: ${s.message}`),
        tickets: generatedBatch.map((t) => ({
          username: t.username,
          password: t.password,
          pin: t.username,
        })),
      },
      message: targetRouters.length > 1
        ? `🎉 ${generatedBatch.length} fichas universales generadas y sincronizadas en ${targetRouters.length} routers (${onlineCount} conectados en vivo).`
        : `🎉 ${generatedBatch.length} fichas generadas e inyectadas en MikroTik.`,
    });
  });
}
