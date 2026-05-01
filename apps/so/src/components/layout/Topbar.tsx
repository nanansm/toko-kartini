'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, Search, Bell, LogOut, ChevronDown } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Logo } from '@/components/brand/Logo';
import { MobileSidebar } from './MobileSidebar';
import { ROLE_LABEL, type UserRole } from '@/lib/roles';

interface TopbarUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  role: UserRole;
}

export function Topbar({ user }: { user: TopbarUser }) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  async function handleLogout() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = '/login';
        },
      },
    });
  }

  return (
    <header className="sticky top-0 z-40 h-16 bg-white border-b border-stone-200 lg:pl-60">
      <div className="h-full px-4 lg:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 lg:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                className="p-2 -ml-2 rounded-lg hover:bg-stone-100"
                aria-label="Buka menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
              <MobileSidebar userRole={user.role} onItemClick={() => setSheetOpen(false)} />
            </SheetContent>
          </Sheet>
          <Logo size="sm" />
        </div>

        <div className="hidden lg:flex flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="search"
              placeholder="Cari produk, supplier, customer..."
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-stone-100 border border-transparent focus:bg-white focus:border-stone-300 focus:ring-2 focus:ring-kartini-green/20 text-sm placeholder:text-stone-400 outline-none transition"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="hidden md:block p-2 rounded-lg hover:bg-stone-100 relative"
            aria-label="Notifikasi"
          >
            <Bell className="w-5 h-5 text-stone-600" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-1 pr-2 rounded-lg hover:bg-stone-100 transition">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.image ?? undefined} alt={user.name} />
                  <AvatarFallback className="bg-kartini-green text-white text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="hidden md:block w-4 h-4 text-stone-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="space-y-0.5">
                  <div className="font-semibold text-sm">{user.name}</div>
                  <div className="text-xs text-stone-500">{user.email}</div>
                  <div className="text-xs text-kartini-orange font-medium">
                    {ROLE_LABEL[user.role]}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">Profil Saya</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} variant="destructive">
                <LogOut className="w-4 h-4" />
                Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
