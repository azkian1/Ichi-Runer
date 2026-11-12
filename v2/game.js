import * as THREE from './assets/three.module.min.js';
import { createActors } from './assets/game/actors.js';
import { createWorldArt } from './assets/game/world.js';
import { createCourseAssets } from './assets/game/course.js';
import { createWaveArt } from './assets/game/waves.js';
import { createElementFinishers } from './assets/game/finishers.js';
import { createBossEffects } from './assets/game/boss-fx.js';
import { createBossPattern, BOSS_DEATH_DURATION } from './assets/game/boss-director.js';
import { createChargeArt } from './assets/game/charge.js';
import { getElementRules, CHARGE_MIN_ENERGY, CHARGE_SPEED_MULTIPLIER } from './assets/game/elements.js';
import { createBoostArt } from './assets/game/boost.js';
import { createRunDirector, getRunStage, RUN_BOSS_DISTANCE, BOOST_MULTIPLIER } from './assets/game/director.js';
import { createSettingsUI, createSettingsModel, keyLabel } from './assets/game/settings.js';
import { createAudioPolish } from './assets/game/audio-polish.js';
import { createProfileSession } from './assets/game/profile-session.js';
import { createFrameTelemetry, qualityPixelRatio, createContextRecovery } from './assets/game/performance.js';
      class WebAudioManager {
        constructor() {
          this.context = null;
          this.buffers = {};
          this.sources = {};
          this.gainNodes = {};
          this.masterGain = null;
          this.musicGain = null;
          this.effectsGain = null;
          this.isUnlocked = false;
          this.isMuted = false;
          this.pendingLoads = new Map();
        }

        async init() {
          if (this.context) return true;

          try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.context = new AudioContext();

            // Create gain nodes
            this.masterGain = this.context.createGain();
            this.masterGain.gain.value = this.isMuted ? 0 : 1;
            this.masterGain.connect(this.context.destination);

            this.musicGain = this.context.createGain();
            this.musicGain.gain.value = CONFIG.audio.musicVolume;
            this.musicGain.connect(this.masterGain);

            this.effectsGain = this.context.createGain();
            this.effectsGain.gain.value = CONFIG.audio.effectsVolume;
            this.effectsGain.connect(this.masterGain);

            return true;
          } catch (e) {
            console.error("Failed to init Web Audio:", e);
            return false;
          }
        }

        async unlock() {
          if (this.isUnlocked) return true;

          try {
            await this.init();

            if (this.context.state === "suspended") {
              await this.context.resume();
            }

            // Play silent buffer to unlock
            const buffer = this.context.createBuffer(1, 1, 22050);
            const source = this.context.createBufferSource();
            source.buffer = buffer;
            source.connect(this.context.destination);
            source.start(0);

            this.isUnlocked = true;
            return true;
          } catch (e) {
            console.error("Failed to unlock audio:", e);
            return false;
          }
        }

        async loadAudio(name, url, isMusic = false) {
          if (this.buffers[name]) return this.buffers[name];

          // Prevent duplicate loading
          if (this.pendingLoads.has(name)) {
            return this.pendingLoads.get(name);
          }

          const loadPromise = (async () => {
            try {
              await this.init();
              const response = await fetch(url, { mode: "cors" });
              const arrayBuffer = await response.arrayBuffer();
              const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
              this.buffers[name] = { buffer: audioBuffer, isMusic };
              this.pendingLoads.delete(name);
              return audioBuffer;
            } catch (e) {
              console.error(`Failed to load audio ${name}:`, e);
              this.pendingLoads.delete(name);
              return null;
            }
          })();

          this.pendingLoads.set(name, loadPromise);
          return loadPromise;
        }

        play(name, loop = false) {
          if (this.isMuted || !this.buffers[name] || !this.context) return null;

          try {
            const { buffer, isMusic } = this.buffers[name];
            const source = this.context.createBufferSource();
            source.buffer = buffer;
            source.loop = loop;

            const gainNode = isMusic ? this.musicGain : this.effectsGain;
            source.connect(gainNode);
            source.start(0);

            if (isMusic) {
              // Stop previous music
              if (this.sources[name]) {
                this.sources[name].stop();
              }
              this.sources[name] = source;
            }

            return source;
          } catch (e) {
            console.error(`Failed to play ${name}:`, e);
            return null;
          }
        }

        stop(name) {
          if (this.sources[name]) {
            try {
              this.sources[name].stop();
            } catch (e) {
              // Already stopped
            }
            delete this.sources[name];
          }
        }

        stopAll() {
          Object.keys(this.sources).forEach((name) => this.stop(name));
        }

        setMuted(muted) {
          this.isMuted = muted;
          if (this.masterGain) {
            this.masterGain.gain.value = muted ? 0 : 1;
          }
        }

        destroy() {
          this.stopAll();
          if (this.context) {
            this.context.close();
            this.context = null;
          }
          this.buffers = {};
          this.isUnlocked = false;
        }
      }


const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
const WORLD_LENGTH=RUN_BOSS_DISTANCE,SWORD_SWING=.42,SWORD_RELEASE=.14;
let frameTelemetry=null;
const ARENA=Boolean(window.location&&/(?:^|[?&])arena=1(?:&|$)/.test(window.location.search));
const PREVIEW=ARENA||Boolean(window.location&&/(?:^|[?&])review=1(?:&|$)/.test(window.location.search));
let runtimeInitialised=false,settingsUI=null,settingsReturnMode='menu',contextRecovery=null,contextMustResume=false,storageFault=false;
let safeStorage;try{safeStorage=globalThis.localStorage;}catch{safeStorage={getItem(){throw Error('storage unavailable');},setItem(){throw Error('storage unavailable');}};}
function runtimeMessage(text){const box=$('runtimeNotice');if(!box)return;box.hidden=!text;box.style.display=text?'flex':'none';if($('runtimeMessage'))$('runtimeMessage').textContent=text;const retry=$('runtimeRetry');if(retry)retry.style.display=text&&/tab|sav(?:e|ing)|storage|access/i.test(text)?'':'none';}
const profileSession=createProfileSession({preview:PREVIEW,storage:safeStorage,locks:navigator.locks,eventTarget:window,
  onAcquire(){if(runtimeInitialised){reloadStoredProgress();updateHUD();$('menuRecord').textContent=state.best.toLocaleString('en-US');}},
  onLost(){if(runtimeInitialised){clearBoostInput();if(state.mode==='playing')setMode('paused');}},
  onStatus({status,active}){if(active){storageFault=false;runtimeMessage('');}else if(!['released'].includes(status))runtimeMessage('The game is open in another tab. Close it, then select Retry Access.');},
  onError({message}){storageFault=true;runtimeMessage(message);if(runtimeInitialised&&state.mode==='playing')setMode('paused');}});
