const limit=(n,a,b)=>Math.max(a,Math.min(b,n));
export const AUDIO_CUES=Object.freeze({
  guard:[{f:180,end:140,t:0,d:.10,type:'triangle',gain:.045},{f:140,end:110,t:.12,d:.10,type:'triangle',gain:.035}],
  exposed:[{f:660,t:0,d:.09,type:'sine',gain:.06},{f:880,t:.09,d:.09,type:'sine',gain:.06},{f:1100,t:.18,d:.16,type:'sine',gain:.055}],
  seals:[{f:420,t:0,d:.075,type:'triangle',gain:.055},{f:620,t:.12,d:.075,type:'triangle',gain:.055}],
  sweep:[{f:1100,end:380,t:0,d:.25,type:'triangle',gain:.06}],
  slam:[{f:100,end:42,t:0,d:.27,type:'sine',gain:.085},{f:150,end:70,t:.13,d:.18,type:'triangle',gain:.04}],
  dash:[{f:240,end:920,t:0,d:.18,type:'sawtooth',gain:.025},{f:920,end:500,t:.18,d:.12,type:'sine',gain:.045}],
  storm:[{f:420,t:0,d:.07,type:'triangle',gain:.045},{f:620,t:.10,d:.07,type:'triangle',gain:.045},{f:100,end:42,t:.22,d:.24,type:'sine',gain:.065}],
  boss:[{f:98,end:73.42,t:0,d:.4,type:'triangle',gain:.045},{f:146.83,t:.2,d:.5,type:'sine',gain:.035}],
  world:[{f:293.66,t:0,d:.18,type:'sine',gain:.03},{f:440,t:.16,d:.25,type:'sine',gain:.03}],
});
const cueAliases={lanes:'seals',lane:'seals',quake:'slam',highArc:'sweep',rush:'dash'};
export function cueScore(name){return AUDIO_CUES[cueAliases[name]||name]||[];}
export function createSoundPolicy({random=Math.random,now=()=>performance.now()/1000,maxVoices=12}={}){
  const last=new Map();let live=[];
  return {get liveVoices(){return live.length;},accept(name){const time=now(),spacing=name==='collectBonus'?.075:name==='swordSwing'?.065:.025;if(time-(last.get(name)??-Infinity)<spacing)return null;last.set(name,time);return {rate:.95+random()*.10,gain:.90+random()*.14};},track(source){live.push(source);if(live.length>maxVoices){const old=live.shift();try{old.stop();}catch{}}source.onended=()=>{live=live.filter(item=>item!==source);try{source.disconnect();}catch{}};},clear(){for(const source of [...live])try{source.stop();source.disconnect();}catch{}live=[];}};
}

