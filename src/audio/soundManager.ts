/**
 * 사운드 매니저
 * - Web Audio API를 사용한 프로그래밍 방식 효과음 생성
 * - 외부 오디오 파일 불필요
 */

export type SoundEffect =
  | 'click'
  | 'notification'
  | 'match_start'
  | 'goal'
  | 'victory'
  | 'defeat'
  | 'draft_pick'
  | 'transfer_complete';

class SoundManager {
  private enabled = true;
  private volume = 0.5;
  private audioCtx: AudioContext | null = null;

  private getCtx(): AudioContext {
    if (!this.audioCtx) this.audioCtx = new AudioContext();
    return this.audioCtx;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getVolume(): number {
    return this.volume;
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
  }

  play(effect: SoundEffect): void {
    if (!this.enabled) return;
    try {
      switch (effect) {
        case 'click':
          this.playTone(800, 0.05);
          break;
        case 'notification':
          this.playTone(600, 0.15, 'sine');
          break;
        case 'match_start':
          this.playChord([440, 554, 659], 0.3);
          break;
        case 'goal':
          this.playTone(880, 0.2, 'square');
          break;
        case 'victory':
          this.playChord([523, 659, 784], 0.5);
          break;
        case 'defeat':
          this.playTone(220, 0.4, 'sawtooth');
          break;
        case 'draft_pick':
          this.playTone(660, 0.1);
          break;
        case 'transfer_complete':
          this.playChord([440, 554], 0.2);
          break;
      }
    } catch {
      /* AudioContext not available */
    }
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine'): void {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = this.volume * 0.3;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  private playChord(freqs: number[], duration: number): void {
    for (const freq of freqs) {
      this.playTone(freq, duration);
    }
  }
}

export const soundManager = new SoundManager();
