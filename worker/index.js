const noCache = {'Cache-Control':'no-store'};
function json(data,status=200) { return Response.json(data,{status,headers:noCache}); }
const roomLifetime = 2*60*60*1000;

async function rooms(request,env,action) {
  if (request.method !== 'POST') return json({error:'Método inválido.'},405);
  if (request.headers.get('Origin') !== new URL(request.url).origin) return json({error:'Origem inválida.'},403);
  const raw=await request.text();
  if (raw.length>24000) return json({error:'Mensagem grande demais.'},413);
  let body;
  try {body=JSON.parse(raw)} catch {return json({error:'Mensagem inválida.'},400)}
  const db=env.DB;
  const now=Date.now();
  const {code,token,after,messages}=body ?? {};
  if (action==='create') {
    const newCode=crypto.randomUUID().replaceAll('-','').slice(0,10).toUpperCase();
    const key=crypto.randomUUID();
    await db.batch([
      db.prepare('DELETE FROM arena_rooms WHERE expires < ?').bind(now),
      db.prepare('INSERT INTO arena_rooms(code,host,expires) VALUES(?,?,?)').bind(newCode,key,now+roomLifetime)
    ]);
    return json({code:newCode,token:key});
  }
  if (typeof code!=='string' || !/^[0-9A-F]{10}$/.test(code)) return json({error:'Código inválido.'},400);
  if (action==='join') {
    const key=crypto.randomUUID();
    const result=await db.prepare('UPDATE arena_rooms SET guest=? WHERE code=? AND guest IS NULL AND expires>?').bind(key,code,now).run();
    if (!result.meta.changes) return json({error:'Sala indisponível. Confira o código ou peça ao Player 1 para criar outra.'},404);
    return json({code,token:key});
  }
  if (typeof token!=='string' || token.length!==36) return json({error:'Sessão inválida.'},403);
  if (action==='leave') {
    await db.prepare('DELETE FROM arena_rooms WHERE code=? AND (host=? OR guest=?)').bind(code,token,token).run();
    return json({});
  }
  if (action!=='sync' || !Number.isSafeInteger(after) || after<0 || !Array.isArray(messages) || messages.length>64) return json({error:'Mensagem inválida.'},400);

  const membership = db.prepare(
    'SELECT guest IS NOT NULL AS connected FROM arena_rooms WHERE code=? AND expires>? AND (host=? OR guest=?)'
  ).bind(code,now,token,token);
  const incoming = db.prepare(
    `SELECT m.id,m.payload FROM arena_rooms r
      JOIN arena_messages m ON m.code=r.code AND m.player=CASE WHEN r.host=? THEN 1 ELSE 0 END
      WHERE r.code=? AND r.expires>? AND (r.host=? OR r.guest=?) AND m.id>?
      ORDER BY m.id LIMIT 64`
  ).bind(token,code,now,token,token,after);
  const statements=[membership];
  if (messages.length) statements.push(db.prepare(
    `INSERT INTO arena_messages(code,player,payload)
      SELECT code,CASE WHEN host=? THEN 0 ELSE 1 END,?
      FROM arena_rooms WHERE code=? AND expires>? AND (host=? OR guest=?)`
  ).bind(token,JSON.stringify(messages),code,now,token,token));
  if (Number.isSafeInteger(body.prune) && body.prune>0 && body.prune<=after) statements.push(db.prepare(
    `DELETE FROM arena_messages WHERE code=? AND id<=? AND player=(
      SELECT CASE WHEN host=? THEN 1 ELSE 0 END
      FROM arena_rooms WHERE code=? AND expires>? AND (host=? OR guest=?)
    )`
  ).bind(code,body.prune,token,code,now,token,token));
  statements.push(incoming);

  const results=await db.batch(statements);
  const room=results[0].results[0];
  if (!room) return json({error:'A sala foi encerrada. Crie outra para continuar.'},410);
  return json({connected:Boolean(room.connected),events:results.at(-1).results});
}

export default {
  async fetch(request,env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/arena/')) {
      try { return await rooms(request,env,path.split('/').at(-1)); }
      catch (error) {
        console.error('Arena rooms:',error.message);
        return json({error:'O serviço de salas está temporariamente indisponível.'},503);
      }
    }
    return serveAsset(path,request);
  }
};
