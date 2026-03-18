/**
 * 로딩 스켈레톤 컴포넌트
 * - shimmer 애니메이션으로 로딩 상태를 시각적으로 표현
 */

export function Skeleton({
  width,
  height,
  variant = 'rect',
}: {
  width?: string;
  height?: string;
  variant?: 'text' | 'rect' | 'circle';
}) {
  return (
    <div
      className="skeleton-shimmer"
      style={{
        width: width ?? '100%',
        height: height ?? '16px',
        background: 'linear-gradient(90deg, #1a1a2e 25%, #2a2a4a 50%, #1a1a2e 75%)',
        backgroundSize: '200% 100%',
        borderRadius: variant === 'circle' ? '50%' : variant === 'text' ? '4px' : '8px',
      }}
    />
  );
}

export function SkeletonTable({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '4px' }}>
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={`h-${c}`} width={`${100 / cols}%`} height="14px" variant="text" />
        ))}
      </div>
      {/* 행 */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`r-${r}`} style={{ display: 'flex', gap: '12px' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={`r-${r}-c-${c}`} width={`${100 / cols}%`} height="16px" variant="text" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({
  count = 4,
}: {
  count?: number;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid #2a2a4a',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <Skeleton width="60%" height="12px" variant="text" />
          <Skeleton width="40%" height="24px" variant="text" />
          <Skeleton width="80%" height="12px" variant="text" />
        </div>
      ))}
    </div>
  );
}
