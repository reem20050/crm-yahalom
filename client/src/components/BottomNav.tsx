import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Calendar, AlertTriangle, CalendarDays, Menu } from 'lucide-react';

interface BottomNavProps {
  onMenuClick: () => void;
}

const navItems = [
  { name: 'דשבורד', href: '/', icon: LayoutDashboard },
  { name: 'משמרות', href: '/shifts', icon: Calendar },
  { name: 'אבטחה', href: '/incidents', icon: AlertTriangle },
  { name: 'לוח שנה', href: '/calendar', icon: CalendarDays },
];

export default function BottomNav({ onMenuClick }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-lg border-t border-gray-100 z-40 lg:hidden safe-area-pb">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors ${
                isActive
                  ? 'text-primary-600'
                  : 'text-gray-400 active:text-gray-600'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.name}</span>
          </NavLink>
        ))}
        {/* Menu button - opens sidebar */}
        <button
          onClick={onMenuClick}
          className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-gray-400 active:text-gray-600 transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">עוד</span>
        </button>
      </div>
    </nav>
  );
}
