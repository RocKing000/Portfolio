import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CryptoService {

  // AES-GCM
  /**
   * Encrypt plainText with AES-GCM-256.
   * Wire format: Base64( nonce[12] || ciphertext[N] || tag[16] )
   * Matches the .NET EncryptionService layout exactly.
   */
  async encrypt(plainText: string, key: string): Promise<string> {
    const cryptoKey = await this.importKey(key, 'encrypt');
    const iv        = crypto.getRandomValues(new Uint8Array(12));
    const plain     = new TextEncoder().encode(plainText);

    // Web Crypto returns ciphertext + tag appended (N + 16 bytes)
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 }, cryptoKey, plain
    );

    const combined = new Uint8Array(12 + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), 12);

    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Decrypt a Base64( nonce[12] || ciphertext[N] || tag[16] ) string.
   */
  async decrypt(cipherText: string, key: string): Promise<string> {
    const cryptoKey  = await this.importKey(key, 'decrypt');
    const combined   = Uint8Array.from(atob(cipherText), c => c.charCodeAt(0));
    const iv         = combined.slice(0, 12);
    const cipherAndTag = combined.slice(12); // ciphertext + tag (Web Crypto expects them joined)

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 }, cryptoKey, cipherAndTag
    );

    return new TextDecoder().decode(decrypted);
  }

  private async importKey(key: string, usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
    const raw = new TextEncoder().encode(key.substring(0, 32).padEnd(32, '0'));
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [usage]);
  }

  /** Delegates to the browser's built-in crypto.randomUUID(). */
  randomUUID(): string {
    return crypto.randomUUID();
  }

  // Date-based key
  /** DDMMYYYYDDMMYYYYDDMMYYYYDDMMYYYY - 32 chars, rotates daily. */
  getDateBasedKey(date = new Date()): string {
    const dd   = String(date.getDate()).padStart(2, '0');
    const mm   = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = String(date.getFullYear());
    const seg  = `${dd}${mm}${yyyy}`; // 8 chars
    return seg + seg + seg + seg;     // 32 chars
  }

  // MD5
  /**
   * MD5(input) → uppercase hex pairs joined by hyphens: "A1-B2-C3-..."
   * Uses ASCII byte encoding to match .NET's Encoding.ASCII.GetBytes().
   */
  md5(input: string): string {
    const hex = this.hexMD5(input);
    return hex.toUpperCase().match(/.{2}/g)!.join('-');
  }

  // Paul Johnston MD5 implementation (RFC 1321)
  private hexMD5(str: string): string {
    const safeAdd = (x: number, y: number): number => {
      const lsw = (x & 0xFFFF) + (y & 0xFFFF);
      return (((x >> 16) + (y >> 16) + (lsw >> 16)) << 16) | (lsw & 0xFFFF);
    };
    const rol = (n: number, c: number) => (n << c) | (n >>> (32 - c));
    const cmn = (q: number, a: number, b: number, x: number, s: number, t: number) =>
      safeAdd(rol(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
    const ff = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
      cmn((b & c) | (~b & d), a, b, x, s, t);
    const gg = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
      cmn((b & d) | (c & ~d), a, b, x, s, t);
    const hh = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
      cmn(b ^ c ^ d, a, b, x, s, t);
    const ii = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
      cmn(c ^ (b | ~d), a, b, x, s, t);

    // str → array of little-endian 32-bit words (ASCII bytes only)
    const len = str.length;
    const m: number[] = new Array(Math.ceil((len + 8) / 64) * 16).fill(0);
    for (let i = 0; i < len; i++)
      m[i >> 2] |= (str.charCodeAt(i) & 0xff) << ((i & 3) << 3);
    m[len >> 2] |= 0x80 << ((len & 3) << 3);
    m[m.length - 2] = len * 8;

    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;

    for (let i = 0; i < m.length; i += 16) {
      const [A, B, C, D] = [a, b, c, d];

      // Round 1
      a = ff(a,b,c,d, m[i],   7,-680876936);   d = ff(d,a,b,c, m[i+1], 12,-389564586);
      c = ff(c,d,a,b, m[i+2], 17, 606105819);  b = ff(b,c,d,a, m[i+3], 22,-1044525330);
      a = ff(a,b,c,d, m[i+4],  7,-176418897);  d = ff(d,a,b,c, m[i+5], 12, 1200080426);
      c = ff(c,d,a,b, m[i+6], 17,-1473231341); b = ff(b,c,d,a, m[i+7], 22,-45705983);
      a = ff(a,b,c,d, m[i+8],  7, 1770035416); d = ff(d,a,b,c, m[i+9], 12,-1958414417);
      c = ff(c,d,a,b, m[i+10],17,-42063);       b = ff(b,c,d,a, m[i+11],22,-1990404162);
      a = ff(a,b,c,d, m[i+12], 7, 1804603682); d = ff(d,a,b,c, m[i+13],12,-40341101);
      c = ff(c,d,a,b, m[i+14],17,-1502002290); b = ff(b,c,d,a, m[i+15],22, 1236535329);

      // Round 2
      a = gg(a,b,c,d, m[i+1],  5,-165796510);  d = gg(d,a,b,c, m[i+6],  9,-1069501632);
      c = gg(c,d,a,b, m[i+11],14, 643717713);  b = gg(b,c,d,a, m[i],   20,-373897302);
      a = gg(a,b,c,d, m[i+5],  5,-701558691);  d = gg(d,a,b,c, m[i+10], 9, 38016083);
      c = gg(c,d,a,b, m[i+15],14,-660478335);  b = gg(b,c,d,a, m[i+4], 20,-405537848);
      a = gg(a,b,c,d, m[i+9],  5, 568446438);  d = gg(d,a,b,c, m[i+14], 9,-1019803690);
      c = gg(c,d,a,b, m[i+3], 14,-187363961);  b = gg(b,c,d,a, m[i+8], 20, 1163531501);
      a = gg(a,b,c,d, m[i+13], 5,-1444681467); d = gg(d,a,b,c, m[i+2],  9,-51403784);
      c = gg(c,d,a,b, m[i+7], 14, 1735328473); b = gg(b,c,d,a, m[i+12],20,-1926607734);

      // Round 3
      a = hh(a,b,c,d, m[i+5],  4,-378558);     d = hh(d,a,b,c, m[i+8], 11,-2022574463);
      c = hh(c,d,a,b, m[i+11],16, 1839030562); b = hh(b,c,d,a, m[i+14],23,-35309556);
      a = hh(a,b,c,d, m[i+1],  4,-1530992060); d = hh(d,a,b,c, m[i+4], 11, 1272893353);
      c = hh(c,d,a,b, m[i+7], 16,-155497632);  b = hh(b,c,d,a, m[i+10],23,-1094730640);
      a = hh(a,b,c,d, m[i+13], 4, 681279174);  d = hh(d,a,b,c, m[i],   11,-358537222);
      c = hh(c,d,a,b, m[i+3], 16,-722521979);  b = hh(b,c,d,a, m[i+6], 23, 76029189);
      a = hh(a,b,c,d, m[i+9],  4,-640364487);  d = hh(d,a,b,c, m[i+12],11,-421815835);
      c = hh(c,d,a,b, m[i+15],16, 530742520);  b = hh(b,c,d,a, m[i+2], 23,-995338651);

      // Round 4
      a = ii(a,b,c,d, m[i],    6,-198630844);  d = ii(d,a,b,c, m[i+7], 10, 1126891415);
      c = ii(c,d,a,b, m[i+14],15,-1416354905); b = ii(b,c,d,a, m[i+5], 21,-57434055);
      a = ii(a,b,c,d, m[i+12], 6, 1700485571); d = ii(d,a,b,c, m[i+3], 10,-1894986606);
      c = ii(c,d,a,b, m[i+10],15,-1051523);    b = ii(b,c,d,a, m[i+1], 21,-2054922799);
      a = ii(a,b,c,d, m[i+8],  6, 1873313359); d = ii(d,a,b,c, m[i+15],10,-30611744);
      c = ii(c,d,a,b, m[i+6], 15,-1560198380); b = ii(b,c,d,a, m[i+13],21, 1309151649);
      a = ii(a,b,c,d, m[i+4],  6,-145523070);  d = ii(d,a,b,c, m[i+11],10,-1120210379);
      c = ii(c,d,a,b, m[i+2], 15, 718787259);  b = ii(b,c,d,a, m[i+9], 21,-343485551);

      a = safeAdd(a, A); b = safeAdd(b, B);
      c = safeAdd(c, C); d = safeAdd(d, D);
    }

    return [a, b, c, d].map(n =>
      Array.from({ length: 4 }, (_, i) =>
        ('0' + ((n >> (i * 8)) & 0xff).toString(16)).slice(-2)
      ).join('')
    ).join('');
  }
}
