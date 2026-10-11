/**
 * Procedural audio for Gridbound's forest-ruin combat.
 * Short procedural combat and interface cues; background music is disabled.
 */

export class Sound {
  enabled = true;
  private ctx?: AudioContext;
  private last = -Infinity;
  private lastSupport = -Infinity;
  /** One second of white noise per context, shared by every burst (a burst plays a random slice of it). */
  private noise?: AudioBuffer;
  /** The context was suspended because the page was hidden (so coming back resumes it, but never one the player muted or never unlocked). */
  private hiddenSuspend = false;

  constructor() {
    // Phones keep a running AudioContext awake in the background: suspend it while the page is hidden.
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => this.visibility(document.hidden));
  }

  /** Suspend on hidden, resume on visible. Resuming needs an earlier user gesture; if the browser refuses, the next tap's unlock() resumes it. */
  visibility(hidden: boolean) {
    const c = this.ctx;
    if (!c) return;
    if (hidden) { if (c.state === 'running') { this.hiddenSuspend = true; void c.suspend().catch(() => {}); } return; }
    if (this.hiddenSuspend) { this.hiddenSuspend = false; void c.resume().catch(() => {}); }
  }

  private castCue(kind: string) {
    if (kind === 'heal' || kind === 'regen') {
      [523, 659].forEach((n, i) => {
        setTimeout(() => this.synthNote(n, 0.14, { type: 'sine', volume: 0.014, attack: 0.008 }), i * 42);
      });
      return;
    }
    if (kind === 'shield' || kind === 'partyshield') {
      this.synthNote(300, 0.16, { type: 'triangle', volume: 0.018, slide: 170 });
      this.synthNote(600, 0.13, { type: 'sine', volume: 0.012, attack: 0.01 });
      return;
    }
    if (kind === 'buff') {
      this.synthNote(392, 0.16, { type: 'sine', volume: 0.014, attack: 0.01, slide: 96 });
      this.synthNote(784, 0.2, { type: 'triangle', volume: 0.012, attack: 0.02 });
      return;
    }
    if (kind === 'haste') { [988, 1319].forEach((n, i) => setTimeout(() => this.synthNote(n, 0.12, { type: 'sine', volume: 0.012, attack: 0.004 }), i * 50)); return; }
    if (kind === 'weaken') { this.synthNote(520, 0.18, { type: 'triangle', volume: 0.016, slide: -260 }); return; }
    if (kind === 'curse') { this.synthNote(82, 0.32, { type: 'sawtooth', volume: 0.016, slide: -12, filterFreq: 420 }); this.synthNote(123, 0.3, { type: 'sine', volume: 0.01, attack: 0.04 }); return; }
    if (kind === 'delay' || kind === 'stun') { [660, 440].forEach((n, i) => setTimeout(() => this.synthNote(n, 0.06, { type: 'square', volume: 0.01 }), i * 70)); return; }
    if (kind === 'counter') { this.synthNote(196, 0.3, { type: 'triangle', volume: 0.02, attack: 0.004 }); this.synthNote(392, 0.24, { type: 'sine', volume: 0.012 }); return; }
    if (kind === 'turret') { this.synthNote(1200, 0.03, { type: 'square', volume: 0.012 }); setTimeout(() => this.synthNote(900, 0.04, { type: 'square', volume: 0.012 }), 45); this.noiseBurst(0.04, 0.01, 3000, 'highpass'); return; }
    if (kind === 'drain') { this.synthNote(300, 0.2, { type: 'sine', volume: 0.016, slide: -140 }); this.noiseBurst(0.12, 0.008, 700, 'lowpass'); return; }
    if (kind === 'sacrifice') { this.synthNote(147, 0.24, { type: 'sawtooth', volume: 0.016, slide: -40, filterFreq: 600 }); return; }
    if (kind === 'repair') { [700, 820, 940].forEach((n, i) => setTimeout(() => this.synthNote(n, 0.04, { type: 'square', volume: 0.009 }), i * 40)); return; }
    if (kind === 'selfheal') { this.synthNote(440, 0.2, { type: 'sine', volume: 0.014, attack: 0.02, slide: 80 }); return; }
    if (kind === 'resolve') { this.synthNote(330, 0.18, { type: 'triangle', volume: 0.014, slide: 220 }); return; }
    const frequency = kind === 'interrupt' ? 190 : kind === 'aoe' ? 330 : kind === 'steal' ? 720 : kind === 'combo' || kind === 'flurry' ? 470 : 420;
    this.synthNote(frequency, 0.1, { type: 'triangle', volume: 0.018, slide: 120 });
    this.noiseBurst(0.06, 0.009, kind === 'interrupt' ? 500 : 1500, 'bandpass');
  }

  private hitCue(kind: string) {
    if (kind === 'hit-magic') {
      this.synthNote(460, 0.12, { type: 'triangle', volume: 0.02, slide: -160, filterFreq: 1800 });
      this.noiseBurst(0.07, 0.014, 1800, 'highpass');
      return;
    }
    if (kind === 'hit-heavy') {
      this.synthNote(92, 0.2, { type: 'sawtooth', volume: 0.03, slide: -36, filterFreq: 720 });
      this.noiseBurst(0.11, 0.024, 720, 'lowpass');
      return;
    }
    if (kind === 'hit-slash') {
      this.synthNote(230, 0.08, { type: 'triangle', volume: 0.022, slide: -110 });
      this.noiseBurst(0.06, 0.012, 2200, 'highpass');
      return;
    }
    this.synthNote(170, 0.1, { type: 'triangle', volume: 0.018, slide: -70 });
    this.noiseBurst(0.06, 0.012, 1100, 'bandpass');
  }

  private threatCue() {
    this.synthNote(122, 0.22, { type: 'sawtooth', volume: 0.02, slide: -18, filterFreq: 560 });
    this.synthNote(174, 0.2, { type: 'sawtooth', volume: 0.016, filterFreq: 720 });
  }

  private blockedCue() {
    this.synthNote(210, 0.11, { type: 'square', volume: 0.018, slide: -70, filterFreq: 900 });
    this.noiseBurst(0.05, 0.014, 900, 'highpass');
  }

  private guardCue() {
    this.synthNote(180, 0.18, { type: 'triangle', volume: 0.022, slide: 80, filterFreq: 900 });
    this.synthNote(360, 0.2, { type: 'sine', volume: 0.014, slide: 180 });
    this.noiseBurst(0.08, 0.012, 520, 'lowpass');
  }

  private phaseCue() {
    this.synthNote(146, 0.2, { type: 'sawtooth', volume: 0.018, slide: 30, filterFreq: 680 });
    setTimeout(() => this.synthNote(220, 0.22, { type: 'triangle', volume: 0.019, attack: 0.015, slide: 80 }), 65);
    setTimeout(() => this.synthNote(330, 0.2, { type: 'sine', volume: 0.015, attack: 0.015 }), 130);
  }

  private summonCue() {
    this.noiseBurst(0.12, 0.014, 420, 'lowpass');
    this.synthNote(98, 0.22, { type: 'triangle', volume: 0.018, slide: 120, filterFreq: 700 });
    setTimeout(() => this.synthNote(196, 0.16, { type: 'sine', volume: 0.012, attack: 0.01 }), 75);
  }

  private victoryCue() {
    [262, 330, 392, 523].forEach((n, i) => {
      setTimeout(() => this.synthNote(n, 0.34, { type: 'triangle', volume: 0.024, attack: 0.012 }), i * 75);
    });
  }

  unlock() {
    try {
      this.ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
    } catch {
      /* Audio remains optional on unsupported browsers. */
    }
  }

  /** Backwards-compatible raw tone generator */
  tone(freq: number, duration = 0.1, type: OscillatorType = 'triangle', volume = 0.025, slide = 0) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const c = this.ctx;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), c.currentTime + duration);
    }

    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);

    osc.connect(gain);
    gain.connect(c.destination);

    osc.start();
    osc.stop(c.currentTime + duration);
  }

  /** Advanced multi-timbre tone with envelope and optional filter */
  private synthNote(freq: number, duration = 0.15, options: {
    type?: OscillatorType;
    volume?: number;
    attack?: number;
    slide?: number;
    filterFreq?: number;
    filterType?: BiquadFilterType;
  } = {}) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const c = this.ctx;
    const {
      type = 'triangle',
      volume = 0.03,
      attack = 0.01,
      slide = 0,
      filterFreq,
      filterType = 'lowpass'
    } = options;

    const osc = c.createOscillator();
    const gain = c.createGain();
    const now = c.currentTime;

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), now);
    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), now + duration);
    }

    // ADSR Envelope
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    if (filterFreq) {
      const filter = c.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(filterFreq, now);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  /** Noise burst for kinetic impact crunches and air whooshes */
  private noiseBurst(duration = 0.1, volume = 0.02, filterFreq = 1200, filterType: BiquadFilterType = 'bandpass') {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const c = this.ctx;
    if (duration <= 0) return;
    if (!this.noise || this.noise.sampleRate !== c.sampleRate) {
      this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const length = Math.min(duration, this.noise.duration);

    const noise = c.createBufferSource();
    noise.buffer = this.noise;

    const filter = c.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, c.currentTime);

    const gain = c.createGain();
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);

    noise.start(c.currentTime, Math.random() * (this.noise.duration - length), length);
  }

  /** Tactile metallic coin clink for UI clicks and tabs */
  clink() {
    this.synthNote(1480, 0.08, { type: 'sine', volume: 0.018, attack: 0.005 });
    this.synthNote(2220, 0.06, { type: 'triangle', volume: 0.012, attack: 0.003 });
  }

  /** Tarot card deal whoosh and chime */
  cardDeal() {
    this.noiseBurst(0.12, 0.015, 2400, 'bandpass');
    [659, 880, 1046].forEach((n, i) => {
      setTimeout(() => this.synthNote(n, 0.14, { type: 'sine', volume: 0.015, attack: 0.01 }), i * 35);
    });
  }

  /** Heavy stone tablet latch click for Pact modifiers */
  pactToggle() {
    this.synthNote(120, 0.06, { type: 'square', volume: 0.025, slide: -60 });
    this.noiseBurst(0.05, 0.018, 800, 'lowpass');
  }

  /** Deep ethereal Underworld modal reveal */
  modalReveal() {
    this.synthNote(98, 0.35, { type: 'triangle', volume: 0.028, attack: 0.04, filterFreq: 400 });
    this.synthNote(587, 0.25, { type: 'sine', volume: 0.014, attack: 0.02 });
  }

  /** Visceral critical strike gong */
  critHit() {
    this.synthNote(1050, 0.3, { type: 'sawtooth', volume: 0.035, slide: -300, filterFreq: 3200 });
    this.synthNote(2100, 0.22, { type: 'triangle', volume: 0.025 });
    this.noiseBurst(0.15, 0.03, 1600, 'highpass');
  }

  /** Shattering crystalline obsidian resonance for armor break */
  armorBreak() {
    this.noiseBurst(0.2, 0.035, 2200, 'bandpass');
    [1200, 950, 720, 480].forEach((n, i) => {
      setTimeout(() => this.synthNote(n, 0.22, { type: 'sawtooth', volume: 0.025, slide: -120 }), i * 30);
    });
  }

  play(kind: string) {
    const now = performance.now();
    const combatHit = kind === 'hit' || kind === 'hit-heavy' || kind === 'hit-magic' || kind === 'hit-slash';
    if (combatHit) {
      if (now - this.last < 55) return;
      this.last = now;
    }
    const supportCue = kind === 'heal' || kind === 'shield' || kind === 'buff';
    if (supportCue) {
      if (now - this.lastSupport < 70) return;
      this.lastSupport = now;
    }

    switch (kind) {
      case 'tap':
        this.synthNote(540, 0.05, { type: 'triangle', volume: 0.032, slide: 180 });
        this.synthNote(125, 0.045, { type: 'sine', volume: 0.025, slide: -35 });
        break;

      case 'clink':
        this.clink();
        break;

      case 'card-deal':
        this.cardDeal();
        break;

      case 'pact-toggle':
        this.pactToggle();
        break;

      case 'modal-open':
        this.modalReveal();
        break;

      case 'crit':
        this.critHit();
        break;

      case 'break':
        this.armorBreak();
        break;

      case 'cast-attack':
      case 'cast-shield':
      case 'cast-heal':
      case 'cast-buff':
      case 'cast-steal':
      case 'cast-aoe':
      case 'cast-interrupt':
      case 'cast-mark':
      case 'cast-partyshield':
      case 'cast-regen':
      case 'cast-haste':
      case 'cast-weaken':
      case 'cast-curse':
      case 'cast-delay':
      case 'cast-stun':
      case 'cast-counter':
      case 'cast-turret':
      case 'cast-drain':
      case 'cast-sacrifice':
      case 'cast-repair':
      case 'cast-combo':
      case 'cast-flurry':
      case 'cast-selfheal':
      case 'cast-resolve':
        this.castCue(kind.slice(5));
        break;

      case 'down':
        // KO sting: a falling minor third over a low thud.
        this.synthNote(392, 0.22, { type: 'square', volume: 0.014, slide: -180 });
        setTimeout(() => this.synthNote(233, 0.36, { type: 'triangle', volume: 0.022, slide: -120 }), 120);
        this.noiseBurst(0.14, 0.02, 420, 'lowpass');
        break;

      case 'stun':
        this.synthNote(880, 0.08, { type: 'square', volume: 0.01, slide: -300 });
        setTimeout(() => this.synthNote(587, 0.12, { type: 'triangle', volume: 0.012 }), 60);
        break;

      case 'interrupt':
        this.synthNote(1175, 0.12, { type: 'triangle', volume: 0.018, slide: -500 });
        this.noiseBurst(0.12, 0.018, 2600, 'highpass');
        break;

      case 'enrage':
        this.synthNote(73, 0.5, { type: 'sawtooth', volume: 0.024, slide: 20, filterFreq: 500 });
        setTimeout(() => this.synthNote(110, 0.4, { type: 'sawtooth', volume: 0.018, filterFreq: 600 }), 140);
        break;

      case 'pact':
        this.synthNote(196, 0.18, { type: 'sine', volume: 0.016, slide: -60 });
        break;

      case 'move':
        this.noiseBurst(0.08, 0.008, 1800, 'bandpass');
        break;

      case 'minion-attack':
        this.synthNote(260, 0.06, { type: 'square', volume: 0.009, slide: -80 });
        break;

      case 'minion-down':
        this.synthNote(330, 0.1, { type: 'triangle', volume: 0.014, slide: -200 });
        this.noiseBurst(0.06, 0.01, 1200, 'bandpass');
        break;

      case 'guard':
        this.guardCue();
        break;

      case 'shield':
        this.synthNote(340, 0.18, { type: 'triangle', volume: 0.019, slide: 230 });
        this.synthNote(680, 0.14, { type: 'sine', volume: 0.012, slide: 120 });
        break;

      case 'heal':
        [523, 659].forEach((n, i) => {
          setTimeout(() => this.synthNote(n, 0.14, { type: 'sine', volume: 0.014, attack: 0.008 }), i * 42);
        });
        break;

      case 'buff':
        this.castCue('buff');
        break;

      case 'threat':
      case 'warning':
        this.threatCue();
        break;

      case 'hit':
      case 'hit-heavy':
      case 'hit-magic':
      case 'hit-slash':
        this.hitCue(kind);
        break;

      case 'impact':
      case 'claw':
        this.hitCue('hit-heavy');
        break;

      case 'hurt':
        this.synthNote(110, 0.15, { type: 'sawtooth', volume: 0.022, slide: -50 });
        this.noiseBurst(0.07, 0.017, 600, 'lowpass');
        break;

      case 'blocked':
        this.blockedCue();
        break;

      case 'projectile':
        this.hitCue('hit');
        break;

      case 'phase':
        this.phaseCue();
        break;

      case 'summon':
        this.summonCue();
        break;

      case 'coin':
        this.synthNote(1100, 0.12, { type: 'square', volume: 0.01, slide: 280 });
        this.synthNote(1650, 0.15, { type: 'sine', volume: 0.008 });
        break;

      case 'ultimate':
        [220, 277, 330, 440].forEach((n, i) => {
          setTimeout(() => this.synthNote(n, 0.42, { type: 'triangle', volume: 0.028, attack: 0.018 }), i * 58);
        });
        this.noiseBurst(0.22, 0.02, 1800, 'bandpass');
        break;

      case 'victory':
        this.victoryCue();
        break;

      case 'encounter':
        this.noiseBurst(0.35, 0.02, 2400, 'bandpass');
        [880, 660, 494, 330].forEach((n, i) => setTimeout(() => this.synthNote(n, 0.09, { type: 'square', volume: 0.012 }), i * 45));
        break;

      case 'levelup':
        [523, 659, 784, 1047, 1319].forEach((n, i) => setTimeout(() => this.synthNote(n, i === 4 ? 0.3 : 0.1, { type: 'square', volume: 0.011, attack: 0.004 }), i * 70));
        break;

      case 'text':
        this.synthNote(740, 0.022, { type: 'square', volume: 0.004 });
        break;

      case 'cursor':
        this.synthNote(1320, 0.035, { type: 'square', volume: 0.008 });
        break;

      case 'confirm':
        this.synthNote(988, 0.05, { type: 'square', volume: 0.01 });
        setTimeout(() => this.synthNote(1480, 0.08, { type: 'square', volume: 0.01 }), 50);
        break;

      case 'save':
        [784, 988, 1175, 1568].forEach((n, i) => setTimeout(() => this.synthNote(n, 0.16, { type: 'triangle', volume: 0.016, attack: 0.006 }), i * 70));
        break;

      case 'fanfare': {
        // An original short victory jingle: square lead over a triangle bass.
        const lead: [number, number, number][] = [[523, 0, .12], [659, 120, .12], [784, 240, .12], [1047, 360, .36], [988, 760, .12], [1047, 880, .5]];
        const bass: [number, number, number][] = [[131, 0, .34], [196, 360, .34], [262, 760, .6]];
        lead.forEach(([n, at, d]) => setTimeout(() => this.synthNote(n, d, { type: 'square', volume: 0.012, attack: 0.004 }), at));
        bass.forEach(([n, at, d]) => setTimeout(() => this.synthNote(n, d, { type: 'triangle', volume: 0.03, attack: 0.01 }), at));
        break;
      }

      case 'defeat':
        [196, 174, 155].forEach((n, i) => {
          setTimeout(() => this.synthNote(n, 0.45, { type: 'sawtooth', volume: 0.022, slide: -30 }), i * 105);
        });
        break;

      case 'stance':
        this.synthNote(480, 0.09, { type: 'triangle', volume: 0.022, slide: 160 });
        break;

      case 'bomb':
        this.synthNote(520, 0.16, { type: 'sine', volume: 0.015, slide: -160, filterFreq: 1600 });
        break;

      case 'banner':
        this.synthNote(260, 0.08, { type: 'triangle', volume: 0.012, slide: 90 });
        break;

      default:
        // An unmapped cue is a missing sound design entry, not a feature: say so in dev builds.
        if (import.meta.env?.DEV) console.debug(`[sound] no cue for "${kind}"`);
        this.tone(300, 0.1, 'triangle', 0.02);
        break;
    }
  }

}
