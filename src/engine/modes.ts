// Mode + difficulty definitions for the skillcheck trainer.
// All angles are in radians, fractions are 0..1 of the full circle.
// Reference: DbD wiki — default good ~15% of dial (0.15), great ~3% (0.03),
// pointer starts at 12 o'clock and rotates clockwise. Zone spawn window
// is roughly from 4 o'clock to 11 o'clock (we expose this as spawnMin/Max
// in turns where 0=top, 0.25=3 o'clock, 0.5=6, 0.75=9).

export type Difficulty = 'easy' | 'normal' | 'hard' | 'nightmare';

export interface SkillCheckSpec {
  // Visual / mechanical
  goodFraction: number;        // size of the good (white) outer zone
  greatFraction: number;       // size of the great (red) zone at leading edge
  rotationSeconds: number;     // seconds for the needle to traverse a full circle
  spawnMin: number;            // earliest leading-edge position (turns, 0=top, clockwise)
  spawnMax: number;            // latest leading-edge position
  reverseChance: number;       // chance pointer rotates counter-clockwise
  offCenterChance: number;     // chance the dial is offset from screen center
  twoZones: boolean;           // wiggle-style: two opposed zones (3 and 9)
  silentChance: number;        // chance there is no warning gong (Lullaby)
  warningLeadMs: number;       // ms between gong and check appearing
  continuous: boolean;         // back-to-back checks (Merciless Storm)
  // --- Mode-specific visual / behavior flags ---
  forceCenter?: boolean;       // Hook struggle — always centered on screen
  horrorOnMiss?: boolean;      // Doctor / Snap — red horror flash on a failed check
  greatOnly?: boolean;         // DS — goods don't count, only great stuns
  showWiggleBar?: boolean;     // DS — render a wiggle meter that fills before the check
  fixedIntervalMs?: number;    // Hook — deterministic interval between checks
}

export interface ModeDef {
  id: string;
  name: string;
  short: string;
  description: string;
  // Triggering on the gameplay clock — chance per second to spawn a new check.
  triggerChancePerSec: number;
  // Endless = no fail cap; Marathon = run ends after target streak.
  endless?: boolean;
  marathonTarget?: number;
  // Allow a maximum number of failed checks before run ends. undefined = unlimited.
  failCap?: number;
  base: SkillCheckSpec;
}

// Per-difficulty scaling applied on top of mode's base spec.
const DIFFICULTY_SCALE: Record<Difficulty, (s: SkillCheckSpec) => SkillCheckSpec> = {
  easy:      (s) => ({ ...s, greatFraction: s.greatFraction * 1.6, goodFraction: s.goodFraction * 1.25, rotationSeconds: s.rotationSeconds * 1.25 }),
  normal:    (s) => ({ ...s }),
  hard:      (s) => ({ ...s, greatFraction: s.greatFraction * 0.7, goodFraction: s.goodFraction * 0.85, rotationSeconds: s.rotationSeconds * 0.85 }),
  nightmare: (s) => ({ ...s, greatFraction: s.greatFraction * 0.45, goodFraction: s.goodFraction * 0.7, rotationSeconds: s.rotationSeconds * 0.7, warningLeadMs: Math.max(50, s.warningLeadMs * 0.5) }),
};

export function applyDifficulty(mode: ModeDef, d: Difficulty): SkillCheckSpec {
  return DIFFICULTY_SCALE[d](mode.base);
}

const DEFAULT_BASE: SkillCheckSpec = {
  goodFraction: 0.13,   // generator standard (wiki: 13%)
  greatFraction: 0.03,
  rotationSeconds: 1.1,
  spawnMin: 0.33,   // 4 o'clock
  spawnMax: 0.92,   // 11 o'clock
  reverseChance: 0,
  offCenterChance: 0,
  twoZones: false,
  silentChance: 0,
  warningLeadMs: 220,
  continuous: false,
};

