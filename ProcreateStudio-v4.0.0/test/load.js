// Node harness: concatenates core modules exactly as the build does, then runs a test fn.
const fs = require('fs'), path = require('path'), vm = require('vm');
const core = ['zip', 'bplist', 'codecs', 'procreate', 'composite', 'palette', 'encoders']
  .map(n => path.join(__dirname, '../src/js/core', n + '.js'))
  .filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n');
const ctx = vm.createContext({ TextDecoder, TextEncoder, DecompressionStream, Response, Blob, DataView, console, Math, Map, Set, Promise, Uint8Array, Uint8ClampedArray, Float32Array, Uint32Array, Uint16Array, Int32Array, ArrayBuffer, Number, BigInt, Date, Error, JSON, Object, Array, String, Infinity, NaN, isFinite });
vm.runInContext(core + '\n;globalThis.__api={Zip,BPlist,Codecs,Procreate,' + ['Composite', 'Palette', 'Encoders'].map(n => `${n}:typeof ${n}!=='undefined'?${n}:null`).join(',') + '};', ctx);
module.exports = ctx.__api;
module.exports.openFile = async p => ctx.__api.Procreate.open(await fs.openAsBlob(p));
