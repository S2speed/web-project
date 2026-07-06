import "./globals.css";
import { UserProvider } from "@/contexts/UserContext";
import { PlayerProvider } from "@/contexts/PlayerContext";
import AppShell from "@/components/layout/AppShell";
import SeedInitializer from "@/components/common/SeedInitializer";

export const metadata = {
  title: "سرویس استریم موسیقی",
  description: "پروژه درس برنامه‌سازی وب - اسپاتیفای ساده",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="h-screen bg-slate-950 text-white">
        <SeedInitializer />
        <UserProvider>
          <PlayerProvider>
            <AppShell>{children}</AppShell>
          </PlayerProvider>
        </UserProvider>
      </body>
    </html>
  );
}
