import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database/prisma.js';
import { CryptoService } from '../../infrastructure/security/crypto.service.js';
import { MikroTikService } from '../../infrastructure/mikrotik/MikroTikService.js';
import { discoverMikrotiks } from '../../infrastructure/mikrotik/discovery.js';

const createRouterSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  host: z.string().min(1, 'El host o IP es obligatorio'),
  apiPort: z.coerce.number().default(8728),
  useSsl: z.boolean().default(false),
  username: z.string().min(1, 'El usuario es obligatorio'),
  password: z.string().default(''),
});

const quickConnectRouterSchema = z.object({
  name: z.string().optional(),
  host: z.string().min(1, 'El host o IP es obligatorio'),
  apiPort: z.coerce.number().default(8728),
  useSsl: z.boolean().default(false),
  username: z.string().default('admin'),
  password: z.string().default(''),
  connectVia: z.enum(['ip', 'mac']).default('ip'),
  mac: z.string().optional(),
});

export async function routerRoutes(fastify: FastifyInstance) {
  // GET /api/v1/routers
  fastify.get('/routers', async () => {
    const routers = await prisma.router.findMany({
      select: {
        id: true,
        name: true,
        host: true,
        apiPort: true,
        useSsl: true,
        username: true,
        rosVersion: true,
        identity: true,
        status: true,
        lastSeenAt: true,
        createdAt: true,
        _count: {
          select: { plans: true, tickets: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: routers,
    };
  });

  // GET /api/v1/routers/suggest-ip (Sugerir IP libre y subred Hotspot sin colisiones)
  fastify.get('/routers/suggest-ip', async () => {
    const routers = await prisma.router.findMany({
      select: { id: true, name: true, host: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const occupiedHosts = routers.map((r) => r.host.trim());
    const count = routers.length;

    // Calcular siguiente subred Hotspot única (ej. 10.5.10.0/24, 10.5.20.0/24, etc.)
    const nextOctet = (count + 1) * 10;
    const suggestedSubnet = `10.5.${nextOctet}.0/24`;
    const suggestedGateway = `10.5.${nextOctet}.1`;

    // Calcular siguiente IP sugerida para el MikroTik
    let suggestedHost = '192.168.88.1';
    if (occupiedHosts.includes(suggestedHost)) {
      let found = false;
      for (let i = 2; i <= 254; i++) {
        const candidate = `192.168.88.${i}`;
        if (!occupiedHosts.includes(candidate)) {
          suggestedHost = candidate;
          found = true;
          break;
        }
      }
      if (!found) {
        suggestedHost = `10.5.${nextOctet}.1`;
      }
    }

    const occupiedSubnets = routers.map((_, idx) => `10.5.${(idx + 1) * 10}.0/24`);

    return {
      success: true,
      data: {
        suggestedHost,
        suggestedSubnet,
        suggestedGateway,
        occupiedHosts,
        occupiedSubnets,
      },
    };
  });

  // GET /api/v1/routers/discover (Descubrimiento tipo Winbox Neighbors vía MNDP UDP 5678)
  fastify.get('/routers/discover', async (request: FastifyRequest) => {
    const query = request.query as { timeoutMs?: string; port?: string };
    const timeoutMs = Math.min(Math.max(Number(query?.timeoutMs) || 3500, 1500), 10000);
    const apiPort = Number(query?.port) || 8728;

    const [devices, existingRouters] = await Promise.all([
      discoverMikrotiks(timeoutMs, apiPort),
      prisma.router.findMany({
        select: { id: true, name: true, host: true, status: true, identity: true },
      }),
    ]);

    const existingMap = new Map<string, typeof existingRouters[0]>();
    for (const r of existingRouters) {
      existingMap.set(r.host.toLowerCase().trim(), r);
    }

    const enriched = devices.map((d) => {
      const matched = d.ipv4 ? existingMap.get(d.ipv4.toLowerCase().trim()) : null;
      return {
        ...d,
        isRegistered: Boolean(matched),
        registeredRouterId: matched?.id || null,
        registeredRouterName: matched?.name || null,
      };
    });

    return {
      success: true,
      data: enriched,
      count: enriched.length,
    };
  });

  // POST /api/v1/routers/quick-connect (Conectar y registrar MikroTik detectado vía IP o MAC)
  fastify.post('/routers/quick-connect', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = quickConnectRouterSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0]?.message },
      });
    }

    const { name, host, apiPort, useSsl, username, password } = parseResult.data;
    const cleanHost = host.trim();

    // 1. Probar credenciales directamente con el RouterOS
    const testRes = await MikroTikService.testCredentials({
      host: cleanHost,
      port: apiPort,
      useSsl,
      username: username.trim(),
      password,
    });

    if (!testRes.ok) {
      let friendlyHelp = testRes.message;
      if (testRes.code === 'AUTH_FAILED') {
        friendlyHelp += ' Si tu equipo es nuevo de fábrica, asegúrate de dejar la contraseña en blanco (vacía).';
      } else if (testRes.code === 'API_REFUSED') {
        friendlyHelp += ' Puedes habilitar la API con el comando Winbox: /ip service enable api';
      } else if (testRes.code === 'API_TIMEOUT') {
        friendlyHelp += ' Verifica que estés conectado a los puertos ether2-ether5 (LAN) o al Wi-Fi del MikroTik, ya que ether1 (WAN) suele bloquear la API por firewall de fábrica.';
      }
      return reply.status(400).send({
        success: false,
        error: {
          code: testRes.code,
          message: friendlyHelp,
        },
      });
    }

    // 2. Cifrar contraseña con AES-256-GCM
    const encrypted = CryptoService.encryptPassword(password);

    // 3. Crear o actualizar registro
    const existing = await prisma.router.findFirst({
      where: { host: cleanHost },
    });

    let router;
    if (existing) {
      router = await prisma.router.update({
        where: { id: existing.id },
        data: {
          name: name?.trim() || existing.name,
          username: username.trim(),
          encryptedPassword: encrypted.encryptedText,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          identity: testRes.identity,
          rosVersion: testRes.rosVersion,
          status: 'ONLINE',
          lastSeenAt: new Date(),
        },
      });
    } else {
      const finalName = name?.trim() || (testRes.identity && testRes.identity !== 'MikroTik' ? testRes.identity : `MikroTik-${cleanHost}`);
      router = await prisma.router.create({
        data: {
          name: finalName,
          host: cleanHost,
          apiPort,
          useSsl,
          username: username.trim(),
          encryptedPassword: encrypted.encryptedText,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          identity: testRes.identity,
          rosVersion: testRes.rosVersion,
          status: 'ONLINE',
          lastSeenAt: new Date(),
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: {
        id: router.id,
        name: router.name,
        host: router.host,
        identity: testRes.identity,
        rosVersion: testRes.rosVersion,
        boardName: testRes.boardName,
        latencyMs: testRes.latencyMs,
        status: router.status,
      },
      message: `¡Conexión exitosa con ${testRes.identity}! Router sincronizado (${testRes.boardName}, ROS ${testRes.rosVersion}).`,
    });
  });

  // POST /api/v1/routers

  fastify.post('/routers', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createRouterSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0]?.message },
      });
    }

    const { name, host, apiPort, useSsl, username, password } = parseResult.data;
    const cleanHost = host.trim();

    // Validar que la IP/Host no esté ya asignada a otro router (evitar colisiones de red)
    const existingHost = await prisma.router.findFirst({
      where: { host: cleanHost },
    });
    if (existingHost) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'DUPLICATE_HOST',
          message: `La dirección IP o host '${cleanHost}' ya está registrada en el router '${existingHost.name}'. Para evitar conflictos de red, usa una IP diferente o el modo automático.`,
        },
      });
    }

    // Cifrar contraseña con AES-256-GCM
    const encrypted = CryptoService.encryptPassword(password);

    const router = await prisma.router.create({
      data: {
        name: name.trim(),
        host: cleanHost,
        apiPort,
        useSsl,
        username: username.trim(),
        encryptedPassword: encrypted.encryptedText,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        status: 'UNCHECKED',
      },
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: router.id,
        name: router.name,
        host: router.host,
        apiPort: router.apiPort,
        useSsl: router.useSsl,
        username: router.username,
        status: router.status,
      },
      message: 'Router registrado con éxito y credenciales protegidas con AES-256-GCM.',
    });
  });

  // DELETE /api/v1/routers/:id
  fastify.delete('/routers/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      await prisma.$transaction([
        prisma.ticket.deleteMany({ where: { routerId: id } }),
        prisma.sale.deleteMany({ where: { routerId: id } }),
        prisma.plan.deleteMany({ where: { routerId: id } }),
        prisma.router.delete({ where: { id } }),
      ]);
      return { success: true, message: 'Router y sus registros asociados eliminados correctamente.' };
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: `Error al eliminar router: ${error.message}` });
    }
  });

  // POST /api/v1/routers/:id/test (Prueba real de socket y autenticación RouterOS)
  fastify.post('/routers/:id/test', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const router = await prisma.router.findUnique({ where: { id } });

    if (!router) {
      return reply.status(404).send({ success: false, message: 'Router no encontrado' });
    }

    try {
      const result = await MikroTikService.testConnection(router);

      await prisma.router.update({
        where: { id: router.id },
        data: {
          status: 'ONLINE',
          identity: result.identity,
          rosVersion: result.rosVersion,
          lastSeenAt: new Date(),
        },
      });

      return {
        success: true,
        data: {
          online: true,
          latencyMs: result.latencyMs,
          identity: result.identity,
          rosVersion: result.rosVersion,
          boardName: result.boardName,
          cpuLoad: result.cpuLoad,
          freeMemoryMb: result.freeMemoryMb,
          totalMemoryMb: result.totalMemoryMb,
          uptime: result.uptime,
        },
        message: `✅ Conexión y autenticación exitosa con '${result.identity}' (RouterOS v${result.rosVersion}) en ${result.latencyMs}ms.`,
      };
    } catch (error: any) {
      await prisma.router.update({
        where: { id: router.id },
        data: { status: 'OFFLINE' },
      });

      return reply.status(502).send({
        success: false,
        error: {
          code: 'ROUTER_CONNECTION_FAILED',
          message: error.message || 'No se pudo conectar con el router MikroTik.',
        },
      });
    }
  });

  // GET /api/v1/routers/:id/telemetry (Telemetría completa en vivo: CPU, RAM, Uptime, Hotspot Activos)
  fastify.get('/routers/:id/telemetry', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const router = await prisma.router.findUnique({
      where: { id },
      include: {
        _count: { select: { plans: true, tickets: true } },
      },
    });

    if (!router) {
      return reply.status(404).send({ success: false, message: 'Router no encontrado' });
    }

    try {
      const telemetry = await MikroTikService.getRouterTelemetry(router);

      await prisma.router.update({
        where: { id: router.id },
        data: {
          status: 'ONLINE',
          identity: telemetry.identity,
          rosVersion: telemetry.rosVersion,
          lastSeenAt: new Date(),
        },
      });

      return {
        success: true,
        data: {
          ...telemetry,
          routerId: router.id,
          routerName: router.name,
          host: router.host,
          apiPort: router.apiPort,
          useSsl: router.useSsl,
          username: router.username,
          plansCount: router._count.plans,
          ticketsCount: router._count.tickets,
        },
      };
    } catch (error: any) {
      await prisma.router.update({
        where: { id: router.id },
        data: { status: 'OFFLINE' },
      });

      return reply.status(502).send({
        success: false,
        error: {
          code: 'ROUTER_UNREACHABLE',
          message: error.message || 'No se pudo obtener la telemetría del router MikroTik.',
        },
      });
    }
  });

  // POST /api/v1/routers/:id/auto-provision (Configuración automática 1-clic vía API RouterOS)
  fastify.post('/routers/:id/auto-provision', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const router = await prisma.router.findUnique({ where: { id } });

    if (!router) {
      return reply.status(404).send({ success: false, message: 'Router no encontrado' });
    }

    const allRouters = await prisma.router.findMany({ select: { id: true }, orderBy: { createdAt: 'asc' } });
    const routerIndex = allRouters.findIndex((r) => r.id === router.id);
    const subnetOctet = (routerIndex >= 0 ? routerIndex + 1 : 1) * 10;

    try {
      const result = await MikroTikService.autoProvisionHotspot(router, { subnetOctet });

      if (result.success) {
        await prisma.router.update({
          where: { id: router.id },
          data: { status: 'ONLINE', lastSeenAt: new Date() },
        });
      }

      return {
        success: result.success,
        data: result,
        message: result.summary,
      };
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'AUTO_PROVISION_FAILED',
          message: error.message || 'Error durante la auto-configuración del MikroTik.',
        },
      });
    }
  });

  // GET /api/v1/routers/:id/bootstrap-script (Generar script RouterOS para configurar MikroTik desde cero)
  fastify.get('/routers/:id/bootstrap-script', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const router = await prisma.router.findUnique({ where: { id } });

    if (!router) {
      return reply.status(404).send({ success: false, message: 'Router no encontrado' });
    }

    const allRouters = await prisma.router.findMany({ select: { id: true }, orderBy: { createdAt: 'asc' } });
    const routerIndex = allRouters.findIndex((r) => r.id === router.id);
    const subnetOctet = (routerIndex >= 0 ? routerIndex + 1 : 1) * 10; // Router 1: 10, Router 2: 20, Router 3: 30
    const gatewayIp = `10.5.${subnetOctet}.1`;
    const networkIp = `10.5.${subnetOctet}.0/24`;
    const poolRange = `10.5.${subnetOctet}.10-10.5.${subnetOctet}.250`;
    const dnsName = `fichas${routerIndex + 1}.wifi`;

    const quickUnlockCommand = `/ip service enable api; /ip service set api port=${router.apiPort}; /ip firewall filter add chain=input action=accept protocol=tcp dst-port=${router.apiPort} comment="API MikroFichas" place-before=0; /ip cloud set ddns-enabled=yes update-time=yes; /system ntp client set enabled=yes`;

    const script = `# =========================================================
# MIKROMANAGER / MIKROFICHAS - CONFIGURACIÓN DESDE CERO
# Router: ${router.name} (${router.host})
# Subred Hotspot Asignada: ${networkIp} (Gateway: ${gatewayIp})
# Generado: ${new Date().toISOString()}
# =========================================================

# 1. IDENTIDAD DEL ROUTER
/system identity set name="${router.name.replace(/[^a-zA-Z0-9_-]/g, '_')}"

# 2. HABILITAR SERVICIO API Y DESBLOQUEAR FIREWALL (EVITA CONEXIÓN RECHAZADA)
/ip service enable api
/ip service set api port=${router.apiPort} disabled=no
/ip service set api-ssl port=8729 disabled=no
/ip firewall filter add chain=input action=accept protocol=tcp dst-port=${router.apiPort} comment="Permitir API MikroFichas" place-before=0

# 3. PROTECCIÓN CONTRA APAGONES / CORTE DE LUZ (SIN BATERÍA RTC)
# Configura sincronización horaria con IPs directas para evitar desfases si el DNS tarda en subir tras corte eléctrico
/system clock set time-zone-name=America/Mexico_City
/system ntp client set enabled=yes
/system ntp client servers add address=pool.ntp.org comment="NTP Pool"
/system ntp client servers add address=time.google.com comment="Google NTP"
/system ntp client servers add address=216.239.35.0 comment="Google NTP Direct IP"
/system ntp client servers add address=1.1.1.1 comment="Cloudflare Direct IP"
/ip cloud set ddns-enabled=yes update-time=yes

# Guardián de arranque: Si el router inicia en 1970 tras un apagón, fuerza sincronización inmediata
/system script add name=SAFE_BOOT_GUARD source=":delay 5s; :local curYear [:pick [/system clock get date] 7 11]; :if (\\$curYear < \\"2024\\") do={ :log warning \\"MikroFichas: Router inicio con fecha desincronizada tras corte de luz. Sincronizando hora...\\"; /ip cloud force-update; }"
/system scheduler add name=SAFE_BOOT_GUARD start-time=startup on-event=SAFE_BOOT_GUARD

# 4. CREAR BRIDGE HOTSPOT Y AGRUPAR PUERTOS ETHERNET
/interface bridge add name=bridge-hotspot comment="MikroFichas Hotspot Bridge"
/interface bridge port add bridge=bridge-hotspot interface=ether2 comment="Venta LAN 2"
/interface bridge port add bridge=bridge-hotspot interface=ether3 comment="Venta LAN 3"
/interface bridge port add bridge=bridge-hotspot interface=ether4 comment="Venta LAN 4"
/interface bridge port add bridge=bridge-hotspot interface=ether5 comment="Venta LAN 5"

# 5. DIRECCIONAMIENTO IP ÚNICO Y POOL DHCP (EVITA CONFLICTOS ENTRE ROUTERS)
/ip address add address=${gatewayIp}/24 interface=bridge-hotspot comment="IP Gateway Hotspot"
/ip pool add name=hs-pool-fichas ranges=${poolRange}

# 6. SERVIDOR DHCP PARA CLIENTES
/ip dhcp-server add name=dhcp-hotspot interface=bridge-hotspot address-pool=hs-pool-fichas lease-time=1h disabled=no
/ip dhcp-server network add address=${networkIp} gateway=${gatewayIp} dns-server=1.1.1.1,8.8.8.8 comment="Red MikroFichas"

# 7. PERFIL DEL SERVIDOR HOTSPOT (LOGIN POR PIN Y AMARRE DE MAC)
/ip hotspot profile add name=hsprof-mikrofichas hotspot-address=${gatewayIp} dns-name=${dnsName} login-by=http-pap,http-chap,mac-cookie use-radius=no
/ip hotspot add name=hs-clientes interface=bridge-hotspot address-pool=hs-pool-fichas profile=hsprof-mikrofichas disabled=no

# 8. PERFILES DE FICHAS: TIEMPO PAUSADO Y TIEMPO CORRIDO (1 SOLO DISPOSITIVO POR FICHA)
# shared-users=1 garantiza que NUNCA dos dispositivos puedan usar la misma ficha simultáneamente
/ip hotspot user profile add name=default shared-users=1 status-autorefresh=1m keepalive-timeout=2m transparent-proxy=no
/ip hotspot user profile add name=plan-pausado shared-users=1 status-autorefresh=1m keepalive-timeout=2m transparent-proxy=no
/ip hotspot user profile add name=plan-corrido-24h shared-users=1 status-autorefresh=1m keepalive-timeout=2m transparent-proxy=no on-login=":local expName (\\"EXP_\\" . \\$user); :local y [:pick [/system clock get date] 7 11]; :if (\\$y < \\"2024\\") do={ /ip cloud force-update; :delay 2s; }; /system scheduler add name=\\$expName interval=24h on-event=\\"/ip hotspot active remove [find user=\\\\\\"\\$user\\\\\\"]; /ip hotspot user remove [find name=\\\\\\"\\$user\\\\\\"]; /system scheduler remove [find name=\\\\\\"\\$expName\\\\\\"]\\""

# 9. REGLA NAT MASQUERADE PARA SALIDA A INTERNET
/ip firewall nat add chain=srcnat action=masquerade comment="NAT Salida Internet MikroFichas"

# 10. WALLED GARDEN (WHATSAPP GRATIS PARA RECIBIR FICHAS)
/ip hotspot walled-garden ip add dst-host=*.whatsapp.com action=accept comment="WhatsApp Text Free"
/ip hotspot walled-garden ip add dst-host=*.whatsapp.net action=accept comment="WhatsApp Media Free"

# 11. CONEXIÓN REMOTA ZEROTIER (ROUTEROS v7 - SIN ABRIR PUERTOS EN EL MODEM)
# Si usas ZeroTier (Network ID: b9a18a606f03ddb5):
# /zerotier/interface/add network=b9a18a606f03ddb5 name=zt1
# /zerotier/enable zt1
`;

    const ntpScript = `# SINCRONIZACIÓN HORARIA Y PROTECCIÓN ANTI-APAGONES
/system clock set time-zone-name=America/Mexico_City
/system ntp client set enabled=yes
/system ntp client servers add address=pool.ntp.org comment="NTP Pool"
/system ntp client servers add address=time.google.com comment="Google NTP"
/system ntp client servers add address=216.239.35.0 comment="Google NTP Direct IP"
/system ntp client servers add address=1.1.1.1 comment="Cloudflare Direct IP"
/ip cloud set ddns-enabled=yes update-time=yes
/system script add name=SAFE_BOOT_GUARD source=":delay 5s; :local curYear [:pick [/system clock get date] 7 11]; :if (\\$curYear < \\"2024\\") do={ :log warning \\"MikroFichas: Router inicio con fecha desincronizada tras corte de luz. Sincronizando hora...\\"; /ip cloud force-update; }"
/system scheduler add name=SAFE_BOOT_GUARD start-time=startup on-event=SAFE_BOOT_GUARD`;

    const hotspotScript = `# SUBRED Y PERFILES HOTSPOT (1 DISPOSITIVO POR FICHA)
/interface bridge add name=bridge-hotspot comment="MikroFichas Hotspot Bridge"
/interface bridge port add bridge=bridge-hotspot interface=ether2 comment="Venta LAN 2"
/interface bridge port add bridge=bridge-hotspot interface=ether3 comment="Venta LAN 3"
/interface bridge port add bridge=bridge-hotspot interface=ether4 comment="Venta LAN 4"
/interface bridge port add bridge=bridge-hotspot interface=ether5 comment="Venta LAN 5"
/ip address add address=${gatewayIp}/24 interface=bridge-hotspot comment="IP Gateway Hotspot"
/ip pool add name=hs-pool-fichas ranges=${poolRange}
/ip dhcp-server add name=dhcp-hotspot interface=bridge-hotspot address-pool=hs-pool-fichas lease-time=1h disabled=no
/ip dhcp-server network add address=${networkIp} gateway=${gatewayIp} dns-server=1.1.1.1,8.8.8.8 comment="Red MikroFichas"
/ip hotspot profile add name=hsprof-mikrofichas hotspot-address=${gatewayIp} dns-name=${dnsName} login-by=http-pap,http-chap,mac-cookie use-radius=no
/ip hotspot add name=hs-clientes interface=bridge-hotspot address-pool=hs-pool-fichas profile=hsprof-mikrofichas disabled=no
/ip hotspot user profile add name=default shared-users=1 status-autorefresh=1m keepalive-timeout=2m transparent-proxy=no
/ip hotspot user profile add name=plan-pausado shared-users=1 status-autorefresh=1m keepalive-timeout=2m transparent-proxy=no
/ip hotspot user profile add name=plan-corrido-24h shared-users=1 status-autorefresh=1m keepalive-timeout=2m transparent-proxy=no on-login=":local expName (\\"EXP_\\" . \\$user); :local y [:pick [/system clock get date] 7 11]; :if (\\$y < \\"2024\\") do={ /ip cloud force-update; :delay 2s; }; /system scheduler add name=\\$expName interval=24h on-event=\\"/ip hotspot active remove [find user=\\\\\\"\\$user\\\\\\"]; /ip hotspot user remove [find name=\\\\\\"\\$user\\\\\\"]; /system scheduler remove [find name=\\\\\\"\\$expName\\\\\\"]\\""
/ip firewall nat add chain=srcnat action=masquerade comment="NAT Salida Internet MikroFichas"
/ip hotspot walled-garden ip add dst-host=*.whatsapp.com action=accept comment="WhatsApp Text Free"
/ip hotspot walled-garden ip add dst-host=*.whatsapp.net action=accept comment="WhatsApp Media Free"`;

    return {
      success: true,
      data: {
        routerId: router.id,
        routerName: router.name,
        host: router.host,
        apiPort: router.apiPort,
        hotspotSubnet: networkIp,
        hotspotGateway: gatewayIp,
        quickUnlockCommand,
        ntpScript,
        hotspotScript,
        script,
      },
    };
  });

  // PATCH /api/v1/routers/:id (Actualizar datos, IP o contraseña del router)
  fastify.patch('/routers/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    try {
      const existing = await prisma.router.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ success: false, message: 'Router no encontrado' });
      }

      // Si cambia el host, verificar que no colisione con otro router
      if (body.host !== undefined && body.host.trim() !== existing.host) {
        const cleanHost = body.host.trim();
        const conflict = await prisma.router.findFirst({
          where: {
            host: cleanHost,
            id: { not: id },
          },
        });
        if (conflict) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'DUPLICATE_HOST',
              message: `La dirección IP o host '${cleanHost}' ya pertenece al router '${conflict.name}'.`,
            },
          });
        }
      }

      // Si se proporciona nueva contraseña, cifrarla con AES-256-GCM
      let passwordData: any = {};
      if (body.password !== undefined) {
        const encrypted = CryptoService.encryptPassword(body.password);
        passwordData = {
          encryptedPassword: encrypted.encryptedText,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
        };
      }

      const updated = await prisma.router.update({
        where: { id },
        data: {
          name: body.name !== undefined ? body.name.trim() : undefined,
          host: body.host !== undefined ? body.host.trim() : undefined,
          apiPort: body.apiPort !== undefined ? Number(body.apiPort) : undefined,
          useSsl: body.useSsl !== undefined ? Boolean(body.useSsl) : undefined,
          username: body.username !== undefined ? body.username.trim() : undefined,
          ...passwordData,
        },
      });

      return {
        success: true,
        data: updated,
        message: 'Router y credenciales actualizados correctamente.',
      };
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: `Error al actualizar: ${err.message}` });
    }
  });

  // POST /api/v1/routers/:id/zerotier (Configurar ZeroTier manualmente o por Socket)
  fastify.post('/routers/:id/zerotier', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { networkId } = request.body as { networkId: string };

    if (!networkId || networkId.trim().length < 8) {
      return reply.status(400).send({ success: false, message: 'El Network ID de ZeroTier es requerido (16 caracteres)' });
    }

    const cleanNetworkId = networkId.trim();
    const router = await prisma.router.findUnique({ where: { id } });

    if (!router) {
      return reply.status(404).send({ success: false, message: 'Router no encontrado' });
    }

    const command = `/zerotier interface add network=${cleanNetworkId} name=zt1\n/zerotier enable zt1`;

    // Intentar aplicar en el router si está en línea
    let appliedOnRouter = false;
    let applyError = null;

    try {
      await MikroTikService.configureZeroTier(router, cleanNetworkId);
      appliedOnRouter = true;
    } catch (err: any) {
      applyError = err.message;
    }

    return {
      success: true,
      data: {
        routerId: router.id,
        networkId: cleanNetworkId,
        command,
        appliedOnRouter,
        applyError,
      },
      message: appliedOnRouter
        ? `✅ ZeroTier (${cleanNetworkId}) configurado directamente en el router MikroTik.`
        : `⚠️ Router no alcanzable localmente todavía. Copia el comando generado y pégalo en la Terminal de Winbox.`,
    };
  });

  // POST /api/v1/routers/:id/set-remote-ip (Guardar IP ZeroTier y probar conexión remota)
  fastify.post('/routers/:id/set-remote-ip', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { remoteIp } = request.body as { remoteIp: string };

    if (!remoteIp || remoteIp.trim().length === 0) {
      return reply.status(400).send({ success: false, message: 'La IP remota de ZeroTier es requerida' });
    }

    const cleanIp = remoteIp.trim();
    const router = await prisma.router.update({
      where: { id },
      data: { host: cleanIp },
    });

    // Probar conexión remota a la nueva IP
    try {
      const result = await MikroTikService.testConnection(router);
      await prisma.router.update({
        where: { id: router.id },
        data: {
          status: 'ONLINE',
          identity: result.identity,
          rosVersion: result.rosVersion,
          lastSeenAt: new Date(),
        },
      });

      return {
        success: true,
        data: {
          host: cleanIp,
          online: true,
          latencyMs: result.latencyMs,
          identity: result.identity,
          rosVersion: result.rosVersion,
          boardName: result.boardName,
          cpuLoad: result.cpuLoad,
          freeMemoryMb: result.freeMemoryMb,
          uptime: result.uptime,
        },
        message: `🎉 ¡Conexión remota establecida con éxito vía ZeroTier a ${cleanIp}! Latencia: ${result.latencyMs}ms.`,
      };
    } catch (err: any) {
      await prisma.router.update({
        where: { id: router.id },
        data: { status: 'OFFLINE' },
      });

      return reply.status(200).send({
        success: false,
        data: { host: cleanIp, online: false },
        message: `Se guardó la IP ${cleanIp}, pero el router aún no responde en esa dirección: ${err.message}. Verifica que hayas marcado 'Auth' en el panel de ZeroTier.`,
      });
    }
  });

  // POST /api/v1/routers/:id/sync-tickets (Sincronizar todas las fichas pendientes en MikroTik)
  fastify.post('/routers/:id/sync-tickets', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const router = await prisma.router.findUnique({
      where: { id },
      include: {
        tickets: {
          where: { status: { in: ['AVAILABLE', 'SOLD', 'ACTIVE'] } },
          include: { plan: true },
        },
      },
    });

    if (!router) {
      return reply.status(404).send({ success: false, message: 'Router no encontrado' });
    }

    if (router.tickets.length === 0) {
      return {
        success: true,
        data: { syncedCount: 0 },
        message: 'No hay fichas pendientes para sincronizar en este router.',
      };
    }

    const hotspotUsers = router.tickets.map((t) => {
      let limitUptime = '';
      if (t.plan?.durationSeconds) {
        const sec = t.plan.durationSeconds;
        if (sec % 86400 === 0) limitUptime = `${sec / 86400}d`;
        else if (sec % 3600 === 0) limitUptime = `${sec / 3600}h`;
        else if (sec % 60 === 0) limitUptime = `${sec / 60}m`;
        else limitUptime = `${sec}s`;
      }

      return {
        name: t.username,
        password: t.password,
        profile: t.plan?.hotspotProfileName || 'default',
        limitUptime: limitUptime || undefined,
        comment: `MikroFichas ${t.plan?.name || ''} ($${t.plan?.price || 0})`,
      };
    });

    try {
      const res = await MikroTikService.injectHotspotUsersBatch(router, hotspotUsers);

      if (res.injectedCount > 0) {
        await prisma.router.update({
          where: { id: router.id },
          data: { status: 'ONLINE', lastSeenAt: new Date() },
        });
      }

      return {
        success: res.success || res.injectedCount > 0,
        data: {
          totalTickets: router.tickets.length,
          syncedCount: res.injectedCount,
          failedCount: res.failedCount,
        },
        message: res.injectedCount > 0
          ? `✅ Sincronizadas ${res.injectedCount} fichas en MikroTik '${router.name}'.`
          : `⚠️ No se pudieron inyectar las fichas: ${res.errors[0] || 'Error de conexión'}`,
      };
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        message: `Error al sincronizar con ${router.name}: ${err.message}`,
      });
    }
  });
}


