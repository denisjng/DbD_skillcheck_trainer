// Canvas-based skill check engine. Lives outside React; React owns the menu
// shell and stats overlay only. The engine drives:
//   - the RAF loop
//   - dial / needle / zone rendering
//   - hit detection
//   - mode-driven spawn scheduling
//   - emitting Result events back to React via callback
//
// Design notes:
//   * Input handling is bound at the document level (capture phase) and reads
//     directly from refs — no React state in the hot path, so latency stays
//     ≤1 frame regardless of UI re-renders.
//   * Angles are stored as turns (0..1) internally and converted to radians
//     only when drawing. 0 = top (12 o'clock), increasing clockwise.

import { audio } from './audio';
import type { ModeDef, SkillCheckSpec } from './modes';

export type Outcome = 'great' | 'good' | 'miss' | 'timeout';

export interface RunStats {
  attempts: number;
  greats: number;
  goods: number;
  misses: number;
  timeouts: number;
  streak: number;
  bestStreak: number;
  reactionMsAvg: number;
  reactionMsLast: number;
}

export interface EngineCallbacks {
  onOutcome?: (o: Outcome, stats: RunStats) => void;
  onRunEnd?: (reason: 'failcap' | 'marathon' | 'stopped', stats: RunStats) => void;
  onHorror?: () => void;
}

interface ActiveCheck {
  spec: SkillCheckSpec;
  goodStart: number;   // turns
  goodEnd: number;
  greatStart: number;
  greatEnd: number;
  goodStart2?: number; // for wiggle
  goodEnd2?: number;
  greatStart2?: number;
  greatEnd2?: number;
  needle: number;      // current turns position
  direction: 1 | -1;
  speed: number;       // turns per second (positive)
  offsetX: number;     // px offset from canvas center
  offsetY: number;
  shownAt: number;     // performance.now() when check became visible
  triggered: boolean;  // becomes true once the warning fires & needle starts
  silent: boolean;
  warningLeadMs: number;
  // when needle returns past the start position without input -> timeout
  startedAt: number | null;
}

const TAU = Math.PI * 2;

