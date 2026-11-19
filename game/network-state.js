'use strict';

// Independent, complete snapshots: a lost datagram never invalidates the next one.
// Names, portraits and keyboard mappings already exist on the receiving client.
const ArenaWire=(()=>{
  const actorFields=('x y vy vx face hp orsiStood slow frozen affection deaf feminineAbility stun buff charge dazzle tumble infectionTicks infectionClock warp snare frenzy regen blood bloodX bloodY asleep sleepRecovery nap bedWalk blanket cloneX cloneAction ascended migraineLevel migraineTicks migraineClock migrainePulse printedTier joyClock tech growthRead growthPercent baby coffeeBurn coffeeClock guardEnergy guardBreak guardDelay guardNotice guardNeedsRelease blockFlash recovery flash action actionDuration moveTime cool specialsInProgress label netActionId netActionInput v2').split(' ');
  const actorDefaults=Object.fromEntries(actorFields.map(key=>[key,0]));
  Object.assign(actorDefaults,{hp:100,guardEnergy:100,orsiStood:false,blanket:false,ascended:false,guardNeedsRelease:false,
    printedTier:-1,actionDuration:.42,cool:[0,0,0,0],specialsInProgress:[null,null,null],label:'',v2:null});
  const v2Fields=('move jumps airCut dash dashWait dashCombo direction lastLeft lastRight crouch block attack buffer chain chainClock escape escapeWait energyNotice emergencyUsed specialStun repetition').split(' ');
  const v2Defaults=Object.fromEntries(v2Fields.map(key=>[key,0]));
  Object.assign(v2Defaults,{airCut:false,crouch:false,emergencyUsed:false,lastLeft:-99,lastRight:-99,attack:null,buffer:null,repetition:null});
  const staticFields=new Set('i kind keys name subtitle portrait passive color crop'.split(' '));
  const actorNames=new Set(actorFields),v2Names=new Set(v2Fields);
  const phases=['countdown','fight','end'];
  const rounded=value=>{
    if(typeof value==='number')return Number.isFinite(value)?Math.round(value*1000)/1000:0;
    if(Array.isArray(value))return value.map(rounded);
    if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,rounded(item)]));
    return value;
  };
  function fields(object,names,defaults){
    let mask=0n;const values=[];
    for(let i=0;i<names.length;i++){
      const name=names[i],value=object[name],fallback=defaults[name];
      if(value===undefined || value===fallback || Array.isArray(value) && JSON.stringify(value)===JSON.stringify(fallback))continue;
      mask|=1n<<BigInt(i);
      values.push(name==='hp'?value:name==='v2' && value?packV2(value):rounded(value));
    }
    return [mask.toString(16),...values];
  }
  function expand(vector,names,defaults){
    const object={...defaults},mask=BigInt('0x'+vector[0]);let value=1;
    for(let i=0;i<names.length;i++)if(mask&(1n<<BigInt(i)))object[names[i]]=vector[value++];
    return object;
  }
  function extras(object,known,omit){
    const other={};
    for(const [key,value] of Object.entries(object))if(!known.has(key) && !omit?.has(key))other[key]=rounded(value);
    return Object.keys(other).length?other:null;
  }
  function packV2(state){return [fields(state,v2Fields,v2Defaults),extras(state,v2Names)];}
  function packActor(actor){return [actor.kind,fields(actor,actorFields,actorDefaults),extras(actor,actorNames,staticFields)];}
  function unpackActor([kind,vector,other]){
    const actor={...expand(vector,actorFields,actorDefaults),...other,kind};
    if(actor.v2){const [data,more]=actor.v2;actor.v2={...expand(data,v2Fields,v2Defaults),...more};}
    // Each actor owns its mutable arrays, including all-default snapshots.
    actor.cool=[...actor.cool];actor.specialsInProgress=[...actor.specialsInProgress];
    return actor;
  }
  function stringify(message){
    if(message.type!=='state')return JSON.stringify(message);
    return JSON.stringify({type:'state',wire:[1,message.round,message.snapshotSeq,message.ack,
      rounded(message.time),phases.indexOf(message.phase),message.banner,rounded(message.countdown),rounded(message.fightCue),
      message.reaction,message.embrace?rounded(message.embrace):null,message.keys,
      message.fighters.map(packActor),rounded(message.effects)]});
  }
  function parse(text){
    return unpack(JSON.parse(text));
  }
  function unpack(message){
    if(message?.type!=='state' || !message.wire)return message;
    const w=message.wire;
    if(w[0]!==1 || !Array.isArray(w[12]) || w[12].length!==2)throw Error('Invalid state version');
    return {type:'state',compact:true,round:w[1],snapshotSeq:w[2],ack:w[3],time:w[4],phase:phases[w[5]],banner:w[6],
      countdown:w[7],fightCue:w[8],reaction:w[9],embrace:w[10],keys:w[11],fighters:w[12].map(unpackActor),effects:w[13]};
  }
  return {stringify,parse,unpack};
})();
