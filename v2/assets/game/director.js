// Authored action phrases for the runner. Distances use world units, not HUD metres.
// Keep this module pure: gameplay owns spawning, collision, input and persistence.
export const RUN_BOSS_DISTANCE = 780;
export const BOOST_MULTIPLIER = 1.4;

const LANES = [-1, 0, 1];
const STAGES = [
  { at: 0, name: 'First Beat', beat: 1.35 },
  { at: 175, name: 'Cross Rhythm', beat: 1.1 },
  { at: 360, name: 'Blade Dance', beat: .95 },
  { at: 610, name: 'Storm of Blades', beat: .84 },
];

export function getRunStage(distance = 0) {
  const d = Math.max(0, Number(distance) || 0);
  let index = 0;
  for (let i = 1; i < STAGES.length; i++) if (d >= STAGES[i].at) index = i;
  return index;
}

const gate = (kind, action, cue) => ({
  action, cue, safeLane: null, coinLane: 0,
  obstacles: LANES.map(lane => ({ kind, lane })),
});
const move = (lane, kind = 'rock') => ({
  action: 'lane', safeLane: lane, coinLane: lane,
  cue: lane < 0 ? 'LEFT' : lane > 0 ? 'RIGHT' : 'CENTRE',
  obstacles: LANES.filter(value => value !== lane).map(value => ({ kind, lane: value })),
});
const jump = () => gate('spikes', 'jump', 'JUMP');
const slide = () => gate('arch', 'slide', 'SLIDE');
const target = (lane, action = 'attack') => ({
  action, safeLane: lane, coinLane: lane,
  cue: action === 'attack' ? 'SWORD WAVE' : action === 'jump' ? 'CHANGE LANES · JUMP' : 'CHANGE LANES · SLIDE',
  obstacles: LANES.map(value => ({
    lane: value,
    kind: value !== lane ? 'crystal' : action === 'attack' ? 'demon' : action === 'jump' ? 'spikes' : 'arch',
  })),
});

// Every phrase has an intended path and an input vocabulary. Alternate lanes or a
// well-timed double jump can offer a harder solution; waiting on one lane cannot.
const PHRASES = [
  { id: 'compass', min: 0, name: 'Three Directions', rows: [move(-1), move(0), move(1), move(0)] },
  { id: 'first-jumps', min: 0, name: 'Over the Spikes', rows: [jump(), move(1), jump(), move(-1)] },
  { id: 'first-slides', min: 0, name: 'Under the Arches', rows: [slide(), move(-1), slide(), move(1)] },
  { id: 'first-cut', min: 0, name: 'First Cut', rows: [target(0), move(1), target(-1), move(0)] },
  { id: 'switchback', min: 1, name: 'Serpent Path', rows: [move(-1, 'pendulum'), move(1), move(0, 'sawGate'), move(-1), move(0), move(1, 'pendulum')] },
  { id: 'crosscut', min: 1, name: 'Crosscut', rows: [target(-1), move(1), jump(), slide(), move(0), target(1)] },
  { id: 'counterpoint', min: 1, name: 'Counterpoint', rows: [move(-1), target(1, 'jump'), move(0), target(-1, 'slide'), target(0), move(1)] },
  { id: 'moon-weave', min: 1, name: 'Moon Weave', rows: [move(1), slide(), move(-1), target(0), jump(), move(1)] },
  { id: 'jump-slide-canon', min: 2, name: 'Jump · Slide', rows: [jump(), slide(), jump(), move(1), target(-1, 'slide'), target(0)] },
  { id: 'storm-gates', min: 2, name: 'Eight Gates', rows: [move(1, 'sawGate'), target(-1, 'slide'), target(1), target(-1, 'jump'), move(0, 'pendulum'), target(0, 'slide'), target(1, 'jump'), target(-1)] },
  { id: 'percussion', min: 2, name: 'Percussion', rows: [target(0), target(-1, 'jump'), slide(), target(1), move(-1), target(0, 'jump'), target(-1, 'slide')] },
  { id: 'bamboo-echo', min: 2, name: 'Bamboo Echo', rows: [target(-1), move(0), jump(), move(1), slide(), target(0)] },
  { id: 'final-cadence', min: 3, name: 'Final Beat', rows: [move(-1), target(1, 'jump'), target(0), target(-1, 'slide'), move(1), jump(), target(-1), slide(), target(1, 'jump'), move(0)] },
  { id: 'blade-fugue', min: 3, name: 'Blade Fugue', rows: [target(1), move(-1), slide(), target(0, 'jump'), target(1), target(-1, 'slide'), move(0), target(1, 'jump'), target(-1)] },
  { id: 'ash-procession', min: 3, name: 'Ash Procession', rows: [jump(), move(-1), target(0), slide(), move(1), target(-1, 'jump'), target(1), move(0)] },
  { id: 'last-seal', min: 3, name: 'Last Seal', rows: [move(1), target(-1), jump(), slide(), move(0), target(1, 'slide'), target(0, 'jump'), target(-1)] },
];
const WORLD_STYLES = [
  { id: 'shrine', beatScale: 1, terrain: ['rope', 'ridge', 'brokenRoad', 'stepping', 'chasm'], preferred: ['crosscut', 'percussion', 'final-cadence'] },
  { id: 'bamboo', beatScale: 1.06, terrain: ['rope', 'stepping', 'brokenRoad', 'ridge', 'chasm'], preferred: ['switchback', 'moon-weave', 'bamboo-echo', 'blade-fugue'] },
  { id: 'citadel', beatScale: .96, terrain: ['rope', 'chasm', 'brokenRoad', 'ridge', 'stepping'], preferred: ['counterpoint', 'storm-gates', 'last-seal', 'ash-procession'] },
];

function seedNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value >>> 0 || 1;
  let hash = 2166136261;
  for (const char of String(value ?? 1)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0 || 1;
}

function requiredGap(previous, current, beat) {
  // Current jump duration is approximately .84 s. Jump/slide reversals and two
  // successive take-offs retain time to land; lane changes are legal in mid-air.
  const a = previous?.action, b = current.action;
  if (a === 'jump' && (b === 'slide' || b === 'jump')) return Math.max(beat, 1.06 * BOOST_MULTIPLIER);
  if (a === 'slide' && b === 'jump') return Math.max(beat, BOOST_MULTIPLIER);
  if (a === 'attack' && b === 'attack') return Math.max(beat, .78 * BOOST_MULTIPLIER);
  return beat;
}

function materialize(phrase, stage, speed, mirror, sequence, style, intro = null) {
  const beatSeconds = STAGES[stage].beat * (intro ? 1 : style.beatScale);
  let time = 0;
  const rows = phrase.rows.map((source, index) => {
    if (index) time += requiredGap(phrase.rows[index - 1], source, beatSeconds);
    const safeLane = source.safeLane === null ? null : source.safeLane * mirror;
    const coinLane = source.coinLane * mirror;
    return {
      ahead: Number((time * speed).toFixed(4)),
      time: Number(time.toFixed(4)),
      obstacles: source.obstacles.map(obstacle => ({ kind: obstacle.kind, lane: obstacle.lane * mirror })),
      safeLane, coinLane,
      coins: source.action === 'lane' ? 3 : 2,
      coinHeight: source.action === 'jump' ? 1.8 : 1.05,
      action: source.action,
      cue: source.action === 'lane' ? safeLane < 0 ? 'LEFT' : safeLane > 0 ? 'RIGHT' : 'CENTRE' : source.cue,
    };
  });
  // This buffer is only between phrases, not between every action. The approach
  // to the next phrase stays visible without turning every row into a rest.
  // The boundary can join any two phrases. Keep enough time for an unplanned
  // jump→slide reversal here too, rather than validating only within phrases.
  const clearance = Math.max(12, speed * 1.08 * BOOST_MULTIPLIER);
  return {
    id: phrase.id, name: phrase.name, stage, stageName: STAGES[stage].name,
    beatSeconds, sequence, rows, rest: false, worldStyle: style.id, intro,
    advanceDistance: Number((rows.at(-1).ahead + clearance).toFixed(4)),
  };
}

