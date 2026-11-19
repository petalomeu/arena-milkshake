import { WebSocketServer, WebSocket } from 'ws';

export function attachRealtime(server, sqlite) {
  const sockets=new Map();
  const wss=new WebSocketServer({noServer:true,maxPayload:131072,perMessageDeflate:false});
  const lookup=sqlite.prepare('SELECT host,guest,expires FROM arena_rooms WHERE code=?');

  function send(socket,data) {
    if(socket?.readyState!==WebSocket.OPEN)return;
    if(socket.bufferedAmount>524288){socket.close(1013,'Conexão lenta');return;}
    socket.send(JSON.stringify(data));
  }
  function disconnect(code) {
    const peers=sockets.get(code);
    sockets.delete(code);
    if(peers)for(const peer of peers)peer?.close(1000,'Sala encerrada');
  }
  server.on('upgrade',(request,socket,head)=>{
    const protocol=request.headers['x-forwarded-proto']==='https'?'https':'http';
    const url=new URL(request.url,protocol+'://'+request.headers.host);
    if(url.pathname!=='/api/arena/live' || request.headers.origin!==url.origin){
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;
    }
    wss.handleUpgrade(request,socket,head,connection=>wss.emit('connection',connection));
  });
  wss.on('connection',socket=>{
    socket.on('error',()=>{});
    socket.alive=true;
    const authTimeout=setTimeout(()=>socket.close(1008,'Autenticação necessária'),5000);
    socket.on('pong',()=>{socket.alive=true;});
    socket.on('message',(bytes,binary)=>{
      if(binary){socket.close(1003);return;}
      let data;
      try{data=JSON.parse(bytes.toString());}catch{socket.close(1007);return;}
      if(!data || typeof data!=='object'){socket.close(1008);return;}
      if(!socket.code){
        if(data.type!=='auth' || typeof data.code!=='string' || !/^[A-F0-9]{10}$/.test(data.code) ||
           typeof data.token!=='string' || data.token.length!==36){socket.close(1008);return;}
        const room=lookup.get(data.code);
        const player=room?.host===data.token?0:room?.guest===data.token?1:-1;
        if(!room || room.expires<=Date.now() || player<0){socket.close(1008);return;}
        const peers=sockets.get(data.code)??[null,null];
        if(peers[player]){socket.close(1008,'Jogador já conectado');return;}
        clearTimeout(authTimeout);
        socket.code=data.code;socket.player=player;socket.expires=room.expires;
        peers[player]=socket;sockets.set(data.code,peers);
        send(socket,{type:'authenticated'});
        if(peers.every(peer=>peer?.readyState===WebSocket.OPEN))for(const peer of peers)send(peer,{type:'connected'});
        return;
      }
      if(socket.expires<=Date.now()){disconnect(socket.code);return;}
      if(data.type==='ping' && Number.isFinite(data.at)){send(socket,{type:'pong',at:data.at});return;}
      if(data.type!=='messages' || !Array.isArray(data.messages) || data.messages.length>64){socket.close(1008);return;}
      if(data.messages.some(message=>!message || typeof message!=='object' || typeof message.type!=='string' ||
          (socket.player===1 && ['state','start','stage','audio'].includes(message.type)))){
        socket.close(1008);return;
      }
      const now=Date.now();
      if(!socket.windowAt || now-socket.windowAt>1000){socket.windowAt=now;socket.received=0;}
      if(++socket.received>240){socket.close(1008);return;}
      const other=sockets.get(socket.code)?.[1-socket.player];
      send(other,data);
    });
    socket.on('close',()=>{
      clearTimeout(authTimeout);
      if(sockets.get(socket.code)?.[socket.player]===socket){
        sqlite.prepare('DELETE FROM arena_rooms WHERE code=?').run(socket.code);
        disconnect(socket.code);
      }
    });
  });
  const heartbeat=setInterval(()=>{
    for(const peers of sockets.values())for(const socket of peers){
      if(!socket)continue;
      if(!socket.alive || socket.expires<=Date.now()){socket.terminate();continue;}
      socket.alive=false;socket.ping();
    }
  },15000);
  heartbeat.unref();
  server.on('close',()=>{
    clearInterval(heartbeat);
    for(const code of sockets.keys())disconnect(code);
    wss.close();
  });
}
