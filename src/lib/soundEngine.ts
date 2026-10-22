/**
 * WETWARE // NEURAL OVERCLOCK — Web Audio API Procedural FM/PC-98 Sound Engine
 * Zero external audio assets. Synthesizes all telemetry clicks, arpeggios, and sub-bass drops in real time.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private chunkTickEnabled: boolean = true;
  private masterVolume: number = 0.35;

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (!this.muted) {
      this.playUiClick();
    }
    return this.muted;
  }

  public isChunkTickEnabled(): boolean {
    return this.chunkTickEnabled;
  }

  public setChunkTickEnabled(enabled: boolean): void {
    this.chunkTickEnabled = enabled;
  }

  public setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  /**
   * 1. チャンク移動時: 極小のローパス・クリック音（800 Hz 短パルス、ON/OFF切替可）
   * 逆接・結論マーカー（discourseMarker）時はわずかにピッチを上げて注意喚起
   */
  public playChunkTick(isDiscourseMarker: boolean = false): void {
    if (!this.chunkTickEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = isDiscourseMarker ? 'triangle' : 'sine';
    const baseFreq = isDiscourseMarker ? 1080 : 800;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.022);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isDiscourseMarker ? 1800 : 1100, now);

    const peakGain = (isDiscourseMarker ? 0.22 : 0.14) * this.masterVolume;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.024);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.026);
  }

  /**
   * 2. クイズ正解時: アルペジオ上昇チャイム（C5 -> E5 -> G5 -> C6 の矩形波＋ディレイ）
   * 3秒以内のクリティカル正解時はさらに高域のFM倍音とG6/C7スパークルを追加
   */
  public playQuizCorrect(isCritical: boolean = false): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
    const notes = isCritical
      ? [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98]
      : [523.25, 659.25, 783.99, 1046.5];

    const stepSec = isCritical ? 0.055 : 0.068;

    // Create feedback echo delay bus (PC-98 FM synth style stereo/echo tail)
    const delay = ctx.createDelay();
    delay.delayTime.setValueAtTime(0.14, now);
    const feedback = ctx.createGain();
    feedback.gain.setValueAtTime(0.28, now);
    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.setValueAtTime(2800, now);

    delay.connect(delayFilter);
    delayFilter.connect(feedback);
    feedback.connect(delay);
    delay.connect(ctx.destination);

    notes.forEach((freq, idx) => {
      const start = now + idx * stepSec;
      const duration = idx === notes.length - 1 ? 0.34 : 0.14;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, start);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3600, start);

      const noteGain = 0.22 * this.masterVolume;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(noteGain, start + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      gain.connect(delay);

      osc.start(start);
      osc.stop(start + duration + 0.02);
    });
  }

  /**
   * クイズ不正解時: 神経同期エラー（DESYNC）FMブザー音
   */
  public playQuizWrong(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [185.0, 130.81]; // F#3 -> C3 tritone drop

    freqs.forEach((freq, idx) => {
      const start = now + idx * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.linearRampToValueAtTime(freq * 0.92, start + 0.14);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(950, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.26 * this.masterVolume, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.17);
    });
  }

  /**
   * 3. ランク確定時: 重低音サブベース・ドロップ＋高速カウントアップ音＋ロックオン和音
   */
  public playRankConfirm(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Part A: Sub-bass Drop (120Hz -> 34Hz sine + triangle layer)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(125, now);
    subOsc.frequency.exponentialRampToValueAtTime(34, now + 0.65);

    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.55 * this.masterVolume, now + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.75);

    // Part B: High-speed telemetry count-up ticks (12 rapid pulses)
    const tickCount = 12;
    for (let i = 0; i < tickCount; i++) {
      const t = now + 0.05 + i * 0.036;
      const tickOsc = ctx.createOscillator();
      const tickGain = ctx.createGain();

      tickOsc.type = 'square';
      tickOsc.frequency.setValueAtTime(880 + i * 95, t);

      tickGain.gain.setValueAtTime(0.0001, t);
      tickGain.gain.linearRampToValueAtTime(0.14 * this.masterVolume, t + 0.002);
      tickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);

      tickOsc.connect(tickGain);
      tickGain.connect(ctx.destination);

      tickOsc.start(t);
      tickOsc.stop(t + 0.025);
    }

    // Part C: Final Jackpot Lock Chord at t + 0.52s
    const chordStart = now + 0.52;
    const chordNotes = [523.25, 783.99, 1046.5, 1567.98];
    chordNotes.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, chordStart);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(4200, chordStart);

      gain.gain.setValueAtTime(0.0001, chordStart);
      gain.gain.linearRampToValueAtTime(0.16 * this.masterVolume, chordStart + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, chordStart + 0.45);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(chordStart);
      osc.stop(chordStart + 0.48);
    });
  }

  /**
   * ゴースト追い抜き（Overtake）演出用スパーク音
   */
  public playOvertakeSpark(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(960, now);
    osc.frequency.exponentialRampToValueAtTime(2560, now + 0.09);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.18 * this.masterVolume, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  /**
   * 4/3/2 OVERCLOCK フェーズ移行時のギアシフト音
   */
  public playPassTransition(passNumber: 1 | 2 | 3): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const baseFreq = passNumber === 1 ? 440 : passNumber === 2 ? 587.33 : 880;

    [baseFreq, baseFreq * 1.5].forEach((freq, idx) => {
      const start = now + idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.2 * this.masterVolume, start + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.13);
    });
  }

  /**
   * PC-98 ターミナルUI操作クリック音
   */
  public playUiClick(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(1680, now);
    osc.frequency.exponentialRampToValueAtTime(840, now + 0.012);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.12 * this.masterVolume, now + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.014);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.016);
  }

  /**
   * 自己ベスト更新・マスター達成時のド派手なFMシンセ・ジャックポット・ファンファーレ
   */
  public playRecordBreakerFanfare(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Triumphal ascending synth brass fanfare (C5 -> E5 -> G5 -> B5 -> C6 -> E6 -> G6)
    const fanfareNotes = [
      { freq: 523.25, offset: 0.0, dur: 0.11 },
      { freq: 659.25, offset: 0.08, dur: 0.11 },
      { freq: 783.99, offset: 0.16, dur: 0.11 },
      { freq: 987.77, offset: 0.24, dur: 0.14 },
      { freq: 1046.5, offset: 0.34, dur: 0.18 },
      { freq: 1318.51, offset: 0.44, dur: 0.22 },
      { freq: 1567.98, offset: 0.54, dur: 0.55 },
    ];

    fanfareNotes.forEach(({ freq, offset, dur }) => {
      const start = now + offset;
      const osc = ctx.createOscillator();
      const sub = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);

      sub.type = 'square';
      sub.frequency.setValueAtTime(freq * 0.5, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.24 * this.masterVolume, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.connect(gain);
      sub.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      sub.start(start);
      osc.stop(start + dur + 0.02);
      sub.stop(start + dur + 0.02);
    });
  }
}

export const soundEngine = new SoundEngine();
