'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

const PESAN_JARINGAN = 'Tidak bisa menghubungi server. Periksa sinyal, lalu coba lagi.';

export function FormMasuk() {
  const [username, setUsername] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  // Sebelum React terhidrasi, `onSubmit` belum terpasang dan tombol Masuk
  // menjalankan pengiriman formulir bawaan peramban -- GET, yang menempelkan
  // username DAN PIN ke URL, riwayat peramban, dan log proksi mana pun di
  // jalurnya. HP staf di gudang justru yang paling lama menunggu hidrasi.
  const [siap, setSiap] = React.useState(false);
  React.useEffect(() => {
    setSiap(true);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/masuk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, pin }),
      });

      if (res.ok) {
        window.location.href = '/';
        return;
      }

      if (res.status === 401 || res.status === 429) {
        const data = (await res.json().catch(() => null)) as { pesan?: string } | null;
        setError(data?.pesan ?? PESAN_JARINGAN);
      } else {
        setError(PESAN_JARINGAN);
      }
    } catch {
      setError(PESAN_JARINGAN);
    } finally {
      setPin('');
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <form method="post" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pin">PIN</Label>
            <Input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="current-password"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
              disabled={loading}
              required
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full min-h-12" disabled={loading || !siap}>
            {loading ? 'Memproses...' : 'Masuk'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
