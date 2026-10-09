import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database/prisma.js';

const createPlanSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  price: z.coerce.number().positive('El precio debe ser mayor a 0'),
  durationSeconds: z.coerce.number().positive().default(7200),
  validityType: z.enum(['UPTIME_ACCUMULATED', 'WALL_CLOCK_CALENDAR']).default('UPTIME_ACCUMULATED'),
  downloadSpeedKbps: z.coerce.number().default(5120),
  uploadSpeedKbps: z.coerce.number().default(2048),
  sharedUsers: z.coerce.number().default(1),
  routerId: z.string().min(1, 'El routerId es obligatorio'),
  hotspotProfileName: z.string().default('default'),
});

export async function planRoutes(fastify: FastifyInstance) {
  // GET /api/v1/plans (consumido por la App Android para mostrar lista de planes)
  fastify.get('/plans', async (request: FastifyRequest) => {
    const { routerId } = request.query as { routerId?: string };

    const plans = await prisma.plan.findMany({
      where: routerId ? { routerId } : undefined,
      include: {
        router: {
          select: { id: true, name: true, host: true },
        },
        _count: {
          select: {
            tickets: {
              where: { status: 'AVAILABLE' },
            },
          },
        },
      },
      orderBy: { price: 'asc' },
    });

    const formatted = plans.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      durationSeconds: p.durationSeconds,
      durationFormatted:
        p.durationSeconds >= 86400
          ? `${Math.floor(p.durationSeconds / 86400)} Día(s)`
          : `${Math.floor(p.durationSeconds / 3600)} Hora(s)`,
      validityType: p.validityType,
      downloadSpeedKbps: p.downloadSpeedKbps,
      uploadSpeedKbps: p.uploadSpeedKbps,
      sharedUsers: p.sharedUsers,
      routerId: p.routerId,
      routerName: p.router.name,
      availableStock: p._count.tickets,
    }));

    return {
      success: true,
      data: formatted,
    };
  });

  // POST /api/v1/plans
  fastify.post('/plans', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createPlanSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0]?.message },
      });
    }

    const plan = await prisma.plan.create({
      data: parseResult.data,
    });

    return reply.status(201).send({
      success: true,
      data: plan,
      message: 'Plan creado con éxito',
    });
  });
}
