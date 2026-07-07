'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { USER_ROLES as ROLES } from '@/utils/constants';

const mainMenu = [
  { href: '/', label: 'خانه', icon: '🏠' },
  { href: '/library', label: 'کتابخانه', icon: '📚' },
  { href: '/playlists', label: 'پلی‌لیست‌ها', icon: '📋' },
  { href: '/notifications', label: 'اعلانات', icon: '🔔' },
  { href: '/settings', label: 'تنظیمات', icon: '⚙️' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, isLoading } = useUser();

  const roleMenu = [];

  if (user?.role === ROLES.ARTIST) {
    roleMenu.push({ href: '/artist/dashboard', label: 'داشبورد هنرمند', icon: '🎵' });
  }

  if (user?.role === ROLES.ADMIN || user?.role === ROLES.SUPPORT) {
    roleMenu.push({ href: '/admin/dashboard', label: 'داشبورد مدیریت', icon: '📊' });
  }

  const profileMenu = user ? [{ href: `/profile/${user.id}`, label: 'نمایه کاربری', icon: '👤' }] : [];
  const allMenu = [...mainMenu, ...profileMenu, ...roleMenu];

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-l border-white/10 bg-slate-950/95 p-4 text-white backdrop-blur md:flex">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-emerald-400">Music</h1>
        <p className="text-xs text-slate-400">سرویس استریم</p>
      </div>

      {user && !isLoading && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-700">
              {user.avatar ? (
                <img src={user.avatar} alt={user.displayName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-semibold">{user.displayName?.[0]}</span>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold">{user.displayName}</p>
              <p className="text-xs text-slate-400">{user.role === ROLES.ARTIST ? 'هنرمند' : 'کاربر'}</p>
            </div>
          </div>
        </div>
      )}

      <nav className="space-y-1">
        {allMenu.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                isActive ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
