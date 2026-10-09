import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from '@prisma/client';
import { CryptoService } from '../security/crypto.service.js';
import { RouterOsClient } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultTemplatesDir = path.resolve(__dirname, '../hotspot/templates/sarmientos');

export interface HotspotUserInput {
  name: string;
  password: string;
  profile?: string;
  limitUptime?: string; // Ej: "2h", "1d", "30m"
  comment?: string;
}

export interface HotspotActiveUser {
  id: string; // .id en MikroTik (*4)
  user: string;
  address: string;
  macAddress: string;
  uptime: string;
  bytesIn: string;
  bytesOut: string;
}

export interface ProvisionStepResult {
  id: string;
  title: string;
  description: string;
  status: 'SUCCESS' | 'ERROR' | 'WARNING';
  detail: string;
}

export interface AutoProvisionResult {
  success: boolean;
  steps: ProvisionStepResult[];
  summary: string;
  telemetry?: any;
}

export class MikroTikService {
  /**
   * Crea y autentica un cliente RouterOsClient descifrando las credenciales del router
   */
  private static async getClient(router: Router): Promise<RouterOsClient> {
    const plainPassword = CryptoService.decryptPassword(
      router.encryptedPassword,
      router.iv,
      router.authTag
    );

    const client = new RouterOsClient({
      host: router.host,
      port: router.apiPort,
      useSsl: router.useSsl,
      username: router.username,
      password: plainPassword,
      timeoutMs: 4000,
    });

    await client.connect();
    return client;
  }

  /**
   * 1. Prueba de Conexión Real y Telemetría Base
   * Ejecuta: /system/identity/print y /system/resource/print
   */
  static async testConnection(router: Router): Promise<{
    online: boolean;
    latencyMs: number;
    identity: string;
    rosVersion: string;
    boardName: string;
    cpuLoad: number;
    freeMemoryMb: number;
    totalMemoryMb: number;
    uptime: string;
  }> {
    const start = Date.now();
    const client = await this.getClient(router);

    try {
      // 1. Obtener Identity
      const identityRes = await client.executeCommand('/system/identity/print');
      const identity = identityRes.find((s) => s.type === '!re')?.attributes['name'] || router.name;

      // 2. Obtener Recursos
      const resourceRes = await client.executeCommand('/system/resource/print');
      const resItem = resourceRes.find((s) => s.type === '!re')?.attributes || {};

      const latencyMs = Date.now() - start;

      const freeMem = parseInt(resItem['free-memory'] || '0', 10);
      const totalMem = parseInt(resItem['total-memory'] || '0', 10);

      return {
        online: true,
        latencyMs,
        identity,
        rosVersion: resItem['version'] || 'v6/v7',
        boardName: resItem['board-name'] || 'RouterBOARD',
        cpuLoad: parseInt(resItem['cpu-load'] || '0', 10),
        freeMemoryMb: Math.round(freeMem / (1024 * 1024)),
        totalMemoryMb: Math.round(totalMem / (1024 * 1024)),
        uptime: resItem['uptime'] || '0s',
      };
    } finally {
      client.close();
    }
  }

