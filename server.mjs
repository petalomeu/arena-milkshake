import http from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const root=dirname(fileURLToPath(import.meta.url));
const game=join(root,'game');
const sqlite=new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON;');
sqlite.exec(readFileSync(join(root,'drizzle/0000_rooms.sql'),'utf8'));
class Statement {
  constructor(sql,parameters=[]){this.sql=sql;this.parameters=parameters;}
  bind(...parameters){return new Statement(this.sql,parameters);}
  execute(){
    const query=sqlite.prepare(this.sql);
    if(query.columns().length)return {results:query.all(...this.parameters),meta:{changes:0}};
    const result=query.run(...this.parameters);
    return {results:[],meta:{changes:Number(result.changes)}};
  }
  async run(){return this.execute();}
}
const DB={
  prepare(sql){return new Statement(sql);},
  async batch(statements){
    sqlite.exec('BEGIN');
    try{const result=statements.map(s=>s.execute());sqlite.exec('COMMIT');return result;}
    catch(error){sqlite.exec('ROLLBACK');throw error;}
  }
};
// Reuse the same room protocol and membership checks as the hosted Worker.
const scope=vm.createContext({Response,Request,URL,crypto:webcrypto,console,Date});
const workerSource=readFileSync(join(root,'worker/index.js'),'utf8').replace('export default {','const arenaWorker = {');
vm.runInContext(workerSource+'\nthis.roomHandler=arenaWorker.fetch;',scope);
const media={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.webm':'audio/webm'};
function error(res,status,message){res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end(message);}
export const server=http.createServer(async(req,res)=>{
  try{
    const proto=req.headers['x-forwarded-proto']==='https' ? 'https' : 'http';
    const url=new URL(req.url,proto+'://'+req.headers.host);
    if(url.pathname==='/healthz'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{"status":"ok"}');return;}
    if(url.pathname.startsWith('/api/arena/')){
      if(req.method!=='POST'){error(res,405,'Método inválido.');return;}
      let size=0;const chunks=[];
      for await(const chunk of req){size+=chunk.length;if(size>24000){error(res,413,'Mensagem grande demais.');return;}chunks.push(chunk);}
      const request=new Request(url,{method:'POST',headers:req.headers,body:Buffer.concat(chunks)});
      const response=await scope.roomHandler(request,{DB});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    if(req.method!=='GET' && req.method!=='HEAD'){error(res,405,'Método inválido.');return;}
    const name=decodeURIComponent(url.pathname==='/' ? '/index.html' : url.pathname);
    // Only public game files, never repository files or directory listings.
    if(!/^\/(?:frames\/)?[^/\\]+\.(html|js|webp|png|jpg|mp3|ogg|wav|webm)$/.test(name)){error(res,404,'Arquivo não encontrado.');return;}
    const path=resolve(game,'.'+name);
    if(!path.startsWith(game+'/') && !path.startsWith(game+'\\')){error(res,404,'Arquivo não encontrado.');return;}
    const stat=statSync(path);if(!stat.isFile()){error(res,404,'Arquivo não encontrado.');return;}
    const etag='"'+stat.size.toString(16)+'-'+Math.trunc(stat.mtimeMs).toString(16)+'"';
    const headers={'Content-Type':media[name.slice(name.lastIndexOf('.'))],'Cache-Control':'public, max-age=0, must-revalidate','ETag':etag,'Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
    if(req.headers['if-none-match']===etag){res.writeHead(304,headers);res.end();return;}
    const data=await readFile(path);
    const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if(range){
      const start=Number(range[1]),end=Math.min(range[2] ? Number(range[2]) : data.length-1,data.length-1);
      if(start>end){res.writeHead(416,{'Content-Range':'bytes */'+data.length});res.end();return;}
      res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${data.length}`,'Content-Length':end-start+1});res.end(req.method==='HEAD' ? undefined : data.subarray(start,end+1));return;
    }
    res.writeHead(200,{...headers,'Content-Length':data.length});res.end(req.method==='HEAD' ? undefined : data);
  }catch(cause){
    if(cause.code==='ENOENT' || cause instanceof URIError){error(res,404,'Arquivo não encontrado.');return;}
    console.error('Arena request:',cause.message);if(!res.headersSent)error(res,500,'Erro ao processar a solicitação.');else res.end();
  }
});
if(process.env.ARENA_TEST!=='1'){
  const port=Number(process.env.PORT || 4175),host=process.env.HOST || '0.0.0.0';
  server.listen(port,host,()=>console.log('Arena Milkshake: http://127.0.0.1:'+port));
  process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
}
