'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from './nav-items';
import type { UserRole } from '@/lib/roles';

export function BottomNav({ peran }: { peran: UserRole }): React.JSX.Element | null {
  const pathname = usePathname();

  // Halaman masuk tidak boleh punya navigasi.
  if (pathname === '/masuk' || pathname.startsWith('/masuk')) {
    return null;
  }

  const items = NAV_ITEMS.filter((item) => item.roles.includes(peran));

  return (
    <>
      {/* Penyangga di komponen ini sendiri, bukan padding body, supaya halaman
          tanpa navigasi (mis. /masuk) tidak ikut tergeser. */}
      <div className="h-16" aria-hidden />
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto flex max-w-5xl">
          {items.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + '/');

            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-[44px] flex-col items-center gap-1 py-2 text-xs ${
                    isActive ? 'font-semibold text-[#0f7a3e]' : 'text-stone-500'
                  }`}
                >
                  <item.icon className="h-5 w-5" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
