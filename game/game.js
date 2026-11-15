'use strict';
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';
const start = document.querySelector('#start');
const keys = new Set();
const arenaProfiles = [
  {name:'Milkshake Down',id:'milkshake'},
  {name:'Arena dos Campeões',id:'ure'},
  {name:'Fazenda do Berranteiro',id:'fazenda'},
  {name:'Gráfica do Matheus',id:'grafica'},
  {name:'Cofre do Grau',id:'cofre'},
];
const stageNames = arenaProfiles.map(({name})=>name);
const selection = document.querySelector('#selection');
const characterScreen = document.querySelector('#characters');
const stageScreen = document.querySelector('#stages');
const controls = document.querySelector('.controls');
let stageIndex = 0;
let online = null;
let countdown=0,fightCue=0;
const cpu={active:false,think:0,guard:0,jump:0,move:0};
const stages = arenaProfiles.map(({id}) => {
  const image = new Image();
  image.src = 'stage-'+id+'.webp';
  return image;
});
const clips = Object.fromEntries(Object.entries({
  horn:'fooon.ogg', hug:'abraco.mp3', punch:'punch.mp3',
  slap:'slap.mp3', hurt:'slap-oh.mp3', milk:'milkshake.mp3', bull:'matador-de-onca.mp3', downDeath:'downmorte.mp3', pedroDeath:'pedromorte.mp3', mayconReaction:'ohh-lee.mp3',
  mayconPunch:'mayconespecialsoco.mp3', mayconDash:'agora-sou-eu-e-voce.mp3', leandroChocolate:'comedordeacucar.mp3',
  calecaSurf:'caleca_especial_surfista_prateado.webm', leandroRescue:'mercado-livre-entrega.mp3',
  calecaFlash:'cs-go-flashbang.mp3', pupinhoWarp:'fala-baixo-nengue.mp3', pupinhoGas:'fartmeme.mp3',
  fabioToscana:'beto-carreiro-sem-titulo.mp3', fabioGalinhas:'gluglucordia.mp3',
  matheusPrinter:'matheus-machine.mp3', matheusItem:'matheus-item.mp3',
  matheusHeartbeat:'matheus-coracao.mp3', matheusBleeding:'matheus-sangrando.mp3'
}).map(([name,file]) => {
  const clip = new Audio(file);
  clip.preload = 'auto';
  clip.volume = name === 'hurt' ? .55 : .8;
  return [name,clip];
}));
const audioStart = {horn:1, milk:1.5};
function stopMilkshakeAtTrimPoint() {
  const clip = clips.milk;
  if (clip.currentTime >= clip.duration-1) clip.pause();
}
clips.milk.addEventListener('timeupdate',stopMilkshakeAtTrimPoint);

function playClip(name) {
  syncDeafnessAudio();
  if (online?.role === 'host') sendOnline({type:'audio',name});
  const clip = clips[name];
  if (name==='matheusHeartbeat') clip.seenActive=false;
  clip.currentTime = audioStart[name] ?? 0;
  clip.play().catch(() => {});
}

const combatCategories = [
  'punch_light','punch_heavy','kick_light','kick_heavy','body_impact','heavy_collision',
  'block','ground_impact','dash','jump','energy_charge','energy_release','projectile','generic_explosion'
];
const combatAudioBytes = typeof fetch==='function'
  ? fetch('combate-sfx.wav').then(response=>response.ok ? response.arrayBuffer() : null).catch(()=>null)
  : Promise.resolve(null);
const combatVoices = new Set();
const combatLastPlayed = new Map();
const combatVariants = new Map();
let combatAudioBuffer, combatAudioContext;
function warmCombatAudio() {
  if(!audio?.decodeAudioData || combatAudioContext===audio)return;
  const context=audio;
  combatAudioContext=context;
  combatAudioBytes.then(bytes=>bytes && context.decodeAudioData(bytes.slice(0)))
    .then(buffer=>{if(context===audio)combatAudioBuffer=buffer;}).catch(()=>{});
}
function playCombatSound(name) {
  const match=typeof name==='string' && /^combat:([a-z_]+):([01])$/.exec(name);
  if(!match || !combatAudioBuffer || audio?.state!=='running')return;
  const index=combatCategories.indexOf(match[1]);
  if(index<0 || combatVoices.size>=7)return;
  const now=audio.currentTime;
  if(now-(combatLastPlayed.get(match[1]) ?? -1)<.045)return;
  combatLastPlayed.set(match[1],now);
  syncDeafnessAudio();
  const source=audio.createBufferSource();
  const gain=audio.createGain();
  source.buffer=combatAudioBuffer;
  gain.gain.value=match[1]==='body_impact' ? .50 :
    match[1]==='heavy_collision' ? .42 : match[1]==='block' ? .57 : .35;
  source.connect(gain).connect(pedroAudioBus);
  combatVoices.add(source);
  source.onended=()=>{combatVoices.delete(source);source.disconnect();gain.disconnect();};
  source.start(0,(index*2+Number(match[2]))*.42,.42);
}
function combatCue(category) {
  if(online?.role==='guest')return;
  const variant=combatVariants.get(category) ?? 0;
  combatVariants.set(category,1-variant);
  const name='combat:'+category+':'+variant;
  if(online?.role==='host')sendOnline({type:'audio',name});
  playCombatSound(name);
}

const frameCounts = {idle:2,walk:2,run:2,punch:3,kick:3,guard:1,hurt:2,fall:1,rise:1,special:3};
function loadFrame(name) {
  const image = new Image();
  image.src = 'frames/'+name+'.webp';
  return image;
}
const sprites = [{...frameCounts,idle:3,walk:5,run:4,jump:5,crouch:3,guard:4,hurt:4,fall:2,rise:2,strong:3,kick:4,air:4,charge:3},frameCounts,{...frameCounts,idle:3,walk:3,run:3,guard:1,hurt:1,jump:3,dash:3},{...frameCounts,idle:3,walk:4,run:4,jump:4,transform:3,dash:3},{...frameCounts,idle:3,walk:3,run:3,jump:3,call:1},{...frameCounts,idle:3,walk:3,run:3,jump:3,special:2,teleport:2},{...frameCounts,idle:3,walk:3,run:3,jump:3,call:1},{...frameCounts,idle:3,walk:3,run:3,jump:3,pill:2},{...frameCounts,idle:3,walk:3,run:3,jump:3,special:1,sleep:1,clone:2},{...frameCounts,idle:3,walk:3,run:3,jump:3,special:2,cheese:2},{...frameCounts,idle:3,walk:3,run:3,jump:3,special:0},{...frameCounts,idle:3,walk:3,run:3,jump:3,special:2,dash:2},{...frameCounts,idle:3,walk:3,run:3,jump:3,special:0},{...frameCounts,idle:2,walk:2,run:2,jump:3,punch:3,kick:3,guard:1,hurt:2,fall:1,rise:1,special:3,wallet:4},{...frameCounts,jump:3,baby:2}].map((counts,i) => Object.fromEntries(
  Object.entries(counts).map(([pose,count]) => [
    pose, Array.from({length:count},(_,frame) => loadFrame(i+'-'+pose+'-'+frame))
  ])
));
const downHD=name=>loadFrame('1-hd-'+name);
const downIdle=downHD('idle'),downCrouch=downHD('crouch');
const downFaceRects={idle:[290,120,200,210],walk:[300,120,200,210],run:[395,120,180,215],punch:[310,120,200,225],hug:[330,120,220,230],spit:[390,115,200,245],guard:[245,120,225,235],kick:[155,120,220,235],jump:[335,110,215,235],crouch:[325,215,235,250],hurt:[130,110,230,240],fall:[25,475,255,225]};
const downFaces=Object.fromEntries(Object.keys(downFaceRects).map(name=>[name,loadFrame('1-face-'+name)]));
sprites[1]={idle:[downIdle],walk:[downHD('walk'),downIdle],run:[downHD('run'),downHD('walk')],
 punch:[downIdle,downHD('punch'),downIdle],kick:[downCrouch,downHD('kick'),downIdle],
 guard:[downHD('guard')],hurt:[downHD('hurt')],fall:[downHD('fall')],rise:[downCrouch,downIdle],
 jump:[downHD('jump')],crouch:[downCrouch],hug:[downHD('hug')],spit:[downIdle,downHD('spit'),downHD('spit')],special:[downHD('hug')]};
const babyLayers=Object.fromEntries(['body','left-arm','right-arm','left-leg','right-leg'].map(name=>[name,loadFrame('14-baby-'+name)]));
// HD frames retain a common root at (384,720), including attacks and specials.
const pedroHD=name=>loadFrame('0-hd-'+name);
const pedroIdle=pedroHD('idle'),pedroWindup=pedroHD('windup'),pedroPunch=pedroHD('punch'),pedroKnee=pedroHD('knee');
sprites[0]={
 idle:[pedroIdle],walk:[0,1,2,3].map(i=>pedroHD('walk-'+i)),
 run:[pedroHD('run-0'),pedroHD('run-2'),pedroHD('run-1'),pedroHD('run-2')],
 jump:[pedroHD('jump')],crouch:[pedroHD('crouch')],guard:[pedroHD('guard')],
 hurt:[pedroHD('hurt')],fall:[pedroHD('fall')],rise:[pedroHD('rise'),pedroHD('crouch')],
 punch:[pedroWindup,pedroPunch,pedroPunch,pedroIdle],strong:[pedroWindup,pedroPunch,pedroIdle],
 kick:[pedroKnee,pedroHD('kick'),pedroHD('kick'),pedroKnee],air:[pedroKnee,pedroHD('kick')],
 charge:[pedroHD('bull')],special:[pedroHD('horn-ready'),pedroHD('horn-blow'),pedroHD('horn-blow'),pedroHD('horn-ready')]
};
const maykimHD=name=>loadFrame('2-hd-'+name);
const maykimIdle=maykimHD('idle'),maykimGuard=maykimHD('guard');
sprites[2]={idle:[maykimIdle],walk:[0,1,2,3].map(i=>maykimHD('walk-'+i)),run:[0,1,2,3].map(i=>maykimHD('run-'+i)),
 punch:[maykimGuard,maykimHD('punch'),maykimIdle],kick:[maykimGuard,maykimHD('kick'),maykimIdle],
 guard:[maykimGuard],hurt:[maykimHD('hurt')],fall:[maykimHD('fall')],rise:[maykimHD('rise'),maykimIdle],
 jump:[maykimHD('takeoff'),maykimHD('jump'),maykimHD('land')],crouch:[maykimHD('land')],
 dash:[maykimHD('bike')],special:[maykimIdle,maykimHD('punch'),maykimIdle]};
const maykimBikePedro=maykimHD('bike-pedro');
const maykimTrucks=[maykimHD('truck'),maykimHD('truck-tip')];
function maykimBikeFor(a,b){return b.kind===0 ? sprites[2].dash[0] : maykimBikePedro;}
const rosterHD = new Map();
const orsiPose = name => loadFrame('9-hd-' + name);
const orsiChair = [orsiPose('chair'), orsiPose('chair-forward')];
const orsiCast = {
  seated: [[orsiChair[1], orsiPose('chair-physio')], [orsiPose('chair-cheese-bite'), orsiPose('chair-cheese-vomit')]],
  standing: [[orsiPose('cast-physio'), orsiPose('cast-physio')], [orsiPose('cheese-bite'), orsiPose('cheese-vomit')]]
};
const specialHD = new Map();
function loadSpecialHD(kind) {
  if (kind < 4 || kind === 9) return;
  if (!specialHD.has(kind)) {
    specialHD.set(kind, [1,2].map(slot => ['a','b'].map(phase => loadFrame(kind+'-hd-cast-'+slot+phase))));
  }
  return specialHD.get(kind);
}
const maykimTruckCast = ['a','b'].map(phase=>maykimHD('cast-2'+phase));
const downHDCast = [1,2].map(slot=>['a','b'].map(phase=>downHD('cast-'+slot+phase)));
const printedWeaponPoses = [0,1,2].map(tier=>{
  const pose = state=>loadFrame('10-hd-weapon-'+tier+'-'+state);
  return {ready:pose('ready'),guard:pose('guard'),strike:pose('strike'),walk:[pose('walk-0'),pose('walk-1')]};
});
const gabrielSleep = [0,1].map(frame=>loadFrame('8-hd-sleep-'+frame));
const gabrielProjection = [0,1].map(frame=>loadFrame('8-hd-projection-'+frame));
const dedewBabyHD = Object.fromEntries(['idle','walk-0','walk-1','run','jump','guard','punch','kick']
  .map(state=>[state,loadFrame('14-hd-baby-'+state)]));
function readyImage(image) {
  return image?.complete && image.naturalWidth;
}
function loadRosterHD(kind) {
  if (kind < 4 || kind >= sprites.length) return;
  if (rosterHD.has(kind)) return rosterHD.get(kind);
  const pose = name => loadFrame(kind + '-hd-' + name);
  const idle = pose('idle');
  const guard = pose('guard');
  const punch = pose('punch');
  const kick = pose('kick');
  const poses = {
    idle: [idle],
    walk: [0,1,2,3].map(index => pose((kind===9 ? 'stride-' : 'walk-') + index)),
    run: [0,1,2,3].map(index => pose('run-' + index)),
    punch: [guard, punch, punch, idle],
    kick: [guard, kick, kick, idle],
    guard: [guard],
    jump: [pose('jump')],
    hurt: [pose('hurt')],
    fall: [pose('fall')],
    rise: [pose('rise'), idle],
  };
  rosterHD.set(kind, poses);
  return poses;
}
const bull = loadFrame('bull');
const ambulance = loadFrame('4-ambulance-0');
const nurses = [0,1,2].map(i=>loadFrame('4-nurse-'+i));
const chocolate = loadFrame('4-chocolate-0');
const printedItemSprites = [0,1,2].map(i=>loadFrame('10-item-'+i));
const guineaFowl = [0,1].map(i=>loadFrame('6-bird-'+i));
const guineaFowlHD = [0,1].map(i=>loadFrame('6-hd-trap-bird-'+i));
const sleepBlanket=loadFrame('8-blanket-0');
const flyingBlanketHD=loadFrame('8-hd-blanket-flight');
const sleepBlanketHD=loadFrame('8-hd-blanket-cover');
const physio=[orsiPose('physio-ready'),orsiPose('physio-release')];
const legacyPhysio=[0,1].map(i=>loadFrame('9-physio-'+i));
const tabletShip=loadFrame('12-ship-0');
const powerArt=Object.fromEntries(['ambulance','medic-0','medic-1','chocolate','sausage','gas','heart','tablet-ship']
  .map(name=>[name,loadFrame('power-'+name)]));
const rescueRun=[0,1,2,3].map(index=>loadFrame('power-medic-run-'+index));
const chargeDust=[0,1].map(index=>loadFrame('power-charge-dust-'+index));
const truckCoins=[loadFrame('power-coin-face'),loadFrame('power-coin-edge')];
function powerSprite(name,fallback) {
  return readyImage(powerArt[name]) ? powerArt[name] : fallback;
}
const alfredo=sprites[12];
const alfredoCastFrames={
  special:[alfredo.idle[1],alfredo.guard[0],alfredo.punch[2],alfredo.idle[2]],
  bat:[alfredo.guard[0],alfredo.punch[1],alfredo.punch[2],alfredo.idle[0]]
};
function alfredoCastFrame(state,remaining) {
  const elapsed=.42-remaining;
  const release=state==='bat' ? .16 : .23;
  if (elapsed<release*.52) return 0;
  if (elapsed<release) return 1;
  return elapsed<.34 ? 2 : 3;
}
const celebration = loadFrame('1-celebrate-0');
const reactions = [0,3].map(first =>
  Array.from({length:3},(_,i) => loadFrame('maycon-reacao-'+(first+i)))
);
function reactionFrame(elapsed) {
  return Math.min(2,Math.max(0,Math.floor(elapsed/180)));
}

const ground = 392;
const roster = [
  {name:'Pedro — Serjão Berranteiro',subtitle:'Campeão da Roça',portrait:'frames/0-portrait.png',passive:'Campeão da Roça: +30% de dano contra oponentes ou habilidades femininas; −30% no Adélia.', color:'#ffca72', crop:[105,165,390,415], keys:['KeyA','KeyD','KeyW','KeyS','KeyF','KeyG','KeyH','KeyR']},
  {name:'Milk Down', color:'#ff96ca', crop:[447,321,335,385], keys:['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyJ','KeyK','KeyL','KeyU']}
];
const characters = [...roster,{name:'Maykim do Grau',subtitle:'O Maior Campeão',color:'#cda3ff'},{name:'Caleca',subtitle:'O Surfista Prateado',color:'#d8ebff'},{name:'Leandro Marçal',color:'#ffb1ad'},{name:'Pupinho',color:'#d6f77c'},{name:'Fabio Toscana',color:'#8fc8ff'},{name:'Angélica do Mounjaro',color:'#ff9def'},{name:'Gabriel Soneca do Almoço',color:'#d1b0ff'},{name:'Orsi Chefinho',color:'#ffd797'},{name:'Matheus the Printer',color:'#b6efbc'},{name:'Paulo Feliz',color:'#ffe28b'},{name:'CyberAlfredo',color:'#7ae9ff'},{name:'Lucreci do Pataco',subtitle:'Cabeção Natural',color:'#31c9f5',passive:'Causa até 40% mais dano contra campeões que evoluem, ficam maiores ou entram em forma ampliada.',portrait:'frames/13-portrait.png'},{name:'DêDêw',subtitle:'Punhos fortes',color:'#ffc477',passive:'Mão gradona: +15% de força. DêDêwzinhu aumenta a força e a velocidade dos golpes por 3 segundos.',portrait:'frames/14-portrait.png'}];
characters.forEach((character,kind)=>{character.portrait='frames/'+kind+'-portrait.webp';});
characters[1].subtitle='O Campeão Amoroso';
characters[1].passive='Amoroso: acertar golpes concede 15% de defesa por 3 segundos. Só o Abraço Down recupera 2 de vida ao acertar.';
const specials = [['Matador de Onça','Foon'],['Abraço Down','Gorfinho de Morango'],['Investida do Grau','Tio Patinhas'],['Brilho da Careca','Surfista Prateado'],['Equipe de Socorro','Comedor de Açúcar!'],['Peido Infectante','Cutucada na Orelha'],['Toscana Desenrolada','Galinhas da Angola'],['Seringa da Loucura','Pílula da Regeneração'],['Dorme Neném','Hora do Cochilo'],['Invocação da Fisioterapeuta','Queijo Gorfado'],['Ovo Imprimir em','SuperEnxaqueca'],['Golpe da Felicidade','Investida da Felicidade'],['Poder dos Tablets','Taco de Beiseball'],['Molho de pimenta','Investida do Pataco'],['Esguicho do café','DêDêwzinhu']];
const picks = [0,1];
const locked = [false,false];
const cardGroups = [...document.querySelectorAll('.fighter-cards')];
const stageCards = [...document.querySelectorAll('.stage-card')];
const visibleHeadGrowth=[0,0];
let fighters, effects, time, phase, banner, last, embrace, audio, reaction, reactionStarted, waitingForPedro;
let impactHold;
let pedroAudioBus;
// Use the arena's actual transition state for both fear and its damage penalty.
function inAdelia(){return Boolean(fighters?.some(f=>f.ascended));}
function pedroIsCrying(a){return a.kind===0 && inAdelia();}
function pedroPower(a,b) {
  if(a.kind!==0) return 1;
  if(pedroIsCrying(a)) return .7;
  return b.kind===7 || b.kind===13 || b.feminineAbility>0 ? 1.3 : 1;
}
function syncDeafnessAudio(){
  const local=online ? (online.role==='host' ? 0 : 1) : (typeof cpu!=='undefined' && cpu.active ? 0 : null);
  const muted=phase==='fight' && local!==null && fighters?.[local]?.deaf>0;
  for(const clip of Object.values(clips)) clip.muted=muted;
  if(audio){
    if(!pedroAudioBus || pedroAudioBus.context!==audio){pedroAudioBus=audio.createGain();pedroAudioBus.connect(audio.destination);}
    pedroAudioBus.gain.value=muted ? 0 : 1;
  }
}
function updateDownStatuses(dt){
 for(const a of fighters){
  a.slow=Math.max(0,(a.slow||0)-dt);a.frozen=Math.max(0,(a.frozen||0)-dt);
  a.affection=Math.max(0,(a.affection||0)-dt);
 }
}
function updatePedro(dt){
  for(const a of fighters){a.deaf=Math.max(0,(a.deaf||0)-dt);a.feminineAbility=Math.max(0,(a.feminineAbility||0)-dt);}
}

function sound(effect) {
  if (!audio || audio.state !== 'running') return;
  const now = audio.currentTime;
  const tone = (delay, duration, from, to, volume, wave) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const onset = now + delay;
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(from,onset);
    oscillator.frequency.exponentialRampToValueAtTime(to,onset+duration);
    gain.gain.setValueAtTime(.001,onset);
    gain.gain.exponentialRampToValueAtTime(volume,onset+.025);
    gain.gain.exponentialRampToValueAtTime(.001,onset+duration);
    syncDeafnessAudio();
    oscillator.connect(gain).connect(pedroAudioBus);
    oscillator.start(onset);
    oscillator.stop(onset+duration);
  };
  if(effect==='count'){tone(0,.10,430,430,.07,'sine');}
  else if(effect==='fight'){tone(0,.18,440,740,.09,'triangle');}
  else if(effect==='guard-break'){tone(0,.22,170,45,.10,'sawtooth');}
  else if(effect==='block'){tone(0,.08,390,180,.05,'triangle');}
  else if (effect === 'bull') {
    tone(.04,.48,126,53,.15,'sawtooth');
    for (let step=0;step<5;step++) tone(step*.105,.085,108,43,.19,'triangle');
  } else if (effect === 'sip') {
    for (let bubble=0;bubble<11;bubble++) {
      tone(bubble*.055,.08,170+bubble*14,440+bubble*24,.032,'triangle');
    }
    tone(0,.64,182,340,.045,'sawtooth');
  } else {
    tone(0,.25,107,42,.23,'triangle');
  }
}