const fallbackSettings=createSettingsModel({storage:safeStorage,preview:PREVIEW,systemReducedMotion:Boolean(matchMedia('(prefers-reduced-motion: reduce)').matches)});
function actionLabel(action){return settingsUI?.label(action)||keyLabel(fallbackSettings.value.bindings[action]?.[0]||'');}
const CONFIG={scoring:{sushiPoints:5,barricadePoints:10,ghostPoints:50,bossHitPoints:100,bossDefeatPoints:5000,maxMultiplier:5,multiplierThreshold:5},audio:{musicVolume:.08,effectsVolume:.32}};
const THEMES=[{name:'Moonlit Shrine',boss:'Aka-Oni · Devourer of Temples',subtitle:'Prayers no one heard'},{name:'Whispering Bamboo',boss:'Midori · Voice of the Mist',subtitle:'The path vanishes with every step'},{name:'Ashen Citadel',boss:'Enma · Lord of Ash',subtitle:'The last light burns within you'}];
const UPGRADES=[{id:'range',symbol:'弓',name:'Wave Range',desc:'Reach demons from farther away. +9 metres per level.'},{id:'cooldown',symbol:'迅',name:'Quick Blade',desc:'16% less time between attacks per level.'}];
const ELEMENTS=[{id:'lightning',name:'Lightning',symbol:'雷',color:'#b6a3ff',desc:'Double jump → press Boost again and hold: phase through obstacles while energy lasts.'},{id:'water',name:'Water',symbol:'水',color:'#64cbff',desc:'Two separate water waves cut through any rock, even a wide barrier.'},{id:'fire',name:'Fire',symbol:'火',color:'#ff813f',desc:'Double boss damage: 10 instead of 5 while EXPOSED.' },{id:'wind',name:'Wind',symbol:'風',color:'#c0f0c4',desc:'+50% energy capacity (150), with double energy regeneration.'},{id:'darkness',name:'Darkness',symbol:'闇',color:'#aa70df',desc:'Every 3 ordinary demons restore one heart, up to full health.'}];
const ELEMENT_PRICE=45,PROFILE_KEY='ichiProfileV2';
const MASTERY_KEY='ichiMasteryV1',RUN_METRICS_KEY='ichiRunsV1';
const TUTORIAL_ACTIONS=['lane','jump','slide','attack','doubleJump','boost','phase'];
let mastery={version:1,actions:[],runs:0};
if(!PREVIEW)try{const saved=JSON.parse(profileSession.read(MASTERY_KEY,'{}'));if(saved&&typeof saved==='object'){mastery.actions=[...new Set((Array.isArray(saved.actions)?saved.actions:[]).filter(id=>TUTORIAL_ACTIONS.includes(id)))];mastery.runs=clamp(Math.floor(Number(saved.runs)||0),0,1000000);}}catch{}
function saveMastery(){return profileSession.write(MASTERY_KEY,JSON.stringify(mastery));}
function learnAction(id){if(!TUTORIAL_ACTIONS.includes(id)||mastery.actions.includes(id))return;mastery.actions.push(id);saveMastery();}
function repeatTutorial(){mastery.actions=[];saveMastery();updateTutorial();}
function updateTutorial(){
  const touch=matchMedia('(pointer:coarse)').matches;
  const jumpKey=actionLabel('jump'),boostKey=actionLabel('boost');
  const steps=[['lane',touch?'← / → · change lanes':`${actionLabel('left')} / ${actionLabel('right')} · change lanes`],['jump',touch?'↑ · jump over an obstacle':`${jumpKey} · jump over an obstacle`],['slide',touch?'↓ · slide; in the air, drop quickly':`${actionLabel('slide')} · slide; in the air, drop quickly`],['attack',touch?'斬 · release a sword wave':`${actionLabel('attack')} / click · release a sword wave`],['doubleJump',touch?'↑, then press ↑ again in the air · double jump':`${jumpKey}, then press ${jumpKey} again in the air · double jump`],['boost',touch?'HOLD » · boost drains energy':`HOLD ${boostKey} · boost drains energy`]];
  if(state.element==='lightning')steps.push(['phase',touch?'↑ → ↑ → NEW PRESS » AND HOLD':`${jumpKey} ×2 → RELEASE, THEN PRESS AND HOLD ${boostKey}`]);
  const pending=steps.find(([id])=>!mastery.actions.includes(id));
  $('tutorial').textContent=pending?pending[1]:'';
  $('tutorial').style.display=pending&&state.mode==='playing'&&!state.boss&&$('routeHint').style.display==='none'?'block':'none';
}
const MISSION_POOL=[
  {id:'distance',label:'Travel 200 m',target:200,value:()=>state.distance},
  {id:'coins',label:'Earn 20 coins',target:20,value:()=>state.runCoins},
  {id:'demons',label:'Defeat 5 demons',target:5,value:()=>state.kills},
  {id:'near',label:'Make 2 near misses',target:2,value:()=>state.nearMisses},
  {id:'route',label:'Cross a terrain section without damage',target:1,value:()=>state.metrics?.cleanRoutes||0},
  {id:'counter',label:'Hit an EXPOSED boss 3 times',target:3,value:()=>state.metrics?.counterHits||0},
  {id:'energy',label:'Boost for 4 seconds',target:4,value:()=>state.metrics?.boostSeconds||0},
  {id:'double',label:'Perform 4 double jumps',target:4,value:()=>state.metrics?.doubleJumps||0},
  {id:'combo',label:'Build a 5-hit streak',target:5,value:()=>state.metrics?.bestCombo||0},
];
function selectMissions(run){if(run===0)return MISSION_POOL.slice(0,3);const variants=[[0,3,6],[1,4,7],[2,5,8],[0,4,8],[1,3,7],[2,6,8],[0,5,7],[1,6,4]];return variants[(run-1)%variants.length].map(i=>MISSION_POOL[i]);}
function nextGoal(){const remaining=ELEMENTS.length-state.ownedElements.length;if(remaining)return state.coins<ELEMENT_PRICE?`${ELEMENT_PRICE-state.coins} ◉ to your next school · collection ${state.ownedElements.length}/5`:`New school available for ${ELEMENT_PRICE} ◉ · collection ${state.ownedElements.length}/5`;return `Beat your best: ${Math.floor(state.best).toLocaleString('en-US')} points`;}
function updateMissions(){
  const missions=state.missions||MISSION_POOL.slice(0,3);let first=-1;
  for(let i=0;i<missions.length;i++)if(!state.missionDone[i]&&missions[i].value()>=missions[i].target){state.missionDone[i]=true;addCoins(10);if(state.boss?.phase!=='dead')notify('Mission complete',missions[i].label+' · +10 coins',2.2);}
  for(let i=0;i<missions.length;i++)if(!state.missionDone[i]){first=i;break;}
  const mission=missions[first];$('missionText').textContent=mission?`${mission.label} · ${Math.min(mission.target,Math.floor(mission.value()))}/${mission.target} · +10 ◉`:'✓ All three missions complete · '+nextGoal();
  const goal=$('nextGoalText');if(goal)goal.textContent=nextGoal();
}
const HIT_REASONS={
  fall:['Fell off the path','Follow the coins across the platforms; a second jump extends your airtime.'],
  rock:['Rock barrier','Change lanes or jump over it. Water breaks rocks with two separate waves.'],
  crystal:['Crystals','Change lanes before the obstacle.'],spikes:['Spikes','Jump before reaching the spikes.'],
  arch:['Low arch','Press S / ↓ to slide; in the air, it makes you drop quickly.'],
  pendulum:['Pendulum','Watch the moving blade, then change lanes or slide under it.'],
  sawGate:['Spinning saw','Change lanes or double jump.'],
  demon:['Demon','Fire a sword wave early or change lanes.'],
  sweep:['Guardian high slash','Slide under the high arc.'],slam:['Guardian ground slam','Jump over the low wave.'],
  dash:['Guardian dash','Leave the marked lane once the target locks.'],bolt:['Cursed seal','Leave the red lane before the attack.'],
  contact:['Obstacle collision','Change lanes early; the katana only breaks light obstacles.'],
};
function recordHit(kind){const [label,baseHint]=HIT_REASONS[kind]||HIT_REASONS.contact;const hint=kind==='arch'?`Press ${actionLabel('slide')} / ↓ to slide; in the air, it makes you drop quickly.`:baseHint;state.lastHit={kind,label,hint,distance:Math.floor(state.distance),at:state.elapsed,lane:state.lane};if(state.metrics){state.metrics.damageTaken++;state.metrics.hits.push({...state.lastHit});if(state.metrics.hits.length>24)state.metrics.hits.shift();}}
function saveRunMetrics(){
  if(!state.metrics||state.metrics.ended)return;
  Object.assign(state.metrics,{ended:true,seconds:Number(state.elapsed.toFixed(2)),distance:Math.floor(state.distance),score:Math.floor(state.score),coinsEarned:state.runCoins,bosses:state.bosses,school:state.element,seed:state.runSeed});
  if(PREVIEW)return;
  try{const saved=JSON.parse(profileSession.read(RUN_METRICS_KEY,'[]')),history=Array.isArray(saved)?saved.slice(-9):[];history.push(state.metrics);profileSession.write(RUN_METRICS_KEY,JSON.stringify(history));}catch{}
}
const PROFILE_VERSION=3,isSchool=id=>ELEMENTS.some(e=>e.id===id);
function decodeProfile(raw){
  let saved;try{saved=JSON.parse(raw);}catch{}const decoded={version:PROFILE_VERSION,wallet:0,element:null,ownedElements:[]};
  if(!saved||typeof saved!=='object'||Array.isArray(saved))return decoded;
  decoded.wallet=clamp(Math.floor(Number(saved.wallet)||0),0,9999999);decoded.ownedElements=[...new Set((Array.isArray(saved.ownedElements)?saved.ownedElements:[]).filter(isSchool))];
  if(!(Number(saved.version)>=PROFILE_VERSION)&&isSchool(saved.element)&&!decoded.ownedElements.includes(saved.element))decoded.ownedElements.push(saved.element);
  decoded.element=decoded.ownedElements.includes(saved.element)?saved.element:decoded.ownedElements[0]||null;return decoded;
}
function decodeRecord(raw){const n=Number(raw);return Number.isFinite(n)?clamp(Math.floor(n),0,999999999):0;}
let profile=decodeProfile(profileSession.read(PROFILE_KEY,'{}'));
let storedRecord=0;try{storedRecord=decodeRecord(profileSession.read('ninjaHighScore','0'));}catch{}
const state={mode:'menu',returnMode:'playing',lane:0,x:0,y:0,vy:0,jumps:0,grounded:true,groundHeight:0,coyote:.1,jumpBuffer:0,flip:0,slide:0,falling:false,hp:3,maxHp:3,distance:0,worldDistance:0,world:0,score:0,coins:profile.wallet,element:profile.element,ownedElements:[...profile.ownedElements],runCoins:0,kills:0,bosses:0,combo:0,multiplier:1,comboTimer:0,elapsed:0,speed:15,cooldown:0,attackTime:0,invincible:0,trauma:0,hitStop:0,spawnTimer:60,row:0,upgrades:{range:0,cooldown:0},purchases:0,shield:false,magnet:0,boss:null,transitionTime:0,gameOverSent:false,best:storedRecord,noticeTime:0,tutorialTime:0,reducedMotion:false,lowQuality:false,missionDone:[false,false,false],nearMisses:0,terrainSerial:0,lastDamage:-100,courseTravel:0,slideQueued:0,stage:0,patternName:'First Beat',baseSpeed:15,boostEnergy:getElementRules(profile.element).energyMax,boostHeld:false,boostActive:false,boostExhausted:false,boostStrength:0,boostRegenDelay:0,pendingWave:false,swingWindup:0,energySchool:profile.element,darkSouls:0,chargeActive:false,chargeUsed:false,chargeY:0};
const boostKeys=new Set();let boostTouch=false;
function saveProfile(){profile={version:PROFILE_VERSION,wallet:state.coins,element:state.element,ownedElements:[...state.ownedElements]};return profileSession.write(PROFILE_KEY,JSON.stringify(profile));}
function addCoins(n){if(!profileSession.canWrite())return;state.coins+=n;state.runCoins+=n;if(state.metrics)state.metrics.coinsEarned=state.runCoins;saveProfile();}
function reloadStoredProgress(){
  if(PREVIEW)return;
  profile=decodeProfile(profileSession.read(PROFILE_KEY,'{}'));state.coins=profile.wallet;state.ownedElements=[...profile.ownedElements];setSchool(profile.element);
  state.best=Math.max(0,decodeRecord(profileSession.read('ninjaHighScore','0')));
  mastery={version:1,actions:[],runs:0};try{const saved=JSON.parse(profileSession.read(MASTERY_KEY,'{}'));if(saved&&typeof saved==='object'&&!Array.isArray(saved))mastery={version:1,actions:[...new Set((Array.isArray(saved.actions)?saved.actions:[]).filter(id=>TUTORIAL_ACTIONS.includes(id)))],runs:clamp(Math.floor(Number(saved.runs)||0),0,1000000)};}catch{}
}
const audio=new WebAudioManager();let audioLoading=false;
const audioPolish=createAudioPolish(audio,{getSettings:()=>settingsUI?.value||fallbackSettings.value});
const AUDIO_URLS={bgMusic:'bg-music.mp3',loseLife:'lose-life.mp3',collectBonus:'collect-bonus.mp3',ghostDie:'ghost-die.mp3',barricadeBreak:'barricade-break.mp3',swordSwing:'sword-swing.mp3'};
function unlockSound(){audio.unlock();if(!audioLoading){audioLoading=true;for(const [name,path] of Object.entries(AUDIO_URLS))audio.loadAudio(name,'./assets/audio/'+path,name==='bgMusic').then(()=>{if(name==='bgMusic'&&state.mode==='playing')audio.play(name,true);});}else if(state.mode==='playing'&&!audio.sources.bgMusic)audio.play('bgMusic',true);}
function tone(f=450,d=.1,type='sine',volume=.08){if(audio.isMuted||!audio.context||!audio.isUnlocked)return;const c=audio.context,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,c.currentTime);o.frequency.exponentialRampToValueAtTime(f*.55,c.currentTime+d);g.gain.setValueAtTime(volume,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+d);o.connect(g);g.connect(audio.effectsGain);o.start();o.stop(c.currentTime+d);}
function sound(name){if(audio.buffers[name])audio.play(name);else tone(name==='collectBonus'?850:name==='swordSwing'?240:110,.12);}
function haptic(){try{navigator.vibrate?.(12);}catch{}}
const renderer=new THREE.WebGLRenderer({canvas:$('gameCanvas'),antialias:true,powerPreference:'high-performance'});
state.reducedMotion=fallbackSettings.value.reducedMotion;state.lowQuality=fallbackSettings.value.lowQuality;
const quality={ratio:qualityPixelRatio(devicePixelRatio,state.lowQuality),minRatio:Math.min(devicePixelRatio,.75),slow:0,fast:0};
renderer.setPixelRatio(quality.ratio);renderer.shadowMap.enabled=!state.lowQuality;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(56,1,.12,360);
const hemi=new THREE.HemisphereLight(0x91b3cd,0x15131f,1.05);scene.add(hemi);
const key=new THREE.DirectionalLight(0xa9c9f5,3.2);key.position.set(-11,17,-8);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-15,right:15,top:24,bottom:-26,near:.5,far:70});key.shadow.normalBias=.035;scene.add(key);
const rim=new THREE.DirectionalLight(0xe2b493,2.3);rim.position.set(7,7,13);scene.add(rim);
const heroLight=new THREE.PointLight(0x8ad8e6,3.1,11,2);heroLight.position.set(1,3,6);scene.add(heroLight);
const reflectionData=new Uint8Array(128*64*4);
for(let y=0;y<64;y++)for(let x=0;x<128;x++){const u=x/127,v=y/63,sky=1-v,moon=Math.exp(-((u-.65)**2/.008+(v-.27)**2/.025));const i=(y*128+x)*4;reflectionData[i]=18+sky*37+moon*170;reflectionData[i+1]=24+sky*45+moon*164;reflectionData[i+2]=31+sky*63+moon*152;reflectionData[i+3]=255;}
const reflectionMap=new THREE.DataTexture(reflectionData,128,64,THREE.RGBAFormat);reflectionMap.mapping=THREE.EquirectangularReflectionMapping;reflectionMap.colorSpace=THREE.SRGBColorSpace;reflectionMap.minFilter=THREE.LinearFilter;reflectionMap.magFilter=THREE.LinearFilter;reflectionMap.needsUpdate=true;scene.environment=reflectionMap;scene.environmentIntensity=.65;
const director=createRunDirector(),finishers=createElementFinishers(THREE,scene),boostArt=createBoostArt(THREE,scene),chargeArt=createChargeArt(THREE,scene),bossFx=createBossEffects(THREE,scene),pendingRows=[];
const world=createWorldArt(THREE,scene),actors=createActors(THREE),course=createCourseAssets(THREE),waveArt=createWaveArt(THREE);
const ichi=actors.createIchi();ichi.position.set(0,0,4);scene.add(ichi);
const shadow=new THREE.Mesh(new THREE.CircleGeometry(.7,32),new THREE.MeshBasicMaterial({color:0x050811,transparent:true,opacity:.4,depthWrite:false}));shadow.rotation.x=-Math.PI/2;scene.add(shadow);
const shieldMesh=new THREE.Mesh(new THREE.SphereGeometry(1.4,16,12),new THREE.MeshBasicMaterial({color:0x70dbd0,transparent:true,opacity:.1,wireframe:true,depthWrite:false}));scene.add(shieldMesh);shieldMesh.visible=false;
const bossSeal=new THREE.Group();bossSeal.name='Guardian seal · guard / counterattack';bossSeal.visible=false;scene.add(bossSeal);
const sealMaterial=new THREE.MeshBasicMaterial({color:0xcdb384,transparent:true,opacity:.8,depthWrite:false,toneMapped:false});
const closedSeal=new THREE.Mesh(new THREE.TorusGeometry(1,.022,4,48),sealMaterial),openSeal=new THREE.Mesh(new THREE.TorusGeometry(1,.028,4,42,Math.PI*1.45),sealMaterial);bossSeal.add(closedSeal,openSeal);
const runePositions=[];for(let i=0;i<6;i++){const a=i*Math.PI/3;for(const r of [.7,.9])runePositions.push(Math.cos(a)*r,Math.sin(a)*r,0);}const runeGeo=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(runePositions,3));bossSeal.add(new THREE.LineSegments(runeGeo,new THREE.LineBasicMaterial({color:0xe3cda3,transparent:true,opacity:.7,toneMapped:false})));

