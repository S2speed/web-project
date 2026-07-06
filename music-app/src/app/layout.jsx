import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Footer from "@/components/layout/Footer";
import SeedInitializer from "@/components/common/SeedInitializer";

export const metadata = {
  title: "موزیک‌اپ",
  description: "پلتفرم پخش و مدیریت موسیقی",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="h-screen flex flex-col">
        <SeedInitializer />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
        <Footer />
      </body>
    </html>
  );
}
