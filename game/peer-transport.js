'use strict';

// WebSocket exchanges only the connection offer/candidates. Game packets can then
// take the direct route; the authenticated relay remains available throughout.
class ArenaPeerLink {
  constructor({host,signal,receive,change}) {
    this.host=host;this.signal=signal;this.receive=receive;this.change=change;
    this.candidates=[];this.closed=false;this.ready=false;
    this.sentBytes=0;this.statesSent=0;this.statesSkipped=0;
    this.stateCredit=24000;this.creditAt=performance.now();
    if(typeof RTCPeerConnection==='undefined')return;
    try{
      const pc=this.pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.cloudflare.com:3478'}]});
      pc.onicecandidate=event=>{if(event.candidate && !this.closed)this.signal({candidate:event.candidate.toJSON()});};
      pc.ondatachannel=event=>this.attach(event.channel);
      pc.onconnectionstatechange=()=>{
        if(['failed','closed'].includes(pc.connectionState))this.fallback();
      };
      this.deadline=setTimeout(()=>{if(!this.ready)this.fallback();},14000);
      if(host){
        this.attach(pc.createDataChannel('controls',{ordered:true}));
        this.attach(pc.createDataChannel('snapshots',{ordered:false,maxRetransmits:0}));
        this.negotiating=pc.createOffer().then(async offer=>{
          await pc.setLocalDescription(offer);
          if(!this.closed)this.signal({description:pc.localDescription.toJSON()});
        }).catch(()=>this.fallback());
      }
    }catch{this.fallback();}
  }
  attach(channel){
    if(this.closed || !['controls','snapshots'].includes(channel.label)){channel.close();return;}
    this[channel.label]=channel;
    channel.onopen=()=>{
      if(this.closed)return;
      if(this.controls?.readyState==='open' && this.snapshots?.readyState==='open'){
        clearTimeout(this.deadline);this.ready=true;this.change();
      }
    };
    channel.onmessage=event=>{
      if(this.closed || typeof event.data!=='string' || event.data.length>131072)return;
      try{const message=ArenaWire.parse(event.data);if(message && typeof message.type==='string')this.receive(message);}catch{}
    };
    channel.onclose=()=>this.fallback();
    channel.onerror=()=>this.fallback();
  }
  async accept(data){
    if(this.closed || !this.pc)return;
    if(data.failed){this.fallback(false);return;}
    try{
      if(data.description){
        if(data.description.type!==(this.host?'answer':'offer'))return;
        await this.pc.setRemoteDescription(data.description);
        for(const candidate of this.candidates.splice(0))await this.pc.addIceCandidate(candidate);
        if(!this.host){
          await this.pc.setLocalDescription(await this.pc.createAnswer());
          if(!this.closed)this.signal({description:this.pc.localDescription.toJSON()});
        }
      }else if(data.candidate){
        if(this.pc.remoteDescription)await this.pc.addIceCandidate(data.candidate);
        else if(this.candidates.length<64)this.candidates.push(data.candidate);
      }
    }catch{this.fallback();}
  }
  send(message){
    if(!this.ready)return false;
    const disposable=message.type==='state' && message.phase!=='end';
    const channel=disposable?this.snapshots:this.controls;
    if(channel?.readyState!=='open'){this.fallback();return false;}
    if(disposable && channel.bufferedAmount>0){this.statesSkipped++;return true;}
    if(channel.bufferedAmount>16384){
      this.fallback();return false;
    }
    try{
      const payload=ArenaWire.stringify(message);
      if(disposable){
        const now=performance.now();
        this.stateCredit=Math.min(24000,this.stateCredit+(now-this.creditAt)*24);this.creditAt=now;
        if(payload.length>this.stateCredit){this.statesSkipped++;return true;}
        this.stateCredit-=payload.length;this.statesSent++;
      }
      channel.send(payload);this.sentBytes+=payload.length;return true;
    }catch{this.fallback();return false;}
  }
  async stats(){
    if(!this.ready || !this.pc)return null;
    const report=await this.pc.getStats();
    const rows=[...report.values()];
    const transport=rows.find(row=>row.type==='transport' && row.selectedCandidatePairId);
    const pair=report.get(transport?.selectedCandidatePairId) || rows.find(row=>row.type==='candidate-pair' && row.nominated && row.state==='succeeded');
    return {rtt:Number.isFinite(pair?.currentRoundTripTime)?pair.currentRoundTripTime*1000:null,
      bytes:this.sentBytes,states:this.statesSent,skipped:this.statesSkipped,
      queued:(this.controls?.bufferedAmount || 0)+(this.snapshots?.bufferedAmount || 0)};
  }
  fallback(notify=true){
    if(this.closed)return;
    this.close();
    if(notify)this.signal({failed:true});
    this.change();
  }
  close(){
    this.closed=true;this.ready=false;clearTimeout(this.deadline);
    this.pc?.close();this.candidates=[];
  }
}
