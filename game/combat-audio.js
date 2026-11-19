'use strict';

const recordedCombatAudio=(()=>{
  const catalogue={
    punch_light:[.17,.49],punch_mid:[.22,.52],punch_heavy:[.29,.59],
    kick_light:[.18,.47],kick_mid:[.30,.53],kick_heavy:[.35,.59],
    body_impact:[.25,.59],heavy_collision:[.39,.47],block:[.17,.63],ground_impact:[.28,.52],
    dash:[.24,.54],jump:[.28,.43],double_jump:[.28,.48],
    hit_punch_light:[.16,.50],hit_punch_mid:[.23,.57],hit_punch_heavy:[.38,.62],
    hit_kick_light:[.19,.51],hit_kick_mid:[.27,.58],hit_kick_heavy:[.43,.64],
    effort_female:[.31,.37],effort_deep:[.39,.39],effort_male:[.32,.38],
    hurt_female:[.28,.44],hurt_deep:[.52,.47],hurt_male:[.44,.45],announce_fight:[.84,.46],fall:[.35,.54]
  };
  const offsets=new Map();
  let offset=0;
  for(const [name,[length]] of Object.entries(catalogue)){
    offsets.set(name,offset);
    offset+=2*(length+.012);
  }
  const mix=document.querySelector('#combat-audio-mix');
  const ambienceVolume=document.querySelector('#combat-ambient-volume');
  const voiceVolume=document.querySelector('#combat-voice-volume');
  const fxBytes=fetch('combate-gravado.wav').then(res=>res.ok ? res.arrayBuffer() : null).catch(()=>null);
  const active=new Set(), played=new Map(), ambienceCache=new Map();
  const windMix={wind_forward:[.94,.56],wind_back:[1.13,.50],wind_jump:[1.02,.42],wind_double:[1.26,.48],wind_escape:[.82,.60]};
  let context,fx,loading,ambientKey,ambientSource,ambientGain,ambientLevel;
  function prepare(audioContext){
    if(context===audioContext)return loading;
    context=audioContext;
    loading=fxBytes.then(bytes=>bytes && audioContext.decodeAudioData(bytes.slice(0))).then(buffer=>{fx=buffer;}).catch(()=>{});
    return loading;
  }
  function play(name,variant){
    const wind=Object.hasOwn(windMix,name) ? windMix[name] : null;
    const sample=wind ? 'dash' : name;
    if(mix.value==='classic' || !fx || context?.state!=='running' || !Object.hasOwn(catalogue,sample))return false;
    const priority=name.startsWith('hit_') || ['body_impact','heavy_collision','block','announce_fight'].includes(name);
    if(active.size>=(priority ? 8 : 6))return true;
    const [length,level]=catalogue[sample];
    const voice=/^(?:hurt_|effort_|announce_|(?:double_)?jump$)/.test(name);
    const gainValue=wind ? wind[1] : voice ? level*Number(voiceVolume.value)/100 : level;
    const now=context.currentTime;
    if(!gainValue || now-(played.get(name) ?? -1)<.055)return true;
    played.set(name,now);
    syncDeafnessAudio();
    const source=context.createBufferSource();
    source.buffer=fx;
    if(wind)source.playbackRate.value=wind[0];
    const gain=context.createGain();
    gain.gain.value=gainValue;
    source.connect(gain).connect(pedroAudioBus);
    active.add(source);
    source.onended=()=>{active.delete(source);source.disconnect();gain.disconnect();};
    source.start(0,offsets.get(sample)+variant*(length+.012),length);
    return true;
  }
  function ambienceBuffer(name){
    if(!ambienceCache.has(name)){
      ambienceCache.set(name,fetch('ambiente-'+name+'.wav').then(res=>res.ok ? res.arrayBuffer() : null)
        .then(bytes=>bytes && context.decodeAudioData(bytes)).catch(()=>null));
    }
    return ambienceCache.get(name);
  }
  function ambient(){
    if(context?.state!=='running')return;
    const stage=['interno','interno','fazenda','grafica','cofre'][stageIndex];
    const level=Number(ambienceVolume.value)*.0032;
    const wanted=level>0 && mix.value!=='classic' && (phase==='fight' || phase==='countdown')
      ? (inAdelia() ? 'interno' : stage) : null;
    if(ambientGain && ambientLevel!==level){
      ambientGain.gain.setTargetAtTime(level,context.currentTime,.06);
      ambientLevel=level;
    }
    if(wanted===ambientKey)return;
    ambientKey=wanted;
    if(ambientSource){
      ambientGain.gain.setTargetAtTime(0,context.currentTime,.07);
      ambientSource.stop(context.currentTime+.3);
      ambientSource=ambientGain=null;
    }
    if(!wanted)return;
    ambienceBuffer(wanted).then(buffer=>{
      if(!buffer || wanted!==ambientKey || ambientSource || context.state!=='running')return;
      syncDeafnessAudio();
      const source=context.createBufferSource(),gain=context.createGain();
      source.buffer=buffer;source.loop=true;
      gain.gain.setValueAtTime(0,context.currentTime);
      ambientLevel=Number(ambienceVolume.value)*.0032;
      gain.gain.setTargetAtTime(ambientLevel,context.currentTime,.10);
      source.connect(gain).connect(pedroAudioBus);
      source.onended=()=>{source.disconnect();gain.disconnect();};
      source.start();
      ambientSource=source;ambientGain=gain;
    });
  }
  const demo=document.querySelector('#combat-audio-demo');
  demo.onclick=async()=>{
    activateAudio();
    if(!audio)return;
    demo.disabled=true;
    try{
      await (mix.value==='classic' ? warmCombatAudio() : prepare(audio));
      for(const [i,name] of ['punch_light','block','hit_kick_heavy'].entries()){
        if(i)await new Promise(resolve=>setTimeout(resolve,440));
        playCombatSound('combat:'+name+':0');
      }
    }finally{demo.disabled=false;}
  };
  return {prepare,play,ambient,catalogue};
})();
