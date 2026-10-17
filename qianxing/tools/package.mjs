// Preserve the native import namespace and package the current editable sources.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createStudio, validateServerGiaCompatibility} from '../../simulator/dist/studio.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prefix = 'workspace/battle-factory/lua/';
const giaPath = path.join(root, 'battle-factory-v7.1.gia');
const savePath = path.join(root, 'battle-factory.save.json');
let save;
if (process.argv.includes('--extract')) {
  const reader = createStudio();
  reader.importData('gia', fs.readFileSync(giaPath).toString('base64'), 'battle-factory-v7.1.gia');
  save = reader.archiveData();
  delete save.scriptSync;
  for (const s of save.assets.scripts) {
    assert.ok(s.path.startsWith(prefix) && !s.path.includes('..'));
    const file = path.join(root, 'lua', s.path.slice(prefix.length));
    fs.mkdirSync(path.dirname(file), {recursive:true});
    fs.writeFileSync(file, s.source);
  }
} else {
  save = JSON.parse(fs.readFileSync(savePath, 'utf8'));
  for (const s of save.assets.scripts) {
    assert.ok(s.path.startsWith(prefix) && !s.path.includes('..'));
    s.source = fs.readFileSync(path.join(root, 'lua', s.path.slice(prefix.length)), 'utf8');
  }
  const studio = createStudio(save);
  const binary = Buffer.from(studio.exportData('gia-combined').data, 'base64');
  assert.ok(binary.length < 20_000_000, 'Native package exceeds the 20 MB target');
  assert.equal(validateServerGiaCompatibility(binary).valid, true);
  const reader = createStudio();
  reader.importData('gia', binary.toString('base64'), 'battle-factory-v7.1.gia');
  const roundtrip = reader.archiveData();
  assert.equal(roundtrip.assets.scripts.length, save.assets.scripts.length);
  for (const s of roundtrip.assets.scripts)
    assert.equal(s.source, save.assets.scripts.find(x => x.path === s.path)?.source, s.path);
  fs.writeFileSync(giaPath, binary);
}
assert.equal(save.assets.scripts.length, 351);
fs.writeFileSync(savePath, JSON.stringify(save, null, 2) + '\n');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const files = ['battle-factory-v7.1.gia', 'battle-factory.save.json', ...save.assets.scripts.map(s => 'lua/' + s.path.slice(prefix.length))];
fs.writeFileSync(path.join(root, 'SHA256SUMS.txt'), files.map(f => hash(fs.readFileSync(path.join(root,f))) + '  ' + f).join('\n') + '\n');
console.log(JSON.stringify({version:'boot-v7.1-20mb', scripts:351, giaBytes:fs.statSync(giaPath).size}));
