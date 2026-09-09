/**
 * GRIDBOUND — UNDERWORLD PROCEDURAL AUDIO SYNTHESIZER (HADES SOUNDSCAPE)
 * Multi-oscillator synthesis with dynamic ADSR envelopes, resonant biquad filtering,
 * tactile UI metal clinks, visceral combat impact crunches, and atmospheric dark drones.
 */

export class Sound {
  enabled = true;
  private ctx?: AudioContext;
  private last = 0;
  private nextMusic = 0;
  private note = 0;
  private ambientOsc?: OscillatorNode;
  private ambientGain?: GainNode;

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
    const bufferSize = Math.floor(c.sampleRate * duration);
    if (bufferSize <= 0) return;

    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, c.currentTime);

    const gain = c.createGain();
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);

    noise.start();
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

  /** Main event dispatcher matching simulation & UI hooks */
  play(kind: string) {
    const now = performance.now();
    if (kind === 'projectile' && now - this.last < 65) return;
    this.last = now;

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

      case 'shield':
        this.synthNote(340, 0.22, { type: 'triangle', volume: 0.02, slide: 260 });
        this.synthNote(680, 0.18, { type: 'sine', volume: 0.015, slide: 140 });
        break;

      case 'heal':
      case 'buff':
        [523, 659, 784].forEach((n, i) => {
          setTimeout(() => this.synthNote(n, 0.2, { type: 'sine', volume: 0.015, attack: 0.01 }), i * 50);
        });
        break;

      case 'warning':
        // Menacing tritone horn
        this.synthNote(130, 0.45, { type: 'sawtooth', volume: 0.025, filterFreq: 600 });
        this.synthNote(185, 0.45, { type: 'sawtooth', volume: 0.02, filterFreq: 750 });
        break;

      case 'impact':
      case 'claw':
        this.synthNote(75, 0.28, { type: 'sawtooth', volume: 0.035, slide: -45 });
        this.noiseBurst(0.12, 0.028, 800, 'lowpass');
        break;

      case 'hurt':
        this.synthNote(110, 0.18, { type: 'sawtooth', volume: 0.025, slide: -50 });
        this.noiseBurst(0.08, 0.02, 600, 'lowpass');
        break;

      case 'projectile':
        this.synthNote(280, 0.09, { type: 'triangle', volume: 0.015, slide: -180 });
        break;

      case 'coin':
        this.synthNote(1100, 0.12, { type: 'square', volume: 0.01, slide: 280 });
        this.synthNote(1650, 0.15, { type: 'sine', volume: 0.008 });
        break;

      case 'ultimate':
        // Ninefold Dawn triumphant fanfare chords
        [220, 277, 330, 440, 554, 660].forEach((n, i) => {
          setTimeout(() => this.synthNote(n, 0.65, { type: 'triangle', volume: 0.035, attack: 0.02 }), i * 75);
        });
        this.noiseBurst(0.35, 0.025, 1800, 'bandpass');
        break;

      case 'victory':
        [262, 330, 392, 523, 659].forEach((n, i) => {
          setTimeout(() => this.synthNote(n, 0.55, { type: 'triangle', volume: 0.03, attack: 0.015 }), i * 110);
        });
        break;

      case 'defeat':
        [196, 174, 155, 130].forEach((n, i) => {
          setTimeout(() => this.synthNote(n, 0.65, { type: 'sawtooth', volume: 0.025, slide: -30 }), i * 140);
        });
        break;

      case 'stance':
        this.synthNote(480, 0.09, { type: 'triangle', volume: 0.022, slide: 160 });
        break;

      default:
        this.tone(300, 0.1, 'triangle', 0.02);
        break;
    }
  }

  /** Ambient Underworld melody and sub-drone */
  music(active: boolean) {
    if (!active || !this.enabled) {
      if (this.ambientOsc) {
        try {
          this.ambientOsc.stop();
          this.ambientOsc.disconnect();
        } catch { /* cleanup */ }
        this.ambientOsc = undefined;
        this.ambientGain = undefined;
      }
      return;
    }

    const now = performance.now();
    if (now < this.nextMusic) return;
    this.nextMusic = now + 520;

    const melody = [147, 0, 220, 0, 196, 0, 165, 0, 131, 0, 196, 0, 220, 0, 165, 196];
    const n = melody[this.note++ % melody.length];
    if (n) {
      this.synthNote(n, 0.5, { type: 'triangle', volume: 0.01, attack: 0.02 });
    }
    if (this.note % 4 === 0) {
      this.synthNote(73, 0.45, { type: 'sine', volume: 0.02, attack: 0.03 });
    }
  }
}
