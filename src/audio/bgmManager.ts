/**
 * BGM 매니저
 * - 장면별 배경음악 자동 전환
 * - 크로스페이드 (페이드아웃 → 페이드인)
 * - 볼륨 조절, 루프 재생
 * - public/audio/ 폴더의 음악 파일 사용
 */

export type BgmScene = 'menu' | 'game' | 'match' | 'draft' | 'season_end' | 'victory' | 'defeat';

/** 장면별 BGM 파일 매핑 (public/audio/ 기준) */
const SCENE_TRACKS: Record<BgmScene, string[]> = {
  menu: ['/audio/menu_bgm.mp3'],
  game: ['/audio/game_bgm_1.mp3', '/audio/game_bgm_2.mp3', '/audio/game_bgm_3.mp3'],
  match: ['/audio/match_bgm.mp3'],
  draft: ['/audio/draft_bgm.mp3'],
  season_end: ['/audio/season_end_bgm.mp3'],
  victory: ['/audio/victory_bgm.mp3'],
  defeat: ['/audio/defeat_bgm.mp3'],
};

/** 장면별 기본 볼륨 배율 */
const SCENE_VOLUME: Record<BgmScene, number> = {
  menu: 0.6,
  game: 0.3,
  match: 0.5,
  draft: 0.4,
  season_end: 0.5,
  victory: 0.7,
  defeat: 0.5,
};

const FADE_DURATION = 1500; // ms

class BgmManager {
  private currentAudio: HTMLAudioElement | null = null;
  private currentScene: BgmScene | null = null;
  private masterVolume = 0.5;
  private enabled = true;
  private fadeInterval: ReturnType<typeof setInterval> | null = null;
  private trackIndex = 0;
  private failedTracks = new Set<string>();

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) {
      this.stop();
    }
  }

  setVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.currentAudio && this.currentScene) {
      this.currentAudio.volume = this.masterVolume * (SCENE_VOLUME[this.currentScene] ?? 0.5);
    }
  }

  getVolume(): number {
    return this.masterVolume;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getCurrentScene(): BgmScene | null {
    return this.currentScene;
  }

  /**
   * 장면 전환 — 크로스페이드로 BGM 변경
   */
  async changeScene(scene: BgmScene): Promise<void> {
    if (scene === this.currentScene) return;
    if (!this.enabled) {
      this.currentScene = scene;
      return;
    }

    // 이전 BGM 페이드아웃
    if (this.currentAudio) {
      await this.fadeOut();
    }

    this.currentScene = scene;
    this.trackIndex = 0;

    // 새 BGM 재생
    await this.playTrack(scene);
  }

  /**
   * 현재 장면의 다음 트랙 재생 (게임 중 BGM 변경)
   */
  async nextTrack(): Promise<void> {
    if (!this.currentScene) return;
    const tracks = SCENE_TRACKS[this.currentScene];
    if (tracks.length <= 1) return;

    this.trackIndex = (this.trackIndex + 1) % tracks.length;
    await this.fadeOut();
    await this.playTrack(this.currentScene);
  }

  stop(): void {
    this.clearFade();
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = '';
      this.currentAudio = null;
    }
  }

  private async playTrack(scene: BgmScene): Promise<void> {
    const tracks = SCENE_TRACKS[scene];
    if (!tracks || tracks.length === 0) return;

    const trackPath = tracks[this.trackIndex % tracks.length];
    if (this.failedTracks.has(trackPath)) return; // 이전에 실패한 트랙 스킵
    const sceneVol = SCENE_VOLUME[scene] ?? 0.5;

    try {
      const audio = new Audio(trackPath);
      audio.loop = true;
      audio.volume = 0; // 페이드인 시작

      // 파일 로드 실패 시 무시 (1회만 로그)
      audio.onerror = () => {
        if (!this.failedTracks.has(trackPath)) {
          this.failedTracks.add(trackPath);
          console.warn(`[BGM] 트랙 로드 실패 (파일 없음): ${trackPath}`);
        }
      };

      // 트랙 끝나면 다음 트랙 (loop가 true이므로 보통 안 옴)
      audio.onended = () => {
        if (tracks.length > 1) {
          this.trackIndex = (this.trackIndex + 1) % tracks.length;
          this.playTrack(scene);
        }
      };

      this.currentAudio = audio;
      await audio.play().catch(() => {
        // 사용자 인터랙션 전 자동재생 차단 — 다음 클릭 시 재시도
        const resumeOnClick = () => {
          audio.play().catch(() => {});
          document.removeEventListener('click', resumeOnClick);
        };
        document.addEventListener('click', resumeOnClick, { once: true });
      });

      // 페이드인
      await this.fadeIn(sceneVol);
    } catch (e) {
      console.warn('[BGM] 재생 실패:', e);
    }
  }

  private fadeIn(targetVolume: number): Promise<void> {
    return new Promise((resolve) => {
      this.clearFade();
      if (!this.currentAudio) { resolve(); return; }

      const audio = this.currentAudio;
      const target = this.masterVolume * targetVolume;
      const step = target / (FADE_DURATION / 50);
      let vol = 0;

      this.fadeInterval = setInterval(() => {
        vol += step;
        if (vol >= target) {
          audio.volume = target;
          this.clearFade();
          resolve();
        } else {
          audio.volume = vol;
        }
      }, 50);
    });
  }

  private fadeOut(): Promise<void> {
    return new Promise((resolve) => {
      this.clearFade();
      if (!this.currentAudio) { resolve(); return; }

      const audio = this.currentAudio;
      const startVol = audio.volume;
      const step = startVol / (FADE_DURATION / 50);

      this.fadeInterval = setInterval(() => {
        const newVol = audio.volume - step;
        if (newVol <= 0.01) {
          audio.volume = 0;
          audio.pause();
          audio.src = '';
          this.currentAudio = null;
          this.clearFade();
          resolve();
        } else {
          audio.volume = newVol;
        }
      }, 50);
    });
  }

  private clearFade(): void {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
  }
}

export const bgmManager = new BgmManager();