const entities=[],waves=[],particles=[],hazards=[],terrains=[],pools={};
const bossActorCache=new Map();
function releaseBossActor(){if(!state.boss)return;bossFx.clear();state.boss.object.visible=false;scene.remove(state.boss.object);}
const enemyCore=new THREE.MeshBasicMaterial({color:0xff9473,transparent:true,opacity:.95,depthWrite:false,toneMapped:false}),enemyHalo=new THREE.MeshBasicMaterial({color:0xf64462,transparent:true,opacity:.24,depthWrite:false,toneMapped:false});
const enemyArc=new THREE.TorusGeometry(1,.055,6,36,Math.PI*1.3);
const geo={box:new THREE.BoxGeometry(1,1,1),orb:new THREE.IcosahedronGeometry(.42,1),coin:new THREE.CylinderGeometry(.23,.23,.065,16)};
const mats={gold:new THREE.MeshStandardMaterial({color:0xe6c78b,metalness:.65,roughness:.25,emissive:0x6c4318,emissiveIntensity:.4}),dark:new THREE.MeshStandardMaterial({color:0x111b28}),fire:new THREE.MeshBasicMaterial({color:0xff7255}),cyan:new THREE.MeshBasicMaterial({color:0x86e7ee,transparent:true,opacity:.65,depthWrite:false})};
function mesh(g,geometry,material,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);g.add(m);return m;}
function makeObstacle(kind,options={}){return course.makeObstacle(kind,options);}
function spawn(kind,lane,z,y,options={}){
  const span=clamp(Math.floor(options.span||1),1,3),poolKey=kind==='demon'?`demon-theme${state.world%3}`:span===1?kind:kind+'x'+span;
  const pool=pools[poolKey]??=[];let object=pool.pop();
  if(!object){if(kind==='coin'){object=new THREE.Group();mesh(object,geo.coin,mats.gold,0,0,0).rotation.x=Math.PI/2;mesh(object,geo.box,mats.dark,0,0,.04,.075,.08,.01);}else if(kind==='demon'){object=actors.createDemon(false,state.world%3);object.userData.theme=state.world%3;}else if(['projectile','magnet','shieldPickup'].includes(kind)){object=new THREE.Group();if(kind==='projectile'){mesh(object,enemyArc,enemyCore,0,0,0,1.1,.65,1).rotation.z=-.46;mesh(object,enemyArc,enemyHalo,0,0,.13,1.2,.82,1).rotation.z=-.46;}else mesh(object,geo.orb,mats.cyan,0,0,0);if(kind!=='projectile')mesh(object,new THREE.TorusGeometry(.64,.035,5,20),mats.gold,0,0,0).rotation.x=.6;}else object=makeObstacle(kind,{span});scene.add(object);}
  object.traverse(n=>{if(n.isMesh)n.castShadow=false;});object.userData.shadowActive=false;object.visible=true;object.position.set(lane*2.8,y??(['coin','magnet','shieldPickup','projectile'].includes(kind)?1.1:0),z);object.scale.setScalar(1);object.rotation.set(0,kind==='demon'?Math.PI:0,0);
  if(kind==='rock')course.setRockDamage?.(object,0);
  const e={kind,lane,poolKey,span,object,z,y:object.position.y,hp:kind==='rock'?2:object.userData.hp??(kind==='shrine'?2:1),dead:false,checked:false,phase:Math.random()*6};entities.push(e);return e;
}
function removeEntity(e){e.object.visible=false;(pools[e.poolKey||e.kind]??=[]).push(e.object);}
function clearEntities(){pendingRows.length=0;state.pendingWave=false;state.swingWindup=0;state.attackBuffer=0;finishers.clear();boostArt.clear();chargeArt.clear();bossFx.clear();world.setBossCinematic?.(false);$('gameCanvas').dataset.bossDeathAge='0';bossSeal.visible=false;for(const e of entities)removeEntity(e);entities.length=0;for(const w of waves){waveArt.dispose(w.object);scene.remove(w.object);}waves.length=0;for(const p of particles){p.object.visible=false;particlePool.push(p.object);}particles.length=0;for(const h of hazards){scene.remove(h.mesh);h.mesh.geometry.dispose();h.mesh.material.dispose();}hazards.length=0;for(const t of terrains){scene.remove(t.object);course.dispose?.(t.object);}terrains.length=0;world.setGaps?.([]);}
function syncElementEnergy(){
  if(state.energySchool===state.element)return;
  const oldMax=getElementRules(state.energySchool).energyMax,newMax=getElementRules(state.element).energyMax;
  state.boostEnergy=clamp(state.boostEnergy/oldMax*newMax,0,newMax);state.energySchool=state.element;
}
function setSchool(element){
  element=ELEMENTS.some(e=>e.id===element)?element:null;
  if(state.element!==element){state.darkSouls=0;if(element!=='lightning'){state.chargeActive=false;chargeArt.clear();ichi.visible=true;}}
  state.element=element;syncElementEnergy();updateHUD();
}
function tryLightningCharge(){
  if(state.element!=='lightning'||state.mode!=='playing'||state.transitionTime>0||state.grounded||state.jumps!==2||state.chargeUsed||state.chargeActive||state.boostEnergy<CHARGE_MIN_ENERGY)return false;
  state.chargeActive=true;state.chargeUsed=true;state.chargeY=Math.max(state.y,1.15);state.y=state.chargeY;state.vy=0;state.flip=0;state.slide=0;state.slideQueued=0;state.jumpBuffer=0;state.pendingWave=false;state.attackTime=0;state.attackBuffer=0;state.boostRegenDelay=.7;state.boostExhausted=false;learnAction('phase');if(state.metrics)state.metrics.charges++;
  burst(state.x,state.y+1,4,0xba9dff,12,.8);tone(690,.2,'sine',.06);return true;
}
function setBoostHeld(held){
  held=Boolean(held)&&state.mode==='playing'&&state.transitionTime<=0;const pressed=held&&!state.boostHeld;
  if(pressed){syncElementEnergy();state.boostExhausted=state.boostEnergy<20;tryLightningCharge();}
  if(!held){state.boostExhausted=false;state.chargeActive=false;ichi.visible=true;}state.boostHeld=held;
}
function clearBoostInput(){boostKeys.clear();boostTouch=false;setBoostHeld(false);state.boostActive=false;chargeArt.clear();}
function updateBoostState(dt){
  syncElementEnergy();const rules=getElementRules(state.element);
  if(state.chargeActive&&(!state.boostHeld||!rules.lightningCharge||state.boostExhausted||state.boostEnergy<=0||state.transitionTime>0)){state.chargeActive=false;ichi.visible=true;}
  state.boostActive=state.boostHeld&&!state.boostExhausted&&state.boostEnergy>0&&state.transitionTime<=0;
  if(state.boostActive){state.boostEnergy=Math.max(0,state.boostEnergy-26*dt);state.boostRegenDelay=.7;if(state.boostEnergy<1e-7){state.boostEnergy=0;state.boostExhausted=true;state.boostActive=false;state.chargeActive=false;ichi.visible=true;}}
  else if(!state.boostHeld){state.boostRegenDelay=Math.max(0,state.boostRegenDelay-dt);if(state.boostRegenDelay===0)state.boostEnergy=Math.min(rules.energyMax,state.boostEnergy+rules.energyRegen*dt);}
  state.boostStrength=lerp(state.boostStrength,state.boostActive?1:0,1-Math.exp(-(state.boostActive?8:12)*dt));if(state.boostStrength<.001)state.boostStrength=0;updateBoostHUD();
}
function updateBoostHUD(){
  const max=getElementRules(state.element).energyMax;
  $('boostFill').style.transform='scaleX('+clamp(state.boostEnergy/max,0,1)+')';$('boostEnergy').setAttribute('aria-valuemax',String(max));$('boostEnergy').setAttribute('aria-valuenow',String(Math.round(state.boostEnergy)));
  $('boostValue').textContent=Math.round(state.boostEnergy)+'/'+max;
  const touch=matchMedia('(pointer:coarse)').matches,boostKey=touch?'»':actionLabel('boost'),jumpKey=touch?'↑':actionLabel('jump');$('elementHint').textContent=state.element==='lightning'?`${jumpKey} ×2 → NEW PRESS ${boostKey} AND HOLD`:state.element==='wind'?'CAPACITY +50% · REGEN ×2':state.element==='fire'?'GUARDIAN DAMAGE ×2':state.element==='water'?'ROCKS · TWO WAVES':state.element==='darkness'?'SOULS '+state.darkSouls+'/3 · +1 HEART':'';
  if(state.element==='lightning'){if(state.chargeActive)$('elementHint').textContent='HOLD '+boostKey+' · RELEASE TO EXIT';else if(state.chargeUsed&&!state.grounded)$('elementHint').textContent='LAND TO PHASE AGAIN';}
  $('boostLabel').textContent=state.chargeActive?`PHASING · HOLD ${boostKey}`:state.boostActive?'BOOST':state.boostHeld&&state.boostExhausted?`RELEASE ${boostKey}`:state.boostEnergy<20?'RECHARGING':`${boostKey} · BOOST`;
  $('boostMeter').classList.toggle('boosting',state.boostActive);$('boostButton').classList.toggle('boosting',state.boostActive);$('gameContainer').classList.toggle('phase-charge',state.chargeActive);
  $('boostVignette').style.opacity=state.reducedMotion?'0':String(state.boostStrength*(state.chargeActive?.58:.4));
  $('gameCanvas').dataset.boostEnergy=state.boostEnergy.toFixed(1);$('gameCanvas').dataset.boostMax=String(max);$('gameCanvas').dataset.boostStrength=state.boostStrength.toFixed(2);$('gameCanvas').dataset.chargeActive=String(state.chargeActive);
}
function groupRowObstacles(obstacles=[]){
  const sorted=[...obstacles].sort((a,b)=>a.lane-b.lane),result=[];
  for(let i=0;i<sorted.length;i++){const first=sorted[i];let end=i;
    if(['rock','crystal','spikes'].includes(first.kind))while(end+1<sorted.length&&sorted[end+1].kind===first.kind&&sorted[end+1].lane===sorted[end].lane+1)end++;
    result.push({...first,lane:(first.lane+sorted[end].lane)/2,span:end-i+1});i=end;
  }
  return result;
}
function upgradePrice(id='range'){return 18+(state.upgrades[id]||0)*14;}
function cooldownMax(){return .62*Math.pow(.84,state.upgrades.cooldown);}
function waveRange(){return 33+state.upgrades.range*9;}
function waveDamage(element=state.element){return getElementRules(element).bossDamage;}function waveWidth(){return 1.45;}
function notify(title,sub='',seconds=2.6){if(state.boss&&state.boss.phase!=='dead'){state.noticeTime=0;$('notification').style.opacity='0';return;}$('notification').firstElementChild.textContent=title;$('notification').lastElementChild.textContent=sub;state.noticeTime=seconds;$('notification').style.opacity='1';}
const projected=new THREE.Vector3();
function floating(text,x,y,z,color){projected.set(x,y,z).project(camera);if(projected.z>1)return;const el=document.createElement('div');el.className='float-text';el.textContent=text;el.style.left=(projected.x*.5+.5)*innerWidth+'px';el.style.top=(-projected.y*.5+.5)*innerHeight+'px';if(color)el.style.color=color;$('floatLayer').appendChild(el);el.addEventListener('animationend',()=>el.remove());}
const particlePool=[];
function burst(x,y,z,color,count=10,power=1){for(let i=0;i<count&&particles.length<140;i++){let o=particlePool.pop();if(!o){o=new THREE.Mesh(geo.box,new THREE.MeshBasicMaterial({color,transparent:true}));scene.add(o);}o.material.color.setHex(color);o.material.opacity=1;o.visible=true;const s=.025+Math.random()*.075;o.scale.set(s,s,s);o.position.set(x,y,z);particles.push({object:o,life:.4+Math.random()*.4,vx:(Math.random()-.5)*7*power,vy:2+Math.random()*4*power,vz:(Math.random()-.5)*5*power});}}
function setMode(mode){if(mode==='playing'&&contextMustResume)mode='paused';if(mode==='playing'&&(storageFault||!profileSession.canWrite()||contextRecovery?.lost||settingsUI?.isOpen))return false;if(mode==='playing'){runtimeMessage('');if(state.mode!=='playing')frameTelemetry?.reset();}if(mode!=='playing'){clearBoostInput();state.attackBuffer=0;swipeStart=null;}state.mode=mode;document.body.classList.toggle('playing',mode==='playing');for(const id of ['startScreen','upgradeScreen','pauseScreen','gameOverScreen'])$(id).classList.toggle('active',id==={menu:'startScreen',upgrade:'upgradeScreen',paused:'pauseScreen',gameOver:'gameOverScreen'}[mode]);$('missionText').style.display=mode==='playing'?'block':'none';$('hud').style.display=mode==='menu'||(mode==='upgrade'&&state.returnMode==='menu')?'none':'block';$('pauseButton').style.display=['playing','paused','upgrade'].includes(mode)?'block':'none';if(mode!=='playing'){$('tutorial').style.display='none';$('bossWarning').style.display='none';$('routeHint').style.display='none';}if($('nextGoalText'))$('nextGoalText').textContent=nextGoal();if(audio.context&&audio.musicGain)audio.musicGain.gain.setTargetAtTime(mode==='playing'?.08:.025,audio.context.currentTime,.18);audioPolish.setContext({mode,world:state.world,boss:Boolean(state.boss&&state.boss.phase!=='dead')});settingsUI?.syncFocus();const focus={menu:'startButton',paused:'resumeButton',upgrade:'closeUpgrade',gameOver:'restartButton'}[mode];(focus?$(focus):$('gameCanvas')).focus({preventScroll:true});}
function updateHUD(){
  syncElementEnergy();const remainingJumps=Math.max(0,2-Math.max(state.jumps,!state.grounded&&state.coyote<=0?1:0));$('jumpStatus').textContent='JUMPS · '+remainingJumps+'/2';for(const button of document.querySelectorAll('[data-action="jump"]'))button.setAttribute('aria-label','Jumps remaining: '+remainingJumps+' of 2');
  document.body.classList.toggle('boss-fight',Boolean(state.boss&&state.boss.phase!=='dead'));
  $('worldName').textContent=THEMES[state.world%3].name;$('chapterLabel').textContent=`CHAPTER ${String(state.world+1).padStart(2,'0')} · ${['ARRIVAL','RHYTHM','BLADE','STORM'][getRunStage(state.worldDistance)]}`;$('coins').textContent=state.coins;$('score').textContent=Math.floor(state.score).toLocaleString('en-US');$('lives').setAttribute('aria-label',`Hearts: ${state.hp} of ${state.maxHp}`);$('lives').innerHTML=Array.from({length:state.maxHp},(_,i)=>`<i class="life ${i>=state.hp?'empty':''}"></i>`).join('')+`<span class="life-count">${state.hp}/${state.maxHp}</span>`;$('distanceValue').textContent=Math.floor(state.distance)+' m';$('bossDistance').textContent=state.boss?'WORLD GUARDIAN':`GUARDIAN · ${Math.ceil(Math.max(0,WORLD_LENGTH-state.worldDistance))} m`;$('routeFill').style.width=clamp(state.worldDistance/WORLD_LENGTH*100,0,100)+'%';$('upgradeCost').textContent=state.element?'· '+ELEMENTS.find(e=>e.id===state.element).name:'· SCHOOLS';$('upgradeButton').classList.toggle('ready',state.coins>=18);$('combo').style.opacity=state.multiplier>1?'1':'0';$('combo').innerHTML=`×${state.multiplier}<small>HIT STREAK</small>`;document.querySelectorAll('.jump-dot').forEach((e,i)=>e.classList.toggle('used',i<state.jumps));$('effectStatus').textContent=[PREVIEW&&state.previewProtect?'TEST INVINCIBILITY':null,state.shield?'WARD · 1 HIT':null,state.magnet>0?'MAGNET '+Math.ceil(state.magnet)+'s':null,state.chargeActive?'PHASING':state.element==='darkness'?'DARKNESS · SOULS '+state.darkSouls+'/3':state.element?ELEMENTS.find(e=>e.id===state.element).name.toUpperCase():null].filter(Boolean).join(' · ');
  const schoolColor=ELEMENTS.find(e=>e.id===state.element)?.color||'#7fdcff';for(const id of ['boostMeter','boostButton','boostVignette'])$(id).style.color=schoolColor;updateBoostHUD();
  updateMissions();
}
function startRunProgress(){
  state.attackBuffer=0;state.lastHit=null;state.lastMissNotice=-100;state.runBestStart=state.best;state.runSeed=Math.floor(Math.random()*0x100000000)>>>0;
  state.missions=selectMissions(mastery.runs);state.metrics={version:1,run:mastery.runs+1,seed:state.runSeed,damageTaken:0,hits:[],waves:0,counterHits:0,cleanRoutes:0,doubleJumps:0,slides:0,laneChanges:0,bestCombo:0,boostSeconds:0,charges:0,coinsEarned:0,coinsSpent:0,bossEncounters:[]};
  mastery.runs++;saveMastery();
}
function startGame(){if(storageFault||contextRecovery?.lost){runtimeMessage(storageFault?'Saving is unavailable. Select Retry Access.':'Graphics are recovering. Wait for confirmation, then select Continue.');return false;}if(!profileSession.canWrite()){profileSession.acquire().then(ok=>{if(ok)startGame();});return false;}contextMustResume=false;clearEntities();releaseBossActor();Object.assign(state,{lane:0,x:0,y:0,vy:0,jumps:0,grounded:true,groundHeight:0,coyote:.1,jumpBuffer:0,flip:0,slide:0,falling:false,hp:3,maxHp:3,distance:0,worldDistance:0,world:0,score:0,runCoins:0,kills:0,bosses:0,combo:0,multiplier:1,comboTimer:0,elapsed:0,speed:15,cooldown:0,attackTime:0,invincible:1,trauma:0,hitStop:0,spawnTimer:60,row:0,purchases:0,upgrades:{range:0,cooldown:0},shield:false,magnet:0,boss:null,transitionTime:0,gameOverSent:false,noticeTime:0,tutorialTime:0,missionDone:[false,false,false],nearMisses:0,terrainSerial:0,lastDamage:-100,courseTravel:0,slideQueued:0,stage:0,patternName:'First Beat',baseSpeed:15,boostEnergy:getElementRules(state.element).energyMax,boostHeld:false,boostActive:false,boostExhausted:false,boostStrength:0,boostRegenDelay:0,pendingWave:false,swingWindup:0,energySchool:state.element,darkSouls:0,chargeActive:false,chargeUsed:false,chargeY:0});startRunProgress();clearBoostInput();director.reset(0,state.runSeed);world.setTheme(0);world.reset();ichi.visible=true;key.color.setHex(0xa9c9f5);rim.color.setHex(0xe2b493);ichi.position.set(0,0,4);$('bossHUD').style.display='none';$('floatLayer').replaceChildren();$('transitionFade').style.opacity='0';$('damageFlash').style.opacity='0';$('notification').style.opacity='0';for(let i=0;i<8;i++)spawn('coin',0,-13-i*3.5);setMode('playing');unlockSound();notify('Moonlit Shrine','One blade. One active school.',2.4);updateHUD();updateTutorial();}
function endRun(){
  if(state.mode==='gameOver')return;
  const score=Math.floor(state.score),previousBest=state.runBestStart??state.best;state.best=Math.max(state.best,score);
  profileSession.write('ninjaHighScore',String(state.best));saveProfile();saveRunMetrics();
  $('finalScore').textContent=score.toLocaleString('en-US');$('finalDistance').textContent=Math.floor(state.distance);$('finalKills').textContent=state.kills;$('highScore').textContent=state.best.toLocaleString('en-US');$('menuRecord').textContent=state.best.toLocaleString('en-US');$('resultWorld').textContent=`Chapter ${state.world+1} · ${THEMES[state.world%3].name}`;
  const result={resultReason:state.lastHit?`${state.lastHit.label} · ${state.lastHit.distance} m`:'Run complete',resultHint:state.lastHit?.hint||'Follow the coin trail and try a different rhythm.',finalCoins:String(state.runCoins),recordDelta:score>previousBest?`NEW BEST · +${score-previousBest}`:`TO BEAT YOUR BEST · ${Math.max(1,previousBest-score+1)} POINTS`,resultNextGoal:nextGoal()};
  for(const[id,text]of Object.entries(result))if($(id))$(id).textContent=text;
  setMode('gameOver');audio.stop('bgMusic');state.gameOverSent=true;
}
function damage(kind='contact'){if(state.chargeActive||state.invincible>0||state.mode!=='playing'||(PREVIEW&&state.previewProtect))return;if(state.shield){state.shield=false;state.invincible=1;burst(state.x,state.y+1,4,0x70eee0,20);notify('Ward broken','Hit absorbed',1.3);updateHUD();return;}recordHit(kind);state.hp--;state.invincible=1.65;state.lastDamage=state.elapsed;state.combo=0;state.multiplier=1;state.trauma=.4;sound('loseLife');haptic();if(!state.reducedMotion){$('damageFlash').style.opacity='.5';setTimeout(()=>$('damageFlash').style.opacity='0',120);}updateHUD();if(state.hp<=0)endRun();}
function rewardKill(e){
  if(!e||e.dead||state.mode!=='playing')return;e.dead=true;state.combo++;state.comboTimer=6;state.multiplier=Math.min(5,1+Math.floor(state.combo/5));if(state.metrics)state.metrics.bestCombo=Math.max(state.metrics.bestCombo,state.combo);
  const demon=e.kind==='demon';state.score+=(demon?50:10)*state.multiplier;const n=demon?5:e.kind==='shrine'?7:3;addCoins(n);
  if(demon){state.kills++;if(state.element==='darkness'){state.darkSouls++;if(state.darkSouls>=3){state.darkSouls=0;const healed=Math.min(state.maxHp,state.hp+1)-state.hp;state.hp+=healed;if(healed){floating('+1 HEART',state.x,state.y+2.5,4,'#c092f1');burst(state.x,state.y+1,4,0xaa70df,12,.7);tone(540,.18,'sine',.035);}}}if(state.element)finishers.spawn(state.element,e.object.position.x,1.2,e.z);}
  floating('+'+n+' ◉',e.object.position.x,2,e.z);burst(e.object.position.x,1.2,e.z,demon?0xd6869e:0xa4ac9e,20);sound(demon?'ghostDie':'barricadeBreak');state.trauma=Math.max(state.trauma,.17);state.hitStop=.035;updateHUD();
}
function jump(){if(state.mode!=='playing'||state.transitionTime>0||state.chargeActive)return;if(state.jumps>=2){state.jumpBuffer=.12;return;}if(state.jumps===0&&!state.grounded&&state.coyote<=0)state.jumps=1;state.slide=0;state.vy=state.jumps===0?10.5:10.1;state.jumps++;state.grounded=false;state.coyote=0;state.jumpBuffer=0;learnAction('jump');burst(state.x,state.y+.12,4,0xa9d6db,7,.5);tone(state.jumps===2?620:430,.1);if(state.jumps===2){state.flip=.62;learnAction('doubleJump');if(state.metrics)state.metrics.doubleJumps++;}updateHUD();}
function slide(){if(state.mode!=='playing'||state.transitionTime>0||state.chargeActive)return;learnAction('slide');if(state.metrics)state.metrics.slides++;if(state.grounded){state.slide=.72;tone(150,.1);}else{state.vy=Math.min(state.vy,-18);state.slideQueued=.9;state.flip=0;}}
function shootWave(){
  learnAction('attack');if(state.metrics)state.metrics.waves++;
  let aimedTarget=null;
  for(const e of entities)if(!e.dead&&e.z<2.5&&(e.object.userData.breakable||e.kind==='demon'||e.kind==='rock'&&state.element==='water')&&Math.abs(e.object.position.x-state.x)<waveWidth()+(e.object.userData.halfWidth||.6)&&(!aimedTarget||e.z>aimedTarget.z))aimedTarget=e;
  const boss=state.boss;if(boss?.phase==='fight'&&Math.abs(boss.object.position.x-state.x)<waveWidth()+1.9&&(!aimedTarget||boss.object.position.z>aimedTarget.z))aimedTarget=boss;
  const object=waveArt.create(state.element||'plain',waveWidth());object.position.set(state.x,state.groundHeight+.95+Math.min(Math.max(0,state.y-state.groundHeight)*.28,1),2.5);scene.add(object);waves.push({object,z:2.5,previousZ:2.5,travel:0,hits:new Set(),aimedTarget,width:waveWidth(),element:state.element||'plain',damage:waveDamage()});
}
function missedWave(wave){const target=wave.aimedTarget;if(wave.hits.size||!target||target.dead||target.phase==='dead'||state.elapsed-state.lastMissNotice<1.2)return;const targetZ=target.object.position.z;state.lastMissNotice=state.elapsed;floating(2.5-targetZ>waveRange()?'OUT OF RANGE':'MISSED',state.x,state.y+2.1,4,'#c4cbd5');}
function attack(){if(state.mode!=='playing'||state.transitionTime>0||state.chargeActive)return false;if(state.cooldown>0){if(state.cooldown<=.100001)state.attackBuffer=.1;return false;}state.attackBuffer=0;state.cooldown=cooldownMax();state.attackTime=SWORD_SWING;state.swingWindup=SWORD_RELEASE;state.pendingWave=true;return true;}
function moveLane(direction){if(state.mode==='playing'&&state.transitionTime<=0){const previous=state.lane;state.lane=clamp(state.lane+direction,-1,1);if(previous!==state.lane){learnAction('lane');if(state.metrics)state.metrics.laneChanges++;}}}
function spawnTerrain(kind,z=-85,options={}){const object=course.makeTerrain(kind,options);object.traverse(n=>{if(n.isMesh)n.castShadow=false;});object.position.z=z;scene.add(object);const t={kind,object,z,length:object.userData.gapLength||options.length||16,ropeLane:options.ropeLane||0,passed:false,damageAtStart:state.metrics?.damageTaken||0};terrains.push(t);return t;}
function surfaceHeight(x,z=4){let floor=0;for(const t of terrains){const rel=z-t.z;if(Math.abs(rel)>t.length/2)continue;if(t.kind==='ridge'){floor=Math.max(floor,Math.pow(Math.sin((rel/t.length+.5)*Math.PI),2)*1.1);continue;}floor=null;for(const s of t.object.userData.supports||[]){if(Math.abs(rel-s.z)<=s.halfLength&&Math.abs(x-(s.lane*2.8))<=s.halfWidth)floor=s.height||0;}if(floor===null)return null;}return floor;}
function terrainUpdate(dt,speed){
  for(let i=terrains.length-1;i>=0;i--){const t=terrains[i];t.z+=speed*dt;t.object.position.z=t.z;if(!t.passed&&t.z-t.length/2>5){t.passed=true;state.score+=75;const clean=state.metrics&&state.metrics.damageTaken===t.damageAtStart;if(clean)state.metrics.cleanRoutes++;floating(clean?'+75 · CLEAN ROUTE':'+75 · ROUTE',state.x,state.y+2,4,'#b5d4cb');}if(t.z-t.length/2>25){scene.remove(t.object);course.dispose?.(t.object);terrains.splice(i,1);}}
  world.setGaps?.(terrains.filter(t=>t.kind!=='ridge').map(t=>({z:t.z,length:t.length})));const next=terrains.find(t=>{const d=4-(t.z+t.length/2);return d<38&&t.z-t.length/2<4;});$('routeHint').style.display=next?'block':'none';if(next)$('routeHint').textContent=next.kind==='rope'?`GAP · ROPE ${['ON THE LEFT','IN THE CENTRE','ON THE RIGHT'][next.ropeLane+1]} OR DOUBLE JUMP`:next.kind==='brokenRoad'?'BROKEN ROAD · FOLLOW THE COINS BETWEEN LANES':next.kind==='stepping'?'STONE ISLANDS · FOLLOW THE COINS':next.kind==='ridge'?'STONE RIDGE · WATCH THE PATH':'GAP · JUMP AGAIN IN THE AIR';
}
function rescueFromFall(){damage('fall');if(state.mode!=='playing')return;for(const t of terrains)if(Math.abs(4-t.z)<t.length/2+2){t.z=4+t.length/2+7;t.object.position.z=t.z;t.passed=true;}world.setGaps?.(terrains.filter(t=>t.kind!=='ridge').map(t=>({z:t.z,length:t.length})));state.y=0;state.vy=0;state.jumps=0;state.flip=0;state.grounded=true;state.chargeUsed=false;state.falling=false;state.invincible=Math.max(state.invincible,1.4);notify('Lost your footing','Ichi is back on the path',1.8);}
function spawnRow(){
  if(state.worldDistance>WORLD_LENGTH-65){state.spawnTimer=1e6;return;}
  const phrase=director.next(state.worldDistance,state.baseSpeed||state.speed),base=state.courseTravel+94;
  state.row++;state.stage=phrase.stage;state.patternName=phrase.name;
  for(const row of phrase.rows)if(94+row.ahead+10<(WORLD_LENGTH-state.worldDistance)/.55)pendingRows.push({...row,at:base+row.ahead});
  if(phrase.terrain)pendingRows.push({terrain:phrase.terrain,at:base+phrase.terrain.ahead});
  if(phrase.rest&&state.row%2===0)pendingRows.push({pickup:'shieldPickup',at:base+15,coinLane:0});
  else if(state.row%7===0)pendingRows.push({pickup:'magnet',at:base+15,coinLane:0});
  state.spawnTimer=phrase.advanceDistance+Math.min(0,state.spawnTimer);
}
function revealCourse(){
  for(let i=pendingRows.length-1;i>=0;i--){const row=pendingRows[i],z=4-(row.at-state.courseTravel);if(z<-104)continue;
    if(row.terrain){const t=spawnTerrain(row.terrain.kind,z,{length:row.terrain.length,ropeLane:row.terrain.ropeLane});if(t.kind==='rope'){for(let n=0;n<9;n++)spawn('coin',t.ropeLane,z+t.length/2+3-n*(t.length+6)/8,1.05);}else if(['stepping','brokenRoad'].includes(t.kind)){for(const support of t.object.userData.supports||[])spawn('coin',support.lane,z+support.z,1.15);}else for(let n=0;n<6;n++)spawn('coin',0,z+t.length/2+3-n*(t.length+6)/5,t.kind==='ridge'?1.9:2.0);
    }else if(row.pickup)spawn(row.pickup,row.coinLane,z);
    else{for(const item of groupRowObstacles(row.obstacles)){const e=spawn(item.kind,item.lane,z,undefined,{span:item.span});e.rhythmAction=row.action;e.rowAt=row.at;e.safeLane=row.safeLane;}
      for(let n=0;n<(row.coins||0);n++)spawn('coin',row.coinLane,z+2+n*1.05,row.coinHeight||1.05);
    }pendingRows.splice(i,1);
  }
}
function spawnBoss(){
  clearEntities();releaseBossActor();state.y=Math.max(state.y,0);const theme=state.world%3;let object=bossActorCache.get(theme);if(!object){object=actors.createDemon(true,theme);bossActorCache.set(theme,object);}object.visible=true;object.scale.setScalar(2.9);object.rotation.set(0,Math.PI,0);object.position.set(0,0,-32);scene.add(object);
  const maxHp=50+Math.min(state.world,5)*10;state.boss={object,hp:maxHp,maxHp,phase:'enter',timer:2.5,stance:'guard',stanceTimer:.7,stanceAge:0,turn:0,stage:1,plan:null,flash:0,guardFlash:0,deathShockDone:false};if(state.metrics){state.metrics.bossEncounters.push({world:state.world,at:state.elapsed,hp:maxHp});if(state.metrics.bossEncounters.length>30)state.metrics.bossEncounters.shift();}
  state.noticeTime=0;$('notification').style.opacity='0';$('bossName').textContent=THEMES[state.world%3].boss;$('bossHUD').style.display='block';$('bossFill').style.width='100%';audioPolish.setContext({mode:state.mode,world:state.world,boss:true});updateBossHUD();updateHUD();
}
function enterBossStance(stance,duration){const b=state.boss;if(!b||b.phase==='dead')return;b.stance=stance;b.stanceTimer=duration;b.stanceAge=0;if(stance==='guard'||stance==='exposed')audioPolish.cue(stance);updateBossHUD();}
function beginBossPattern(){
  const b=state.boss;if(!b||b.phase!=='fight')return;
  if(b.hp/b.maxHp<=.5&&b.stage!==2)b.turn=0;
  b.plan=createBossPattern(state.world,b.turn++,b.hp/b.maxHp,state.lane);b.stage=b.plan.enraged?2:1;
  enterBossStance('windup',b.plan.windup);audioPolish.cue(b.plan.id);
  for(const event of b.plan.events)telegraph(event.lanes,event.kind,{duration:b.plan.windup,delay:event.delay,silent:true});
}
function telegraph(lanes,kind,{duration=1.25,delay=0,silent=false}={}){
  for(const lane of lanes){const wide=kind==='slam'||kind==='sweep',m=new THREE.Mesh(new THREE.PlaneGeometry(wide?10.5:2.65,kind==='sweep'?2.2:29),new THREE.MeshBasicMaterial({color:kind==='sweep'?0xd795e9:kind==='slam'?0xe5a56e:0xe56574,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide}));
    m.rotation.x=-Math.PI/2;m.position.set(wide?0:lane*2.8,.06,kind==='sweep'?-3:-8);scene.add(m);hazards.push({mesh:m,lane,life:duration+delay,total:duration+delay,warningDuration:duration,kind});m.visible=delay===0;
  }
  if(!silent){$('bossWarning').textContent=kind==='slam'?'↑ JUMP · GROUND SLAM':kind==='sweep'?'↓ SLIDE · HIGH ARC':'← LEAVE THE RED ZONE →';$('bossWarning').style.display='block';}
}
function spawnBossProjectile(h){
  const slam=h.kind==='slam',sweep=h.kind==='sweep',dash=h.kind==='dash';
  const e=spawn('projectile',h.lane,slam?-16:sweep?-14:dash?-12:-23,slam?.18:sweep?1.57:1.1);
  e.attackType=h.kind;e.slam=slam;e.sweep=sweep;e.projectileSpeed=slam?28:dash?32:26;
  if(slam)e.object.scale.set(5.2,.32,1);else if(sweep)e.object.scale.set(5.2,.42,1);else if(dash)e.object.scale.set(1.15,1.3,1.5);
  e.object.userData.halfDepth=.6;if(slam){state.trauma=Math.max(state.trauma,.18);tone(85,.2,'triangle',.08);}
  return e;
}
function updateBossHUD(){
  const b=state.boss;if(!b)return;const exposed=b.phase==='fight'&&b.stance==='exposed';
  $('bossHUD').classList.toggle('exposed',exposed);$('bossHUD').classList.toggle('enraged',b.stage===2);
  $('bossState').textContent=b.phase==='enter'?'GUARDIAN AWAKENS':b.phase==='dead'?'SEAL SHATTERED':exposed?`EXPOSED · WAVE ${actionLabel('attack')}`:(b.stage===2?'ENRAGED · ':'GUARD · ')+(b.plan?.name||'WATCH THE MOVEMENT');
  $('gameCanvas').dataset.bossStance=b.phase==='fight'?b.stance:b.phase;
  if(b.phase!=='fight'||exposed||b.stance==='guard'){$('bossWarning').style.display='none';return;}
  const urgent=entities.find(e=>e.kind==='projectile'&&!e.dead&&e.z>-7&&e.z<6&&(e.slam||e.sweep||Math.abs(e.lane*2.8-state.x)<1.3));
  $('bossWarning').style.display='block';$('bossWarning').textContent=urgent?(urgent.slam?'↑ NOW · JUMP':urgent.sweep?'↓ NOW · SLIDE':'← NOW · CHANGE LANES'):b.plan?.prepare||'WATCH THE SEALS';
}
function updateBoss(dt){
  const b=state.boss;if(!b)return;
  if(b.phase==='dead'){bossFx.updateDeath(dt,{reducedMotion:state.reducedMotion});$('gameCanvas').dataset.bossDeathAge=bossFx.deathAge.toFixed(2);$('gameCanvas').dataset.bossStance='dead';if(!b.deathShockDone&&bossFx.deathAge>=.85){b.deathShockDone=true;state.trauma=state.reducedMotion?0:.35;state.hitStop=.045;tone(60,.6,'triangle',.1);}return;}
  b.flash=Math.max(0,b.flash-dt);b.recoil=Math.max(0,(b.recoil||0)-dt);b.guardFlash=Math.max(0,b.guardFlash-dt);b.object.visible=true;
  if(b.phase==='enter'){b.object.position.z=lerp(b.object.position.z,-24,1-Math.exp(-2*dt));b.timer-=dt;if(b.timer<=0){b.phase='fight';enterBossStance('guard',.7);}}
  else{
    b.stanceTimer-=dt;b.stanceAge+=dt;
    if(b.stanceTimer<=0){if(b.stance==='guard')beginBossPattern();else if(b.stance==='windup')enterBossStance('attack',b.plan.attackDuration);else if(b.stance==='attack')enterBossStance('exposed',b.plan.exposed);else enterBossStance('guard',b.plan.recovery);}
    const locked=b.plan?.targetLane||0,targetX=b.stance==='exposed'?0:locked*2.2;
    b.object.position.x=lerp(b.object.position.x,targetX,1-Math.exp(-4*dt));
    const dash=b.plan?.id==='dash'&&b.stance==='attack',targetZ=dash?-11:-24;
    b.object.position.z=lerp(b.object.position.z,targetZ,1-Math.exp(-(dash?11:4)*dt));
  }
  const charge=b.stance==='windup'?clamp(b.stanceAge/(b.plan?.windup||1),0,1):0,strike=b.stance==='attack'?Math.max(0,1-b.stanceAge/.55):0;
  actors.animateDemon(b.object,state.elapsed,Math.max(charge*.85,strike));
  const rig=b.object.userData;
  if(b.plan?.id==='quake'||b.plan?.id==='storm'){if(b.stance==='windup')for(const arm of rig.arms)arm.rotation.x=-charge*2.35;else if(b.stance==='attack'&&b.stanceAge<.45)rig.body.rotation.x=.2*strike;}
  if(b.plan?.id==='sweep'&&b.stance==='windup'){rig.arms[1].rotation.z=.8-charge*1.7;rig.body.rotation.y=charge*.5;}else rig.body.rotation.y=0;
  if(b.stance==='exposed'){rig.body.rotation.x=.16;rig.head.rotation.x=.13;rig.arms[1].rotation.x=.4;}
  bossSeal.visible=true;bossSeal.position.set(b.object.position.x,3.85,b.object.position.z+1.9);bossSeal.rotation.z+=dt*(b.stance==='exposed'?1.2:.22);bossSeal.scale.setScalar(1.24+(b.guardFlash>0?.08:0));closedSeal.visible=b.stance!=='exposed';openSeal.visible=b.stance==='exposed';sealMaterial.color.setHex(b.stance==='exposed'?0x70e9d0:b.stage===2?0xe8787e:0xcdb384);
  b.object.rotation.y=Math.PI+Math.sin(state.elapsed*.5)*.035;b.object.rotation.z=(state.reducedMotion?0:Math.sin(clamp(b.recoil/.2,0,1)*Math.PI)*.065);b.object.position.y=b.plan?.id==='quake'&&b.stance==='windup'?Math.sin(charge*Math.PI)*.18:0;
  updateBossHUD();
}
function bossHit(w){
  const b=state.boss;if(!b||b.phase!=='fight')return;
  if(b.stance!=='exposed'){if(b.guardFlash<=0){b.guardFlash=.45;floating('GUARD',b.object.position.x,5,b.object.position.z,'#c5b395');tone(130,.06,'triangle',.035);}return;}
  const hitElement=w?.element||state.element,damage=waveDamage(hitElement);b.hp=Math.max(0,b.hp-damage);b.flash=.12;b.recoil=.2;if(state.metrics)state.metrics.counterHits++;tone(110,.07,'triangle',.055);state.score+=100;burst(b.object.position.x,3,b.object.position.z,waveArt.colors[hitElement||'plain'],12);state.trauma=Math.max(state.trauma,.16);state.hitStop=.04;
  $('bossFill').style.width=b.hp/b.maxHp*100+'%';floating('-'+damage,b.object.position.x,5,b.object.position.z,'#c3e8df');if(b.hp<=0)defeatBoss();updateHUD();
}
function defeatBoss(){
  const b=state.boss;if(!b||b.phase==='dead')return;b.phase='dead';state.chargeActive=false;chargeArt.clear();ichi.visible=true;bossSeal.visible=false;clearBoostInput();state.pendingWave=false;state.swingWindup=0;
  $('bossHUD').style.display='none';state.bosses++;state.kills++;state.score+=5000;addCoins(35);state.hp=Math.min(state.maxHp,state.hp+1);state.transitionTime=BOSS_DEATH_DURATION;state.trauma=state.reducedMotion?0:.25;state.hitStop=.07;if(state.metrics){const encounter=state.metrics.bossEncounters.at(-1);if(encounter)encounter.seconds=Number((state.elapsed-encounter.at).toFixed(2));}
  world.setBossCinematic?.(true,b.object.position.z);bossFx.beginDeath(b.object,{element:state.element||'plain',reducedMotion:state.reducedMotion});sound('ghostDie');tone(90,.7,'sawtooth',.08);notify('Guardian defeated','Seal shattered · +5000 points · +35 coins',3.8);
  for(const h of hazards){scene.remove(h.mesh);h.mesh.geometry.dispose();h.mesh.material.dispose();}hazards.length=0;for(const e of entities)e.dead=true;$('bossWarning').style.display='none';audioPolish.setContext({mode:state.mode,world:state.world,boss:false});updateHUD();
}
function nextWorld(){clearEntities();releaseBossActor();state.boss=null;state.world++;state.worldDistance=0;state.courseTravel=0;state.chargeActive=false;state.chargeUsed=false;ichi.visible=true;director.reset(state.world,state.runSeed);state.spawnTimer=45;clearBoostInput();state.row=0;state.invincible=2;state.transitionTime=0;state.y=0;state.vy=0;state.jumps=0;state.grounded=true;state.flip=0;world.setTheme(state.world%3);world.reset();$('bossHUD').style.display='none';$('transitionFade').style.opacity='0';key.color.setHex(state.world%3===2?0xe6b1a2:0xa9c9f5);rim.color.setHex(state.world%3===1?0x6bbdad:0xe2b493);notify(THEMES[state.world%3].name,`Chapter ${state.world+1} · ${THEMES[state.world%3].subtitle}`,3.5);for(let i=0;i<6;i++)spawn('coin',0,-15-i*4);audioPolish.setContext({mode:state.mode,world:state.world,boss:false});updateHUD();}
function openUpgrades(){if(state.mode==='upgrade'){closeUpgrades();return;}if(!['playing','menu','gameOver'].includes(state.mode)||state.transitionTime>0)return;state.returnMode=state.mode;renderUpgrades();setMode('upgrade');}
function renderUpgrades(){
  $('upgradeBalance').textContent=`Wallet: ${state.coins} ◉ · Upgrades last one run. Owned schools stay yours.`;
  $('upgradeCards').innerHTML=UPGRADES.map(b=>{const n=state.upgrades[b.id],price=upgradePrice(b.id),missing=Math.max(0,price-state.coins),disabled=n>=4||missing>0||state.returnMode!=='playing';const current=b.id==='range'?`${33+n*9} m`:`${Math.round(.62*Math.pow(.84,n)*1000)} ms`,next=b.id==='range'?`${33+(n+1)*9} m`:`${Math.round(.62*Math.pow(.84,n+1)*1000)} ms`;return `<button class="upgrade-card" data-upgrade="${b.id}" ${disabled?'disabled':''}><span class="symbol">${b.symbol}</span><h3>${b.name}</h3><p>${n>=4?current:current+' → '+next}<br>This run only · resets on death</p><span class="cost">${n>=4?'MASTER · IV':`LEVEL ${n+1}/4 · ${price} ◉`}${n<4&&missing?' · NEED '+missing+' ◉':''}${state.returnMode!=='playing'?' · BUY DURING A RUN':''}</span></button>`;}).join('');
  $('elementCards').innerHTML=ELEMENTS.map(e=>{
    const active=state.element===e.id,owned=state.ownedElements.includes(e.id),disabled=active||!owned&&state.coins<ELEMENT_PRICE;
    return `<button class="element-card ${active?'chosen':owned?'owned':''}" data-element="${e.id}" style="--school:${e.color}" aria-pressed="${active}" ${disabled?'disabled':''}><span>${e.symbol}</span><b>${e.name}</b><small>${active?'ACTIVE':owned?'SELECT · OWNED':'BUY · '+ELEMENT_PRICE+' ◉'}</small><p>${e.id==='lightning'?`Release ${actionLabel('boost')} → ${actionLabel('jump')} ×2 → press ${actionLabel('boost')} again and hold while energy lasts.`:e.desc}${!owned&&state.coins<ELEMENT_PRICE?'<br>Need '+(ELEMENT_PRICE-state.coins)+' ◉ more to buy':''}</p></button>`;
  }).join('');
  const selected=ELEMENTS.find(e=>e.id===state.element);
  $('elementDescription').textContent=(selected?`Active: ${selected.name}. `:'')+'Buying a school activates it immediately. Owned schools can be selected for free and stay unlocked between runs.';
  $('upgradeCards').querySelectorAll('[data-upgrade]').forEach(e=>e.addEventListener('click',()=>buyUpgrade(e.dataset.upgrade)));
  $('elementCards').querySelectorAll('[data-element]').forEach(e=>e.addEventListener('click',()=>chooseElement(e.dataset.element)));
}
function buyUpgrade(id){if(storageFault||!profileSession.canWrite())return false;if(state.mode!=='upgrade'||state.returnMode!=='playing'||!UPGRADES.some(u=>u.id===id)||state.upgrades[id]>=4||state.coins<upgradePrice(id))return false;const spent=upgradePrice(id);if(!profileSession.write(PROFILE_KEY,JSON.stringify({version:PROFILE_VERSION,wallet:state.coins-spent,element:state.element,ownedElements:[...state.ownedElements]})))return false;state.coins-=spent;if(state.metrics)state.metrics.coinsSpent+=spent;state.upgrades[id]++;state.purchases++;tone(730,.2);renderUpgrades();updateHUD();return true;}
function chooseElement(id){
  if(storageFault||!profileSession.canWrite()||state.mode!=='upgrade'||!isSchool(id)||state.element===id)return false;
  const owned=state.ownedElements.includes(id),cost=owned?0:ELEMENT_PRICE;if(state.coins<cost)return false;
  if(!profileSession.write(PROFILE_KEY,JSON.stringify({version:PROFILE_VERSION,wallet:state.coins-cost,element:id,ownedElements:owned?[...state.ownedElements]:[...state.ownedElements,id]})))return false;
  if(!state.ownedElements.includes(id)){
    if(state.coins<ELEMENT_PRICE)return false;
    state.coins-=ELEMENT_PRICE;state.ownedElements.push(id);if(state.metrics)state.metrics.coinsSpent+=ELEMENT_PRICE;
  }
  setSchool(id);renderUpgrades();tone(540,.25);return true;
}
function closeUpgrades(){setMode(state.returnMode||'playing');}
function togglePause(){if(state.mode==='playing')setMode('paused');else if(state.mode==='paused'){if(!contextRecovery?.lost){contextMustResume=false;setMode('playing');}}else if(state.mode==='upgrade')closeUpgrades();}
function action(name){if(name==='left')moveLane(-1);else if(name==='right')moveLane(1);else if(name==='jump')jump();else if(name==='slide')slide();else if(name==='boost')setBoostHeld(true);else if(name==='attack')attack();else if(name==='pause')togglePause();else if(name==='upgrade')openUpgrades();}
function resolveAction(code){return settingsUI?settingsUI.resolveAction(code):fallbackSettings.resolveAction(code);}
function editingTarget(target){return Boolean(target&&(['INPUT','SELECT','TEXTAREA'].includes(target.tagName)||target.isContentEditable||target.closest?.('#settingsScreen')));}
window.addEventListener('keydown',e=>{if(settingsUI?.isOpen||editingTarget(e.target))return;const name=resolveAction(e.code);if(name){if((e.code==='Space'||e.code==='Enter')&&e.target instanceof HTMLButtonElement&&state.mode!=='playing')return;e.preventDefault();if(name==='boost'){if(e.repeat||state.mode!=='playing')return;boostKeys.add(e.code);setBoostHeld(true);}else if(!e.repeat)action(name);}if(e.code==='KeyM'&&!e.repeat)toggleMute();if(e.code==='Enter'&&!e.repeat&&state.mode==='gameOver'&&!(e.target instanceof HTMLButtonElement)){e.preventDefault();startGame();}});
window.addEventListener('keyup',e=>{if(boostKeys.has(e.code)||resolveAction(e.code)==='boost'){e.preventDefault();boostKeys.delete(e.code);setBoostHeld(boostKeys.size>0||boostTouch);}});
$('boostButton').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();$('boostButton').setPointerCapture(e.pointerId);boostTouch=true;setBoostHeld(true);});for(const event of ['pointerup','pointercancel','lostpointercapture'])$('boostButton').addEventListener(event,()=>{boostTouch=false;setBoostHeld(boostKeys.size>0);});
let swipeStart=null;
function consumeSwipe(e){
  if(!swipeStart||swipeStart.id!==e.pointerId||swipeStart.handled)return false;
  const dx=e.clientX-swipeStart.x,dy=e.clientY-swipeStart.y,threshold=clamp(Math.min(innerWidth,innerHeight)*.04,18,32);
  if(Math.max(Math.abs(dx),Math.abs(dy))<threshold)return false;
  swipeStart.handled=true;if(Math.abs(dx)>Math.abs(dy))moveLane(Math.sign(dx));else if(dy<0)jump();else slide();return true;
}
$('gameCanvas').addEventListener('pointerdown',e=>{if(state.mode!=='playing'||swipeStart&&swipeStart.id!==e.pointerId)return;e.preventDefault?.();swipeStart={x:e.clientX,y:e.clientY,id:e.pointerId,handled:false};$('gameCanvas').setPointerCapture(e.pointerId);if(e.pointerType==='mouse'){attack();swipeStart=null;}});
$('gameCanvas').addEventListener('pointermove',e=>{if(state.mode==='playing')consumeSwipe(e);});
$('gameCanvas').addEventListener('pointerup',e=>{if(!swipeStart||swipeStart.id!==e.pointerId)return;if(state.mode==='playing'&&!swipeStart.handled&&!consumeSwipe(e))attack();swipeStart=null;});
for(const name of['pointercancel','lostpointercapture'])$('gameCanvas').addEventListener(name,e=>{if(!e?.pointerId||swipeStart?.id===e.pointerId)swipeStart=null;});
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();action(b.dataset.action);}));
for(const id of ['startButton','restartButton','pauseRestart'])$(id).addEventListener('click',startGame);for(const id of ['pauseButton','resumeButton'])$(id).addEventListener('click',togglePause);for(const id of ['upgradeButton','menuSkillsButton'])$(id).addEventListener('click',openUpgrades);$('closeUpgrade').addEventListener('click',closeUpgrades);
function setMuted(value){audio.setMuted(value);$('muteButton').textContent=value?'♩':'♪';$('muteButton').setAttribute('aria-label',value?'Unmute audio':'Mute audio');}function toggleMute(){setMuted(!audio.isMuted);}$('muteButton').addEventListener('click',()=>{unlockSound();toggleMute();});window.addEventListener('blur',()=>{if(state.mode==='playing')setMode('paused');});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.mode==='playing')setMode('paused');});
function applySettings(value){const qualityChanged=state.lowQuality!==value.lowQuality;state.reducedMotion=value.reducedMotion;state.lowQuality=value.lowQuality;if(qualityChanged){quality.ratio=qualityPixelRatio(devicePixelRatio,state.lowQuality,quality.ratio);quality.slow=0;quality.fast=0;}renderer.setPixelRatio(quality.ratio);renderer.shadowMap.enabled=!state.lowQuality;state.needsRender=true;audioPolish.setMix(value);clearBoostInput();updateTutorial();updateBoostHUD();}
if(typeof $('settingsScreen')?.getClientRects==='function'){
  settingsUI=createSettingsUI({preview:PREVIEW,storage:safeStorage,onChange:applySettings,onOpen(){settingsReturnMode=state.mode;if(state.mode==='playing')setMode('paused');clearBoostInput();},onClose(){if(settingsReturnMode==='playing')setMode('playing');},onTutorialRepeat(){repeatTutorial();}});
}else{
  settingsUI={get value(){return fallbackSettings.value;},isOpen:false,resolveAction:code=>fallbackSettings.resolveAction(code),label:action=>keyLabel(fallbackSettings.value.bindings[action]?.[0]||''),syncFocus(){},update(patch){fallbackSettings.update(patch);applySettings(fallbackSettings.value);}};
  $('reduceMotion').addEventListener('change',e=>settingsUI.update({reducedMotion:e.target.checked}));$('lowQuality').addEventListener('change',e=>settingsUI.update({lowQuality:e.target.checked}));$('tutorialRepeatButton').addEventListener('click',repeatTutorial);
}
applySettings(settingsUI.value);
contextRecovery=createContextRecovery($('gameCanvas'),{onLost(){clearBoostInput();contextMustResume=state.mode==='playing'||state.mode==='upgrade'&&state.returnMode==='playing'||Boolean(settingsUI?.isOpen&&settingsReturnMode==='playing');if(state.mode==='playing')setMode('paused');runtimeMessage('Graphics are temporarily unavailable. Waiting for recovery…');},onRestored(){state.needsRender=true;runtimeMessage(contextMustResume||state.mode==='paused'?'Graphics restored. To resume, select Continue in the pause menu.':'Graphics restored. You can start playing.');}});
$('runtimeRetry')?.addEventListener('click',()=>{storageFault=false;profileSession.acquire().then(ok=>{if(ok){reloadStoredProgress();if(!storageFault)runtimeMessage('');updateHUD();}});});
function simulate(dt){if(storageFault||!profileSession.canWrite()||contextRecovery?.lost){if(state.mode==='playing')setMode('paused');return;}
  state.elapsed+=dt;if(state.pendingWave){state.swingWindup-=dt;if(state.swingWindup<=0){state.pendingWave=false;shootWave();sound('swordSwing');}}
  const previousCooldown=state.cooldown,buffered=state.attackBuffer||0;
  state.cooldown=Math.max(0,state.cooldown-dt);state.attackTime=Math.max(0,state.attackTime-dt);state.attackBuffer=Math.max(0,buffered-dt);
  if(buffered>0&&state.cooldown===0&&buffered+1e-7>=Math.min(dt,previousCooldown))attack();
  state.invincible=Math.max(0,state.invincible-dt);state.trauma=Math.max(0,state.trauma-dt*1.8);state.comboTimer-=dt;state.slide=Math.max(0,state.slide-dt);state.flip=Math.max(0,state.flip-dt);state.magnet=Math.max(0,state.magnet-dt);state.jumpBuffer=Math.max(0,state.jumpBuffer-dt);state.slideQueued=Math.max(0,state.slideQueued-dt);
  if(state.comboTimer<=0&&state.combo>0){state.combo=0;state.multiplier=1;}
  updateBoostState(dt);if(state.boostActive){learnAction('boost');if(state.metrics)state.metrics.boostSeconds+=dt;}const charging=state.chargeActive;state.baseSpeed=15+Math.min(8,state.world*.6+Math.pow(clamp(state.worldDistance/WORLD_LENGTH,0,1),.9)*7.5);const speedFactor=charging?CHARGE_SPEED_MULTIPLIER:1+(BOOST_MULTIPLIER-1)*state.boostStrength;state.speed=state.baseSpeed*speedFactor;const scroll=state.boss?.phase==='dead'?0:state.boss?8*speedFactor:state.speed;state.courseTravel+=scroll*dt;world.update(dt,scroll,state.elapsed);terrainUpdate(dt,scroll);
  const previousX=state.x,previousY=state.y,oldFloor=state.groundHeight;state.x=lerp(state.x,state.lane*2.8,1-Math.exp(-16*dt));const floor=surfaceHeight(state.x);state.groundHeight=floor??0;
  const followSlope=state.grounded&&state.vy<=0&&floor!==null&&Math.abs(state.y-floor)<.25;
  if(charging){state.y=state.chargeY;state.vy=0;state.grounded=false;state.coyote=0;state.falling=false;}else{
  state.vy-=25*dt;state.y+=state.vy*dt;state.grounded=false;
  if(floor!==null&&((state.vy<=0&&previousY>=floor-.08&&state.y<=floor)||(followSlope&&state.jumps===0))){state.y=floor;state.vy=0;state.grounded=true;state.chargeUsed=false;state.coyote=.1;if(state.slideQueued>0){state.slide=.72;state.slideQueued=0;}if(state.jumps>0){state.jumps=0;state.flip=0;burst(state.x,state.y+.04,4,0x879b9f,7,.4);}if(state.jumpBuffer>0)jump();}else{state.coyote=Math.max(0,state.coyote-dt);}
  if(state.y<-3){rescueFromFall();if(state.mode!=='playing')return;}
  }
  ichi.position.set(state.x,state.y,4);heroLight.position.set(state.x+1,state.y+2.8,6);actors.animateIchi(ichi,{elapsed:state.elapsed,speed:state.boss?.phase==='dead'?0:state.speed,jump:state.grounded?0:Math.max(.2,state.y-state.groundHeight),attack:state.attackTime/SWORD_SWING,lean:(state.x-previousX)/Math.max(dt,.001)*.035,invincible:state.invincible>0,flip:state.flip>0?1-state.flip/.62:0,slide:state.slide>0?1:0,boost:state.boostStrength});ichi.visible=!charging;heroLight.color.setHex(charging?0xb9a1ff:0x8ad8e6);shadow.visible=!charging&&floor!==null;shadow.position.set(state.x,(floor||0)+.025,4);shadow.scale.setScalar(clamp(1-Math.max(0,state.y-state.groundHeight)*.08,.5,1));shieldMesh.visible=state.shield&&!charging;shieldMesh.position.set(state.x,state.y+1.1,4);shieldMesh.rotation.y=state.elapsed*.4;
  if(!state.boss&&state.transitionTime<=0){state.distance+=state.speed*dt*.55;state.worldDistance+=state.speed*dt*.55;state.score+=dt*.6;state.spawnTimer-=scroll*dt;if(state.spawnTimer<=0)spawnRow();if(state.worldDistance>=WORLD_LENGTH)spawnBoss();}if(state.boss)updateBoss(dt);
  for(let i=hazards.length-1;i>=0;i--){const h=hazards[i];h.life-=dt;h.mesh.visible=h.life<=h.warningDuration;h.mesh.material.opacity=.16+Math.sin(state.elapsed*12)*.045+(1-clamp(h.life/h.warningDuration,0,1))*.12;if(h.life<=0){spawnBossProjectile(h);scene.remove(h.mesh);h.mesh.geometry.dispose();h.mesh.material.dispose();hazards.splice(i,1);if(!hazards.length&&!state.boss)$('bossWarning').style.display='none';}}
  for(const e of entities){
    if(e.dead)continue;const prev=e.z;e.z+=(e.kind==='projectile'?(e.projectileSpeed||24):scroll)*dt;e.object.position.z=e.z;
    const collectible=['coin','magnet','shieldPickup'].includes(e.kind);
    if(collectible){e.object.rotation.y+=dt*2.3;e.object.position.y=e.y+Math.sin(state.elapsed*3+e.phase)*.1;const magnet=e.kind==='coin'&&state.magnet>0&&Math.abs(e.z-4)<11;if(magnet){e.object.position.x=lerp(e.object.position.x,state.x,1-Math.exp(-7*dt));e.object.position.y=lerp(e.object.position.y,state.y+1,1-Math.exp(-7*dt));}if(Math.abs(e.z-4)<1.3&&Math.abs(e.object.position.x-state.x)<(magnet?3.2:1)&&Math.abs(e.object.position.y-state.y-1)<1.3){e.dead=true;if(e.kind==='coin'){addCoins(1);state.score+=5;sound('collectBonus');}else if(e.kind==='magnet'){state.magnet=9;notify('Soul Magnet','Attracts coins · 9 seconds',1.8);}else{state.shield=true;notify('Ward','Blocks one collision',1.8);}updateHUD();}}
    else{
      if(e.kind==='demon')actors.animateDemon(e.object,state.elapsed+e.phase,false);else course.animateObstacle?.(e.object,e.kind,state.elapsed+e.phase);
      const shadowActive=!state.lowQuality&&e.z>-18&&e.z<12;if(e.object.userData.shadowActive!==shadowActive){e.object.userData.shadowActive=shadowActive;e.object.traverse(n=>{if(n.isMesh)n.castShadow=shadowActive&&!n.userData.rockDamageOverlay;});}
      const data=e.object.userData,halfDepth=data.halfDepth||.9,dx=Math.abs(e.object.position.x+(data.contactOffsetX||0)-state.x),aligned=e.slam||e.sweep||dx<(data.halfWidth||1.05),crosses=prev<4+halfDepth&&e.z>4-halfDepth;
      const height=e.slam?.8:e.kind==='projectile'?1.6:e.kind==='demon'?1.9:data.height||1.1;
      const bodyHeight=state.slide>0?.85:2;const contact=e.sweep?(Math.min(previousY,state.y)<2.05&&Math.max(previousY,state.y)+bodyHeight>1.12):data.moving?(Math.min(previousY,state.y)<e.object.position.y+height&&Math.max(previousY,state.y)+bodyHeight>e.object.position.y+(data.contactY||0)):data.overhead?(state.y<(data.beamTop||2.12)&&state.y+(state.slide>0?.85:2)>(data.beamBottom||1.55)):Math.min(previousY,state.y)<height;
      if(charging&&crosses&&aligned)e.checked=true;
       if(!charging&&crosses&&aligned&&contact){e.dead=true;damage(e.attackType||e.kind);if(state.mode!=='playing')return;}
      if(!e.checked&&prev<5.6&&e.z>=5.6){e.checked=true;if(!charging&&state.invincible<=0&&state.elapsed-state.lastDamage>1&&(dx>1.05&&dx<1.65||dx<1&&(state.y>height&&state.y<height+.55))){state.nearMisses++;state.score+=25;addCoins(2);floating('NEAR MISS +25 · +2 ◉',state.x,state.y+2,4,'#b8d9c8');tone(730,.08);}}
    }if(e.z>22)e.dead=true;
  }
  for(const w of waves){w.previousZ=w.z;w.z-=56*dt;w.travel+=56*dt;w.object.position.z=w.z;waveArt.update(w.object,state.elapsed,w.travel);for(const e of entities){if(e.dead||(!e.object.userData.breakable&&e.kind!=='demon'&&!(e.kind==='rock'&&w.element==='water'))||w.hits.has(e))continue;const targetHalfWidth=e.kind==='rock'&&w.element==='water'?(e.object.userData.halfWidth||.6):.6;if(w.z<=e.z+1&&w.previousZ>=e.z-1&&Math.abs(w.object.position.x-e.object.position.x)<w.width+targetHalfWidth){w.hits.add(e);e.hp--;if(e.kind==='rock'){course.setRockDamage?.(e.object,2-e.hp);if(e.hp>0)floating('ONE MORE HIT',e.object.position.x,2.7,e.z,'#85dfff');}burst(e.object.position.x,1.3,e.z,waveArt.colors[w.element||'plain'],6);if(e.hp<=0)rewardKill(e);}}const b=state.boss;if(b?.phase==='fight'&&w.z<=b.object.position.z+1.5&&w.previousZ>=b.object.position.z-1.5&&Math.abs(w.object.position.x-b.object.position.x)<w.width+1.9&&!w.hits.has(b)){w.hits.add(b);bossHit(w);}}
  for(let i=entities.length-1;i>=0;i--)if(entities[i].dead){removeEntity(entities[i]);entities.splice(i,1);}for(let i=waves.length-1;i>=0;i--)if(waves[i].travel>waveRange()){missedWave(waves[i]);waveArt.dispose(waves[i].object);scene.remove(waves[i].object);waves.splice(i,1);}
  revealCourse();finishers.update(dt,scroll);chargeArt.update(dt,{active:charging,x:state.x,y:state.y,z:4,speed:scroll,elapsed:state.elapsed,reducedMotion:state.reducedMotion});boostArt.update(dt,{active:state.boostActive,strength:state.boostStrength,element:state.element||'plain',x:state.x,y:state.y,z:4,speed:scroll,elapsed:state.elapsed,reducedMotion:state.reducedMotion});
  if(state.transitionTime>0){state.transitionTime-=dt;if(state.transitionTime<.6)$('transitionFade').style.opacity='1';if(state.transitionTime<=0)nextWorld();}
  state.tutorialTime+=dt;updateTutorial();if(Math.floor(state.elapsed*8)!==Math.floor((state.elapsed-dt)*8))updateHUD();
}
function updateParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.vy-=12*dt;p.object.position.x+=p.vx*dt;p.object.position.y+=p.vy*dt;p.object.position.z+=p.vz*dt;p.object.material.opacity=Math.min(1,p.life*2);if(p.life<=0){p.object.visible=false;particlePool.push(p.object);particles.splice(i,1);}}}
function resize(){state.needsRender=true;renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.fov=camera.aspect<.8?65:56;camera.updateProjectionMatrix();}window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);resize();
frameTelemetry=createFrameTelemetry();
const frameStats={frames:0,time:0,fps:0};let last=0,realElapsed=0,lastRenderedMode=null;
renderer.setAnimationLoop(ms=>{const wall=last?Math.max(0,(ms-last)/1000):1/60,raw=Math.min(wall,.1);if(contextRecovery?.lost){last=ms;return;}if(state.mode==='playing')frameTelemetry.sample(ms,renderer.info);last=ms;realElapsed+=raw;let dt=raw;frameStats.frames++;frameStats.time+=wall;if(frameStats.time>=1){frameStats.fps=Math.round(frameStats.frames/frameStats.time);$('gameCanvas').dataset.fps=String(frameStats.fps);const report=frameTelemetry.summary();if(PREVIEW){$('gameCanvas').dataset.p95=report.p95.toFixed(2);$('gameCanvas').dataset.p99=report.p99.toFixed(2);$('gameCanvas').dataset.geometries=String(report.geometries);$('gameCanvas').dataset.textures=String(report.textures);$('gameCanvas').dataset.stalls=String(report.stalls);}if(state.mode==='playing'&&!state.lowQuality){quality.slow=frameStats.fps<44?quality.slow+1:0;quality.fast=frameStats.fps>57?quality.fast+1:0;if(quality.slow>=2&&quality.ratio>quality.minRatio){quality.ratio=Math.max(quality.minRatio,quality.ratio-.18);renderer.setPixelRatio(quality.ratio);quality.slow=0;quality.fast=0;}else if(quality.fast>=10&&quality.ratio<Math.min(devicePixelRatio,1.5)){quality.ratio=Math.min(Math.min(devicePixelRatio,1.5),quality.ratio+.05);renderer.setPixelRatio(quality.ratio);quality.fast=0;}}$('gameCanvas').dataset.renderScale=String(quality.ratio);frameStats.frames=0;frameStats.time=0;}if(state.mode==='playing'){if(state.hitStop>0){state.hitStop-=dt;dt*=.12;}let remaining=dt;while(remaining>1e-7&&state.mode==='playing'){const step=Math.min(remaining,1/60);simulate(step);updateParticles(step);remaining-=step;}if(state.noticeTime>0){state.noticeTime-=dt;if(state.noticeTime<=0)$('notification').style.opacity='0';}}else if(state.mode==='menu'){world.update(dt,2,realElapsed);ichi.position.set(0,0,4);actors.animateIchi(ichi,{elapsed:realElapsed,speed:.1,jump:0,attack:0,lean:0,invincible:false,flip:0,slide:0});}const portrait=camera.aspect<.8,menu=state.mode==='menu',deathFocus=state.boss?.phase==='dead'&&!state.reducedMotion?Math.sin(clamp(bossFx.deathAge/1.2,0,1)*Math.PI/2):0;const targetFov=(portrait?65:56)+(state.reducedMotion?0:state.boostStrength*7+(state.chargeActive?5:0))-deathFocus*9;if(Math.abs(camera.fov-targetFov)>.01){camera.fov=lerp(camera.fov,targetFov,1-Math.exp(-6*raw));camera.updateProjectionMatrix();}const camZ=(portrait?18.8:13.4)*(1-deathFocus),camY=(portrait?4.3:3.5)+deathFocus*5.5,shake=state.reducedMotion?0:state.trauma*state.trauma;camera.position.set((menu?state.x*.24:state.x)+Math.sin(realElapsed*18)*shake*.35,camY+Math.max(0,state.y)*.12+Math.sin(realElapsed*13)*shake*.25,camZ);camera.lookAt(menu?(portrait?0:-3.5):state.x,(portrait?2.1:2.05)+deathFocus*1.6,-21-deathFocus*3);if(state.mode==='playing')$('cooldownFill').style.width=clamp(1-state.cooldown/cooldownMax(),0,1)*100+'%';if(state.mode==='playing'||state.mode==='menu'||lastRenderedMode!==state.mode||state.needsRender){renderer.render(scene,camera);lastRenderedMode=state.mode;state.needsRender=false;}$('gameCanvas').dataset.drawCalls=String(renderer.info.render.calls);$('gameCanvas').dataset.triangles=String(renderer.info.render.triangles||0);});
window.ichiGame={getState:()=>({mode:state.mode,world:state.world,distance:state.distance,hp:state.hp,coins:state.coins,element:state.element,upgrades:{...state.upgrades},seed:state.runSeed,fps:frameStats.fps,drawCalls:renderer.info.render.calls}),getMetrics:()=>state.metrics?JSON.parse(JSON.stringify(state.metrics)):null,repeatTutorial,getPerformance:()=>frameTelemetry.summary(),exportPerformance:()=>frameTelemetry.exportJSON(),settings:settingsUI,session:profileSession,version:'3d-3.6-polish'};
runtimeInitialised=true;profileSession.acquire();$('menuRecord').textContent=state.best.toLocaleString('en-US');setMode('menu');updateHUD();window.ichiReady=true;$('loadingScreen').style.opacity='0';setTimeout(()=>$('loadingScreen').remove(),550);

