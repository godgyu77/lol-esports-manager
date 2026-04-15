import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInboxMessages } from '../engine/inbox/inboxEngine';
import { getMainLoopRiskItems } from '../engine/manager/systemDepthEngine';
import { getLoopRiskActionLabel, getLoopRiskRoute } from '../features/manager/utils/loopRiskRouting';
import { useGameStore } from '../stores/gameStore';

interface CommandItem {
  to: string;
  label: string;
  group: string;
  icon: string;
}

const COMMAND_ITEMS: CommandItem[] = [
  { to: '/manager', label: '대시보드', group: '편지함', icon: 'H' },
  { to: '/manager/inbox', label: '편지함', group: '편지함', icon: '\u2709' },
  { to: '/manager/news', label: '뉴스', group: '편지함', icon: 'N' },
  { to: '/manager/roster', label: '로스터', group: '선수단', icon: 'R' },
  { to: '/manager/tactics', label: '전술', group: '선수단', icon: 'T' },
  { to: '/manager/training', label: '훈련', group: '선수단', icon: 'TR' },
  { to: '/manager/complaints', label: '선수 케어', group: '선수단', icon: 'PC' },
  { to: '/manager/promises', label: '약속 관리', group: '선수단', icon: 'PR' },
  { to: '/manager/schedule', label: '일정', group: '경기 준비', icon: 'S' },
  { to: '/manager/calendar', label: '캘린더', group: '경기 준비', icon: 'C' },
  { to: '/manager/standings', label: '순위표', group: '경기 준비', icon: '#' },
  { to: '/manager/tournament', label: '국제대회', group: '경기 준비', icon: 'INT' },
  { to: '/manager/draft', label: '드래프트', group: '경기 준비', icon: 'D' },
  { to: '/manager/match', label: '경기', group: '경기 준비', icon: 'M' },
  { to: '/manager/transfer', label: '이적 시장', group: '재정', icon: 'TF' },
  { to: '/manager/contract', label: '계약', group: '재정', icon: 'CT' },
  { to: '/manager/finance', label: '재정', group: '재정', icon: '\u20A9' },
  { to: '/manager/staff', label: '스태프', group: '구단', icon: 'ST' },
  { to: '/manager/facility', label: '시설', group: '구단', icon: 'FC' },
  { to: '/manager/board', label: '이사회와 목표', group: '구단', icon: 'BD' },
  { to: '/manager/social', label: '커뮤니티', group: '구단', icon: 'CM' },
  { to: '/manager/scouting', label: '스카우팅', group: '더 보기', icon: 'SC' },
  { to: '/manager/academy', label: '아카데미', group: '더 보기', icon: 'AC' },
  { to: '/manager/compare', label: '비교', group: '더 보기', icon: 'CP' },
  { to: '/manager/stats', label: '통계', group: '더 보기', icon: 'G' },
  { to: '/manager/records', label: '기록실', group: '더 보기', icon: 'RC' },
  { to: '/manager/awards', label: '어워드', group: '더 보기', icon: 'AW' },
  { to: '/manager/analysis', label: '상대 분석', group: '더 보기', icon: 'AN' },
  { to: '/manager/patch-meta', label: '패치 메타', group: '더 보기', icon: 'MT' },
  { to: '/manager/career', label: '커리어', group: '더 보기', icon: 'CR' },
  { to: '/manager/achievements', label: '업적', group: '더 보기', icon: 'ACH' },
  { to: '/manager/team-history', label: '팀 히스토리', group: '더 보기', icon: 'TH' },
  { to: '/settings', label: '설정', group: '시스템', icon: '\u2699' },
  { to: '/save-load', label: '저장 / 불러오기', group: '시스템', icon: '\uD83D\uDCBE' },
];

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const save = useGameStore((s) => s.save);
  const season = useGameStore((s) => s.season);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [featuredCommand, setFeaturedCommand] = useState<CommandItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!save?.userTeamId) return;

    let cancelled = false;
    const loadFeaturedCommand = async () => {
      try {
        const [inboxMessages, loopRisks] = await Promise.all([
          getInboxMessages(save.userTeamId, 12, false).catch(() => []),
          save.currentSeasonId && season?.currentDate
            ? getMainLoopRiskItems(save.userTeamId, save.currentSeasonId, season.currentDate, save.id).catch(() => [])
            : Promise.resolve([]),
        ]);
        if (cancelled) return;

        const latestMatchFollowUp =
          inboxMessages.find((message) => message.relatedId?.startsWith('match_result:') || message.title.startsWith('[경기 결과]')) ?? null;
        const topLoopRisk = loopRisks[0] ?? null;
        setFeaturedCommand(
          latestMatchFollowUp
            ? {
                to: latestMatchFollowUp.actionRoute ?? '/manager/inbox',
                label: '방금 경기 정리',
                group: '즉시 행동',
                icon: 'PM',
              }
            : topLoopRisk
              ? {
                  to: getLoopRiskRoute(topLoopRisk.title, topLoopRisk.summary),
                  label: getLoopRiskActionLabel(topLoopRisk.title),
                  group: '즉시 행동',
                  icon: topLoopRisk.title.includes('보드') ? '₩' : 'PM',
                }
            : null,
        );
      } catch {
        if (!cancelled) setFeaturedCommand(null);
      }
    };

    void loadFeaturedCommand();
    return () => {
      cancelled = true;
    };
  }, [save?.currentSeasonId, save?.id, save?.userTeamId, season?.currentDate]);

  const availableItems = featuredCommand ? [featuredCommand, ...COMMAND_ITEMS] : COMMAND_ITEMS;

  const filtered = query.trim()
    ? availableItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.group.toLowerCase().includes(query.toLowerCase()))
    : availableItems;

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- palette open resets transient UI state
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- query change should reset active row
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = useCallback((item: CommandItem) => {
    navigate(item.to);
    onClose();
  }, [navigate, onClose]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex]);
    } else if (event.key === 'Escape') {
      onClose();
    }
  }, [filtered, selectedIndex, handleSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={(event) => event.stopPropagation()}>
        <div className="cmd-input-wrap">
          <span className="cmd-input-icon">{'\u{1F50D}'}</span>
          <input
            ref={inputRef}
            className="cmd-input"
            type="text"
            placeholder="메뉴 검색... (Ctrl+K)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="cmd-list">
          {filtered.length === 0 ? (
            <div className="cmd-empty">검색 결과가 없습니다.</div>
          ) : (
            filtered.map((item, index) => (
              <div
                key={item.to}
                className={`cmd-item ${index === selectedIndex ? 'cmd-item--active' : ''}`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="cmd-item-icon">{item.icon}</span>
                <span className="cmd-item-label">{item.label}</span>
                <span className="cmd-item-group">{item.group}</span>
              </div>
            ))
          )}
        </div>
        <div className="cmd-footer">
          <span>↑↓ 이동</span>
          <span>↵ 선택</span>
          <span>Esc 닫기</span>
        </div>
      </div>
    </div>
  );
}