function cancelReactionAudio() {
  waitingForPedro = false;
  clips.pedroDeath.pause();
  clips.mayconReaction.pause();
}

function showMayconReaction(happy) {
  reaction = happy;
  if (online) online.finalSent = false;
  reactionStarted = performance.now();
  playClip('mayconReaction');
}

function finishPedroLine() {
  if (!waitingForPedro || phase !== 'end') return;
  waitingForPedro = false;
  showMayconReaction(false);
}
clips.pedroDeath.addEventListener('ended',finishPedroLine);
clips.pedroDeath.addEventListener('error',finishPedroLine);

function reset(playing) {
  impactHold=null;
  for(const clip of Object.values(clips)) clip.muted=false;
  if(pedroAudioBus)pedroAudioBus.gain.value=1;
  stopMatheusAudio();
  resetCPU();
  fighters = picks.map((kind,i) => ({
    ...characters[kind], keys:roster[i].keys,i,kind,x:i ? 720 : 240,y:ground,
    orsiStood:false,
    slow:0,frozen:0,affection:0,deaf:0,feminineAbility:0,vy:0,vx:0,face:i ? -1 : 1,hp:100,stun:0,buff:0,charge:0,dazzle:0,tumble:0,infectionTicks:0,infectionClock:0,warp:0,snare:0,frenzy:0,regen:0,blood:0,bloodX:0,bloodY:0,asleep:0,sleepRecovery:0,nap:0,bedWalk:0,blanket:false,cloneX:0,cloneAction:0,ascended:false,migraineLevel:0,migraineTicks:0,migraineClock:0,migrainePulse:0,printedTier:-1,joyClock:0,tech:0,growthRead:0,growthPercent:0,baby:0,coffeeBurn:0,coffeeClock:0,
    guardEnergy:100,guardBreak:0,guardDelay:0,guardNotice:0,guardNeedsRelease:false,blockFlash:0,recovery:0,flash:0,action:0,actionDuration:.42,moveTime:0,cool:[0,0,0,0],specialsInProgress:[null,null,null],label:''
  }));
  keys.clear();
  effects=[];
  visibleHeadGrowth.fill(0);
  embrace = null;
  reaction = null;
  if (online) online.finalSent = false;
  cancelReactionAudio();
  fighters.forEach((fighter,i) => {
    document.querySelector('#player-'+i+'-name').textContent = fighter.name+(cpu.active && !online && i===1 ? ' · CPU' : '');
    document.querySelector('#player-'+i+'-special-0').textContent = specials[fighter.kind][0];
    document.querySelector('#player-'+i+'-special-1').textContent = specials[fighter.kind][1];
  });
  time = 60;
  countdown=playing ? 3 : 0;fightCue=0;
  phase = playing ? 'countdown' : 'ready';
  banner = playing ? '3' : stageNames[stageIndex];
  if(playing) sound('count');
  document.querySelector('#rematch').textContent = 'Reiniciar duelo';
}

function isDefending(a,pressed=keys){
  return !a.frozen && a.hp>0 && a.guardEnergy>1e-8 && !a.guardBreak && !a.guardNeedsRelease && pressed.has(a.keys[3]) && a.y===ground && !a.stun && !a.snare && !a.asleep && !a.sleepRecovery && !a.nap && !a.bedWalk && !a.charge && !a.tumble;
}
function breakGuard(a,feedback=true){
  if(a.guardBreak || !a.hp)return;
  a.guardEnergy=0;a.guardBreak=.8;a.guardDelay=1;a.guardNotice=1.25;a.guardNeedsRelease=true;
  a.stun=Math.max(a.stun,.8);a.action=0;a.charge=0;a.vx=a.vy=0;a.blockFlash=0;
  if(feedback)sound('guard-break');
}
function updateGuard(a,dt,pressed=keys,feedback=true){
  if(!a.hp)return;
  const held=pressed.has(a.keys[3]);
  a.guardNotice=Math.max(0,a.guardNotice-dt);
  if(!held)a.guardNeedsRelease=false;
  if(a.guardBreak>0){
    a.guardBreak=Math.max(0,a.guardBreak-dt);
    if(a.guardBreak<1e-8){a.guardBreak=0;a.guardEnergy=40;a.guardDelay=1;}
    return;
  }
  if(held){
    a.guardDelay=1;
    if(isDefending(a,pressed)){
      a.guardEnergy=Math.max(0,a.guardEnergy-20*dt);
      if(a.guardEnergy<1e-8)breakGuard(a,feedback);
    }
    return;
  }
  const delay=a.guardDelay;
  a.guardDelay=Math.max(0,delay-dt);
  a.guardEnergy=Math.min(100,a.guardEnergy+Math.max(0,dt-delay)*30);
}
function guardBlocks(a,cost=25,basic=false){
  if(!isDefending(a))return false;
  a.guardEnergy=Math.max(0,a.guardEnergy-cost);a.guardDelay=1;
  if(a.guardEnergy<1e-8){breakGuard(a);return true;}
  if(!a.blockFlash){
    if(basic)combatCue('block');
    else sound('block');
  }
  a.blockFlash=.24;
  return true;
}
function hit(a,b,damage,push,stun,grab = false, blanketHit = false, specialSlot = 0, basic = '') {
  if (!b.hp || (a.kind===8 && (b.asleep || b.sleepRecovery) && !blanketHit)) return false;
  if(guardBlocks(b,specialSlot ? 25 : a.label==='CHUTE' ? 15 : 10,Boolean(basic)))return false;
  const before=b.hp;
  const growth=evolution(a);
  const power=a.kind===7 ? .42+growth*.12 : 1;
  const growthBonus=a.kind===13 ? lucreciGrowthBonus(b) : 0;
  if (growthBonus) {
    a.growthRead=.75;
    a.growthPercent=Math.round(growthBonus*100);
  }
  const sleepPower=a.kind===8 && (b.asleep || b.nap) ? 1.25 : 1;
  const sleepDefense=b.kind===8 && (a.asleep || a.nap) ? .8 : 1;
  damageFighter(b,damage*pedroPower(a,b)*(a.buff ? 1.45 : 1)*power*sleepPower*sleepDefense*(a.ascended ? 1.35 : 1)*(1+growthBonus)*(a.kind===14 ? (a.baby>0 ? 1.65 : 1.15) : 1),!basic);
  if(basic && before>b.hp){
    const heavy=basic.endsWith('_heavy');
    combatCue('body_impact');
    if(heavy)combatCue('heavy_collision');
    effects.push({kind:'basic-impact',owner:a.i,x:b.x-a.face*19,y:b.y-105,time:0,heavy});
  }
  if(a.kind===1 && before>b.hp)a.affection=3;
  if(a.kind===14 && a.baby>0 && specialSlot===0 && before>b.hp){
    effects.push({kind:'dedew-quake',owner:a.i,x:b.x,y:ground,face:a.face,time:0});
    sound('impact');
  }
  if (a.regen && a.hp && before>b.hp) {
    a.hp=Math.min(100,a.hp+(before-b.hp)*.45);
    a.blood=.34;
    a.bloodX=b.x;
    a.bloodY=b.y-86;
  }
  b.vx = a.face * push * (b.kind === 0 ? 1.45 : 1) ;
  b.stun = Math.max(b.stun,stun);
  b.flash = .18;
  const cast=a.specialsInProgress?.[specialSlot];
  if (cast) cast.remaining=Math.max(cast.remaining,Math.max(.18,stun));
  if(specialSlot && a.kind!==3 && before>b.hp) {
    effects.push({kind:'victim-impact',owner:a.i,target:b.i,sourceKind:a.kind,slot:specialSlot,
      x:b.x,y:b.y,face:a.face,time:0});
  }
  return true;

}

function lucreciGrowthBonus(target) {
  let bonus=0;
  if(target.kind===14 && target.baby>0) bonus=.35;
  if (target.kind===7) bonus=Math.max(bonus,Math.min(.40,evolution(target)*.08));
  if (target.kind===9 && target.ascended) bonus=Math.max(bonus,.35);
  if (target.kind===10) bonus=Math.max(bonus,Math.min(.40,visibleHeadGrowth[target.i]*.40));
  return bonus;
}

function damageFighter(target,damage,playHurt=false) {
  if (!target.hp) return;
  target.hp=Math.max(0,target.hp-damage*.55*(target.kind===1 && target.affection>0 ? .85 : 1));
  if (target.kind===9 && target.hp>0 && target.hp<=40 && !target.ascended) {
    target.ascended=true;
  }
  if (!target.hp) {
    playClip(target.kind===0 ? 'pedroDeath' : target.kind===1 ? 'downDeath' : 'hurt');
  } else if (playHurt) {
    playClip('hurt');
  }
}

function updateInfection(fighter,dt) {
  if (!fighter.infectionTicks || !fighter.hp) return;
  fighter.infectionClock-=dt;
  while (fighter.infectionClock<=0 && fighter.infectionTicks && fighter.hp) {
    damageFighter(fighter,4);
    fighter.infectionTicks--;
    fighter.infectionClock+=.55;
  }
}

function updateCoffeeBurn(a,dt) {
  if(!a.coffeeBurn || !a.hp) return;
  a.coffeeClock-=dt;
  while(a.coffeeClock<=0 && a.coffeeBurn && a.hp){
    damageFighter(a,2);
    a.coffeeBurn--;
    a.coffeeClock+=.5;
  }
}

function cooldownFor(a,slot) {
  if(a.kind===14 && a.baby>0 && (slot===0 || slot===3)) return slot===0 ? .36 : .55;
  return [ .72, 4.5, a.kind===8 ? 8.5 : a.kind===10 ? 9 : 8, 1.05 ][slot];
}

const specialEffectSlots={
  'money-truck':2,'strawberry-spit':2,'down-hearts':1,'foon-wave':2,rescue:1,chocolate:2,gas:1,teleport:2,toscana:1,'guinea-fowl':2,
  blanket:1,pillow:2,physio:1,cheese:2,print:1,'joy-heart':2,'tablet-ship':1,tablet:1,battery:2,'tablet-blast':2,'lucreci-fire':1,'lucreci-money':2,'dedew-coffee':1
};
const ongoingSpecialStates=[
  [['charge'],[]], [[],[]], [['charge'],[]], [[],['charge']],
  [[],[]], [[],[]], [[],[]], [['frenzy'],['regen','blood']],
  [['bedWalk'],['nap']], [[],[]], [[],['migraineTicks','migrainePulse']], [[],['charge']], [[],[]], [[],[]], [[],['baby']]
];

function startSpecial(a,slot) {
  if (slot===1 || slot===2) a.specialsInProgress[slot]={remaining:.42,targetStates:[]};
}
function holdSpecial(a,slot,...targetStates) {
  const cast=a.specialsInProgress?.[slot];
  if (cast) cast.targetStates.push(...targetStates);
}
function specialHit(a,b,slot,damage,push,stun,grab=false,blanketHit=false) {
  return hit(a,b,damage,push,stun,grab,blanketHit,slot);
}
function effectHit(effect,a,b,damage,push,stun,grab=false,blanketHit=false) {
  return specialHit(a,b,effect.slot ?? specialEffectSlots[effect.kind] ?? 0,damage,push,stun,grab,blanketHit);
}
function defaultActionDuration(kind,slot) {
  return (slot===1 || slot===2) && kind!==3 ? .74 : .42;
}
function advanceSpecialCooldowns(dt) {
  for (const a of fighters) {
    const opponent=fighters[1-a.i];
    for (const slot of [1,2]) {
      const cast=a.specialsInProgress[slot];
      if (!cast) {
        a.cool[slot]=Math.max(0,a.cool[slot]-dt);
        continue;
      }
      const ongoing=cast.remaining>0 ||
        ongoingSpecialStates[a.kind][slot-1].some(state=>a[state]>0) ||
        cast.targetStates.some(state=>opponent[state]>0) ||
        (slot===1 && embrace?.a===a) ||
        effects.some(effect=>effect.owner===a.i && (effect.slot ?? specialEffectSlots[effect.kind])===slot);
      if (!ongoing) a.specialsInProgress[slot]=null;
    }
  }
}

function attack(a,b,slot) {
  if (phase!=='fight' || !a.hp || a.guardBreak || a.asleep || a.sleepRecovery || a.bedWalk) return;
  if (a.nap) {
    if (slot===0 && !a.cool[0]) throwPillow(a,b);
    return;
  }
  if (embrace || a.frozen || a.stun || a.snare || a.charge || a.action > .12 || a.recovery>0 || (a.cool[slot] || a.specialsInProgress[slot]) || keys.has(a.keys[3])) return;
  if (a.kind===9 && (slot===0 || slot===3)) a.orsiStood=true;
  a.face = Math.sign(b.x-a.x) || a.face;
  a.cool[slot] = cooldownFor(a,slot);
  a.recovery=a.kind===14 && a.baby>0 && (slot===0 || slot===3) ? (slot===0 ? .34 : .50) : slot===0 ? .68 : slot===3 ? .82 : .70;
  startSpecial(a,slot);
  a.action=a.actionDuration=defaultActionDuration(a.kind,slot);
  const close = Math.abs(a.y-b.y) < 75;
  const gap = Math.abs(a.x-b.x);
  if (slot === 3) {
    a.label = 'CHUTE';
    if(a.kind===14 && a.baby>0) a.action=a.actionDuration=.28;
    const cue=a.kind===14 && a.baby>0 ? '' : a.y<ground ? 'kick_light' : 'kick_heavy';
    if(cue)combatCue(cue);
    if (close && gap < 146) hit(a,b,13,290,.24,false,false,0,cue);
  } else if (slot === 0) {
    a.label = 'ATAQUE';
    if(a.kind===14 && a.baby>0) a.action=a.actionDuration=.28;
    if (a.kind===10 && a.printedTier>=0) {
      const tier=a.printedTier;
      a.label=printedItems[tier].toUpperCase();
      playClip('punch');
      if (tier===2) {
        effects.push({kind:'printed-shot',owner:a.i,x:a.x,y:a.y,face:a.face,time:0,hit:false});
      } else if (close && gap<=[114,181][tier]) {
        hit(a,b,[12,20][tier],285,.33);
      }
      return;
    }
    const cue=a.kind===1 || (a.kind===14 && a.baby>0) ? '' :
      a.buff || a.ascended ? 'punch_heavy' : 'punch_light';
    if(cue)combatCue(cue);
    else playClip(a.kind===1 ? 'slap' : 'punch');
    if (close && gap < 112) hit(a,b,9,190,.18,false,false,0,cue);
  } else if (slot === 1 && a.kind === 0) {
    a.label = 'MATADOR DE ONÇA';
    playClip('bull');
    sound('bull');
    beginCharge(a);
    
  } else if (a.kind===14) {
    if(slot===1){
      a.label='ESGUICHO DO CAFÉ';a.action=a.actionDuration=.82;
      sound('sip');
      effects.push({kind:'dedew-coffee',owner:a.i,x:a.x,y:a.y,face:a.face,time:0,hit:false});
    }else{
      a.label='DÊDÊWZINHU';a.baby=3;a.action=a.actionDuration=.28;
      a.cool[0]=Math.min(a.cool[0],.20);a.cool[3]=Math.min(a.cool[3],.32);
      sound('impact');
      effects.push({kind:'dedew-quake',owner:a.i,x:a.x,y:ground,face:a.face,time:0});
    }
  } else if (a.kind===13) {
    if (slot===1) {
      a.label='MOLHO DE PIMENTA';
      a.action=a.actionDuration=.82;
      playClip('punch');
      effects.push({kind:'lucreci-fire',owner:a.i,x:a.x,y:a.y,face:a.face,time:0,hit:false});
    } else if (slot===2) {
      a.label='INVESTIDA DO PATACO';
      a.action=a.actionDuration=.84;
      playClip('punch');
      effects.push({kind:'lucreci-money',owner:a.i,x:a.x,y:a.y,face:a.face,time:0,hit:false});
    }
  } else if (a.kind===12) {
    const powered=a.tech===3;
    a.tech=powered ? 0 : a.tech+1;
    if (powered) a.cool[slot]*=.85;
    a.label=slot===1 ? 'PODER DOS TABLETS' : 'TACO DE BEISEBALL';
    combatCue(slot===1 ? 'energy_charge' : 'projectile');
    effects.push({kind:slot===1 ? 'tablet-ship' : 'battery',owner:a.i,
      x:slot===1 ? (a.face>0 ? -68 : 1028) : a.x,y:a.y,face:a.face,
      time:0,hit:false,powered,nextDrop:.23});
  } else if (a.kind===11) {
    combatCue('energy_charge');
    if (slot===1) {
      a.label='GOLPE DA FELICIDADE';
      effects.push({kind:'joy-heart',slot:1,owner:a.i,x:a.x,y:a.y,face:a.face,time:0,hit:false});
    } else {
      a.label='INVESTIDA DA FELICIDADE';
      beginCharge(a);
    }
  } else if (a.kind===10) {
    if (slot===1) {
      a.label='OVO IMPRIMIR EM';
      playClip('matheusPrinter');
      effects.push({kind:'print',tier:printTier(a.hp),owner:a.i,x:a.x,y:a.y,
        face:a.face,time:0,hit:false});
    } else {
      a.label='SUPERENXAQUECA';
      playClip('matheusBleeding');
      playClip('matheusHeartbeat');
      a.migraineLevel=Math.min(4,a.migraineLevel+1);
      a.migraineTicks=6;
      a.migraineClock=1;
    }
  } else if (a.kind===9) {
    a.label=slot===1 ? 'INVOCAÇÃO DA FISIOTERAPEUTA' : 'QUEIJO GORFADO';
    if(slot===1)a.feminineAbility=1.03;
    effects.push({kind:slot===1 ? 'physio' : 'cheese',owner:a.i,
      x:a.x,y:a.y,face:a.face,time:0,hit:false,direct:false});
  } else if (a.kind===8) {
    if (slot===1) {
      a.label='DORME NENÉM';
      const defended=close && gap<340 && guardBlocks(b);
      if (close && gap<340 && !defended) {
        holdSpecial(a,1,'asleep','sleepRecovery');
        b.asleep=2.14;
        b.sleepRecovery=0;
        a.cool[2]=Math.max(0,a.cool[2]-1.5);
        b.charge=b.vx=b.vy=0;
        b.y=ground;
        a.bedWalk=.34;
        effects.push({kind:'blanket',owner:a.i,x:a.x,y:a.y,face:a.face,time:0,hit:false});
      }
    } else {
      a.label='HORA DO COCHILO';
      a.nap=6;
      a.cloneX=Math.max(55,Math.min(905,a.x+a.face*76));
      a.y=ground;
      a.vx=a.vy=0;
    }
  } else if (a.kind === 7) {
    a.label=slot===1 ? 'SERINGA DA LOUCURA' : 'PÍLULA DA REGENERAÇÃO';
    if (slot===1) a.frenzy=3;
    else a.regen=7;
  } else if (a.kind === 6) {
    a.label=slot===1 ? 'TOSCANA DESENROLADA' : 'GALINHAS DA ANGOLA';
    playClip(slot===1 ? 'fabioToscana' : 'fabioGalinhas');
    effects.push({kind:slot===1 ? 'toscana' : 'guinea-fowl',owner:a.i,
      x:a.x,y:a.y,face:a.face,time:0,hit:false});
  } else if (a.kind === 5) {
    a.label = slot===1 ? 'PEIDO INFECTANTE' : 'CUTUCADA NA ORELHA';
    playClip(slot===1 ? 'pupinhoGas' : 'pupinhoWarp');
    effects.push({kind:slot===1 ? 'gas' : 'teleport',owner:a.i,
      x:a.x,y:a.y,face:a.face,time:0,hit:false});
  } else if (a.kind === 4) {
    if(slot===1)a.feminineAbility=1.15;
    a.label = slot===1 ? 'EQUIPE DE SOCORRO' : 'COMEDOR DE AÇÚCAR!';
    effects.push({kind:slot===1 ? 'rescue' : 'chocolate',owner:a.i,
      x:a.x,y:a.y,face:a.face,time:0,hit:false});
    playClip(slot===1 ? 'leandroRescue' : 'leandroChocolate');
  } else if (a.kind === 3) {
    if (slot === 1) {
      a.label = 'BRILHO DA CARECA';
      playClip('calecaFlash');
      if (close && gap < 340) {
        if(specialHit(a,b,1,15,125,.45)){b.dazzle=.52;holdSpecial(a,1,'dazzle');}
      }
    } else {
      a.label = 'SURFISTA PRATEADO';
      playClip('calecaSurf');
      beginCharge(a);
    }
  } else if (a.kind === 2) {
    if (slot === 1) {
      a.label = 'INVESTIDA DO GRAU';
      a.action=a.actionDuration=.65;playClip('mayconDash');beginCharge(a);
    } else {
      a.label = 'TIO PATINHAS';a.action=a.actionDuration=.90;
      sound('impact');effects.push({kind:'money-truck',owner:a.i,x:b.x,y:ground,face:a.face,time:0,hit:false});
    }
  } else if (slot === 1) {
    a.label = 'ABRAÇO DOWN';
    effects.push({kind:'down-hearts',owner:a.i,x:a.x,y:a.y,face:a.face,time:0});
    playClip('hug');
    if (close && gap < 125) {
      const dodge = keys.has(b.keys[2]) || b.y < ground-45 || b.charge;
      if (!dodge && !guardBlocks(b)) {
        embrace = {a,b,time:0};
        a.vx = b.vx = a.vy = b.vy = 0;
        a.y = b.y = ground;
        a.action = .72;
      }
    }
  } else if (a.kind === 0) {
    a.label = 'FOOOON!';
    a.action=a.actionDuration=.82;
    playClip('horn');
    effects.push({kind:'foon-wave',owner:a.i,x:a.x,y:a.y,face:a.face,time:0,hit:false});
  } else {
    a.label = 'GORFINHO DE MORANGO';
    a.action=a.actionDuration=.88;
    playClip('milk');sound('sip');
    effects.push({kind:'strawberry-spit',owner:a.i,x:a.x,y:a.y,face:a.face,time:0,hit:false});
  }
}

