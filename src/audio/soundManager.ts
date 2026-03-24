/**
 * 효과음 매니저
 * - Web Audio API를 사용한 프로그래밍 방식 효과음 생성
 * - 외부 오디오 파일 불필요
 * - 게임 이벤트별 특화된 사운드
 */

export type SoundEffect =
  | 'click'
  | 'hover'
  | 'notification'
  | 'match_start'
  | 'goal'
  | 'kill'
  | 'dragon'
  | 'baron'
  | 'tower'
  | 'victory'
  | 'defeat'
  | 'draft_pick'
  | 'draft_ban'
  | 'transfer_complete'
  | 'level_up'
  | 'error'
  | 'countdown'
  | 'whistle';

class SoundManager {
  private enabled = true;
  private volume = 0.5;
  private audioCtx: AudioContext | null = null;

  private getCtx(): AudioContext {
    if (!this.audioCtx) this.audioCtx = new AudioContext();
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
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
          this.playTone(800, 0.04, 'sine', 0.2);
          break;
        case 'hover':
          this.playTone(600, 0.02, 'sine', 0.08);
          break;
        case 'notification':
          this.playSequence([660, 880], 0.1, 'sine', 0.15);
          break;
        case 'match_start':
          this.playSequence([440, 554, 659, 880], 0.15, 'sine', 0.3);
          break;
        case 'goal':
        case 'kill':
          this.playTone(880, 0.12, 'square', 0.2);
          setTimeout(() => this.playTone(1100, 0.1, 'square', 0.15), 80);
          break;
        case 'dragon':
          this.playSequence([330, 440, 554], 0.2, 'sawtooth', 0.2);
          break;
        case 'baron':
          this.playChord([220, 330, 440, 554], 0.5, 0.25);
          break;
        case 'tower':
          this.playTone(200, 0.3, 'square', 0.2);
          break;
        case 'victory':
          this.playSequence([523, 659, 784, 1047], 0.2, 'sine', 0.3);
          break;
        case 'defeat':
          this.playSequence([440, 370, 330, 220], 0.25, 'sawtooth', 0.2);
          break;
        case 'draft_pick':
          this.playTone(660, 0.08, 'sine', 0.2);
          setTimeout(() => this.playTone(880, 0.06, 'sine', 0.15), 60);
          break;
        case 'draft_ban':
          this.playTone(330, 0.15, 'square', 0.2);
          break;
        case 'transfer_complete':
          this.playSequence([440, 554, 660], 0.12, 'sine', 0.2);
          break;
        case 'level_up':
          this.playSequence([523, 659, 784], 0.1, 'sine', 0.25);
          break;
        case 'error':
          this.playTone(200, 0.2, 'square', 0.2);
          setTimeout(() => this.playTone(180, 0.2, 'square', 0.15), 150);
          break;
        case 'countdown':
          this.playTone(440, 0.08, 'sine', 0.2);
          break;
        case 'whistle':
          this.playTone(1200, 0.3, 'sine', 0.2);
          setTimeout(() => this.playTone(1400, 0.15, 'sine', 0.15), 200);
          break;
      }
    } catch {
      /* AudioContext not available */
    }
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.3): void {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = this.volume * vol;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  private playChord(freqs: number[], duration: number, vol = 0.3): void {
    for (const freq of freqs) {
      this.playTone(freq, duration, 'sine', vol / freqs.length);
    }
  }

  private playSequence(freqs: number[], noteDuration: number, type: OscillatorType = 'sine', vol = 0.3): void {
    freqs.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, noteDuration, type, vol), i * (noteDuration * 800));
    });
  }
}

export const soundManager = new SoundManager();
