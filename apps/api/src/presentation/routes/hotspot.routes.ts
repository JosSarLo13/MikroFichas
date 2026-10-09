import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../../infrastructure/database/prisma.js';
import { MikroTikService } from '../../infrastructure/mikrotik/MikroTikService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.resolve(__dirname, '../../infrastructure/hotspot/templates/sarmientos');

const kickUserSchema = z.object({
  routerId: z.string().min(1, 'routerId es obligatorio'),
  sessionId: z.string().min(1, 'sessionId (*ID) es obligatorio'),
});


export async function hotspotRoutes(fastify: FastifyInstance) {
  // GET /api/v1/hotspot/active (Sesiones activas en vivo desde MikroTik)
  fastify.get('/hotspot/active', async (request: FastifyRequest, reply: FastifyReply) => {
    const { routerId } = request.query as { routerId?: string };

    const router = routerId
      ? await prisma.router.findUnique({ where: { id: routerId } })
      : await prisma.router.findFirst();

    if (!router) {
      return reply.status(404).send({ success: false, message: 'No hay routers registrados' });
    }

    try {
      const activeSessions = await MikroTikService.getActiveSessions(router);
      return {
        success: true,
        data: {
          routerId: router.id,
          routerName: router.name,
          activeCount: activeSessions.length,
          sessions: activeSessions,
        },
      };
    } catch (error: any) {
      return reply.status(502).send({
        success: false,
        error: {
          code: 'HOTSPOT_FETCH_FAILED',
          message: `No se pudieron obtener las sesiones activas de ${router.name}: ${error.message}`,
        },
      });
    }
  });

  // POST /api/v1/hotspot/kick (Desconexión forzada de cliente en Capa 2/3)
  fastify.post('/hotspot/kick', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = kickUserSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0]?.message },
      });
    }

    const { routerId, sessionId } = parseResult.data;
    const router = await prisma.router.findUnique({ where: { id: routerId } });

    if (!router) {
      return reply.status(404).send({ success: false, message: 'Router no encontrado' });
    }

    try {
      await MikroTikService.kickActiveSession(router, sessionId);
      return {
        success: true,
        message: `Usuario expulsado exitosamente de MikroTik (Sesión ID ${sessionId}).`,
      };
    } catch (error: any) {
      return reply.status(502).send({
        success: false,
        error: {
          code: 'KICK_FAILED',
          message: `Error al expulsar la sesión en MikroTik: ${error.message}`,
        },
      });
    }
  });

  // GET /api/v1/hotspot/template/preview (Vista previa en vivo del portal en HTML)
  fastify.get('/hotspot/template/preview', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const loginHtmlPath = path.join(templatesDir, 'login.html');
      let html = fs.readFileSync(loginHtmlPath, 'utf8');

      // Reemplazar variables MikroTik para la vista previa
      html = html
        .replace(/\$\(link-login-only\)/g, '#')
        .replace(/\$\(link-orig\)/g, 'https://google.com')
        .replace(/\$\(ip\)/g, '10.5.50.145')
        .replace(/\$\(mac\)/g, 'AA:BB:CC:DD:EE:FF')
        .replace(/\$\(if error\)[\s\S]*?\$\(endif\)/g, '');

      reply.type('text/html').send(html);
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: `Error al cargar plantilla: ${err.message}` });
    }
  });

  // GET /api/v1/hotspot/template/files (Obtener contenido de los archivos del portal)
  fastify.get('/hotspot/template/files', async () => {
    const loginHtml = fs.readFileSync(path.join(templatesDir, 'login.html'), 'utf8');
    const statusHtml = fs.readFileSync(path.join(templatesDir, 'status.html'), 'utf8');
    const logoutHtml = fs.readFileSync(path.join(templatesDir, 'logout.html'), 'utf8');

    return {
      success: true,
      data: {
        brand: 'Fichas Sarmientos',
        files: [
          { name: 'login.html', path: 'hotspot/login.html', sizeBytes: Buffer.byteLength(loginHtml), content: loginHtml },
          { name: 'status.html', path: 'hotspot/status.html', sizeBytes: Buffer.byteLength(statusHtml), content: statusHtml },
          { name: 'logout.html', path: 'hotspot/logout.html', sizeBytes: Buffer.byteLength(logoutHtml), content: logoutHtml },
        ],
      },
    };
  });

  // POST /api/v1/routers/:id/hotspot/install-template (Instalar archivos directamente en el MikroTik)
  fastify.post('/routers/:id/hotspot/install-template', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const router = await prisma.router.findUnique({ where: { id } });

    if (!router) {
      return reply.status(404).send({ success: false, message: 'Router no encontrado' });
    }

    const loginHtml = fs.readFileSync(path.join(templatesDir, 'login.html'), 'utf8');
    const statusHtml = fs.readFileSync(path.join(templatesDir, 'status.html'), 'utf8');
    const logoutHtml = fs.readFileSync(path.join(templatesDir, 'logout.html'), 'utf8');

    const filesToUpload = [
      { name: 'hotspot/login.html', content: loginHtml },
      { name: 'hotspot/status.html', content: statusHtml },
      { name: 'hotspot/logout.html', content: logoutHtml },
    ];

    let uploadedCount = 0;
    const errors: string[] = [];

    for (const f of filesToUpload) {
      try {
        await MikroTikService.uploadPortalFile(router, f.name, f.content);
        uploadedCount++;
      } catch (err: any) {
        errors.push(`${f.name}: ${err.message}`);
      }
    }

    if (uploadedCount > 0) {
      return {
        success: true,
        data: {
          installedFiles: uploadedCount,
          totalFiles: filesToUpload.length,
          brand: 'Fichas Sarmientos',
        },
        message: `🎉 ¡Portal Cautivo 'Fichas Sarmientos' instalado exitosamente en ${router.name} (${uploadedCount}/${filesToUpload.length} archivos subidos)!`,
      };
    } else {
      return reply.status(200).send({
        success: false,
        data: {
          errors,
          manualScript: `# Ejecuta esto en Winbox Terminal para instalar el portal:\n/file add name=hotspot/login.html contents="${loginHtml.replace(/"/g, '\\"')}"`,
        },
        message: `⚠️ No se pudo inyectar por socket directo: ${errors[0] || 'Router offline'}. Asegúrate de que el router esté online en ZeroTier.`,
      });
    }
  });
}

