import { useToastStore, type Toast } from '../stores/toastStore';

const TOAST_COLORS: Record<Toast['type'], { bg: string; border: string; text: string }> = {
  success: { bg: 'rgba(46, 204, 113, 0.12)', border: '#2ecc71', text: '#2ecc71' },
  error: { bg: 'rgba(231, 76, 60, 0.12)', border: '#e74c3c', text: '#e74c3c' },
  info: { bg: 'rgba(52, 152, 219, 0.12)', border: '#3498db', text: '#3498db' },
  warning: { bg: 'rgba(243, 156, 18, 0.12)', border: '#f39c12', text: '#f39c12' },
};

const TOAST_ICONS: Record<Toast['type'], string> = {
  success: '\u2713', error: '\u2717', info: '\u2139', warning: '\u26A0',
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
      display: 'flex', flexDirection: 'column-reverse', gap: 8,
      maxWidth: 360, pointerEvents: 'none',
    }}>
      {toasts.map((t) => {
        const c = TOAST_COLORS[t.type];
        return (
          <div
            key={t.id}
            style={{
              background: c.bg, border: `1px solid ${c.border}`,
              borderRadius: 8, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 8,
              color: c.text, fontSize: 13, fontWeight: 500,
              backdropFilter: 'blur(8px)', pointerEvents: 'auto',
              animation: 'fadeIn 0.2s ease',
              cursor: 'pointer',
            }}
            onClick={() => removeToast(t.id)}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>{TOAST_ICONS[t.type]}</span>
            <span style={{ flex: 1 }}>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
