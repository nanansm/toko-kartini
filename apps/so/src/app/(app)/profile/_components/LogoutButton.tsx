'use client';

import { LogOut } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

export function LogoutButton() {
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
    <button
      type="button"
      onClick={handleLogout}
      className="w-full p-4 flex items-center gap-3 text-red-600 hover:bg-red-50 transition rounded-xl"
    >
      <LogOut className="w-5 h-5" />
      <span className="font-medium text-sm">Keluar</span>
    </button>
  );
}