function terrainSection(kind, distance, speed, stage, sequence, world) {
  const length = kind === 'brokenRoad' ? 36 : kind === 'ridge' ? 27 : kind === 'chasm' ? 15 : 18;
  const ropeLane = (sequence + world) % 3 - 1;
  const before = 20, after = 24;
  return {
    id: 'terrain-' + kind,
    name: { brokenRoad: 'Broken Road', rope: 'Rope over the Abyss', ridge: 'Stone Ridge', stepping: 'Islands in the Mist', chasm: 'Broken Path' }[kind],
    stage, stageName: STAGES[stage].name, beatSeconds: STAGES[stage].beat, sequence,
    rows: [], rest: false,
    terrain: { kind, length, ropeLane, ahead: before + length / 2, runwayBefore: before, runwayAfter: after },
    advanceDistance: before + length + after,
  };
}

export function createRunDirector() {
  let world = 0, sequence = 0, combatPhrases = 0, terrainIndex = 0, nextTerrainAt = 95;
  let introIndex = 0, runSeed = 1, rng = 1, history = [];
  function random() { rng ^= rng << 13; rng ^= rng >>> 17; rng ^= rng << 5; return (rng >>> 0) / 4294967296; }
  function reset(nextWorld = 0, seed = 1) {
    world = Math.max(0, Math.floor(Number(nextWorld) || 0));
    runSeed = seedNumber(seed); rng = (runSeed ^ Math.imul(world + 1, 0x9e3779b1)) >>> 0 || 1;
    sequence = 0; combatPhrases = 0; terrainIndex = 0; introIndex = world === 0 ? 0 : 4; history = [];
    nextTerrainAt = 95;
  }
  function next(distance = 0, currentSpeed = 15) {
    const d = Math.max(0, Number(distance) || 0);
    const speed = Math.max(12, Math.min(30, Number(currentSpeed) || 15));
    const stage = getRunStage(d), number = sequence++, style = WORLD_STYLES[world % 3];
    // Distance can cross a stage while an earlier phrase is still approaching.
    // Explicit teaching order therefore owns progression until all four inputs
    // have appeared; no terrain or mixed advanced phrase can skip that order.
    if (introIndex < 4) {
      const step = introIndex++, phrase = PHRASES[step];
      history.push(phrase.id); if (history.length > 3) history.shift(); combatPhrases++;
      return materialize(phrase, 0, speed, 1, number, style, { step: step + 1, total: 4, action: ['lane', 'jump', 'slide', 'attack'][step] });
    }
    // The final 110 HUD metres are reserved for readable last action phrases and
    // the boss approach. A terrain section must not be truncated by its entrance.
    // Long late phrases must not push the third, full road test past the boss
    // approach. Reserve it from 500 m once the two simpler crossings are taught.
    const roadDue = terrainIndex === 2 && d >= 500;
    if ((d >= nextTerrainAt || roadDue) && d < RUN_BOSS_DISTANCE - 135) {
      // Teach the safe rope first. The full broken road remains a later test.
      const kind = style.terrain[terrainIndex++ % style.terrain.length];
      nextTerrainAt = d + 140;
      return terrainSection(kind, d, speed, stage, number, world);
    }
    if (combatPhrases > 0 && combatPhrases % 5 === 0) {
      combatPhrases++;
      return {
        id: 'breathing-space', name: 'Catch your breath', stage, stageName: STAGES[stage].name,
        beatSeconds: STAGES[stage].beat, sequence: number, rest: true,
        rows: [{ ahead: 0, time: 0, obstacles: [], safeLane: 0, coinLane: 0, coins: 7, coinHeight: 1.05, action: 'rest', cue: '' }],
        advanceDistance: speed * (stage >= 2 ? 2.1 : 2.8),
      };
    }
    const available = PHRASES.filter(phrase => phrase.min === stage && !history.includes(phrase.id));
    // Four candidates per stage make a strict three-phrase history possible.
    // A world's preferences change order; geometry and required actions remain authored.
    const weighted = available.flatMap(phrase => style.preferred.includes(phrase.id) ? [phrase, phrase] : [phrase]);
    const phrase = weighted[Math.floor(random() * weighted.length)];
    history.push(phrase.id); if (history.length > 3) history.shift();
    combatPhrases++;
    return materialize(phrase, stage, speed, random() < .5 ? -1 : 1, number, style);
  }
  reset();
  return { reset, next, get introComplete() { return introIndex >= 4; }, get seed() { return runSeed; }, get recentPhrases() { return [...history]; } };
}