const bindings = new Set(roster.flatMap(p => p.keys));
document.addEventListener('keydown',e => {
  if (online) return onlineKey(e,true);
  if(cpu.active && phase==='fight' && roster[1].keys.includes(e.code)){e.preventDefault();return;}
  if (phase === 'characters' || phase === 'stages') {
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    const commands = [['KeyA','KeyD','KeyF'],['ArrowLeft','ArrowRight','KeyJ']];
    for (let player=0;player<2;player++) {
      const command=commands[player].indexOf(e.code);
      if (command<0) continue;
      e.preventDefault();
      if (phase === 'characters') {
        if (command === 2) confirmFighter(player);
        else if (!locked[player]) chooseFighter(player,(picks[player]+characters.length+(command ? 1 : -1))%characters.length);
      } else if (command === 2) {
        start.click();
      } else {
        chooseStage((stageIndex+stages.length+(command===0 ? -1 : 1))%stages.length);
      }
      break;
    }
    return;
  }
  if (phase !== 'fight' || !bindings.has(e.code)) return;
  e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  fighters.forEach((a,i) => {
    const slot = a.keys.indexOf(e.code)-4;
    if (slot >= 0) attack(a,fighters[1-i],slot);
  });
});
document.addEventListener('keyup',e => {
  if (online) return onlineKey(e,false);
  if(cpu.active && phase==='fight' && roster[1].keys.includes(e.code)){e.preventDefault();return;}
  keys.delete(e.code);
});
window.addEventListener('blur',() => {
  if (online) roster[online.role === 'host' ? 0 : 1].keys.forEach(code=>onlineKey({code,preventDefault(){}},false));
  else keys.clear();
});
function chooseFighter(player,kind) {
  if (online && player !== (online.role === 'host' ? 0 : 1)) return;
  picks[player] = kind;
  paintPick(player);
  if (online) sendOnline({type:'pick',kind});
}
function paintPick(player) {
  const kind = picks[player];
  const preview=cardGroups[player].parentElement.querySelector('.champion-preview');
  preview.querySelector('img').src=characters[kind].portrait || sprites[kind].idle[0].src;
  preview.querySelector('img').alt=characters[kind].name;
  preview.querySelector('strong').textContent=characters[kind].name;
  const specialList=preview.querySelector('p');
  const badges=[];
  if(characters[kind].passive){
    const passive=document.createElement('span');
    passive.className='special-name passive-name';
    passive.textContent='Passiva · '+characters[kind].passive;
    badges.push(passive);
  }
  badges.push(...specials[kind].map(name=>{
    const badge=document.createElement('span');
    badge.className='special-name';
    badge.textContent=name;
    return badge;
  }));
  specialList.replaceChildren(...badges);

  [...cardGroups[player].children].forEach((card,i) => card.setAttribute('aria-pressed',String(i===kind)));
}
function confirmFighter(player) {
  if (online && player !== (online.role === 'host' ? 0 : 1)) return;
  locked[player] = !locked[player];
  if (online) sendOnline({type:'ready',ready:locked[player]});
  paintConfirmation(player);
}
function paintConfirmation(player) {
  const panel = cardGroups[player].parentElement;
  if (locked[player]) {
    loadRosterHD(picks[player]);
    loadSpecialHD(picks[player]);
  }
  panel.querySelector('.confirm').textContent = locked[player] ? 'Alterar escolha' : cpu.active && player===1 ? 'Confirmar oponente' : 'Confirmar campeão';
  [...cardGroups[player].children].forEach(card => {card.disabled=locked[player]});
  if (locked.every(Boolean)) {
    phase='stages';
    characterScreen.hidden=true;
    stageScreen.hidden=false;
    chooseStage(stageIndex);
    stageCards[stageIndex].focus();
    start.disabled = online?.role === 'guest';
  }
}
cardGroups.forEach((group,player) => {
  const preview=document.createElement('div');
  preview.className='champion-preview';
  const art=document.createElement('img');
  art.alt='';
  const info=document.createElement('div');
  const label=document.createElement('span');
  label.className='preview-label';
  label.textContent='Campeão em destaque';
  info.append(label,document.createElement('strong'),document.createElement('p'));
  preview.append(art,info);
  group.before(preview);

  characters.forEach((character,kind) => {
    const card = document.createElement('button');
    card.type='button';
    card.className='fighter-card';
    card.style.setProperty('--accent',character.color);
    const portrait=document.createElement('img');
    portrait.src=character.portrait || sprites[kind].idle[0].src;
    portrait.alt='';
    const label=document.createElement('span');
    label.textContent=character.name;
    card.append(portrait,label);
    if (character.subtitle) {
      const subtitle=document.createElement('small');
      subtitle.textContent=character.subtitle;
      card.append(subtitle);
    }
    card.onclick=()=>chooseFighter(player,kind);
    group.append(card);
  });
  group.parentElement.querySelector('.confirm').onclick=()=>confirmFighter(player);
});
function chooseStage(index) {
  if(!Number.isInteger(index) || !stages[index])return;
  stageIndex=index;
  loadArenaFrames(arenaProfiles[index].id);
  stageCards.forEach((card,i)=>card.setAttribute('aria-pressed',String(i===index)));
}
stageCards.forEach((card,i)=>{card.onclick=()=>{
  if (online?.role === 'guest') return;
  chooseStage(i);
  if (online) sendOnline({type:'stage',index:i});
}});
function showCharacters() {
  stopMatheusAudio();
  cancelReactionAudio();
  document.body.classList.remove('fighting');
  phase='characters';
  keys.clear();
  selection.hidden=false;
  characterScreen.hidden=false;
  stageScreen.hidden=true;
  canvas.hidden=true;
  controls.hidden=true;
  document.querySelector('#guard-tip').hidden=true;
  document.querySelector('#fight-actions').hidden=true;
  cardGroups.forEach((group,player)=>{
    locked[player]=false;
    [...group.children].forEach(card=>{card.disabled=false});
    group.parentElement.querySelector('.confirm').textContent=cpu.active && player===1 ? 'Confirmar oponente' : 'Confirmar campeão';
    paintPick(player);
    group.parentElement.hidden=Boolean(online && player !== (online.role === 'host' ? 0 : 1));
  });
  resetCPU();
  updateModeUI();
  cardGroups[0].children[picks[0]].focus();
}
function returnToSelection() {
  if (online) sendOnline({type:'selection'});
  showCharacters();
}
document.querySelector('#back').onclick=returnToSelection;
document.querySelector('#change-fighters').onclick=returnToSelection;
document.querySelector('#rematch').onclick=()=>start.click();
start.onclick = () => {
  if (online?.role === 'guest' || (online && !online.conn?.open)) return;
  if (online) sendOnline({type:'start',picks,stageIndex});
  startFight();
  if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
};
function startFight() {
  document.body.classList.add('fighting');
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (Audio) {
    audio ??= new Audio();
    audio.resume().catch(() => {});
    warmCombatAudio();
  }
  selection.hidden=true;
  canvas.hidden=false;
  controls.hidden=false;
  document.querySelector('#guard-tip').hidden=false;
  document.querySelector('#fight-actions').hidden=false;
  reset(true);
  if (online) {
    online.simulatedAt = performance.now();
    online.inputSequence = 0;
    online.acknowledgedInput = 0;
    online.visual = {...fighters[1],cool:[...fighters[1].cool]};
    online.localKeys = new Set();
    online.pendingInputs = [];
    online.predictedAttack = 0;
    online.predictedDash = null;
  }
  canvas.focus({preventScroll:true});
};

function resetCPU(){
  cpu.think=cpu.guard=cpu.jump=cpu.move=0;
  roster[1].keys.forEach(code=>keys.delete(code));
}
function setPlayMode(enabled){
  cpu.active=enabled;
  resetCPU();
  leaveOnline(enabled ? 'Contra a máquina: escolha seu campeão e o oponente controlado pelo computador.' : '2 jogadores locais: cada jogador controla seu campeão.');
}
function updateModeUI(){
  document.body.classList.toggle('vs-machine',cpu.active && !online);
  document.querySelector('#cpu-mode').setAttribute('aria-pressed',String(cpu.active && !online));
  document.querySelector('#local-mode').setAttribute('aria-pressed',String(!cpu.active && !online));
  document.querySelector('.mode-chip').textContent=online ? 'Duelo online' : cpu.active ? 'Contra a máquina' : '2 jogadores locais';
  const panel=cardGroups[1].parentElement;
  panel.querySelector('h3').textContent=cpu.active && !online ? 'Máquina · CPU' : 'Player 2';
  panel.querySelector('.player-help').textContent=cpu.active && !online ? 'Você escolhe o campeão da máquina' : '← → escolher · J confirmar';
  document.querySelector('.selection-heading p').textContent=cpu.active && !online ? 'Escolha seu campeão e o adversário da máquina. Confirme os dois para escolher a arena.' : 'Selecione um personagem, confira os golpes especiais e confirme para avançar.';
  document.querySelector('.cpu-help').hidden=!(cpu.active && !online);
}
function cpuSpecialRange(a,b,gap){
  // Each pair describes when the two specials are useful for this champion.
  switch(a.kind){
    case 0:return [gap>100 && gap<550,gap<380];
    case 1:return [gap<115,gap<380];
    case 2:return [gap>100 && gap<560,gap<700];
    case 3:return [gap<340,gap>145 && gap<650];
    case 4:return [gap<650,gap<690];
    case 5:return [gap<250,gap<530];
    case 6:return [gap<340,gap<650];
    case 7:return [gap<450,a.hp<78];
    case 8:return [gap<480,gap>160];
    case 9:return [gap<510,gap<375];
    case 10:return [a.printedTier<0 || gap>180,gap<520];
    case 11:return [gap<290,gap>140 && gap<650];
    case 12:return [gap<700,gap<300];
    case 13:return [gap<295,gap<700];
    case 14:return [gap<300,gap<240 && !a.baby];
    default:return [gap<300,gap<400];
  }
}
function updateCPU(dt){
  if(!cpu.active || online || phase!=='fight') return;
  const a=fighters[1],b=fighters[0];
  roster[1].keys.forEach(code=>keys.delete(code));
  if(!a.hp || !b.hp){resetCPU();return;}
  cpu.think-=dt;cpu.guard=Math.max(0,cpu.guard-dt);cpu.jump=Math.max(0,cpu.jump-dt);
  if(a.stun || a.guardBreak || a.snare || a.asleep || a.sleepRecovery || a.bedWalk){cpu.move=0;return;}
  if(cpu.think<=0){
    cpu.think=.18+Math.random()*.16;
    const gap=Math.abs(a.x-b.x),direction=Math.sign(b.x-a.x)||a.face;
    const nearHeight=Math.abs(a.y-b.y)<80;
    cpu.move=gap>100 ? direction : gap<65 && Math.random()<.22 ? -direction : 0;
    const incoming=effects.some(e=>e.owner===0 && !e.hit && Math.abs(effectPosition(e)-a.x)<190);
    if(a.guardEnergy>30 && !a.guardBreak && !a.guardNeedsRelease && a.y===ground && ((b.action && gap<175) || incoming) && Math.random()<.38){
      cpu.guard=.22+Math.random()*.20;cpu.move=0;
    }else if(a.y===ground && !a.nap && ((incoming && Math.random()<.45) || Math.random()<.055)){
      cpu.jump=.10;
    }
    if(!cpu.guard && !a.charge && a.action<=.12){
      const useful=cpuSpecialRange(a,b,gap);
      const slots=[1,2].filter(slot=>useful[slot-1] && !a.cool[slot] && !a.specialsInProgress[slot]);
      if(a.nap){attack(a,b,0);}
      else if(slots.length && Math.random()<.57){attack(a,b,slots[Math.floor(Math.random()*slots.length)]);}
      else if(nearHeight && gap<139){attack(a,b,gap>108 || Math.random()<.28 ? 3 : 0);}
    }
  }
  if(cpu.guard>0){keys.add(a.keys[3]);return;}
  if(cpu.move)keys.add(a.keys[cpu.move>0 ? 1 : 0]);
  if(cpu.jump>0)keys.add(a.keys[2]);
}

function update(dt) {
  if(phase==='countdown'){
    const previous=Math.ceil(countdown);
    countdown=Math.max(0,countdown-dt);
    banner=String(Math.max(1,Math.ceil(countdown)));
    if(countdown<1e-8){
      countdown=0;phase='fight';banner='BRIGUEM!';fightCue=.75;keys.clear();resetCPU();sound('fight');
    }else if(Math.ceil(countdown)!==previous)sound('count');
    return;
  }
  if (phase !== 'fight') return;
  updatePedro(dt);
  updateDownStatuses(dt);
  if(fightCue>0){fightCue=Math.max(0,fightCue-dt);if(!fightCue)banner='';}
  if(cpu.active && !online) updateCPU(dt);
  time = Math.max(0,time-dt);
  for(const a of fighters){
    a.baby=Math.max(0,a.baby-dt);
    updateCoffeeBurn(a,dt);
    updateGuard(a,dt);
  }
  if (embrace) {
    const {a,b} = embrace;
    embrace.time += dt;
    if (embrace.time < .19 && keys.has(b.keys[2])) {
      b.vy = -495;
      a.label = 'ESQUIVOU!';
      embrace = null;
      return;
    }
    const gap = b.x-a.x;
    b.x -= (gap-a.face*43)*Math.min(1,dt*18);
    b.face = -a.face;
    if (embrace.time >= .58) {
      if(specialHit(a,b,1,20,170,.28,true)){b.slow=2;if(a.hp>0)a.hp=Math.min(100,a.hp+2);holdSpecial(a,1,'slow');}
      effects.push({kind:'down-hearts',owner:a.i,x:b.x,y:b.y,face:a.face,time:0});
      sound('impact');
      embrace = null;
    } else {
      return;
    }
  }
  for (const a of fighters) {
    const b = fighters[1-a.i];
    updateInfection(a,dt);
    updateMigraine(a,b,dt);
    updateJoy(a,b,dt);
    for (const timer of ['stun','buff','flash','action','tumble','dazzle','frenzy','regen','blood','cloneAction','migrainePulse','growthRead','blockFlash','recovery']) a[timer] = Math.max(0,a[timer]-dt);
    for (const slot of [0,3]) a.cool[slot]=Math.max(0,a.cool[slot]-dt);
    for (const cast of a.specialsInProgress) {
      if (cast) cast.remaining=Math.max(0,cast.remaining-dt);
    }
    if (a.asleep>0 || a.sleepRecovery>0) {
      if (a.asleep>0) {
        a.asleep=Math.max(0,a.asleep-dt);
        if (!a.asleep) a.sleepRecovery=.50;
      } else {
        a.sleepRecovery=Math.max(0,a.sleepRecovery-dt);
      }
      a.nap=Math.max(0,a.nap-dt);
      a.vx=a.vy=0;
      continue;
    }
    if (a.nap>0) {
      a.nap=Math.max(0,a.nap-dt);
      moveClone(a,keys,dt);
      a.vx=a.vy=0;
      continue;
    }
    if (a.bedWalk>0) {
      const destination=b.x-a.face*63;
      a.x=Math.max(55,Math.min(905,a.x+(destination-a.x)*Math.min(1,dt/a.bedWalk)));
      a.bedWalk=Math.max(0,a.bedWalk-dt);
      continue;
    }
    if (a.snare>0) {
      a.snare=Math.max(0,a.snare-dt);
      a.vx=a.vy=0;
      continue;
    }
    if(a.frozen>0){a.vx=a.vy=0;continue;}
    if (a.charge) {
      const beforeCharge=a.charge, startX=a.x;
      const distance=advanceCharge(a,dt);
      if(distance && (a.kind===0 || a.kind===2) &&
          (Math.ceil(beforeCharge/.055)!==Math.ceil(a.charge/.055) || !a.charge)){
        effects.push({kind:'charge-dust',owner:a.i,x:startX-a.face*112,y:ground,face:a.face,time:0});
      }
      if (a.kind===11 && a.charge===0 && a.hp) {
        const x=Math.max(55,Math.min(905,a.x));
        combatCue('energy_release');
        combatCue('projectile');
        effects.push({kind:'joy-heart',owner:a.i,x,y:a.y,face:Math.sign(b.x-x)||a.face,time:0,hit:false});
      }
      if (a.kind!==11 && distance>0 && !a.chargedHit && Math.abs(a.x-b.x)<110 && b.y>ground-68) {
        const landed=specialHit(a,b,a.kind===0 || a.kind===2 ? 1 : 2,a.kind===3 ? 24 : 22,425,.5);
        if((a.kind===0 || a.kind===2) && landed){b.tumble=.65;b.vy=-220;holdSpecial(a,1,'tumble');}
        a.chargedHit = true;
      }
    } else if (!a.stun && !a.guardBreak) {
      moveFighter(a,b,keys,dt);
      if (a.frenzy && !isDefending(a) && Math.abs(a.x-b.x)<100 && Math.abs(a.y-b.y)<75 && !a.cool[0] && !a.action && !a.recovery) {
        a.label='ATAQUE';
        a.action=.30;
        a.cool[0]=.72;
        a.recovery=.68;
        playClip('punch');
        specialHit(a,b,1,6,190,.18);
      }
    }
    applyMomentum(a,dt);
  }
  updateEffects(dt);
  advanceSpecialCooldowns(dt);
  const [a,b] = fighters;
  if (!time || !a.hp || !b.hp) {
    phase = 'end';
    if(cpu.active && !online) resetCPU();
    const pedro = fighters.filter(fighter => fighter.kind === 0);
    if (pedro.length === 1 && a.hp !== b.hp) {
      if (pedro[0].hp > fighters[1-pedro[0].i].hp) {
        showMayconReaction(true);
      } else {
        waitingForPedro = true;
        if (pedro[0].hp || clips.pedroDeath.paused) playClip('pedroDeath');
        if (clips.pedroDeath.error) finishPedroLine();
      }
    }
    banner = a.hp === b.hp ? 'Empate!' : (a.hp>b.hp ? a.name : b.name)+' venceu!';
    document.querySelector('#rematch').textContent = 'Jogar revanche';
  }
}

