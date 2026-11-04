// ─── Tile codecs: LZO1X (.chunk) and Apple LZ4 block-chain "bv41" (.lz4) ───
// Both decode into a caller-supplied output buffer; return bytes written.

const Codecs = (() => {
  // LZO1X-1 decompressor, structured after the Linux kernel's lzo1x_decompress_safe.
  // v5.2: the same state machine with the per-byte helper closures inlined and long literal runs /
  // non-overlapping matches copied in bulk (≈2–3× faster; byte-identical output, see test/t11_codecs.js).
  function lzo(src, dst) {
    let ip = 0, op = 0, t, next = 0, state = 0, mpos, len, n;
    const ilen = src.length, olen = dst.length;
    if (src[0] > 17) {
      t = src[ip++] - 17;
      if (ip + t > ilen || op + t > olen) throw new Error('LZO overrun');
      for (n = 0; n < t; n++) dst[op++] = src[ip++];
      state = t < 4 ? t : 4; next = state;
    }
    for (;;) {
      if (ip >= ilen) throw new Error('LZO overrun');
      t = src[ip++];
      if (t < 16) {
        if (state === 0) {
          if (t === 0) { n = 0; while (src[ip] === 0) { n += 255; if (++ip >= ilen) throw new Error('LZO overrun'); } t = n + 15 + src[ip++]; }
          t += 3;
          if (ip + t > ilen || op + t > olen) throw new Error('LZO overrun');
          if (t > 24) { dst.set(src.subarray(ip, ip + t), op); ip += t; op += t; } else for (n = 0; n < t; n++) dst[op++] = src[ip++];
          state = 4; continue;
        } else if (state !== 4) {
          next = t & 3; mpos = op - 1 - (t >> 2) - (src[ip++] << 2);
          if (mpos < 0 || op + 2 > olen) throw new Error('LZO bad offset');
          dst[op++] = dst[mpos++]; dst[op++] = dst[mpos];
          if (ip + next > ilen || op + next > olen) throw new Error('LZO overrun');
          for (n = 0; n < next; n++) dst[op++] = src[ip++];
          state = next; continue;
        } else {
          next = t & 3; mpos = op - 2049 - (t >> 2) - (src[ip++] << 2); len = 3;
        }
      } else if (t >= 64) {
        next = t & 3; mpos = op - 1 - ((t >> 2) & 7) - (src[ip++] << 3); len = (t >> 5) + 1;
      } else if (t >= 32) {
        len = (t & 31) + 2;
        if (len === 2) { n = 0; while (src[ip] === 0) { n += 255; if (++ip >= ilen) throw new Error('LZO overrun'); } len += n + 31 + src[ip++]; }
        const v = src[ip] | (src[ip + 1] << 8); ip += 2;
        mpos = op - 1 - (v >> 2); next = v & 3;
      } else {
        mpos = op - ((t & 8) << 11); len = (t & 7) + 2;
        if (len === 2) { n = 0; while (src[ip] === 0) { n += 255; if (++ip >= ilen) throw new Error('LZO overrun'); } len += n + 7 + src[ip++]; }
        const v = src[ip] | (src[ip + 1] << 8); ip += 2;
        mpos -= v >> 2; next = v & 3;
        if (mpos === op) return op; // end-of-stream marker
        mpos -= 0x4000;
      }
      if (mpos < 0 || op + len > olen) throw new Error('LZO bad match');
      if (op - mpos >= len && len > 16) { dst.copyWithin(op, mpos, mpos + len); op += len; }
      else for (n = 0; n < len; n++) dst[op++] = dst[mpos++];
      if (ip + next > ilen || op + next > olen) throw new Error('LZO overrun');
      for (n = 0; n < next; n++) dst[op++] = src[ip++];
      state = next;
    }
  }

  // Raw LZ4 block. `base` lets matches reach into previously decoded blocks
  // (Apple's chained "bv41" blocks use the prior output as a prefix dictionary).
  function lz4Block(src, s, sEnd, dst, op, oEnd) {
    while (s < sEnd) {
      const token = src[s++];
      let n = token >> 4;
      if (n === 15) { let x; do { x = src[s++]; n += x; } while (x === 255); }
      if (op + n > oEnd || s + n > sEnd) throw new Error('LZ4 literal overrun');
      dst.set(src.subarray(s, s + n), op); s += n; op += n;
      if (s >= sEnd) break;
      const off = src[s] | (src[s + 1] << 8); s += 2;
      let m = token & 15;
      if (m === 15) { let x; do { x = src[s++]; m += x; } while (x === 255); }
      m += 4;
      let p = op - off;
      if (off === 0 || p < 0 || op + m > oEnd) throw new Error('LZ4 bad match');
      if (off >= m) { dst.copyWithin(op, p, p + m); op += m; }
      else { for (let k = 0; k < m; k++) dst[op++] = dst[p++]; }
    }
    return op;
  }

  // Apple compression_stream LZ4 container: repeated blocks of
  //  'bv41' u32 decoded u32 encoded <lz4 block> | 'bv4-' u32 n u32 n <raw> | 'bv4$' end
  function bv4(src, dst) {
    let s = 0, op = 0;
    const tag = i => (src[i] << 24 | src[i + 1] << 16 | src[i + 2] << 8 | src[i + 3]) >>> 0;
    const le = i => (src[i] | src[i + 1] << 8 | src[i + 2] << 16 | src[i + 3] << 24) >>> 0;
    while (s + 4 <= src.length) {
      const t = tag(s);
      if (t === 0x62763424) return op;                   // 'bv4$'
      if (t === 0x62763431) {                            // 'bv41'
        const dec = le(s + 4), enc = le(s + 8); s += 12;
        const end = lz4Block(src, s, s + enc, dst, op, op + dec);
        if (end - op !== dec) throw new Error('LZ4 size mismatch');
        op = end; s += enc;
      } else if (t === 0x6276342d) {                     // 'bv4-'
        const n = le(s + 4); s += 12; dst.set(src.subarray(s, s + n), op); op += n; s += n;
      } else throw new Error('Unknown LZ4 block tag');
    }
    return op;
  }

  // ── encoder: greedy LZ4 block compressor, emitted as Apple's bv41 chain ──
  // 64 KB blocks (the size Procreate itself writes), each self-contained, ended by 'bv4$'.
  // Follows the LZ4 block rules: the last 5 bytes are literals and no match starts
  // within the final 12 bytes of a block.
  function lz4BlockEncode(src, s0, s1, out, op) {
    const HB = 14, table = new Int32Array(1 << HB).fill(-1);
    const hash = i => (Math.imul(src[i] | src[i + 1] << 8 | src[i + 2] << 16 | src[i + 3] << 24, 2654435761) >>> (32 - HB));
    const mflimit = s1 - 12, lastLit = s1 - 5;
    let anchor = s0, i = s0;
    const writeLen = n => { while (n >= 255) { out[op++] = 255; n -= 255; } out[op++] = n; };
    while (i < mflimit) {
      const h = hash(i), ref = table[h]; table[h] = i;
      if (ref >= s0 && i - ref < 65536 && src[ref] === src[i] && src[ref + 1] === src[i + 1] && src[ref + 2] === src[i + 2] && src[ref + 3] === src[i + 3]) {
        let m = 4; while (i + m < lastLit && src[ref + m] === src[i + m]) m++;
        const lit = i - anchor, tok = op++;
        out[tok] = (lit >= 15 ? 15 : lit) << 4 | (m - 4 >= 15 ? 15 : m - 4);
        if (lit >= 15) writeLen(lit - 15);
        out.set(src.subarray(anchor, i), op); op += lit;
        const off = i - ref; out[op++] = off & 255; out[op++] = off >> 8;
        if (m - 4 >= 15) writeLen(m - 4 - 15);
        i += m; anchor = i;
      } else i++;
    }
    const lit = s1 - anchor, tok = op++;
    out[tok] = (lit >= 15 ? 15 : lit) << 4;
    if (lit >= 15) writeLen(lit - 15);
    out.set(src.subarray(anchor, s1), op); op += lit;
    return op;
  }
  function bv4Encode(src) {
    const B = 65536, nb = Math.ceil(src.length / B) || 1;
    const out = new Uint8Array(src.length + (src.length >> 7) + nb * 32 + 64); let op = 0;
    const le = v => { out[op++] = v & 255; out[op++] = v >> 8 & 255; out[op++] = v >> 16 & 255; out[op++] = v >>> 24; };
    for (let s = 0; s < src.length; s += B) {
      const e = Math.min(src.length, s + B);
      out.set([0x62, 0x76, 0x34, 0x31], op); op += 4; le(e - s); const encAt = op; op += 4;
      const start = op; op = lz4BlockEncode(src, s, e, out, op);
      const enc = op - start; out[encAt] = enc & 255; out[encAt + 1] = enc >> 8 & 255; out[encAt + 2] = enc >> 16 & 255; out[encAt + 3] = enc >>> 24;
    }
    out.set([0x62, 0x76, 0x34, 0x24], op); op += 4;
    return out.slice(0, op);
  }

  return { lzo, bv4, bv4Encode };
})();
