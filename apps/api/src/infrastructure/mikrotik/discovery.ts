import dgram from 'node:dgram';
import net from 'node:net';
import os from 'node:os';

/**
 * Descubrimiento de equipos MikroTik en la red local (igual que la pestaña "Neighbors" de Winbox).
 *
 * Protocolo MNDP (MikroTik Neighbor Discovery Protocol):
 *  - UDP puerto 5678.
 *  - Una solicitud de descubrimiento es un paquete de 4 bytes en cero enviado por broadcast.
 *  - Cada MikroTik responde (y además anuncia cada ~60s) con un paquete:
 *      [2 bytes cabecera][2 bytes secuencia] + TLVs { tipo:u16 BE, longitud:u16 BE, valor }
 */

export type ApiPortState = 'open' | 'refused' | 'filtered' | 'no-ip';

export interface DiscoveredDevice {
  mac: string;
  identity: string;
  version: string;
  platform: string;
  board: string;
  uptimeSeconds: number | null;
  softwareId: string;
  interfaceName: string;
  ipv4: string | null;
  ipv6: string | null;
  source: 'mndp' | 'probe';
  apiPort: ApiPortState;
  winboxPort: ApiPortState;
}

const MNDP_PORT = 5678;

const TLV = {
  MAC: 1,
  IDENTITY: 5,
  VERSION: 7,
  PLATFORM: 8,
  UPTIME: 10,
  SOFTWARE_ID: 11,
  BOARD: 12,
  UNPACK: 14,
  IPV6: 15,
  INTERFACE: 16,
  IPV4: 17,
} as const;

function formatMac(buf: Buffer): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':')
    .toUpperCase();
}

function formatIpv6(buf: Buffer): string {
  const parts: string[] = [];
  for (let i = 0; i < 16; i += 2) parts.push(buf.readUInt16BE(i).toString(16));
  return parts.join(':');
}

/** Decodifica un paquete MNDP. Devuelve null si no es válido. */
export function parseMndpPacket(msg: Buffer, senderIp: string): Partial<DiscoveredDevice> | null {
  if (msg.length < 8) return null; // las solicitudes de 4 bytes (incluida la nuestra) se ignoran
  const device: Partial<DiscoveredDevice> = { source: 'mndp' };
  let offset = 4;

  while (offset + 4 <= msg.length) {
    const type = msg.readUInt16BE(offset);
    const len = msg.readUInt16BE(offset + 2);
    offset += 4;
    if (offset + len > msg.length) break;
    const value = msg.subarray(offset, offset + len);
    offset += len;

    switch (type) {
      case TLV.MAC:
        if (len === 6) device.mac = formatMac(value);
        break;
      case TLV.IDENTITY:
        device.identity = value.toString('utf8');
        break;
      case TLV.VERSION:
        device.version = value.toString('utf8');
        break;
      case TLV.PLATFORM:
        device.platform = value.toString('utf8');
        break;
      case TLV.UPTIME:
        if (len === 4) device.uptimeSeconds = value.readUInt32LE(0);
        break;
      case TLV.SOFTWARE_ID:
        device.softwareId = value.toString('utf8');
        break;
      case TLV.BOARD:
        device.board = value.toString('utf8');
        break;
      case TLV.IPV6:
        if (len === 16) device.ipv6 = formatIpv6(value);
        break;
      case TLV.INTERFACE:
        device.interfaceName = value.toString('utf8');
        break;
      case TLV.IPV4:
        if (len === 4) device.ipv4 = Array.from(value).join('.');
        break;
      default:
        break;
    }
  }

  if (!device.mac) return null;
  if (!device.ipv4 && senderIp && senderIp !== '0.0.0.0') device.ipv4 = senderIp;
  return device;
}

/** Direcciones de broadcast de todas las interfaces IPv4 del servidor. */
export function getLocalBroadcasts(): string[] {
  const result = new Set<string>(['255.255.255.255']);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const iface of list || []) {
      if (iface.family !== 'IPv4' || iface.internal || !iface.netmask) continue;
      const ip = iface.address.split('.').map(Number);
      const mask = iface.netmask.split('.').map(Number);
      result.add(ip.map((octet, i) => (octet & mask[i]) | (~mask[i] & 255)).join('.'));
    }
  }
  return Array.from(result);
}

