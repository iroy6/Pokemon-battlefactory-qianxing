const path = require('node:path');
const root = __dirname;
const dist = path.join(root, 'dist');

function createBuildOptions({production = false} = {}) {
  return {
    absWorkingDir: root,
    entryPoints: {app: 'src/main.js'},
    outdir: dist,
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: ['es2020'],
    minify: production,
    sourcemap: production ? false : 'inline',
    // Public image URLs remain relative for offline file:// use.
    external: ['assets/*'],
    legalComments: 'eof',
    charset: 'utf8',
    metafile: true,
    logLevel: 'info'
  };
}
module.exports = {root, dist, createBuildOptions};
