// Node harness: concatenates core modules exactly as the build does, then exposes them.
const fs = require('fs'), path = require('path'), vm = require('vm');
const NAMES = ['zip', 'bplist', 'plistedit', 'codecs', 'procreate', 'composite', 'palette', 'encoders', 'writer', 'engine'];
const EXPORTS = ['Zip', 'BPlist', 'PlistEdit', 'Codecs', 'Procreate', 'Composite', 'Palette', 'Encoders', 'Writer', 'createEngine'];
const core = NAMES.map(n => path.join(__dirname, '../src/js/core', n + '.js'))
  .filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n');
const ctx = vm.createContext({ TextDecoder, TextEncoder, DecompressionStream, CompressionStream, Response, Blob, DataView, console, Math, Map, Set, WeakMap, Promise, Uint8Array, Uint8ClampedArray, Float32Array, Float64Array, Uint32Array, Uint16Array, Int32Array, ArrayBuffer, Number, BigInt, Date, Error, JSON, Object, Array, String, Infinity, NaN, isFinite, RegExp, setTimeout });
vm.runInContext(core + '\n;globalThis.__api={' + EXPORTS.map(n => `${n}:typeof ${n}!=='undefined'?${n}:null`).join(',') + '};', ctx);
module.exports = ctx.__api;
module.exports.openFile = async p => ctx.__api.Procreate.open(await fs.openAsBlob(p));
