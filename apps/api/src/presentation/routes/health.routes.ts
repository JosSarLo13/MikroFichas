import { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async () => {
    const memory = process.memoryUsage();
    return {
      success: true,
      data: {
        status: 'healthy',
        service: 'MikroManager API Gateway',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsageMb: {
          rss: Math.round(memory.rss / (1024 * 1024)),
          heapTotal: Math.round(memory.heapTotal / (1024 * 1024)),
          heapUsed: Math.round(memory.heapUsed / (1024 * 1024)),
        },
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  });
}