export const MODES: ModeDef[] = [
  {
    id: 'classic',
    name: 'Classic Repair',
    short: 'Standard generator skill checks. 8%/sec trigger.',
    description: 'Repairing a generator: 8% chance per second to spawn a check. Good zone 13%, great zone 3%, 1.1s rotation. Zone appears from 4 o\'clock onwards.',
    triggerChancePerSec: 0.08,
    base: { ...DEFAULT_BASE },
  },
  {
    id: 'healing',
    name: 'Healing',
    short: 'Altruistic healing. 15%/sec trigger, wider zones.',
    description: 'Altruistic healing checks: 15% chance per second. Good zone 15%, great zone 3%, 1.2s rotation. Zone appears from 4 o\'clock onwards.',
    triggerChancePerSec: 0.15,
    base: { ...DEFAULT_BASE, goodFraction: 0.15, greatFraction: 0.03, rotationSeconds: 1.2 },
  },
  {
    id: 'overcharge',
    name: 'Overcharge',
    short: 'Always triggers. 7% great zone, 1.2s rotation.',
    description: 'Overcharge (Tier I): always triggers on generators. Great zone 7%, good zone 12%, 1.2s rotation. Fail causes -13% regression.',
    triggerChancePerSec: 999,
    base: { ...DEFAULT_BASE, greatFraction: 0.07, goodFraction: 0.12, rotationSeconds: 1.2 },
  },
  {
    id: 'unnerving',
    name: 'Unnerving Presence',
    short: 'Killer is nearby. All zones shrink.',
    description: 'Shrinks both good and great zones uniformly, modeling the Unnerving Presence perk.',
    triggerChancePerSec: 0.55,
    base: { ...DEFAULT_BASE, goodFraction: 0.10, greatFraction: 0.022 },
  },
  {
    id: 'lullaby',
    name: 'Hex: Huntress Lullaby',
    short: 'No warning. No mercy.',
    description: 'No audio gong, near-instant appearance after trigger. Trains pure visual reaction.',
    triggerChancePerSec: 0.55,
    base: { ...DEFAULT_BASE, silentChance: 1, warningLeadMs: 0 },
  },
  {
    id: 'madness',
    name: 'Doctor Madness',
    short: '33% reverse, 33% off-center, horror flash on miss.',
    description: 'Madness skill checks. 33% chance to rotate counter-clockwise, 33% chance to spawn off-centre, 33% chance for both. Miss a check and the Doctor\'s horror flash takes over your screen.',
    triggerChancePerSec: 0.55,
    base: { ...DEFAULT_BASE, reverseChance: 0.33, offCenterChance: 0.33, horrorOnMiss: true },
  },
  {
    id: 'storm',
    name: 'Merciless Storm',
    short: 'Continuous, no warning. One miss ends the run.',
    description: 'Back-to-back checks with no gong between them. One miss locks the generator and ends the run.',
    triggerChancePerSec: 999, // ignored — continuous
    failCap: 1,
    base: { ...DEFAULT_BASE, continuous: true, warningLeadMs: 0, rotationSeconds: 1.0 },
  },
  {
    id: 'wiggle',
    name: 'Wiggle (Legacy)',
    short: 'Two opposed zones at 3 and 9 o\'clock. No warning gong.',
    description: 'The pre-rework wiggle skill check: two opposed success zones (3 and 9 o\'clock) appear silently while the killer carries you. Hit either to speed up your wiggle.',
    triggerChancePerSec: 0.55,
    base: { ...DEFAULT_BASE, twoZones: true, spawnMin: 0.25, spawnMax: 0.25, goodFraction: 0.13, greatFraction: 0.03, silentChance: 1, warningLeadMs: 0 },
  },
  {
    id: 'ds',
    name: 'Decisive Strike',
    short: 'Wiggle bar fills, then one check. Greats only.',
    description: 'You are being carried. The wiggle bar fills, then a single skill check appears — only a great stuns the killer. Great zone 7%, 1.1s rotation, zone starts at 8 o\'clock.',
    triggerChancePerSec: 0,
    marathonTarget: 5,
    failCap: 1,
    base: { ...DEFAULT_BASE, warningLeadMs: 120, rotationSeconds: 1.1, greatFraction: 0.07, goodFraction: 0.07, greatOnly: true, showWiggleBar: true, spawnMin: 0.67, spawnMax: 0.85 },
  },
  {
    id: 'hookstruggle',
    name: 'Hook Struggle',
    short: 'Center of screen. One check every 5s. Miss = sacrifice.',
    description: 'Phase 2 on the hook: a skill check appears at the center of your screen every 5 seconds. Miss even one and you are sacrificed. Survive 6 checks to escape the phase.',
    triggerChancePerSec: 0,
    failCap: 1,
    marathonTarget: 6,
    base: { ...DEFAULT_BASE, fixedIntervalMs: 5000, forceCenter: true, warningLeadMs: 0, silentChance: 1 },
  },
  {
    id: 'snap',
    name: 'Snap Out of It',
    short: 'Continuous Madness checks until you clear it.',
    description: 'Madness Tier 3 cure: continuous Madness-style checks (off-center, reverse). Great zone 12%, greats only, 1.2s rotation, zone starts at 2 o\'clock. Hit 8 greats in a row to snap out.',
    triggerChancePerSec: 999,
    failCap: 1,
    marathonTarget: 8,
    base: { ...DEFAULT_BASE, continuous: true, reverseChance: 0.4, offCenterChance: 0.4, horrorOnMiss: true, warningLeadMs: 60, rotationSeconds: 1.2, greatFraction: 0.12, goodFraction: 0.12, greatOnly: true, spawnMin: 0.17 },
  },
  {
    id: 'endless',
    name: 'Endless',
    short: 'How long can you go without missing?',
    description: 'Classic checks but the run ends the moment you miss. Track your best streak.',
    triggerChancePerSec: 0.7,
    failCap: 1,
    endless: true,
    base: { ...DEFAULT_BASE },
  },
  {
    id: 'marathon',
    name: 'Marathon (50 in a row)',
    short: 'Hit 50 greats. Any miss resets.',
    description: 'Reach a streak of 50 great hits in a row. Goods reset, misses end the run.',
    triggerChancePerSec: 0.8,
    marathonTarget: 50,
    failCap: 1,
    base: { ...DEFAULT_BASE },
  },
  {
    id: 'custom',
    name: 'Custom Practice',
    short: 'Tune every parameter to your liking.',
    description: 'Configure great/good size, rotation speed, reverse chance, off-center chance, and warning lead.',
    triggerChancePerSec: 0.55,
    base: { ...DEFAULT_BASE },
  },
];

export const MODE_BY_ID: Record<string, ModeDef> = Object.fromEntries(MODES.map(m => [m.id, m]));
