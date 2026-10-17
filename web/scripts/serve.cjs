const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {context} = require('esbuild');
const {root, dist, createBuildOptions} = require('../esbuild.config.cjs');
const preview = process.argv.includes('--preview');
const port = Number(process.env.PORT || (preview ? 4175 : 4173));
const host = process.env.HOST || '127.0.0.1';
const publicRoot = preview ? dist : path.join(root, 'public');
const types = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.gif':'image/gif', '.svg':'image/svg+xml',
  '.txt':'text/plain; charset=utf-8', '.md':'text/plain; charset=utf-8'
};

async function main() {
  if (!Number.isInteger(port) || port<1 || port>65535) throw Error('PORT must be 1–65535');
  if (preview && !fs.existsSync(path.join(dist, 'index.html'))) throw Error('Run npm run build first.');
  let builder;
  let outputs = new Map();
  let buildError = '';
  if (!preview) {
    builder = await context({
      ...createBuildOptions(), write:false,
      plugins:[{name:'development-output', setup(build) {
        build.onEnd(result => {
          buildError = result.errors.map(error=>error.text).join('\n');
          if (!result.errors.length) outputs = new Map(result.outputFiles.map(file=>['/'+path.basename(file.path),file.contents]));
        });
      }}]
    });
    try {
      await builder.rebuild();
      await builder.watch();
    } catch (error) {
      await builder.dispose();
      throw error;
    }
  }
  const server = http.createServer((req,res) => {
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
    let pathname;
    try {pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}
    catch {res.writeHead(400);res.end();return;}
    if (pathname.includes('\0')) {res.writeHead(400);res.end();return;}
    if (pathname==='/') pathname='/index.html';
    const headers = {'Content-Type':types[path.extname(pathname)]||'application/octet-stream','Cache-Control':'no-cache'};
    if (!preview && outputs.has(pathname)) {
      if (buildError) {res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8'});res.end(buildError);return;}
      res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:outputs.get(pathname));return;
    }
    const indexRequest = !preview && pathname==='/index.html';
    const file = indexRequest ? path.join(root,'index.html') : path.resolve(publicRoot,'.'+pathname);
    const relative=path.relative(publicRoot,file);
    if (!indexRequest && (relative.startsWith('..')||path.isAbsolute(relative))) {res.writeHead(403);res.end();return;}
    fs.stat(file,(error,stat)=>{
      if (error||!stat.isFile()) {res.writeHead(404);res.end('Not found');return;}
      res.writeHead(200,headers);
      if(req.method==='HEAD') {res.end();return;}
      fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
    });
  });
  let stopping=false;
  const close=async()=>{
    if(stopping)return;stopping=true;
    server.close();server.closeAllConnections();
    if(builder)await builder.dispose();
  };
  process.on('SIGINT',close);process.on('SIGTERM',close);
  server.on('error',async error=>{console.error(error.message);await close();process.exitCode=1;});
  server.listen(port,host,()=>console.log(`Battle Factory ${preview?'preview':'development'}: http://${host}:${port}`));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
