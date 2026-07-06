import "./globals.css";
import { UserProvider } from "@/contexts/UserContext";
import { PlayerProvider } from "@/contexts/PlayerContext";
import Sidebar from "@/components/layout/Sidebar";
import Footer from "@/components/layout/Footer";
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
            <div className="flex h-full overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-y-auto pb-24">{children}</main>
            </div>
            <Footer />
          </PlayerProvider>
        </UserProvider>
      </body>
    </html>
  );
}
