// ─── Tile-sparse compositor ───
// Works in Procreate's raw tile space (rows stored bottom-up). Only tiles that
// hold paint are touched, so a 36-layer file of sparse strokes stays fast.
// Orientation (row flip + document rotation + canvas flips) is applied once, in toImage().

const Composite = (() => {
  // ── separable blend functions B(cb, cs), straight colour 0..1 ──
  const cl = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const dodge = (b, s) => b <= 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s));
  const burn = (b, s) => b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s);
  const hard = (b, s) => s <= 0.5 ? b * 2 * s : (() => { const t = 2 * s - 1; return b + t - b * t; })();
  const soft = (b, s) => {
    if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b);
    const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
    return b + (2 * s - 1) * (d - b);
  };
  const SEP = {
    0: (b, s) => s,
    1: (b, s) => b * s,
    2: (b, s) => b + s - b * s,
    3: (b, s) => Math.min(1, b + s),
    4: (b, s) => Math.max(b, s),
    5: (b, s) => b + s - 2 * b * s,
    6: (b, s) => Math.abs(b - s),
    7: (b, s) => Math.max(0, b - s),
    8: (b, s) => Math.max(0, b + s - 1),
    9: dodge, 10: burn,
    11: (b, s) => hard(s, b),
    12: hard,
    17: soft,
    19: (b, s) => Math.min(b, s),
    20: (b, s) => (b + s >= 1 ? 1 : 0),
    21: (b, s) => s <= 0.5 ? burn(b, 2 * s) : dodge(b, 2 * (s - 0.5)),
    22: (b, s) => cl(b + 2 * s - 1),
    23: (b, s) => s <= 0.5 ? Math.min(b, 2 * s) : Math.max(b, 2 * s - 1),
    26: (b, s) => s <= 0 ? (b > 0 ? 1 : 0) : Math.min(1, b / s)
  };
  // ── non-separable (W3C compositing spec) ──
  const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
  function clipColor(c) {
    const L = lum(c[0], c[1], c[2]); const n = Math.min(c[0], c[1], c[2]), x = Math.max(c[0], c[1], c[2]);
    if (n < 0) for (let i = 0; i < 3; i++) c[i] = L + (c[i] - L) * L / (L - n);
    if (x > 1) for (let i = 0; i < 3; i++) c[i] = L + (c[i] - L) * (1 - L) / (x - L);
    return c;
  }
  const setLum = (c, L) => { const d = L - lum(c[0], c[1], c[2]); return clipColor([c[0] + d, c[1] + d, c[2] + d]); };
  const sat = c => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
  function setSat(c, s) {
    const o = [0, 1, 2].sort((a, b) => c[a] - c[b]); const r = [0, 0, 0];
    const mx = c[o[2]], mn = c[o[0]];
    if (mx > mn) { r[o[1]] = (c[o[1]] - mn) * s / (mx - mn); r[o[2]] = s; }
    return r;
  }
  const NONSEP = {
    15: (b, s) => setLum(setSat(s, sat(b)), lum(b[0], b[1], b[2])),
    16: (b, s) => setLum(setSat(b, sat(s)), lum(b[0], b[1], b[2])),
    13: (b, s) => setLum(s, lum(b[0], b[1], b[2])),
    14: (b, s) => setLum(b, lum(s[0], s[1], s[2])),
    24: (b, s) => lum(s[0], s[1], s[2]) > lum(b[0], b[1], b[2]) ? s : b,
    25: (b, s) => lum(s[0], s[1], s[2]) < lum(b[0], b[1], b[2]) ? s : b
  };

  // Blend one premultiplied source tile onto a premultiplied destination tile (in place).
  // k: per-pixel coverage multiplier array (opacity × mask × clip), or a scalar.
  function blendTile(dst, src, mode, opacity, mask, clip) {
    const n = src.length >> 2;
    if (mode === 0) {
      for (let p = 0, i = 0; p < n; p++, i += 4) {
        const sa0 = src[i + 3]; if (!sa0) continue;
        let k = opacity; if (mask) k *= mask[p] / 255; if (clip) k *= clip[p] / 255; if (k <= 0) continue;
        const sa = sa0 * k / 255, inv = 1 - sa;
        dst[i] = src[i] * k + dst[i] * inv;
        dst[i + 1] = src[i + 1] * k + dst[i + 1] * inv;
        dst[i + 2] = src[i + 2] * k + dst[i + 2] * inv;
        dst[i + 3] = sa0 * k + dst[i + 3] * inv;
      }
      return;
    }
    const f = SEP[mode], g = NONSEP[mode];
    const B = [0, 0, 0], S = [0, 0, 0];
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      const sa0 = src[i + 3]; if (!sa0) continue;
      let k = opacity; if (mask) k *= mask[p] / 255; if (clip) k *= clip[p] / 255; if (k <= 0) continue;
      const as = sa0 / 255 * k, ab = dst[i + 3] / 255;
      for (let c = 0; c < 3; c++) { S[c] = src[i + c] / sa0; B[c] = ab > 0 ? dst[i + c] / dst[i + 3] : 0; }
      let R;
      if (f) R = [f(B[0], S[0]), f(B[1], S[1]), f(B[2], S[2])];
      else R = (g || NONSEP[13])(B, S);
      const ao = as + ab * (1 - as);
      for (let c = 0; c < 3; c++) {
        const cs2 = (1 - ab) * S[c] + ab * cl(R[c]);
        dst[i + c] = (as * cs2 + (1 - as) * ab * B[c]) * 255;
      }
      dst[i + 3] = ao * 255;
    }
  }

  // Compose a stack. items: bottom → top [{tiles, maskTiles, opacity, blend, clipped}]
  // orphanClipped: 'hide' (Procreate behaviour) or 'show' (render unclipped)
  function compose(items, orphanClipped) {
    const out = new Map();
    let base = null; // { tiles, maskTiles } of the current clipping base
    for (const it of items) {
      let clipTiles = null, clipMask = null;
      if (it.clipped) {
        if (base) { clipTiles = base.tiles; clipMask = base.maskTiles; }
        else if (orphanClipped === 'hide') continue;
      } else base = it;
      for (const [idx, src] of it.tiles) {
        let clip = null;
        if (clipTiles) {
          const ct = clipTiles.get(idx); if (!ct) continue;
          const cm = clipMask && clipMask.get(idx);
          clip = new Uint8Array(src.length >> 2);
          for (let p = 0; p < clip.length; p++) clip[p] = cm ? (ct[p * 4 + 3] * cm[p] / 255) : ct[p * 4 + 3];
        }
        let dst = out.get(idx);
        if (!dst) { dst = new Uint8ClampedArray(src.length); out.set(idx, dst); }
        blendTile(dst, src, it.blend, it.opacity, it.maskTiles ? it.maskTiles.get(idx) : null, clip);
      }
    }
    return out;
  }

  // Oriented output geometry
  function geometry(info, orient) {
    const rot = orient ? info.orientation : 0;
    const swap = rot === 90 || rot === 270;
    return { rot, swap, W: swap ? info.height : info.width, H: swap ? info.width : info.height,
      fh: orient && info.flipH, fv: orient && info.flipV };
  }

  // Tiles → straight RGBA image, downsampled by integer k (box filter in premultiplied space).
  // bg: [r,g,b] 0..1 to flatten onto, or null for transparency.
  function toImage(tiles, info, { k = 1, bg = null, orient = true } = {}) {
    const { width: W0, height: H0, tileSize: ts, cols } = info;
    const G = geometry(info, orient);
    const w = Math.ceil(G.W / k), h = Math.ceil(G.H / k);
    const acc = new Float32Array(w * h * 4), cnt = k > 1 ? new Uint16Array(w * h) : null;
    // raw (x, yr) with yr counted from bottom → upright (x, y) → rotated (u, v)
    const map = (x, yr) => {
      const y = H0 - 1 - yr; let u, v;
      switch (G.rot) {
        case 90: u = H0 - 1 - y; v = x; break;
        case 180: u = W0 - 1 - x; v = H0 - 1 - y; break;
        case 270: u = y; v = W0 - 1 - x; break;
        default: u = x; v = y;
      }
      if (G.fh) u = G.W - 1 - u; if (G.fv) v = G.H - 1 - v;
      return ((v / k) | 0) * w + ((u / k) | 0);
    };
    for (const [idx, t] of tiles) {
      const c = idx % cols, r = (idx / cols) | 0;
      const x0 = c * ts, y0 = r * ts;
      const xm = Math.min(ts, W0 - x0), ym = Math.min(ts, H0 - y0);
      for (let y = 0; y < ym; y++) for (let x = 0; x < xm; x++) {
        const s = (y * ts + x) * 4; const a = t[s + 3];
        const d = map(x0 + x, y0 + y);
        if (cnt) cnt[d]++;
        if (!a) continue;
        const o = d * 4; acc[o] += t[s]; acc[o + 1] += t[s + 1]; acc[o + 2] += t[s + 2]; acc[o + 3] += a;
      }
    }
    const out = new Uint8ClampedArray(w * h * 4);
    const bgr = bg ? bg.map(v => v * 255) : null;
    for (let p = 0, o = 0; p < w * h; p++, o += 4) {
      const n = cnt ? (cnt[p] || k * k) : 1;
      const a = acc[o + 3] / n;
      if (bgr) {
        const ia = 1 - a / 255;
        out[o] = acc[o] / n + bgr[0] * ia; out[o + 1] = acc[o + 1] / n + bgr[1] * ia; out[o + 2] = acc[o + 2] / n + bgr[2] * ia; out[o + 3] = 255;
      } else if (a > 0) {
        const m = 255 / (acc[o + 3]);
        out[o] = acc[o] * m; out[o + 1] = acc[o + 1] * m; out[o + 2] = acc[o + 2] * m; out[o + 3] = a;
      }
    }
    return { data: out, w, h };
  }

  // Bounding box (in oriented output space, full res) of tiles that hold paint
  function hasPaint(tiles) { return tiles && tiles.size > 0; }

  return { compose, toImage, geometry, blendTile, hasPaint };
})();
