// Permanent school rules. Gameplay captures a wave's school when it is fired.
export const CHARGE_MIN_ENERGY=20;
export const CHARGE_SPEED_MULTIPLIER=2.0;

const BASE=Object.freeze({bossDamage:5,rockHits:Infinity,energyMax:100,energyRegen:19,demonHealEvery:0,lightningCharge:false});
const RULES=Object.freeze({
  plain:BASE,
  fire:Object.freeze({...BASE,bossDamage:10}),
  water:Object.freeze({...BASE,rockHits:2}),
  wind:Object.freeze({...BASE,energyMax:150,energyRegen:38}),
  darkness:Object.freeze({...BASE,demonHealEvery:3}),
  lightning:Object.freeze({...BASE,lightningCharge:true}),
});

export function getElementRules(school){return Object.hasOwn(RULES,school)?RULES[school]:BASE;}
