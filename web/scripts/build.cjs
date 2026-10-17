const fs = require('node:fs');
const path = require('node:path');
const {build} = require('esbuild');
const {root, dist, createBuildOptions} = require('../esbuild.config.cjs');

async function main() {
  if (path.relative(root, dist) !== 'dist') throw Error('Unexpected output directory');
  if (fs.existsSync(dist) && fs.lstatSync(dist).isSymbolicLink()) throw Error('dist must not be a symlink');
  const result = await build({...createBuildOptions({production:true}), write:false});
  for (const input of Object.keys(result.metafile.inputs))
    if (/(?:^|[\\/])(?:tests|fixtures|sources)(?:[\\/])/.test(input))
      throw Error('Development data must not enter the browser bundle: '+input);
  fs.rmSync(dist, {recursive:true, force:true});
  fs.mkdirSync(dist, {recursive:true});
  fs.cpSync(path.join(root, 'public'), dist, {recursive:true});
  fs.copyFileSync(path.join(root, 'index.html'), path.join(dist, 'index.html'));
  fs.copyFileSync(path.join(root, '../LICENSE'), path.join(dist, 'LICENSE'));
  fs.copyFileSync(path.join(root, '../THIRD_PARTY_NOTICES.txt'), path.join(dist, 'THIRD_PARTY_NOTICES.txt'));
  for (const file of result.outputFiles) fs.writeFileSync(file.path, file.contents);
  console.log('Built web/dist: deploy this directory or open its index.html offline.');
}
main().catch(error => {console.error(error.message); process.exitCode=1;});
