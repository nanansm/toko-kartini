'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ROLE_LABEL, type UserRole } from '@/lib/roles';

const PESAN_JARINGAN = 'Tidak bisa menghubungi server. Periksa sinyal, lalu coba lagi.';

const PILIHAN_PERAN: UserRole[] = ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG', 'KASIR'];

interface Pengguna {
  userId: string;
  username: string;
  nama: string;
  peran: string;
  lokasi: string[];
  aktif: boolean;
}

function labelPeran(peran: string): string {
  return ROLE_LABEL[peran as UserRole] ?? peran;
}

export function KelolaPengguna() {
  const [daftar, setDaftar] = React.useState<Pengguna[]>([]);
  const [memuatDaftar, setMemuatDaftar] = React.useState(true);
  const [errorDaftar, setErrorDaftar] = React.useState<string | null>(null);

  const [username, setUsername] = React.useState('');
  const [nama, setNama] = React.useState('');
  const [peran, setPeran] = React.useState<UserRole>('KASIR');
  const [pin, setPin] = React.useState('');
  const [mengirim, setMengirim] = React.useState(false);
  const [errorForm, setErrorForm] = React.useState<string | null>(null);
  const [pesanBerhasil, setPesanBerhasil] = React.useState<string | null>(null);

  const [prosesUsername, setProsesUsername] = React.useState<string | null>(null);
  const [errorStatus, setErrorStatus] = React.useState<string | null>(null);

  const muatDaftar = React.useCallback(async () => {
    setMemuatDaftar(true);
    setErrorDaftar(null);
    try {
      const res = await fetch('/api/pengguna');
      if (!res.ok) {
        setErrorDaftar(PESAN_JARINGAN);
        return;
      }
      const data = (await res.json()) as { ok: boolean; pengguna?: Pengguna[]; pesan?: string };
      if (!data.ok) {
        setErrorDaftar(data.pesan ?? PESAN_JARINGAN);
        return;
      }
      setDaftar(data.pengguna ?? []);
    } catch {
      setErrorDaftar(PESAN_JARINGAN);
    } finally {
      setMemuatDaftar(false);
    }
  }, []);

  React.useEffect(() => {
    void muatDaftar();
  }, [muatDaftar]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mengirim) return;

    setMengirim(true);
    setErrorForm(null);
    setPesanBerhasil(null);

    try {
      const res = await fetch('/api/pengguna', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, nama, peran, pin }),
      });

      const data = (await res.json().catch(() => null)) as { ok: boolean; pesan?: string } | null;

      if (res.ok && data?.ok) {
        setPesanBerhasil(`Pengguna "${username}" berhasil ditambahkan`);
        setUsername('');
        setNama('');
        setPeran('KASIR');
        setPin('');
        await muatDaftar();
        return;
      }

      if (res.status === 400 || res.status === 409) {
        setErrorForm(data?.pesan ?? PESAN_JARINGAN);
      } else {
        setErrorForm(PESAN_JARINGAN);
      }
    } catch {
      setErrorForm(PESAN_JARINGAN);
    } finally {
      setMengirim(false);
    }
  }

  async function ubahStatus(target: Pengguna) {
    if (prosesUsername) return;

    setProsesUsername(target.username);
    setErrorStatus(null);

    try {
      const res = await fetch('/api/pengguna', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: target.username, aktif: !target.aktif }),
      });

      const data = (await res.json().catch(() => null)) as { ok: boolean; pesan?: string } | null;

      if (res.ok && data?.ok) {
        await muatDaftar();
        return;
      }

      if (res.status === 400 || res.status === 404) {
        setErrorStatus(data?.pesan ?? PESAN_JARINGAN);
      } else {
        setErrorStatus(PESAN_JARINGAN);
      }
    } catch {
      setErrorStatus(PESAN_JARINGAN);
    } finally {
      setProsesUsername(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tambah Pengguna</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={mengirim}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nama">Nama</Label>
              <Input
                id="nama"
                name="nama"
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                disabled={mengirim}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="peran">Peran</Label>
              <Select
                value={peran}
                onValueChange={(value) => setPeran(value as UserRole)}
                disabled={mengirim}
              >
                <SelectTrigger id="peran" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PILIHAN_PERAN.map((p) => (
                    <SelectItem key={p} value={p}>
                      {ROLE_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin">PIN (6 angka)</Label>
              <Input
                id="pin"
                name="pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                disabled={mengirim}
                required
              />
            </div>

            {errorForm && (
              <Alert variant="destructive">
                <AlertDescription>{errorForm}</AlertDescription>
              </Alert>
            )}

            {pesanBerhasil && (
              <Alert>
                <AlertDescription>{pesanBerhasil}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full min-h-12" disabled={mengirim}>
              {mengirim ? 'Memproses...' : 'Tambah Pengguna'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Pengguna</CardTitle>
        </CardHeader>
        <CardContent>
          {errorStatus && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{errorStatus}</AlertDescription>
            </Alert>
          )}

          {errorDaftar && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{errorDaftar}</AlertDescription>
            </Alert>
          )}

          {memuatDaftar ? (
            <p className="text-sm text-muted-foreground">Memuat...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Peran</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {daftar.map((p) => (
                  <TableRow key={p.userId} className={!p.aktif ? 'opacity-50' : undefined}>
                    <TableCell>{p.nama}</TableCell>
                    <TableCell>{p.username}</TableCell>
                    <TableCell>{labelPeran(p.peran)}</TableCell>
                    <TableCell>
                      <Badge variant={p.aktif ? 'default' : 'destructive'}>
                        {p.aktif ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={prosesUsername === p.username}
                        onClick={() => void ubahStatus(p)}
                      >
                        {prosesUsername === p.username
                          ? 'Memproses...'
                          : p.aktif
                            ? 'Nonaktifkan'
                            : 'Aktifkan'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
