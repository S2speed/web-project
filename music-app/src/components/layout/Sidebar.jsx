import Link from "next/link";

// Main sidebar navigation links
const navLinks = [
  { href: "/", label: "خانه", icon: "🏠" },
  { href: "/library", label: "کتابخانه", icon: "📚" },
  { href: "/playlists", label: "پلی‌لیست‌ها", icon: "📋" },
  { href: "/settings", label: "تنظیمات", icon: "⚙️" },
];

export default function Sidebar() {
  return (
    <aside className="w-64 h-full bg-gray-900 text-white flex flex-col p-4 shrink-0">
      <h2 className="text-xl font-bold mb-6 px-2">موزیک‌اپ</h2>
      <nav className="flex flex-col gap-1">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <span>{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
