'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { DEFAULT_AVATAR, USER_ROLES as ROLES } from '@/utils/constants';

const mainMenu = [
  { href: '/', label: 'خانه', icon: '🏠' },
  { href: '/library', label: 'آلبوم‌ها و تک‌آهنگ‌ها', icon: '📚' },
  { href: '/playlists', label: 'پلی‌لیست‌ها', icon: '📋' },
  { href: '/notifications', label: 'اعلانات', icon: '🔔' },
  { href: '/settings', label: 'تنظیمات', icon: '⚙️' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, isLoading } = useUser();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const roleMenu = [];

  if (user?.role === ROLES.ARTIST) {
    roleMenu.push({ href: '/artist/dashboard', label: 'داشبورد هنرمند', icon: '🎵' });
  }

  if (user?.role === ROLES.ADMIN || user?.role === ROLES.SUPPORT) {
    roleMenu.push({ href: '/admin/dashboard', label: 'داشبورد مدیریت', icon: '📊' });
  }

  const profileMenu = user ? [{ href: `/profile/${user.id}`, label: 'نمایه کاربری', icon: '👤' }] : [];
  const allMenu = [...mainMenu, ...profileMenu, ...roleMenu];

  const navigation = (
    <nav className="space-y-1" aria-label="منوی اصلی">
      {allMenu.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
              isActive ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-slate-950/95 px-4 text-white backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="باز کردن منوی اصلی"
          aria-expanded={isOpen}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl transition hover:bg-white/15"
        >
          ☰
        </button>
        <Link href="/" className="text-center" aria-label="صفحه خانه">
          <span className="block text-lg font-black text-emerald-400">Music</span>
          <span className="block text-[10px] text-slate-500">سرویس استریم</span>
        </Link>
        <Link
          href={user ? `/profile/${user.id}` : '/login'}
          aria-label={user ? 'نمایه کاربری' : 'ورود'}
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-sm font-bold"
        >
          {user ? (
            <img
              src={user.avatar || DEFAULT_AVATAR}
              alt=""
              onError={(event) => {
                event.currentTarget.src = DEFAULT_AVATAR;
              }}
              className="h-full w-full object-cover"
            />
          ) : '○'}
        </Link>
      </header>

      {isOpen && (
        <button
          type="button"
          aria-label="بستن منوی اصلی"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-[55] bg-slate-950/75 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside className={`fixed inset-y-0 right-0 z-[60] flex w-[min(19rem,88vw)] flex-col border-l border-white/10 bg-slate-950 p-4 text-white shadow-2xl transition-transform duration-200 lg:hidden ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="mb-6 flex items-center justify-between">
          <div><h1 className="text-xl font-bold text-emerald-400">Music</h1><p className="text-xs text-slate-400">منوی اصلی</p></div>
          <button type="button" onClick={() => setIsOpen(false)} aria-label="بستن" className="rounded-xl bg-white/10 px-3 py-1 text-2xl hover:bg-white/15">×</button>
        </div>
        {user && !isLoading && <UserCard user={user} />}
        <div className="mt-5 overflow-y-auto">{navigation}</div>
      </aside>

      <aside className="hidden w-64 shrink-0 flex-col border-l border-white/10 bg-slate-950/95 p-4 text-white backdrop-blur lg:flex">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-emerald-400">Music</h1>
          <p className="text-xs text-slate-400">سرویس استریم</p>
        </div>

        {user && !isLoading && <UserCard user={user} />}
        <div className="mt-5 overflow-y-auto">{navigation}</div>
      </aside>
    </>
  );
}

function UserCard({ user }) {
  const roleLabels = {
    [ROLES.ARTIST]: 'هنرمند',
    [ROLES.ADMIN]: 'مدیر سامانه',
    [ROLES.SUPPORT]: 'پشتیبان',
    [ROLES.LISTENER]: 'شنونده',
  };

  return (
    <Link href={`/profile/${user.id}`} className="block rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700">
          <img
            src={user.avatar || DEFAULT_AVATAR}
            alt=""
            onError={(event) => {
              event.currentTarget.src = DEFAULT_AVATAR;
            }}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{user.displayName}</p><p className="text-xs text-slate-400">{roleLabels[user.role] || 'کاربر'}</p></div>
      </div>
    </Link>
  );
}
