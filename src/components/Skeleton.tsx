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
        background: 'linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-elevated) 50%, var(--bg-tertiary) 75%)',
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
    <div className="fm-flex-col fm-gap-sm">
      {/* 헤더 */}
      <div className="fm-flex fm-gap-md fm-mb-sm">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={`h-${c}`} width={`${100 / cols}%`} height="14px" variant="text" />
        ))}
      </div>
      {/* 행 */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`r-${r}`} className="fm-flex fm-gap-md">
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
    <div className="fm-grid fm-grid--auto">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="fm-card fm-flex-col fm-gap-sm" style={{ padding: 16 }}>
          <Skeleton width="60%" height="12px" variant="text" />
          <Skeleton width="40%" height="24px" variant="text" />
          <Skeleton width="80%" height="12px" variant="text" />
        </div>
      ))}
    </div>
  );
}