export class SkillCheckEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private dpr = 1;
  private rafId = 0;
  private lastFrameTime = 0;

  private mode: ModeDef;
  private spec: SkillCheckSpec;
  private running = false;
  private callbacks: EngineCallbacks;

  private active: ActiveCheck | null = null;
  private spawnTimer = 0; // seconds until next attempt
  private firstSpawnDelay = 0.6;
  // For DS — a wiggle bar that fills over a few seconds before the check appears
  private wiggleProgress = 0; // 0..1
  private wiggleSeconds = 4;  // how long the bar takes to fill

  private stats: RunStats = {
    attempts: 0, greats: 0, goods: 0, misses: 0, timeouts: 0,
    streak: 0, bestStreak: 0, reactionMsAvg: 0, reactionMsLast: 0,
  };
  private reactionSum = 0;
  private reactionCount = 0;

  private bindingsRef: { current: string[] };
  private flashRing: { t: number; color: string } | null = null;

  constructor(mode: ModeDef, spec: SkillCheckSpec, bindingsRef: { current: string[] }, callbacks: EngineCallbacks = {}) {
    this.mode = mode;
    this.spec = spec;
    this.bindingsRef = bindingsRef;
    this.callbacks = callbacks;
  }

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    this.resize();
    window.addEventListener('resize', this.resize);
    document.addEventListener('keydown', this.onKey, { capture: true });
    document.addEventListener('mousedown', this.onMouse, { capture: true });
    document.addEventListener('contextmenu', this.onContextMenu, { capture: true });
  }

  detach() {
    cancelAnimationFrame(this.rafId);
    this.running = false;
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('keydown', this.onKey, { capture: true });
    document.removeEventListener('mousedown', this.onMouse, { capture: true });
    document.removeEventListener('contextmenu', this.onContextMenu, { capture: true });
  }

  start() {
    this.running = true;
    this.spawnTimer = this.firstSpawnDelay;
    this.lastFrameTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(reason: 'failcap' | 'marathon' | 'stopped' = 'stopped') {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.callbacks.onRunEnd?.(reason, this.stats);
  }

  getStats(): RunStats { return this.stats; }

  // ---- input ----

  private onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (!this.running) return;
    const b = e.code;
    if (this.bindingsRef.current.includes(b)) {
      if (b === 'Space' || b === 'Tab' || b.startsWith('Arrow')) e.preventDefault();
      this.handleHit();
    }
  };
  private onMouse = (e: MouseEvent) => {
    if (!this.running) return;
    const b = `Mouse${e.button}`;
    if (this.bindingsRef.current.includes(b)) {
      e.preventDefault();
      this.handleHit();
    }
  };
  private onContextMenu = (e: MouseEvent) => {
    // suppress right-click menu if right-click is bound
    if (this.bindingsRef.current.includes('Mouse2')) e.preventDefault();
  };

  private handleHit() {
    if (!this.active || !this.active.triggered) return;
    const a = this.active;
    const pos = a.needle;
    // Hit detection — check great first, then good. Wiggle has two zones.
    let outcome: Outcome = 'miss';
    if (inArc(pos, a.greatStart, a.greatEnd)) outcome = 'great';
    else if (a.greatStart2 != null && a.greatEnd2 != null && inArc(pos, a.greatStart2, a.greatEnd2)) outcome = 'great';
    else if (inArc(pos, a.goodStart, a.goodEnd)) outcome = 'good';
    else if (a.goodStart2 != null && a.goodEnd2 != null && inArc(pos, a.goodStart2, a.goodEnd2)) outcome = 'good';
    // DS — goods don't count, only great stuns
    if (this.spec.greatOnly && outcome === 'good') outcome = 'miss';
    this.resolve(outcome);
  }

  private resolve(outcome: Outcome) {
    if (!this.active) return;
    const a = this.active;
    const rt = (a.startedAt != null) ? (performance.now() - a.startedAt) : 0;
    this.stats.attempts++;
    if (outcome !== 'miss' && outcome !== 'timeout') {
      this.reactionSum += rt;
      this.reactionCount++;
      this.stats.reactionMsLast = Math.round(rt);
      this.stats.reactionMsAvg = Math.round(this.reactionSum / this.reactionCount);
    }
    if (outcome === 'great') {
      this.stats.greats++;
      this.stats.streak++;
      audio.play('great');
      this.flashRing = { t: performance.now(), color: '#c1121f' };
    } else if (outcome === 'good') {
      this.stats.goods++;
      // marathon resets on good as well (per mode marathonTarget rules: greats only)
      if (this.mode.marathonTarget) this.stats.streak = 0;
      else this.stats.streak++;
      audio.play('good');
      this.flashRing = { t: performance.now(), color: '#e8d8c4' };
    } else if (outcome === 'timeout') {
      this.stats.timeouts++;
      this.stats.streak = 0;
      audio.play('miss');
      this.flashRing = { t: performance.now(), color: '#6a3410' };
    } else {
      this.stats.misses++;
      this.stats.streak = 0;
      audio.play('miss');
      this.flashRing = { t: performance.now(), color: '#c1121f' };
      // Horror flash for Madness / Snap Out of It — handled by the React layer
      // so it survives even when the run ends on the same frame (failCap=1 modes).
      if (this.spec.horrorOnMiss) this.callbacks.onHorror?.();
    }
    if (this.stats.streak > this.stats.bestStreak) this.stats.bestStreak = this.stats.streak;

    this.active = null;
    this.spawnTimer = this.spec.continuous ? 0.05 : 0.25 + Math.random() * 0.35;
    this.callbacks.onOutcome?.(outcome, this.stats);

    // End conditions
    if (this.mode.marathonTarget && this.stats.streak >= this.mode.marathonTarget) {
      this.stop('marathon');
      return;
    }
    if (this.mode.failCap != null) {
      const fails = this.stats.misses + this.stats.timeouts + (this.mode.marathonTarget ? this.stats.goods : 0);
      if (fails >= this.mode.failCap) {
        this.stop('failcap');
        return;
      }
    }
  }

  // ---- main loop ----

  private frame = (now: number) => {
    if (!this.running || !this.ctx || !this.canvas) return;
    const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;
    this.update(dt, now);
    this.draw(now);
    this.rafId = requestAnimationFrame(this.frame);
  };

  private update(dt: number, now: number) {
    // DS wiggle bar — fills up before the next check spawns.
    if (this.spec.showWiggleBar && !this.active) {
      this.wiggleProgress = Math.min(1, this.wiggleProgress + dt / this.wiggleSeconds);
    }

    // Spawn scheduling
    if (!this.active) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        if (this.spec.fixedIntervalMs != null) {
          // Hook struggle — fire exactly every N ms once the timer hits 0
          this.spawn();
          this.spawnTimer = this.spec.fixedIntervalMs / 1000;
        } else if (this.spec.continuous) {
          this.spawn();
        } else if (this.spec.showWiggleBar) {
          // DS — wait for the wiggle bar to fill, then spawn once
          if (this.wiggleProgress >= 1) {
            this.spawn();
            this.wiggleProgress = 0; // reset for the next attempt (marathon)
          }
        } else if (this.mode.triggerChancePerSec >= 999) {
          this.spawn();
        } else {
          // chance per second roll
          const chance = 1 - Math.exp(-this.mode.triggerChancePerSec * 0.05);
          if (Math.random() < chance) this.spawn();
          this.spawnTimer = 0.05;
        }
      }
    } else {
      const a = this.active;
      // Reveal warning -> after warningLeadMs, the needle starts moving.
      const ageMs = now - a.shownAt;
      if (!a.triggered && ageMs >= a.warningLeadMs) {
        a.triggered = true;
        a.startedAt = now;
        if (!a.silent && a.warningLeadMs > 0) audio.play('warning');
        else if (a.warningLeadMs === 0 && !a.silent) audio.play('warning');
      }
      if (a.triggered) {
        a.needle += a.direction * a.speed * dt;
        // Did the needle leave all zones without an input? -> timeout
        const lastEnd = this.spec.twoZones ? 1.0 : (a.goodEnd + 0.05);
        const firstStart = this.spec.twoZones ? 0.0 : (a.goodStart - 0.05);
        const past = (a.direction === 1) ? (a.needle >= lastEnd) : (a.needle <= firstStart);
        if (past) this.resolve('timeout');
      }
    }
  }

  private spawn() {
    if (!this.canvas) return;
    const s = this.spec;
    const reverse = Math.random() < s.reverseChance;
    const offCenter = !s.forceCenter && Math.random() < s.offCenterChance;
    const silent = Math.random() < s.silentChance;

    let goodStart: number;
    if (s.twoZones) {
      // Wiggle: zones fixed at 3 o'clock (0.25) and 9 o'clock (0.75)
      goodStart = 0.25 - s.goodFraction / 2;
    } else {
      // The leading edge (= great zone start) is what spawnMin/spawnMax bound.
      // The needle enters at goodStart and the great zone sits there.
      const span = Math.max(0, s.spawnMax - s.spawnMin);
      goodStart = s.spawnMin + Math.random() * span;
      if (goodStart < 0) goodStart += 1;
      if (goodStart > 1) goodStart -= 1;
    }
    const goodEnd = goodStart + s.goodFraction;
    // Great zone sits at the leading edge of the good zone.
    // For clockwise needles the leading edge is the trailing side (the one the
    // needle enters first) — in our coord system that is goodStart (lower angle).
    const greatStart = goodStart;
    const greatEnd = goodStart + s.greatFraction;

    const active: ActiveCheck = {
      spec: s,
      goodStart, goodEnd, greatStart, greatEnd,
      needle: -0.02, // a hair before 12 o'clock so the user sees it appear
      direction: reverse ? -1 : 1,
      speed: 1 / s.rotationSeconds,
      offsetX: offCenter ? (Math.random() * 240 - 120) : 0,
      offsetY: offCenter ? (Math.random() * 180 - 90) : 0,
      shownAt: performance.now(),
      triggered: s.warningLeadMs === 0,
      silent,
      warningLeadMs: s.warningLeadMs,
      startedAt: s.warningLeadMs === 0 ? performance.now() : null,
    };

    if (s.twoZones) {
      active.goodStart2 = 0.75 - s.goodFraction / 2;
      active.goodEnd2 = active.goodStart2 + s.goodFraction;
      active.greatStart2 = active.goodStart2;
      active.greatEnd2 = active.goodStart2 + s.greatFraction;
    }

    // For reverse direction, the great zone sits at the OTHER leading edge.
    if (reverse) {
      active.greatStart = goodEnd - s.greatFraction;
      active.greatEnd = goodEnd;
      if (s.twoZones && active.greatStart2 != null) {
        active.greatStart2 = (active.goodEnd2 ?? 0) - s.greatFraction;
        active.greatEnd2 = (active.goodEnd2 ?? 0);
      }
      active.needle = s.twoZones ? 0.5 : (s.spawnMax + 0.05); // start past where zones are
    }
    if (silent && active.triggered) {/* no sound */}
    this.active = active;
    this.spawnTimer = 0; // gate handled by `active`
  }

  // ---- drawing ----

  private resize = () => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(rect.width * this.dpr);
    this.canvas.height = Math.floor(rect.height * this.dpr);
  };

  private draw(now: number) {
    const ctx = this.ctx!;
    const canvas = this.canvas!;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    const cx = (W / this.dpr) / 2 + (this.active?.offsetX ?? 0);
    const cy = (H / this.dpr) / 2 + (this.active?.offsetY ?? 0);
    const size = Math.min(W, H) / this.dpr;
    const r = Math.min(180, size * 0.28); // a touch smaller -> denser, more game-like

    // Idle state — ring visible but dimmed, key label prominent
    if (!this.active) {
      ctx.globalAlpha = 0.55;
      this.drawDialFrame(ctx, cx, cy, r);
      ctx.globalAlpha = 0.75;
      this.drawKeyLabel(ctx, cx, cy);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(232,216,196,0.42)';
      ctx.font = '500 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('— waiting for next skill check —', cx, cy + r + 44);
    } else {
      const a = this.active;
      // Fade-in: 0 -> 1 over 140ms from shownAt
      const fadeT = Math.min(1, (now - a.shownAt) / 140);
      // Subtle scale-up: 0.88 -> 1.0 over the fade
      const scale = 0.88 + 0.12 * easeOutCubic(fadeT);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
      ctx.globalAlpha = fadeT;
      this.drawDial(ctx, cx, cy, r, a, now);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Flash ring on outcome
    if (this.flashRing) {
      const age = now - this.flashRing.t;
      if (age < 320) {
        const k = 1 - age / 320;
        ctx.strokeStyle = this.flashRing.color;
        ctx.globalAlpha = k * 0.85;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 12 + (1 - k) * 26, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        this.flashRing = null;
      }
    }

    // DS — wiggle meter at the bottom of the canvas
    if (this.spec.showWiggleBar) {
      this.drawWiggleBar(ctx, (this.canvas!.width / this.dpr), (this.canvas!.height / this.dpr));
    }

    ctx.restore();
  }

  private drawWiggleBar(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const padX = Math.max(40, W * 0.12);
    const barH = 14;
    const barY = H - 60;
    const barX = padX;
    const barW = W - padX * 2;

    // Label
    ctx.fillStyle = 'rgba(232,216,196,0.7)';
    ctx.font = '600 11px ui-sans-serif, system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('WIGGLE', barX, barY - 8);

    // Track
    ctx.fillStyle = 'rgba(28,24,22,0.85)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = 'rgba(180,168,150,0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);

    // Fill (cream colored, with thin red leading edge as it nears full)
    const fillW = barW * this.wiggleProgress;
    const grad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
    grad.addColorStop(0, '#a89a82');
    grad.addColorStop(1, '#f0e5d2');
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, fillW, barH);

    if (this.wiggleProgress > 0.9) {
      ctx.shadowColor = '#ee1c25';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ee1c25';
      ctx.fillRect(barX + fillW - 3, barY, 3, barH);
      ctx.shadowBlur = 0;
    }
  }


  // The bare metallic ring + soft outer halo, used both for the live dial and
  // the idle placeholder. No zones, no needle.
  private drawDialFrame(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    // Subtle dark vignette behind the dial
    const shadow = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.55);
    shadow.addColorStop(0,   'rgba(0,0,0,0)');
    shadow.addColorStop(0.7, 'rgba(0,0,0,0.42)');
    shadow.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.55, 0, TAU);
    ctx.fill();

    // Thin track ring — light gray, semi-transparent
    ctx.strokeStyle = 'rgba(200,200,200,0.30)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
  }

  private drawDial(
    ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number,
    a: ActiveCheck, now: number,
  ) {
    // Zone is thick relative to the thin track ring
    const ZONE_W = Math.round(r * 0.22); // total zone thickness (~40px at r=180)

    this.drawDialFrame(ctx, cx, cy, r);

    // Good zone(s) — thick white arc band
    this.drawZone(ctx, cx, cy, r, a.goodStart, a.goodEnd, '#ffffff', ZONE_W, false);
    if (a.goodStart2 != null && a.goodEnd2 != null)
      this.drawZone(ctx, cx, cy, r, a.goodStart2, a.goodEnd2, '#ffffff', ZONE_W, false);

    // Great zone(s) — bright crimson with glow, same thickness, narrower angular span
    this.drawZone(ctx, cx, cy, r, a.greatStart, a.greatEnd, '#ee1c25', ZONE_W, true);
    if (a.greatStart2 != null && a.greatEnd2 != null)
      this.drawZone(ctx, cx, cy, r, a.greatStart2, a.greatEnd2, '#ee1c25', ZONE_W, true);

    // 12 o'clock tick — notch just outside the zone edge
    const H = ZONE_W / 2;
    ctx.strokeStyle = 'rgba(232,216,196,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r - H - 3);
    ctx.lineTo(cx, cy - r - H - 11);
    ctx.stroke();

    // Key label in center
    this.drawKeyLabel(ctx, cx, cy);

    // Needle
    if (a.triggered) {
      this.drawNeedle(ctx, cx, cy, r, a);
    } else {
      // pre-trigger: pulse ring around the keycap
      const t = a.warningLeadMs > 0 ? Math.min(1, (now - a.shownAt) / a.warningLeadMs) : 1;
      ctx.strokeStyle = `rgba(238,28,37,${0.2 + 0.4 * t})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 18 + t * 6, 0, TAU);
      ctx.stroke();
    }
  }

  private drawNeedle(
    ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, a: ActiveCheck,
  ) {
    const ZONE_W = Math.round(r * 0.22);
    const ang = turnsToRad(a.needle);
    const tipR = r + ZONE_W / 2 + 4; // tip just past the outer zone edge
    const innerR = 4;

    const ux = Math.cos(ang), uy = Math.sin(ang);

    // Bright red line from near-center to tip
    ctx.save();
    ctx.shadowColor = '#ff2929';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#ee1c25';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + ux * innerR, cy + uy * innerR);
    ctx.lineTo(cx + ux * tipR, cy + uy * tipR);
    ctx.stroke();
    ctx.restore();
  }

  private getKeyLabel(): string {
    const b = this.bindingsRef.current[0] ?? 'Space';
    if (b.startsWith('Mouse')) return ['LMB', 'MMB', 'RMB', 'M4', 'M5'][Number(b.slice(5))] ?? b;
    if (b.startsWith('Key')) return b.slice(3);
    if (b.startsWith('Digit')) return b.slice(5);
    if (b.startsWith('Arrow')) return '↑↓←→'[['Up','Down','Left','Right'].indexOf(b.slice(5))] ?? b.slice(5);
    return b;
  }

  private drawKeyLabel(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    const label = this.getKeyLabel();
    const fontSize = 14;
    ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    const textW = ctx.measureText(label).width;
    const padX = 13, padY = 7;
    const boxW = Math.max(58, textW + padX * 2);
    const boxH = fontSize + padY * 2;
    const bx = cx - boxW / 2;
    const by = cy - boxH / 2;

    ctx.fillStyle = 'rgba(14,11,9,0.92)';
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 5);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.80)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy);
    ctx.textBaseline = 'alphabetic';
  }

  // Draws a filled arc band with radial (wedge-cut) edges — matches the DbD look.
  // `width` is the total band thickness; the band is centered on radius r.
  private drawZone(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, r: number,
    startTurns: number, endTurns: number,
    color: string, width: number, glow: boolean,
  ) {
    const start = turnsToRad(startTurns);
    const end   = turnsToRad(endTurns);
    const rO = r + width / 2;
    const rI = r - width / 2;
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 20; }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, rO, start, end, false); // outer arc clockwise
    ctx.arc(cx, cy, rI, end, start, true);  // inner arc counter-clockwise
    ctx.closePath();
    ctx.fill();
    if (glow) ctx.shadowBlur = 0;
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// helpers
function inArc(needle: number, start: number, end: number): boolean {
  // unwrap into [start, start+1]
  let n = needle;
  if (end < start) {
    // shouldn't happen with current spawn logic, but be defensive
    if (n < start) n += 1;
    return n >= start && n <= end + 1;
  }
  if (n < start - 0.5) n += 1;
  return n >= start && n <= end;
}

function turnsToRad(t: number): number {
  // 0 turns -> 12 o'clock (top), increasing clockwise.
  // Canvas 0 rad is at 3 o'clock and increases clockwise.
  return t * TAU - Math.PI / 2;
}
