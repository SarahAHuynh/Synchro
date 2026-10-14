import { CalendarDays, LayoutGrid, Plus, Settings2, Users } from 'lucide-react';
export type NavigationScreen = 'overview' | 'create' | 'preferences' | 'upcoming' | 'profile';
const items = [
  { screen: 'overview', label: 'Overview', icon: LayoutGrid },
  { screen: 'create', label: 'Plan a hangout', icon: Plus },
  { screen: 'preferences', label: 'My preferences', icon: Settings2 },
  { screen: 'upcoming', label: 'Upcoming hangouts', icon: CalendarDays },
  { screen: 'profile', label: 'Profile', icon: Users },
] as const;
export default function Navigation({ screen, onNavigate }: { screen: string; onNavigate: (screen: NavigationScreen) => void }) {
  return <nav aria-label="Main navigation">{items.map(({ screen: target, label, icon: Icon }) => {
    const active = screen === target || target === 'create' && ['confirm', 'customize', 'ready', 'planning'].includes(screen);
    return <button key={target} className={`nav-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => onNavigate(target)}>
      <Icon size={19} />{label}{active && <span className="nav-dot" />}
    </button>;
  })}</nav>;
}
