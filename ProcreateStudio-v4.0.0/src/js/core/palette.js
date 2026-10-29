// ─── Palette extraction ───
// Deterministic (same artwork → same palette, so no "Regenerate" lottery):
// 1) 5-bit-per-channel histogram of opaque pixels, 2) weighted k-means in CIELAB
// seeded by farthest-point selection from the most populated bin, 3) near-duplicate merge.

const Palette = (() => {
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const LIN = new Float32Array(256).map((_, i) => lin(i));
  function toLab(r, g, b) {
    const R = LIN[Math.round(r)], G = LIN[Math.round(g)], B = LIN[Math.round(b)];
    let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    x = f(x); y = f(y); z = f(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  function fromLab(L, a, b) {
    let y = (L + 16) / 116, x = a / 500 + y, z = y - b / 200;
    const f = t => { const t3 = t * t * t; return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787; };
    x = f(x) * 0.95047; y = f(y); z = f(z) * 1.08883;
    const g = c => { c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(c * 255))); };
    return [g(x * 3.2406 - y * 1.5372 - z * 0.4986), g(-x * 0.9689 + y * 1.8758 + z * 0.0415), g(x * 0.0557 - y * 0.2040 + z * 1.0570)];
  }
  const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

  // data: straight RGBA Uint8ClampedArray
  function extract(data, count) {
    const hist = new Map();
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const key = (data[i] >> 3) << 10 | (data[i + 1] >> 3) << 5 | (data[i + 2] >> 3);
      let h = hist.get(key);
      if (!h) { h = [0, 0, 0, 0]; hist.set(key, h); }
      h[0] += data[i]; h[1] += data[i + 1]; h[2] += data[i + 2]; h[3]++; total++;
    }
    if (!total) return [];
    const pts = [...hist.values()].map(h => ({ lab: toLab(h[0] / h[3], h[1] / h[3], h[2] / h[3]), w: h[3] }));
    const k = Math.min(count, pts.length);
    // farthest-point seeding, weighted toward populated colours
    pts.sort((a, b) => b.w - a.w);
    const cents = [pts[0].lab.slice()];
    const best = pts.map(p => d2(p.lab, cents[0]));
    while (cents.length < k) {
      let bi = 0, bs = -1;
      for (let i = 0; i < pts.length; i++) { const s = best[i] * Math.sqrt(pts[i].w); if (s > bs) { bs = s; bi = i; } }
      cents.push(pts[bi].lab.slice());
      for (let i = 0; i < pts.length; i++) best[i] = Math.min(best[i], d2(pts[i].lab, cents[cents.length - 1]));
    }
    const assign = new Int32Array(pts.length);
    for (let it = 0; it < 16; it++) {
      const sum = cents.map(() => [0, 0, 0, 0]); let moved = 0;
      for (let i = 0; i < pts.length; i++) {
        let bj = 0, bd = Infinity;
        for (let j = 0; j < cents.length; j++) { const d = d2(pts[i].lab, cents[j]); if (d < bd) { bd = d; bj = j; } }
        if (assign[i] !== bj) { assign[i] = bj; moved++; }
        const s = sum[bj], w = pts[i].w; s[0] += pts[i].lab[0] * w; s[1] += pts[i].lab[1] * w; s[2] += pts[i].lab[2] * w; s[3] += w;
      }
      sum.forEach((s, j) => { if (s[3]) cents[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; cents[j].w = s[3]; });
      if (!moved && it) break;
    }
    // merge near-identical centroids (ΔE76 < 3)
    const out = [];
    for (const c of cents.filter(c => c.w > 0).sort((a, b) => b.w - a.w)) {
      const dup = out.find(o => d2(o.lab, c) < 9);
      if (dup) dup.w += c.w; else out.push({ lab: c.slice(0, 3), w: c.w });
    }
    return out.map(c => { const rgb = fromLab(c.lab[0], c.lab[1], c.lab[2]); return { rgb, hex: hex(rgb), share: c.w / total, lab: c.lab }; });
  }

  const hex = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  function hsv([r, g, b]) {
    r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0; if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; if (h < 0) h += 1; }
    return [h, mx ? d / mx : 0, mx];
  }
  function sort(list, by) {
    const a = list.slice();
    if (by === 'hue') a.sort((p, q) => { const P = hsv(p.rgb), Q = hsv(q.rgb); const gp = P[1] < 0.12, gq = Q[1] < 0.12; return gp !== gq ? (gp ? 1 : -1) : gp ? Q[2] - P[2] : P[0] - Q[0]; });
    else if (by === 'light') a.sort((p, q) => q.lab[0] - p.lab[0]);
    else a.sort((p, q) => q.share - p.share);
    return a;
  }
  return { extract, sort, hex, hsv };
})();