/** IPv4 locales del servidor (con su máscara) para sugerir direcciones libres. */
export function getLocalIpv4(): { address: string; netmask: string }[] {
  const out: { address: string; netmask: string }[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const iface of list || []) {
      if (iface.family === 'IPv4' && !iface.internal) out.push({ address: iface.address, netmask: iface.netmask });
    }
  }
  return out;
}

/** Sondea un puerto TCP: abierto, rechazado (servicio apagado) o filtrado (firewall / otra red). */
export function probeTcpPort(host: string, port: number, timeoutMs = 1200): Promise<ApiPortState> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (state: ApiPortState) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(state);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish('open'));
    socket.once('timeout', () => finish('filtered'));
    socket.once('error', (err: NodeJS.ErrnoException) => finish(err.code === 'ECONNREFUSED' ? 'refused' : 'filtered'));
    socket.connect(port, host);
  });
}

/**
 * Escanea la red local durante `durationMs` y devuelve los MikroTik encontrados.
 * Además prueba la IP de fábrica 192.168.88.1 por si el broadcast UDP está bloqueado.
 */
export async function discoverMikrotiks(durationMs = 4000, apiPort = 8728): Promise<DiscoveredDevice[]> {
  const found = new Map<string, Partial<DiscoveredDevice>>();

  await new Promise<void>((resolve) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    let finished = false;
    const timers: NodeJS.Timeout[] = [];

    const finish = () => {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      try {
        socket.close();
      } catch {}
      resolve();
    };

    socket.on('message', (msg, rinfo) => {
      const parsed = parseMndpPacket(msg, rinfo.address);
      if (!parsed?.mac) return;
      // Un mismo equipo responde por cada interfaz: preferimos la entrada que trae IPv4
      const prev = found.get(parsed.mac);
      if (!prev || (!prev.ipv4 && parsed.ipv4)) found.set(parsed.mac, { ...prev, ...parsed });
    });

    socket.on('error', () => finish());

    socket.bind(MNDP_PORT, () => {
      try {
        socket.setBroadcast(true);
      } catch {}
      const request = Buffer.alloc(4, 0);
      const sendAll = () => {
        for (const addr of getLocalBroadcasts()) {
          socket.send(request, MNDP_PORT, addr, () => undefined);
        }
      };
      // Se envía la solicitud 3 veces (UDP puede perder paquetes en Wi-Fi)
      sendAll();
      timers.push(setTimeout(sendAll, 800));
      timers.push(setTimeout(sendAll, 1800));
      timers.push(setTimeout(finish, durationMs));
    });
  });

  // Respaldo: IP de fábrica de MikroTik (si estás conectado a ether2-ether5 o al Wi-Fi del equipo)
  const hasDefault = Array.from(found.values()).some((d) => d.ipv4 === '192.168.88.1');
  if (!hasDefault) {
    const [api, winbox] = await Promise.all([
      probeTcpPort('192.168.88.1', apiPort, 900),
      probeTcpPort('192.168.88.1', 8291, 900),
    ]);
    if (api === 'open' || winbox === 'open' || api === 'refused') {
      found.set('PROBE-192.168.88.1', {
        mac: '',
        identity: 'MikroTik (IP de fábrica)',
        ipv4: '192.168.88.1',
        source: 'probe',
        apiPort: api,
        winboxPort: winbox,
      });
    }
  }

  // Diagnóstico de puertos para cada equipo con IP
  const devices = await Promise.all(
    Array.from(found.values()).map(async (d): Promise<DiscoveredDevice> => {
      let api: ApiPortState = d.apiPort || 'no-ip';
      let winbox: ApiPortState = d.winboxPort || 'no-ip';
      if (d.ipv4 && !d.apiPort) {
        [api, winbox] = await Promise.all([probeTcpPort(d.ipv4, apiPort), probeTcpPort(d.ipv4, 8291)]);
      }
      return {
        mac: d.mac || '',
        identity: d.identity || 'MikroTik',
        version: d.version || '',
        platform: d.platform || 'MikroTik',
        board: d.board || '',
        uptimeSeconds: d.uptimeSeconds ?? null,
        softwareId: d.softwareId || '',
        interfaceName: d.interfaceName || '',
        ipv4: d.ipv4 || null,
        ipv6: d.ipv6 || null,
        source: d.source || 'mndp',
        apiPort: api,
        winboxPort: winbox,
      };
    })
  );

  return devices.sort((a, b) => a.identity.localeCompare(b.identity));
}
