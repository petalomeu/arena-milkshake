'use strict';

const combat2 = (() => {
  const tick = 1/60;
  const energy = {max:100,reserve:30,recharge:10,hit:8,blocked:4,escape:30,specialCosts:[0,45,65,0]};
  const actions = ['left','right','jump','crouch','guard','punch1','punch2','punch3','kick1','kick2','kick3','special1','special2'];
  const actionLabels = ['Esquerda','Direita','Pular','Agachar','Defesa dedicada','Soco fraco','Soco médio','Soco forte','Chute fraco','Chute médio','Chute forte','Especial 1','Especial 2'];
  const standard = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ShiftRight','KeyQ','KeyW','KeyE','KeyA','KeyS','KeyD','KeyF','KeyG'];
  const localSecond = ['KeyJ','KeyL','KeyI','KeyK','KeyO','Digit7','Digit8','Digit9','KeyU','KeyH','KeyN','KeyP','KeyM'];
  const definitions = {
    punch1:{label:'SOCO FRACO',damage:4,start:4,active:3,recover:8,reach:62,center:96,height:33,stun:10,block:5,push:94,level:1},
    punch2:{label:'SOCO MÉDIO',damage:8,start:7,active:4,recover:13,reach:78,center:98,height:36,stun:15,block:8,push:135,level:2},
    punch3:{label:'SOCO FORTE',damage:13,start:12,active:4,recover:20,reach:76,center:102,height:42,stun:22,block:11,push:236,level:3},
    kick1:{label:'CHUTE FRACO',damage:5,start:5,active:3,recover:9,reach:68,center:63,height:32,stun:11,block:6,push:110,level:1},
    kick2:{label:'CHUTE MÉDIO',damage:9,start:9,active:4,recover:15,reach:106,center:79,height:38,stun:17,block:9,push:181,level:2},
    kick3:{label:'CHUTE FORTE',damage:15,start:15,active:5,recover:23,reach:89,center:92,height:45,stun:25,block:13,push:274,level:3},
    sweep:{label:'RASTEIRA',damage:11,start:13,active:4,recover:21,reach:97,center:23,height:28,stun:20,block:10,push:196,level:3,low:true}
  };
  // Walk, acceleration, braking, dash speed/ticks, jump impulses, air control, body size, reach, force, recovery.
  const profiles = [
    [267,2200,2200,645,11,548,485,.86,27,131,1.02,.94,.95],
    [207,1580,2050,488,9,481,388,.60,34,117,.92,1.10,1.04],
    [180,1340,1650,465,10,445,372,.55,39,144,1.02,1.15,1.15],
    [219,1770,1920,520,10,493,408,.68,33,137,1.00,1.02,1.02],
    [217,1750,2020,510,10,491,406,.69,31,130,1.02,1.00,1.00],
    [248,2350,2450,630,8,530,448,.85,26,123,.91,.92,.90],
    [207,1650,1970,508,10,480,394,.66,33,132,1.08,1.02,1.05],
    [244,2210,2180,565,10,518,451,.78,27,124,.92,.93,.89],
    [195,1470,1930,478,10,477,393,.62,33,135,1.02,1.03,1.02],
    [213,1660,1880,524,10,478,405,.64,34,131,1.01,1.00,1.03],
    [225,1890,2020,545,10,500,424,.72,29,129,1.00,1.00,1.00],
    [278,2450,2400,674,11,555,508,.90,26,122,.96,.88,.88],
    [220,1730,1850,535,10,491,414,.67,32,132,1.06,1.00,1.08],
    [225,1810,1930,546,10,496,414,.67,30,131,1.09,1.03,1.09],
    [202,1580,1800,504,10,478,388,.63,35,139,1.03,1.12,1.12],
    [260,2460,2490,632,10,533,464,.87,24,109,.92,.90,.89]
  ].map(([walk,accel,brake,dash,dashLength,jumpHeight,airJump,air,width,height,range,force,recovery]) =>
    ({walk,accel,brake,dash,dashLength,jumpHeight,airJump,air,width,height,range,force,recovery}));
  const keyByAction = {left:0,right:1,jump:2,guard:3};
  const activePoseHeight={
    0:{punch1:132,punch2:135,punch3:130,kick1:58,kick2:109,kick3:142},
    2:{punch1:150,punch2:149,punch3:147,kick1:67,kick2:132,kick3:166}
  };
  const heldCodes = new Map();
  let hostTick=0, accumulated=0, mode=false, menu=false;
  let remaps={};
  try {remaps=JSON.parse(localStorage.getItem('ure-combat-bindings') || '{}') || {};}catch {}

  function state() {
    return {move:0,jumps:0,airCut:false,dash:0,dashWait:0,dashCombo:0,direction:0,lastLeft:-99,lastRight:-99,
      crouch:false,block:0,attack:null,buffer:null,chain:0,chainClock:0,escape:0,escapeWait:0,energyNotice:0,
      emergencyUsed:false,specialStun:0};
  }
  function attach() {
    hostTick=0; accumulated=0; heldCodes.clear(); menu=false;
    fighters.forEach(a=>{a.v2=state();a.guardEnergy=energy.reserve;});
  }
  function awardContact(actor,blocked){
    const a=fighters[actor.i];
    if(a?.hp)a.guardEnergy=Math.min(energy.max,a.guardEnergy+(blocked ? energy.blocked : energy.hit));
  }
  function profile(a){return profiles[a.kind];}
  function active(){return online ? !!online.rules2 : mode;}
  function selected(){return document.querySelector('#combat-rules').value==='v2';}
  function slotMap(player){
    const second=!online && !cpu.active && player===1;
    return actions.map((action,i)=>remaps[second ? 1 : 0]?.[action] ?? (second ? localSecond : standard)[i]);
  }
  function keyLabel(code){return code.replace(/^Key|^Digit/,'').replace('ArrowLeft','←').replace('ArrowRight','→').replace('ArrowUp','↑').replace('ArrowDown','↓').replace('ShiftRight','Shift dir.');}
  function renderControls(){
    const old=document.querySelector('#combat-classic-controls');
    const modern=document.querySelector('#combat-v2-controls');
    old.hidden=active();modern.hidden=!active();
    if(!active())return;
    const players=online ? [online.role==='guest' ? 1 : 0] : cpu.active ? [0] : [0,1];
    modern.replaceChildren(...players.map(player=>{
      const element=document.createElement('p');
      const map=slotMap(player).map(keyLabel);
      const champion=fighters?.[player];
      const names=champion ? specials[champion.kind] : ['Especial 1','Especial 2'];
      element.textContent='P'+(player+1)+' · '+map.slice(0,4).join(' ')+' mover/pular/agachar · '+map.slice(5,8).join('/')+' socos · '+map.slice(8,11).join('/')+' chutes · '+map[3]+' + '+map[10]+' rasteira · Dash + '+map[7]+'/'+map[10]+' desarme · '+map[11]+' '+names[0]+' · '+map[12]+' '+names[1]+' · Esc menu';
      element.textContent+=' · '+map[4]+' + '+map[2]+' saída de canto';
      return element;
    }));
  }
  function start(enabled) {
    mode=enabled; menu=false;
    document.querySelector('#combat-pause').hidden=true;
    renderControls();
  }
  function advance(elapsed, step){
    if(menu && !online){accumulated=0;return;}
    accumulated=Math.min(.22,accumulated+elapsed);
    while(accumulated+1e-9>=tick && ['countdown','fight'].includes(phase)){
      accumulated=Math.max(0,accumulated-tick);
      step(tick);
    }
  }
  function cannotAct(a){return !a.hp || a.stun>0 || a.guardBreak>0 || a.frozen>0 || a.tumble>0 || a.snare>0 || a.asleep>0 || a.sleepRecovery>0 || a.bedWalk>0 || a.v2.block>0;}
  function holdsGuard(a,pressed=keys,b=fighters[1-a.i]){
    const face=Math.sign(b.x-a.x)||a.face;
    return pressed.has(a.keys[3]) || pressed.has(a.keys[face>0 ? 0 : 1]);
  }
  function defending(a,pressed=keys){
    return a.y===ground && a.guardEnergy>0 && !a.guardNeedsRelease &&
      (!cannotAct(a) || a.v2.block>0 && !a.stun && !a.guardBreak && !a.frozen && !a.tumble && !a.snare) &&
      !a.nap && !a.charge && !a.v2.dash && !a.v2.escape && !a.v2.attack && !a.action && holdsGuard(a,pressed);
  }
  function ladder(a,name){
    const current=a.v2.attack;
    return current?.hit && !current.air && definitions[name].level===definitions[current.name].level+1;
  }
  function timings(a,name,chaining=false){
    const p=profile(a), move=definitions[name];
    const fastMedium=a.kind===10 && name==='punch2' ? 1 : 0;
    const quickLight=(a.kind===11 || a.kind===5) && move.level===1 ? 1 : 0;
    const windup=[2,2,3][move.level-1];
    const settle=[4,5,7][move.level-1];
    return {startup:Math.max(3,move.start+windup-fastMedium-quickLight-(chaining ? 2 : 0)-(a.baby>0 ? 2 : 0)),
      recovery:Math.max(5,Math.round((move.recover+settle)*p.recovery*(a.baby>0 ? .72 : 1)))};
  }
  function begin(a,b,name,air=false,dashStrike=false){
    const move=definitions[name];
    const chaining=ladder(a,name);
    const {startup,recovery}=timings(a,name,chaining);
    if(!chaining){a.v2.chain=0;a.v2.chainClock=0;}
    a.v2.attack={name,age:0,startup,recovery,used:false,hit:false,air,dashStrike};
    a.v2.buffer=null;
    a.v2.move=0;
    a.v2.dashCombo=0;
    a.face=Math.sign(b.x-a.x)||a.face;
    if(a.kind===9)a.orsiStood=true;
    a.label=move.label;
    a.action=a.actionDuration=(startup+move.active+recovery)*tick;
    const power=['light','mid','heavy'][move.level-1];
    combatCue((name.startsWith('punch') ? 'punch_' : 'kick_')+power);
    if(move.level>=2)combatCue('effort_'+(a.kind===7 ? 'female' : a.kind===2 || a.kind===14 || a.kind===9 && a.ascended ? 'deep' : 'male'));
  }
  function basic(a,b,name){
    const v=a.v2;
    if(phase!=='fight' || cannotAct(a) || embrace || a.charge || v.escape)return;
    if(v.dashCombo>0 && !v.attack && !v.crouch && !a.nap && a.y===ground &&
        !a.action && !a.recovery && (name==='punch3' || name==='kick3')){
      v.dash=0;
      begin(a,b,name,false,true);
      return;
    }
    if(v.dash)return;
    const punch=name.startsWith('punch');
    if(a.nap || a.printedTier>=0 && a.kind===10 && punch){
      if(punch)attack(a,b,0,true);
      return;
    }
    name=moveFromStance(a,name,a.v2.crouch);
    const running=a.v2.attack;
    if(running){
      if(ladder(a,name) && running.age>=running.startup+definitions[running.name].active){begin(a,b,name);return;}
      const remaining=running.startup+definitions[running.name].active+running.recovery-running.age;
      if(remaining<=7 || definitions[name].level===definitions[running.name].level+1 && running.age>=running.startup-3){
        a.v2.buffer={name,until:hostTick+8};
      }
      return;
    }
    if(a.action>.12 || a.recovery>0 || defending(a))return;
    begin(a,b,name,a.y<ground || a.vy<0);
  }
  function moveFromStance(a,name,crouching){
    return name==='kick3' && crouching && a.y===ground ? 'sweep' : name;
  }
  function jumpNow(a){
    if(cornerEscape(a,fighters[1-a.i]))return;
    if(cannotAct(a) || a.nap || a.charge || pupinhoJrCasting(a) || a.v2.attack || a.v2.dash || a.v2.escape || a.v2.crouch || keys.has(a.keys[3]))return;
    const grounded=a.y>=ground && a.vy>=0;
    if(!grounded && a.v2.jumps!==1)return;
    const p=profile(a);
    a.v2.jumps=grounded ? 1 : 2;
    a.v2.airCut=false;
    a.v2.dashCombo=0;
    a.vy=-(grounded ? p.jumpHeight : p.airJump+275);
    if(a.kind===9)a.orsiStood=true;
    combatCue(grounded ? 'jump' : 'double_jump');
    movementWind(a,a.face,grounded ? 'jump' : 'double');
  }
  function dashNow(a,direction){
    if(cannotAct(a) || a.nap || a.charge || a.action>.12 || a.recovery>0 || a.v2.attack || a.v2.dashWait ||
        a.y<ground || a.v2.crouch || a.v2.escape)return;
    a.v2.dash=profile(a).dashLength+2;
    a.v2.dashWait=a.v2.dash+11;
    a.v2.dashCombo=a.v2.dash+7;
    a.v2.direction=direction;
    a.v2.move=0;
    movementWind(a,direction,direction===a.face ? 'forward' : 'back');
  }
  function cornerLanding(a,b,direction){
    const margin=(box(a,'push').w+box(b,'push').w)/2+9;
    return b.x+direction*margin;
  }
  function cornerEscape(a,b){
    const v=a.v2;
    const direction=a.x<=100 ? 1 : a.x>=860 ? -1 : 0;
    const gap=(b.x-a.x)*direction;
    if(!a.hp || !b.hp || !direction || gap<=0 || gap>156 || a.y!==ground || b.y<ground-45 ||
       v.escape || a.charge || a.frozen || a.guardBreak || a.snare || a.tumble || a.asleep ||
       a.nap || a.sleepRecovery || a.bedWalk || embrace)return false;
    const busy=v.dash || v.attack || a.action || a.recovery;
    const emergency=a.guardEnergy<energy.escape;
    if(emergency){
      if(v.emergencyUsed || !holdsGuard(a,keys,b) || v.specialStun>0 || (busy && !a.stun))return false;
    }else if(v.escapeWait || busy || a.stun || a.guardNeedsRelease || !(v.block>0 || defending(a)))return false;

    const destination=cornerLanding(a,b,direction);
    if(destination<55 || destination>905)return false;
    if(emergency){
      v.emergencyUsed=true;
      if(a.stun){
        interrupt(a);
        a.stun=a.flash=a.recovery=0;
      }
    }else a.guardEnergy-=energy.escape;
    a.guardDelay=1;
    a.vx=0;
    v.block=0;
    v.dashCombo=0;
    v.escape=11;
    v.escapeWait=135;
    v.direction=direction;
    v.move=0;
    a.label=emergency ? 'SAÍDA DE EMERGÊNCIA' : 'SAÍDA DE CANTO';
    movementWind(a,direction,'escape');
    return true;
  }
  function input(player,action,down){
    if(!actions.includes(action) || phase!=='fight')return;
    const a=fighters[player],b=fighters[1-player],v=a.v2;
    if(!v)return;
    const physical=a.keys[keyByAction[action]];
    if(physical){
      if(keys.has(physical)===down)return;
      if(down)keys.add(physical);else keys.delete(physical);
    }
    if(action==='crouch'){v.crouch=down;if(down && a.kind===9 && !cannotAct(a))a.orsiStood=true;return;}
    if(action==='jump'){
      if(down)jumpNow(a);
      else if(v.jumps===1 && !v.airCut && a.vy<0 && !cannotAct(a)){a.vy*=.56;v.airCut=true;}
      return;
    }
    if(!down)return;
    if(action==='left' || action==='right'){
      const lastTap=action==='left' ? 'lastLeft' : 'lastRight';
      if(hostTick-v[lastTap]<=13){dashNow(a,action==='left' ? -1 : 1);v[lastTap]=-99;}
      else v[lastTap]=hostTick;
    }else if(action==='special1' || action==='special2'){
      if(!v.attack && !v.dash && !cannotAct(a) && !defending(a))attack(a,b,Number(action.at(-1)));
    }else if(definitions[action])basic(a,b,action);
  }
  function release(){
    for(const {player,action} of heldCodes.values())route(player,action,false);
    heldCodes.clear();
  }
  function route(player,action,down){
    if(online?.role==='guest'){
      const a=online.visual;
      if(!a?.v2)return;
      if(action==='crouch')online.previewCrouch=down;
      const physical=a.keys[keyByAction[action]];
      if(physical){if(down)online.localKeys.add(physical);else online.localKeys.delete(physical);}
      const seq=++online.inputSequence;
      const dashStrike=a.v2.dashCombo>0 && !(online.previewCrouch ?? a.v2.crouch) &&
        a.y===ground && (action==='punch3' || action==='kick3');
      if(down && definitions[action] && !cannotAct(a) && !a.v2.attack && !a.action && !a.charge &&
          (!a.v2.dash || dashStrike) && !a.nap &&
          (dashStrike || !(a.kind===10 && a.printedTier>=0 && action.startsWith('punch')))){
        const name=moveFromStance(a,action,online.previewCrouch ?? a.v2.crouch);
        const {startup,recovery}=timings(a,name);
        online.basicPreview={seq,move:{name,age:0,startup,recovery,air:a.y<ground || a.vy<0,dashStrike}};
      }
      if(down && (action==='special1' || action==='special2'))predictAttack(a,Number(action.at(-1)),seq);
      sendOnline({type:'key',code:action,down,seq});
    }else input(player,action,down);
  }
  function keyboard(event,down){
    if(event.code==='Escape' && down && !event.repeat && !event.target?.matches?.('input,select,textarea,[contenteditable]')){
      event.preventDefault();
      release();menu=!menu;
      document.querySelector('#combat-pause').hidden=!menu;
      if(!menu)canvas.focus({preventScroll:true});
      return;
    }
    const existing=heldCodes.get(event.code);
    if(!down && existing){
      event.preventDefault();heldCodes.delete(event.code);route(existing.player,existing.action,false);return;
    }
    if(!down || event.target?.matches?.('input,select,textarea,[contenteditable]') || event.altKey || event.ctrlKey || event.metaKey)return;
    const players=online ? [online.role==='guest' ? 1 : 0] : cpu.active ? [0] : [0,1];
    const player=players.find(i=>slotMap(i).includes(event.code));
    if(player===undefined){if(event.code.startsWith('Arrow'))event.preventDefault();return;}
    event.preventDefault();
    if(menu || event.repeat || existing)return;
    const action=actions[slotMap(player).indexOf(event.code)];
    heldCodes.set(event.code,{player,action});
    route(player,action,true);
  }
  function move(a,b,pressed,dt){
    const v=a.v2,p=profile(a);
    if(cannotAct(a)){v.move=0;v.dash=0;return;}
    if(v.escape){
      const destination=Math.max(55,Math.min(905,cornerLanding(a,b,v.direction)));
      a.x+=(destination-a.x)/v.escape;
      --v.escape;
      return;
    }
    if(v.dash>0){
      a.x+=v.direction*p.dash*(v.direction===a.face ? 1 : .88)*dt;
      return;
    }
    if(!v.attack)a.face=Math.sign(b.x-a.x)||a.face;
    const guarding=defending(a,pressed);
    const actual=Number(pressed.has(a.keys[1]))-Number(pressed.has(a.keys[0]));
    const direction=a.frenzy && !guarding && Math.abs(a.x-b.x)>82 ? a.face : actual;
    const slow=a.slow>0 ? .60 : 1;
    const target=direction*p.walk*slow*(a.frenzy ? 1.43 : a.ascended ? 1.17 : 1)*(guarding ? .44 : a.moveTime>.32 ? 1.13 : 1);
    const goal=v.attack || v.crouch && a.y===ground ? 0 : target;
    const step=(goal ? p.accel : p.brake)*dt*(a.y<ground ? p.air : 1);
    v.move+=Math.max(-step,Math.min(step,goal-v.move));
    a.x+=v.move*dt;
    const before=a.moveTime;
    a.moveTime=direction && !v.attack ? a.moveTime+dt : 0;
    if(before<=.32 && a.moveTime>.32 && a.y===ground && !guarding && !a.frenzy)movementWind(a,direction,direction===a.face ? 'forward' : 'back');
    if(a.kind===9 && direction)a.orsiStood=true;
    if(!online && cpu.active && a.i===1 && pressed.has(a.keys[2]) && a.y===ground && a.vy===0)jumpNow(a);
  }
  function afterMomentum(a,wasAirborne){
    if(wasAirborne && a.y===ground){a.v2.jumps=0;a.v2.airCut=false;}
    if(a.y<104){a.y=104;a.vy=Math.max(0,a.vy);}
    if(a.y>=ground && a.vy===0)a.v2.jumps=0;
  }
  function box(a,type){
    const p=profile(a), state=a.v2;
    const squat=state.crouch && a.y===ground;
    const scale=a.baby>0 ? .70 : 1;
    const resting=a.kind===9 && !a.orsiStood && !a.ascended;
    const height=Math.round((p.height+(a.ascended ? 13 : 0))*scale*(squat || resting ? .67 : 1));
    const width=Math.round((p.width+(a.ascended ? 5 : 0))*scale);
    if(type==='push')return {x:a.x-width,y:a.y-Math.round(height*.70),w:width*2,h:Math.round(height*.70)};
    const torso=Math.round(height*1.13)+(a.kind===2 && !squat ? 12 : 0);
    if(type==='hurt')return {x:a.x-width-3,y:a.y-torso,w:width*2+6,h:torso};
    if(type==='head'){
      const headWidth=Math.round(Math.min(22,p.width*.66)*scale);
      const headHeight=Math.round(Math.min(60,p.height*.36)*scale*(squat || resting ? .75 : 1));
      return {x:a.x-headWidth,y:a.y-torso-headHeight+9,w:headWidth*2,h:headHeight};
    }
    const attack=state.attack;
    if(!attack || attack.age<attack.startup || attack.age>=attack.startup+definitions[attack.name].active)return null;
    const data=definitions[attack.name];
    const extent=Math.round(data.reach*p.range*(a.baby>0 ? .78 : 1)*(a.kind===13 && attack.name==='kick2' ? 1.07 : 1));
    const offset=12;
    const poseHeight=activePoseHeight[a.kind]?.[attack.name] ?? data.center;
    const aerialHeight=a.kind===pupinhoJr ? 93 : data.center-38;
    const center=(attack.air ? aerialHeight : poseHeight)*scale;
    return {x:a.face>0 ? a.x+offset : a.x-offset-extent,y:a.y-center-data.height/2,w:extent,h:data.height};
  }
  function intersects(a,b){return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;}
  function separate(a,b,previous){
    if(!a.hp || !b.hp || a.charge || b.charge || a.bedWalk || b.bedWalk ||
        a.nap || b.nap || a.asleep || b.asleep || embrace)return;
    const one=box(a,'push'),two=box(b,'push');
    if(one.y+one.h<=two.y || two.y+two.h<=one.y)return;
    const [left,right]=previous[0]<=previous[1] ? [a,b] : [b,a];
    const width=(one.w+two.w)/2;
    const overlap=width-(right.x-left.x);
    if(overlap<=0)return;
    const L=left.x,R=right.x;
    const low=Math.max(55,Math.min(905-width,(L+R-width)/2));
    left.x=low;right.x=low+width;
    if(left.v2.dash && left.v2.direction>0 && left.x<L){left.v2.dash=0;left.v2.move=0;}
    if(right.v2.dash && right.v2.direction<0 && right.x>R){right.v2.dash=0;right.v2.move=0;}
  }
  function canBlock(b,level){
    return defending(b) && b.v2.crouch===(level==='low');
  }
  function resolve(previous,exceptions){
    const [a,b]=fighters;
    if(!exceptions)separate(a,b,previous);
    const contacts=[];
    for(const actor of fighters){
      const v=actor.v2,attack=v.attack,target=fighters[1-actor.i];
      if(!attack)continue;
      if(cannotAct(actor) || actor.nap || actor.charge || embrace){interrupt(actor);continue;}
      const area=box(actor,'hit');
      if(!attack.used && area && target.hp && !target.v2.escape && (intersects(area,box(target,'hurt')) || intersects(area,box(target,'head'))) &&
          !(actor.kind===8 && (target.asleep || target.sleepRecovery))){
        attack.used=true;
        contacts.push({actor,target,attack,blocked:canBlock(target,attack.name.startsWith('punch') ? 'upper' : 'low')});
      }
    }
    for(const {actor,target,attack,blocked} of contacts){
      const data=definitions[attack.name];
      if(blocked){
        const cost=[7,11,16][data.level-1];
        target.guardEnergy=Math.max(0,target.guardEnergy-cost);target.guardDelay=1;
        awardContact(actor,true);
        if(!target.guardEnergy)breakGuard(target);
        else{
          target.v2.block=Math.max(target.v2.block,data.block);
          target.blockFlash=.18;
          target.vx=actor.face*data.push*.24;
          combatCue('block');
          effects.push({kind:'basic-impact',owner:actor.i,x:target.x-actor.face*24,y:target.y-88,time:0,defended:true});
        }
        continue;
      }
      const wasHit=target.hp;
      const p=profile(actor);
      const force=p.force*(actor.ascended ? 1.28 : actor.baby>0 ? 1.13 : 1)*(actor.kind===14 && attack.name==='punch3' ? 1.12 : 1);
      const comboScale=Math.max(.60,1-actor.v2.chain*.16);
      const power=['light','mid','heavy'][data.level-1];
      const contact=(attack.name.startsWith('punch') ? 'punch_' : 'kick_')+power;
      attack.hit=hit(actor,target,data.damage*comboScale*p.force,
        data.push*force,(data.stun+(data.level<3 ? 1 : 0))*tick,false,false,0,'v2_hit_'+contact,true);
      if(!attack.hit || target.hp===wasHit)continue;
      actor.v2.chain++;
      actor.v2.chainClock=60;
      if(attack.dashStrike){
        const disarmed=target.kind===10 && target.printedTier>=0;
        if(disarmed)target.printedTier=-1;
        effects.push({kind:'dash-impact',owner:actor.i,x:target.x-actor.face*20,y:target.y-92,
          face:actor.face,disarmed,time:0});
      }
      if((data.low || attack.name==='kick3' && [2,9,14].includes(actor.kind)) && target.hp && !furtivaArmored(target)){
        target.tumble=.48;target.vy=-155;
      }
      combatCue('hurt_'+(target.kind===7 ? 'female' : target.kind===2 || target.kind===14 || target.kind===9 && target.ascended ? 'deep' : 'male'));
    }
    for(const actor of fighters){
      const v=actor.v2,attack=v.attack;
      if(!attack)continue;
      if(cannotAct(actor)){interrupt(actor);continue;}
      attack.age++;
      const data=definitions[attack.name];
      const next=v.buffer && v.buffer.until>=hostTick ? v.buffer.name : '';
      if(next && ladder(actor,next) && attack.age>=attack.startup+data.active){
        begin(actor,fighters[1-actor.i],next);
      }else if(attack.age>=attack.startup+data.active+attack.recovery){
        v.attack=null;v.buffer=null;
        if(next)basic(actor,fighters[1-actor.i],next);
      }
    }
  }
  function interrupt(a){
    a.v2.attack=null;a.v2.buffer=null;a.v2.dash=0;a.v2.dashCombo=0;a.v2.move=0;a.action=0;
  }
  function timers(){
    hostTick++;
    for(const a of fighters){
      const s=a.v2;
      for(const key of ['dash','dashWait','dashCombo','block','chainClock','escapeWait','energyNotice'])s[key]=Math.max(0,s[key]-1);
      if(!s.chainClock)s.chain=0;
      if(cannotAct(a)){s.dash=0;s.dashCombo=0;s.escape=0;s.move=0;}
    }
  }
  function drawDebug(){
    if(!['localhost','127.0.0.1','::1'].includes(location.hostname))return;
    const requested=new URLSearchParams(location.search).get('boxes');
    if(!requested)return;
    const choices=requested.split(',');
    const labels={hit:'#ff5252',hurt:'#59aaff',head:'#59aaff',push:'#64ef83'};
    ctx.save();ctx.lineWidth=2;
    for(const a of fighters)for(const [type,color] of Object.entries(labels)){
      if(!choices.includes(type==='head' ? 'hurt' : type) && !choices.includes('all'))continue;
      const candidate=box(a,type);
      if(!candidate)continue;
      ctx.strokeStyle=color;ctx.strokeRect(candidate.x,candidate.y,candidate.w,candidate.h);
    }
    for(const a of fighters){
      const m=a.v2.attack;
      const detail=m ? m.name+' · '+m.age+'/'+m.startup+'/'+(m.startup+definitions[m.name].active)+' · '+definitions[m.name].damage+' dmg' : a.v2.dash ? 'dash' : a.v2.crouch ? 'agachado' : 'neutro';
      text(detail,a.x,a.y-161,13,'white');
    }
    ctx.restore();
  }
  function pose(a){
    const m=a.v2.attack;
    if(!m)return null;
    const d=definitions[m.name];
    const end=m.startup+d.active;
    const poseIndex=m.age<m.startup ? 0 : m.age<end ? 1 : 2;
    const kick=m.name.startsWith('kick');
    const shortJab=m.name==='punch1';
    const impactArt=d.low ? 6 : (kick ? 3 : 0)+d.level-1;
    const transition=kick ? 8 : 7;
    let artIndex=-1,shift=0,tilt=0;
    if(poseIndex===0 && !d.low){
      const progress=m.age/m.startup;
      if(progress>=.30 && !shortJab)artIndex=transition;
      shift=shortJab ? 2*progress : -d.level*2*progress;
      tilt=shortJab ? .008*progress : -d.level*.018*progress;
    }else if(poseIndex===1){
      artIndex=impactArt;
    }else if(poseIndex===2){
      const elapsed=m.age-end;
      const followThrough=shortJab ? 1 : d.level+1;
      if(elapsed<followThrough){
        artIndex=impactArt;
        shift=d.level*elapsed/followThrough;
        tilt=d.level*.013*elapsed/followThrough;
      }else if(!d.low && !shortJab && elapsed<m.recovery*.76){
        artIndex=transition;
        shift=d.level*(1-elapsed/m.recovery);
        tilt=d.level*.012;
      }
    }
    const lean=poseIndex===1 ? [4,9,15][d.level-1] : tilt*120;
    return {kick:kick || d.low,index:poseIndex,lean,low:d.low,level:d.level,air:m.air,dashStrike:m.dashStrike,artIndex,shift,tilt};
  }
  function mount(){
    if(new URLSearchParams(location.search).get('combat')==='2')document.querySelector('#combat-rules').value='v2';
    const actionPicker=document.querySelector('#combat-action');
    actions.forEach((action,i)=>{
      const option=document.createElement('option');option.value=action;option.textContent=actionLabels[i];actionPicker.append(option);
    });
    const field=document.querySelector('#combat-binding');
    const note=document.querySelector('#combat-binding-status');
    const profilePicker=document.querySelector('#combat-profile');
    field.addEventListener('keydown',event=>{
      if(event.code==='Tab' || event.code==='Escape')return;
      event.preventDefault();event.stopPropagation();
      const player=Number(profilePicker.value);
      const primary=player===0 ? standard : localSecond;
      const other=player===0 ? localSecond : standard;
      const index=actions.indexOf(actionPicker.value);
      const conflict=actions.some((key,i)=> (i!==index && (remaps[player]?.[key] ?? primary[i])===event.code) ||
        (remaps[1-player]?.[key] ?? other[i])===event.code);
      if(conflict){note.textContent='Essa tecla já está em uso em um dos perfis.';return;}
      remaps[player]={...remaps[player],[actionPicker.value]:event.code};
      try {localStorage.setItem('ure-combat-bindings',JSON.stringify(remaps));}catch {}
      field.value=keyLabel(event.code);
      note.textContent='Tecla salva.';
    });
    document.querySelector('#combat-reset-bindings').onclick=()=>{
      remaps={};try{localStorage.removeItem('ure-combat-bindings');}catch {}
      field.value='';note.textContent='Teclas originais restauradas.';
    };
    document.querySelector('#combat-resume').onclick=()=>{
      menu=false;document.querySelector('#combat-pause').hidden=true;canvas.focus({preventScroll:true});
    };
  }
  mount();
  return {active,selected,start,attach,advance,keyboard,release,input,holdsGuard,defending,basic,move,afterMomentum,timers,
    resolve,box,pose,drawDebug,definitions,profiles,renderControls,cornerEscape,canBlock,energy,awardContact};
})();
