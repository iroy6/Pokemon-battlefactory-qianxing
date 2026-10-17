const fs = require('node:fs'), path = require('node:path');
const {execFileSync, spawnSync} = require('node:child_process');
const commit = '3d267c8c188e8f7d89f839daf2f90209e486b874';
const target = path.resolve(__dirname, '../.cache/upstream');
const git = args => execFileSync('git', args, {cwd: target, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit']}).trim();
if (!fs.existsSync(target)) {
  fs.mkdirSync(target, {recursive: true});
  git(['init']);
  git(['remote', 'add', 'origin', 'https://github.com/1475505/miliastra-beyond-simulator.git']);
}
if (spawnSync('git', ['cat-file', '-e', commit + '^{commit}'], {cwd:target, stdio:'ignore'}).status !== 0)
  git(['fetch', '--depth', '1', 'origin', commit]);
if (git(['status', '--porcelain'])) throw Error('Upstream checkout has local edits; preserve them before continuing.');
git(['checkout', '--detach', commit]);
if (git(['rev-parse', 'HEAD']) !== commit) throw Error('Unexpected upstream revision');
console.log('Simulator source ready:', commit);
