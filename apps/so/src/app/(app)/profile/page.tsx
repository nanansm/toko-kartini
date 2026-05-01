import Link from 'next/link';
import { requireAuth } from '@/lib/session';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tags,
  UserCog,
  Settings,
  RefreshCw,
  Users,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { ROLE_LABEL, type UserRole } from '@/lib/roles';
import { LogoutButton } from './_components/LogoutButton';

interface ProfileMenuItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
}

const MENU_ITEMS: ProfileMenuItem[] = [
  { label: 'Master Customer', href: '/master/customers', icon: Users, roles: ['OWNER', 'ADMIN', 'SUPERVISOR'] },
  { label: 'Master Kategori', href: '/master/categories', icon: Tags, roles: ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG'] },
  { label: 'Sinkronisasi', href: '/sync', icon: RefreshCw, roles: ['OWNER', 'ADMIN'] },
  { label: 'Pengguna', href: '/users', icon: UserCog, roles: ['OWNER'] },
  { label: 'Pengaturan', href: '/settings', icon: Settings, roles: ['OWNER'] },
];

export default async function ProfilePage() {
  const user = await requireAuth();
  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  const menuItems = MENU_ITEMS.filter((m) => m.roles.includes(user.role));

  return (
    <div className="space-y-5 max-w-2xl">
      <Card className="border-stone-200 shadow-soft-sm py-5 gap-0">
        <div className="px-5 flex items-center gap-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src={user.image ?? undefined} alt={user.name} />
            <AvatarFallback className="bg-kartini-green text-white text-lg font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-stone-900 truncate">{user.name}</div>
            <div className="text-sm text-stone-500 truncate">{user.email}</div>
            <div className="inline-block mt-1 text-xs font-medium text-kartini-orange">
              {ROLE_LABEL[user.role]}
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-stone-200 shadow-soft-sm overflow-hidden p-0 gap-0">
        <div className="divide-y divide-stone-100">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between p-4 hover:bg-stone-50 transition"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-stone-500" />
                  <span className="font-medium text-stone-700 text-sm">{item.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </Link>
            );
          })}
        </div>
      </Card>

      <Card className="border-stone-200 shadow-soft-sm p-0">
        <LogoutButton />
      </Card>

      <div className="text-center text-xs text-stone-400 pt-4">
        Toko Kartini · v0.2.0 · Phase 1
      </div>
    </div>
  );
}
