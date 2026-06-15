// Low-latency audio with Web Audio. We synthesize sounds at runtime so we have
// zero binary assets to ship — every cue is a short procedural buffer rendered
// once on first user gesture, then re-fired via BufferSource for ~0ms latency.
//
// The cues here are modeled on the in-game sounds — the warning gong is a sharp
// inharmonic bell with a quick decay; the great hit is a single sharp metallic
// "clang"; the miss is a generator-style explosion (low thump + crackly tail).

type Cue = 'warning' | 'great' | 'good' | 'miss';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private buffers: Partial<Record<Cue, AudioBuffer>> = {};
  private master: GainNode | null = null;
  private volume = 0.7;
  private muted = false;

  async ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);

    this.buffers.warning = this.renderWarning(this.ctx);
    this.buffers.great = this.renderGreat(this.ctx);
    this.buffers.good = this.renderGood(this.ctx);
    this.buffers.miss = this.renderMiss(this.ctx);
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && !this.muted) this.master.gain.value = this.volume;
  }
  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  play(cue: Cue) {
    if (!this.ctx || !this.master) return;
    const buf = this.buffers[cue];
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.master);
    src.start();
  }

  // ---- procedural cue rendering ----

  // Warning gong — the brief metallic chime that precedes the skill check.
  // Inharmonic bell: a stack of slightly stretched partials with fast decay
  // and a small click at the attack for that struck-metal feel.
  private renderWarning(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.55;
    const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const d = buf.getChannelData(0);
    const f0 = 880;
    const partials = [
      { f: f0 * 1.000, a: 1.00, decay: 6 },
      { f: f0 * 2.005, a: 0.55, decay: 9 },
      { f: f0 * 3.012, a: 0.35, decay: 12 },
      { f: f0 * 4.020, a: 0.22, decay: 15 },
      { f: f0 * 5.500, a: 0.18, decay: 18 },
      { f: f0 * 0.500, a: 0.40, decay: 4 }, // sub-fundamental for body
    ];
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      let s = 0;
      for (const p of partials) {
        const env = Math.exp(-t * p.decay);
        s += Math.sin(2 * Math.PI * p.f * t) * p.a * env;
      }
      // Attack click — very short noise burst with steep decay
      const click = (Math.random() * 2 - 1) * Math.exp(-t * 180) * 0.4;
      d[i] = (s * 0.18) + click;
    }
    // Soft fade-out tail to avoid pop
    const tailN = Math.floor(sr * 0.02);
    for (let i = 0; i < tailN; i++) {
      const idx = d.length - 1 - i;
      d[idx] *= i / tailN;
    }
    return buf;
  }

  // Great hit — short, bright metallic "clang" with a high-frequency snap.
  private renderGreat(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.32;
    const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const d = buf.getChannelData(0);
    const partials = [
      { f: 1320, decay: 14, a: 0.7 },
      { f: 1980, decay: 18, a: 0.55 },
      { f: 2640, decay: 22, a: 0.35 },
      { f: 3960, decay: 28, a: 0.20 },
    ];
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      let s = 0;
      for (const p of partials) s += Math.sin(2 * Math.PI * p.f * t) * p.a * Math.exp(-t * p.decay);
      // High-frequency snap on the attack
      const snap = (Math.random() * 2 - 1) * Math.exp(-t * 220) * 0.55;
      d[i] = (s * 0.32) + snap;
    }
    return buf;
  }

  // Good hit — almost inaudible: a soft, dry tick.
  // DbD does not have a distinct "good" cue, so we keep this minimal.
  private renderGood(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.06;
    const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 80);
      d[i] = Math.sin(2 * Math.PI * 360 * t) * env * 0.18;
    }
    return buf;
  }

  // Miss — generator explosion: low-frequency thump + filtered noise crackle
  // with a long decaying tail. Models the in-game "you blew up the gen" cue.
  private renderMiss(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 1.1;
    const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const d = buf.getChannelData(0);
    // Low-pass state for crackle and a one-pole high-pass for snap noise
    let lp1 = 0, lp2 = 0;
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      // Pitch-dropping sine thump 110 -> 38 Hz
      const f = 110 * Math.exp(-t * 4) + 38;
      const thump = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 3.2) * 0.85;
      // White noise + crackle through a slow low-pass to give a rumbling tail
      const n = Math.random() * 2 - 1;
      lp1 += (n - lp1) * 0.04;
      lp2 += (lp1 - lp2) * 0.04;
      const rumble = lp2 * Math.exp(-t * 2.4) * 1.6;
      // Crackle: sparse impulses
      const crackle = (Math.random() < 0.012 ? (Math.random() * 2 - 1) : 0) * Math.exp(-t * 2.6) * 0.7;
      // Initial blast of broadband noise
      const blast = n * Math.exp(-t * 22) * 0.55;
      d[i] = thump + rumble + crackle + blast;
    }
    // Mild soft-clip to keep it punchy without harsh peaks
    for (let i = 0; i < d.length; i++) {
      const x = d[i];
      d[i] = Math.tanh(x * 1.4) * 0.85;
    }
    return buf;
  }
}

export const audio = new AudioEngine();