if(PREVIEW&&!ARENA){const badge=document.createElement('div');badge.className='review-badge';badge.textContent='COURSE REVIEW · PROFILE UNCHANGED';document.body.appendChild(badge);}
if(ARENA){
  document.body.classList.add('combat-preview');
  const bar=document.createElement('nav');bar.className='arena-controls';bar.setAttribute('aria-label','Local combat review');
  bar.innerHTML='<span>COMBAT REVIEW · PROFILE UNCHANGED</span><button id="arenaReset">Restart fight</button><button id="arenaFinish">Final hit</button><button id="arenaWave">Wave J</button><button id="arenaRock">Rock</button><button id="arenaWideRock">Rock ×3</button><button id="arenaDemons">3 demons</button><select id="arenaElement" aria-label="School to preview"><option value="plain">No school</option>'+ELEMENTS.map(e=>'<option value="'+e.id+'">'+e.name+'</option>').join('')+'</select><select id="arenaWorld" aria-label="World to preview"><option value="0">Shrine</option><option value="1">Bamboo</option><option value="2">Citadel</option></select><select id="arenaPattern" aria-label="Attack to preview"><option value="">Cycle attacks</option><option value="seals">Twin Seals</option><option value="sweep">Moon Slash</option><option value="quake">Ground Rupture</option><option value="dash">Dash</option><option value="storm">Storm</option></select><label><input type="checkbox" id="arenaProtect">Invincibility (test)</label><button id="arenaLoseContext">Lose graphics context</button><button id="arenaRestoreContext">Restore graphics context</button>';
  document.body.appendChild(bar);
  function restartArena(){startGame();state.world=clamp(Math.floor(Number($('arenaWorld').value)||0),0,2);world.setTheme(state.world);key.color.setHex(state.world===2?0xe6b1a2:0xa9c9f5);rim.color.setHex(state.world===1?0x6bbdad:0xe2b493);state.coins=0;state.previewProtect=$('arenaProtect').checked;setSchool($('arenaElement').value==='plain'?null:$('arenaElement').value);state.worldDistance=WORLD_LENGTH;spawnBoss();}
  $('arenaReset').addEventListener('click',restartArena);
  $('arenaFinish').addEventListener('click',()=>{if(state.mode!=='playing')setMode('playing');if(!state.boss||state.boss.phase==='dead')restartArena();state.boss.phase='fight';state.boss.hp=5;enterBossStance('exposed',3);updateBoss(0);bossHit({damage:5});});
  $('arenaWave').addEventListener('click',()=>{if(state.mode==='paused')setMode('playing');attack();});
  $('arenaElement').addEventListener('change',e=>{setSchool(e.target.value==='plain'?null:e.target.value);});
  $('arenaWorld').addEventListener('change',restartArena);
  $('arenaRock').addEventListener('click',()=>{spawn('rock',0,-23);});
  $('arenaWideRock').addEventListener('click',()=>{spawn('rock',0,-23,undefined,{span:3});});
  $('arenaLoseContext').addEventListener('click',()=>renderer.forceContextLoss?.());
  $('arenaRestoreContext').addEventListener('click',()=>renderer.forceContextRestore?.());
  $('arenaDemons').addEventListener('click',()=>{if(state.element==='darkness')state.hp=Math.min(state.hp,2);for(let i=0;i<3;i++)spawn('demon',0,-9-i*6);updateHUD();});
  $('arenaProtect').addEventListener('change',e=>{state.previewProtect=e.target.checked;updateHUD();});
  $('arenaPattern').addEventListener('change',e=>{const id=e.target.value;if(!id)return;if(!state.boss||state.boss.phase==='dead')restartArena();for(const h of hazards){scene.remove(h.mesh);h.mesh.geometry.dispose();h.mesh.material.dispose();}hazards.length=0;for(const entity of entities)entity.dead=true;const b=state.boss;b.phase='fight';b.hp=id==='storm'?25:50;b.turn=id==='storm'?0:['seals','sweep','quake','dash'].indexOf(id);beginBossPattern();});
  const requestedSchool=new URLSearchParams(window.location.search).get('school');if(isSchool(requestedSchool))$('arenaElement').value=requestedSchool;
  restartArena();
}
