'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Footer from '@/components/layout/Footer';

const authPrefixes = ['/login', '/register', '/forgot-password'];

function isAuthRoute(pathname) {
  if (!pathname) {
    return false;
  }

  if (authPrefixes.includes(pathname)) {
    return true;
  }

  return pathname.startsWith('/login/') || pathname.startsWith('/register/') || pathname.startsWith('/forgot-password/');
}

export default function AppShell({ children }) {
  const pathname = usePathname();

  if (isAuthRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pb-24">{children}</main>
      <Footer />
    </div>
  );
}