function moveClone(a,pressed,dt) {
  const direction=Number(pressed.has(a.keys[1]))-Number(pressed.has(a.keys[0]));
  a.cloneX=Math.max(55,Math.min(905,a.cloneX+direction*270*dt));
}
function throwPillow(a,b) {
  a.cool[0]=.72;
  a.cloneAction=.26;
  playClip('punch');
  effects.push({kind:'pillow',owner:a.i,x:a.cloneX,y:ground,
    face:Math.sign(b.x-a.cloneX)||a.face,time:0,hit:false});
}
const printedItems=['Faca','Espada','3 Oitão'];
function printTier(hp) { return hp<=40 ? 2 : hp<=70 ? 1 : 0; }
function updateMigraine(a,b,dt) {
  if (!a.migraineTicks || !a.hp) return;
  a.migraineClock-=dt;
  if (a.migraineClock>1e-8) return;
  const escalation=Math.floor((6-a.migraineTicks)/2);
  a.migrainePulse=.27;
  a.migraineTicks--;
  a.migraineClock+=1;
  if (Math.abs(a.x-b.x)<=390 && Math.abs(a.y-b.y)<120) {
    if(!guardBlocks(b))damageFighter(b,1+a.migraineLevel+escalation);
  }
}
function happiness(a,b) {
  if (a.kind!==11) return 0;
  const lead=a.hp-b.hp;
  return lead>=42 ? 3 : lead>=26 ? 2 : lead>=12 ? 1 : 0;
}
function updateJoy(a,b,dt) {
  if (a.kind!==11 || !a.hp) return;
  a.joyClock=Math.max(0,a.joyClock-dt);
  const level=happiness(a,b);
  if (level && !a.joyClock && Math.abs(a.x-b.x)<105 && Math.abs(a.y-b.y)<72 && b.hp) {
    if(!guardBlocks(b,10))damageFighter(b,level);
    a.joyClock=1;
  }
}
function techPosition(effect,time=effect.time) {
  if (effect.kind==='tablet-ship') return {x:effect.x+effect.face*640*time,y:104};
  if (effect.kind==='tablet') return {x:effect.x,y:effect.y+385*time};
  const t=Math.max(0,time-.16);
  return {x:effect.x+effect.face*(31+660*t),y:effect.y-105-245*t+360*t*t};
}
function updateTechEffect(effect,attacker,target,dt) {
  if (effect.kind==='tablet-ship') {
    const interval=effect.powered ? .18 : .29;
    while(effect.time>=effect.nextDrop && effect.nextDrop<1.55) {
      if(effect.nextDrop===.23)combatCue('energy_release');
      combatCue('projectile');
      const {x,y}=techPosition(effect,effect.nextDrop);
      effects.push({kind:'tablet',owner:effect.owner,x,y,time:0,hit:false,powered:effect.powered});
      effect.nextDrop+=interval;
    }
    return true;
  }
  if (effect.kind==='tablet-blast') return true;
  if (effect.kind==='tablet') {
    if (effect.hit) return true;
    const {x,y}=techPosition(effect);
    if (target.hp && Math.abs(target.x-x)<39 && y>=target.y-139 && y<=target.y+4) {
      effectHit(effect,{...attacker,face:Math.sign(target.x-attacker.x)||attacker.face},target,effect.powered ? 9 : 6,115,.14);
      effect.hit=true;
    }
    if (y>=ground) effect.hit=true;
    if(effect.hit)effects.push({kind:'tablet-pixels',owner:effect.owner,x,y:Math.min(ground,y),time:0});
    return true;
  }
  if (effect.kind!=='battery') return false;
  if (effect.hit || effect.time<.16) return true;
  const now=techPosition(effect),before=techPosition(effect,effect.time-dt);
  const tablet=effects.find(item=>{
    if (item.kind!=='tablet' || item.hit || item.owner!==effect.owner) return false;
    const pos=techPosition(item);
    return pos.x>=Math.min(before.x,now.x)-30 && pos.x<=Math.max(before.x,now.x)+30 &&
      Math.abs(pos.y-now.y)<42;
  });
  const landed=now.y>=ground;
  const body=target.hp && target.x>=Math.min(before.x,now.x)-34 &&
    target.x<=Math.max(before.x,now.x)+34 && now.y>=target.y-160 && now.y<=target.y+4;
  if (tablet || landed || body) {
    if (tablet) tablet.hit=true;
    effect.hit=true;
    const point=tablet ? techPosition(tablet) : now;
    const powered=effect.powered || tablet?.powered;
    const radius=tablet ? (powered ? 155 : 124) : (powered ? 88 : 65);
    const blast={kind:'tablet-blast',owner:effect.owner,x:point.x,y:Math.min(ground,point.y),
      time:0,radius,combo:Boolean(tablet)};
    effects.push(blast);
    combatCue('generic_explosion');
    if (target.hp && (body || Math.hypot(target.x-blast.x,target.y-75-blast.y)<=radius)) {
      effectHit(blast,{...attacker,face:effect.face},target,tablet ? (powered ? 29 : 24) : (powered ? 18 : 15),350,.38);
    }
  }
  return true;
}
function effectPosition(effect) {
  if (effect.kind==='joy-heart') {
    const age=Math.max(0,effect.time-(effect.slot===1 ? .17 : 0));
    return effect.x+effect.face*(27+(effect.slot===1 ? 620 : 520)*age);
  }
  if (effect.kind==='lucreci-money') return effect.x+effect.face*(54+Math.max(0,effect.time-.18)*760);
  if (effect.kind==='printed-shot') return effect.x+effect.face*(61+effect.time*980);
  if (effect.kind==='physio') return effect.x+effect.face*(67+Math.max(0,effect.time-.43)*890);
  if (effect.kind==='cheese') return Math.max(80,Math.min(880,effect.x+effect.face*149));
  if (effect.kind==='pillow') return effect.x+effect.face*(38+620*effect.time);
  if (effect.kind==='toscana') return effect.x+effect.face*(48+Math.min(1,Math.max(0,(effect.time-.12)/.24))*257);
  if (effect.kind==='guinea-fowl') return effect.x+effect.face*(48+Math.max(0,effect.time-.14)*550);
  if (effect.kind==='gas') return effect.x+effect.face*(36+Math.min(effect.time,.80)*205);
  if (effect.kind==='chocolate') {
    return effect.x+effect.face*(38+660*Math.max(0,effect.time-.17));
  }
  return effect.x+effect.face*(68+490*Math.max(0,effect.time-.40));
}
function oldTimeForFoon(effect,dt){return Math.max(0,effect.time-dt);}
const visualEffectDuration={'victim-impact':.48,'charge-dust':.83,'tablet-pixels':.82,'toscana-crumbs':.78,'heart-burst':.48,'basic-impact':.21};
const rescueEnd=1.52;
function updateEffects(dt) {
  for (const effect of effects) {
    if(visualEffectDuration[effect.kind]){effect.time+=dt;continue;}
    const previousTime=effect.time;
    const old=effectPosition(effect);
    effect.time+=dt;
    if(effect.kind==='money-truck'){
      const a=fighters[effect.owner],b=fighters[1-effect.owner];
      if(!effect.hit && effect.time>=.70 && effect.time<1.25 && b.hp && Math.abs(b.x-effect.x)<90 && b.y>ground-220){
        if(specialHit({...a,face:effect.face},b,2,20,80,.8))holdSpecial(a,2,'stun');
        effect.hit=true;
      }
      continue;
    }
    if(effect.kind==='down-hearts')continue;
    if(effect.kind==='strawberry-spit'){
      const a=fighters[effect.owner],b=fighters[1-effect.owner];
      if(effect.time<.25)continue;
      if(!effect.released){effect.released=true;effect.x=a.x;effect.y=a.y;effect.face=a.face;}
      const oldX=effect.x+effect.face*(43+Math.max(0,effect.time-dt-.25)*640);
      const x=effect.x+effect.face*(43+Math.max(0,effect.time-.25)*640);
      if(!effect.hit && b.hp && b.x>=Math.min(oldX,x)-25 && b.x<=Math.max(oldX,x)+25 && Math.abs(b.y-effect.y)<80){
        if(specialHit({...a,face:effect.face},b,2,14,0,.5)){
          b.frozen=.5;b.stun=Math.max(b.stun,.5);b.charge=0;b.action=0;b.vx=b.vy=0;holdSpecial(a,2,'frozen');
          a.affection=3;
        }
        effect.hit=true;
      }
      continue;
    }
    if(effect.kind==='foon-wave'){
      const attacker=fighters[effect.owner],target=fighters[1-effect.owner];
      const previous=effect.x+effect.face*(35+oldTimeForFoon(effect,dt)*600);
      const x=effect.x+effect.face*(35+effect.time*600);
      if(!effect.hit && target.hp && target.x>=Math.min(previous,x)-30 && target.x<=Math.max(previous,x)+30 && Math.abs(target.y-effect.y)<85){
        if(specialHit({...attacker,face:effect.face},target,2,12,140,.35))target.deaf=2.5;
        effect.hit=true;
      }
      continue;
    }
    const attacker=fighters[effect.owner], target=fighters[1-effect.owner];
    if (updateTechEffect(effect,attacker,target,dt)) continue;
    if(effect.kind==='dedew-quake') continue;
    if(effect.kind==='dedew-coffee'){
      const distance=(target.x-effect.x)*effect.face;
      if(!effect.hit && effect.time>=.22 && target.hp && distance>=20 && distance<=305 && Math.abs(target.y-effect.y)<95){
        const guarded=isDefending(target);
        effectHit(effect,{...attacker,face:effect.face},target,14,190,.25);
        if(!guarded){target.coffeeBurn=5;target.coffeeClock=.5;holdSpecial(attacker,1,'coffeeBurn');}
        effect.hit=true;
      }
      continue;
    }
    if (effect.kind==='joy-heart') {
      const x=effectPosition(effect);
      const direct=effect.slot===1;
      if(direct && previousTime<.17 && effect.time>=.17){
        combatCue('energy_release');
        combatCue('projectile');
      }
      if (!effect.hit && (!direct || effect.time>=.17) && target.hp && Math.abs(target.y-effect.y)<82 &&
          target.x>=Math.min(old,x)-34 && target.x<=Math.max(old,x)+34) {
        effectHit(effect,{...attacker,face:effect.face},target,direct ? 14 : 19,direct ? -260 : 290,direct ? .25 : .32);
        effect.hit=true;
        effects.push({kind:'heart-burst',owner:effect.owner,x:target.x,y:target.y-105,face:effect.face,time:0});
      }
      continue;
    }
    if (effect.kind==='print') {
      if (!effect.hit && effect.time>=.52) {
        if (attacker.hp) {
          attacker.printedTier=effect.tier;
          playClip('matheusItem');
        }
        effect.hit=true;
      }
      continue;
    }
    if (effect.kind==='printed-shot') {
      const x=effectPosition(effect);
      if (!effect.hit && target.hp && Math.abs(target.y-effect.y)<85 &&
          target.x>=Math.min(old,x)-25 && target.x<=Math.max(old,x)+25) {
        effectHit(effect,{...attacker,face:effect.face},target,28,285,.33);
        effect.hit=true;
      }
      continue;
    }
    if (effect.kind==='lucreci-fire') {
      const distance=(target.x-effect.x)*effect.face;
      if (!effect.hit && effect.time>=.20 && target.hp && distance>=38 && distance<=300 && Math.abs(target.y-effect.y)<165) {
        effectHit(effect,{...attacker,face:effect.face},target,18,200,.38);
        effect.hit=true;
      }
      continue;
    }
    if (effect.kind==='lucreci-money') {
      const x=effectPosition(effect);
      const distance=(target.x-effect.x)*effect.face;
      const before=(old-effect.x)*effect.face;
      const now=(x-effect.x)*effect.face;
      if (!effect.hit && effect.time>=.20 && target.hp && distance>=before-34 && distance<=now+34 && Math.abs(target.y-effect.y)<165) {
        effectHit(effect,{...attacker,face:effect.face},target,20,285,.34);
        effect.hit=true;
        effect.impact=target.x;
      }
      continue;
    }
    if (effect.kind==='physio') {
      const x=effectPosition(effect);
      if (!effect.hit && effect.time>=.43 && target.hp &&
          target.x>=Math.min(old,x)-34 && target.x<=Math.max(old,x)+34 &&
          Math.abs(target.y-ground)<85) {
        effectHit(effect,{...attacker,face:effect.face},target,19,300,.34);
        effect.hit=true;
      }
      continue;
    }
    if (effect.kind==='cheese') {
      const x=effectPosition(effect);
      const gap=(target.x-effect.x)*effect.face;
      if (!effect.direct && effect.time>=.24 && effect.time<.42 &&
          gap>=25 && gap<=190 && Math.abs(target.y-effect.y)<71) {
        effectHit(effect,{...attacker,face:effect.face},target,10,100,.18);
        effect.direct=true;
      }
      if (!effect.hit && effect.time>=.42 && target.hp &&
          Math.abs(target.x-x)<66 && target.y>=ground-4) {
        if(effectHit(effect,{...attacker,face:effect.face},target,12,360,.50,true)){
          target.tumble=.53;holdSpecial(attacker,2,'tumble');target.vy=-135;
        }
        effect.hit=true;
      }
      continue;
    }
    if (effect.kind==='blanket') {
      if (effect.time>=.34 && effect.throwX===undefined) {
        effect.throwX=attacker.x;
        effect.throwY=attacker.y;
      }
      target.blanket=effect.time>=.64 && effect.time<2.14;
      if (!effect.hit && effect.time>=2.10) {
        effect.hit=true;
        effectHit(effect,attacker,target,16,0,.12,true,true);
        attacker.cool[0]=0;
      }
      continue;
    }
    if (effect.kind==='pillow') {
      const x=effectPosition(effect);
      if (!effect.hit && target.hp && target.x>=Math.min(old,x)-36 && target.x<=Math.max(old,x)+36 && Math.abs(target.y-effect.y)<84) {
        effectHit(effect,{...attacker,face:effect.face},target,8,160,.12);
        effect.hit=true;
      }
      continue;
    }
    if (effect.kind==='toscana' || effect.kind==='guinea-fowl') {
      const trap=effect.kind==='guinea-fowl';
      const x=effectPosition(effect), reach=trap ? 51 : 36;
      if (effect.hit || effect.time<.16 || !target.hp ||
          target.x<Math.min(old,x)-reach || target.x>Math.max(old,x)+reach ||
          Math.abs(target.y-(trap ? ground : effect.y))>(trap ? 59 : 83)) continue;
      effect.hit=true;
      effect.impact=x;
      if (trap) {
        if(!effectHit(effect,attacker,target,12,0,0))continue;
        target.snare=1;
        holdSpecial(attacker,2,'snare');
        target.charge=0;
        target.vx=target.vy=0;
        target.y=ground;
      } else {
        effects.push({kind:'toscana-crumbs',owner:effect.owner,x:target.x,y:target.y-100,face:effect.face,time:0});
        if(!effectHit(effect,{...attacker,face:effect.face},target,21,360,.70,true))continue;
        target.charge=0;
        target.tumble=.68;
        holdSpecial(attacker,1,'tumble');
        target.vy=-185;
      }
      continue;
    }
    if (effect.kind==='gas') {
      const radius=35+Math.min(effect.time,.75)*69;
      if (!effect.hit && effect.time>.12 && target.hp && Math.abs(target.x-effectPosition(effect))<=radius && Math.abs(target.y-effect.y)<84) {
        effect.hit=true;
        if(guardBlocks(target))continue;
        if (!target.infectionTicks) target.infectionClock=.28;
        target.infectionTicks=4;
        holdSpecial(attacker,1,'infectionTicks');
        effect.hit=true;
      }
      continue;
    }
    if (effect.kind==='teleport') {
      if (!effect.hit && effect.time>=.20) {
        effect.hit=true;
        if (!attacker.hp || !target.hp || attacker.stun) continue;
        if(guardBlocks(target))continue;
        const back=-target.face;
        const min=55,max=905,gap=58;
        target.x=Math.max(back<0 ? min+gap : min,Math.min(back>0 ? max-gap : max,target.x));
        attacker.x=target.x+back*gap;
        attacker.face=-back;
        attacker.y=target.y;
        attacker.vx=attacker.vy=0;
        attacker.warp++;
        attacker.action=.28;
        effect.destination=attacker.x;
        effect.destY=attacker.y;
        effectHit(effect,attacker,target,18,240,.42,true);
      }
      continue;
    }
    const rescue=effect.kind==='rescue';
    if (effect.hit || effect.time<(rescue ? .40 : .17)) continue;
    const x=effectPosition(effect);
    const reach=rescue ? 57 : 29;
    const height=rescue ? ground : effect.y;
    if (target.x<Math.min(old,x)-reach || target.x>Math.max(old,x)+reach || Math.abs(target.y-height)>(rescue ? 87 : 65)) continue;
    effectHit(effect,{...attacker,face:effect.face},target,rescue ? 23 : 16,rescue ? 380 : 265,.40);
    effect.hit=true;
    effect.impact=x;
    if(!rescue)effect.time=.92;
  }
  const duration={'money-truck':1.55,'strawberry-spit':.85,'down-hearts':.85,'foon-wave':.65,'dedew-coffee':.85,'dedew-quake':.46,rescue:1.15,chocolate:1.05,gas:1.30,teleport:.49,toscana:.56,'guinea-fowl':.94,blanket:2.16,pillow:.85,physio:1.03,cheese:3.4,print:.70,'printed-shot':.65,'joy-heart':.47,'tablet-ship':1.74,tablet:1,battery:1.30,'tablet-blast':.37,'lucreci-fire':.82,'lucreci-money':1.02};
  effects=effects.filter(effect=>effect.time<(visualEffectDuration[effect.kind] ??
    (effect.kind==='rescue' ? rescueEnd :
      effect.kind==='joy-heart' && effect.slot===1 ? .64 : duration[effect.kind])) &&
    !((effect.kind==='tablet' || effect.kind==='battery') && effect.hit));
}

function drawEffectSprite(image,x,y,width,face) {
  if (!image.complete || !image.naturalWidth) return;
  const height=width*image.naturalHeight/image.naturalWidth;
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(face,1);
  ctx.drawImage(image,-width/2,-height,width,height);
  ctx.restore();
}
function drawGuineaFowl(x,y,face,step,trapped=false) {
  for (let i=0;i<3;i++) {
    const index=(Math.floor(step*15)+i)%2;
    const bird=readyImage(guineaFowlHD[index]) ? guineaFowlHD[index] : guineaFowl[index];
    const angle=step*10+i*Math.PI*2/3;
    const offset=trapped ? Math.cos(angle)*53 : face*(i-1)*37;
    const direction=trapped ? Math.sign(-Math.sin(angle)) || face : face;
    drawEffectSprite(bird,x+offset,y+Math.sin(angle)*(trapped ? 9 : 5),trapped ? 76 : 69,direction);
  }
}

function drawFlyingBlanket(effect,target) {
  const progress=Math.min(1,(effect.time-.34)/.30);
  const x=effect.throwX+(target.x-effect.throwX)*progress;
  const y=effect.throwY-94+(target.y-effect.throwY+72)*progress-Math.sin(Math.PI*progress)*59;
  const width=35+progress*80;
  ctx.save();
  ctx.translate(x,y);
  ctx.rotate((1-progress)*effect.face*-.47);
  if(readyImage(flyingBlanketHD)){
    const height=width*flyingBlanketHD.naturalHeight/flyingBlanketHD.naturalWidth;
    ctx.drawImage(flyingBlanketHD,-width/2,-height/2,width,height);
    ctx.restore();
    return;
  }
  const wave=Math.sin(progress*13)*9*(1-progress);
  ctx.beginPath();
  ctx.moveTo(-width/2,-14);
  ctx.quadraticCurveTo(0,-29-wave,width/2,-14);
  ctx.lineTo(width/2-4,15);
  ctx.quadraticCurveTo(0,8+wave,-width/2,16);
  ctx.closePath();
  ctx.fillStyle='#375ab5';
  ctx.fill();
  ctx.strokeStyle='#c6b1fb';
  ctx.lineWidth=2;
  ctx.stroke();
  text('✦',-width*.23,3,13,'#ffd86a');
  text('✦',width*.18,7,14,'#ffd86a');
  ctx.restore();
}

function drawSleepLetters(a) {
  const t=(last ?? 0)/1000;
  for (let i=0;i<3;i++) {
    const progress=(t*.75+i/3)%1;
    ctx.save();
    ctx.globalAlpha=.40+.60*Math.sin(Math.PI*progress);
    const x=a.x+16+i*12+progress*12,y=a.y-64-i*9-progress*32;
    text('Z',x+2,y+2,16+i*4,'#302040');
    text('Z',x,y,16+i*4,'#f3d7ff');
    ctx.restore();
  }
}

function drawPrinter(effect) {
  const x=effect.x+effect.face*68,y=effect.y-7;
  const progress=Math.min(1,effect.time/.52);
  ctx.save();ctx.translate(x,y);ctx.scale(effect.face,1);
  rect(-42,-77,84,77,'#15172b');
  rect(-35,-68,70,53,'#1b4354');
  rect(-28,-64,56,47,'#142635');
  rect(-32,-22,64,5,'#6ebda5');
  rect(-36,-8,72,5,'#4b6172');
  rect(-33,-68,66,3,'#8cecd5');
  const nozzleX=Math.sin(progress*20)*21;
  rect(nozzleX-5,-57,10,10,'#b5ebe6');
  rect(nozzleX-1,-47,2,21,'#7fffca');
  const item=printedItemSprites[effect.tier];
  if (item.complete && item.naturalWidth) {
    const width=40,height=width*item.naturalHeight/item.naturalWidth;
    ctx.save();
    ctx.beginPath();ctx.rect(-22,-22-height*progress,44,height*progress);ctx.clip();
    ctx.drawImage(item,-width/2,-22-height,width,height);
    ctx.restore();
  }
  ctx.restore();
  text(printedItems[effect.tier],x,y-88,15,'#cfffe8');
}

function drawPrintedItem(a) {
  const tier=a.printedTier;
  const item=printedItemSprites[tier];
  if (!item.complete || !item.naturalWidth) return;
  const attacking=a.action>0 && a.label===printedItems[tier].toUpperCase();
  const width=[51,83,54][tier],height=width*item.naturalHeight/item.naturalWidth;
  ctx.save();
  ctx.translate(a.x+a.face*(attacking ? 54 : 27),a.y-(attacking ? 90 : 74));
  ctx.scale(a.face,1);
  if (tier!==2) ctx.rotate(attacking ? .53 : -.17);
  else if (!attacking) ctx.rotate(.20);
  ctx.drawImage(item,-width*(tier===2 ? .22 : .18),-height*(tier===2 ? .53 : .81),width,height);
  if (tier===2 && attacking && a.action>.32) text('✦',width*.86,-4,22,'#ffdc78');
  ctx.restore();
}

function drawGrowingHead(sprite,a,width,height,offset) {
  const elapsed=6-a.migraineTicks+1-a.migraineClock;
  const target=a.hp && a.migraineTicks
    ? Math.min(1,Math.max(0,elapsed)/6)*(.56+a.migraineLevel*.11)
    : 0;
  const growth=visibleHeadGrowth[a.i]+(target-visibleHeadGrowth[a.i])*.16;
  visibleHeadGrowth[a.i]=growth;
  const top=-height-offset;
  if (growth<.003) {
    ctx.drawImage(sprite,-width/2,top,width,height);
    return;
  }

  // Widen the head at the top and taper the distortion into the original neck.
  const sw=sprite.naturalWidth,sh=sprite.naturalHeight;
  const neck=Math.ceil(sh*.37);
  const stretch=height*.26*growth;
  const taper=y=>Math.max(0,1-y/neck);
  const projected=y=>top+y/sh*height-stretch*taper(y)**2;
  for (let y=0;y<neck;y+=2) {
    const next=Math.min(neck,y+2);
    const bandWidth=width*(1+growth*taper(y)**.65);
    ctx.drawImage(sprite,0,y,sw,next-y,-bandWidth/2,projected(y),
      bandWidth,projected(next)-projected(y)+.35);
  }
  const body=height*(1-neck/sh);
  ctx.drawImage(sprite,0,neck,sw,sh-neck,-width/2,-offset-body,width,body);
  if (growth>.04 && (a.migraineTicks || a.migrainePulse)) {
    const pulse=Math.max(0,a.migrainePulse/.27);
    ctx.save();
    ctx.translate(width*.055,projected(sh*.125));
    ctx.scale(1+growth*.50,1+growth*.36);
    ctx.lineCap='round';
    ctx.lineJoin='round';
    ctx.globalAlpha=Math.min(1,.36+growth*.9+pulse*.35);
    ctx.shadowColor='#8cff43';
    ctx.shadowBlur=2+pulse*6;
    ctx.strokeStyle=pulse>.35 ? '#b6ff52' : '#54e653';
    ctx.lineWidth=1.4+pulse*.9;
    ctx.beginPath();
    ctx.moveTo(-10,6);ctx.lineTo(-7,0);ctx.lineTo(-10,-4);ctx.lineTo(-7,-9);
    ctx.moveTo(-7,0);ctx.lineTo(-2,-3);ctx.lineTo(0,-8);
    ctx.moveTo(11,7);ctx.lineTo(8,2);ctx.lineTo(11,-2);ctx.lineTo(8,-7);
    ctx.moveTo(8,2);ctx.lineTo(3,0);ctx.lineTo(1,-4);
    ctx.stroke();
    ctx.restore();
  }
}