/** Mix around the existing local-buffer manager. All tones use its muted Master. */
export function createAudioPolish(manager,{getSettings=()=>({musicVolume:.8,effectsVolume:.8}),random=Math.random,now=()=>performance.now()/1000}={}){
  const policy=createSoundPolicy({random,now});let graph=null,lastContext=null,lastCue=new Map();
  const originalPlay=manager.play.bind(manager),originalInit=manager.init.bind(manager);
  function graphForContext(){
    const c=manager.context;if(!c||!manager.musicGain||!manager.effectsGain||!manager.masterGain)return null;
    if(graph?.context===c)return graph;
    const musicUser=c.createGain(),musicDuck=c.createGain(),effectsUser=c.createGain(),ambience=c.createGain();
    manager.musicGain.disconnect();manager.musicGain.connect(musicDuck);musicDuck.connect(musicUser);musicUser.connect(manager.masterGain);
    manager.effectsGain.disconnect();manager.effectsGain.connect(effectsUser);effectsUser.connect(manager.masterGain);ambience.connect(effectsUser);
    let limiter=null;if(c.createDynamicsCompressor){limiter=c.createDynamicsCompressor();limiter.threshold.value=-5;limiter.knee.value=4;limiter.ratio.value=12;limiter.attack.value=.003;limiter.release.value=.18;manager.masterGain.disconnect();manager.masterGain.connect(limiter);limiter.connect(c.destination);}
    graph={context:c,musicUser,musicDuck,effectsUser,ambience,limiter,noise:null,drone:null,filter:null};setMix(getSettings());if(lastContext)setContext(lastContext);return graph;
  }
  function setMix(settings=getSettings()){
    if(!graph)return;const t=graph.context.currentTime;
    // Squared controls leave useful travel at low perceived volumes; exact zero is mute.
    graph.musicUser.gain.setTargetAtTime(limit(settings.musicVolume??.8,0,1)**2,t,.03);
    graph.effectsUser.gain.setTargetAtTime(limit(settings.effectsVolume??.8,0,1)**2,t,.03);
  }
  manager.init=async function(...args){const result=await originalInit(...args);graphForContext();return result;};
  manager.play=function(name,loop=false){
    if(manager.buffers[name]?.isMusic){graphForContext();return originalPlay(name,loop);}
    if(manager.isMuted||!manager.context||!manager.buffers[name])return null;
    const mix=graphForContext(),variation=policy.accept(name);if(!mix||!variation)return null;
    const c=manager.context,source=c.createBufferSource(),gain=c.createGain();source.buffer=manager.buffers[name].buffer;source.loop=false;source.playbackRate.value=variation.rate;gain.gain.value=variation.gain;source.connect(gain);gain.connect(manager.effectsGain);policy.track(source);
    const ended=source.onended;source.onended=()=>{ended();gain.disconnect();};source.start(0);return source;
  };
  function cue(name){
    if(manager.isMuted||!manager.context||!manager.isUnlocked)return false;const score=cueScore(name);if(!score.length)return false;
    const time=now();if(time-(lastCue.get(name)??-Infinity)<.12)return false;lastCue.set(name,time);const g=graphForContext(),c=manager.context;
    for(const note of score){const o=c.createOscillator(),env=c.createGain(),t=c.currentTime+note.t;o.type=note.type;o.frequency.setValueAtTime(note.f,t);if(note.end)o.frequency.exponentialRampToValueAtTime(note.end,t+note.d);env.gain.setValueAtTime(.0001,t);env.gain.exponentialRampToValueAtTime(note.gain,t+.012);env.gain.exponentialRampToValueAtTime(.0001,t+note.d);o.connect(env);env.connect(manager.effectsGain);policy.track(o);const ended=o.onended;o.onended=()=>{ended();env.disconnect();};o.start(t);o.stop(t+note.d+.02);}
    // Duck on a dedicated bus; it never overwrites the player's music setting.
    const t=c.currentTime;g.musicDuck.gain.cancelScheduledValues(t);g.musicDuck.gain.setTargetAtTime(name==='exposed'?.55:.75,t,.025);g.musicDuck.gain.setTargetAtTime(1,t+.4,.20);return true;
  }
  function startAmbience(g){
    if(g.noise)return;const c=g.context,size=Math.floor(c.sampleRate*2),buffer=c.createBuffer(1,size,c.sampleRate),data=buffer.getChannelData(0);let seed=211;for(let i=0;i<size;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=(seed/4294967296*2-1)*.5;}
    const noise=c.createBufferSource(),filter=c.createBiquadFilter(),noiseGain=c.createGain(),drone=c.createOscillator(),droneGain=c.createGain();noise.buffer=buffer;noise.loop=true;filter.type='lowpass';filter.Q.value=.6;noiseGain.gain.value=.022;noise.connect(filter);filter.connect(noiseGain);noiseGain.connect(g.ambience);drone.type='sine';droneGain.gain.value=.012;drone.connect(droneGain);droneGain.connect(g.ambience);noise.start();drone.start();Object.assign(g,{noise,filter,drone,noiseGain,droneGain});
  }
  function setContext(context={}){
    const previous=lastContext;lastContext={...context};const g=graphForContext();if(!g)return;startAmbience(g);const c=g.context,t=c.currentTime,world=((context.world||0)%3+3)%3,playing=context.mode==='playing';
    g.filter.frequency.setTargetAtTime([750,1300,260][world]*(context.boss?.7:1),t,.7);g.drone.frequency.setTargetAtTime([55,73.42,46.25][world],t,.7);g.ambience.gain.setTargetAtTime(playing?(context.boss?1.35:1):.18,t,.3);
    if(previous&&!previous.boss&&context.boss)cue('boss');else if(previous&&previous.world!==context.world)cue('world');
  }
  function dispose(){policy.clear();if(graph)for(const name of ['noise','drone'])try{graph[name]?.stop();graph[name]?.disconnect();}catch{}manager.play=originalPlay;manager.init=originalInit;}
  return {setMix,cue,setContext,dispose,get activeVoices(){return policy.liveVoices;},get ready(){return Boolean(graph);}};
}
