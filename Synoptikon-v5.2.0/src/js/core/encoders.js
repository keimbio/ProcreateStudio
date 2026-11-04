// ─── File encoders: TIFF image + swatch formats ───
const Encoders = (() => {
  // Baseline TIFF, 8-bit RGB or RGBA (unassociated alpha), PackBits-free single strip.
  function tiff({ data, w, h }, alpha) {
    const spp = alpha ? 4 : 3, px = w * h * spp;
    const tags = [[256, 4, 1, w], [257, 4, 1, h], [258, 3, spp, 0], [259, 3, 1, 1], [262, 3, 1, 2],
      [273, 4, 1, 0], [277, 3, 1, spp], [278, 4, 1, h], [279, 4, 1, px], [282, 5, 1, 0], [283, 5, 1, 0], [284, 3, 1, 1], [296, 3, 1, 2]];
    if (alpha) tags.push([338, 3, 1, 2]);
    tags.sort((a, b) => a[0] - b[0]);
    const ifd = 8, ifdLen = 2 + tags.length * 12 + 4;
    const bps = ifd + ifdLen, res = bps + 8, dataOff = res + 16;
    const buf = new ArrayBuffer(dataOff + px), dv = new DataView(buf), b = new Uint8Array(buf);
    b[0] = b[1] = 0x49; dv.setUint16(2, 42, true); dv.setUint32(4, ifd, true); dv.setUint16(ifd, tags.length, true);
    tags.forEach(([tag, type, cnt, val], i) => {
      const o = ifd + 2 + i * 12; dv.setUint16(o, tag, true); dv.setUint16(o + 2, type, true); dv.setUint32(o + 4, cnt, true);
      if (tag === 258) { if (spp > 2) dv.setUint32(o + 8, bps, true); }
      else if (tag === 273) dv.setUint32(o + 8, dataOff, true);
      else if (tag === 282) dv.setUint32(o + 8, res, true);
      else if (tag === 283) dv.setUint32(o + 8, res + 8, true);
      else if (type === 3) dv.setUint16(o + 8, val, true); else dv.setUint32(o + 8, val, true);
    });
    for (let i = 0; i < spp; i++) dv.setUint16(bps + i * 2, 8, true);
    dv.setUint32(res, 72, true); dv.setUint32(res + 4, 1, true); dv.setUint32(res + 8, 72, true); dv.setUint32(res + 12, 1, true);
    let o = dataOff;
    if (alpha) b.set(data, o);
    else for (let i = 0; i < data.length; i += 4) { b[o++] = data[i]; b[o++] = data[i + 1]; b[o++] = data[i + 2]; }
    return new Blob([buf], { type: 'image/tiff' });
  }

  // Adobe Swatch Exchange (big-endian, UTF-16 names, RGB float)
  function ase(colors, name) {
    const blocks = [];
    const nameBytes = s => { const a = new Uint8Array((s.length + 1) * 2); for (let i = 0; i < s.length; i++) { a[i * 2] = s.charCodeAt(i) >> 8; a[i * 2 + 1] = s.charCodeAt(i) & 255; } return a; };
    const group = (type, s) => { const nb = nameBytes(s); const d = new DataView(new ArrayBuffer(6 + 2 + nb.length)); d.setUint16(0, type); d.setUint32(2, 2 + nb.length); d.setUint16(6, s.length + 1); const u = new Uint8Array(d.buffer); u.set(nb, 8); return u; };
    blocks.push(group(0xC001, name));
    for (const c of colors) {
      const nb = nameBytes(c.hex); const len = 2 + nb.length + 4 + 12 + 2;
      const d = new DataView(new ArrayBuffer(6 + len)); d.setUint16(0, 1); d.setUint32(2, len); d.setUint16(6, c.hex.length + 1);
      const u = new Uint8Array(d.buffer); u.set(nb, 8); let p = 8 + nb.length;
      u.set([82, 71, 66, 32], p); p += 4;
      c.rgb.forEach(v => { d.setFloat32(p, v / 255); p += 4; }); d.setUint16(p, 2);
      blocks.push(u);
    }
    const end = new Uint8Array([0xC0, 0x02, 0, 0, 0, 0]); blocks.push(end);
    const head = new DataView(new ArrayBuffer(12)); [65, 83, 69, 70].forEach((v, i) => head.setUint8(i, v)); head.setUint16(4, 1); head.setUint16(6, 0); head.setUint32(8, colors.length + 2);
    return new Blob([head.buffer, ...blocks], { type: 'application/octet-stream' });
  }

  // Photoshop .aco (v1 + v2 with names)
  function aco(colors) {
    const n = colors.length, parts = [];
    const v1 = new DataView(new ArrayBuffer(4 + n * 10)); v1.setUint16(0, 1); v1.setUint16(2, n);
    colors.forEach((c, i) => { const o = 4 + i * 10; v1.setUint16(o, 0); c.rgb.forEach((v, j) => v1.setUint16(o + 2 + j * 2, v * 257)); });
    parts.push(v1.buffer);
    const h2 = new DataView(new ArrayBuffer(4)); h2.setUint16(0, 2); h2.setUint16(2, n); parts.push(h2.buffer);
    for (const c of colors) {
      const s = c.hex; const d = new DataView(new ArrayBuffer(10 + 4 + (s.length + 1) * 2));
      d.setUint16(0, 0); c.rgb.forEach((v, j) => d.setUint16(2 + j * 2, v * 257)); d.setUint32(10, s.length + 1);
      for (let i = 0; i < s.length; i++) d.setUint16(14 + i * 2, s.charCodeAt(i));
      parts.push(d.buffer);
    }
    return new Blob(parts, { type: 'application/octet-stream' });
  }

  // Photoshop .act (256 × RGB + count + transparent index)
  function act(colors) {
    const b = new Uint8Array(772); colors.slice(0, 256).forEach((c, i) => b.set(c.rgb, i * 3));
    const d = new DataView(b.buffer); d.setUint16(768, Math.min(256, colors.length)); d.setUint16(770, 0xFFFF);
    return new Blob([b], { type: 'application/octet-stream' });
  }

  const gpl = (colors, name) => new Blob(['GIMP Palette\nName: ' + name + '\nColumns: 6\n#\n' + colors.map(c => c.rgb.map(v => String(v).padStart(3)).join(' ') + '\t' + c.hex).join('\n') + '\n'], { type: 'text/plain' });

  // Procreate .swatches = ZIP containing Swatches.json, HSB 0..1, max 30 slots (empty slots = null)
  function swatches(colors, name) {
    const list = colors.slice(0, 30).map(c => { const [h, s, v] = Palette.hsv(c.rgb); return { hue: h, saturation: s, brightness: v, alpha: 1, colorSpace: 0 }; });
    while (list.length < 30) list.push(null);
    const json = JSON.stringify([{ name, swatches: list }]);
    return Zip.build([{ name: 'Swatches.json', data: new TextEncoder().encode(json) }]);
  }

  const css = (colors, name) => new Blob([`/* ${name} */\n:root {\n` + colors.map((c, i) => `  --color-${i + 1}: ${c.hex};`).join('\n') + '\n}\n'], { type: 'text/css' });
  const json = (colors, name) => new Blob([JSON.stringify({ name, colors: colors.map(c => ({ hex: c.hex, rgb: c.rgb, share: +c.share.toFixed(4) })) }, null, 2)], { type: 'application/json' });

  return { tiff, ase, aco, act, gpl, swatches, css, json };
})();
