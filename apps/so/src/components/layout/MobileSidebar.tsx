'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/Logo';
import { NAV_ITEMS } from './nav-items';
import type { UserRole } from '@/lib/roles';

export function MobileSidebar({
  userRole,
  onItemClick,
}: {
  userRole: UserRole;
  onItemClick?: () => void;
}) {
  const pathname = usePathname();
  const visible = NAV_ITEMS.filter((i) => i.roles.includes(userRole));

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="h-16 flex items-center px-6 border-b border-stone-200">
        <Logo size="sm" showText />
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visible.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onItemClick}
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-kartini-green-light text-kartini-green-dark'
                  : 'text-stone-600 hover:bg-stone-100',
              )}
            >
              <Icon className={cn('w-5 h-5', isActive ? 'text-kartini-green' : '')} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
