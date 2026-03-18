import type { Region } from './game';
import type { Player } from './player';

export type PlayStyle = 'aggressive' | 'controlled' | 'split';

export interface Team {
  id: string;
  name: string;
  shortName: string;
  region: Region;
  budget: number;
  salaryCap: number;
  reputation: number; // 0-100
  roster: Player[];
  playStyle: PlayStyle;
}
