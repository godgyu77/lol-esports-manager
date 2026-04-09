import { NavLink } from 'react-router-dom';

interface MobileBottomNavItem {
  to?: string;
  label: string;
  icon: string;
  end?: boolean;
  onClick?: () => void;
}

export function MobileBottomNav({ items }: { items: MobileBottomNavItem[] }) {
  return (
    <nav className="fm-mobile-nav" aria-label="모바일 빠른 이동">
      {items.map((item) =>
        item.to ? (
          <NavLink
            key={`${item.label}-${item.to}`}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `fm-mobile-nav__item${isActive ? ' fm-mobile-nav__item--active' : ''}`}
          >
            <span className="fm-mobile-nav__icon">{item.icon}</span>
            <span className="fm-mobile-nav__label">{item.label}</span>
          </NavLink>
        ) : (
          <button
            key={item.label}
            type="button"
            className="fm-mobile-nav__item"
            onClick={item.onClick}
          >
            <span className="fm-mobile-nav__icon">{item.icon}</span>
            <span className="fm-mobile-nav__label">{item.label}</span>
          </button>
        ),
      )}
    </nav>
  );
}
