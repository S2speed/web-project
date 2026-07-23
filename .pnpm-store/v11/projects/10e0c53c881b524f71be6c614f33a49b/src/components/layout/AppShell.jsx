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
    <div className="flex h-full min-h-screen overflow-hidden">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto pb-20 pt-16 md:pb-24 lg:pt-0">{children}</main>
      <Footer />
    </div>
  );
}