function drawMigraine(a) {
  const x=a.x,y=a.y-129-visibleHeadGrowth[a.i]*28;
  if (a.migrainePulse>0) {
    const rival=fighters[1-a.i];
    const direction=Math.sign(rival.x-a.x)||a.face;
    const progress=1-a.migrainePulse/.27;
    for (let i=0;i<5;i++) {
      oval(x+direction*(20+progress*(60+i*19)),y+Math.sin(i*4)*17+progress*19,3+i%2,3,'#e33859');
    }
  }
}
function drawTechEffect(effect) {
  if (effect.kind==='tablet-blast') {
    const progress=effect.time/.37;
    const radius=effect.radius*(.28+progress*.72);
    ctx.save();
    ctx.globalAlpha=Math.max(0,1-progress);
    oval(effect.x,effect.y,radius,radius*.73,'#ffae45');
    oval(effect.x,effect.y,radius*.66,radius*.47,'#fff1a9');
    for (let i=0;i<12;i++) {
      const angle=i*Math.PI/6;
      const x=effect.x+Math.cos(angle)*radius*(1+progress*.4);
      const y=effect.y+Math.sin(angle)*radius*.76;
      rect(x,y,5+i%3,5+i%3,i%2 ? '#ffc459' : '#72e9ff');
    }
    if (effect.combo) text('COMBO TECH!',effect.x,effect.y-50,23,'#67eaff');
    ctx.restore();
    return true;
  }
  if (effect.kind==='tablet-ship') {
    const {x,y}=techPosition(effect);
    ctx.save();
    ctx.globalCompositeOperation='screen';
    const beam=ctx.createLinearGradient(x,y,x,y+240);
    beam.addColorStop(0,'#38dfffad');
    beam.addColorStop(1,'#387bff00');
    ctx.fillStyle=beam;
    ctx.beginPath();ctx.moveTo(x-15,y);ctx.lineTo(x+15,y);
    ctx.lineTo(x+66,y+240);ctx.lineTo(x-66,y+240);ctx.closePath();ctx.fill();
    ctx.restore();
    drawEffectSprite(powerSprite('tablet-ship',tabletShip),x,y+25,190,effect.face);
    return true;
  }
  if (effect.kind!=='tablet' && effect.kind!=='battery') return false;
  if (effect.kind==='battery' && effect.time<.16) return true;
  const {x,y}=techPosition(effect);
  const tablet=effect.kind==='tablet';
  ctx.save();
  for (let i=1;i<=4;i++) {
    ctx.globalAlpha=(5-i)*.13;
    const old=techPosition(effect,Math.max(0,effect.time-i*.033));
    if(tablet){
      ctx.globalAlpha=(5-i)*.20;
      for(let j=0;j<4;j++){
        const dx=(j-1.5)*(9+i*4)+Math.sin(j+i)*4;
        const dy=-i*15-j*3;
        rect(old.x+dx,old.y+dy,9-i,9-i,j%2 ? '#d6b5ff' : '#65f8ff');
        rect(old.x+dx+1,old.y+dy+1,3,3,'#fffaff');
      }
    }else oval(old.x,old.y,12-i,3,'#fef294');
  }
  ctx.globalAlpha=1;
  ctx.translate(x,y);ctx.rotate(effect.time*(tablet ? 2.8 : 8));
  rect(-13,-9,26,18,tablet ? '#67deff' : '#ffda6d');
  rect(-11,-7,22,14,'#142941');
  if (tablet) rect(-8,-5,16,10,'#3daacf');
  else text('ϟ',0,6,17,'#fff18f');
  ctx.restore();
  return true;
}
function drawLucreciFire(effect) {
  const spread=Math.min(1,Math.max(0,(effect.time-.18)/.30));
  if (spread<=0) return;
  const reach=72+spread*190;
  ctx.save();
  ctx.translate(effect.x+effect.face*18,effect.y-163);
  ctx.scale(effect.face,1);
  ctx.globalAlpha=Math.min(1,(effect.time-.16)*6,(.82-effect.time)*3.4);
  const outer=ctx.createLinearGradient(20,0,reach,0);
  outer.addColorStop(0,'#ff321f');outer.addColorStop(.42,'#ff7a1d');outer.addColorStop(.82,'#ffd43e');outer.addColorStop(1,'#fff0a0');
  ctx.fillStyle=outer;
  ctx.beginPath();
  ctx.moveTo(18,-12);
  ctx.quadraticCurveTo(52,-43,reach*.45,-17);
  ctx.quadraticCurveTo(reach*.76,-44,reach,0);
  ctx.quadraticCurveTo(reach*.74,13,reach*.95,31);
  ctx.quadraticCurveTo(reach*.55,17,reach*.32,35);
  ctx.quadraticCurveTo(52,20,18,10);
  ctx.closePath();ctx.fill();
  ctx.fillStyle='#fff2a0';
  ctx.beginPath();ctx.moveTo(22,-6);ctx.quadraticCurveTo(reach*.50,-18,reach*.78,1);
  ctx.quadraticCurveTo(reach*.48,5,reach*.31,12);ctx.quadraticCurveTo(48,8,22,5);ctx.closePath();ctx.fill();
  for(let i=0;i<6;i++){
    const x=35+((i*47+effect.time*390)%Math.max(50,reach-25));
    const y=Math.sin(effect.time*18+i*2.1)*15;
    oval(x,y,3+i%3,2+i%2,i%2?'#fff5a2':'#ff5227');
  }
  ctx.restore();
}

function drawLucreciMoney(effect) {
  if (effect.time<.18) return;
  for(let i=0;i<18;i++){
    const age=effect.time-.18-i*.015;
    if(age<0)continue;
    const travel=age*(520+i*21);
    const x=effect.x+effect.face*(52+travel);
    const y=effect.y-144+Math.sin(age*13+i*1.8)*Math.min(27,age*150)-(i%4)*age*28+age*age*80;
    ctx.save();ctx.translate(x,y);ctx.scale(effect.face,1);
    ctx.rotate((i%2 ? 1 : -1)*age*(3+i*.25));
    ctx.globalAlpha=Math.min(1,(1.02-effect.time)*4);
    ctx.fillStyle=i%2?'#78d786':'#b8e98a';ctx.strokeStyle='#f0edba';ctx.lineWidth=1.5;
    ctx.fillRect(-12,-7,24,14);ctx.strokeRect(-12,-7,24,14);
    ctx.strokeStyle='#3b9861';ctx.strokeRect(-9,-4,18,8);
    ctx.fillStyle='#2c9166';ctx.font='700 8px Barlow, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('R$',0,0);
    ctx.restore();
  }
}

function drawDedewCoffee(effect) {
  if(effect.time<.18) return;
  const length=70+Math.min(1,(effect.time-.18)/.25)*225;
  ctx.save();ctx.translate(effect.x+effect.face*55,effect.y-95);ctx.scale(effect.face,1);
  ctx.globalAlpha=Math.max(0,Math.min(1,(effect.time-.18)*8,(.85-effect.time)*4));
  for(let i=0;i<16;i++){
    const p=((effect.time*3+i/16)%1),x=p*length,y=Math.sin(i*4+effect.time*13)*p*16+p*p*20;
    ctx.strokeStyle=i%3===0?'#ffb558':'#743619';ctx.lineWidth=4-i%3;
    ctx.beginPath();ctx.moveTo(Math.max(0,x-30),y);ctx.lineTo(x,y+3);ctx.stroke();
    oval(x,y,4,2,'#d97b2e');
  }
  for(let i=0;i<4;i++){
    ctx.strokeStyle='#f8dfbf88';ctx.lineWidth=2;ctx.beginPath();
    ctx.moveTo(65+i*52,-15);ctx.quadraticCurveTo(47+i*52,-30,72+i*52,-46-Math.sin(effect.time*12+i)*9);ctx.stroke();
  }
  ctx.restore();
}
function drawDedewQuake(effect){
  const p=effect.time/.46;
  ctx.save();ctx.globalAlpha=1-p;ctx.strokeStyle='#ffc477';ctx.lineWidth=3*(1-p)+1;
  ctx.beginPath();ctx.ellipse(effect.x,ground+7,24+p*138,5+p*18,0,0,Math.PI*2);ctx.stroke();
  for(let i=0;i<7;i++){
    const x=effect.x+(i-3)*(14+p*13);ctx.beginPath();ctx.moveTo(x,ground+7);
    ctx.lineTo(x+10,ground-6-p*12);ctx.lineTo(x+6,ground+3);ctx.stroke();
  }
  ctx.restore();
}
function drawDownHearts(x,y,clock){
 for(let i=0;i<6;i++){const angle=i*Math.PI/3+clock*2;const radius=35+i%2*12;text('♥',x+Math.cos(angle)*radius,y-70+Math.sin(angle)*24-clock*8,16+i%2*6,'#ff80bd');}
}
function drawDownStatuses(a){
 if(a.kind===1 && (a.affection>0 || embrace?.a===a))drawDownHearts(a.x,a.y,(last||0)/1000%2);
 if(a.slow>0)text('LENTIDÃO',a.x,a.y+24,11,'#ffa4d0');
 if(a.frozen>0){
  ctx.save();ctx.fillStyle='#92e7ff55';ctx.strokeStyle='#b5f2ff';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(a.x-43,a.y);ctx.lineTo(a.x-52,a.y-99);ctx.lineTo(a.x-29,a.y-148);ctx.lineTo(a.x+19,a.y-164);ctx.lineTo(a.x+51,a.y-107);ctx.lineTo(a.x+43,a.y);ctx.closePath();ctx.fill();ctx.stroke();
  text('CONGELADO '+a.frozen.toFixed(1)+'s',a.x,a.y-178,11,'#b5f2ff');ctx.restore();
 }
}
function drawMoneyTruck(effect){
 const t=effect.time,progress=Math.min(1,t/.5),x=effect.x+effect.face*(-440+560*progress);
 const image=maykimTrucks[t<.55?0:1];
 if(image.complete && image.naturalWidth){ctx.save();ctx.translate(x,ground);ctx.scale(effect.face,1);ctx.drawImage(image,-384*.52,-720*.52,768*.52,768*.52);ctx.restore();}
 if(t<.70){oval(effect.x,ground+4,85,8,'#ffd15466');text('TIO PATINHAS',effect.x,ground-235,16,'#ffe29a');}
 if(t>=.55){
    for(let i=0;i<28;i++){
      const age=t-.55-i*.016;
      if(age<0)continue;
      const fall=Math.min(1,age*2.5);
      const cx=effect.x+Math.sin(i*9.3)*(25+fall*55),cy=ground-225+fall*fall*225;
      const spin=Math.cos(age*22+i);
      ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.sin(age*9+i)*.65);
      const coin=truckCoins[Math.abs(spin)<.24 ? 1 : 0];
      if(readyImage(coin)){
        const width=Math.abs(spin)<.24 ? 4 : 7+Math.abs(spin)*11;
        ctx.drawImage(coin,-width/2,-11,width,22);
      }else{
        oval(0,0,3+Math.abs(spin)*5,10,'#efaa36');
        oval(0,-1,2,5,'#fff5b1');
      }
      ctx.restore();
    }
 }
}
const impactThemes = {
  0:[['#f4ad68','dust'],['#cb8bff','wave']],
  1:[['#ff76be','heart'],['#b5edff','shard']],
  2:[['#ffbf76','dust'],['#ffdc66','coin']],
  4:[['#ff838e','cross'],['#ffbb7f','crumb']],
  5:[['#a9df52','gas'],['#d685ff','wave']],
  6:[['#ffb384','crumb'],['#f4f0db','feather']],
  7:[['#fb99e9','shard'],['#88f0a8','cross']],
  8:[['#d9b1ff','feather'],['#efe0ff','feather']],
  9:[['#ff7778','shard'],['#d9be58','gas']],
  10:[['#62eac8','pixel'],['#df95ff','wave']],
  11:[['#ff94bf','heart'],['#ffcae8','heart']],
  12:[['#65eeff','pixel'],['#92b7ff','shard']],
  13:[['#ff9248','shard'],['#a4e28e','note']],
  14:[['#f6b880','crumb'],['#ffdc94','dust']]
};
function drawImpactParticle(form,color,size) {
  ctx.fillStyle=color;
  if(form==='heart'){
    ctx.beginPath();ctx.moveTo(0,size);
    ctx.bezierCurveTo(-size*2,-size*.2,-size,-size*1.6,0,-size*.65);
    ctx.bezierCurveTo(size,-size*1.6,size*2,-size*.2,0,size);ctx.fill();
  }else if(form==='cross'){
    ctx.fillRect(-size,-size*.26,size*2,size*.52);
    ctx.fillRect(-size*.26,-size,size*.52,size*2);
  }else if(form==='pixel' || form==='note' || form==='crumb'){
    ctx.fillRect(-size,-size*.48,size*2,size*.96);
    if(form!=='pixel')rect(-size*.62,-size*.24,size*.8,size*.25,'#fff2b588');
  }else if(form==='wave'){
    ctx.beginPath();ctx.arc(0,0,size*1.8,-.7,.7);ctx.stroke();
  }else if(form==='shard' || form==='feather'){
    ctx.beginPath();ctx.moveTo(-size,0);ctx.lineTo(size*.6,-size*.45);
    ctx.lineTo(size,0);ctx.lineTo(size*.28,size*.5);ctx.closePath();ctx.fill();
  }else{
    oval(0,0,size,form==='coin' ? size*.75 : size*.52,color);
    if(form==='coin')oval(-size*.15,-size*.15,size*.5,size*.34,'#fff3af');
  }
}
const foregroundEffects=new Set(['tablet','tablet-pixels','toscana-crumbs','basic-impact']);
function drawEffects(layer) {
  for (const effect of effects) {
    if(effect.kind!=='rescue' && layer && foregroundEffects.has(effect.kind)!==(layer==='front'))continue;
    if(effect.kind==='basic-impact'){
      const progress=effect.time/visualEffectDuration[effect.kind];
      const rays=effect.heavy && !reduceMotion.matches ? 7 : 4;
      ctx.save();
      ctx.globalAlpha=(1-progress)*(reduceMotion.matches ? .50 : .90);
      ctx.translate(effect.x,effect.y);
      for(let i=0;i<rays;i++){
        ctx.rotate(2*Math.PI/rays);
        rect(7+progress*20, -1, (effect.heavy ? 17 : 10)*(1-progress), 2, i%2 ? '#ffba66' : '#fff3dc');
      }
      ctx.restore();
      continue;
    }
    if(effect.kind==='charge-dust'){
      const p=effect.time/visualEffectDuration[effect.kind];
      const dust=chargeDust[p>.24 ? 1 : 0];
      ctx.save();ctx.globalAlpha=(1-p)*.90;
      if(readyImage(dust))drawEffectSprite(dust,effect.x-effect.face*p*33,effect.y+12-p*14,139+p*60,effect.face);
      else oval(effect.x,effect.y+3,28+p*34,11+p*8,'#ffe3b5');
      ctx.restore();
      continue;
    }
    if(effect.kind==='tablet-pixels' || effect.kind==='toscana-crumbs' || effect.kind==='heart-burst'){
      const p=effect.time/visualEffectDuration[effect.kind];
      const digital=effect.kind==='tablet-pixels';
      const heart=effect.kind==='heart-burst';
      ctx.save();ctx.globalAlpha=1-p;
      for(let i=0;i<16;i++){
        const angle=i*2.39996;
        const reach=(16+p*(42+i%4*13));
        const x=effect.x+Math.cos(angle)*reach, y=effect.y+Math.sin(angle)*reach*.8+(digital || heart ? 0 : 32*p*p);
        ctx.save();ctx.translate(x,y);ctx.rotate(angle+p*3);
        const color=digital ? (i%2 ? '#64f8ff' : '#a1afff') : heart ? '#ff8ec7' : (i%2 ? '#cc7139' : '#ffe0a2');
        if(digital || !heart)ctx.shadowColor=color;
        ctx.shadowBlur=digital ? 7 : 0;
        drawImpactParticle(digital ? 'pixel' : heart ? 'heart' : 'crumb',color,digital ? 7+i%3 : 5+i%3);
        if(!heart)rect(-2,-2,3,3,digital ? '#efffff' : '#fff2c5');
        ctx.restore();
      }
      ctx.restore();
      continue;
    }
    if(effect.kind==='victim-impact'){
      const target=fighters[effect.target];
      if(!target)continue;
      const p=effect.time/.48;
      const [color,form]=impactThemes[effect.sourceKind]?.[effect.slot-1] || [characters[effect.sourceKind].color,'shard'];
      const x=target.x-effect.face*12,y=target.y-93;
      ctx.save();
      ctx.globalAlpha=(1-p)*.8;
      ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=12;
      ctx.lineWidth=3*(1-p)+1;
      for(let i=0;i<9;i++){
        const angle=i*Math.PI*2/9;
        const reach=22+p*(40+i%3*11);
        ctx.save();
        ctx.translate(x+Math.cos(angle)*reach,y+Math.sin(angle)*reach*.78);
        ctx.rotate(angle+i*p*.6);
        drawImpactParticle(form,color,(4+i%3)*(1-p*.53));
        ctx.restore();
      }
      ctx.restore();
      continue;
    }
    if(effect.kind==='money-truck'){drawMoneyTruck(effect);continue;}
    if(effect.kind==='down-hearts'){drawDownHearts(effect.x,effect.y,effect.time);continue;}
    if(effect.kind==='strawberry-spit'){
      const mouth = readyImage(downHDCast[1][1]) ? 69 : 43;
      const distance = 43+(effect.time-.25)*640;
      if (effect.time>=.25 && distance>=mouth && !effect.hit) {
        const x=effect.x+effect.face*distance;
        const tail=effect.x+effect.face*Math.max(mouth,distance-40);
        ctx.save();
        ctx.strokeStyle='#ff71b7';ctx.lineWidth=8;ctx.lineCap='round';
        ctx.shadowColor='#fc59af';ctx.shadowBlur=8;
        ctx.beginPath();ctx.moveTo(tail,effect.y-134);
        ctx.quadraticCurveTo((tail+x)/2,effect.y-140,x,effect.y-134);ctx.stroke();
        for(let i=0;i<4;i++)oval(effect.x+effect.face*Math.max(mouth,distance-i*12),effect.y-134+Math.sin(effect.time*30+i)*4,3,2,'#ffd2e8');
        ctx.restore();
      }
      continue;
    }
    if(effect.kind==='foon-wave'){
      ctx.save();ctx.translate(effect.x+effect.face*(35+effect.time*600),effect.y-75);ctx.scale(effect.face,1);
      ctx.lineCap='round';ctx.shadowColor='#b048ff';ctx.shadowBlur=15;ctx.globalAlpha=1-effect.time/.7;
      for(let i=0;i<4;i++){
        ctx.strokeStyle=i===0 ? '#fff2ff' : '#e693ff';ctx.lineWidth=5-i;
        ctx.beginPath();ctx.ellipse(-i*18,0,18+effect.time*18,31+effect.time*45,-.04,-1.48,1.48);ctx.stroke();
      }
      ctx.restore();continue;
    }
    if(effect.kind==='dedew-coffee'){drawDedewCoffee(effect);continue;}
    if(effect.kind==='dedew-quake'){drawDedewQuake(effect);continue;}
    if (drawTechEffect(effect)) continue;
    if (effect.kind==='lucreci-fire') { drawLucreciFire(effect); continue; }
    if (effect.kind==='lucreci-money') { drawLucreciMoney(effect); continue; }
    if (effect.kind==='joy-heart') {
      if (!effect.hit){
        const x=effectPosition(effect),y=effect.y-60;
        const prep=effect.slot===1 && effect.time<.17;
        if(readyImage(powerArt.heart)){
          for(let i=prep ? 0 : 2;i>=0;i--){
            ctx.save();ctx.globalAlpha=1-i*.35;
            drawEffectSprite(powerArt.heart,x-effect.face*i*17,y+i*2,(prep ? 24+effect.time*140 : 59)-i*14,effect.face);
            ctx.restore();
          }
        }else text('♥',x,y-14,47,'#ff63b4');
      }
      continue;
    }
    if (effect.kind==='print') { drawPrinter(effect); continue; }
    if (effect.kind==='printed-shot') {
      if (!effect.hit) {
        const x=effectPosition(effect), y=effect.y-155;
        oval(x-effect.face*12,y,20,2,'#ab90ffa8');
        oval(x,y,9,3,'#ffe08d');
        oval(x+effect.face*3,y-1,5,1,'#fff3c1');
      }
      continue;
    }
    if (effect.kind==='physio') {
      const x=effect.x+effect.face*72;
      if (effect.time<.25) {
        const t=effect.time/.25;
        ctx.save();ctx.translate(effect.x+effect.face*(24+t*48),effect.y-78+t*73);
        ctx.rotate(t*2*effect.face);rect(-18,-7,36,14,'#ec3348');ctx.restore();
      } else {
        const pose=effect.time<.43 ? 0 : 1;
        drawEffectSprite(readyImage(physio[pose]) ? physio[pose] : legacyPhysio[pose],x,ground+8,215,effect.face);
        if (!effect.hit && effect.time>=.43) {
          oval(effectPosition(effect),ground-83,13,4,'#ff5461');
          oval(effectPosition(effect)-effect.face*13,ground-84,7,2,'#ffd2bf');
        }
      }
      continue;
    }
    if (effect.kind==='cheese') {
      const x=effectPosition(effect);
      if (effect.time>=.24 && effect.time<.42) {
        const progress=Math.min(1,(effect.time-.24)/.16);
        const origin=effect.x+effect.face*35;
        for (let i=0;i<14;i++) {
          const f=(i/13)*progress;
          const dropX=origin+(x-origin)*f;
          const dropY=effect.y-126+f*f*126+Math.sin(i*2.4+effect.time*30)*4;
          oval(dropX,dropY,7+i*.25,4+i*.19,i%3===0 ? '#ae943c' : '#c8b053');
          if(i%2===0)oval(dropX-1,dropY-2,3,2,'#f4d884');
        }
      } else if (effect.time>=.42) {
        ctx.save();
        ctx.globalAlpha=Math.min(1,(3.4-effect.time)*2);
        oval(x,ground+5,69,11,'#877334');
        oval(x,ground+2,63,8,'#b8a04b');
        oval(x-11,ground-1,33,3,'#daca76');
        for(let i=0;i<8;i++)oval(x-52+i*15,ground+Math.sin(i*2.4)*4,3+i%3,2,i%2 ? '#efd580' : '#9d8944');
        ctx.restore();
      }
      continue;
    }
    if (effect.kind==='blanket') {
      if (effect.time<.34) text('Z z z',effect.x+effect.face*(46+effect.time*260),effect.y-132,24,'#e4b9ff');
      else if (effect.time<.64) drawFlyingBlanket(effect,fighters[1-effect.owner]);
      continue;
    }
    if (effect.kind==='pillow') {
      if (!effect.hit) {
        const x=effectPosition(effect),y=effect.y-86-Math.sin(effect.time*4)*20;
        ctx.save();ctx.translate(x,y);ctx.rotate(effect.time*3*effect.face);
        oval(0,0,23,14,'#b694df');oval(0,-2,20,11,'#fff0ff');
        ctx.restore();
      }
      continue;
    }
    if (effect.kind==='toscana') {
      if(effect.time<.12 || effect.hit)continue;
      const end=effect.impact ?? effectPosition(effect);
      const count=Math.max(2,Math.round(Math.abs(end-effect.x)/19));
      for (let i=0;i<count;i++) {
        const f=(i+1)/count,x=effect.x+(end-effect.x)*f;
        const y=effect.y-79-Math.sin(f*3.8+effect.time*9)*28;
        if(readyImage(powerArt.sausage)){
          ctx.save();ctx.translate(x,y);ctx.rotate(Math.cos(f*3.8+effect.time*9)*-.55*effect.face);
          drawEffectSprite(powerArt.sausage,0,8,32,effect.face);ctx.restore();
        }else{
          oval(x,y,13,8,'#612834');oval(x,y-1,11,6,'#cb6543');oval(x-2,y-4,7,2,'#ffb582');
        }
        if(i%2===0){
          const crumble=effect.time*29+i*1.7;
          ctx.save();ctx.translate(x-effect.face*14,y+13+Math.sin(crumble)*8);
          ctx.rotate(crumble);
          drawImpactParticle('crumb',i%4 ? '#e6a054' : '#ffe4a0',3+i%3);
          ctx.restore();
        }
      }
      continue;
    }
    if (effect.kind==='guinea-fowl') {
      if (!effect.hit && effect.time>.14) drawGuineaFowl(effectPosition(effect),ground,effect.face,effect.time);
      continue;
    }
    if (effect.kind==='gas') {
      const x=effectPosition(effect), radius=35+Math.min(effect.time,.75)*69;
      const alpha=Math.min(.58,effect.time*3,(1.30-effect.time)*2);
      if(readyImage(powerArt.gas)){
        for(let i=0;i<3;i++){
          ctx.save();ctx.globalAlpha=alpha*(1-i*.17);
          drawEffectSprite(powerArt.gas,x+effect.face*(i-1)*radius*.38,effect.y-17+Math.sin(effect.time*7+i)*10,radius*(1.36-i*.16),i%2 ? -effect.face : effect.face);
          ctx.restore();
        }
        continue;
      }
      for (let i=0;i<10;i++) {
        const offset=Math.sin(i*5)*radius*.64;
        const bob=Math.cos(i*4+effect.time*5)*25;
        oval(x+offset,effect.y-54+bob,18+radius*.23,14+i%3*5,'rgba('+(i%2 ? '170,213,30' : '91,146,15')+','+alpha+')');
      }
      continue;
    }
    if (effect.kind==='teleport') {
      const x=effect.destination ?? effect.x,y=effect.destY ?? effect.y;
      ctx.save();
      ctx.globalAlpha=Math.min(1,(.49-effect.time)*5);
      ctx.shadowColor='#b457fa';ctx.shadowBlur=16;
      for(let i=0;i<3;i++){
        ctx.strokeStyle=i ? '#d980ff' : '#fff0ff';
        ctx.lineWidth=4-i;
        ctx.beginPath();ctx.ellipse(x,y-75,15+i*8,57+i*4,-.15,0,Math.PI*2);ctx.stroke();
      }
      for(let i=0;i<7;i++){
        const angle=i*2.4+effect.time*13;
        oval(x+Math.cos(angle)*32,y-75+Math.sin(angle)*62,2,4,'#efd7ff');
      }
      ctx.restore();
      if (effect.destination!==undefined) text('!',x+fighters[effect.owner].face*55,y-143,30,'#ffdf75');
      continue;
    }
    if (effect.kind==='rescue') {
      const approach=Math.min(1,effect.time/.36);
      const vanX=effect.x+effect.face*(-340+approach*360);
      if(layer!=='front')drawEffectSprite(powerSprite('ambulance',ambulance),vanX,ground+10,236,effect.face);
      if (layer!=='back' && effect.time>.28) {
        for(let i=1;i>=0;i--){
          const age=effect.time-.28-i*.12;
          if(age<=0)continue;
          const x=effect.x+effect.face*(20+Math.min(1,age/.12)*48+Math.max(0,age-.12)*490);
          const pose=Math.floor(age*16)%4;
          const medic=rescueRun[pose];
          ctx.save();
          ctx.globalAlpha=Math.min(1,age*22,(rescueEnd-effect.time)*6);
          if(rescueRun.every(readyImage)){
            const scale=i ? .23 : .28;
            ctx.translate(x,ground+9-i*11);
            ctx.scale(effect.face*scale,scale);
            ctx.drawImage(medic,-256,-480);
          }else drawEffectSprite(powerSprite('medic-'+pose%2,nurses[pose%2]),x,ground+9-i*11,109-i*20,effect.face);
          ctx.restore();
        }
      }
    } else if (!effect.hit && effect.time>=.17) {
      const candy=powerSprite('chocolate',chocolate);
      ctx.save();ctx.translate(effectPosition(effect),effect.y-91);ctx.rotate(effect.time*9*effect.face);
      drawEffectSprite(candy,0,12,57,effect.face);ctx.restore();
    }
    if (effect.hit) oval(effect.impact,Math.min(ground,effect.y)-65,18,12,'#ffe0b897');
  }
}

