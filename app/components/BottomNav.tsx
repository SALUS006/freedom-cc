"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string; icon: React.ReactNode };

const I = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  ),
  players: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.3 2.6-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
      <path d="M16 5.2A3 3 0 0 1 16 11M20.5 20c0-2.6-1.5-4.6-3.5-5.2" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19 15.5 8.5" />
      <path d="m13 6 5 5" />
      <path d="M17.5 3.5 20.5 6.5 18 9 15 6z" fill="currentColor" />
      <circle cx="5.5" cy="18.5" r="2" fill="currentColor" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c0-4.1 3.4-6.5 7.5-6.5s7.5 2.4 7.5 6.5" />
    </svg>
  ),
};

const TABS: Tab[] = [
  { href: "/", label: "Home", icon: I.home },
  { href: "/players", label: "Players", icon: I.players },
  { href: "/play", label: "Play", icon: I.play },
  { href: "/profile", label: "Profile", icon: I.profile },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="tabbar">
      {TABS.map((t) => {
        const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={active ? "active" : ""}>
            <span className="tab-ic">{t.icon}</span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
