import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';
import { RouterOsProtocol, RouterOsSentence } from './protocol.js';

export interface RouterOsClientOptions {
  host: string;
  port: number;
  useSsl: boolean;
  username: string;
  password: string;
  timeoutMs?: number;
}

export class RouterOsClient {
  private socket: net.Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  public connected: boolean = false;
  private tagCounter: number = 1;
  private pendingRequests: Map<
    string,
    {
      resolve: (sentences: RouterOsSentence[]) => void;
      reject: (err: Error) => void;
      sentences: RouterOsSentence[];
      timer: NodeJS.Timeout;
    }
  > = new Map();
  private untaggedQueue: Array<{
    resolve: (sentences: RouterOsSentence[]) => void;
    reject: (err: Error) => void;
    sentences: RouterOsSentence[];
    timer: NodeJS.Timeout;
  }> = [];

  constructor(private readonly options: RouterOsClientOptions) {}

  /**
   * Conecta al router MikroTik y ejecuta el apretón de manos de autenticación (/login)
   * Compatible con RouterOS v6.x (Challenge-Response MD5) y RouterOS v7.x (Plain Auth)
   */
  async connect(): Promise<void> {
    const timeout = this.options.timeoutMs || 5000;

    return new Promise((resolve, reject) => {
      let isSettled = false;
      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          this.close();
          reject(
            new Error(
              `Tiempo de espera agotado (${timeout}ms) al conectar con ${this.options.host}:${this.options.port}.`
            )
          );
        }
      }, timeout);

      const onConnect = async () => {
        this.connected = true;
        try {
          // 1. Enviar comando /login (sin .tag, ya que RouterOS nunca retorna .tag en /login)
          const loginWords = ['/login'];
          if (this.options.username) loginWords.push(`=name=${this.options.username}`);
          if (this.options.password) loginWords.push(`=password=${this.options.password}`);

          const loginResponse = await this.executeRawCommand(loginWords, 4000);

          const done = loginResponse.find((s) => s.type === '!done');
          const trap = loginResponse.find((s) => s.type === '!trap');

          // Caso A: RouterOS v6 Challenge-Response (!done =ret=CHALLENGE_HEX)
          if (done && done.attributes['ret']) {
            const challenge = done.attributes['ret'];
            const chalBuf = Buffer.from(challenge, 'hex');
            const passBuf = Buffer.from(this.options.password, 'utf8');
            const md5 = crypto.createHash('md5');
            md5.update(Buffer.concat([Buffer.from([0x00]), passBuf, chalBuf]));
            const respHex = '00' + md5.digest('hex');

            const chalResp = await this.executeRawCommand(
              ['/login', `=name=${this.options.username}`, `=response=${respHex}`],
              4000
            );

            const chalTrap = chalResp.find((s) => s.type === '!trap');
            if (chalTrap) {
              const msg = chalTrap.attributes['message'] || 'Usuario o contraseña incorrectos';
              throw new Error(`Error de autenticación en MikroTik: ${msg}`);
            }
          } else if (trap) {
            // Caso B: Si RouterOS rechazó el login directo con password, intentar el método de desafío
            // (firmwares antiguos de RouterOS v6 requieren /login sin argumentos primero para emitir =ret=)
            try {
              const chalInit = await this.executeRawCommand(['/login'], 3000);
              const initDone = chalInit.find((s) => s.type === '!done');
              if (initDone && initDone.attributes['ret']) {
                const challenge = initDone.attributes['ret'];
                const chalBuf = Buffer.from(challenge, 'hex');
                const passBuf = Buffer.from(this.options.password, 'utf8');
                const md5 = crypto.createHash('md5');
                md5.update(Buffer.concat([Buffer.from([0x00]), passBuf, chalBuf]));
                const respHex = '00' + md5.digest('hex');

                const chalResp2 = await this.executeRawCommand(
                  ['/login', `=name=${this.options.username}`, `=response=${respHex}`],
                  3000
                );

                const chalTrap2 = chalResp2.find((s) => s.type === '!trap');
                if (chalTrap2) {
                  const msg = chalTrap2.attributes['message'] || 'Usuario o contraseña incorrectos';
                  throw new Error(`Error de autenticación en MikroTik: ${msg}`);
                }
              } else {
                const msg = trap.attributes['message'] || 'Credenciales de acceso no válidas';
                throw new Error(`Error de autenticación en MikroTik: ${msg}`);
              }
            } catch (innerErr) {
              throw innerErr;
            }
          }

          clearTimeout(timer);
          if (!isSettled) {
            isSettled = true;
            resolve();
          }
        } catch (authError) {
          clearTimeout(timer);
          this.close();
          if (!isSettled) {
            isSettled = true;
            reject(authError);
          }
        }
      };