function beginCharge(a) {
  a.charge=a.kind===0 ? .56 : a.kind===2 ? .65 : a.kind===3 ? .62 : a.kind===11 ? .36 : .44;
  a.y=ground;
  a.vy=0;
  a.chargedHit=false;
}
function chargeDistance(a,dt=a.charge) {
  const remaining=Math.min(a.charge,a.kind===3 ? .48 : a.charge);
  return 800*(remaining-Math.min(remaining,Math.max(0,a.charge-dt)));
}
function advanceCharge(a,dt) {
  const distance=chargeDistance(a,dt);
  a.x+=a.face*distance;
  a.charge=Math.max(0,a.charge-dt);
  return distance;
}

function evolution(a) {
  return a.kind===7 ? Math.floor((60-time+1e-6)/10) : 0;
}
function moveFighter(a,b,pressed,dt) {
  if(!a.hp || a.guardBreak || a.frozen || a.tumble)return;
  const gap=b.x-a.x;
  const guarding=isDefending(a,pressed);
  const direction = a.frenzy && !guarding ? (Math.abs(gap)>82 ? Math.sign(gap) : 0)
    : Number(pressed.has(a.keys[1]))-Number(pressed.has(a.keys[0]));
  const beforeMove=a.moveTime;
  a.moveTime = direction ? a.moveTime+dt : 0;
  if (phase==='fight' && !guarding && !a.frenzy && beforeMove<=.32 && a.moveTime>.32 &&
      (direction<0 ? a.x>55 : a.x<905)) combatCue('dash');
  if (a.kind===9 && (direction || pressed.has(a.keys[2]))) a.orsiStood=true;
  a.x += direction*fighterMoveSpeed(a,guarding)*dt;
  if (pressed.has(a.keys[2])) jump(a,pressed);
  a.face = Math.sign(b.x-a.x) || a.face;
}
function fighterMoveSpeed(a,guarding) {
  const base=a.kind===0 ? 280 : 222;
  const slow=a.slow>0 ? .6 : 1;
  if(guarding) return base*.43*slow;
  return base*(a.moveTime>.32 ? 1 : .69)*(a.buff ? 1.52 : a.frenzy ? 1.78 : a.ascended ? 1.32 : 1)*slow;
}
function jump(a,pressed) {
  if (a.y === ground && !a.frozen && !a.stun && !a.guardBreak && !a.snare && !a.asleep && !a.sleepRecovery && !a.nap && !a.bedWalk && !a.charge && !pressed.has(a.keys[3])) {
    if(phase==='fight' && a.vy>=0)combatCue('jump');
    a.vy=-520;
  }
}
function applyMomentum(a,dt) {
  a.x = Math.max(55,Math.min(905,a.x+a.vx*dt));
  a.vx *= Math.exp(-7*dt);
  const wasAirborne=a.y<ground;
  a.vy += 1300*dt;
  a.y = Math.min(ground,a.y+a.vy*dt);
  if (a.y === ground) {
    if(phase==='fight' && wasAirborne && a.vy>240)combatCue('ground_impact');
    a.vy = 0;
  }
}

function rect(x,y,w,h,color) {
  ctx.fillStyle=color;
  ctx.fillRect(x,y,w,h);
}
function text(value,x,y,size,color='#fff0e7',align='center') {
  ctx.font='800 '+size+'px system-ui';
  ctx.textAlign=align;
  ctx.fillStyle=color;
  ctx.fillText(value,x,y);
}
function oval(x,y,rx,ry,color) {
  ctx.fillStyle=color;
  ctx.beginPath();
  ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);
  ctx.fill();
}

const schoolArena=new Image();
schoolArena.src='stage-adelia.webp';

const arenaFrames=new Map();
const composedArenaFrames=new WeakMap();
const paintedFlags={
  ure:[[28,164,132,61],[768,165,150,59]],
  fazenda:[[55,62,42,79],[862,62,48,79]],
  cofre:[[129,69,48,79],[792,69,54,79]],
  adelia:[[24,235,200,57],[739,235,196,57]]
};
function loadArenaFrames(id) {
  if(!arenaFrames.has(id))arenaFrames.set(id,[1,2].map(index=>loadFrame('stage-'+id+'-mov-'+index)));
  return arenaFrames.get(id);
}
function composedArenaFrame(base,patch) {
  if(composedArenaFrames.has(patch))return composedArenaFrames.get(patch);
  const frame=document.createElement('canvas');
  frame.width=base.naturalWidth;
  frame.height=base.naturalHeight;
  const paint=frame.getContext('2d');
  if(!paint?.drawImage)return base;
  paint.drawImage(base,0,0,frame.width,frame.height);
  paint.drawImage(patch,0,0,frame.width,frame.height);
  composedArenaFrames.set(patch,frame);
  return frame;
}
function stageReaction(id) {
  if(id==='fazenda')return fighters.some(a=>a.kind===0 && a.charge>0);
  if(id==='grafica')return fighters.some(a=>a.kind===10 && a.action>0 &&
    (a.label==='OVO IMPRIMIR EM' || a.label==='SUPERENXAQUECA')) || effects.some(e=>e.kind==='print');
  return id==='cofre' && effects.some(e=>e.kind==='money-truck');
}
function movePaintedFlag(image,[x,y,w,h],clock,amplitude) {
  const sx=(image.naturalWidth || image.width)/960,sy=(image.naturalHeight || image.height)/500;
  const count=Math.ceil(h/5);
  const edge=h/count;
  const joint=w*.51;
  for(let i=0;i<count;i++){
    const center=(i+.5)/count;
    const motion=Math.sin(clock+center*2.6)*
      Math.sin(center*Math.PI)*amplitude;
    const offset=i*edge;
    const slice=Math.min(h-offset,edge+.18);
    const row=y+offset;
    ctx.drawImage(image,x*sx,row*sy,joint*sx,slice*sy,x,row,joint+motion,slice);
    ctx.drawImage(image,(x+joint)*sx,row*sy,(w-joint)*sx,slice*sy,
      x+joint+motion,row,w-joint-motion,slice);
  }
}
function arena() {
  const adelia=inAdelia();
  const id=adelia ? 'adelia' : arenaProfiles[stageIndex].id;
  const image=adelia ? schoolArena : stages[stageIndex];
  if(readyImage(image)){
    const clock=(last || 0)/1000;
    const reaction=stageReaction(id);
    const cheering=phase==='end' || effects.some(e=>e.kind==='victim-impact');
    const strength=reduceMotion.matches ? .42 : 1;
    const rate=(reaction || cheering ? 5 : 3.1)*(reduceMotion.matches ? .65 : 1);
    const step=[0,1,2,1][Math.floor(clock*rate)%4];
    const patch=loadArenaFrames(id)[step-1];
    const frame=readyImage(patch) ? composedArenaFrame(image,patch) : image;
    ctx.drawImage(frame,0,0,960,500);
    paintedFlags[id]?.forEach((band,index)=>{
      movePaintedFlag(frame,band,clock*2.8+index*1.5,(reaction ? 12 : 6)*strength);
    });
  }else{
    rect(0,0,960,500,'#261b38');
    rect(0,ground,960,500-ground,'#493047');
  }
  const shade=ctx.createLinearGradient(0,0,0,90);
  shade.addColorStop(0,'#12091be3');shade.addColorStop(1,'#12091b00');
  rect(0,0,960,90,shade);
}


const regenerationSprites=new WeakMap();
function regenerationSprite(tile) {
  if (regenerationSprites.has(tile)) return regenerationSprites.get(tile);
  const tinted=document.createElement('canvas');
  tinted.width=tile.naturalWidth;
  tinted.height=tile.naturalHeight;
  const paint=tinted.getContext('2d');
  paint.drawImage(tile,0,0);
  try {
    const image=paint.getImageData(0,0,tinted.width,tinted.height);
    for (let y=0;y<tinted.height*.83;y++) {
      for (let x=0;x<tinted.width;x++) {
        const i=(y*tinted.width+x)*4;
        const [r,g,b,alpha]=image.data.subarray(i,i+4);
        if (alpha<80 || r<110 || r-g<16 || g-b<7 || r-b>138) continue;
        image.data[i]=Math.min(255,r+24);
        image.data[i+1]=g*.52;
        image.data[i+2]=b*.65;
      }
    }
    paint.putImageData(image,0,0);
    regenerationSprites.set(tile,tinted);
    return tinted;
  } catch {
    regenerationSprites.set(tile,tile);
    return tile;
  }
}

function drawBabyChampion(a,state,moving){
  const tick = Math.floor((last || 0)/110);
  const pose = state==='walk' ? 'walk-'+(tick%2) : state==='run' && tick%2 ? 'walk-1' : state;
  const hd = dedewBabyHD[pose] || dedewBabyHD.idle;
  if (readyImage(hd)) {
    const bob = moving ? Math.abs(Math.sin(tick*.9))*3 : 0;
    ctx.save();
    ctx.translate(a.x,a.y-bob);
    ctx.scale(a.face*.34,.34);
    if (state==='fall') {ctx.translate(-55,-32);ctx.rotate(-1.3);}
    else if (state==='hurt') ctx.rotate(-.12);
    ctx.drawImage(hd,-256,-480);
    ctx.restore();
    return;
  }
  const source=sprites[14].baby[0];
  if(!source.complete || !source.naturalWidth) return;
  const clock=(last || 0)/1000,w=source.naturalWidth,h=source.naturalHeight;
  const running=state==='run',walking=state==='walk' || running;
  const cycle=clock*(running ? 19 : 12),stride=walking ? Math.sin(cycle) : 0;
  const duration=a.actionDuration || .28;
  const progress=Math.max(0,Math.min(1,1-a.action/duration));
  const strike=(state==='punch' || state==='kick') && a.action ? Math.sin(Math.PI*progress) : 0;
  const guard=state==='guard',hurt=state==='hurt',fall=state==='fall',jump=state==='jump';
  const bob=walking ? -Math.abs(Math.sin(cycle))*5 : Math.sin(clock*5)*1.4;
  ctx.save();ctx.translate(a.x,a.y);ctx.scale(a.face*.74,.74);
  if(fall){ctx.translate(0,-h*.20);ctx.rotate(-1.3);}
  else ctx.rotate(hurt ? -.16 : running ? .08 : jump ? -.06 : 0);
  ctx.translate(0,bob);
  if(!Object.values(babyLayers).every(image=>image.complete && image.naturalWidth)){
    ctx.drawImage(source,-w/2,-h);ctx.restore();return;
  }
  function limb(name,px,py,rotation,stretch=1,shift=0){
    const x=(px-.5)*w,y=(py-1)*h;
    ctx.save();ctx.translate(x+shift,y);ctx.rotate(rotation);ctx.scale(stretch,1);
    ctx.drawImage(babyLayers[name],-w/2-x,-h-y);ctx.restore();
  }
  limb('left-leg',.39,.81,walking ? stride*.43 : jump ? .45 : 0);
  limb('right-leg',.62,.81,state==='kick' ? -strike*1.15 : walking ? -stride*.43 : jump ? -.45 : 0);
  ctx.drawImage(babyLayers.body,-w/2,-h);
  limb('left-arm',.41,.43,guard ? .40 : walking ? -stride*.24 : .02*Math.sin(clock*5));
  limb('right-arm',.68,.43,guard ? -.48 : state==='punch' ? -strike*.32 : walking ? stride*.24 : -.02*Math.sin(clock*5),1+strike*.24,strike*18);
  ctx.restore();
}