  /**
   * 1b. Prueba credenciales en texto plano SIN guardar nada (usado por el asistente de descubrimiento).
   * Clasifica el error para dar un diagnóstico claro al usuario.
   */
  static async testCredentials(opts: {
    host: string;
    port: number;
    useSsl: boolean;
    username: string;
    password: string;
  }): Promise<
    | { ok: true; identity: string; rosVersion: string; boardName: string; latencyMs: number }
    | { ok: false; code: 'AUTH_FAILED' | 'API_REFUSED' | 'API_TIMEOUT' | 'UNKNOWN'; message: string }
  > {
    const start = Date.now();
    const client = new RouterOsClient({ ...opts, timeoutMs: 5000 });
    try {
      await client.connect();
      const identityRes = await client.executeCommand('/system/identity/print');
      const resourceRes = await client.executeCommand('/system/resource/print');
      const res = resourceRes.find((s) => s.type === '!re')?.attributes || {};
      return {
        ok: true,
        identity: identityRes.find((s) => s.type === '!re')?.attributes['name'] || 'MikroTik',
        rosVersion: res['version'] || '',
        boardName: res['board-name'] || 'RouterBOARD',
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (/autenticaci|invalid user|password|cannot log in/i.test(msg)) {
        return { ok: false, code: 'AUTH_FAILED', message: 'Usuario o contraseña incorrectos para este MikroTik.' };
      }
      if (/ECONNREFUSED/i.test(msg)) {
        return {
          ok: false,
          code: 'API_REFUSED',
          message: `El MikroTik respondió pero el servicio API (puerto ${opts.port}) está apagado.`,
        };
      }
      if (/Tiempo de espera|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH/i.test(msg)) {
        return {
          ok: false,
          code: 'API_TIMEOUT',
          message: `No hubo respuesta en ${opts.host}:${opts.port}. El firewall de fábrica bloquea la API desde el puerto WAN (ether1) o el equipo está en otra red.`,
        };
      }
      return { ok: false, code: 'UNKNOWN', message: msg };
    } finally {
      client.close();
    }
  }

  /**
   * 2. Crear o asegurar Perfil Hotspot en MikroTik
   * Ejecuta: /ip/hotspot/user/profile/add
   */
  static async createHotspotProfile(
    router: Router,
    profileName: string,
    rateLimit: string = '5M/2M',
    sharedUsers: number = 1
  ): Promise<string> {
    const client = await this.getClient(router);
    try {
      // Verificar si ya existe
      const existing = await client.executeCommand('/ip/hotspot/user/profile/print', [
        `?name=${profileName}`,
      ]);

      const found = existing.find((s) => s.type === '!re');
      if (found) {
        return found.attributes['.id'];
      }

      // Crear nuevo perfil
      const addRes = await client.executeCommand('/ip/hotspot/user/profile/add', [
        `=name=${profileName}`,
        `=rate-limit=${rateLimit}`,
        `=shared-users=${sharedUsers}`,
        `=status-autorefresh=1m`,
        `=transparent-proxy=no`,
      ]);

      const trap = addRes.find((s) => s.type === '!trap');
      if (trap) {
        throw new Error(trap.attributes['message'] || 'No se pudo crear el perfil en MikroTik');
      }

      const done = addRes.find((s) => s.type === '!done');
      return done?.attributes['ret'] || profileName;
    } finally {
      client.close();
    }
  }

  /**
   * 3. Inyectar Usuario / Ticket en MikroTik Hotspot
   * Ejecuta: /ip/hotspot/user/add
   */
  static async injectHotspotUser(
    router: Router,
    user: HotspotUserInput
  ): Promise<{ rosId: string; pin: string }> {
    const client = await this.getClient(router);
    try {
      const attributes = [
        '=server=all',
        `=name=${user.name}`,
        `=password=${user.password}`,
        `=profile=${user.profile || 'default'}`,
      ];

      if (user.limitUptime) {
        attributes.push(`=limit-uptime=${user.limitUptime}`);
      }

      if (user.comment) {
        attributes.push(`=comment=${user.comment}`);
      }

      const res = await client.executeCommand('/ip/hotspot/user/add', attributes);

      const trap = res.find((s) => s.type === '!trap');
      if (trap) {
        throw new Error(`MikroTik rechazó el usuario: ${trap.attributes['message']}`);
      }

      const done = res.find((s) => s.type === '!done');
      const rosId = done?.attributes['ret'] || '';

      return { rosId, pin: user.name };
    } finally {
      client.close();
    }
  }

  /**
   * Inyecta un lote masivo de usuarios / tickets en MikroTik Hotspot usando una única conexión API.
   * Tolerante a fallos: si un PIN ya existe o si un registro falla, continúa con los demás.
   */
  static async injectHotspotUsersBatch(
    router: Router,
    users: HotspotUserInput[]
  ): Promise<{
    success: boolean;
    injectedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    let client: RouterOsClient | null = null;
    let injectedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    try {
      client = await this.getClient(router);

      // Obtener perfiles disponibles en el router para fallback a 'default' si el perfil no existe
      const profilesRes = await client.executeCommand('/ip/hotspot/user/profile/print').catch(() => []);
      const existingProfiles = new Set(
        profilesRes
          .filter((p) => p.type === '!re' && p.attributes['name'])
          .map((p) => p.attributes['name'])
      );

      for (const user of users) {
        try {
          const profileToUse = user.profile && existingProfiles.has(user.profile)
            ? user.profile
            : 'default';

          const attributes = [
            '=server=all',
            `=name=${user.name}`,
            `=password=${user.password}`,
            `=profile=${profileToUse}`,
          ];

          if (user.limitUptime) {
            attributes.push(`=limit-uptime=${user.limitUptime}`);
          }

          if (user.comment) {
            attributes.push(`=comment=${user.comment}`);
          }

          const res = await client.executeCommand('/ip/hotspot/user/add', attributes);
          const trap = res.find((s) => s.type === '!trap');
          if (trap) {
            const msg = trap.attributes['message'] || 'Error desconocido';
            if (msg.includes('already have') || msg.includes('already exists')) {
              // Ya existía en MikroTik, se considera sincronizado
              injectedCount++;
            } else {
              failedCount++;
              errors.push(`PIN ${user.name}: ${msg}`);
            }
          } else {
            injectedCount++;
          }
        } catch (itemErr: any) {
          failedCount++;
          errors.push(`PIN ${user.name}: ${itemErr.message}`);
        }
      }

      return {
        success: failedCount === 0,
        injectedCount,
        failedCount,
        errors,
      };
    } catch (connErr: any) {
      return {
        success: false,
        injectedCount: 0,
        failedCount: users.length,
        errors: [`No se pudo conectar a ${router.name} (${router.host}): ${connErr.message}`],
      };
    } finally {
      if (client) {
        try {
          client.close();
        } catch {}
      }
    }
  }

  /**
   * 4. Desactivar Usuario en MikroTik Hotspot
   * Ejecuta: /ip/hotspot/user/set =.id=*ID =disabled=yes
   */
  static async disableHotspotUser(router: Router, rosUserId: string): Promise<void> {
    const client = await this.getClient(router);
    try {
      await client.executeCommand('/ip/hotspot/user/set', [
        `=.id=${rosUserId}`,
        '=disabled=yes',
      ]);
    } finally {
      client.close();
    }
  }

  /**
   * 5. Eliminar Usuario en MikroTik Hotspot
   * Ejecuta: /ip/hotspot/user/remove =.id=*ID
   */
  static async removeHotspotUser(router: Router, rosUserId: string): Promise<void> {
    const client = await this.getClient(router);
    try {
      await client.executeCommand('/ip/hotspot/user/remove', [`=.id=${rosUserId}`]);
    } finally {
      client.close();
    }
  }

  /**
   * 6. Consultar Sesiones Activas en Vivo
   * Ejecuta: /ip/hotspot/active/print
   */
  static async getActiveSessions(router: Router): Promise<HotspotActiveUser[]> {
    const client = await this.getClient(router);
    try {
      const res = await client.executeCommand('/ip/hotspot/active/print');
      const sessions: HotspotActiveUser[] = [];

      for (const s of res) {
        if (s.type === '!re') {
          const bytesIn = parseInt(s.attributes['bytes-in'] || '0', 10);
          const bytesOut = parseInt(s.attributes['bytes-out'] || '0', 10);

          sessions.push({
            id: s.attributes['.id'] || '',
            user: s.attributes['user'] || '',
            address: s.attributes['address'] || '',
            macAddress: s.attributes['mac-address'] || '',
            uptime: s.attributes['uptime'] || '0s',
            bytesIn: `${(bytesIn / (1024 * 1024)).toFixed(1)} MB`,
            bytesOut: `${(bytesOut / (1024 * 1024)).toFixed(1)} MB`,
          });
        }
      }

      return sessions;
    } finally {
      client.close();
    }
  }

  /**
   * 7. Expulsar Usuario Conectado (Kick en Vivo de Capa 2/3)
   * Ejecuta: /ip/hotspot/active/remove =.id=*ID
   */
  static async kickActiveSession(router: Router, rosActiveId: string): Promise<void> {
    const client = await this.getClient(router);
    try {
      await client.executeCommand('/ip/hotspot/active/remove', [`=.id=${rosActiveId}`]);
    } finally {
      client.close();
    }
  }

  /**
   * 8. Configurar ZeroTier en MikroTik RouterOS v7 de forma automática
   */
  static async configureZeroTier(router: Router, networkId: string): Promise<{ success: boolean; message: string }> {
    const client = await this.getClient(router);
    try {
      // Verificar si ya existe interfaz zt1
      const existing = await client.executeCommand('/zerotier/interface/print', ['?name=zt1']);
      const found = existing.find((s) => s.type === '!re');

      if (!found) {
        await client.executeCommand('/zerotier/interface/add', [
          `=network=${networkId}`,
          '=name=zt1',
        ]);
      } else {
        await client.executeCommand('/zerotier/interface/set', [
          `=.id=${found.attributes['.id']}`,
          `=network=${networkId}`,
          '=disabled=no',
        ]);
      }

      await client.executeCommand('/zerotier/enable', ['=.id=zt1']).catch(() => {});
      return { success: true, message: `ZeroTier configurado con éxito con red ${networkId}` };
    } finally {
      client.close();
    }
  }

  /**
   * 9a. Instalar archivo de portal cautivo reutilizando cliente abierto
   */
  static async uploadPortalFileWithClient(client: RouterOsClient, fileName: string, content: string): Promise<void> {
    try {
      const existing = await client.executeCommand('/file/print', [`?name=${fileName}`]);
      const found = existing.find((s) => s.type === '!re');
      if (found) {
        await client.executeCommand('/file/remove', [`=.id=${found.attributes['.id']}`]);
      }
    } catch {}

    await client.executeCommand('/file/add', [
      `=name=${fileName}`,
      `=contents=${content}`,
    ]);
  }

  /**
   * 9b. Instalar archivo de portal cautivo en MikroTik Hotspot
   */
  static async uploadPortalFile(router: Router, fileName: string, content: string): Promise<void> {
    const client = await this.getClient(router);
    try {
      await this.uploadPortalFileWithClient(client, fileName, content);
    } finally {
      client.close();
    }
  }

  /**
   * 10. Consultar Telemetría Completa en Vivo (Hardware + Hotspot + Red)
   */
  static async getRouterTelemetry(router: Router): Promise<{
    online: boolean;
    latencyMs: number;
    identity: string;
    rosVersion: string;
    boardName: string;
    architecture: string;
    cpuLoad: number;
    freeMemoryMb: number;
    totalMemoryMb: number;
    memoryUsedPercent: number;
    freeHddMb: number;
    totalHddMb: number;
    uptime: string;
    activeHotspotCount: number;
    activeHotspotSessions: HotspotActiveUser[];
    hotspotUsersCount: number;
    hotspotServerConfigured: boolean;
    hotspotServerName?: string;
    lanIp?: string;
    interfaces: string[];
  }> {
    const start = Date.now();
    const client = await this.getClient(router);

    try {
      // 1. Identity
      const identityRes = await client.executeCommand('/system/identity/print');
      const identity = identityRes.find((s) => s.type === '!re')?.attributes['name'] || router.name;

      // 2. Resources
      const resourceRes = await client.executeCommand('/system/resource/print');
      const resItem = resourceRes.find((s) => s.type === '!re')?.attributes || {};
      const latencyMs = Date.now() - start;

      const freeMem = parseInt(resItem['free-memory'] || '0', 10);
      const totalMem = parseInt(resItem['total-memory'] || '0', 10);
      const freeMemMb = Math.round(freeMem / (1024 * 1024));
      const totalMemMb = Math.round(totalMem / (1024 * 1024));
      const memoryUsedPercent = totalMemMb > 0 ? Math.round(((totalMemMb - freeMemMb) / totalMemMb) * 100) : 0;

      const freeHdd = parseInt(resItem['free-hdd-space'] || '0', 10);
      const totalHdd = parseInt(resItem['total-hdd-space'] || '0', 10);
      const freeHddMb = Math.round(freeHdd / (1024 * 1024));
      const totalHddMb = Math.round(totalHdd / (1024 * 1024));

      // 3. Hotspot Activos
      const activeHotspotSessions: HotspotActiveUser[] = [];
      try {
        const activeRes = await client.executeCommand('/ip/hotspot/active/print');
        for (const s of activeRes) {
          if (s.type === '!re') {
            const bytesIn = parseInt(s.attributes['bytes-in'] || '0', 10);
            const bytesOut = parseInt(s.attributes['bytes-out'] || '0', 10);
            activeHotspotSessions.push({
              id: s.attributes['.id'] || '',
              user: s.attributes['user'] || '',
              address: s.attributes['address'] || '',
              macAddress: s.attributes['mac-address'] || '',
              uptime: s.attributes['uptime'] || '0s',
              bytesIn: `${(bytesIn / (1024 * 1024)).toFixed(1)} MB`,
              bytesOut: `${(bytesOut / (1024 * 1024)).toFixed(1)} MB`,
            });
          }
        }
      } catch {}

      // 4. Hotspot Users Count
      let hotspotUsersCount = 0;
      try {
        const usersRes = await client.executeCommand('/ip/hotspot/user/print');
        hotspotUsersCount = usersRes.filter((s) => s.type === '!re').length;
      } catch {}

      // 5. Hotspot Server Status
      let hotspotServerConfigured = false;
      let hotspotServerName: string | undefined;
      try {
        const hsRes = await client.executeCommand('/ip/hotspot/print');
        const hsItem = hsRes.find((s) => s.type === '!re');
        if (hsItem && hsItem.attributes['name']) {
          hotspotServerConfigured = true;
          hotspotServerName = hsItem.attributes['name'];
        }
      } catch {}

      // 6. Interfaces & LAN IP
      const interfaces: string[] = [];
      let lanIp: string | undefined;
      try {
        const ifRes = await client.executeCommand('/interface/print');
        for (const i of ifRes) {
          if (i.type === '!re' && i.attributes['name']) {
            interfaces.push(i.attributes['name']);
          }
        }

        const ipRes = await client.executeCommand('/ip/address/print');
        for (const ip of ipRes) {
          if (ip.type === '!re' && ip.attributes['address']) {
            const iface = ip.attributes['interface'] || '';
            if (iface.includes('bridge') || iface.includes('wlan') || iface.includes('lan')) {
              lanIp = ip.attributes['address'];
              break;
            } else if (!lanIp && !iface.includes('ether1')) {
              lanIp = ip.attributes['address'];
            }
          }
        }
      } catch {}

      return {
        online: true,
        latencyMs,
        identity,
        rosVersion: resItem['version'] || 'v6/v7',
        boardName: resItem['board-name'] || 'RouterBOARD',
        architecture: resItem['architecture-name'] || 'smips',
        cpuLoad: parseInt(resItem['cpu-load'] || '0', 10),
        freeMemoryMb: freeMemMb,
        totalMemoryMb: totalMemMb,
        memoryUsedPercent,
        freeHddMb,
        totalHddMb,
        uptime: resItem['uptime'] || '0s',
        activeHotspotCount: activeHotspotSessions.length,
        activeHotspotSessions,
        hotspotUsersCount,
        hotspotServerConfigured,
        hotspotServerName,
        lanIp,
        interfaces,
      };
    } finally {
      client.close();
    }
  }

  /**
   * 11. Auto-Configuración Completa de Hotspot en 1 Clic vía RouterOS API
   * Sin necesidad de copiar ni pegar comandos en la terminal de Winbox.
   */
  static async autoProvisionHotspot(
    router: Router,
    options?: { subnetOctet?: number }
  ): Promise<AutoProvisionResult> {
    const steps: ProvisionStepResult[] = [];
    let activeClient = await this.getClient(router);
    const getActiveClient = async (): Promise<RouterOsClient> => {
      if (!activeClient.connected) {
        try {
          activeClient.close();
        } catch {}
        activeClient = await this.getClient(router);
      }
      return activeClient;
    };

    try {
      // -------------------------------------------------------------
      // PASO 1: Conexión Socket API y Diagnóstico de Hardware
      // -------------------------------------------------------------
      let rosVersion = '';
      let boardName = '';
      let identity = router.name;
      try {
        const c1 = await getActiveClient();
        const idRes = await c1.executeCommand('/system/identity/print');
        identity = idRes.find((s) => s.type === '!re')?.attributes['name'] || router.name;

        const resRes = await c1.executeCommand('/system/resource/print');
        const resItem = resRes.find((s) => s.type === '!re')?.attributes || {};
        rosVersion = resItem['version'] || '6.49';
        boardName = resItem['board-name'] || 'RouterBOARD';

        steps.push({
          id: 'step_connect',
          title: 'Conexión Socket API y Diagnóstico de Hardware',
          description: 'Enlace binario RouterOS en puerto 8728 y autenticación AES-256',
          status: 'SUCCESS',
          detail: `Conectado con éxito a ${identity} (${boardName}, RouterOS v${rosVersion}).`,
        });
      } catch (err: any) {
        steps.push({
          id: 'step_connect',
          title: 'Conexión Socket API y Diagnóstico de Hardware',
          description: 'Enlace binario RouterOS en puerto 8728',
          status: 'ERROR',
          detail: `Error al comunicar con RouterOS: ${err.message}`,
        });
        throw err;
      }

      // -------------------------------------------------------------
      // PASO 2: Sincronización Horaria y Protección Anti-Apagones (NTP & Cloud)
      // -------------------------------------------------------------
      try {
        const c2 = await getActiveClient();
        await c2.executeCommand('/system/clock/set', ['=time-zone-name=America/Mexico_City']);
        await c2.executeCommand('/ip/cloud/set', ['=update-time=yes', '=ddns-enabled=yes']);

        const isV7 = rosVersion.startsWith('7');
        if (isV7) {
          await c2.executeCommand('/system/ntp/client/set', ['=enabled=yes']).catch(() => {});
          try {
            const ntpServers = await c2.executeCommand('/system/ntp/client/servers/print');
            const hasServer = ntpServers.some((s) => s.type === '!re');
            if (!hasServer) {
              await c2.executeCommand('/system/ntp/client/servers/add', ['=address=pool.ntp.org']);
              await c2.executeCommand('/system/ntp/client/servers/add', ['=address=time.google.com']);
            }
          } catch {}
        } else {
          await c2.executeCommand('/system/ntp/client/set', [
            '=enabled=yes',
            '=primary-ntp=216.239.35.0',
            '=secondary-ntp=1.1.1.1',
          ]).catch(() => {});
        }

        try {
          const scripts = await c2.executeCommand('/system/script/print', ['?name=SAFE_BOOT_GUARD']);
          if (!scripts.some((s) => s.type === '!re')) {
            await c2.executeCommand('/system/script/add', [
              '=name=SAFE_BOOT_GUARD',
              '=source=:delay 5s; :local curYear [:pick [/system clock get date] 7 11]; :if ($curYear < "2024") do={ /ip cloud force-update; }',
            ]);
          }
          const scheds = await c2.executeCommand('/system/scheduler/print', ['?name=SAFE_BOOT_GUARD']);
          if (!scheds.some((s) => s.type === '!re')) {
            await c2.executeCommand('/system/scheduler/add', [
              '=name=SAFE_BOOT_GUARD',
              '=start-time=startup',
              '=on-event=SAFE_BOOT_GUARD',
            ]);
          }
        } catch {}

        steps.push({
          id: 'step_ntp',
          title: 'Sincronización Horaria y Protección Anti-Apagones',
          description: 'NTP Client + MikroTik Cloud DDNS + Guardián de arranque RTC',
          status: 'SUCCESS',
          detail: 'Reloj configurado en America/Mexico_City y guardián activo contra desfasamiento tras corte eléctrico.',
        });
      } catch (err: any) {
        steps.push({
          id: 'step_ntp',
          title: 'Sincronización Horaria y Protección Anti-Apagones',
          description: 'NTP Client + MikroTik Cloud DDNS',
          status: 'WARNING',
          detail: `Advertencia al configurar reloj/NTP: ${err.message}`,
        });
      }

      // -------------------------------------------------------------
      // PASO 3: Perfiles de Usuario Hotspot (1 Dispositivo por Ficha Estricto)
      // -------------------------------------------------------------
      try {
        const c3 = await getActiveClient();
        const defProf = await c3.executeCommand('/ip/hotspot/user/profile/print', ['?name=default']);
        const foundDef = defProf.find((s) => s.type === '!re');
        if (foundDef) {
          await c3.executeCommand('/ip/hotspot/user/profile/set', [
            `=.id=${foundDef.attributes['.id']}`,
            '=shared-users=1',
            '=status-autorefresh=1m',
            '=keepalive-timeout=2m',
            '=transparent-proxy=no',
          ]);
        }

        const pausadoProf = await c3.executeCommand('/ip/hotspot/user/profile/print', ['?name=plan-pausado']);
        if (!pausadoProf.some((s) => s.type === '!re')) {
          await c3.executeCommand('/ip/hotspot/user/profile/add', [
            '=name=plan-pausado',
            '=shared-users=1',
            '=status-autorefresh=1m',
            '=keepalive-timeout=2m',
            '=transparent-proxy=no',
          ]);
        }

        const corridoProf = await c3.executeCommand('/ip/hotspot/user/profile/print', ['?name=plan-corrido']);
        if (!corridoProf.some((s) => s.type === '!re')) {
          await c3.executeCommand('/ip/hotspot/user/profile/add', [
            '=name=plan-corrido',
            '=shared-users=1',
            '=status-autorefresh=1m',
            '=keepalive-timeout=2m',
            '=transparent-proxy=no',
          ]);
        }

        steps.push({
          id: 'step_profiles',
          title: 'Perfiles de Fichas (1 Dispositivo por Ficha)',
          description: 'shared-users=1 obligatorio en default, plan-pausado y plan-corrido',
          status: 'SUCCESS',
          detail: 'Garantizado: Cada PIN solo puede ser utilizado por 1 celular/dispositivo al mismo tiempo.',
        });
      } catch (err: any) {
        steps.push({
          id: 'step_profiles',
          title: 'Perfiles de Fichas (1 Dispositivo por Ficha)',
          description: 'Asegurar shared-users=1',
          status: 'ERROR',
          detail: `Error al configurar perfiles de usuario: ${err.message}`,
        });
      }

      // -------------------------------------------------------------
      // PASO 4: Servidor Hotspot y Reglas de Autenticación
      // -------------------------------------------------------------
      try {
        const c4 = await getActiveClient();
        const hsProf = await c4.executeCommand('/ip/hotspot/profile/print', ['?name=hsprof-mikrofichas']);
        const foundHsProf = hsProf.find((s) => s.type === '!re');
        const profileName = 'hsprof-mikrofichas';

        if (foundHsProf) {
          await c4.executeCommand('/ip/hotspot/profile/set', [
            `=.id=${foundHsProf.attributes['.id']}`,
            '=login-by=http-pap,http-chap,mac-cookie',
            '=html-directory=hotspot',
          ]);
        } else {
          await c4.executeCommand('/ip/hotspot/profile/add', [
            '=name=hsprof-mikrofichas',
            '=login-by=http-pap,http-chap,mac-cookie',
            '=html-directory=hotspot',
          ]);
        }

        const hsServers = await c4.executeCommand('/ip/hotspot/print');
        const activeHs = hsServers.find((s) => s.type === '!re');

        if (activeHs && activeHs.attributes['.id']) {
          await c4.executeCommand('/ip/hotspot/set', [
            `=.id=${activeHs.attributes['.id']}`,
            `=profile=${profileName}`,
            '=disabled=no',
          ]).catch(() => {});

          steps.push({
            id: 'step_server',
            title: 'Servidor Hotspot y Autenticación de Red',
            description: 'Servidor Hotspot existente enlazado con perfil de autenticación',
            status: 'SUCCESS',
            detail: `Servidor Hotspot '${activeHs.attributes['name'] || 'hs-clientes'}' verificado y enlazado con autenticación HTTP-PAP/CHAP.`,
          });
        } else {
          const ifaces = await c4.executeCommand('/interface/print');
          let targetInterface = 'bridge';
          const hasBridge = ifaces.some((i) => i.type === '!re' && i.attributes['name'] === 'bridge');
          if (!hasBridge) {
            const hasBridgeHs = ifaces.some((i) => i.type === '!re' && i.attributes['name'] === 'bridge-hotspot');
            if (hasBridgeHs) {
              targetInterface = 'bridge-hotspot';
            } else {
              await c4.executeCommand('/interface/bridge/add', ['=name=bridge-hotspot', '=comment=MikroFichas Bridge']);
              targetInterface = 'bridge-hotspot';
            }
          }

          const ips = await c4.executeCommand('/ip/address/print', [`?interface=${targetInterface}`]);
          let gatewayIp = '10.5.10.1';
          if (ips.some((s) => s.type === '!re')) {
            const foundIp = ips.find((s) => s.type === '!re')?.attributes['address'] || '';
            gatewayIp = foundIp.split('/')[0] || '10.5.10.1';
          } else {
            const octet = options?.subnetOctet || 10;
            gatewayIp = `10.5.${octet}.1`;
            await c4.executeCommand('/ip/address/add', [
              `=address=${gatewayIp}/24`,
              `=interface=${targetInterface}`,
              '=comment=IP Gateway Hotspot MikroFichas',
            ]).catch(() => {});
          }

          const poolName = 'hs-pool-fichas';
          const pools = await c4.executeCommand('/ip/pool/print', [`?name=${poolName}`]);
          if (!pools.some((s) => s.type === '!re')) {
            const ipPrefix = gatewayIp.substring(0, gatewayIp.lastIndexOf('.'));
            await c4.executeCommand('/ip/pool/add', [
              `=name=${poolName}`,
              `=ranges=${ipPrefix}.10-${ipPrefix}.250`,
            ]).catch(() => {});
          }

          await c4.executeCommand('/ip/hotspot/add', [
            '=name=hs-clientes',
            `=interface=${targetInterface}`,
            `=address-pool=${poolName}`,
            `=profile=${profileName}`,
            '=disabled=no',
          ]);

          steps.push({
            id: 'step_server',
            title: 'Servidor Hotspot y Autenticación de Red',
            description: `Nuevo servidor Hotspot creado en la interfaz '${targetInterface}'`,
            status: 'SUCCESS',
            detail: `Servidor Hotspot 'hs-clientes' creado en '${targetInterface}' (Gateway: ${gatewayIp}) con perfil seguro.`,
          });
        }
      } catch (err: any) {
        steps.push({
          id: 'step_server',
          title: 'Servidor Hotspot y Autenticación de Red',
          description: 'Configurar servidor Hotspot',
          status: 'WARNING',
          detail: `Advertencia en servidor Hotspot: ${err.message}`,
        });
      }

      // -------------------------------------------------------------
      // PASO 5: Instalación del Portal Cautivo Sarmientos (login.html)
      // -------------------------------------------------------------
      try {
        const c5 = await getActiveClient();
        let uploaded = 0;
        if (fs.existsSync(defaultTemplatesDir)) {
          const files = ['login.html', 'status.html', 'logout.html'];
          for (const fileName of files) {
            const filePath = path.join(defaultTemplatesDir, fileName);
            if (fs.existsSync(filePath)) {
              const content = fs.readFileSync(filePath, 'utf8');
              await this.uploadPortalFileWithClient(c5, `hotspot/${fileName}`, content);
              uploaded++;
            }
          }
        }

        steps.push({
          id: 'step_portal',
          title: 'Portal Cautivo Sarmientos (Pantalla de Acceso)',
          description: 'Instalación de login.html responsivo con formulario de PIN y Usuario/Contraseña',
          status: 'SUCCESS',
          detail: `Subidos ${uploaded} archivos a la carpeta 'hotspot/' del MikroTik. Listo para mostrar portal a los clientes.`,
        });
      } catch (err: any) {
        steps.push({
          id: 'step_portal',
          title: 'Portal Cautivo Sarmientos (Pantalla de Acceso)',
          description: 'Subida de archivos a hotspot/',
          status: 'WARNING',
          detail: `No se pudieron cargar archivos automáticamente: ${err.message}`,
        });
      }

      // -------------------------------------------------------------
      // PASO 6: Firewall NAT Masquerade y Salida a Internet
      // -------------------------------------------------------------
      try {
        const c6 = await getActiveClient();
        const natRules = await c6.executeCommand('/ip/firewall/nat/print', ['?action=masquerade']);
        if (!natRules.some((s) => s.type === '!re')) {
          await c6.executeCommand('/ip/firewall/nat/add', [
            '=chain=srcnat',
            '=action=masquerade',
            '=comment=NAT Salida Internet MikroFichas',
          ]);
        }

        steps.push({
          id: 'step_nat',
          title: 'Firewall NAT Masquerade (Salida a Internet)',
          description: 'Regla srcnat=masquerade para navegación compartida',
          status: 'SUCCESS',
          detail: 'Regla de enrutamiento NAT activa para permitir salida a Internet de clientes autenticados.',
        });
      } catch (err: any) {
        steps.push({
          id: 'step_nat',
          title: 'Firewall NAT Masquerade (Salida a Internet)',
          description: 'Regla srcnat=masquerade',
          status: 'WARNING',
          detail: `Advertencia al verificar NAT: ${err.message}`,
        });
      }

      const hasError = steps.some((s) => s.status === 'ERROR');

      return {
        success: !hasError,
        steps,
        summary: !hasError
          ? `🎉 ¡MikroTik '${identity}' auto-configurado con éxito! Listo para vender y emitir fichas sin necesidad de terminal.`
          : `⚠️ Auto-configuración completada con algunos errores. Revisa la lista de pasos.`,
      };
    } finally {
      try {
        activeClient.close();
      } catch {}
    }
  }
}


