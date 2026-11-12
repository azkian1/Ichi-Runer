// Authored boss vocabulary. A plan locks its targets once, before its warnings.
// Gameplay owns time, projectiles, collisions, damage and the death sequence.
export const BOSS_DEATH_DURATION=5.4;
const LANES=[-1,0,1];
const ORDERS=[['seals','sweep','quake','dash'],['quake','seals','dash','sweep'],['dash','quake','sweep','seals']];
export function createBossPattern(world=0,turn=0,healthRatio=1,playerLane=0){
  world=Math.max(0,Math.floor(world));turn=Math.max(0,Math.floor(turn));playerLane=Math.max(-1,Math.min(1,Math.round(playerLane)));
  const enraged=healthRatio<=.5;
  const order=enraged?['storm','dash','sweep','quake','seals']:ORDERS[world%3];
  const id=order[turn%order.length];
  let safeLane=LANES[(turn+world+1)%3];if(safeLane===playerLane)safeLane=LANES[(LANES.indexOf(safeLane)+1)%3];
  const blocked=LANES.filter(lane=>lane!==safeLane);
  const style=world%3;
  const shared={id,enraged,targetLane:playerLane,safeLane,worldStyle:['shrine','bamboo','citadel'][style],exposed:enraged?2.9:2.6,recovery:style===1?.82:.7};
  if(id==='seals')return{...shared,name:style===1?'Echoing Cursed Seals':'Twin Cursed Seals',windup:style===1?1.3:1.2,attackDuration:style===1?2.95:1.55,prepare:style===1?'SEALS · FIRST → ECHO':'SEALS · LEAVE THE RED ZONE',urgent:'← FIND THE SAFE LANE →',events:style===1?[{delay:0,kind:'bolt',lanes:blocked},{delay:1.5,kind:'bolt',lanes:[safeLane]}]:[{delay:0,kind:'bolt',lanes:blocked}]};
  if(id==='sweep')return{...shared,name:'Moon Slash',windup:1.25,attackDuration:1.5,prepare:'HIGH SLASH · GET READY TO SLIDE',urgent:'↓ SLIDE UNDER THE ARC',events:[{delay:0,kind:'sweep',lanes:[0]}]};
  if(id==='quake')return{...shared,name:style===2?'Rupture and Ash Seal':'Shrine Rupture',windup:1.3,attackDuration:style===2?2.85:1.45,prepare:style===2?'JUMP → LEAVE THE SEAL':'GROUND SLAM · WATCH THE WAVE',urgent:'↑ JUMP OVER THE WAVE',events:style===2?[{delay:0,kind:'slam',lanes:[0]},{delay:1.4,kind:'bolt',lanes:[playerLane]}]:[{delay:0,kind:'slam',lanes:[0]}]};
  if(id==='dash')return{...shared,name:'Phantom Dash',windup:1.05,attackDuration:1.3,prepare:'DASH · LEAVE THE MARKED LANE',urgent:'← DODGE →',events:[{delay:0,kind:'dash',lanes:[playerLane]}]};
  // The enraged combo alternates lane pressure, then asks for a jump. Its last
  // wave clears before the long counterattack window. No jump→slide overlap.
  return{...shared,name:'Storm of Three Seals',windup:1.25,attackDuration:style===1?3.85:3.65,prepare:'STORM · WATCH THE SEALS',urgent:'SEALS → CHANGE LANES → JUMP',events:[
    {delay:0,kind:'bolt',lanes:[-1,1]},
    {delay:style===1?.82:.72,kind:'bolt',lanes:[0]},
    {delay:style===1?2.15:1.95,kind:'slam',lanes:[0]},
  ]};
}
