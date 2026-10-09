/**
 * ============================================================================
 * MIKROMANAGER - PROTOCOLO BINARIO ROUTEROS API
 * Implementación estricta de codificación de longitud de palabras y parser de oraciones
 * ============================================================================
 */

export interface RouterOsSentence {
  type: '!re' | '!done' | '!trap' | '!fatal';
  attributes: Record<string, string>;
  tag?: string;
  rawWords: string[];
}

export class RouterOsProtocol {
  /**
   * Codifica la longitud de una palabra según la especificación de MikroTik:
   * - < 0x80: 1 byte
   * - < 0x4000: 2 bytes (bit 0x80)
   * - < 0x200000: 3 bytes (bits 0xC0)
   * - < 0x10000000: 4 bytes (bits 0xE0)
   * - >= 0x10000000: 5 bytes (0xF0 + 4 bytes)
   */
  static encodeLength(len: number): Buffer {
    if (len < 0x80) {
      return Buffer.from([len]);
    } else if (len < 0x4000) {
      return Buffer.from([(len >> 8) | 0x80, len & 0xff]);
    } else if (len < 0x200000) {
      return Buffer.from([(len >> 16) | 0xc0, (len >> 8) & 0xff, len & 0xff]);
    } else if (len < 0x10000000) {
      return Buffer.from([
        (len >> 24) | 0xe0,
        (len >> 16) & 0xff,
        (len >> 8) & 0xff,
        len & 0xff,
      ]);
    } else {
      return Buffer.from([
        0xf0,
        (len >> 24) & 0xff,
        (len >> 16) & 0xff,
        (len >> 8) & 0xff,
        len & 0xff,
      ]);
    }
  }

  /**
   * Codifica una palabra en formato binario de RouterOS
   */
  static encodeWord(word: string): Buffer {
    const wordBuf = Buffer.from(word, 'utf8');
    const lenBuf = this.encodeLength(wordBuf.length);
    return Buffer.concat([lenBuf, wordBuf]);
  }

  /**
   * Codifica una oración completa que termina con un byte 0x00
   */
  static encodeSentence(words: string[]): Buffer {
    const buffers: Buffer[] = words.map((w) => this.encodeWord(w));
    // Terminador de oración en RouterOS: longitud cero (byte 0x00)
    buffers.push(Buffer.from([0x00]));
    return Buffer.concat(buffers);
  }

  /**
   * Decodifica la longitud de la siguiente palabra del buffer.
   * Retorna [longitud, bytesLeidos] o null si el buffer está incompleto.
   */
  static decodeLength(buf: Buffer, offset: number): [number, number] | null {
    if (offset >= buf.length) return null;
    const b1 = buf[offset];

    if ((b1 & 0x80) === 0x00) {
      return [b1, 1];
    } else if ((b1 & 0xc0) === 0x80) {
      if (offset + 1 >= buf.length) return null;
      const b2 = buf[offset + 1];
      return [((b1 & 0x3f) << 8) | b2, 2];
    } else if ((b1 & 0xe0) === 0xc0) {
      if (offset + 2 >= buf.length) return null;
      const b2 = buf[offset + 1];
      const b3 = buf[offset + 2];
      return [((b1 & 0x1f) << 16) | (b2 << 8) | b3, 3];
    } else if ((b1 & 0xf0) === 0xe0) {
      if (offset + 3 >= buf.length) return null;
      const b2 = buf[offset + 1];
      const b3 = buf[offset + 2];
      const b4 = buf[offset + 3];
      return [((b1 & 0x0f) << 24) | (b2 << 16) | (b3 << 8) | b4, 4];
    } else if (b1 === 0xf0) {
      if (offset + 4 >= buf.length) return null;
      const b2 = buf[offset + 1];
      const b3 = buf[offset + 2];
      const b4 = buf[offset + 3];
      const b5 = buf[offset + 4];
      return [(b2 << 24) | (b3 << 16) | (b4 << 8) | b5, 5];
    }
    return null;
  }
}
