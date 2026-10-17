const fs = require('node:fs'), path = require('node:path');
const {spawn} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const server = path.join(__dirname, 'dist/server.mjs');
if (!fs.existsSync(server)) {
  console.error('Run npm ci, npm run setup:simulator and npm run build:simulator first.');
  process.exit(1);
}
const port = process.env.PORT || '4174';
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw Error('PORT must be 1–65535');
const child = spawn(process.execPath, [server, '--workspace', root, '--host', '127.0.0.1', '--port', port,
  '--file', 'simulator/battle-factory.save.json'], {cwd: root, stdio: 'inherit',
  env: {...process.env, FACTORY_PREVIEW_MANIFEST: path.join(__dirname, 'preview-assets/manifest.json')}});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => {console.error(error.message); process.exitCode = 1;});
child.on('exit', code => {process.exitCode = code ?? 1;});
