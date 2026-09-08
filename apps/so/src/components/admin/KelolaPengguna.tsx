'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { LOKASI_NYATA, LABEL_LOKASI, isKodeLokasi, type KodeLokasi } from '@/lib/lokasi';

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
  const [pesanTabel, setPesanTabel] = React.useState<string | null>(null);

  const [editTarget, setEditTarget] = React.useState<Pengguna | null>(null);
  const [editNama, setEditNama] = React.useState('');
  const [editPeran, setEditPeran] = React.useState<UserRole>('KASIR');
  const [editLokasi, setEditLokasi] = React.useState<KodeLokasi[]>([]);
  const [editPin, setEditPin] = React.useState('');
  const [editMengirim, setEditMengirim] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = React.useState<Pengguna | null>(null);
  const [deleteMengirim, setDeleteMengirim] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

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

  function bukaEdit(target: Pengguna) {
    setEditTarget(target);
    setEditNama(target.nama);
    setEditPeran(target.peran as UserRole);
    setEditLokasi(target.lokasi.filter(isKodeLokasi));
    setEditPin('');
    setEditError(null);
  }

  function tutupEdit() {
    setEditTarget(null);
  }

  function toggleEditLokasi(kode: KodeLokasi) {
    setEditLokasi((prev) =>
      prev.includes(kode) ? prev.filter((k) => k !== kode) : [...prev, kode],
    );
  }

  // bandingkan sebagai himpunan — urutan centang tidak dianggap perubahan
  function samaHimpunanLokasi(a: readonly string[], b: readonly string[]): boolean {
    if (a.length !== b.length) return false;
    const setB = new Set(b);
    return a.every((kode) => setB.has(kode));
  }

  async function handleUbahSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (editMengirim || !editTarget) return;

    // hanya kirim field yang benar-benar berubah dari nilai awal
    const ubah: { nama?: string; peran?: UserRole; lokasi?: string[]; pinBaru?: string } = {};

    const namaBaru = editNama.trim();
    if (namaBaru !== editTarget.nama) {
      ubah.nama = namaBaru;
    }

    if (editPeran !== editTarget.peran) {
      ubah.peran = editPeran;
    }

    if (!samaHimpunanLokasi(editLokasi, editTarget.lokasi)) {
      ubah.lokasi = editLokasi;
    }

    const pinBaru = editPin.trim();
    if (pinBaru.length > 0) {
      ubah.pinBaru = pinBaru;
    }

    if (Object.keys(ubah).length === 0) {
      setEditError('Tidak ada perubahan untuk disimpan.');
      return;
    }

    setEditMengirim(true);
    setEditError(null);

    try {
      const res = await fetch('/api/pengguna', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: editTarget.username, ubah }),
      });

      const data = (await res.json().catch(() => null)) as { ok: boolean; pesan?: string } | null;

      if (res.ok && data?.ok) {
        setPesanTabel(`Pengguna "${editTarget.username}" berhasil diubah`);
        tutupEdit();
        await muatDaftar();
        return;
      }

      if (res.status === 400 || res.status === 403 || res.status === 404) {
        setEditError(data?.pesan ?? PESAN_JARINGAN);
      } else {
        setEditError(PESAN_JARINGAN);
      }
    } catch {
      setEditError(PESAN_JARINGAN);
    } finally {
      setEditMengirim(false);
    }
  }

  function bukaHapus(target: Pengguna) {
    setDeleteTarget(target);
    setDeleteError(null);
  }

  function tutupHapus() {
    setDeleteTarget(null);
  }

  async function handleHapus() {
    if (deleteMengirim || !deleteTarget) return;

    setDeleteMengirim(true);
    setDeleteError(null);

    try {
      const res = await fetch('/api/pengguna', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: deleteTarget.username }),
      });

      const data = (await res.json().catch(() => null)) as { ok: boolean; pesan?: string } | null;

      if (res.ok && data?.ok) {
        setPesanTabel(`Pengguna "${deleteTarget.username}" berhasil dihapus`);
        tutupHapus();
        await muatDaftar();
        return;
      }

      if (res.status === 400 || res.status === 403 || res.status === 404) {
        setDeleteError(data?.pesan ?? PESAN_JARINGAN);
      } else {
        setDeleteError(PESAN_JARINGAN);
      }
    } catch {
      setDeleteError(PESAN_JARINGAN);
    } finally {
      setDeleteMengirim(false);
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
          {pesanTabel && (
            <Alert className="mb-4">
              <AlertDescription>{pesanTabel}</AlertDescription>
            </Alert>
          )}

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
                      <div className="flex flex-wrap gap-2">
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
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => bukaEdit(p)}
                        >
                          Ubah
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => bukaHapus(p)}
                        >
                          Hapus
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editTarget !== null} onOpenChange={(open) => !open && tutupEdit()}>
        <DialogContent>
          {editTarget && (
            <form onSubmit={handleUbahSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Ubah Pengguna</DialogTitle>
                <DialogDescription>Username: {editTarget.username}</DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label htmlFor="edit-nama">Nama</Label>
                <Input
                  id="edit-nama"
                  name="nama"
                  type="text"
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  disabled={editMengirim}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-peran">Peran</Label>
                <Select
                  value={editPeran}
                  onValueChange={(value) => setEditPeran(value as UserRole)}
                  disabled={editMengirim}
                >
                  <SelectTrigger id="edit-peran" className="w-full">
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
                <Label>Lokasi</Label>
                <div className="space-y-2 rounded-md border border-border p-3">
                  {LOKASI_NYATA.map((kode) => (
                    <label key={kode} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-border"
                        checked={editLokasi.includes(kode)}
                        onChange={() => toggleEditLokasi(kode)}
                        disabled={editMengirim}
                      />
                      {LABEL_LOKASI[kode]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-pin">Reset PIN (kosongkan jika tidak diubah)</Label>
                <Input
                  id="edit-pin"
                  name="pinBaru"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={editPin}
                  onChange={(e) => setEditPin(e.target.value.replace(/[^0-9]/g, ''))}
                  disabled={editMengirim}
                />
              </div>

              {editError && (
                <Alert variant="destructive">
                  <AlertDescription>{editError}</AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={editMengirim}
                  onClick={tutupEdit}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={editMengirim}>
                  {editMengirim ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && tutupHapus()}>
        <DialogContent>
          {deleteTarget && (
            <>
              <DialogHeader>
                <DialogTitle>Hapus Pengguna</DialogTitle>
                <DialogDescription>
                  Yakin ingin menghapus pengguna &quot;{deleteTarget.username}&quot;? Tindakan ini
                  tidak bisa dibatalkan.
                </DialogDescription>
              </DialogHeader>

              {deleteError && (
                <Alert variant="destructive">
                  <AlertDescription>{deleteError}</AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={deleteMengirim}
                  onClick={tutupHapus}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteMengirim}
                  onClick={() => void handleHapus()}
                >
                  {deleteMengirim ? 'Menghapus...' : 'Hapus'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
