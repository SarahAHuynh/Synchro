import Link from 'next/link';
import { CalendarDays, LayoutGrid, Plus, Settings2, Users, CalendarCheck } from 'lucide-react';
export type NavigationScreen = 'overview' | 'create' | 'preferences' | 'upcoming' | 'profile' | 'calendar';
const items = [
  { screen:'overview',label:'Overview',icon:LayoutGrid,href:'/account' },
  { screen:'create',label:'Plan a hangout',icon:Plus,href:'/account/plan' },
  { screen:'upcoming',label:'Upcoming hangouts',icon:CalendarDays,href:'/account/hangouts' },
  { screen:'preferences',label:'My preferences',icon:Settings2,href:'/account/preferences' },
  { screen:'calendar',label:'My calendar',icon:CalendarCheck,href:'/account/calendar' },
  { screen:'profile',label:'Profile',icon:Users,href:'/account/profile' },
] as const;
export default function Navigation({screen}:{screen:string}) {
  return <nav aria-label="Main navigation">{items.map(({screen:target,label,icon:Icon,href})=><Link key={target} href={href} className={`nav-link ${screen===target?'active':''}`} aria-current={screen===target?'page':undefined}><Icon size={19}/>{label}{screen===target&&<span className="nav-dot"/>}</Link>)}</nav>;
}
