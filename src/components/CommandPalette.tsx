/**
 * 커맨드 팔레트 (Ctrl+K)
 * - VS Code/Notion 스타일 검색 + 네비게이션
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface CommandItem {
  to: string;
  label: string;
  group: string;
  icon: string;
}

const COMMAND_ITEMS: CommandItem[] = [
  { to: '/manager', label: '대시보드', group: 'Home', icon: 'H' },
  { to: '/manager/inbox', label: '편지함', group: 'Home', icon: '\u2709' },
  { to: '/manager/news', label: '뉴스', group: 'Home', icon: 'N' },
  { to: '/manager/roster', label: '로스터', group: 'Squad', icon: 'R' },
  { to: '/manager/tactics', label: '전술', group: 'Squad', icon: 'T' },
  { to: '/manager/training', label: '훈련', group: 'Squad', icon: 'TR' },
  { to: '/manager/complaints', label: '선수 관리', group: 'Squad', icon: 'PM' },
  { to: '/manager/promises', label: '약속 관리', group: 'Squad', icon: 'PR' },
  { to: '/manager/schedule', label: '일정', group: 'Matches', icon: 'S' },
  { to: '/manager/calendar', label: '캘린더', group: 'Matches', icon: 'C' },
  { to: '/manager/standings', label: '순위표', group: 'Matches', icon: '#' },
  { to: '/manager/tournament', label: '국제대회', group: 'Matches', icon: 'W' },
  { to: '/manager/draft', label: '밴픽', group: 'Matches', icon: 'D' },
  { to: '/manager/match', label: '경기', group: 'Matches', icon: 'M' },
  { to: '/manager/scouting', label: '스카우팅', group: 'Scouting', icon: 'SC' },
  { to: '/manager/academy', label: '아카데미', group: 'Scouting', icon: 'AC' },
  { to: '/manager/compare', label: '선수 비교', group: 'Scouting', icon: 'CP' },
  { to: '/manager/transfer', label: '이적 시장', group: 'Finance', icon: 'TF' },
  { to: '/manager/contract', label: '계약', group: 'Finance', icon: 'CT' },
  { to: '/manager/finance', label: '재정', group: 'Finance', icon: '\u20A9' },
  { to: '/manager/staff', label: '스태프', group: 'Club', icon: 'ST' },
  { to: '/manager/facility', label: '시설', group: 'Club', icon: 'FC' },
  { to: '/manager/board', label: '구단', group: 'Club', icon: 'BD' },
  { to: '/manager/social', label: '커뮤니티', group: 'Club', icon: 'CM' },
  { to: '/manager/stats', label: '통계', group: 'Info', icon: 'G' },
  { to: '/manager/records', label: '기록실', group: 'Info', icon: 'RC' },
  { to: '/manager/awards', label: '어워드', group: 'Info', icon: 'AW' },
  { to: '/manager/analysis', label: '상대 분석', group: 'Info', icon: 'AN' },
  { to: '/manager/patch-meta', label: '패치 메타', group: 'Info', icon: 'MT' },
  { to: '/manager/career', label: '커리어', group: 'Info', icon: 'CR' },
  { to: '/manager/achievements', label: '업적', group: 'Info', icon: 'AC' },
  { to: '/manager/team-history', label: '팀 히스토리', group: 'Info', icon: 'TH' },
  { to: '/settings', label: '설정', group: 'System', icon: '\u2699' },
  { to: '/save-load', label: '저장/불러오기', group: 'System', icon: '\uD83D\uDCBE' },
];

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? COMMAND_ITEMS.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.group.toLowerCase().includes(query.toLowerCase())
      )
    : COMMAND_ITEMS;

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 열릴 때 초기화
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = useCallback((item: CommandItem) => {
    navigate(item.to);
    onClose();
  }, [navigate, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filtered, selectedIndex, handleSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-input-wrap">
          <span className="cmd-input-icon">{'\u{1F50D}'}</span>
          <input
            ref={inputRef}
            className="cmd-input"
            type="text"
            placeholder="메뉴 검색... (Ctrl+K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="cmd-list">
          {filtered.length === 0 ? (
            <div className="cmd-empty">검색 결과가 없습니다</div>
          ) : (
            filtered.map((item, i) => (
              <div
                key={item.to}
                className={`cmd-item ${i === selectedIndex ? 'cmd-item--active' : ''}`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="cmd-item-icon">{item.icon}</span>
                <span className="cmd-item-label">{item.label}</span>
                <span className="cmd-item-group">{item.group}</span>
              </div>
            ))
          )}
        </div>
        <div className="cmd-footer">
          <span>\u2191\u2193 \uc774\ub3d9</span>
          <span>\u23CE \uc120\ud0dd</span>
          <span>Esc \ub2eb\uae30</span>
        </div>
      </div>
    </div>
  );
}