      if (this.options.useSsl) {
        this.socket = tls.connect(
          {
            host: this.options.host,
            port: this.options.port,
            rejectUnauthorized: false,
          },
          onConnect
        );
      } else {
        this.socket = net.createConnection(
          {
            host: this.options.host,
            port: this.options.port,
          },
          onConnect
        );
      }

      this.socket.on('data', (chunk: Buffer) => {
        this.handleData(chunk);
      });

      this.socket.on('error', (err: Error) => {
        clearTimeout(timer);
        if (!isSettled) {
          isSettled = true;
          reject(
            new Error(`Fallo de socket con ${this.options.host}:${this.options.port}: ${err.message}`)
          );
        }
        this.close();
      });

      this.socket.on('close', () => {
        this.connected = false;
        // Rechazar peticiones pendientes
        for (const [tag, req] of this.pendingRequests.entries()) {
          clearTimeout(req.timer);
          req.reject(new Error('La conexión con el router MikroTik fue cerrada.'));
          this.pendingRequests.delete(tag);
        }
        for (const req of this.untaggedQueue) {
          clearTimeout(req.timer);
          req.reject(new Error('La conexión con el router MikroTik fue cerrada.'));
        }
        this.untaggedQueue = [];
      });
    });
  }

  /**
   * Ejecuta un comando especial sin inyectar .tag (usado para /login)
   */
  async executeRawCommand(words: string[], timeoutMs: number = 4000): Promise<RouterOsSentence[]> {
    if (!this.socket || !this.connected) {
      throw new Error('El cliente RouterOS no está conectado.');
    }

    const encoded = RouterOsProtocol.encodeSentence(words);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.untaggedQueue.findIndex((q) => q.resolve === resolve);
        if (idx !== -1) this.untaggedQueue.splice(idx, 1);
        reject(
          new Error(`Tiempo de espera agotado (${timeoutMs}ms) esperando respuesta al comando '${words[0]}'`)
        );
      }, timeoutMs);

      this.untaggedQueue.push({
        resolve,
        reject,
        sentences: [],
        timer,
      });

      this.socket!.write(encoded, (err) => {
        if (err) {
          clearTimeout(timer);
          const idx = this.untaggedQueue.findIndex((q) => q.resolve === resolve);
          if (idx !== -1) this.untaggedQueue.splice(idx, 1);
          reject(err);
        }
      });
    });
  }

  /**
   * Ejecuta un comando en MikroTik mediante multiplexación de tags (.tag=req_X)
   */
  async executeCommand(
    command: string,
    attributes: string[] = [],
    timeoutMs: number = 6000
  ): Promise<RouterOsSentence[]> {
    if (!this.socket || !this.connected) {
      throw new Error('El cliente RouterOS no está conectado.');
    }

    const tag = `tag_${this.tagCounter++}`;
    const words = [command, `.tag=${tag}`, ...attributes];
    const encoded = RouterOsProtocol.encodeSentence(words);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(tag);
        reject(
          new Error(
            `Tiempo de espera agotado (${timeoutMs}ms) esperando respuesta al comando '${command}'`
          )
        );
      }, timeoutMs);

      this.pendingRequests.set(tag, {
        resolve,
        reject,
        sentences: [],
        timer,
      });

      this.socket!.write(encoded, (err) => {
        if (err) {
          clearTimeout(timer);
          this.pendingRequests.delete(tag);
          reject(err);
        }
      });
    });
  }

  /**
   * Procesa fragmentos de datos del socket TCP y extrae oraciones completas
   */
  private handleData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (this.buffer.length > 0) {
      let offset = 0;
      const words: string[] = [];
      let sentenceComplete = false;

      while (offset < this.buffer.length) {
        const decoded = RouterOsProtocol.decodeLength(this.buffer, offset);
        if (!decoded) break;

        const [wordLen, lenBytesCount] = decoded;
        offset += lenBytesCount;

        if (wordLen === 0) {
          sentenceComplete = true;
          break;
        }

        if (offset + wordLen > this.buffer.length) {
          break;
        }

        const word = this.buffer.toString('utf8', offset, offset + wordLen);
        offset += wordLen;
        words.push(word);
      }

      if (!sentenceComplete) {
        break;
      }

      this.buffer = this.buffer.subarray(offset);

      if (words.length > 0) {
        this.dispatchSentence(words);
      }
    }
  }

  /**
   * Despacha una oración decodificada a la promesa que coincide con su .tag o a la cola untagged
   */
  private dispatchSentence(words: string[]): void {
    const type = words[0] as '!re' | '!done' | '!trap' | '!fatal';
    const attributes: Record<string, string> = {};
    let tag: string | undefined;

    for (let i = 1; i < words.length; i++) {
      const w = words[i];
      if (w.startsWith('.tag=')) {
        tag = w.substring(5);
      } else if (w.startsWith('=.tag=')) {
        tag = w.substring(6);
      } else if (w.startsWith('=')) {
        const eqIdx = w.indexOf('=', 1);
        if (eqIdx !== -1) {
          const key = w.substring(1, eqIdx);
          const val = w.substring(eqIdx + 1);
          attributes[key] = val;
        } else {
          attributes[w.substring(1)] = '';
        }
      }
    }

    const sentence: RouterOsSentence = {
      type,
      attributes,
      tag,
      rawWords: words,
    };

    if (tag && this.pendingRequests.has(tag)) {
      const pending = this.pendingRequests.get(tag)!;
      if (type === '!re') {
        pending.sentences.push(sentence);
      } else if (type === '!done' || type === '!trap' || type === '!fatal') {
        pending.sentences.push(sentence);
        clearTimeout(pending.timer);
        this.pendingRequests.delete(tag);
        pending.resolve(pending.sentences);
      }
    } else if (this.untaggedQueue.length > 0) {
      // Sentencia sin tag para la cola de comandos sin tag (ej. /login)
      const pending = this.untaggedQueue[0];
      if (type === '!re') {
        pending.sentences.push(sentence);
      } else if (type === '!done' || type === '!trap' || type === '!fatal') {
        pending.sentences.push(sentence);
        clearTimeout(pending.timer);
        this.untaggedQueue.shift();
        pending.resolve(pending.sentences);
      }
    } else if (this.pendingRequests.size === 1) {
      const entry = this.pendingRequests.entries().next().value;
      if (entry) {
        const [pendingTag, pending] = entry;
        if (type === '!re') {
          pending.sentences.push(sentence);
        } else if (type === '!done' || type === '!trap' || type === '!fatal') {
          pending.sentences.push(sentence);
          clearTimeout(pending.timer);
          this.pendingRequests.delete(pendingTag);
          pending.resolve(pending.sentences);
        }
      }
    }

  }

  /**
   * Cierra el socket y limpia los recursos
   */
  close(): void {
    this.connected = false;
    for (const req of this.untaggedQueue) {
      clearTimeout(req.timer);
    }
    this.untaggedQueue = [];
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch {}
      this.socket = null;
    }
    this.buffer = Buffer.alloc(0);
  }

  isConnected(): boolean {
    return this.connected;
  }
}
