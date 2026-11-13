'use strict';
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';
const start = document.querySelector('#start');
const keys = new Set();
const stageNames = ['Milkshake Down','Arena de Combate'];
const selection = document.querySelector('#selection');
const characterScreen = document.querySelector('#characters');
const stageScreen = document.querySelector('#stages');
const controls = document.querySelector('.controls');
let stageIndex = 0;
let online = null;
let countdown=0,fightCue=0;
const cpu={active:false,think:0,guard:0,jump:0,move:0};
const stages = ['lanchonete.webp','arena-combate.webp'].map(file => {
  const image = new Image();
  image.src = file;
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
const bull = loadFrame('bull');
const ambulance = loadFrame('4-ambulance-0');
const nurses = [0,1,2].map(i=>loadFrame('4-nurse-'+i));
const chocolate = loadFrame('4-chocolate-0');
const printedItemSprites = [0,1,2].map(i=>loadFrame('10-item-'+i));
const guineaFowl = [0,1].map(i=>loadFrame('6-bird-'+i));
const sleepBlanket=loadFrame('8-blanket-0');
const physio=[0,1].map(i=>loadFrame('9-physio-'+i));
const tabletShip=loadFrame('12-ship-0');
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
const characters = [...roster,{name:'Maycon',color:'#cda3ff'},{name:'Caleca',subtitle:'O Surfista Prateado',color:'#d8ebff'},{name:'Leandro Marçal',color:'#ffb1ad'},{name:'Pupinho',color:'#d6f77c'},{name:'Fabio Toscana',color:'#8fc8ff'},{name:'Angélica do Mounjaro',color:'#ff9def'},{name:'Gabriel Soneca do Almoço',color:'#d1b0ff'},{name:'Orsi Chefinho',color:'#ffd797'},{name:'Matheus the Printer',color:'#b6efbc'},{name:'Paulo Feliz',color:'#ffe28b'},{name:'CyberAlfredo',color:'#7ae9ff'},{name:'Lucreci do Pataco',subtitle:'Cabeção Natural',color:'#31c9f5',passive:'Causa até 40% mais dano contra campeões que evoluem, ficam maiores ou entram em forma ampliada.',portrait:'frames/13-portrait.png'},{name:'DêDêw',subtitle:'Punhos fortes',color:'#ffc477',passive:'Mão gradona: +15% de força. DêDêwzinhu aumenta a força e a velocidade dos golpes por 3 segundos.',portrait:'frames/14-portrait.png'}];
characters.forEach((character,kind)=>{character.portrait='frames/'+kind+'-portrait.webp';});
const specials = [['Matador de Onça','Foon'],['Super Abraço','Milkshake Turbo'],['Granada de Fumaça','Avanço Tático'],['Brilho da Careca','Surfista Prateado'],['Equipe de Socorro','Comedor de Açúcar!'],['Peido Infectante','Cutucada na Orelha'],['Toscana Desenrolada','Galinhas da Angola'],['Seringa da Loucura','Pílula da Regeneração'],['Dorme Neném','Hora do Cochilo'],['Invocação da Fisioterapeuta','Queijo Gorfado'],['Ovo Imprimir em','SuperEnxaqueca'],['Golpe da Felicidade','Investida da Felicidade'],['Poder dos Tablets','Taco de Beiseball'],['Molho de pimenta','Investida do Pataco'],['Esguicho do café','DêDêwzinhu']];
const picks = [0,1];
const locked = [false,false];
const cardGroups = [...document.querySelectorAll('.fighter-cards')];
const stageCards = [...document.querySelectorAll('.stage-card')];
const visibleHeadGrowth=[0,0];
let fighters, effects, time, phase, banner, last, embrace, audio, reaction, reactionStarted, waitingForPedro;
let pedroAudioBus;
function pedroPower(a,b) {
  if(a.kind!==0) return 1;
  if(fighters.some(f=>f.kind===9 && f.ascended)) return .7;
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
  for(const clip of Object.values(clips)) clip.muted=false;
  if(pedroAudioBus)pedroAudioBus.gain.value=1;
  stopMatheusAudio();
  resetCPU();
  fighters = picks.map((kind,i) => ({
    ...characters[kind], keys:roster[i].keys,i,kind,x:i ? 720 : 240,y:ground,
    deaf:0,feminineAbility:0,vy:0,vx:0,face:i ? -1 : 1,hp:100,stun:0,buff:0,charge:0,dazzle:0,tumble:0,infectionTicks:0,infectionClock:0,warp:0,snare:0,frenzy:0,regen:0,blood:0,bloodX:0,bloodY:0,asleep:0,sleepRecovery:0,nap:0,bedWalk:0,blanket:false,cloneX:0,cloneAction:0,ascended:false,migraineLevel:0,migraineTicks:0,migraineClock:0,migrainePulse:0,printedTier:-1,joyClock:0,tech:0,growthRead:0,growthPercent:0,baby:0,coffeeBurn:0,coffeeClock:0,
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
  return a.hp>0 && a.guardEnergy>1e-8 && !a.guardBreak && !a.guardNeedsRelease && pressed.has(a.keys[3]) && a.y===ground && !a.stun && !a.snare && !a.asleep && !a.sleepRecovery && !a.nap && !a.bedWalk && !a.charge && !a.tumble;
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
function guardBlocks(a,cost=25){
  if(!isDefending(a))return false;
  a.guardEnergy=Math.max(0,a.guardEnergy-cost);a.guardDelay=1;
  if(a.guardEnergy<1e-8){breakGuard(a);return true;}
  if(!a.blockFlash)sound('block');
  a.blockFlash=.24;
  return true;
}
function hit(a,b,damage,push,stun,grab = false, blanketHit = false, specialSlot = 0) {
  if (!b.hp || (a.kind===8 && (b.asleep || b.sleepRecovery) && !blanketHit)) return false;
  if(guardBlocks(b,specialSlot ? 25 : a.label==='CHUTE' ? 15 : 10))return false;
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
  damageFighter(b,damage*pedroPower(a,b)*(a.buff ? 1.45 : 1)*power*sleepPower*sleepDefense*(a.ascended ? 1.35 : 1)*(1+growthBonus)*(a.kind===14 ? (a.baby>0 ? 1.65 : 1.15) : 1),true);
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
  target.hp=Math.max(0,target.hp-damage*.55);
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
  'foon-wave':2,rescue:1,chocolate:2,gas:1,teleport:2,toscana:1,'guinea-fowl':2,
  blanket:1,pillow:2,physio:1,cheese:2,print:1,'joy-heart':2,'tablet-ship':1,tablet:1,battery:2,'tablet-blast':2,'lucreci-fire':1,'lucreci-money':2,'dedew-coffee':1
};
const ongoingSpecialStates=[
  [['charge'],[]], [[],['buff']], [[],['charge']], [[],['charge']],
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
  return specialHit(a,b,specialEffectSlots[effect.kind] ?? 0,damage,push,stun,grab,blanketHit);
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
        effects.some(effect=>effect.owner===a.i && specialEffectSlots[effect.kind]===slot);
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
  if (embrace || a.stun || a.snare || a.charge || a.action > .12 || a.recovery>0 || (a.cool[slot] || a.specialsInProgress[slot]) || keys.has(a.keys[3])) return;
  a.face = Math.sign(b.x-a.x) || a.face;
  a.cool[slot] = cooldownFor(a,slot);
  a.recovery=a.kind===14 && a.baby>0 && (slot===0 || slot===3) ? (slot===0 ? .34 : .50) : slot===0 ? .68 : slot===3 ? .82 : .70;
  startSpecial(a,slot);
  a.action = .42;
  a.actionDuration=.42;
  const close = Math.abs(a.y-b.y) < 75;
  const gap = Math.abs(a.x-b.x);
  if (slot === 3) {
    a.label = 'CHUTE';
    if(a.kind===14 && a.baby>0) a.action=a.actionDuration=.28;
    if (close && gap < 146) hit(a,b,13,290,.24);
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
    playClip(a.kind === 1 ? 'slap' : 'punch');
    if (close && gap < 112) hit(a,b,9,190,.18);
  } else if (slot === 1 && a.kind === 0) {
    a.label = 'MATADOR DE ONÇA';
    playClip('bull');
    sound('bull');
    beginCharge(a);
    
  } else if (a.kind===14) {
    if(slot===1){
      a.label='ESGUICHO DO CAFÉ';a.action=a.actionDuration=.62;
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
      a.action=a.actionDuration=.60;
      playClip('punch');
      effects.push({kind:'lucreci-fire',owner:a.i,x:a.x,y:a.y,face:a.face,time:0,hit:false});
    } else if (slot===2) {
      a.label='INVESTIDA DO PATACO';
      a.action=a.actionDuration=.62;
      playClip('punch');
      effects.push({kind:'lucreci-money',owner:a.i,x:a.x,y:a.y,face:a.face,time:0,hit:false});
    }
  } else if (a.kind===12) {
    const powered=a.tech===3;
    a.tech=powered ? 0 : a.tech+1;
    if (powered) a.cool[slot]*=.85;
    a.label=slot===1 ? 'PODER DOS TABLETS' : 'TACO DE BEISEBALL';
    effects.push({kind:slot===1 ? 'tablet-ship' : 'battery',owner:a.i,
      x:slot===1 ? (a.face>0 ? -68 : 1028) : a.x,y:a.y,face:a.face,
      time:0,hit:false,powered,nextDrop:.23});
  } else if (a.kind===11) {
    if (slot===1) {
      a.label='GOLPE DA FELICIDADE';
      if (close && gap<300) specialHit(a,b,1,14,-260,.25);
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
      a.label = 'GRANADA DE FUMAÇA';
      playClip('mayconPunch');
      if (close && gap < 245) specialHit(a,b,1,10,110,.95);
    } else {
      a.label = 'AVANÇO TÁTICO';
      playClip('mayconDash');
      beginCharge(a);
    }
  } else if (slot === 1) {
    a.label = 'SUPER ABRAÇO';
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
    a.action=a.actionDuration=.65;
    playClip('horn');
    effects.push({kind:'foon-wave',owner:a.i,x:a.x,y:a.y,face:a.face,time:0,hit:false});
  } else {
    a.label = 'MILKSHAKE TURBO';
    playClip('milk');
    sound('sip');
    a.buff = 4.5;
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
        chooseStage((stageIndex+1)%stages.length);
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
  stageIndex=index;
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
    case 1:return [gap<115,gap<400 && !a.buff];
    case 2:return [gap<360,gap>140 && gap<650];
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
      specialHit(a,b,1,20,575,.48,true);
      holdSpecial(a,1,'tumble');
      b.vy = -285;
      b.tumble = .55;
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
    if (a.charge) {
      const distance=advanceCharge(a,dt);
      if (a.kind===11 && a.charge===0 && a.hp) {
        const x=Math.max(55,Math.min(905,a.x));
        effects.push({kind:'joy-heart',owner:a.i,x,y:a.y,face:Math.sign(b.x-x)||a.face,time:0,hit:false});
      }
      if (a.kind!==11 && distance>0 && !a.chargedHit && Math.abs(a.x-b.x)<110 && b.y>ground-68) {
        const landed=specialHit(a,b,a.kind===0 ? 1 : 2,a.kind===3 ? 24 : 22,425,.5);
        if(a.kind===0 && landed){b.tumble=.65;b.vy=-220;holdSpecial(a,1,'tumble');}
        a.chargedHit = true;
      }
    } else if (!a.stun && !a.guardBreak && !isDefending(a)) {
      moveFighter(a,b,keys,dt);
      if (a.frenzy && Math.abs(a.x-b.x)<100 && Math.abs(a.y-b.y)<75 && !a.cool[0] && !a.action && !a.recovery) {
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
    if (target.hp && (body || Math.hypot(target.x-blast.x,target.y-75-blast.y)<=radius)) {
      effectHit(blast,{...attacker,face:effect.face},target,tablet ? (powered ? 29 : 24) : (powered ? 18 : 15),350,.38);
    }
  }
  return true;
}
function effectPosition(effect) {
  if (effect.kind==='joy-heart') return effect.x+effect.face*(21+520*effect.time);
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
function updateEffects(dt) {
  for (const effect of effects) {
    const old=effectPosition(effect);
    effect.time+=dt;
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
      if (!effect.hit && target.hp && Math.abs(target.y-effect.y)<82 &&
          target.x>=Math.min(old,x)-34 && target.x<=Math.max(old,x)+34) {
        effectHit(effect,{...attacker,face:effect.face},target,19,290,.32);
        effect.hit=true;
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
        attacker.action=.30;
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
    effect.time=rescue ? .99 : .92;
  }
  const duration={'foon-wave':.65,'dedew-coffee':.85,'dedew-quake':.46,rescue:1.15,chocolate:1.05,gas:1.30,teleport:.49,toscana:.56,'guinea-fowl':.94,blanket:2.16,pillow:.85,physio:1.03,cheese:3.4,print:.70,'printed-shot':.65,'joy-heart':.47,'tablet-ship':1.74,tablet:1,battery:1.30,'tablet-blast':.37,'lucreci-fire':.82,'lucreci-money':1.02};
  effects=effects.filter(effect=>effect.time<duration[effect.kind] && !((effect.kind==='tablet' || effect.kind==='battery') && effect.hit));
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
function drawGuineaFowl(x,y,face,step) {
  for (let i=0;i<3;i++) {
    const bird=guineaFowl[(Math.floor(step*15)+i)%2];
    drawEffectSprite(bird,x+face*(i-1)*37,y+Math.sin(step*22+i*1.4)*5-i%2*12,70,face);
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
      oval(x,y,4+i%3,3,i%2 ? '#ffc459' : '#72e9ff');
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
    drawEffectSprite(tabletShip,x,y+25,190,effect.face);
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
    oval(old.x,old.y,12-i,3,tablet ? '#76e6ff' : '#fef294');
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
  const spread=Math.min(1,Math.max(0,(effect.time-.16)/.30));
  if (spread<=0) return;
  const reach=72+spread*190;
  ctx.save();
  ctx.translate(effect.x+effect.face*31,effect.y-101);
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
  const age=Math.max(0,effect.time-.18);
  if (effect.time<.18) return;
  for(let i=0;i<8;i++){
    const travel=age*(590+i*44)+i*11;
    const x=effect.x+effect.face*(52+travel);
    const y=effect.y-91+Math.sin(age*13+i*1.8)*23-(i%3)*11;
    ctx.save();ctx.translate(x,y);ctx.scale(effect.face,1);ctx.rotate(Math.sin(age*10+i)*.35);
    ctx.fillStyle=i%2?'#78d786':'#b8e98a';ctx.strokeStyle='#f0edba';ctx.lineWidth=1.5;
    ctx.fillRect(-12,-7,24,14);ctx.strokeRect(-12,-7,24,14);
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
function drawEffects() {
  for (const effect of effects) {
    if(effect.kind==='foon-wave'){
      ctx.save();ctx.translate(effect.x+effect.face*(35+effect.time*600),effect.y-75);ctx.scale(effect.face,1);
      ctx.strokeStyle='#e693ff';ctx.lineWidth=4;ctx.globalAlpha=1-effect.time/.7;
      for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(-i*19,0,30+effect.time*45,-1.1,1.1);ctx.stroke();}ctx.restore();continue;
    }
    if(effect.kind==='dedew-coffee'){drawDedewCoffee(effect);continue;}
    if(effect.kind==='dedew-quake'){drawDedewQuake(effect);continue;}
    if (drawTechEffect(effect)) continue;
    if (effect.kind==='lucreci-fire') { drawLucreciFire(effect); continue; }
    if (effect.kind==='lucreci-money') { drawLucreciMoney(effect); continue; }
    if (effect.kind==='joy-heart') {
      if (!effect.hit) text('♥',effectPosition(effect),effect.y-76,47,'#ff63b4');
      continue;
    }
    if (effect.kind==='print') { drawPrinter(effect); continue; }
    if (effect.kind==='printed-shot') {
      if (!effect.hit) oval(effectPosition(effect),effect.y-86,12,3,'#ffe08d');
      continue;
    }
    if (effect.kind==='physio') {
      const x=effect.x+effect.face*72;
      if (effect.time<.25) {
        const t=effect.time/.25;
        ctx.save();ctx.translate(effect.x+effect.face*(24+t*48),effect.y-78+t*73);
        ctx.rotate(t*2*effect.face);rect(-18,-7,36,14,'#ec3348');ctx.restore();
      } else {
        drawEffectSprite(physio[effect.time<.43 ? 0 : 1],x,ground,185,effect.face);
        if (!effect.hit && effect.time>=.43) {
          oval(effectPosition(effect),ground-83,13,4,'#ffe06a');
          oval(effectPosition(effect)-effect.face*13,ground-83,6,2,'#ffab47');
        }
      }
      continue;
    }
    if (effect.kind==='cheese') {
      const x=effectPosition(effect);
      if (effect.time>=.24 && effect.time<.42) {
        for (let i=0;i<9;i++) {
          const f=(i+1)/10;
          oval(effect.x+(x-effect.x)*f,effect.y-113+f*f*107-Math.sin(f*5)*22,8+i,5+i/2,'#f8bd36');
        }
      } else if (effect.time>=.42) {
        oval(x,ground+4,69,10,'#bc6828');
        oval(x,ground+1,64,8,'#f8bc39');
        oval(x-13,ground-1,31,3,'#ffe18a');
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
      const end=effect.impact ?? effectPosition(effect);
      const count=Math.max(2,Math.round(Math.abs(end-effect.x)/19));
      for (let i=0;i<count;i++) {
        const f=(i+1)/count,x=effect.x+(end-effect.x)*f;
        const y=effect.y-79-Math.sin(f*3.8+effect.time*9)*28;
        oval(x,y,13,8,'#612834');
        oval(x,y-1,11,6,'#cb6543');
        oval(x-2,y-4,7,2,'#ffb582');
      }
      if (effect.hit) text('✦',end,effect.y-115,27,'#ffdc91');
      continue;
    }
    if (effect.kind==='guinea-fowl') {
      if (!effect.hit && effect.time>.14) drawGuineaFowl(effectPosition(effect),ground,effect.face,effect.time);
      continue;
    }
    if (effect.kind==='gas') {
      const x=effectPosition(effect), radius=35+Math.min(effect.time,.75)*69;
      const alpha=Math.min(.58,effect.time*3,(1.30-effect.time)*2);
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
      ctx.strokeStyle='#dc82ff';
      ctx.lineWidth=6;
      ctx.beginPath();
      ctx.ellipse(x,y-75,21,66,0,0,Math.PI*2);
      ctx.stroke();
      ctx.restore();
      if (effect.destination!==undefined) text('!',x+fighters[effect.owner].face*55,y-143,30,'#ffdf75');
      continue;
    }
    if (effect.kind==='rescue') {
      const approach=Math.min(1,effect.time/.36);
      const vanX=effect.x+effect.face*(-340+approach*360);
      drawEffectSprite(ambulance,vanX,ground+10,236,effect.face);
      if (effect.time>.34) {
        const x=effect.hit ? effect.impact : effectPosition(effect);
        const pose=effect.hit ? 2 : Math.floor(effect.time*14)%2;
        drawEffectSprite(nurses[pose],x-effect.face*31,ground-14,78,effect.face);
        drawEffectSprite(nurses[pose],x,ground,102,effect.face);
      }
    } else if (!effect.hit && effect.time>=.17) {
      drawEffectSprite(chocolate,effectPosition(effect),effect.y-77,69,effect.face);
    }
    if (effect.hit) oval(effect.impact,Math.min(ground,effect.y)-65,18,12,'#ffe0b897');
  }
}

function beginCharge(a) {
  a.charge=a.kind===0 ? .56 : a.kind===3 ? .62 : a.kind===11 ? .36 : .44;
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
  if(a.guardBreak)return;
  const gap=b.x-a.x;
  const direction = a.frenzy ? (Math.abs(gap)>82 ? Math.sign(gap) : 0)
    : Number(pressed.has(a.keys[1]))-Number(pressed.has(a.keys[0]));
  a.moveTime = direction ? a.moveTime+dt : 0;
  a.x += direction * (a.kind === 0 ? 280 : 222) * (a.moveTime > .32 ? 1 : .69) * (a.buff ? 1.52 : a.frenzy ? 1.78 : a.ascended ? 1.32 : 1) * dt;
  if (pressed.has(a.keys[2])) jump(a,pressed);
  a.face = Math.sign(b.x-a.x) || a.face;
}
function jump(a,pressed) {
  if (a.y === ground && !a.stun && !a.guardBreak && !a.snare && !a.asleep && !a.sleepRecovery && !a.nap && !a.bedWalk && !a.charge && !pressed.has(a.keys[3])) a.vy=-520;
}
function applyMomentum(a,dt) {
  a.x = Math.max(55,Math.min(905,a.x+a.vx*dt));
  a.vx *= Math.exp(-7*dt);
  a.vy += 1300*dt;
  a.y = Math.min(ground,a.y+a.vy*dt);
  if (a.y === ground) a.vy = 0;
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

function limb(x,y,endX,endY,width,color) {
  ctx.strokeStyle=color;
  ctx.lineWidth=width;
  ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(x,y);
  ctx.lineTo(endX,endY);
  ctx.stroke();
}

function customer(x,y,face,step,shirt,skin,carrying) {
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(face,1);
  oval(0,2,18,4,'#22102590');
  const stride=Math.sin(step)*9;
  const bob=Math.abs(Math.sin(step))*3;
  limb(-5,-24,-7+stride,-4,8,'#292038');
  limb(6,-24,7-stride,-4,8,'#372745');
  oval(-5+stride,-3,7,3,'#d7accb');
  oval(9-stride,-3,7,3,'#d7accb');
  oval(0,-37-bob,13,19,shirt);
  oval(0,-64-bob,10,12,skin);
  oval(-2,-69-bob,10,7,'#2c1831');
  limb(-8,-45-bob,-11+stride*.5,-29,6,skin);
  limb(9,-44-bob,carrying ? 19 : 11-stride*.5,carrying ? -39-bob : -27,6,skin);
  if(carrying) {
    rect(16,-53-bob,8,12,'#ffc6dc');
    limb(21,-54-bob,24,-59-bob,2,'#ff79bf');
  }
  ctx.restore();
}

const fans = [
  [79,138],[112,144],[154,150],[198,155],[223,159],
  [736,157],[773,151],[809,145],[846,139],[877,131],
  [277,237],[303,236],[366,237],[413,238],[461,238],
  [506,238],[548,238],[601,237],[641,237],[699,236]
];

function cheer(t) {
  fans.forEach(([x,y],i) => {
    const pulse=Math.sin(t*(3.2+i%3)+i*1.4);
    const lift=Math.max(0,pulse)*7;
    const sway=Math.sin(t*2+i)*3;
    const color=['#542068','#713078','#48205e','#93317a'][i%4];
    const low=i>=10;
    const cutoff=low ? 237 : y;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x-16,cutoff-44,32,44);
    ctx.clip();
    oval(x+sway,y-6-lift,7,11,color);
    oval(x+sway,y-17-lift,5,5,color);
    limb(x+sway-4,y-9-lift,x-9,y-13-lift-8*Math.max(0,pulse),4,color);
    limb(x+sway+4,y-9-lift,x+10,y-15-lift-7*Math.max(0,-pulse),4,color);
    if(i%3===0) limb(x+10,y-17-lift,x+12,y-26-lift,2,i%2 ? '#fa8de5' : '#a0b3ff');
    ctx.restore();
  });
}

const schoolArena=new Image();
schoolArena.src='escola-orsi.webp';
function drawSchool() {
  if (schoolArena.complete && schoolArena.naturalWidth) {
    ctx.drawImage(schoolArena,0,0,960,500);
    return;
  }
  const sky=ctx.createLinearGradient(0,0,0,350);
  sky.addColorStop(0,'#273460');sky.addColorStop(1,'#e394ab');
  rect(0,0,960,500,sky);
  rect(0,302,960,198,'#5f617b');
  rect(0,373,960,4,'#a7acbe');
  rect(102,133,756,199,'#d49a79');
  rect(102,133,756,12,'#593c67');
  rect(114,153,732,8,'#eec0a1');
  for (let row=0;row<2;row++) for (let i=0;i<7;i++) {
    if (i===3) continue;
    const x=130+i*101,y=177+row*68;
    rect(x,y,68,46,'#493d60');rect(x+4,y+4,60,38,'#7fb0cb');
    rect(x+33,y,3,46,'#453e5c');rect(x,y+22,68,3,'#453e5c');
  }
  rect(422,238,116,94,'#453653');rect(428,244,104,88,'#657c95');
  rect(477,244,6,88,'#40364e');
  rect(369,157,222,55,'#303653');
  text('ESCOLA',480,194,34,'#fff2c3');
  for (const x of [44,916]) {
    rect(x-7,235,14,110,'#513c50');
    oval(x,225,54,55,'#325d66');
    oval(x+10,203,39,39,'#457772');
  }
  for(let i=0;i<6;i++) rect(285+i*77,427,49,3,'#aca8ba');
}
function arena() {
  if (fighters.some(a=>a.ascended)) { drawSchool(); return; }
  const index=stageIndex;
  const image=stages[index];
  if(image.complete && image.naturalWidth) {
    ctx.drawImage(image,0,0,960,500);
  } else {
    rect(0,0,960,500,'#341d3a');
    rect(0,ground,960,500-ground,'#493047');
  }
  const t=last/1000;
  if(index===0) {
    const walk=(min,max,speed,offset,y,shirt,skin,carrying) => {
      const progress=((t*speed+offset)%(2*(max-min)));
      const face=progress<max-min ? 1 : -1;
      const x=face===1 ? min+progress : max-(progress-(max-min));
      customer(x,y,face,t*9+offset,shirt,skin,carrying);
    };
    walk(95,280,43,0,340,'#7c3379','#ce8a6d',true);
    walk(320,638,47,161,333,'#304b70','#e0a07d',true);
    walk(676,866,38,29,346,'#88434f','#b97964',false);
  } else {
    cheer(t);
  }
  const shade=ctx.createLinearGradient(0,0,0,106);
  shade.addColorStop(0,'#12091be8');
  shade.addColorStop(1,'#12091b00');
  rect(0,0,960,106,shade);
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

function drawPedroHD(a,tile,state,moving){
  if(!tile?.complete || !tile.naturalWidth)return;
  const clock=(last || 0)/1000;
  const breath=state==='idle' || state==='guard' ? Math.sin(clock*3.5)*.003 : 0;
  const stride=moving && !a.action && !a.charge ? Math.sin(clock*(state==='run' ? 22 : 13)) : 0;
  const scale=.30;
  ctx.save();ctx.translate(a.x,a.y-Math.abs(stride)*(state==='run' ? 2.5 : .8));ctx.scale(a.face,1+breath);
  ctx.drawImage(tile,-384*scale,-720*scale,768*scale,768*scale);ctx.restore();
}
function fighter(a,pressed = keys) {
  const guard = isDefending(a,pressed);
  const lift = 0;
  if(a.deaf>0)text('SURDEZ '+a.deaf.toFixed(1)+'s',a.x,a.y-175,13,'#edb1ff');
  if(a.kind===0 && phase==='fight')text(pedroPower(a,fighters[1-a.i])<1 ? 'MEDO DO ADÉLIA −30%' : pedroPower(a,fighters[1-a.i])>1 ? 'CAMPEÃO DA ROÇA +30%' : '',a.x,a.y-193,12,'#ffdc78');
  oval(a.x,ground+8,44,9,'#160c20');
  const moving = phase === 'fight' && (pressed.has(a.keys[0]) || pressed.has(a.keys[1]));
  const special = a.charge || embrace?.a === a || (a.action && ['FOOOON!','SUPER ABRAÇO','MILKSHAKE TURBO','GRANADA DE FUMAÇA','BRILHO DA CARECA','COMEDOR DE AÇÚCAR!','PEIDO INFECTANTE','TOSCANA DESENROLADA','SERINGA DA LOUCURA','DORME NENÉM','INVOCAÇÃO DA FISIOTERAPEUTA','OVO IMPRIMIR EM','SUPERENXAQUECA','GOLPE DA FELICIDADE','PODER DOS TABLETS','MOLHO DE PIMENTA','INVESTIDA DO PATACO','ESGUICHO DO CAFÉ','DÊDÊWZINHU'].includes(a.label));
  const state = a.hp === 0 ? 'fall'
    : a.nap ? 'sleep'
    : a.asleep ? 'fall'
    : a.sleepRecovery ? (a.sleepRecovery>.12 ? 'rise' : a.kind===9 && a.ascended ? 'guard' : 'idle')
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
    : special ? 'special'
    : a.action ? (a.label === 'CHUTE' ? 'kick' : 'punch')
    : a.y < ground ? (a.kind===0 || a.kind >= 2 ? 'jump' : 'kick')
    : a.kind===9 && !a.ascended ? 'idle'
    : a.frenzy ? 'run'
    : moving ? (a.buff || a.moveTime > .32 ? 'run' : 'walk')
    : a.kind===9 && a.ascended ? 'guard' : 'idle';
  if (a.kind===11 && a.charge) {
    const colors=['#ff668e','#ffc160','#fff478','#62ec8a','#7ecbff','#be91ff'];
    colors.forEach((color,i)=>{
      ctx.strokeStyle=color;ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(a.x-a.face*128,a.y+7-i*3);
      ctx.quadraticCurveTo(a.x-a.face*60,a.y-37-i*3,a.x+a.face*20,a.y+6-i*3);
      ctx.stroke();
    });
  }
  const alfredoCast=a.kind===12 && alfredoCastFrames[state];
  const transformed=a.kind===14 && a.baby>0;
  const tiles=alfredoCast || (state==='special' && a.kind===10 ? sprites[10].guard : sprites[a.kind][state]) || sprites[a.kind].idle;
  const animatedAttack=['special','punch','kick','teleport','pill','cheese','bat','wallet'].includes(state);
  const remaining=embrace?.a===a ? .42*(1-embrace.time/.58) : a.action;
  const duration=a.kind===0 || a.kind>=13 ? (a.actionDuration || .42) : .42;
  const frameIndex=alfredoCast ? alfredoCastFrame(state,a.action) : animatedAttack && a.action
    ? Math.max(0,Math.min(tiles.length-1,Math.floor((1-Math.min(duration,remaining)/duration)*tiles.length)))
    : Math.floor((last || 0)/(moving ? 105 : 245))%tiles.length || 0;
  const chargeFrame = a.kind===0 && state==='charge' ? Math.min(tiles.length-1,Math.floor((.56-a.charge)/.56*tiles.length)) : a.kind===3 && (state==='transform' || state==='dash')
    ? Math.min(tiles.length-1,Math.max(0,Math.floor((state==='transform' ? (.62-a.charge)/.14 : (.48-a.charge)/.48)*tiles.length)))
    : frameIndex;
  const preferred=phase==='end' && a.kind===1 && a.hp>fighters[1-a.i].hp ? celebration : tiles[chargeFrame];
  const tile=preferred?.complete && preferred.naturalWidth ? preferred : sprites[a.kind].idle.find(image=>image.complete && image.naturalWidth);
  if(a.kind===0){
    drawPedroHD(a,tile,state,moving);
  }else if(transformed){
    drawBabyChampion(a,state,moving);
  }else if(tile?.complete && tile.naturalWidth){
    const scale = a.kind===0 ? (state==='charge' ? 1.10 : state==='special' ? .97 : 1.4) : a.kind===14 ? (a.baby>0 ? .67 : state==='special' ? 1 : 1.38) : a.kind===13 ? (state==='special' || state==='wallet' ? 1 : 1.38) : a.kind===12 ? 1.53 : a.kind===11 ? (state==='special' || state==='dash' ? 1.10 : 1.53) : a.kind===9 ? (state==='special' || state==='cheese' ? 1.03 : a.ascended ? 1.69 : 1.52) : a.kind===8 ? (state==='sleep' ? .78 : state==='special' ? 1.13 : 1.45) : a.kind===7 ? (state==='special' || state==='pill' ? 1.05 : 1.53)*(1+evolution(a)*.07) : a.kind===3 ? (state==='transform' || state==='dash' ? .97 : state==='special' ? .9 : 1.51)
      : a.kind === 5 ? (state==='special' || state==='teleport' ? .98 : 1.34) : a.kind===6 ? (state==='special' || state==='call' ? 1.02 : 1.35) : a.kind === 2 || a.kind === 4 ? 1.33 : tile.naturalHeight > 110 ? 1.08 : 1.57;
    ctx.save();
    ctx.translate(a.x,a.y-lift);
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
    if (a.action && a.label==='GOLPE DA FELICIDADE') {
      text('HA HA HA!',a.x+a.face*61,a.y-161,21,'#fff28b');
      ctx.strokeStyle='#ffc366';ctx.lineWidth=3;
      for(let i=0;i<3;i++){
        ctx.beginPath();ctx.ellipse(a.x+a.face*(59+i*32),a.y-103,9+i*2,17+i*7,0,0,Math.PI*2);ctx.stroke();
      }
    }
  }
  if (a.kind===10 && a.hp && a.printedTier>=0) drawPrintedItem(a);
  if (a.kind===10 && a.hp && (a.migraineTicks || a.migrainePulse)) drawMigraine(a);
  if (a.hp && (a.asleep || a.nap)) {
    if (a.blanket && sleepBlanket.complete && sleepBlanket.naturalWidth) {
      ctx.drawImage(sleepBlanket,0,0,sleepBlanket.naturalWidth*.78,sleepBlanket.naturalHeight,
        a.x-68,a.y-48,114,47);
    }
    drawSleepLetters(a);
  }
  if (a.hp && a.nap) {
    const cloneFace=Math.sign(fighters[1-a.i].x-a.cloneX)||a.face;
    drawEffectSprite(sprites[8].clone[a.cloneAction ? 1 : 0],a.cloneX,ground,173,cloneFace);
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
    drawGuineaFowl(a.x,a.y,a.face,1-a.snare);
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
  const headY = a.y-lift-135+(guard ? 10 : 0);
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
  drawEffects();
  fighter(fighters[0]);
  if (online?.role==='guest' && phase==='fight') {
    fighter(advanceGuestVisual(dt),online.localKeys);
  } else {
    fighter(fighters[1]);
  }
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
    if (!fighter.stun && !fighter.snare && !fighter.asleep && !fighter.sleepRecovery && !fighter.nap && !fighter.bedWalk && !fighter.charge && !isDefending(fighter)) {
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
      if (guest && Object.hasOwn(clips,message.name)) playClip(message.name);
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
  if (a.stun || a.guardBreak || a.snare || a.charge || a.action>.12 || a.recovery>0 || (a.cool[slot] || a.specialsInProgress?.[slot]) || online.localKeys.has(a.keys[3])) return;
  a.face=Math.sign(fighters[0].x-a.x) || a.face;
  a.label=slot===0 ? 'ATAQUE' : slot===3 ? 'CHUTE' : specials[a.kind][slot-1].toUpperCase();
  if(a.kind===0 && slot===2){a.label='FOOOON!';a.action=.65;}
  if (a.kind===1 && slot===1) a.label='SUPER ABRAÇO';
  a.action=.42;
  if((a.kind===13 || a.kind===14) && (slot===1 || slot===2)) a.action=.62;
  if(a.kind===14 && slot===2){a.baby=3;a.action=.28;}
  if(a.kind===14 && a.baby>0 && (slot===0 || slot===3)) a.action=.28;
  a.actionDuration=a.action;
  a.cool[slot]=cooldownFor(a,slot);
  a.recovery=a.kind===14 && a.baby>0 && (slot===0 || slot===3) ? (slot===0 ? .34 : .50) : slot===0 ? .68 : slot===3 ? .82 : .70;
  online.predictedAttack=sequence;
  if (a.kind===10 && slot===0 && a.printedTier>=0) a.label=printedItems[a.printedTier].toUpperCase();
  if (a.kind===7 && slot===1) a.frenzy=3;
  if (a.kind===7 && slot===2) a.regen=7;
  if ((a.kind===0 && slot===1) || (slot===2 && [2,3,11].includes(a.kind))) {
    beginCharge(a);
    online.predictedDash={sequence,face:a.face,origin:a.x,confirmed:false,endpoint:Math.max(55,Math.min(905,a.x+a.face*chargeDistance(a)))};
  } else if (slot===2 && a.kind===1) {
    a.buff=4.5;
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
  if (embrace || confirmed.stun || confirmed.guardBreak || confirmed.snare || confirmed.flash || confirmed.asleep || confirmed.sleepRecovery || confirmed.bedWalk) return confirmed;
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
  } else if (!dash && !isDefending(visual,pressed)) moveFighter(visual,fighters[0],pressed,dt);
  applyMomentum(visual,dt);
  if (dash) {
    const toEndpoint=(dash.endpoint-visual.x)*dash.face;
    const toConfirmed=(confirmed.x-visual.x)*dash.face;
    if (!visual.charge && toEndpoint>0 && toConfirmed>0) {
      visual.x+=dash.face*Math.min(toConfirmed,toEndpoint,800*dt);
    }
    return visual;
  }
  if (!online.pendingInputs.length && !isDefending(visual,pressed)) {
    const direction=visual.frenzy ? (Math.abs(fighters[0].x-visual.x)>82 ? Math.sign(fighters[0].x-visual.x) : 0) : Number(pressed.has(visual.keys[1]))-Number(pressed.has(visual.keys[0]));
    const lead=online.lead ?? .06;
    const speed=(visual.kind===0 ? 280 : 222)*(visual.moveTime>.32 ? 1 : .69)*(visual.buff ? 1.52 : visual.frenzy ? 1.78 : visual.ascended ? 1.32 : 1);
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



