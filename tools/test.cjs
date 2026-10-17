const {spawnSync} = require('node:child_process');
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = ['web/tests/unit', 'simulator/tests'].flatMap(dir =>
  fs.readdirSync(path.join(root, dir)).filter(f => /\.(cjs|mjs)$/.test(f)).map(f => dir + '/' + f));
const result = spawnSync(process.execPath, ['--test', ...files], {cwd: root, stdio: 'inherit'});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
