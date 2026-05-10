'use client';

import { useEffect, useState } from 'react';
import { LogOut, Clock, User } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

interface Shift {
  openedAt: Date | string;
}

interface Props {
  user: { name: string; email: string; role: string };
  activeShift: Shift | null;
}

export function POSTopbar({ user, activeShift }: Props) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

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
    <header className="h-14 bg-stone-900 border-b border-stone-700 flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-kartini-green rounded-lg flex items-center justify-center">
          <span className="text-white text-xs font-bold">TK</span>
        </div>
        <span className="text-white font-semibold text-sm hidden sm:block">
          Toko Kartini POS
        </span>
      </div>

      {activeShift && (
        <div className="flex items-center gap-2 text-xs text-stone-400">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="hidden sm:block">Shift aktif</span>
          <span className="font-mono text-stone-300">
            {new Date(activeShift.openedAt).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-1.5 text-xs text-stone-400">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-mono">
            {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-300">
          <User className="w-3.5 h-3.5 text-stone-400" />
          <span className="hidden sm:block">{user.name}</span>
        </div>
        <button
          onClick={handleLogout}
          className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-700 transition"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
