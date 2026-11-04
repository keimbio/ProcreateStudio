// Lossless round trip of every sample's Document.archive through PlistEdit, checked by Python's plistlib.
const api = require('./load'); const fs = require('fs'); const { execFileSync } = require('child_process');
(async () => {
  for (const f of process.argv.slice(2)) {
    const doc = await api.openFile(`../samples/${f}.procreate`);
    const raw = await doc.zip.read('Document.archive');
    const out = api.PlistEdit.write(api.PlistEdit.parse(raw));
    fs.writeFileSync('/tmp/a.plist', raw); fs.writeFileSync('/tmp/b.plist', out);
    const r = execFileSync('python3', ['-I', __dirname + '/strict_eq.py', '/tmp/a.plist', '/tmp/b.plist']).toString().trim();
    console.log(f, raw.length, '→', out.length, 'bytes', r);
    if (r !== 'equal') process.exit(1);
  }
})().catch(e => { console.error('FAIL', e); process.exit(1); });
