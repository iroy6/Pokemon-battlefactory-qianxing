import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createStudio, validateServerGiaCompatibility} from '../simulator/dist/studio.mjs';
const require = createRequire(import.meta.url);
const {lua, lauxlib, lualib, to_luastring, to_jsstring} = require('fengari');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root,name), 'utf8'));
const native = read('qianxing/battle-factory.save.json');
const binary = fs.readFileSync(path.join(root,'qianxing/battle-factory-v7.1.gia'));
assert.equal(validateServerGiaCompatibility(binary).valid, true);
const imported = createStudio();
imported.importData('gia', binary.toString('base64'), 'battle-factory-v7.1.gia');
const importedSave = imported.archiveData();
assert.equal(importedSave.assets.scripts.length, 351);
for (const line of fs.readFileSync(path.join(root,'qianxing/SHA256SUMS.txt'),'utf8').trim().split(/\r?\n/)) {
  const [expected, file] = line.split('  ');
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'qianxing',file))).digest('hex');
  assert.equal(actual, expected, 'Release checksum: ' + file);
}
for (const s of importedSave.assets.scripts) {
  assert.equal(s.source, native.assets.scripts.find(x => x.path === s.path)?.source, s.path);
  assert.equal(s.source, fs.readFileSync(path.join(root,'qianxing/lua',s.path.slice('workspace/battle-factory/lua/'.length)),'utf8'), 'Lua source: ' + s.path);
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);
  try { if (lauxlib.luaL_loadbuffer(L, to_luastring(s.source), null, to_luastring(s.path)))
    throw Error(to_jsstring(lua.lua_tostring(L,-1))); }
  finally {lua.lua_close(L);}
}
let checks = 0;
function inspect(studio, label) {
  const state = studio.playGet({view:true, compact:true});
  assert.ok(!state.mountError, state.mountError);
  assert.deepEqual(state.logs.filter(x => /error/i.test(String(x.level))), [], label);
  checks++;
  return state;
}
for (const [name, save, options] of [
  ['simulator', read('simulator/battle-factory.save.json'), {workspacePath:root}],
  ['qianxing', importedSave, {}]
]) {
  for (const canvasId of ['mobile-16-9','pc-16-9']) {
    const studio = createStudio(save, options);
    const click = name => assert.notEqual(studio.playClick(name)?.clicked, false, name);
    try {
      studio.playStart({canvasId});
      const initial = inspect(studio, 'start');
      assert.ok(initial.logs.some(x => x.text?.startsWith('factory-ready')), name + ' boot');
      if (name === 'qianxing') {
        assert.ok(initial.logs.some(x => x.text?.includes('boot-v7.1-20mb')));
        assert.deepEqual([...new Set(initial.scene.nodes.filter(x=>x.kind==='image').map(x=>x.imageId))], [100001]);
      }
      click('action-division-1'); inspect(studio, 'rental');
      click('action-toggle'); click('action-rental-next'); click('action-toggle');
      click('action-rental-next'); click('action-toggle'); click('action-lock'); inspect(studio, 'intel');
      click('action-begin');
      for (let i=0;i<24;i++) studio.playStep(.25,{observe:false});
      inspect(studio, 'battle');
      click('action-moves'); click('action-move-info-0'); inspect(studio, 'move info');
      click('action-back'); click('action-move-0');
      for (let i=0;i<75;i++) studio.playStep(.1,{observe:false});
      inspect(studio, 'after move');
      click('action-team'); inspect(studio, 'team'); click('action-back');
      click('action-history'); inspect(studio, 'history'); click('action-back');
      console.log(name, canvasId, 'boot/rental/battle/details/team/history OK');
    } finally {studio.playStop();}
  }
}
console.log(JSON.stringify({checks, nativeLuaSyntax:351, nativeGiaSourcesMatch:true, deviceVerified:false}));
