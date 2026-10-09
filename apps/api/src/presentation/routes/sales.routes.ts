import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomInt } from 'node:crypto';
import { prisma } from '../../infrastructure/database/prisma.js';
import { generateCortePdfBuffer } from '../../infrastructure/reports/pdfGenerator.js';

const processSaleSchema = z.object({
  routerId: z.string().min(1, 'routerId es obligatorio'),
  planId: z.string().min(1, 'planId es obligatorio'),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'CARD', 'OTHER']).default('CASH'),
  receivedAmount: z.coerce.number().optional(),
  notes: z.string().optional(),
});

export async function saleRoutes(fastify: FastifyInstance) {
  // POST /api/v1/sales (Venta rápida desde App Android o Panel Web)
  fastify.post('/sales', async (request: FastifyRequest, reply: FastifyReply) => {
    let userId: string;
    try {
      await request.jwtVerify();
      const payload = request.user as { id: string };
      userId = payload.id;
    } catch {
      // Si no viene JWT autenticado (modo kiosco o vendedor local), usar el usuario operador predeterminado
      const defaultUser = await prisma.user.findFirst({ where: { role: 'OPERADOR' } });
      userId = defaultUser?.id || (await prisma.user.findFirst())!.id;
    }

    const parseResult = processSaleSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0]?.message },
      });
    }

    const { routerId, planId, paymentMethod, receivedAmount, notes } = parseResult.data;

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: { router: true },
    });

    if (!plan) {
      return reply.status(404).send({ success: false, message: 'Plan no encontrado' });
    }

    // Buscar una ficha AVAILABLE o generar una instantáneamente
    let ticket = await prisma.ticket.findFirst({
      where: { routerId, planId, status: 'AVAILABLE' },
    });

    if (!ticket) {
      // Generación bajo demanda con 5 dígitos numéricos criptográficos seguros (sin letras ni colisiones)
      let uDigits = randomInt(10000, 100000).toString();
      let exists = await prisma.ticket.findFirst({ where: { routerId, username: uDigits } });
      while (exists) {
        uDigits = randomInt(10000, 100000).toString();
        exists = await prisma.ticket.findFirst({ where: { routerId, username: uDigits } });
      }

      let pDigits = randomInt(10000, 100000).toString();
      while (pDigits === uDigits) {
        pDigits = randomInt(10000, 100000).toString();
      }

      ticket = await prisma.ticket.create({
        data: {
          routerId,
          planId,
          username: uDigits,
          password: pDigits,
          status: 'AVAILABLE',
        },
      });
    }

    // Transacción ACID para asegurar que no se venda la misma ficha
    const result = await prisma.$transaction(async (tx) => {
      // Marcar ticket como SOLD
      const updatedTicket = await tx.ticket.update({
        where: { id: ticket.id },
        data: { status: 'SOLD' },
      });

      // Crear registro de venta
      const sale = await tx.sale.create({
        data: {
          userId,
          routerId,
          totalAmount: plan.price,
          paymentMethod,
          notes,
          items: {
            create: {
              ticketId: updatedTicket.id,
              unitPrice: plan.price,
            },
          },
        },
      });

      return { sale, ticket: updatedTicket };
    });

    const change = receivedAmount && receivedAmount > plan.price ? receivedAmount - plan.price : 0;

    // Generar formato QR amigable para Hotspot MikroTik
    // URL típica: http://hotspot.local/login?username=PIN&password=PIN
    const qrData = `http://${plan.router.host}/login?username=${result.ticket.username}&password=${result.ticket.password}`;

    return reply.status(201).send({
      success: true,
      data: {
        saleId: result.sale.id,
        pin: result.ticket.username,
        username: result.ticket.username,
        password: result.ticket.password,
        planName: plan.name,
        price: plan.price,
        durationFormatted: `${Math.floor(plan.durationSeconds / 3600)}h`,
        routerName: plan.router.name,
        paymentMethod,
        change,
        qrData,
        soldAt: result.sale.createdAt.toISOString(),
      },
      message: 'Venta registrada con éxito. Ficha lista para entrega al cliente.',
    });
  });

  // GET /api/v1/sales/summary (Corte de caja diario para el vendedor en Android)
  fastify.get('/sales/summary', async (request: FastifyRequest) => {
    let userId: string | undefined;
    try {
      await request.jwtVerify();
      const payload = request.user as { id: string };
      userId = payload.id;
    } catch {
      // Opcional
    }

    // Inicio del día actual a las 00:00:00
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todaySales = await prisma.sale.findMany({
      where: {
        userId: userId || undefined,
        createdAt: { gte: startOfDay },
      },
      include: {
        items: {
          include: {
            ticket: {
              include: { plan: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalRevenue = todaySales.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalTicketsSold = todaySales.reduce((acc, s) => acc + s.items.length, 0);

    return {
      success: true,
      data: {
        todayRevenue: totalRevenue,
        todayTicketsCount: totalTicketsSold,
        salesCount: todaySales.length,
        recentSales: todaySales.slice(0, 15).map((s) => ({
          id: s.id,
          totalAmount: s.totalAmount,
          paymentMethod: s.paymentMethod,
          time: s.createdAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          pin: s.items[0]?.ticket?.username || 'N/A',
          planName: s.items[0]?.ticket?.plan?.name || 'N/A',
        })),
      },
    };
  });

  // GET /api/v1/sales/report (Reportes financieros, auditoría y métricas reales)
  fastify.get('/sales/report', async (request: FastifyRequest) => {
    const query = request.query as { period?: string; routerId?: string };
    const period = query.period || 'month';
    const routerId = query.routerId;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let periodStart: Date | undefined;
    if (period === 'today') periodStart = startOfDay;
    else if (period === 'week') periodStart = startOfWeek;
    else if (period === 'month') periodStart = startOfMonth;

    const whereClause: any = {};
    if (periodStart) {
      whereClause.createdAt = { gte: periodStart };
    }
    if (routerId && routerId !== 'all') {
      whereClause.routerId = routerId;
    }

    const [periodSales, todaySales, weekSales, monthSales, allRouters] = await Promise.all([
      prisma.sale.findMany({
        where: whereClause,
        include: {
          user: { select: { id: true, username: true } },
          router: { select: { id: true, name: true, host: true } },
          items: {
            include: {
              ticket: {
                include: { plan: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.sale.findMany({
        where: { createdAt: { gte: startOfDay }, ...(routerId && routerId !== 'all' ? { routerId } : {}) },
        select: { totalAmount: true, items: { select: { id: true } } },
      }),
      prisma.sale.findMany({
        where: { createdAt: { gte: startOfWeek }, ...(routerId && routerId !== 'all' ? { routerId } : {}) },
        select: { totalAmount: true, items: { select: { id: true } } },
      }),
      prisma.sale.findMany({
        where: { createdAt: { gte: startOfMonth }, ...(routerId && routerId !== 'all' ? { routerId } : {}) },
        select: { totalAmount: true, items: { select: { id: true } } },
      }),
      prisma.router.findMany({ select: { id: true, name: true, host: true } }),
    ]);

    // Resúmenes de periodos
    const todayRevenue = todaySales.reduce((acc, s) => acc + s.totalAmount, 0);
    const todayTickets = todaySales.reduce((acc, s) => acc + s.items.length, 0);

    const weekRevenue = weekSales.reduce((acc, s) => acc + s.totalAmount, 0);
    const weekTickets = weekSales.reduce((acc, s) => acc + s.items.length, 0);

    const monthRevenue = monthSales.reduce((acc, s) => acc + s.totalAmount, 0);
    const monthTickets = monthSales.reduce((acc, s) => acc + s.items.length, 0);

    const totalRevenue = periodSales.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalTickets = periodSales.reduce((acc, s) => acc + s.items.length, 0);
    const averageDaily = monthRevenue > 0 ? Number((monthRevenue / 30).toFixed(2)) : 0;

    // Desglose por Router
    const routerMap: Record<string, { routerId: string; routerName: string; revenue: number; tickets: number }> = {};
    for (const r of allRouters) {
      routerMap[r.id] = { routerId: r.id, routerName: r.name, revenue: 0, tickets: 0 };
    }

    // Desglose por Plan
    const planMap: Record<string, { planName: string; price: number; revenue: number; tickets: number }> = {};

    // Desglose por Método de Pago
    const paymentMethods: Record<string, number> = { CASH: 0, TRANSFER: 0, CARD: 0, OTHER: 0 };

    for (const sale of periodSales) {
      if (routerMap[sale.routerId]) {
        routerMap[sale.routerId].revenue += sale.totalAmount;
        routerMap[sale.routerId].tickets += sale.items.length;
      }
      paymentMethods[sale.paymentMethod] = (paymentMethods[sale.paymentMethod] || 0) + sale.totalAmount;

      for (const item of sale.items) {
        const planName = item.ticket?.plan?.name || 'Plan Desconocido';
        const price = item.unitPrice || 0;
        if (!planMap[planName]) {
          planMap[planName] = { planName, price, revenue: 0, tickets: 0 };
        }
        planMap[planName].revenue += price;
        planMap[planName].tickets += 1;
      }
    }

    const detailedSales = periodSales.map((s) => {
      const ticket = s.items[0]?.ticket;
      return {
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        formattedDate: s.createdAt.toLocaleDateString('es-MX'),
        formattedTime: s.createdAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        vendor: s.user?.username || 'Kiosco',
        routerName: s.router?.name || 'Router',
        routerHost: s.router?.host || 'N/A',
        planName: ticket?.plan?.name || 'N/A',
        username: ticket?.username || 'N/A',
        password: ticket?.password || 'N/A',
        amount: s.totalAmount,
        paymentMethod: s.paymentMethod,
        notes: s.notes || '',
      };
    });

    return {
      success: true,
      data: {
        summary: {
          period,
          totalRevenue,
          totalTickets,
          salesCount: periodSales.length,
          todayRevenue,
          todayTickets,
          weekRevenue,
          weekTickets,
          monthRevenue,
          monthTickets,
          averageDaily,
        },
        paymentMethods,
        byRouter: Object.values(routerMap),
        byPlan: Object.values(planMap),
        transactions: detailedSales,
      },
    };
  });

  // GET /api/v1/sales/export/csv (Descarga real en archivo CSV)
  fastify.get('/sales/export/csv', async (request: FastifyRequest, reply: FastifyReply) => {
    const sales = await prisma.sale.findMany({
      include: {
        user: { select: { username: true } },
        router: { select: { name: true, host: true } },
        items: {
          include: {
            ticket: {
              include: { plan: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['ID_Venta', 'Fecha', 'Hora', 'Vendedor', 'Router', 'IP_Host', 'Plan', 'Usuario_PIN', 'Contrasena', 'Monto_MXN', 'Metodo_Pago'];
    const rows = sales.map((s) => {
      const dateStr = s.createdAt.toISOString().slice(0, 10);
      const timeStr = s.createdAt.toTimeString().slice(0, 8);
      const ticket = s.items[0]?.ticket;
      return [
        s.id,
        dateStr,
        timeStr,
        `"${s.user?.username || 'Kiosco'}"`,
        `"${s.router?.name || 'Router'}"`,
        `"${s.router?.host || ''}"`,
        `"${ticket?.plan?.name || ''}"`,
        `"${ticket?.username || ''}"`,
        `"${ticket?.password || ''}"`,
        s.totalAmount.toFixed(2),
        `"${s.paymentMethod}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="reporte_ventas_mikrofichas.csv"');
    return reply.send(csvContent);
  });

  // GET /api/v1/sales/export/pdf (Descarga real en archivo PDF)
  fastify.get('/sales/export/pdf', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { period?: string; routerId?: string };
    const period = query.period || 'today';
    const routerId = query.routerId;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let periodStart: Date | undefined;
    let periodLabel = 'Histórico Completo';
    if (period === 'today') {
      periodStart = startOfDay;
      periodLabel = `Hoy (${now.toLocaleDateString('es-MX')})`;
    } else if (period === 'week') {
      periodStart = startOfWeek;
      periodLabel = 'Últimos 7 Días';
    } else if (period === 'month') {
      periodStart = startOfMonth;
      periodLabel = 'Últimos 30 Días';
    }

    const whereClause: any = {};
    if (periodStart) {
      whereClause.createdAt = { gte: periodStart };
    }
    if (routerId && routerId !== 'all') {
      whereClause.routerId = routerId;
    }

    const [sales, allRouters] = await Promise.all([
      prisma.sale.findMany({
        where: whereClause,
        include: {
          user: { select: { username: true } },
          router: { select: { id: true, name: true, host: true } },
          items: {
            include: {
              ticket: {
                include: { plan: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.router.findMany({ select: { id: true, name: true } }),
    ]);

    const totalRevenue = sales.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalTickets = sales.reduce((acc, s) => acc + s.items.length, 0);

    const routerMap: Record<string, { routerName: string; revenue: number; tickets: number }> = {};
    for (const r of allRouters) {
      routerMap[r.id] = { routerName: r.name, revenue: 0, tickets: 0 };
    }

    const planMap: Record<string, { planName: string; price: number; revenue: number; tickets: number }> = {};
    const paymentMethods: Record<string, number> = { CASH: 0, TRANSFER: 0, CARD: 0, OTHER: 0 };

    for (const s of sales) {
      if (routerMap[s.routerId]) {
        routerMap[s.routerId].revenue += s.totalAmount;
        routerMap[s.routerId].tickets += s.items.length;
      }
      paymentMethods[s.paymentMethod] = (paymentMethods[s.paymentMethod] || 0) + s.totalAmount;

      for (const item of s.items) {
        const planName = item.ticket?.plan?.name || 'Plan Desconocido';
        const price = item.unitPrice || 0;
        if (!planMap[planName]) {
          planMap[planName] = { planName, price, revenue: 0, tickets: 0 };
        }
        planMap[planName].revenue += price;
        planMap[planName].tickets += 1;
      }
    }

    const transactions = sales.map((s) => {
      const ticket = s.items[0]?.ticket;
      return {
        id: s.id,
        formattedDate: s.createdAt.toLocaleDateString('es-MX'),
        formattedTime: s.createdAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        vendor: s.user?.username || 'Kiosco',
        routerName: s.router?.name || 'Router',
        planName: ticket?.plan?.name || 'N/A',
        username: ticket?.username || 'N/A',
        password: ticket?.password || '',
        amount: s.totalAmount,
        paymentMethod: s.paymentMethod,
      };
    });

    const pdfBuffer = await generateCortePdfBuffer({
      periodLabel,
      operatorName: sales[0]?.user?.username || 'Operador en Turno',
      totalRevenue,
      totalTickets,
      paymentMethods,
      byRouter: Object.values(routerMap).filter((r) => r.tickets > 0 || r.revenue > 0),
      byPlan: Object.values(planMap),
      transactions,
    });

    const filenameDate = now.toISOString().slice(0, 10);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="corte_caja_${filenameDate}.pdf"`);
    return reply.send(pdfBuffer);
  });
}

