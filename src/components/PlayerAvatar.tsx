/**
 * 선수 아바타 아이콘
 * - 포지션별 색상 + 포지션 약자 또는 이름 이니셜
 * - 국적 이모지 표시
 */

import type { Position } from '../types/game';

interface PlayerAvatarProps {
  position: Position;
  nationality?: string;
  size?: number; // px, 기본 40
  name?: string;
}

const posColors: Record<Position, string> = {
  top: '#e74c3c',
  jungle: '#2ecc71',
  mid: '#3498db',
  adc: '#f39c12',
  support: '#9b59b6',
};

const posLabels: Record<Position, string> = {
  top: 'T',
  jungle: 'J',
  mid: 'M',
  adc: 'A',
  support: 'S',
};

const flagMap: Record<string, string> = {
  KR: '\u{1F1F0}\u{1F1F7}',
  CN: '\u{1F1E8}\u{1F1F3}',
  US: '\u{1F1FA}\u{1F1F8}',
  EU: '\u{1F1EA}\u{1F1FA}',
  JP: '\u{1F1EF}\u{1F1F5}',
  TW: '\u{1F1F9}\u{1F1FC}',
  VN: '\u{1F1FB}\u{1F1F3}',
};

export function PlayerAvatar({ position, nationality, size = 40, name }: PlayerAvatarProps) {
  const color = posColors[position];

  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${color}40, ${color}20)`,
        border: `2px solid ${color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.35,
        fontWeight: 800,
        color: color,
        position: 'relative',
      }}
    >
      {name ? name.charAt(0).toUpperCase() : posLabels[position]}
      {nationality && flagMap[nationality] && (
        <span
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            fontSize: size * 0.3,
            lineHeight: 1,
          }}
        >
          {flagMap[nationality]}
        </span>
      )}
    </div>
  );
}