const pedroFaceAnchors={
 idle:[414,140],windup:[425,170],punch:[442,182],
 'walk-0':[425,162],'walk-1':[450,162],'walk-2':[425,162],'walk-3':[450,162],
 'run-0':[466,175],'run-1':[460,175],'run-2':[490,190],
 jump:[430,172],crouch:[450,292],guard:[418,166],kick:[340,170],knee:[455,165],
 hurt:[285,160],fall:[110,570],rise:[470,320],
 'horn-ready':[423,143],'horn-blow':[360,180],bull:[465,310]
};
function drawPedroCrying(tile,state,clock){
  const name=tile.src.split('0-hd-')[1]?.replace(/\.webp(?:\?.*)?$/,'');
  const [x,y]=pedroFaceAnchors[name] || pedroFaceAnchors.idle;
  ctx.save();ctx.translate((x-384)*.30,(y-720)*.30);
  if(state==='fall')ctx.rotate(-1.15);
  // Opaque tear streams stay visible over every pose, with animated falling drops.
  for(const side of [-1,1]){
    const eye=side*3.3;
    ctx.strokeStyle='#e0f8ff';ctx.lineWidth=2.8;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(eye,0);ctx.quadraticCurveTo(eye+side,4,eye+side*1.2,8);ctx.stroke();
    ctx.strokeStyle='#48c4ff';ctx.lineWidth=1.6;ctx.stroke();
    const drop=(clock*17+(side+1)*4)%13;
    ctx.globalAlpha=1-drop/17;ctx.fillStyle='#72dcff';
    ctx.beginPath();ctx.ellipse(eye+side*1.2,7+drop,1.5,2.5,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    ctx.strokeStyle='#482c38';ctx.lineWidth=1.3;
    ctx.beginPath();ctx.moveTo(eye-2,-2);ctx.lineTo(eye+2,-3);ctx.stroke();
  }
  // Frown covers the smiling mouth; the horn's blowing pose keeps its embouchure.
  if(name!=='horn-blow'){
    ctx.fillStyle='#ed9b5f';ctx.beginPath();ctx.ellipse(1,7.3,4.8,3,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#633326';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(-3,8.5);ctx.quadraticCurveTo(1,4.6,5,8.5);ctx.stroke();
  }
  ctx.restore();
}
function drawMaykimHD(a,tile,moving){
 const image=a.charge?maykimBikeFor(a,fighters[1-a.i]):tile;
 if(!image?.complete || !image.naturalWidth)return;
 const clock=(last||0)/1000,scale=.42;
 const bob=a.charge?Math.sin(clock*30)*1.4:moving&&!a.action?Math.abs(Math.sin(clock*12))*2:0;
 ctx.save();ctx.translate(a.x,a.y-bob);ctx.scale(a.face,1);ctx.drawImage(image,-384*scale,-720*scale,768*scale,768*scale);ctx.restore();
}
function drawDownFrame(tile){
 const name=tile.src.split('1-hd-')[1]?.replace(/\.webp(?:\?.*)?$/,'');
 const face=downFaces[name],rect=downFaceRects[name],scale=.30;
 if(!face?.complete || !face.naturalWidth || !rect){ctx.drawImage(tile,-384*scale,-720*scale,768*scale,768*scale);return;}
 const [x,y,w,h]=rect;
 const piece=(sx,sy,sw,sh)=>{if(sw>0 && sh>0)ctx.drawImage(tile,sx,sy,sw,sh,(sx-384)*scale,(sy-720)*scale,sw*scale,sh*scale);};
 // Keep the original body outside the edited facial region; avoid layering two heads.
 piece(0,0,768,y);piece(0,y,x,h);piece(x+w,y,768-x-w,h);piece(0,y+h,768,768-y-h);
 ctx.drawImage(face,(x-384)*scale,(y-720)*scale,w*scale,h*scale);
}
function drawDownHD(a,tile,state,moving){
 if(!tile?.complete || !tile.naturalWidth)return;
 const clock=(last||0)/1000,breath=state==='idle'?Math.sin(clock*3)*.004:0;
 const bob=moving&&!a.action?Math.abs(Math.sin(clock*(state==='run'?18:10)))*2:0;
 ctx.save();ctx.translate(a.x,a.y-bob);ctx.scale(a.face,1+breath);drawDownFrame(tile);ctx.restore();
}
function drawPedroHD(a,tile,state,moving){
  if(!tile?.complete || !tile.naturalWidth)return;
  const clock=(last || 0)/1000;
  const breath=state==='idle' || state==='guard' ? Math.sin(clock*3.5)*.003 : 0;
  const stride=moving && !a.action && !a.charge ? Math.sin(clock*(state==='run' ? 22 : 13)) : 0;
  const scale=.30;
  ctx.save();ctx.translate(a.x,a.y-Math.abs(stride)*(state==='run' ? 2.5 : .8));ctx.scale(a.face,1+breath);
  ctx.drawImage(tile,-384*scale,-720*scale,768*scale,768*scale);
  if(pedroIsCrying(a))drawPedroCrying(tile,state,clock);
  ctx.restore();
}
function fighter(a,pressed = keys) {
  const guard = isDefending(a,pressed);
  const guardStep=guard && phase==='fight' && pressed.has(a.keys[0])!==pressed.has(a.keys[1])
    ? Math.abs(Math.sin((last || 0)*.015))*2 : 0;
  if(a.deaf>0)text('SURDEZ '+a.deaf.toFixed(1)+'s',a.x,a.y-175,13,'#edb1ff');
  if(a.kind===0 && phase==='fight')text(pedroIsCrying(a) ? 'CHORANDO · DANO −30%' : pedroPower(a,fighters[1-a.i])>1 ? 'CAMPEÃO DA ROÇA +30%' : '',a.x,a.y-213,12,pedroIsCrying(a) ? '#80dbff' : '#ffdc78');
  oval(a.x,ground+8,44,9,'#160c20');
  const moving = phase === 'fight' && (pressed.has(a.keys[0]) || pressed.has(a.keys[1]));
  const special = a.charge || embrace?.a === a || (a.action && ['FOOOON!','SUPER ABRAÇO','MILKSHAKE TURBO','GRANADA DE FUMAÇA','BRILHO DA CARECA','COMEDOR DE AÇÚCAR!','PEIDO INFECTANTE','TOSCANA DESENROLADA','SERINGA DA LOUCURA','DORME NENÉM','INVOCAÇÃO DA FISIOTERAPEUTA','OVO IMPRIMIR EM','SUPERENXAQUECA','GOLPE DA FELICIDADE','PODER DOS TABLETS','MOLHO DE PIMENTA','INVESTIDA DO PATACO','ESGUICHO DO CAFÉ','DÊDÊWZINHU'].includes(a.label));
  const state = a.hp === 0 ? 'fall'
    : a.nap ? 'sleep'
    : a.asleep ? 'fall'
    : a.sleepRecovery ? (a.sleepRecovery>.12 ? 'rise' : 'idle')
    : a.bedWalk ? 'walk'
    : a.kind===8 && effects.some(effect=>effect.kind==='blanket' && effect.owner===a.i && effect.time>=.34 && effect.time<.64) ? 'punch'
    : a.tumble > .22 ? 'fall'
    : a.tumble > 0 ? 'rise'
    : a.flash || a.stun ? 'hurt'
    : guard ? 'guard'
    : a.kind===0 && a.charge ? 'charge'
    : a.kind===0 && a.y<ground && a.action ? 'air'
    : a.kind===0 && !a.action && a.y>=ground && pressed.has(a.keys[3]) ? 'crouch'
    : a.charge && a.kind===3 ? (a.charge>.48 ? 'transform' : 'dash')
    : a.charge && (a.kind === 2 || a.kind===11) ? 'dash'
    : a.kind===5 && a.action && a.label==='CUTUCADA NA ORELHA'
      ? (effects.some(effect=>effect.kind==='teleport' && effect.owner===a.i && effect.destination!==undefined) ? 'punch' : 'teleport')
    : a.kind===13 && a.action && a.label==='INVESTIDA DO PATACO' ? 'wallet'
    : a.kind===12 && a.action && a.label==='TACO DE BEISEBALL' ? 'bat'
    : a.kind===9 && a.action && a.label==='QUEIJO GORFADO' ? 'cheese'
    : a.kind===7 && a.action && a.label==='PÍLULA DA REGENERAÇÃO' ? 'pill'
    : a.kind===6 && a.action && a.label==='GALINHAS DA ANGOLA' ? 'call'
    : a.kind===4 && a.action && a.label==='EQUIPE DE SOCORRO' ? 'call'
    : a.kind===2 && a.action && a.label==='TIO PATINHAS' ? 'special'
    : a.kind===2 && !a.action && a.y>=ground && pressed.has(a.keys[3]) ? 'crouch'
    : a.kind===1 && (embrace?.a===a || a.action && a.label==='ABRAÇO DOWN') ? 'hug'
    : a.kind===1 && a.action && a.label==='GORFINHO DE MORANGO' ? 'spit'
    : a.kind===1 && !a.action && a.y>=ground && pressed.has(a.keys[3]) ? 'crouch'
    : special ? 'special'
    : a.action ? (a.label === 'CHUTE' ? 'kick' : 'punch')
    : a.y < ground ? (a.kind===0 || a.kind===1 || a.kind >= 2 ? 'jump' : 'kick')
    : a.frenzy ? 'run'
    : moving ? (a.buff || a.moveTime > .32 ? 'run' : 'walk') : 'idle';
  if (a.kind===11 && a.charge) {
    const colors=['#ff668e','#ffc160','#fff478','#62ec8a','#7ecbff','#be91ff'];
    colors.forEach((color,i)=>{
      ctx.strokeStyle=color;ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(a.x-a.face*128,a.y+7-i*3);
      ctx.quadraticCurveTo(a.x-a.face*60,a.y-37-i*3,a.x+a.face*20,a.y+6-i*3);
      ctx.stroke();
    });
  }
  const transformed=a.kind===14 && a.baby>0;
  const animatedAttack=['hug','spit','special','punch','kick','teleport','pill','cheese','bat','wallet'].includes(state);
  const customCast = animatedAttack || state==='call' || state==='dash';
  const castSlot = customCast && (a.action || a.charge || state==='hug')
    ? specials[a.kind].findIndex(name=>name.toUpperCase() === a.label) : -1;
  const seatedOrsi = a.kind===9 && !a.orsiStood && !a.ascended;
  let cast;
  if (castSlot>=0) {
    if (a.kind===9) cast=orsiCast[seatedOrsi ? 'seated' : 'standing'][castSlot];
    else if (a.kind===2 && castSlot===1) cast=maykimTruckCast;
    else if (a.kind===1) cast=downHDCast[castSlot];
    else cast=loadSpecialHD(a.kind)?.[castSlot];
  }
  const hasCast = cast?.every(readyImage);
  const alfredoCast=a.kind===12 && alfredoCastFrames[state];
  const weaponPose = a.kind===10 && a.printedTier>=0 && !hasCast && printedWeaponPoses[a.printedTier];
  const weaponStrike = weaponPose && state==='punch' && a.label===printedItems[a.printedTier].toUpperCase();
  let armedFrames;
  if(weaponStrike) armedFrames=[a.action>.14 ? weaponPose.strike : weaponPose.ready];
  else if(weaponPose && (state==='walk' || state==='run')) armedFrames=weaponPose.walk;
  else if(weaponPose && state==='guard') armedFrames=[readyImage(weaponPose.guard) ? weaponPose.guard : weaponPose.ready];
  else if(weaponPose && ['idle','jump'].includes(state)) armedFrames=[weaponPose.ready];
  const heldWeapon = armedFrames?.every(readyImage);
  const seatedPose = seatedOrsi && (state==='idle' || state==='guard')
    ? [orsiChair[state==='guard' ? 1 : 0]] : null;
  const sleepPose = a.kind===8 && state==='sleep' ? gabrielSleep : null;
  const modernCastFallback = !hasCast && castSlot===0 && (a.kind===5 || a.kind===6)
    ? loadRosterHD(a.kind)?.punch : null;
  const highResolution = !transformed && (
    (a.kind>=4 && hasCast && cast) || (heldWeapon && armedFrames) ||
    seatedPose || sleepPose || modernCastFallback || (!alfredoCast && loadRosterHD(a.kind)?.[state])
  );
  const useHighResolution = highResolution && highResolution.every(readyImage);
  const tiles=(hasCast && cast) || (useHighResolution && highResolution) || alfredoCast ||
    (modernCastFallback ? sprites[a.kind].idle :
      state==='special' && a.kind===10 ? sprites[10].guard : sprites[a.kind][state]) || sprites[a.kind].idle;
  const remaining=embrace?.a===a ? .42*(1-embrace.time/.58) : a.action;
  const duration=a.actionDuration || .42;
  const castElapsed = (a.actionDuration || .42)-a.action;
  const maykimJump = a.kind===2 && state==='jump';
  const maykimRise = a.kind===2 && state==='rise' && a.tumble>0;
  const frameIndex=hasCast ? Number((embrace?.a===a ? embrace.time : castElapsed) >=
      (a.kind===9 && castSlot===1 ? .24 : a.kind===1 && castSlot===1 ? .25 : .17))
    : maykimJump ? (a.y < ground-35 ? 1 : a.vy < 0 ? 0 : 2)
    : maykimRise ? (a.tumble > .10 ? 0 : 1)
    : alfredoCast ? alfredoCastFrame(state,a.action) : animatedAttack && a.action
    ? Math.max(0,Math.min(tiles.length-1,Math.floor((1-Math.min(duration,remaining)/duration)*tiles.length)))
    : Math.floor((last || 0)/(moving || (useHighResolution && (state==='run' || state==='walk')) ? 105 : 245))%tiles.length || 0;
  const chargeFrame = a.kind===0 && state==='charge' ? Math.min(tiles.length-1,Math.floor((.56-a.charge)/.56*tiles.length)) : a.kind===3 && (state==='transform' || state==='dash')
    ? Math.min(tiles.length-1,Math.max(0,Math.floor((state==='transform' ? (.62-a.charge)/.14 : (.48-a.charge)/.48)*tiles.length)))
    : frameIndex;
  const preferred=tiles[chargeFrame];
  const tile=preferred?.complete && preferred.naturalWidth ? preferred : sprites[a.kind].idle.find(image=>image.complete && image.naturalWidth);
  if(a.kind===2){
    drawMaykimHD(a,tile,moving);
  }else if(a.kind===1){
    drawDownHD(a,tile,state,moving);
  }else if(a.kind===0){
    drawPedroHD(a,tile,state,moving);
  }else if(transformed){
    drawBabyChampion(a,state,moving);
  }else if(useHighResolution){
    const scale = .48;
    const evolutionScale = a.kind===7 ? 1 + evolution(a)*.07 : 1;
    const breathing = state==='idle' ? Math.sin((last || 0)*.0035)*.003 : 0;
    const sprite = a.kind===7 && a.regen ? regenerationSprite(tile) : tile;
    ctx.save();
    ctx.translate(a.x,a.y-guardStep);
    ctx.scale(a.face*scale*evolutionScale,scale*evolutionScale*(1+breathing));
    if(a.kind===10) drawGrowingHead(sprite,a,sprite.naturalWidth,512,-32);
    else ctx.drawImage(sprite,-256,-480);
    ctx.restore();
  }else if(tile?.complete && tile.naturalWidth){
    const scale = a.kind===0 ? (state==='charge' ? 1.10 : state==='special' ? .97 : 1.4) : a.kind===14 ? (a.baby>0 ? .67 : state==='special' ? 1 : 1.38) : a.kind===13 ? (state==='special' || state==='wallet' ? 1 : 1.38) : a.kind===12 ? 1.53 : a.kind===11 ? (state==='special' || state==='dash' ? 1.10 : 1.53) : a.kind===9 ? (state==='special' || state==='cheese' ? 1.03 : a.ascended ? 1.69 : 1.52) : a.kind===8 ? (state==='sleep' ? .78 : state==='special' ? 1.13 : 1.45) : a.kind===7 ? (state==='special' || state==='pill' ? 1.05 : 1.53)*(1+evolution(a)*.07) : a.kind===3 ? (state==='transform' || state==='dash' ? .97 : state==='special' ? .9 : 1.51)
      : a.kind === 5 ? (state==='special' || state==='teleport' ? .98 : 1.34) : a.kind===6 ? (state==='special' || state==='call' ? 1.02 : 1.35) : a.kind === 2 || a.kind === 4 ? 1.33 : tile.naturalHeight > 110 ? 1.08 : 1.57;
    ctx.save();
    ctx.translate(a.x,a.y-guardStep);
    ctx.scale(a.face,1);
    if (a.kind===3 && state==='special') {
      const base=sprites[3].idle[0];
      if (base.complete && base.naturalWidth) ctx.drawImage(base,-base.naturalWidth*.75,-base.naturalHeight*1.51,base.naturalWidth*1.51,base.naturalHeight*1.51);
    }
    if (a.kind===9 && a.ascended) ctx.scale(1.12,1);
    const offset=a.kind===3 && state==='special' ? 46 : 0;
    const sprite=a.kind===7 && a.regen ? regenerationSprite(tile) : tile;
    const width=tile.naturalWidth*scale,height=tile.naturalHeight*scale;
    if (a.kind===10) drawGrowingHead(sprite,a,width,height,offset);
    else ctx.drawImage(sprite,-width/2,-height-offset,width,height);
    ctx.restore();
  }
  if (alfredoCast && a.action) {
    const progress=1-a.action/.42;
    const swing=state==='bat';
    const x=a.x+a.face*(swing ? 55 : 42),y=a.y-(swing ? 99 : 139);
    ctx.save();
    ctx.globalAlpha=Math.sin(Math.PI*progress);
    ctx.translate(x,y);
    ctx.scale(a.face,1);
    ctx.shadowColor='#32cdff';ctx.shadowBlur=14;
    ctx.strokeStyle=swing ? '#8ae7ff' : '#51e8ff';ctx.lineWidth=3;
    for (let i=0;i<3;i++) {
      ctx.beginPath();
      if (swing) ctx.ellipse(5+i*9,-8,23+i*12,18+i*6,-.4,-2.4,.92);
      else ctx.ellipse(0,-progress*20,13+i*9,7+i*5,-.3,0,Math.PI*2);
      ctx.stroke();
    }
    for(let i=0;i<5;i++){
      const angle=i*2.4+progress*2;
      text(i%2 ? '✦' : '·',Math.cos(angle)*(18+progress*46),Math.sin(angle)*(12+progress*34),13,'#b7f7ff');
    }
    ctx.restore();
  }
  if (a.kind===11 && a.hp) {
    const level=happiness(a,fighters[1-a.i]);
    for(let i=0;i<level;i++){
      const t=(last ?? 0)/1000*2+i*Math.PI*2/level;
      text('✦',a.x+Math.cos(t)*72,a.y-101+Math.sin(t)*46,22,'#ffe282');
    }
  }
  if (a.kind===10 && a.hp && a.printedTier>=0 && !heldWeapon && !hasCast) drawPrintedItem(a);
  if(guard){
    ctx.save();
    ctx.strokeStyle=a.blockFlash ? '#d8fbff' : '#81bfff9c';
    ctx.lineWidth=a.blockFlash ? 4 : 2;
    ctx.beginPath();ctx.ellipse(a.x+a.face*22,a.y-91,31,54,0,a.face>0 ? -1.12 : 2.02,a.face>0 ? 1.12 : 4.26);ctx.stroke();
    ctx.restore();
  }
  if (a.kind===10 && a.hp && (a.migraineTicks || a.migrainePulse)) drawMigraine(a);
  if (a.hp && (a.asleep || a.nap)) {
    if(a.blanket && readyImage(sleepBlanketHD)){
      ctx.drawImage(sleepBlanketHD,a.x-76,a.y-61,152,62);
    } else if (a.blanket && sleepBlanket.complete && sleepBlanket.naturalWidth) {
      ctx.drawImage(sleepBlanket,0,0,sleepBlanket.naturalWidth*.78,sleepBlanket.naturalHeight,
        a.x-68,a.y-48,114,47);
    }
    drawSleepLetters(a);
  }
  if (a.hp && a.nap) {
    const cloneFace=Math.sign(fighters[1-a.i].x-a.cloneX)||a.face;
    const projection = gabrielProjection[a.cloneAction ? 1 : 0];
    if (readyImage(projection)) drawEffectSprite(projection,a.cloneX,ground+9,225,cloneFace);
    else drawEffectSprite(sprites[8].clone[a.cloneAction ? 1 : 0],a.cloneX,ground,173,cloneFace);
  }
  if (a.kind===7 && a.hp) {
    if (a.frenzy || a.regen) oval(a.x,a.y+3,48+evolution(a)*4,8,a.frenzy ? '#ff76ec80' : '#8aff8d80');
    if (a.blood) {
      for (let i=0;i<7;i++) {
        const f=(i+1)/8;
        oval(a.bloodX+(a.x-a.bloodX)*f,a.bloodY+(a.y-85-a.bloodY)*f-Math.sin(Math.PI*f)*26,4+i%2,3,'#de285d');
      }
      text('+HP',a.x,a.y-160,17,'#8aff8d');
    }
  }
  if (a.snare && a.hp) {
    drawGuineaFowl(a.x,a.y,a.face,1-a.snare,true);
    text('PRESO',a.x,a.y-185,15,'#e8b5ff');
  }
  if(a.blockFlash>0){
    ctx.save();ctx.globalAlpha=Math.min(1,a.blockFlash*7);ctx.strokeStyle='#9eeaff';ctx.lineWidth=4;
    ctx.beginPath();ctx.ellipse(a.x+a.face*38,a.y-78,18,53,0,0,Math.PI*2);ctx.stroke();ctx.restore();
    text('BLOQUEADO',a.x,a.y-171,14,'#9eeaff');
  }
  if(a.guardNotice>0)text('DEFESA QUEBRADA!',a.x,a.y-172,16,'#ff9a82');
  if (a.infectionTicks && a.hp) text('INFECTADO',a.x,a.y-184,13,'#d6f77c');
  if (a.buff) text('🥤',a.x+a.face*39,a.y-112,27);
  const headY = a.y-guardStep-135+(guard ? 10 : 0);
  if(a.kind===14 && a.baby>0) text('DÊDÊWZINHU '+a.baby.toFixed(1)+'s',a.x,a.y-145,14,'#ffc477');
  if(a.coffeeBurn>0){
    text('QUEIMADURA',a.x,a.y-178,13,'#ffae59');
    for(let i=0;i<4;i++) oval(a.x+(i-1.5)*17,a.y-42-Math.sin(last/130+i)*15,4,9,i%2?'#ffbc53':'#ff652e');
  }
  if (a.kind===13 && a.growthRead>0) text('CABEÇÃO +'+a.growthPercent+'%',a.x,headY-35,14,'#ffe686');
  if (embrace?.b === a) text('AGARRADO',a.x,headY-45,17,'#ffdb6f');
  if (a.stun && !a.guardNotice) text('✦  ✦  ✦',a.x,headY-45,20,'#ffdb6f');
  if (a.action || a.charge) text(a.label,a.x,headY-63,18,a.color);
  if (a.label === 'GRANADA DE FUMAÇA' && a.action) {
    const progress = 1-a.action/.42;
    for (let i=0;i<7;i++) {
      const x=a.x+a.face*(50+i*24)*(.45+progress);
      const y=headY+52+Math.sin(i*2)*18;
      oval(x,y,12+progress*20,10+progress*14,'#bb81ee6e');
    }
  }
  drawDownStatuses(a);
  if (a.label === 'FOOOON!' && a.action) {
    ctx.strokeStyle = a.color;
    ctx.lineWidth = 4;
    for (let i=1;i<=4;i++) {
      ctx.beginPath();
      ctx.ellipse(a.x+a.face*(40+i*43),headY+13,10+i*3,14+i*6,0,0,Math.PI*2);
      ctx.stroke();
    }
  }
}

function hud() {
  fighters.forEach((a,i) => {
    const left=i ? 562 : 38;
    text(a.name+(cpu.active && !online && i===1 ? ' · CPU' : ''),i ? 922 : 38,35,22,a.color,i ? 'right' : 'left');
    rect(left,47,360,19,'#1a1123');
    rect(left+(i ? 360*(1-a.hp/100) : 0),47,360*a.hp/100,19,a.color);
    const guardRatio=Math.max(0,Math.min(1,a.guardEnergy/100));
    const guardColor=a.guardBreak ? '#ff795f' : a.guardEnergy<=25 ? '#ffc16c' : '#79d7f5';
    rect(left,105,360,8,'#243342');
    rect(left+(i ? 360*(1-guardRatio) : 0),105,360*guardRatio,8,guardColor);
    const guardLabel=a.guardBreak ? 'DEFESA QUEBRADA · '+a.guardBreak.toFixed(1)+'s' : a.guardNeedsRelease ? 'SOLTE A DEFESA' : 'DEFESA · '+Math.round(a.guardEnergy)+'/100';
    text(guardLabel,i ? left+360 : left,127,11,guardColor,i ? 'right' : 'left');
    const labels=[['Matador','Foon'],['Abraço','Milkshake'],['Fumaça','Avanço'],['Brilho','Surfista'],['Socorro','Chocolate'],['Fumaça','Cutucada'],['Toscana','Galinhas'],['Seringa','Regeneração'],['Dorme Neném','Cochilo'],['Fisioterapia','Queijo'],['Impressão 3D','Enxaqueca'],['Gargalhada','Arco-íris'],['Tablets','Beisebol'],['Molho de pimenta','Investida do Pataco'],['Café quente','DêDêwzinhu']][a.kind];
    if (a.kind===7) text('Evolução '+evolution(a),left+301,90,13,a.color);
    if (a.kind===12) text('Tech '+a.tech+'/3',left+301,90,13,a.color);
    if (a.kind===11) text('Felicidade '+happiness(a,fighters[1-i]),left+301,90,13,a.color);
    if (a.kind===10) text(printedItems[a.printedTier>=0 ? a.printedTier : printTier(a.hp)],left+301,90,13,a.color);
    labels.forEach((name,j) => {
      const x=left+j*114;
      rect(x,74,109,22,'#1a1123');
      const active=a.kind===8 && j===1 && a.nap>0;
      const executing=Boolean(a.specialsInProgress?.[j+1]);
      const progress=active ? a.nap/6 : executing ? 0 : 1-a.cool[j+1]/cooldownFor(a,j+1);
      rect(x,74,109*Math.max(0,Math.min(1,progress)),22,active ? '#825bb0' : '#674357');
      text(active ? 'Clone '+a.nap.toFixed(1)+'s' : executing ? 'Em efeito' : name,x+54,90,13,a.color);
    });
  });
  text(String(Math.ceil(time)).padStart(2,'0'),480,65,40);
}

function advanceOnlineHost() {
  if (online?.role !== 'host' || (phase !== 'fight' && phase !== 'countdown')) return;
  const now=performance.now();
  let elapsed=Math.min(.3,Math.max(0,(now-online.simulatedAt)/1000));
  online.simulatedAt=now;
  while(elapsed>0 && (phase==='fight' || phase==='countdown')) {
    const step=Math.min(.025,elapsed);
    update(step);
    elapsed-=step;
  }
}

const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
function drawDazzle() {
  const local=online ? (online.role==='guest' ? 1 : 0) : null;
  for (const target of fighters) {
    if (!target.dazzle || (local!==null && local!==target.i)) continue;
    const intensity=Math.min(1,target.dazzle/.52);
    const opacity=intensity*(reduceMotion.matches ? .17 : .94);
    if (local!==null) rect(0,0,960,500,'rgba(255,255,255,'+opacity*.87+')');
    const glow=ctx.createRadialGradient(target.x,target.y-100,20,target.x,target.y-100,local===null ? 330 : 960);
    glow.addColorStop(0,'rgba(255,255,255,'+opacity+')');
    glow.addColorStop(1,'rgba(255,255,255,0)');
    rect(0,0,960,500,glow);
  }
}
function stopMatheusAudio() {
  for (const name of ['matheusPrinter','matheusItem','matheusHeartbeat','matheusBleeding']) clips[name].pause();
}
function syncHeartbeatAudio() {
  const active=phase==='fight' && fighters.some(fighter=>fighter.kind===10 && fighter.hp>0 && fighter.migraineTicks>0);
  const clip=clips.matheusHeartbeat;
  if (active) clip.seenActive=true;
  if (phase!=='fight' || (!active && clip.seenActive)) clip.pause();
}

function resizeCombatCanvas(){
  if(!canvas.getBoundingClientRect || !ctx.setTransform)return;
  const bounds=canvas.getBoundingClientRect();if(!bounds.width)return;
  const density=Math.max(1,Math.min(2,bounds.width/960*(window.devicePixelRatio || 1)));
  const width=Math.round(960*density),height=Math.round(500*density);
  if(canvas.width!==width || canvas.height!==height){canvas.width=width;canvas.height=height;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';}
  ctx.setTransform(width/960,0,0,height/500,0,0);
}
function frame(now) {
  resizeCombatCanvas();
  syncDeafnessAudio();
  syncHeartbeatAudio();
  if (online?.role === 'host') advanceOnlineHost();
  else if (!online) update(Math.min(.033,(now-(last ?? now))/1000));
  const dt=Math.min(.033,(now-(last ?? now))/1000);
  last=now;
  if (phase === 'characters' || phase === 'stages') {
    requestAnimationFrame(frame);
    return;
  }
  ctx.save();
  const quake=effects.find(e=>e.kind==='dedew-quake' && e.time<.26);
  if(quake && phase==='fight') ctx.translate(Math.sin(quake.time*110)*4*(1-quake.time/.26),Math.cos(quake.time*90)*2);
  arena();
  drawEffects('back');
  if(!online && phase==='fight' && !reduceMotion.matches){
    const impact=effects.find(effect=>effect.kind==='basic-impact' && effect.heavy && effect.time<.055);
    if(impact && impact!==impactHold?.impact){
      impactHold={impact,until:now+34,poses:fighters.map(fighter=>({...fighter})),time:now};
    }
  }
  // Hold only the rendered poses. The simulation and input continue each frame.
  const hold=!online && phase==='fight' && !reduceMotion.matches && now<impactHold?.until ? impactHold : null;
  if(hold){
    try {
      last=hold.time;
      hold.poses.forEach(pose=>fighter(pose));
    } finally {
      last=now;
    }
  } else {
    fighter(fighters[0]);
  }
  if (online?.role==='guest' && phase==='fight') {
    fighter(advanceGuestVisual(dt),online.localKeys);
  } else if(!hold) {
    fighter(fighters[1]);
  }
  drawEffects('front');
  if (phase==='fight') drawDazzle();
  ctx.restore();
  hud();
  if (banner) {
    rect(0,185,960,116,'#160d20eb');
    text(banner,480,phase==='countdown' ? 269 : 252,phase==='countdown' ? 88 : 43,phase==='countdown' ? '#f4cc7a' : '#fff1d8');
    if(phase==='countdown')text('PREPAREM-SE',480,211,14,'#d4ccdf');
  }
  if (reaction !== null) {
    const photo = reactions[Number(reaction)][reactionFrame(now-reactionStarted)];
    const color = reaction ? '#ffcf77' : '#cda3ff';
    if (photo.complete && photo.naturalWidth) {
      rect(384,304,192,192,color);
      ctx.drawImage(photo,387,307,186,186);
    }
  }
  requestAnimationFrame(frame);
}
const roomStatus = document.querySelector('#room-status');
function sendOnline(message) {
  if (!online?.conn?.open) return;
  if (message.type === 'state') online.snapshot=message;
  else {
    online.queue.push(message);
    if (message.type==='key' && !online.syncing) {
      clearTimeout(online.timer);
      void syncRoom(online);
    }
  }
}
function onlineKey(e,down) {
  const player = online.role === 'host' ? 0 : 1;
  const keyboard = roster[player].keys;
  if (!keyboard.includes(e.code) || (phase !== 'fight' && e.target?.tagName === 'INPUT')) return;
  e.preventDefault();
  if (e.repeat) return;
  if (phase === 'characters' && down) {
    const index=keyboard.indexOf(e.code);
    if (index === 4) confirmFighter(player);
    else if (index < 2 && !locked[player]) chooseFighter(player,(picks[player]+characters.length+(index ? 1 : -1))%characters.length);
  } else if (phase === 'fight') {
    if (online.role === 'guest') {
      const pressed=online.localKeys;
      if (pressed.has(e.code)===down) return;
      if (down) pressed.add(e.code);
      else pressed.delete(e.code);
      const seq=++online.inputSequence;
      online.pendingInputs.push({seq,at:performance.now()});
      const index=keyboard.indexOf(e.code);
      if (down && !embrace) {
        if (index===2) jump(online.visual,pressed);
        if (index>=4) predictAttack(online.visual,index-4,seq);
      }
      sendOnline({type:'key',code:e.code,down,seq});
    }
    else applyOnlineKey(player,e.code,down);
  }
}
function applyOnlineKey(player,code,down) {
  const index=roster[player].keys.indexOf(code);
  if (index<0 || phase !== 'fight') return;
  if (!down) {keys.delete(code);return}
  if (keys.has(code)) return;
  keys.add(code);
  if (index===2 && !embrace) jump(fighters[player],keys);
  if (index<2 && !embrace) {
    const fighter=fighters[player];
    if (!fighter.stun && !fighter.snare && !fighter.asleep && !fighter.sleepRecovery && !fighter.nap && !fighter.bedWalk && !fighter.charge) {
      moveFighter(fighter,fighters[1-player],keys,.016);
      fighter.x=Math.max(55,Math.min(905,fighter.x));
    }
  }
  if (index>=4) attack(fighters[player],fighters[1-player],index-4);
}
function receiveOnline(message) {
  const guest = online.role === 'guest';
  const other = guest ? 0 : 1;
  switch (message.type) {
    case 'pick':
      if (phase === 'characters' && Number.isInteger(message.kind) && characters[message.kind]) {
        picks[other]=message.kind;
        paintPick(other);
      }
      break;
    case 'ready':
      if (phase === 'characters') {
        locked[other]=Boolean(message.ready);
        paintConfirmation(other);
      }
      break;
    case 'stage':
      if (guest && stages[message.index]) chooseStage(message.index);
      break;
    case 'start':
      if (guest && Array.isArray(message.picks) && message.picks.length===2 && message.picks.every(kind=>characters[kind]) && stages[message.stageIndex]) {
        picks.splice(0,2,...message.picks);
        chooseStage(message.stageIndex);
        startFight();
      }
      break;
    case 'key':
      if (guest || phase !== 'fight') break;
      if (Number.isSafeInteger(message.seq)) {
        if (message.seq<=online.acknowledgedInput) break;
        online.acknowledgedInput=message.seq;
      }
      applyOnlineKey(1,message.code,Boolean(message.down));
      break;
    case 'state':
      if (guest && (phase === 'countdown' || phase === 'fight' || phase === 'end')) {
        const previous=fighters[1];
        ({fighters,time,phase,banner}=message);
        countdown=message.countdown ?? 0;fightCue=message.fightCue ?? 0;
        effects=message.effects ?? [];
        if (reaction !== message.reaction) reactionStarted=performance.now();
        reaction=message.reaction;
        embrace=message.embrace && {a:fighters[message.embrace.player],b:fighters[1-message.embrace.player],time:message.embrace.time};
        reconcileGuestVisual(previous,message.ack);
        keys.clear();
        message.keys.forEach(code=>keys.add(code));
      }
      break;
    case 'audio':
      if (guest) {
        if (Object.hasOwn(clips,message.name)) playClip(message.name);
        else playCombatSound(message.name);
      }
      break;
    case 'selection':
      showCharacters();
      break;
  }
}
function predictAttack(a,slot,sequence) {
  if (a.nap) {
    if (slot===0 && !a.cloneAction) a.cloneAction=.26;
    return;
  }
  if (a.asleep || a.sleepRecovery || a.bedWalk) return;
  if (a.frozen || a.stun || a.guardBreak || a.snare || a.charge || a.action>.12 || a.recovery>0 || (a.cool[slot] || a.specialsInProgress?.[slot]) || online.localKeys.has(a.keys[3])) return;
  a.face=Math.sign(fighters[0].x-a.x) || a.face;
  a.label=slot===0 ? 'ATAQUE' : slot===3 ? 'CHUTE' : specials[a.kind][slot-1].toUpperCase();
  if(a.kind===0 && slot===2){a.label='FOOOON!';a.action=.65;}
  if (a.kind===1 && slot===1) a.label='ABRAÇO DOWN';
  if (a.kind===1 && slot===2){a.label='GORFINHO DE MORANGO';a.action=.72;}
  a.action=defaultActionDuration(a.kind,slot);
  if(a.kind===13 && (slot===1 || slot===2)) a.action=slot===1?.82:.84;
  if(a.kind===14 && slot===1) a.action=.82;
  if(a.kind===14 && slot===2){a.baby=3;a.action=.28;}
  if(a.kind===14 && a.baby>0 && (slot===0 || slot===3)) a.action=.28;
  if(a.kind===0 && slot===2)a.action=.82;
  if(a.kind===1 && slot===2)a.action=.88;
  if(a.kind===2 && (slot===1 || slot===2))a.action=slot===1?.65:.90;
  a.actionDuration=a.action;
  a.cool[slot]=cooldownFor(a,slot);
  a.recovery=a.kind===14 && a.baby>0 && (slot===0 || slot===3) ? (slot===0 ? .34 : .50) : slot===0 ? .68 : slot===3 ? .82 : .70;
  online.predictedAttack=sequence;
  if (a.kind===10 && slot===0 && a.printedTier>=0) a.label=printedItems[a.printedTier].toUpperCase();
  if (a.kind===7 && slot===1) a.frenzy=3;
  if (a.kind===7 && slot===2) a.regen=7;
  if (((a.kind===0 || a.kind===2) && slot===1) || (slot===2 && [3,11].includes(a.kind))) {
    beginCharge(a);
    online.predictedDash={sequence,face:a.face,origin:a.x,confirmed:false,endpoint:Math.max(55,Math.min(905,a.x+a.face*chargeDistance(a)))};
  }
}

function reconcileGuestVisual(previous,ack=0) {
  const confirmed=fighters[1];
  const visual=online.visual;
  const acknowledged=online.pendingInputs.filter(input=>input.seq<=ack);
  if (acknowledged.length) {
    const latest=acknowledged.at(-1);
    const sample=Math.min(.24,(performance.now()-latest.at)/2000);
    online.lead=(online.lead ?? sample)*.7+sample*.3;
    online.pendingInputs=online.pendingInputs.filter(input=>input.seq>ack);
  }
  const interrupted=Boolean(confirmed.stun || confirmed.snare || confirmed.flash || embrace || confirmed.warp!==previous.warp);
  const attackPending=online.predictedAttack>ack;
  if (interrupted || phase!=='fight') {
    online.visual={...confirmed,cool:[...confirmed.cool]};
    online.predictedAttack=0;
    online.predictedDash=null;
    return;
  }
  if (!attackPending) {
    const previousLabel=visual.label;
    const sameMove=previousLabel===confirmed.label && visual.action && confirmed.action;
    visual.actionDuration=confirmed.actionDuration;
    visual.action=sameMove ? Math.min(visual.action,confirmed.action) : confirmed.action;
    visual.label=confirmed.label;
    visual.recovery=confirmed.recovery;
    visual.buff=confirmed.buff;
    visual.frenzy=confirmed.frenzy;
    visual.regen=confirmed.regen;
    visual.baby=confirmed.baby;
    const dash=online.predictedDash;
    if (dash && ack>=dash.sequence) {
      if (confirmed.label!==previousLabel || (confirmed.charge && confirmed.face!==dash.face)) {
        online.predictedDash=null;
        visual.charge=confirmed.charge;
        visual.face=confirmed.face;
      } else if (confirmed.charge) {
        dash.confirmed=true;
        dash.endpoint=Math.max(55,Math.min(905,confirmed.x+dash.face*chargeDistance(confirmed)));
        visual.charge=Math.min(visual.charge,confirmed.charge);
        if (visual.kind!==3 || visual.charge<=.48) {
          visual.charge=Math.min(visual.charge,Math.max(0,(dash.endpoint-visual.x)*dash.face/800));
        }
      } else {
        visual.charge=0;
        online.predictedDash=null;
      }
    } else if (!dash) {
      visual.charge=confirmed.charge;
    }
    visual.cool=[...confirmed.cool];
    visual.specialsInProgress=confirmed.specialsInProgress;
  }
  visual.guardEnergy=confirmed.guardEnergy;
  visual.guardBreak=confirmed.guardBreak;
  visual.guardDelay=confirmed.guardDelay;
  visual.guardNotice=confirmed.guardNotice;
  visual.guardNeedsRelease=confirmed.guardNeedsRelease;
  visual.blockFlash=confirmed.blockFlash;
  visual.stun=confirmed.stun;
  visual.flash=confirmed.flash;
  visual.tumble=confirmed.tumble;
  visual.infectionTicks=confirmed.infectionTicks;
  visual.slow=confirmed.slow;visual.frozen=confirmed.frozen;visual.affection=confirmed.affection;
  visual.coffeeBurn=confirmed.coffeeBurn;
  visual.snare=confirmed.snare;
  visual.blood=confirmed.blood;
  visual.bloodX=confirmed.bloodX;
  visual.bloodY=confirmed.bloodY;
  visual.asleep=confirmed.asleep;
  visual.sleepRecovery=confirmed.sleepRecovery;
  visual.nap=confirmed.nap;
  visual.bedWalk=confirmed.bedWalk;
  visual.blanket=confirmed.blanket;
  visual.ascended=confirmed.ascended;
  visual.orsiStood ||= confirmed.orsiStood;
  visual.printedTier=confirmed.printedTier;
  visual.migraineLevel=confirmed.migraineLevel;
  visual.migraineTicks=confirmed.migraineTicks;
  visual.migraineClock=confirmed.migraineClock;
  visual.migrainePulse=confirmed.migrainePulse;
  visual.cloneX=confirmed.cloneX;
  visual.cloneAction=confirmed.cloneAction;
  visual.hp=confirmed.hp;
  if (confirmed.vx && previous.vx!==confirmed.vx) visual.vx=confirmed.vx;
  if (!online.pendingInputs.length && !online.localKeys.has(confirmed.keys[2]) && confirmed.y===ground && visual.y===ground) visual.vy=0;
}

function advanceGuestVisual(dt) {
  const visual=online.visual;
  const confirmed=fighters[1];
  const pressed=online.localKeys;
  updateGuard(visual,dt,pressed,false);
  if (embrace || confirmed.frozen || confirmed.stun || confirmed.guardBreak || confirmed.snare || confirmed.flash || confirmed.asleep || confirmed.sleepRecovery || confirmed.bedWalk) return confirmed;
  if (visual.nap) {
    visual.cloneAction=Math.max(0,visual.cloneAction-dt);
    moveClone(visual,pressed,dt);
    return visual;
  }
  for (const timer of ['buff','action','tumble','frenzy','regen','blood','baby','recovery','blockFlash']) visual[timer]=Math.max(0,visual[timer]-dt);
  visual.cool=visual.cool.map((value,slot)=>visual.specialsInProgress?.[slot] ? value : Math.max(0,value-dt));
  const dash=online.predictedDash;
  if (visual.charge) {
    const step=dash && !dash.confirmed && chargeDistance(visual,dt)>0
      ? Math.min(dt,Math.max(0,112-(visual.x-dash.origin)*dash.face)/800) : dt;
    advanceCharge(visual,step);
  } else if (!dash) moveFighter(visual,fighters[0],pressed,dt);
  applyMomentum(visual,dt);
  if (dash) {
    const toEndpoint=(dash.endpoint-visual.x)*dash.face;
    const toConfirmed=(confirmed.x-visual.x)*dash.face;
    if (!visual.charge && toEndpoint>0 && toConfirmed>0) {
      visual.x+=dash.face*Math.min(toConfirmed,toEndpoint,800*dt);
    }
    return visual;
  }
  if (!online.pendingInputs.length) {
    const guarding=isDefending(visual,pressed);
    const direction=visual.frenzy && !guarding ? (Math.abs(fighters[0].x-visual.x)>82 ? Math.sign(fighters[0].x-visual.x) : 0) : Number(pressed.has(visual.keys[1]))-Number(pressed.has(visual.keys[0]));
    const lead=online.lead ?? .06;
    const speed=fighterMoveSpeed(visual,guarding);
    const projectedX=confirmed.x+(visual.charge ? visual.face*800 : direction*speed)*lead;
    visual.x=Math.max(55,Math.min(905,visual.x+(projectedX-visual.x)*Math.min(1,dt*9)));
    if (!pressed.has(visual.keys[2]) && confirmed.y!==ground) {
      const projectedY=Math.min(ground,confirmed.y+confirmed.vy*lead+650*lead*lead);
      visual.y+=(projectedY-visual.y)*Math.min(1,dt*9);
    }
  }
  return visual;
}

async function roomRequest(action,body,signal) {
  const response=await fetch('/api/arena/'+action,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body),signal
  });
  const data=await response.json();
  if(!response.ok) throw Error(data.error || 'O serviço de salas não respondeu.');
  return data;
}

function leaveOnline(text,notify=true) {
  const session=online;
  online=null;
  if(session) {
    clearTimeout(session.timer);
    session.abort.abort();
    if(notify && session.token) roomRequest('leave',{code:session.code,token:session.token}).catch(()=>{});
  }
  roomStatus.textContent=text;
  start.disabled=false;
  showCharacters();
}

async function syncRoom(session) {
  if(online!==session || session.syncing) return;
  session.syncing=true;
  advanceOnlineHost();
  if (session.role==='host' && (phase==='countdown' || phase==='fight' || (phase==='end' && !session.finalSent))) {
    if (phase==='end') session.finalSent=true;
    sendOnline({type:'state',fighters,effects,time,phase,banner,reaction,countdown,fightCue,
      embrace:embrace && {player:embrace.a.i,time:embrace.time},keys:[...keys],ack:session.acknowledgedInput});
  }
  const sentAck=session.acknowledgedInput;
  const messages=session.queue.splice(0,63);
  if(session.snapshot) {messages.push(session.snapshot);session.snapshot=null}
  const prune=session.after!==session.lastPruned ? session.after : 0;
  try {
    const data=await roomRequest('sync',{code:session.code,token:session.token,after:session.after,prune,messages},AbortSignal.any([session.abort.signal,AbortSignal.timeout(6000)]));
    if(online!==session) return;
    if(prune) session.lastPruned=prune;
    if(data.connected && !session.conn.open) {
      session.conn.open=true;
      showCharacters();
      roomStatus.textContent=session.role==='host' ? 'Player 2 conectado. Escolha seu lutador.' : 'Conectado como Player 2. Escolha seu lutador.';
    }
    for(const event of data.events) {
      session.after=event.id;
      for(const message of JSON.parse(event.payload)) receiveOnline(message);
    }
  } catch(error) {
    if(online===session) leaveOnline(error.name==='TimeoutError' ? 'A conexão com a sala expirou. Tente novamente.' : error.message,false);
    return;
  }
  session.syncing=false;
  const interval=session.queue.length || session.acknowledgedInput!==sentAck ? 0 : (phase==='fight' || phase==='countdown') ? 30 : session.conn.open ? 150 : 650;
  session.timer=setTimeout(()=>syncRoom(session),interval);
}

async function openRoom(role,code) {
  cpu.active=false;resetCPU();
  if(online) leaveOnline('');
  const session={role,conn:{open:false},abort:new AbortController(),queue:[],snapshot:null,simulatedAt:0,after:0};
  online=session;
  updateModeUI();
  roomStatus.textContent=role==='host' ? 'Criando sala…' : 'Entrando na sala…';
  try {
    const data=await roomRequest(role==='host' ? 'create' : 'join',{code},AbortSignal.any([session.abort.signal,AbortSignal.timeout(8000)]));
    if(online!==session) return;
    Object.assign(session,data);
    if(role==='host') roomStatus.textContent='Código '+session.code+' · Envie ao Player 2 e aguarde.';
    syncRoom(session);
  } catch(error) {
    if(online===session) leaveOnline(error.name==='TimeoutError' ? 'O serviço de salas demorou a responder. Tente novamente.' : error.message,false);
  }
}
document.querySelector('#create-room').onclick=()=>openRoom('host');
document.querySelector('#join-room').onclick=()=>{
  const code=document.querySelector('#room-code').value.trim().toUpperCase();
  if (/^[0-9A-F]{10}$/.test(code)) openRoom('guest',code);
  else roomStatus.textContent='Digite o código de 10 caracteres do Player 1.';
};
document.querySelector('#local-mode').onclick=()=>setPlayMode(false);
document.querySelector('#cpu-mode').onclick=()=>setPlayMode(true);
const fullscreenButton=document.querySelector('#fullscreen');
fullscreenButton.onclick=async()=>{
  try {
    if(document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    fullscreenButton.textContent='Use F11 para tela cheia';
  }
};
document.addEventListener('fullscreenchange',()=>{
  const isFullscreen=Boolean(document.fullscreenElement);
  fullscreenButton.textContent=isFullscreen ? 'Sair da tela cheia ⛶' : 'Tela cheia ⛶';
  fullscreenButton.setAttribute('aria-label',isFullscreen ? 'Sair da tela cheia' : 'Ativar tela cheia');
});
showCharacters();
requestAnimationFrame(frame);
