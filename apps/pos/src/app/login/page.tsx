'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

export default function POSLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setError('');
    setLoading(true);

    await authClient.signIn.email({
      email,
      password,
      fetchOptions: {
        onSuccess: () => {
          router.push('/pos');
          router.refresh();
        },
        onError: (ctx) => {
          setError(ctx.error.message ?? 'Email atau password salah');
          setLoading(false);
        },
      },
    });
  }

  return (
    <main className="min-h-screen bg-stone-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-16 h-16 bg-kartini-green rounded-2xl flex items-center justify-center">
            <span className="text-white text-2xl font-bold">TK</span>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">Toko Kartini</h1>
            <p className="text-sm text-stone-400 mt-0.5">Point of Sale</p>
          </div>
        </div>

        <div className="bg-stone-800 rounded-2xl border border-stone-700 p-7 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-900/50 border border-red-700 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kasir@tokokartini.com"
                required
                autoComplete="email"
                className="w-full h-12 px-4 rounded-xl bg-stone-700 border border-stone-600 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-white placeholder:text-stone-500 text-sm outline-none transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-300">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full h-12 pl-4 pr-12 rounded-xl bg-stone-700 border border-stone-600 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-white placeholder:text-stone-500 text-sm outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="pos-btn w-full rounded-xl bg-kartini-green hover:bg-kartini-green-dark text-white transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Masuk ke POS
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-stone-600 mt-6">Toko Kartini POS v0.1.0</p>
      </div>
    </main>
  );
}
