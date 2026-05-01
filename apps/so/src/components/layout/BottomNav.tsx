'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, ArrowRightLeft, Boxes, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { label: 'Home', href: '/dashboard', icon: Home, primary: false },
  { label: 'Stok', href: '/inventory', icon: Boxes, primary: false },
  { label: 'Movement', href: '/movements/transfer', icon: ArrowRightLeft, primary: true },
  { label: 'Produk', href: '/master/products', icon: Package, primary: false },
  { label: 'Saya', href: '/profile', icon: User, primary: false },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-stone-200 pb-safe">
      <div className="grid grid-cols-5 h-16">
        {ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          if (item.primary) {
            return (
              <Link key={item.href} href={item.href} className="flex items-center justify-center">
                <div className="w-12 h-12 -mt-3 rounded-full bg-kartini-green text-white flex items-center justify-center shadow-lg shadow-kartini-green/30">
                  <Icon className="w-5 h-5" />
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 transition-colors',
                isActive ? 'text-kartini-green' : 'text-stone-400',
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
