// ─── Tile codecs: LZO1X (.chunk) and Apple LZ4 block-chain "bv41" (.lz4) ───
// Both decode into a caller-supplied output buffer; return bytes written.

const Codecs = (() => {
  // LZO1X-1 decompressor, structured after the Linux kernel's lzo1x_decompress_safe.
  function lzo(src, dst) {
    let ip = 0, op = 0, t, next = 0, state = 0, mpos;
    const ilen = src.length, olen = dst.length;
    const lit = n => { if (ip + n > ilen || op + n > olen) throw new Error('LZO overrun'); dst.set(src.subarray(ip, ip + n), op); ip += n; op += n; };
    const zeros = () => { let n = 0; while (src[ip] === 0) { n += 255; ip++; if (ip >= ilen) throw new Error('LZO overrun'); } return n; };
    let first = true;
    if (src[0] > 17) {
      t = src[ip++] - 17;
      if (t < 4) { next = t; state = next; lit(next); first = false; }
      else { lit(t); state = 4; }
    }
    for (;;) {
      t = src[ip++];
      if (ip > ilen) throw new Error('LZO overrun');
      let len;
      if (t < 16) {
        if (state === 0) {
          if (t === 0) t = zeros() + 15 + src[ip++];
          lit(t + 3); state = 4; continue;
        } else if (state !== 4) {
          next = t & 3; mpos = op - 1 - (t >> 2) - (src[ip++] << 2);
          if (mpos < 0) throw new Error('LZO bad offset');
          dst[op++] = dst[mpos++]; dst[op++] = dst[mpos];
          state = next; lit(next); continue;
        } else {
          next = t & 3; mpos = op - 2049 - (t >> 2) - (src[ip++] << 2); len = 3;
        }
      } else if (t >= 64) {
        next = t & 3; mpos = op - 1 - ((t >> 2) & 7) - (src[ip++] << 3); len = (t >> 5) + 1;
      } else if (t >= 32) {
        len = (t & 31) + 2; if (len === 2) len += zeros() + 31 + src[ip++];
        const v = src[ip] | (src[ip + 1] << 8); ip += 2;
        mpos = op - 1 - (v >> 2); next = v & 3;
      } else {
        mpos = op - ((t & 8) << 11); len = (t & 7) + 2; if (len === 2) len += zeros() + 7 + src[ip++];
        const v = src[ip] | (src[ip + 1] << 8); ip += 2;
        mpos -= v >> 2; next = v & 3;
        if (mpos === op) return op; // end-of-stream marker
        mpos -= 0x4000;
      }
      if (mpos < 0 || op + len > olen) throw new Error('LZO bad match');
      for (let k = 0; k < len; k++) dst[op++] = dst[mpos++];
      state = next; lit(next);
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

  return { lzo, bv4 };
})();
