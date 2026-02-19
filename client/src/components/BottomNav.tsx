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
    <nav className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-xl border-t border-gray-200/60 z-40 lg:hidden safe-area-pb">
      <div className="flex items-center justify-around h-[72px] max-w-lg mx-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-4 py-2.5 min-w-[48px] transition-all duration-150 active:scale-95 ${
                isActive
                  ? 'text-primary-600 bg-primary-50 rounded-2xl'
                  : 'text-gray-400 active:text-gray-600 rounded-xl'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className="w-6 h-6" />
                <span className="text-[11px] font-medium">{item.name}</span>
                {isActive && <span className="w-1 h-1 rounded-full bg-primary-500 mt-0.5" />}
              </>
            )}
          </NavLink>
        ))}
        {/* Menu button - opens sidebar */}
        <button
          onClick={onMenuClick}
          className="flex flex-col items-center gap-0.5 px-4 py-2.5 min-w-[48px] rounded-xl text-gray-400 active:text-gray-600 active:scale-95 transition-all duration-150"
        >
          <Menu className="w-6 h-6" />
          <span className="text-[11px] font-medium">עוד</span>
        </button>
      </div>
    </nav>
  );
}
