// Procedural Web Audio API Sound Synthesizer for Authentic Fortnite Sound Effects
class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.chestOsc = null;
    this.chestGain = null;
    this.initAudio();
  }

  initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Web Audio not supported:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Helper to create noise buffer
  createNoiseBuffer(duration = 0.5) {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // 1. Battle Bus Horn
  playBusHorn() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.8);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.8);
  }

  // 2. Glider Deploy Swoosh
  playGliderDeploy() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.6);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(1800, t + 0.2);
    filter.frequency.exponentialRampToValueAtTime(600, t + 0.6);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(t);
  }

  // 3. Assault Rifle (Scar/M4) Gunfire - crisp and punchy
  playAssaultRifle() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;

    // Transient attack click
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.08);
    oscGain.gain.setValueAtTime(0.5, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.08);

    // Blast noise
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.18);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(t);
  }

  // 4. Pump Shotgun - Heavy bass boom + pump slide
  playPumpShotgun() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;

    // Deep sub-bass boom
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(140, t);
    sub.frequency.exponentialRampToValueAtTime(30, t + 0.25);
    subGain.gain.setValueAtTime(0.7, t);
    subGain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(t);
    sub.stop(t + 0.25);

    // Heavy shotgun blast noise
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.3);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.3);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(t);

    // Pump slide click after 0.4s
    setTimeout(() => {
      if (!this.ctx) return;
      const t2 = this.ctx.currentTime;
      const click = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();
      click.type = 'square';
      click.frequency.setValueAtTime(800, t2);
      click.frequency.exponentialRampToValueAtTime(400, t2 + 0.06);
      clickGain.gain.setValueAtTime(0.15, t2);
      clickGain.gain.exponentialRampToValueAtTime(0.01, t2 + 0.06);
      click.connect(clickGain);
      clickGain.connect(this.masterGain);
      click.start(t2);
      click.stop(t2 + 0.06);
    }, 380);
  }

  // 5. Bolt Sniper Shot - high velocity echo crack
  playSniperShot() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.4);
    oscGain.gain.setValueAtTime(0.7, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.4);

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.8);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(t);
  }

  // 6. Pickaxe Swing & Impact
  playPickaxeSwing() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.15);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(1600, t + 0.08);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(t);
  }

  playHarvestHit(material = 'wood') {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (material === 'wood') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
    } else if (material === 'stone') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(450, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.1);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    } else {
      // metal
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.15);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    }

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // 7. Weakpoint Hit Chime (Double damage satisfying ding!)
  playWeakpointHit() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046, t); // C6
    osc.frequency.exponentialRampToValueAtTime(1318, t + 0.15); // E6
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // 8. Building Placement Snap
  playBuildPlacement() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.08);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  // 9. Hitmarker Tick / Headshot Ding
  playHitMarker(isHeadshot = false) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (isHeadshot) {
      // Golden headshot ping
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, t); // A6
      osc.frequency.exponentialRampToValueAtTime(2200, t + 0.1);
      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      osc.start(t);
      osc.stop(t + 0.2);
    } else {
      // Body hitmarker tick
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(400, t + 0.05);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
      osc.start(t);
      osc.stop(t + 0.06);
    }

    osc.connect(gain);
    gain.connect(this.masterGain);
  }

  // 10. Shield Break Glass Crack
  playShieldBreak() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.35);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2500, t);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(t);
  }

  // 11. Chest Open Chime & Loot Pop
  playChestOpen() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.25, t + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.07 + 0.3);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 0.3);
    });
  }

  // 12. Potion Drink / Slurp
  playPotionDrink() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.3);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  // 13. Storm Siren / Warning
  playStormWarning() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.linearRampToValueAtTime(320, t + 0.6);
    osc.frequency.linearRampToValueAtTime(200, t + 1.2);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 1.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 1.2);
  }

  // 14. #1 VICTORY ROYALE Epic Fanfare!
  playVictoryRoyale() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    // Epic victory chords: F, G, A, C, D
    const melody = [
      { f: 349.23, d: 0.25, time: 0 },
      { f: 392.00, d: 0.25, time: 0.25 },
      { f: 440.00, d: 0.25, time: 0.5 },
      { f: 523.25, d: 0.4,  time: 0.75 },
      { f: 587.33, d: 0.8,  time: 1.15 }
    ];

    melody.forEach(note => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = note.f;

      gain.gain.setValueAtTime(0.4, t + note.time);
      gain.gain.exponentialRampToValueAtTime(0.01, t + note.time + note.d);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + note.time);
      osc.stop(t + note.time + note.d);
    });
  }

  // 15. Weapon Reload Sound
  playReload() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    // Mag out click
    const click1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    click1.type = 'triangle';
    click1.frequency.setValueAtTime(600, t);
    click1.frequency.exponentialRampToValueAtTime(300, t + 0.08);
    gain1.gain.setValueAtTime(0.3, t);
    gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    click1.connect(gain1);
    gain1.connect(this.masterGain);
    click1.start(t);
    click1.stop(t + 0.08);

    // Mag in click after 0.5s
    setTimeout(() => {
      if (!this.ctx) return;
      const t2 = this.ctx.currentTime;
      const click2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      click2.type = 'square';
      click2.frequency.setValueAtTime(450, t2);
      click2.frequency.exponentialRampToValueAtTime(750, t2 + 0.1);
      gain2.gain.setValueAtTime(0.35, t2);
      gain2.gain.exponentialRampToValueAtTime(0.01, t2 + 0.1);
      click2.connect(gain2);
      gain2.connect(this.masterGain);
      click2.start(t2);
      click2.stop(t2 + 0.1);
    }, 500);
  }

  // 16. Footstep Grass Thud
  playFootstep() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.08);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, t);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(t);
  }

  // 17. Fortnite Emote Dance Track (Upbeat retro synth funk)
  playEmoteMusic() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const notes = [
      { f: 261.63, d: 0.18, time: 0 },
      { f: 329.63, d: 0.18, time: 0.2 },
      { f: 392.00, d: 0.18, time: 0.4 },
      { f: 493.88, d: 0.35, time: 0.6 },
      { f: 440.00, d: 0.18, time: 0.95 },
      { f: 392.00, d: 0.35, time: 1.15 }
    ];

    notes.forEach(note => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = note.f;
      gain.gain.setValueAtTime(0.25, t + note.time);
      gain.gain.exponentialRampToValueAtTime(0.01, t + note.time + note.d);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + note.time);
      osc.stop(t + note.time + note.d);
    });
  }
}

export const soundManager = new SoundSynthesizer();
